// Anzeigen für Unternehmen (services/anzeigen.js): Regeln, Ablauf, Auslieferung, Zahlen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnzeigen, MAX_AM_TAG } from '../src/services/anzeigen.js';
import { werbeplaetzeAusUmgebung } from '../src/data/werbeplaetze.js';

const TAG = 86400000;
const PROFILE = {
  pharma: { account_type: 'pharma', country: 'AT' }, apo: { account_type: 'pharmacy', country: 'AT', verified: true },
  apoUnver: { account_type: 'pharmacy', country: 'AT' }, privat: { account_type: 'private', country: 'AT' },
  apoDE: { account_type: 'pharmacy', country: 'DE', verified: true }, red: { account_type: 'pharmacy', country: 'AT' },
};
const FIRMA = { firma: 'Pharma AG', strasse: 'Weg 1', plz: '1010', ort: 'Wien', land: 'AT', email: 'rechnung@pharma.example' };

function aufbau({ betreiber = {} } = {}) {
  let t = Date.parse('2026-10-13T08:00:00Z');
  const glocke = [];
  const zeichen = { ausstellen: (uid, id, tag) => `${uid}.${id}.${tag}`, pruefen: (z, id) => { const [uid, kid, tag] = z.split('.'); return kid === id ? { uid, tag } : null; } };
  const a = createAnzeigen({
    jetzt: () => t, plaetze: werbeplaetzeAusUmgebung({}), profilVon: (u) => PROFILE[u] || null,
    rxErlaubtFuer: (u) => !!(PROFILE[u] && PROFILE[u].verified), istModerator: (u) => u === 'red', moderatoren: () => ['red'],
    benachrichtige: (n) => glocke.push(n), betreiber, klickZeichen: zeichen,
  });
  return { a, glocke, weiter: (d) => { t += d * TAG; } };
}
const basis = (o = {}) => ({ titel: 'Neues Kühllager in Wien', text: 'Temperaturgeführte Lagerung und Zustellung für Apotheken, 2–8 °C.', link: 'https://example.com/kuehl',
  platz: 'start', laender: ['AT'], zielgruppen: ['pharmacy'], wochen: 2, start: '2026-10-13', ...o });

test('Preis: Platz × Länder × Wochen; Startpreise über die Umgebung setzbar', () => {
  const { a } = aufbau();
  a.firmaSetzen('pharma', FIRMA);
  const k = a.anlegen('pharma', basis({ laender: ['AT', 'DE'], wochen: 3 }));
  assert.equal(k.preis_cents, 49000 * 2 * 3);
  assert.equal(k.ende, '2026-11-02', '3 Wochen ab 13.10. = bis einschließlich 02.11.');
  assert.equal(werbeplaetzeAusUmgebung({ APOPULSE_WERBEPREISE: 'start:350, feed:abc, x:5' }).start.preis_woche_cents, 35000);
  assert.equal(werbeplaetzeAusUmgebung({ APOPULSE_WERBEPREISE: 'feed:abc' }).feed.preis_woche_cents, 29000, 'Unbrauchbares bleibt beim Standard');
});

test('wer werben darf; Pflichtfelder; Link nur https', () => {
  const { a } = aufbau();
  assert.throws(() => a.firmaSetzen('privat', FIRMA), /Unternehmen der Branche/);
  assert.throws(() => a.anlegen('pharma', basis()), /Firmen- und Rechnungsangaben/);
  a.firmaSetzen('pharma', FIRMA);
  assert.throws(() => a.anlegen('pharma', basis({ link: 'http://example.com' })), /Nur https/);
  assert.throws(() => a.anlegen('pharma', basis({ link: 'https://u:p@example.com' })), /Zugangsdaten/);
  assert.throws(() => a.anlegen('pharma', basis({ start: '2026-10-01' })), /heute oder später/);
  assert.throws(() => a.anlegen('pharma', basis({ zielgruppen: [] })), /Berufsgruppe/);
});

