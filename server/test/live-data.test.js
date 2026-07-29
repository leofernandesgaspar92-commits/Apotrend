import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';
import { validateShortagePayload, refreshShortages, isLive, liveSources, startLiveRefresh, validatePricePayload, refreshPrices, isPriceLive, livePriceSources, validateRabattePayload, refreshRabatte, isRabatteLive } from '../src/services/liveData.js';

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

test('validatePricePayload: prüft bezeichnung/supplier/aep; sammelt Fehler', () => {
  assert.equal(validatePricePayload({}).ok, false, 'ohne prices-Array ungültig');
  const good = validatePricePayload({ prices: [
    { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Kwizda', aep: 3.01, prev_aep: 3.05, series: [3.1, 3.0] },
  ] });
  assert.equal(good.ok, true);
  assert.equal(good.rows[0].currency, 'EUR', 'Währung default EUR');
  assert.equal(good.rows[0].aep, 3.01);
  const bad = validatePricePayload({ prices: [
    { bezeichnung: 'X', supplier: 'Y', aep: -1 },      // aep <= 0
    { bezeichnung: 'X', aep: 5 },                       // supplier fehlt
    { supplier: 'Y', aep: 5 },                          // bezeichnung fehlt
  ] });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
  assert.equal(bad.rows.length, 0);
});

test('refreshPrices: übernimmt gültige Preise (verified), ersetzt Seed; Fehler lassen Bestand', async () => {
  const repo = createPricesRepo({ seed: true });
  const before = repo.listFlat().length;
  const env = { APOTREND_LIVE_PRICES_AT: 'https://live/prices.json' };
  const payload = { source: 'Großhandel-X', prices: [
    { bezeichnung: 'Amoxicillin 1000 mg', supplier: 'Kwizda', aep: 2.99, prev_aep: 3.05 },
    { bezeichnung: 'Amoxicillin 1000 mg', supplier: 'Herba', aep: 3.40 },
  ] };
  const r = await refreshPrices('AT', { fetchJson: async () => payload, pricesRepo: repo, env });
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  const flat = repo.listFlat();
  assert.equal(flat.length, 2, 'Seed ersetzt');
  assert.equal(flat[0].provenance, 'verified');
  assert.equal(flat[0].quelle, 'Großhandel-X');
  // ungültig -> Bestand unverändert
  const bad = await refreshPrices('AT', { fetchJson: async () => ({ prices: [{ bezeichnung: 'A', supplier: 'B', aep: 0 }] }), pricesRepo: repo, env });
  assert.equal(bad.ok, false);
  assert.equal(repo.listFlat().length, 2, 'ungültige Daten ändern nichts');
  // isPriceLive / livePriceSources
  assert.equal(isPriceLive('AT', env), true);
  assert.equal(isPriceLive('AT', {}), false);
  assert.deepEqual(Object.keys(livePriceSources(env)), ['AT']);
});

test('validateRabattePayload + refreshRabatte: Pflichtfelder, Übernahme (verified), Fehler-Fallback', async () => {
  assert.equal(validateRabattePayload({}).ok, false);
  const bad = validateRabattePayload({ rabatte: [
    { bezeichnung: 'A', supplier: 'S', listenpreis: 5, aktionspreis: 4 }, // gueltig_bis fehlt
    { bezeichnung: 'B', supplier: 'S', listenpreis: 0, aktionspreis: 4, gueltig_bis: '2026-09-30' }, // listenpreis 0
  ] });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 2);
  const repo = createRabatteRepo({ seed: true, today: '2026-07-07' });
  const before = repo.listFlat().length;
  const env = { APOTREND_LIVE_RABATTE_AT: 'https://live/deals.json' };
  const payload = { source: 'Aktions-Feed', rabatte: [
    { bezeichnung: 'Ibuprofen 400 mg', wirkstoff: 'Ibuprofen', supplier: 'Kwizda', listenpreis: 2.35, aktionspreis: 1.60, min_menge: 30, gueltig_bis: '2026-12-31' },
  ] };
  const r = await refreshRabatte('AT', { fetchJson: async () => payload, rabatteRepo: repo, env });
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  const flat = repo.listFlat();
  assert.equal(flat.length, 1, 'Seed ersetzt');
  assert.equal(flat[0].provenance, 'verified');
  assert.equal(flat[0].quelle, 'Aktions-Feed');
  assert.equal(flat[0].rabatt_pct > 0, true, 'Rabatt berechnet');
  // ungültig -> Bestand bleibt
  const invalid = await refreshRabatte('AT', { fetchJson: async () => ({ rabatte: [{ bezeichnung: 'A', supplier: 'S', listenpreis: 1, aktionspreis: 1 }] }), rabatteRepo: repo, env });
  assert.equal(invalid.ok, false);
  assert.equal(repo.listFlat().length, 1);
  assert.equal(isRabatteLive('AT', env), true);
  assert.equal(isRabatteLive('AT', {}), false);
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
