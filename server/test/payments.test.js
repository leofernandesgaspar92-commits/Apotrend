import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService, buildPaymentProvidersFromEnv, createStripeAdapter, createCoinbaseAdapter } from '../src/services/payments.js';

function fakeProvider() {
  return {
    name: 'fake', methods: ['card', 'crypto'],
    async createCheckout({ payment, product }) { return { url: 'https://pay.test/' + payment.id, ref: 'ref_' + payment.id }; },
    verifyWebhook(raw, headers) {
      if (headers['x-test-sig'] !== 'ok') { const e = new Error('Signatur ungültig.'); e.code = 'webhook_bad_signature'; e.status = 400; throw e; }
      const j = JSON.parse(raw); return j.paid ? { type: 'paid', ref: j.ref } : { type: 'other' };
    },
  };
}

function setup(providers) {
  const repo = createMemoryRepo();
  const u = repo.createUser({ email: 'a@a.at', name: 'A', passwordHash: 'x' });
  let paidCalls = [];
  const svc = createPaymentsService({ repo, providers, onPaid: (x) => { paidCalls.push(x); } });
  return { repo, u, svc, paidCalls: () => paidCalls };
}

test('Entitlements: grant/has/list + Konto-Löschung entfernt sie', () => {
  const repo = createMemoryRepo();
  const u = repo.createUser({ email: 'e@e.at', name: 'E', passwordHash: 'x' });
  assert.equal(repo.hasEntitlement(u.id, 'premium'), false);
  repo.grantEntitlement(u.id, 'premium');
  assert.equal(repo.hasEntitlement(u.id, 'premium'), true);
  assert.deepEqual(repo.listEntitlements(u.id), ['premium']);
  repo.deleteUser(u.id);
  assert.equal(repo.hasEntitlement(u.id, 'premium'), false);
});

test('configuredMethods leer ohne Anbieter; isConfigured false', () => {
  const { svc } = setup({});
  assert.deepEqual(svc.configuredMethods(), []);
  assert.equal(svc.isConfigured(), false);
});

test('createCheckout: legt pending-Zahlung an + liefert Redirect-URL, merkt provider_ref', async () => {
  const { repo, u, svc } = setup({ fake: fakeProvider() });
  assert.equal(svc.isConfigured(), true);
  const r = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'card' });
  assert.ok(r.redirect_url.includes(r.payment_id));
  const pay = repo.getPayment(r.payment_id);
  assert.equal(pay.status, 'pending');
  assert.equal(pay.amount_cents, 999);
  assert.equal(pay.provider, 'fake');
  assert.equal(repo.getPaymentByRef('fake', 'ref_' + r.payment_id).id, r.payment_id);
});

test('createCheckout: unbekanntes Produkt / nicht verfügbare Methode werfen klare Codes', async () => {
  const { u, svc } = setup({ fake: fakeProvider() });
  await assert.rejects(() => svc.createCheckout(u.id, { productId: 'gibtsnicht', method: 'card' }), e => e.code === 'product_unknown');
  await assert.rejects(() => svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'sepa' }), e => e.code === 'method_unavailable');
});

test('Webhook „paid" schaltet frei — und ist idempotent; ohne Zahlung freigeschaltet wird nichts', async () => {
  const { repo, u, svc, paidCalls } = setup({ fake: fakeProvider() });
  const r = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'card' });
  const ref = 'ref_' + r.payment_id;
  // vor der Zahlung: kein Premium
  assert.equal(svc.hasFeature(u.id, 'premium'), false);
  const res = await svc.handleWebhook('fake', JSON.stringify({ paid: true, ref }), { 'x-test-sig': 'ok' });
  assert.deepEqual(res, { ok: true, granted: true });
  assert.equal(svc.hasFeature(u.id, 'premium'), true);
  assert.equal(repo.getPayment(r.payment_id).status, 'paid');
  assert.equal(paidCalls().length, 1);
  // zweiter (Doppel-)Webhook ändert nichts
  const again = await svc.handleWebhook('fake', JSON.stringify({ paid: true, ref }), { 'x-test-sig': 'ok' });
  assert.deepEqual(again, { ok: true, already: true });
  assert.equal(paidCalls().length, 1, 'keine zweite Freischaltung/Mail');
});