test('Arzneimittelwerbung: Pflichtangaben nötig; Rx nie an Privatpersonen; „unbestimmt" zählt als Rx', () => {
  const { a } = aufbau();
  a.firmaSetzen('pharma', FIRMA);
  assert.throws(() => a.anlegen('pharma', basis({ art: 'arzneimittel', rx: true, pflichtangaben: 'kurz' })), /Pflichtangaben/);
  const pfl = 'Bezeichnung: X 10 mg. Zusammensetzung: … Anwendungsgebiete: … Nebenwirkungen: … Verschreibungspflichtig.';
  assert.throws(() => a.anlegen('pharma', basis({ art: 'arzneimittel', rx: true, pflichtangaben: pfl, zielgruppen: ['pharmacy', 'private'] })), /Privatpersonen/);
  assert.throws(() => a.anlegen('pharma', basis({ art: 'arzneimittel', pflichtangaben: pfl, zielgruppen: ['private'] })), /Privatpersonen/, 'ohne Angabe = Rx');
  const otc = a.anlegen('pharma', basis({ art: 'arzneimittel', rx: 'otc', pflichtangaben: pfl, zielgruppen: ['private'] }));
  assert.equal(otc.rx, false);
});

function laufende(a, o = {}) {
  a.firmaSetzen('pharma', FIRMA);
  const k = a.anlegen('pharma', basis(o));
  a.einreichen('pharma', k.id);
  a.freigeben('red', k.id);
  a.bezahlt(k.id, { methode: 'krypto', payment_id: 'p1' });
  return k.id;
}

test('Ablauf: erst prüfen, dann zahlen; Ablehnung mit Grund; Benachrichtigungen', () => {
  const { a, glocke } = aufbau();
  a.firmaSetzen('pharma', FIRMA);
  const k = a.anlegen('pharma', basis());
  assert.throws(() => a.kampagneFuerZahlung('pharma', k.id), /freigegebene/, 'Bezahlen vor der Prüfung');
  a.einreichen('pharma', k.id);
  assert.equal(glocke.at(-1).type, 'anzeige_pruefen');
  assert.throws(() => a.bearbeiten('pharma', k.id, basis()), /nicht mehr ändern/);
  assert.throws(() => a.freigeben('pharma', k.id), /Nur Redaktion/);
  assert.throws(() => a.ablehnen('red', k.id, ''), /Grund/);
  a.ablehnen('red', k.id, 'Pflichtangaben unvollständig');
  assert.deepEqual([glocke.at(-1).type, glocke.at(-1).userId], ['anzeige_abgelehnt', 'pharma']);
  a.bearbeiten('pharma', k.id, basis({ titel: 'Kühllager Wien — neu' }));
  a.einreichen('pharma', k.id);
  a.freigeben('red', k.id);
  assert.equal(a.kampagneFuerZahlung('pharma', k.id).betrag_cents, 98000);
  assert.equal(a.bezahlt(k.id, { methode: 'krypto' }).zustand, 'laeuft');
  assert.equal(glocke.at(-1).type, 'anzeige_bezahlt');
});

test('Auslieferung: Land, Berufsgruppe, Zeitraum, Pause, nicht an sich selbst', () => {
  const { a, weiter } = aufbau();
  const id = laufende(a, { start: '2026-10-14', wochen: 1 });
  assert.equal(a.ausliefern('apo', 'start'), null, 'vor dem Start');
  weiter(1);
  assert.equal(a.ausliefern('apo', 'start').id, id);
  assert.equal(a.ausliefern('apo', 'feed'), null, 'anderer Platz');
  assert.equal(a.ausliefern('apoDE', 'start'), null, 'anderes Land');
  assert.equal(a.ausliefern('privat', 'start'), null, 'nicht gebuchte Berufsgruppe');
  assert.equal(a.ausliefern('pharma', 'start'), null, 'Werbekundin sieht sich nicht selbst (zählte sonst)');
  a.pausieren('red', id, true);
  assert.equal(a.ausliefern('apo', 'start'), null, 'pausiert (Notbremse der Redaktion)');
  a.pausieren('pharma', id, false);
  weiter(7);
  assert.equal(a.ausliefern('apo', 'start'), null, 'nach dem Ende');
});

