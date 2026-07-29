import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFxRates } from '../src/services/fxRates.js';

const okResponse = () => ({ json: async () => ({ result: 'success', base_code: 'EUR', time_last_update_unix: 1_700_000_000, rates: { EUR: 1, USD: 1.1, BRL: 6.0, NGN: 1700 } }) });

test('fxRates.rates: parst gültige Antwort, cached innerhalb der TTL', async () => {
  let calls = 0;
  const fx = createFxRates({ fetchImpl: async () => { calls++; return okResponse(); }, now: () => 1000 });
  const a = await fx.rates();
  assert.equal(a.base, 'EUR');
  assert.equal(a.rates.USD, 1.1);
  assert.equal(a.updated_at, 1_700_000_000 * 1000);
  await fx.rates();
  assert.equal(calls, 1, 'zweiter Aufruf aus dem Cache');
});

test('fxRates.convert: rechnet über die EUR-Kreuzrate; fehlender Kurs -> null', async () => {
  const fx = createFxRates({ fetchImpl: async () => okResponse() });
  const d = await fx.rates();
  // 110 USD -> EUR: 110 / 1.1 = 100
  assert.ok(Math.abs(fx.convert(110, 'USD', 'EUR', d) - 100) < 1e-9);
  // 100 EUR -> NGN: 100 * 1700 = 170000
  assert.ok(Math.abs(fx.convert(100, 'EUR', 'NGN', d) - 170000) < 1e-6);
  // 60 BRL -> USD: (60/6)*1.1 = 11
  assert.ok(Math.abs(fx.convert(60, 'BRL', 'USD', d) - 11) < 1e-9);
  assert.equal(fx.convert(100, 'EUR', 'XYZ', d), null, 'unbekannte Währung -> null');
  assert.equal(fx.convert(NaN, 'EUR', 'USD', d), null, 'ungültiger Betrag -> null');
});

test('fxRates: bei API-/Netzfehler letzter Stand, sonst null', async () => {
  let fail = false;
  const fx = createFxRates({ fetchImpl: async () => { if (fail) throw new Error('offline'); return okResponse(); }, now: () => 1000, ttlMs: 0 });
  const first = await fx.rates();
  assert.ok(first && first.rates.USD === 1.1);
  fail = true;
  const second = await fx.rates(); // TTL 0 -> neuer Versuch schlägt fehl -> letzter Stand
  assert.deepEqual(second, first, 'Fallback auf letzten bekannten Stand');
});

test('fxRates: leere/ungültige API-Antwort -> null (kein erfundener Kurs)', async () => {
  const fx = createFxRates({ fetchImpl: async () => ({ json: async () => ({ result: 'error' }) }) });
  assert.equal(await fx.rates(), null);
});