test('Webhook: ungültige Signatur wirft; unbekannte Referenz wird ignoriert', async () => {
  const { u, svc } = setup({ fake: fakeProvider() });
  await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'card' });
  await assert.rejects(() => svc.handleWebhook('fake', JSON.stringify({ paid: true, ref: 'x' }), { 'x-test-sig': 'nope' }), e => e.code === 'webhook_bad_signature');
  const unmatched = await svc.handleWebhook('fake', JSON.stringify({ paid: true, ref: 'unbekannt' }), { 'x-test-sig': 'ok' });
  assert.deepEqual(unmatched, { ok: true, unmatched: true });
});

test('buildPaymentProvidersFromEnv: nur mit vollständigen Schlüsseln aktiv', () => {
  assert.deepEqual(Object.keys(buildPaymentProvidersFromEnv({})), []);
  const p = buildPaymentProvidersFromEnv({
    STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'whsec',
    COINBASE_COMMERCE_API_KEY: 'cc', COINBASE_COMMERCE_WEBHOOK_SECRET: 'ccsec',
  }, async () => ({}));
  assert.deepEqual(Object.keys(p).sort(), ['coinbase', 'stripe']);
});

test('Stripe-Adapter: Checkout (fetch gemockt) + korrekt signierter Webhook = paid', async () => {
  const calls = [];
  const fetchMock = async (url, opts) => { calls.push(url); return { json: async () => ({ id: 'cs_123', url: 'https://checkout.stripe/cs_123' }) }; };
  const a = createStripeAdapter({ secretKey: 'sk', webhookSecret: 'whsec', fetchImpl: fetchMock });
  const co = await a.createCheckout({ payment: { id: 'p1' }, product: { name: 'Premium', amount_cents: 999, currency: 'EUR' }, method: 'card' });
  assert.deepEqual(co, { url: 'https://checkout.stripe/cs_123', ref: 'cs_123' });
  assert.ok(calls[0].includes('checkout/sessions'));
  // Webhook korrekt signieren
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_123', payment_status: 'paid' } } });
  const t = '1700000000';
  const v1 = crypto.createHmac('sha256', 'whsec').update(`${t}.${payload}`).digest('hex');
  const evt = a.verifyWebhook(payload, { 'stripe-signature': `t=${t},v1=${v1}` });
  assert.deepEqual(evt, { type: 'paid', ref: 'cs_123' });
  // falsche Signatur wirft
  assert.throws(() => a.verifyWebhook(payload, { 'stripe-signature': `t=${t},v1=deadbeef` }), e => e.code === 'webhook_bad_signature');
});

test('Coinbase-Adapter: Charge (fetch gemockt) + korrekt signierter Webhook = paid', async () => {
  const fetchMock = async () => ({ json: async () => ({ data: { code: 'CH123', hosted_url: 'https://commerce.coinbase/CH123' } }) });
  const a = createCoinbaseAdapter({ apiKey: 'k', webhookSecret: 'ccsec', fetchImpl: fetchMock });
  const co = await a.createCheckout({ payment: { id: 'p1' }, product: { name: 'Premium', amount_cents: 999, currency: 'EUR' } });
  assert.deepEqual(co, { url: 'https://commerce.coinbase/CH123', ref: 'CH123' });
  const payload = JSON.stringify({ event: { type: 'charge:confirmed', data: { code: 'CH123' } } });
  const sig = crypto.createHmac('sha256', 'ccsec').update(payload).digest('hex');
  assert.deepEqual(a.verifyWebhook(payload, { 'x-cc-webhook-signature': sig }), { type: 'paid', ref: 'CH123' });
  assert.throws(() => a.verifyWebhook(payload, { 'x-cc-webhook-signature': 'wrong' }), e => e.code === 'webhook_bad_signature');
});
