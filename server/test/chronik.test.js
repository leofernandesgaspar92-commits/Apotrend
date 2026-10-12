// Engpass-Chronik (services/chronik.js): Episoden je Land und Wirkstoff.
//
// Die Chronik ist der Informationsvorsprung, den keine einzelne Behördenliste
// hat. Sie ist aber nur so viel wert wie ihre Ehrlichkeitsregeln — jede hat
// hier einen eigenen Test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { refreshShortages } from '../src/services/liveData.js';

const TAG = 86400000;
function uhr(start = '2026-10-01') {
  let t = Date.parse(start + 'T09:00:00Z');
  return { jetzt: () => t, weiter: (tage) => { t += tage * TAG; } };
}
const still = { warn() {} };
const z = (wirkstoff, o = {}) => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status: 'kritisch', country: 'AT', provenance: 'verified', quelle: 'BASG', ...o });

test('Episode: Beginn, Fortsetzung, Ende beim ersten Abruf ohne die Zeile', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('Amoxicillin'), z('Ibuprofen')], laender: ['AT'] });
  u.weiter(10);
  c.beobachte({ zeilen: [z('Amoxicillin'), z('Ibuprofen')], laender: ['AT'] });
  u.weiter(10);
  c.beobachte({ zeilen: [z('Ibuprofen')], laender: ['AT'] });
  const f = c.fuer('Amoxicillin', 'AT');
  assert.equal(f.anzahl, 1);
  assert.equal(f.episoden[0].beginn, '2026-10-01');
  assert.equal(f.episoden[0].beginn_art, 'beobachtet');
  assert.equal(f.episoden[0].zuletzt_gesehen, '2026-10-11');
  assert.equal(f.episoden[0].ende, '2026-10-21', 'Ende = erster Abruf ohne die Zeile („spätestens")');
  assert.equal(f.durchschnitt_tage, 20);
  assert.equal(f.offen, null);
  assert.equal(c.fuer('Ibuprofen', 'AT').offen.dauer_tage, 20);
});

test('Wiederholte Engpässe werden gezählt; Durchschnitt nur aus beendeten', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  const lauf = (an) => c.beobachte({ zeilen: [z('Rest'), ...(an ? [z('Amoxicillin')] : [])], laender: ['AT'] });
  lauf(true); u.weiter(30); lauf(false);   // 1. Episode: 30 Tage
  u.weiter(40); lauf(true); u.weiter(10); lauf(false); // 2. Episode: 10 Tage
  u.weiter(20); lauf(true);                // 3. Episode: läuft
  const f = c.fuer('amoxicillin', 'AT');
  assert.equal(f.anzahl, 3);
  assert.equal(f.durchschnitt_tage, 20);
  assert.ok(f.offen);
  assert.equal(c.kurz('Amoxicillin', 'AT').anzahl, 3);
});

test('Regel 1: nur Behördendaten — keine Community-, keine Referenzzeilen', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [
    z('Basis'),
    z('Gemeldet', { provenance: 'community', reporter_user_id: 'u1' }),
    z('Referenz', { provenance: 'reference' }),
  ], laender: ['AT'] });
  assert.equal(c.fuer('Gemeldet', 'AT').anzahl, 0, 'eine unbestätigte Einzelmeldung ist keine Episode');
  assert.equal(c.fuer('Referenz', 'AT').anzahl, 0);
  assert.equal(c.fuer('Basis', 'AT').anzahl, 1);
});

test('Regel 2: ein Land ohne Lieferung schließt nichts', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('Amoxicillin')], laender: ['AT'] });
  u.weiter(5);
  // AT nicht in `laender` (Abruf fehlgeschlagen) …
  c.beobachte({ zeilen: [z('Metformin', { country: 'US' })], laender: ['US'] });
  // … und AT in `laender`, aber ohne eine einzige Behördenzeile.
  c.beobachte({ zeilen: [], laender: ['AT'] });
  assert.ok(c.fuer('Amoxicillin', 'AT').offen, 'ein Ausfall ist kein Ende');
});

