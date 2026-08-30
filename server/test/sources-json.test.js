// ============================================================================
//  JSON-Engpass-Adapter und die neuen Länderquellen
// ============================================================================
//  Der Kern dieser Datei ist eine einzige Frage: Was passiert mit einem
//  Statuswert, den wir nicht kennen?
//
//  Die naheliegende Schreibweise `status: item.status || 'LIMITED'` beantwortet
//  sie falsch. Sie schreibt den Rohwert der Behörde ungeprüft weiter — ein
//  „nicht lieferbar" käme dann als „eingeschränkt lieferbar" in der Apotheke an,
//  oder ein unbekannter Wert flöge beim Schreiben in die Datenbank auf die Nase.
//  An dieser Stelle entscheidet jemand, ob umbestellt wird.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { shortagesFromJson, activeSources, sourcesByKind, regulatorOf } from '../src/services/sources.js';

/** Nur die eingebauten Quellen, ohne die Umgebung der Testmaschine. */
const nurBuiltin = () => activeSources({});

// ── Adapter ─────────────────────────────────────────────────────────────────

test('nacktes Array wird gelesen', () => {
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', status: 'kritisch', grund: 'Erhöhte Nachfrage' },
  ]));
  assert.equal(rejected.length, 0);
  assert.deepEqual(rows[0], {
    wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'kritisch',
    grund: 'Erhöhte Nachfrage', gemeldet_am: null, voraussichtlich_bis: null,
  });
});

test('Liste in einer Hülle wird auch gefunden', () => {
  // Die genaue Antwortform der BASG-Schnittstelle war hier nicht abrufbar.
  // Deshalb werden die üblichen Hüllen mitgeprüft, statt ein nacktes Array
  // vorauszusetzen und bei allem anderen mit null umzufallen.
  for (const key of ['items', 'data', 'results', 'shortages', 'content']) {
    const { rows } = shortagesFromJson(JSON.stringify({ [key]: [{ bezeichnung: 'X', status: 'kritisch' }] }));
    assert.equal(rows.length, 1, `Hülle "${key}" wurde nicht erkannt`);
  }
});

test('unbekannter Status verwirft die Zeile — er wird NICHT zu LIMITED gemacht', () => {
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { bezeichnung: 'Gut', status: 'kritisch' },
    { bezeichnung: 'Unklar', status: 'teilweise eventuell' },
    { bezeichnung: 'Leer', status: '' },
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Gut');
  assert.equal(rejected.length, 2);
  assert.match(rejected[0], /Status unbekannt \(teilweise eventuell\)/);
});

test('englische und deutsche Statuswerte werden beide erkannt', () => {
  const { rows } = shortagesFromJson(JSON.stringify([
    { product: 'A', availability: 'critical' },
    { product: 'B', availability: 'limited' },
    { product: 'C', availability: 'available' },
    { product: 'D', availability: 'nicht lieferbar' },
  ]));
  assert.deepEqual(rows.map((r) => r.status),
    ['kritisch', 'eingeschraenkt', 'verfuegbar', 'kritisch']);
});

test('Zeile ohne Bezeichnung wird verworfen statt leer gespeichert', () => {
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { wirkstoff: 'Nur Wirkstoff', status: 'kritisch' },
    null,
    'kein Objekt',
  ]));
  assert.equal(rows.length, 0);
  assert.equal(rejected.length, 3);
});

test('eigene Feldzuordnung schlägt die Standardnamen', () => {
  // Der Weg für den Fall, dass eine Behörde ein Feld umbenennt: eine
  // Umgebungsvariable statt eines Deploys.
  const { rows } = shortagesFromJson(
    JSON.stringify([{ nameDesArzneimittels: 'Spezialität A', vertrieb: 'kritisch' }]),
    { columns: { bezeichnung: 'nameDesArzneimittels', status: 'vertrieb' } },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Spezialität A');
  assert.equal(rows[0].status, 'kritisch');
});

test('kaputtes JSON und fehlende Liste werfen mit lesbarer Begründung', () => {
  assert.throws(() => shortagesFromJson('{nicht json'), /kein gültiges JSON/);
  assert.throws(() => shortagesFromJson('{"meldungen":42}'), /Keine Liste gefunden/);
});

test('ein bereits geparstes Objekt wird ebenfalls angenommen', () => {
  const { rows } = shortagesFromJson([{ bezeichnung: 'A', status: 'kritisch' }]);
  assert.equal(rows.length, 1);
});

// ── Quellenregister ─────────────────────────────────────────────────────────

test('alle vom Owner benannten Länder haben eine News-Quelle', () => {
  const news = sourcesByKind('news', {});
  const laender = new Set(news.map((s) => s.country));
  for (const cc of ['AT', 'DE', 'CH', 'GB', 'US', 'CA', 'AU', 'ZA', 'EU']) {
    assert.ok(laender.has(cc), `Für ${cc} fehlt eine News-Quelle`);
  }
});

test('jede Länderquelle findet ihre Behörde im Länder-Register', () => {
  // Ohne diese Zuordnung stünde am Beitrag keine Quellenangabe — und
  // CLAUDE.md verlangt für sicherheitsrelevante Aussagen genau die.
  for (const s of sourcesByKind('news', {})) {
    if (s.country === 'EU') continue; // EMA ist keinem Land zugeordnet
    assert.ok(regulatorOf(s.country), `Kein Regulator für ${s.country} (${s.id})`);
  }
  assert.equal(regulatorOf('CH'), 'Swissmedic');
  assert.equal(regulatorOf('GB'), 'MHRA');
  assert.equal(regulatorOf('ZA'), 'SAHPRA');
});

test('die Engpass-Quelle ist als strukturierter Export angemeldet, nicht als News', () => {
  // Der Kern der Trennung: Aus Schlagzeilen entstehen keine Engpass-Datensätze.
  const engpaesse = sourcesByKind('shortages', {});
  assert.equal(engpaesse.length, 1);
  assert.equal(engpaesse[0].id, 'basg_shortages');
  assert.equal(engpaesse[0].format, 'json');
  assert.equal(engpaesse[0].country, 'AT');
  // Und keine der News-Quellen darf versehentlich als Engpass-Quelle gelten.
  assert.ok(sourcesByKind('news', {}).every((s) => s.format === 'rss'));
});

test('jede neue Quelle lässt sich einzeln abschalten', () => {
  const aus = { APOPULSE_SOURCE_FDA_NEWS_URL: '', APOPULSE_SOURCE_SAHPRA_NEWS_URL: '' };
  const ids = activeSources(aus).map((s) => s.id);
  assert.ok(!ids.includes('fda_news'));
  assert.ok(!ids.includes('sahpra_news'));
  assert.ok(ids.includes('tga_news'), 'die übrigen bleiben unberührt');
});

test('alle eingebauten Quellen haben eindeutige Kennungen und https-URLs', () => {
  const alle = nurBuiltin();
  assert.equal(new Set(alle.map((s) => s.id)).size, alle.length, 'doppelte Kennung');
  for (const s of alle) {
    assert.match(s.url, /^https:\/\//, `${s.id} ist nicht https`);
    assert.ok(s.label, `${s.id} hat kein Etikett`);
  }
});