test('Rx-Werbung nur an verifizierte Fachkreise — auch wenn die Berufsgruppe gebucht ist', () => {
  const { a } = aufbau();
  laufende(a, { art: 'arzneimittel', rx: true, pflichtangaben: 'Bezeichnung: X 10 mg. Zusammensetzung: … Anwendungsgebiete: … Verschreibungspflichtig.' });
  assert.ok(a.ausliefern('apo', 'start'), 'verifizierte Apotheke');
  assert.equal(a.ausliefern('apoUnver', 'start'), null, 'nicht verifizierte Apotheke sieht keine Rx-Werbung');
});

test('Kennzeichnung: „Warum sehe ich das?" nennt Firma, Länder, Berufsgruppen', () => {
  const { a } = aufbau();
  laufende(a);
  const ad = a.ausliefern('apo', 'start');
  assert.deepEqual([ad.firma, ad.warum.bezahlt_von, ad.warum.laender, ad.warum.zielgruppen], ['Pharma AG', 'Pharma AG', ['AT'], ['pharmacy']]);
});

test('Zahlen sind echt: Einblendungen gezählt, höchstens MAX am Tag; Klick nur mit Zeichen und einmal', () => {
  const { a } = aufbau();
  const id = laufende(a);
  const ads = Array.from({ length: MAX_AM_TAG + 2 }, () => a.ausliefern('apo', 'start'));
  assert.equal(ads.filter(Boolean).length, MAX_AM_TAG);
  const z = ads[0].klick.split('z=')[1];
  assert.equal(a.klick(id, decodeURIComponent(z)), 'https://example.com/kuehl');
  a.klick(id, decodeURIComponent(z));
  assert.equal(a.klick(id, 'gefälscht'), 'https://example.com/kuehl', 'Link funktioniert auch ohne gültiges Zeichen');
  const s = a.statistik('pharma', id);
  assert.deepEqual([s.tage[0].impressionen, s.tage[0].klicks], [MAX_AM_TAG, 1]);
  assert.deepEqual(s.je_gruppe, { pharmacy: MAX_AM_TAG });
});

test('ausblenden und melden: Anzeige verschwindet für diese Person, Redaktion erfährt es', () => {
  const { a, glocke } = aufbau();
  const id = laufende(a);
  a.melden('apo', id, 'irreführend');
  assert.equal(a.ausliefern('apo', 'start'), null);
  assert.equal(glocke.at(-1).type, 'anzeige_gemeldet');
});

test('Rechnung nur mit vollständigen Betreiberangaben; Überweisung verbuchen startet die Anzeige', () => {
  const ohne = aufbau();
  ohne.a.firmaSetzen('pharma', FIRMA);
  const k0 = ohne.a.anlegen('pharma', basis()); ohne.a.einreichen('pharma', k0.id); ohne.a.freigeben('red', k0.id);
  assert.throws(() => ohne.a.rechnungAusstellen('pharma', k0.id), /noch nicht eingerichtet/);
  const { a } = aufbau({ betreiber: { firma: 'ApoPulse', anschrift: 'Ring 1, 1010 Wien', iban: 'AT00 0000 0000 0000 0000', ust_satz: 20 } });
  a.firmaSetzen('pharma', FIRMA);
  const k = a.anlegen('pharma', basis()); a.einreichen('pharma', k.id); a.freigeben('red', k.id);
  const r = a.rechnungAusstellen('pharma', k.id).rechnung;
  assert.deepEqual([r.nummer, r.netto_cents, r.ust_cents, r.brutto_cents], ['AP-2026-0001', 98000, 19600, 117600]);
  assert.equal(r.empfaenger.firma, 'Pharma AG');
  assert.throws(() => a.ueberweisungVerbuchen('pharma', k.id), /Nur Redaktion/);
  assert.equal(a.ueberweisungVerbuchen('red', k.id).zustand, 'laeuft');
});

test('Sicherung: Kampagnen, Firmen und Ausblendungen überleben den Neustart', () => {
  const { a } = aufbau();
  const id = laufende(a);
  a.ausblenden('apo', id);
  const { a: b } = aufbau();
  b.__load(JSON.parse(JSON.stringify(a.__dump())));
  assert.equal(b.meine('pharma')[0].id, id);
  assert.equal(b.firma('pharma').firma, 'Pharma AG');
  assert.equal(b.ausliefern('apo', 'start'), null, 'Ausblendung bleibt');
});