test('Regel 3: verschwindet mehr als die Hälfte auf einmal, wird nichts geschlossen', () => {
  const u = uhr(); const warn = []; const c = createChronik({ jetzt: u.jetzt, log: { warn: (m) => warn.push(m) } });
  const alle = Array.from({ length: 20 }, (_, i) => z('Wirkstoff' + i));
  c.beobachte({ zeilen: alle, laender: ['AT'] });
  u.weiter(1);
  const r = c.beobachte({ zeilen: alle.slice(0, 5), laender: ['AT'] }); // „Seite 1 von 4"
  assert.equal(r.geschlossen, 0);
  assert.equal(r.zurueckgehalten.length, 1);
  assert.ok(c.fuer('Wirkstoff19', 'AT').offen);
  assert.match(warn.join(), /unvollständige Antwort/);
  // Einzelne Lösungen schließen normal.
  u.weiter(1);
  assert.equal(c.beobachte({ zeilen: alle.slice(0, 18), laender: ['AT'] }).geschlossen, 2);
});

test('Regel 4: Lücke bis 7 Tage ist derselbe Engpass, danach ein neuer', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  const lauf = (an) => c.beobachte({ zeilen: [z('Rest'), ...(an ? [z('Amoxicillin')] : [])], laender: ['AT'] });
  lauf(true); u.weiter(1); lauf(false); u.weiter(3); lauf(true);
  assert.equal(c.fuer('Amoxicillin', 'AT').anzahl, 1, 'Aussetzer der Liste zählte als zweiter Engpass');
  u.weiter(1); lauf(false); u.weiter(8); lauf(true);
  assert.equal(c.fuer('Amoxicillin', 'AT').anzahl, 2);
});

test('Regel 5: Meldedatum der Behörde gilt als Beginn — kein Datum aus der Zukunft', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('A', { gemeldet_am: '2026-08-15' }), z('B', { gemeldet_am: '2027-01-01' }), z('C', { gemeldet_am: '15.08.2026' })], laender: ['AT'] });
  assert.deepEqual([c.fuer('A', 'AT').episoden[0].beginn, c.fuer('A', 'AT').episoden[0].beginn_art], ['2026-08-15', 'gemeldet']);
  assert.equal(c.fuer('B', 'AT').episoden[0].beginn_art, 'beobachtet', 'Zukunftsdatum ist kein Beginn');
  assert.equal(c.fuer('C', 'AT').episoden[0].beginn_art, 'beobachtet', 'unklares Format wird nicht geraten');
  assert.equal(c.fuer('A', 'AT').offen.dauer_tage, 47);
});

test('Regel 6: Aufzeichnungsbeginn je Land; nie beobachtetes Land -> null', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('A')], laender: ['AT'] });
  u.weiter(3);
  c.beobachte({ zeilen: [z('A'), z('M', { country: 'US' })], laender: ['AT', 'US'] });
  assert.equal(c.aufzeichnungSeit('AT'), '2026-10-01');
  assert.equal(c.aufzeichnungSeit('US'), '2026-10-04');
  assert.equal(c.fuer('A', 'PT'), null, 'kein „0× knapp" für ein Land, das nie beobachtet wurde');
  assert.equal(c.kurz('Unbekannt', 'AT'), null);
});

test('Länder bleiben getrennt; Wirkstoff ohne Akzent-/Großschreibungsunterschied', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('Paracétamol', { country: 'PT' }), z('Rest')], laender: ['PT', 'AT'] });
  assert.equal(c.fuer('paracetamol', 'PT').anzahl, 1);
  assert.equal(c.fuer('Paracetamol', 'AT').anzahl, 0);
});

