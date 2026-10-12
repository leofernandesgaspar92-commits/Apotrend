// Aktualität der Daten (services/coverage.js: abrufStand) und ihre Auskunft
// über /api/coverage/:land.
//
// Wer Informationen verkauft, muss sagen können, wie frisch sie sind — und
// darf alte Daten nicht wie frische zeigen. Auf dem kostenlosen Render-Tarif
// schläft der Dienst ohne Besucher ein; dann läuft kein Abruf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrufStand, createCoverageStore } from '../src/services/coverage.js';

const MIN = 60 * 1000;
const job = (vorMin, o = {}) => ({ name: 'news', intervalMs: 5 * MIN, lastRunAt: new Date(Date.now() - vorMin * MIN).toISOString(), lastOk: true, ...o });

test('frisch: innerhalb von drei Takten', () => {
  assert.equal(abrufStand(job(3)).aktuell, true);
  assert.equal(abrufStand(job(14)).aktuell, true);
});

test('alt: mehr als drei Takte — z. B. weil der Dienst geschlafen hat', () => {
  assert.equal(abrufStand(job(16)).aktuell, false);
  assert.equal(abrufStand(job(180)).aktuell, false);
});

test('nie gelaufen: nicht aktuell, kein erfundener Zeitpunkt', () => {
  const s = abrufStand(null, { intervallMs: 5 * MIN });
  assert.equal(s.aktuell, false);
  assert.equal(s.zuletzt, null);
  assert.equal(s.intervall_ms, 5 * MIN);
});

test('Engpässe: eigener Takt (4 Std.) — 6 Std. alt ist noch aktuell, 13 Std. nicht', () => {
  const engpass = (h) => ({ name: 'shortages', intervalMs: 240 * MIN, lastRunAt: new Date(Date.now() - h * 60 * MIN).toISOString() });
  assert.equal(abrufStand(engpass(6)).aktuell, true);
  assert.equal(abrufStand(engpass(13)).aktuell, false);
});

test('fehlgeschlagener letzter Lauf wird benannt', () => {
  assert.equal(abrufStand(job(2, { lastOk: false })).ok, false);
});

test('Datenquellen-Seite bekommt die Zahl der Meldungen je Quelle', () => {
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { nafdac_news: { ok: true, fetched: 12, country: 'NG' }, ppb_news: { ok: false, error: 'HTTP 404', country: 'KE' } } }, []);
  const alle = store.alle();
  assert.equal(alle['news:NG'].quellen[0].meldungen, 12);
  assert.equal(alle['news:KE'].quellen[0].fehler, 'HTTP 404');
});
