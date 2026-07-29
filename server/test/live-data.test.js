import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { validateShortagePayload, refreshShortages, isLive, liveSources, startLiveRefresh } from '../src/services/liveData.js';

test('validateShortagePayload: akzeptiert gültige Zeilen, sammelt Fehler, lehnt Schrott ab', () => {
  assert.equal(validateShortagePayload(null).ok, false);
  assert.equal(validateShortagePayload({}).ok, false, 'ohne shortages-Array ungültig');
  const good = validateShortagePayload({ shortages: [
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'kritisch', grund: 'Nachfrage' },
  ] });
  assert.equal(good.ok, true);
  assert.equal(good.rows.length, 1);
  assert.equal(good.rows[0].voraussichtlich_bis, null, 'optionale Felder auf null normalisiert');
  // ungültiger Status + fehlender Wirkstoff -> zwei Fehler, keine Zeile
  const bad = validateShortagePayload({ shortages: [
    { wirkstoff: 'X', bezeichnung: 'Y', status: 'quatsch' },
    { bezeichnung: 'ohne Wirkstoff', status: 'kritisch' },
  ] });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 2);
  assert.equal(bad.rows.length, 0);
});

test('isLive/liveSources: nur mit gesetzter ENV-Variable „angeschlossen"', () => {
  assert.equal(isLive('AT', {}), false);
  assert.equal(isLive('AT', { APOTREND_LIVE_SHORTAGES_AT: 'https://x/y.json' }), true);
  const s = liveSources({ APOTREND_LIVE_SHORTAGES_NG: 'https://n/g.json', OTHER: 'x' });
  assert.deepEqual(Object.keys(s), ['NG']);
  assert.equal(s.NG.url, 'https://n/g.json');
});

test('refreshShortages: übernimmt gültige Live-Daten (provenance=verified), Community-Meldungen bleiben', async () => {
  const repo = createShortagesRepo({ seed: true });
  // Eine echte Community-Meldung (reporter_user_id gesetzt) muss erhalten bleiben.
  repo.upsert({ wirkstoff: 'Community-Wirkstoff', bezeichnung: 'Von Apotheke gemeldet', status: 'kritisch', reporter_user_id: 'user-1', provenance: 'reported' });
  const env = { APOTREND_LIVE_SHORTAGES_AT: 'https://live/at.json' };
  const payload = { country: 'AT', source: 'BASG', shortages: [
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'kritisch' },
    { wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhalat', status: 'eingeschraenkt' },
  ] };
  const r = await refreshShortages('AT', { fetchJson: async () => payload, shortagesRepo: repo, env });
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.source, 'BASG');
  const list = repo.list();
  // Seed ist ersetzt, Community-Meldung erhalten, Live-Einträge verified + Quelle BASG.
  assert.ok(list.some(s => s.wirkstoff === 'Community-Wirkstoff'), 'Community-Meldung bleibt');
  assert.ok(!list.some(s => s.wirkstoff === 'Levothyroxin'), 'alter Seed ersetzt');
  const amox = list.find(s => s.wirkstoff === 'Amoxicillin');
  assert.equal(amox.provenance, 'verified');
  assert.equal(amox.quelle, 'BASG');
});

test('refreshShortages: ungültige Daten oder Abruf-Fehler lassen den Bestand unverändert', async () => {
  const repo = createShortagesRepo({ seed: true });
  const before = repo.list().length;
  const env = { APOTREND_LIVE_SHORTAGES_AT: 'https://live/at.json' };
  // ungültiger Payload
  const bad = await refreshShortages('AT', { fetchJson: async () => ({ shortages: [{ wirkstoff: 'A', bezeichnung: 'B', status: 'x' }] }), shortagesRepo: repo, env });
  assert.equal(bad.ok, false);
  assert.equal(repo.list().length, before, 'Bestand unverändert bei ungültigen Daten');
  // Abruf-Fehler
  const err = await refreshShortages('AT', { fetchJson: async () => { throw new Error('offline'); }, shortagesRepo: repo, env });
  assert.equal(err.ok, false);
  assert.match(err.error, /Abruf/);
  assert.equal(repo.list().length, before, 'Bestand unverändert bei Abruf-Fehler');
});

test('refreshShortages: ohne konfigurierte Quelle wird übersprungen (nicht angeschlossen)', async () => {
  const repo = createShortagesRepo({ seed: true });
  const r = await refreshShortages('AT', { fetchJson: async () => ({ shortages: [] }), shortagesRepo: repo, env: {} });
  assert.equal(r.ok, false);
  assert.equal(r.skipped, true);
});

test('startLiveRefresh: ruht ohne Quelle; startet + ingestiert, sobald angeschlossen', async () => {
  const idle = startLiveRefresh({ shortagesRepo: createShortagesRepo(), env: {}, log: {} });
  assert.equal(idle, null, 'nicht angeschlossen -> läuft nicht');
  const repo = createShortagesRepo({ seed: true });
  const env = { APOTREND_LIVE_SHORTAGES_AT: 'https://live/at.json' };
  const payload = { source: 'BASG', shortages: [{ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'kritisch' }] };
  const handle = startLiveRefresh({ shortagesRepo: repo, env, fetchJson: async () => payload, log: {}, intervalMs: 1e9 });
  assert.ok(handle && handle.countries.includes('AT'));
  await new Promise(r => setTimeout(r, 30)); // ersten Auto-Refresh abwarten
  assert.equal(repo.list().length, 1, 'Live-Daten übernommen');
  assert.equal(repo.list()[0].provenance, 'verified');
  handle.stop();
});