test('„verfügbar" beendet die Episode; schwerster Status und Präparate werden gemerkt', () => {
  const u = uhr(); const c = createChronik({ jetzt: u.jetzt, log: still });
  c.beobachte({ zeilen: [z('A', { status: 'eingeschraenkt', bezeichnung: 'A 1' }), z('A', { bezeichnung: 'A 2' })], laender: ['AT'] });
  u.weiter(2);
  c.beobachte({ zeilen: [z('A', { status: 'verfuegbar' })], laender: ['AT'] });
  const e = c.fuer('A', 'AT').episoden[0];
  assert.equal(e.ende, '2026-10-03');
  assert.equal(e.schwerster_status, 'kritisch');
  assert.deepEqual(e.praeparate, ['A 1', 'A 2']);
});

test('Sichern und Wiederherstellen', () => {
  const u = uhr(); const a = createChronik({ jetzt: u.jetzt, log: still });
  a.beobachte({ zeilen: [z('A')], laender: ['AT'] });
  const b = createChronik({ jetzt: u.jetzt, log: still });
  b.__load(JSON.parse(JSON.stringify(a.__dump())));
  assert.deepEqual(b.fuer('A', 'AT'), a.fuer('A', 'AT'));
});

// ── Zwei Fehler im Abruf, die beim Bau auffielen ─────────────────────────────

test('replaceFeed ersetzt nur die betroffenen Länder — der letzte AT-Stand bleibt, wenn nur US liefert', () => {
  const repo = createShortagesRepo({ seed: false });
  repo.replaceFeed([z('Amoxicillin'), z('Metformin', { country: 'US' })], { provenance: 'verified', quelle: 'x' });
  repo.replaceFeed([z('Lisinopril', { country: 'US' })], { provenance: 'verified', quelle: 'openFDA' });
  const namen = repo.list().map((r) => r.wirkstoff).sort();
  assert.deepEqual(namen, ['Amoxicillin', 'Lisinopril'], 'AT verschwand, weil die US-Quelle lieferte');
  // Eine Behörde meldet eine LEERE Liste: ausdrücklich nur dieses Land leeren.
  repo.replaceFeed([], { provenance: 'verified', laender: ['AT'] });
  assert.deepEqual(repo.list().map((r) => r.wirkstoff), ['Lisinopril']);
});

test('replaceFeed: Quelle der Zeile vor der Sammelangabe', () => {
  const repo = createShortagesRepo({ seed: false });
  repo.replaceFeed([z('A', { quelle: 'BASG' }), z('B', { country: 'US', quelle: 'openFDA' })], { provenance: 'verified', quelle: 'BASG, openFDA' });
  assert.deepEqual(repo.list().map((r) => r.quelle).sort(), ['BASG', 'openFDA']);
});

test('Länder-Feed: Zeilen tragen das Land ihrer Quelle', async () => {
  const repo = createShortagesRepo({ seed: false });
  const r = await refreshShortages('DE', {
    shortagesRepo: repo, env: { APOPULSE_LIVE_SHORTAGES_DE: 'https://x.test/de.json' },
    fetchJson: async () => ({ source: 'BfArM', shortages: [{ wirkstoff: 'Ibuprofen', bezeichnung: 'Ibuprofen 400', status: 'kritisch' }] }),
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(repo.list({ country: 'AT' }).length, 0, 'eine deutsche Zeile erschien in Österreich');
  assert.equal(repo.list({ country: 'DE' })[0].country, 'DE');
});

test('Status mit Umlaut wird erkannt („eingeschränkt lieferbar")', async () => {
  const { normalizeStatus } = await import('../src/services/sources.js');
  assert.equal(normalizeStatus('eingeschraenkt lieferbar'), 'eingeschraenkt');
  assert.equal(normalizeStatus('Eingeschränkt  lieferbar'), 'eingeschraenkt', 'die Behördenzeile fiel an einem Umlaut weg');
  assert.equal(normalizeStatus('frei erfunden'), null, 'Unbekanntes bleibt unbekannt');
});
