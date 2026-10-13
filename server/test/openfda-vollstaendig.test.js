// openFDA vollständig und richtig gelesen.
//
// Drei Fehler, die zusammen die US-Hälfte der Frühwarnung entwertet hätten:
//  1. Nur die erste Seite (1000 von ~1700) — und ohne zugesicherte Reihenfolge
//     rutschen Einträge zwischen zwei Abrufen aus dem Fenster: Die Chronik
//     hätte daraus beendete und neue Engpässe gemacht.
//  2. Der Rohstatus „Current" war unbekannt — jeder laufende Engpass flog raus.
//  3. Ohne Handelsnamen stand der Hersteller als Präparat da.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSourceAlleSeiten, shortagesFromJson, normalizeStatus } from '../src/services/sources.js';

const QUELLE = { id: 'openfda_test', kind: 'shortages', country: 'US', format: 'json', url: 'https://api.fda.test/drug/shortages.json?limit=1000', paging: 'openfda' };

function fda({ total = 1700, kaputt = null, leer = null } = {}) {
  const abrufe = [];
  const fetchText = async (url) => {
    abrufe.push(url);
    const u = new URL(url);
    const skip = Number(u.searchParams.get('skip') || 0);
    if (kaputt === skip) throw new Error('HTTP 500');
    const n = leer === skip ? 0 : Math.max(0, Math.min(1000, total - skip));
    const results = Array.from({ length: n }, (_, i) => ({ generic_name: 'Wirkstoff' + (skip + i), status: 'Current' }));
    return JSON.stringify({ meta: { results: { skip, limit: 1000, total } }, results });
  };
  return { fetchText, abrufe };
}
const opts = (f) => ({ fetchText: f.fetchText, retries: 0, sleep: async () => {}, discover: async () => null });

test('alle Seiten: 1700 Einträge aus zwei Abrufen', async () => {
  const f = fda();
  const r = await fetchSourceAlleSeiten(QUELLE, opts(f));
  const { rows } = shortagesFromJson(r.raw);
  assert.equal(rows.length, 1700, 'nur die erste Seite gelesen');
  assert.equal(f.abrufe.length, 2);
  assert.match(f.abrufe[1], /skip=1000/);
});

test('fällt eine Folgeseite aus, fällt der ganze Abruf aus — kein Teilbestand', async () => {
  await assert.rejects(() => fetchSourceAlleSeiten(QUELLE, opts(fda({ kaputt: 1000 }))));
  await assert.rejects(() => fetchSourceAlleSeiten(QUELLE, opts(fda({ leer: 1000 }))), /leer/);
});

test('Deckel gegen Endlosschleifen', async () => {
  await assert.rejects(() => fetchSourceAlleSeiten({ ...QUELLE, maxSeiten: 3 }, opts(fda({ total: 50000 }))), /mehr als 3 Seiten/);
});

test('passt alles auf eine Seite, kein zweiter Abruf; Quellen ohne Seiten unverändert', async () => {
  const f = fda({ total: 700 });
  await fetchSourceAlleSeiten(QUELLE, opts(f));
  assert.equal(f.abrufe.length, 1);
  const g = fda();
  await fetchSourceAlleSeiten({ ...QUELLE, paging: undefined }, opts(g));
  assert.equal(g.abrufe.length, 1);
});

test('Rohstatus „Current" und „Resolved" werden erkannt', () => {
  assert.equal(normalizeStatus('Current'), 'kritisch', 'jeder laufende US-Engpass fiel heraus');
  assert.equal(normalizeStatus('Resolved'), 'verfuegbar');
  assert.equal(normalizeStatus('To Be Discontinued'), 'eingeschraenkt');
});

test('ohne Handelsnamen: Darreichung statt Hersteller als Präparat', () => {
  const { rows } = shortagesFromJson({ results: [
    { generic_name: 'Amoxicillin', company_name: 'Hikma Pharmaceuticals USA Inc.', presentation: 'Amoxicillin Capsule, 500 mg', status: 'Current' },
    { generic_name: 'Cefazolin', company_name: 'Sandoz Inc.', status: 'Current' },
  ] });
  assert.equal(rows[0].bezeichnung, 'Amoxicillin Capsule, 500 mg');
  assert.equal(rows[1].bezeichnung, 'Cefazolin', 'der Hersteller stand als Präparat da');
  assert.ok(!rows.some((r) => /Hikma|Sandoz/.test(r.bezeichnung)));
});

test('die eingebaute FDA-Quelle holt alle Seiten', async () => {
  const { sourcesByKind } = await import('../src/services/sources.js');
  const fdaQuelle = sourcesByKind('shortages', {}).find((q) => q.id === 'openfda_shortages');
  assert.equal(fdaQuelle.paging, 'openfda');
});
