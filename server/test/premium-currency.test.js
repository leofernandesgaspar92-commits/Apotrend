// ============================================================================
//  Premium-Preis in der Landeswährung
// ============================================================================
//  Hintergrund: Die Plattform läuft in 16 Ländern mit CHF, USD, AOA, NGN, KES …
//  Der Premium-Preis stand aber fest in EUR, und die Oberfläche hängte ein
//  hartkodiertes „€" an. Eine Apotheke in Luanda sah „9,99 €" und musste selbst
//  umrechnen — genau die Sorte Zumutung, die diese Zielgruppe nicht braucht.
//
//  Die Lösung erfindet KEINE zweite Preisliste: Abgerechnet wird weiter in der
//  Produktwährung, angezeigt wird zusätzlich eine Näherung zum ECHTEN Tageskurs.
//  Fehlt der Kurs, steht dort nichts — das ist der wichtigste Test hier.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { createPaymentsService } from '../src/services/payments.js';
import { createFxRates } from '../src/services/fxRates.js';

const RATES = { EUR: 1, CHF: 0.94, AOA: 950.5, USD: 1.08, NGN: 1750 };

const okFetch = async () => ({
  json: async () => ({ result: 'success', time_last_update_unix: 1_756_000_000, rates: RATES }),
});
const brokenFetch = async () => { throw new Error('Netz weg'); };

const service = (fx) => createPaymentsService({
  repo: { createPayment: () => ({ id: 'p1' }) },
  wallets: () => [],
  rates: null,
  fx,
});

test('Ohne Land bleibt alles wie bisher — nur die Produktwährung', async () => {
  const out = await service(createFxRates({ fetchImpl: okFetch })).cryptoOptions('premium_monthly');
  assert.equal(out.currency, 'EUR');
  assert.equal(out.amount, 9.99);
  assert.equal(out.local, null);
});

test('Gleiche Währung erzeugt keine überflüssige Zeile', async () => {
  const out = await service(createFxRates({ fetchImpl: okFetch }))
    .cryptoOptions('premium_monthly', { currency: 'EUR' });
  // „≈ 9,99 € in deiner Landeswährung" wäre nur Lärm.
  assert.equal(out.local, null);
});

test('Landeswährung wird zum echten Kurs umgerechnet', async () => {
  const svc = service(createFxRates({ fetchImpl: okFetch }));

  const chf = await svc.cryptoOptions('premium_monthly', { currency: 'CHF' });
  assert.equal(chf.local.currency, 'CHF');
  assert.ok(Math.abs(chf.local.amount - 9.99 * RATES.CHF) < 1e-9, String(chf.local.amount));

  const aoa = await svc.cryptoOptions('premium_monthly', { currency: 'AOA' });
  assert.ok(Math.abs(aoa.local.amount - 9.99 * RATES.AOA) < 1e-6, String(aoa.local.amount));

  // Der Kurszeitpunkt gehört dazu — ein Betrag ohne Stand ist nicht nachprüfbar.
  assert.equal(aoa.local.updated_at, 1_756_000_000_000);
});

test('DER KERNFALL: ohne Kurs wird nichts erfunden', async () => {
  const out = await service(createFxRates({ fetchImpl: brokenFetch }))
    .cryptoOptions('premium_monthly', { currency: 'AOA' });
  // Lieber nur die Abrechnungswährung zeigen als eine geschätzte Zahl.
  assert.equal(out.local, null);
  assert.equal(out.currency, 'EUR');
  assert.equal(out.amount, 9.99);
});

test('Ohne FX-Dienst bleibt der Aufruf trotzdem heil', async () => {
  const out = await service(null).cryptoOptions('premium_monthly', { currency: 'CHF' });
  assert.equal(out.local, null);
});

test('Unbekannte Währung liefert null statt eines falschen Betrags', async () => {
  const out = await service(createFxRates({ fetchImpl: okFetch }))
    .cryptoOptions('premium_monthly', { currency: 'XYZ' });
  assert.equal(out.local, null, 'für XYZ gibt es keinen Kurs — also keine Zahl');
});

test('Die alte Antwortform bleibt erhalten (keine Regression)', async () => {
  const out = await service(createFxRates({ fetchImpl: okFetch }))
    .cryptoOptions('premium_monthly', { currency: 'CHF' });
  // amount_eur wurde bewusst NICHT entfernt: ältere Clients lesen es noch.
  assert.equal(out.amount_eur, 9.99);
  assert.equal(out.product, 'premium_monthly');
  assert.ok(Array.isArray(out.coins));
});

test('Der Kurs wird gecacht, nicht bei jedem Aufruf neu geholt', async () => {
  let calls = 0;
  const counting = async () => { calls++; return okFetch(); };
  const svc = service(createFxRates({ fetchImpl: counting }));
  await svc.cryptoOptions('premium_monthly', { currency: 'CHF' });
  await svc.cryptoOptions('premium_monthly', { currency: 'AOA' });
  await svc.cryptoOptions('premium_monthly', { currency: 'USD' });
  assert.equal(calls, 1, `FX-API ${calls}× aufgerufen statt einmal`);
});
