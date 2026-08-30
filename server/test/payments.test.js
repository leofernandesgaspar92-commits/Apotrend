import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService, buildPaymentProvidersFromEnv, createStripeAdapter, createCoinbaseAdapter } from '../src/services/payments.js';
import { cryptoWallets, walletUri } from '../src/data/cryptoWallets.js';
import { paymentMethodsFor, COMPLIANCE_PROFILES, PURPOSES, PAYPAL_COUNTRIES } from '../src/domain/compliance.js';
import { createCryptoRates } from '../src/services/cryptoRates.js';

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

test('cryptoWallets: BTC + ETH + zwei SOL-Wallets (Seeker/Phantom); walletUri baut korrekte Schemata', () => {
  const list = cryptoWallets({});
  const byId = Object.fromEntries(list.map(w => [w.id, w]));
  assert.equal(byId.btc.address, 'bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46');
  assert.ok(byId.eth.address.startsWith('0x5f5099'));
  // beide Solana-Wallets vorbelegt (beide gehören dem Betreiber)
  assert.equal(byId.sol_seeker.address, 'Egbc7cfzHLj5dkgnR4E7Xk3MfDNrA5imqKJ1FV1n1DW');
  assert.equal(byId.sol_phantom.address, 'EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqcEpamWFM');
  assert.match(byId.sol_seeker.label, /Seeker/);
  assert.equal(byId.sol_phantom.coin, 'solana');
  // ENV überschreibt
  assert.equal(cryptoWallets({ APOPULSE_WALLET_SOL_PHANTOM: 'NEU' }).find(w => w.id === 'sol_phantom').address, 'NEU');
  assert.equal(walletUri(byId.btc, 0.0003), 'bitcoin:bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46?amount=0.0003');
  assert.match(walletUri(byId.eth, 0.01), /^ethereum:0x5f5099.*@1\?value=\d+$/);
  assert.equal(walletUri(byId.sol_phantom, 1.5), 'solana:EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqcEpamWFM?amount=1.5');
});

test('cryptoRates: cached, fetch injizierbar, Fallback bei Fehler', async () => {
  let calls = 0; let clock = 0;
  const fetchOk = async () => { calls++; return { json: async () => ({ bitcoin: { eur: 50000 }, ethereum: { eur: 3000 } }) }; };
  const rates = createCryptoRates({ fetchImpl: fetchOk, ttlMs: 1000, now: () => clock });
  assert.deepEqual(await rates.ratesEur(['bitcoin', 'ethereum']), { bitcoin: 50000, ethereum: 3000 });
  await rates.ratesEur(['bitcoin', 'ethereum']); // innerhalb TTL -> Cache, kein zweiter Fetch
  assert.equal(calls, 1);
  clock = 2000; // TTL abgelaufen
  await rates.ratesEur(['bitcoin', 'ethereum']);
  assert.equal(calls, 2);
  // Fehler -> letzter Stand bleibt
  const rates2 = createCryptoRates({ fetchImpl: async () => { throw new Error('net'); } });
  assert.deepEqual(await rates2.ratesEur(['bitcoin']), {});
});

test('cryptoOptions: alle Wallets (inkl. 2× SOL) mit Adresse + Betrag + Wallet-URI', async () => {
  const repo = createMemoryRepo();
  const rates = { ratesEur: async () => ({ bitcoin: 50000, ethereum: 2000, solana: 100 }) };
  const svc = createPaymentsService({ repo, wallets: () => cryptoWallets({}), rates });
  const opt = await svc.cryptoOptions('premium_monthly'); // 9,99 €
  assert.equal(opt.coins.length, 4, 'BTC + ETH + 2× SOL');
  const btc = opt.coins.find(c => c.id === 'btc');
  assert.equal(btc.amount_eur, 9.99);
  assert.ok(Math.abs(btc.amount_crypto - 9.99 / 50000) < 1e-9);
  assert.ok(btc.uri.startsWith('bitcoin:bc1q'));
  assert.equal(opt.coins.filter(c => c.coin === 'solana').length, 2);
  await assert.rejects(() => svc.cryptoOptions('gibtsnicht'), e => e.code === 'product_unknown');
});

test('Direkt-Krypto: start → claim(Tx) → Moderation bestätigt → Premium frei', async () => {
  const repo = createMemoryRepo();
  const cust = repo.createUser({ email: 'c@c.at', name: 'C', passwordHash: 'x' });
  const mod = repo.createUser({ email: 'm@m.at', name: 'M', passwordHash: 'x' });
  const svc = createPaymentsService({ repo, wallets: () => cryptoWallets({}), isModerator: (id) => id === mod.id });
  const start = svc.startCryptoPayment(cust.id, 'premium_monthly', 'sol_phantom');
  assert.equal(start.address, 'EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqcEpamWFM');
  assert.equal(start.coin, 'solana');
  assert.equal(repo.getPayment(start.payment_id).status, 'pending');
  assert.equal(repo.getPayment(start.payment_id).wallet_id, 'sol_phantom', 'Wallet am Datensatz für die Zuordnung');
  // unbekannte Wallet
  assert.throws(() => svc.startCryptoPayment(cust.id, 'premium_monthly', 'dogecoin'), e => e.code === 'coin_unavailable');
  // Tx-ID einreichen
  assert.throws(() => svc.claimCryptoPayment(cust.id, start.payment_id, 'x'), e => e.code === 'tx_ref_missing');
  svc.claimCryptoPayment(cust.id, start.payment_id, 'abcdef123456txhash');
  assert.equal(repo.getPayment(start.payment_id).status, 'pending_review');
  assert.equal(svc.listPendingReview(mod.id).length, 1);
  // fremder Nutzer kann nicht claimen
  assert.throws(() => svc.claimCryptoPayment(cust.id + 'x', start.payment_id, 'abcdef123456'), e => e.code === 'payment_not_found');
  // Nicht-Moderator darf nicht bestätigen
  await assert.rejects(() => svc.confirmPayment(cust.id, start.payment_id), e => e.code === 'forbidden');
  // Moderation bestätigt -> Premium frei, idempotent
  assert.equal(svc.hasFeature(cust.id, 'premium'), false);
  const r = await svc.confirmPayment(mod.id, start.payment_id);
  assert.deepEqual(r, { ok: true, granted: true });
  assert.equal(svc.hasFeature(cust.id, 'premium'), true);
  assert.equal(repo.getPayment(start.payment_id).status, 'paid');
  assert.deepEqual(await svc.confirmPayment(mod.id, start.payment_id), { ok: true, already: true });
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

// ── PayPal, Karte und Geldbörsen (vom Owner verlangt) ────────────────────────

test('PayPal und die Geldbörsen stehen neben der Karte zur Wahl', () => {
  const ids = paymentMethodsFor('AT', 'saas_license').map((m) => m.id);
  for (const weg of ['card', 'paypal', 'apple_pay', 'google_pay']) {
    assert.ok(ids.includes(weg), `${weg} fehlt in AT`);
  }
});

test('die Reihenfolge stellt die Kartenwege zusammen, nicht hinter die Rechnung', () => {
  // Apple Pay hinter „Rechnung (30 Tage)" sucht niemand.
  const ids = paymentMethodsFor('AT', 'saas_license').filter((m) => m.rail === 'fiat').map((m) => m.id);
  const nach = (id) => ids.indexOf(id);
  assert.ok(nach('paypal') === nach('card') + 1, `PayPal steht nicht direkt hinter der Karte: ${ids}`);
  assert.ok(nach('apple_pay') < nach('invoice'), `Apple Pay steht hinter der Rechnung: ${ids}`);
  assert.ok(nach('google_pay') < nach('invoice'), `Google Pay steht hinter der Rechnung: ${ids}`);
});

test('Geldbörsen gibt es überall dort, wo es Karte gibt — und nur dort', () => {
  // Abgeleitet statt in siebzehn Profilen gepflegt: Zwei Listen parallel zu
  // führen endet damit, dass ein Land Karte anbietet und Google Pay nicht,
  // ohne dass es dafür einen Grund gäbe.
  for (const cc of Object.keys(COMPLIANCE_PROFILES)) {
    const ids = paymentMethodsFor(cc, 'saas_license').map((m) => m.id);
    const hatKarte = ids.includes('card');
    assert.equal(ids.includes('apple_pay'), hatKarte, `Apple Pay passt nicht zur Karte in ${cc}`);
    assert.equal(ids.includes('google_pay'), hatKarte, `Google Pay passt nicht zur Karte in ${cc}`);
  }
});

test('Geldbörsen sind als Kartenzahlung gekennzeichnet, nicht als eigene Schiene', () => {
  // Sonst zählt jemand später drei Kartenwege, wo es einer mit drei
  // Bedienoberflächen ist — und rechnet die Acquirer-Gebühr dreifach.
  const byId = Object.fromEntries(paymentMethodsFor('AT', 'saas_license').map((m) => [m.id, m]));
  assert.equal(byId.apple_pay.via, 'card');
  assert.equal(byId.google_pay.via, 'card');
  assert.equal(byId.apple_pay.rail, 'fiat');
  // PayPal ist dagegen eine echte eigene Schiene.
  assert.equal(byId.paypal.via, undefined);
  assert.equal(byId.paypal.provider, 'paypal');
});

test('PayPal erscheint nur in den hinterlegten Ländern', () => {
  assert.ok(paymentMethodsFor('DE', 'saas_license').some((m) => m.id === 'paypal'));
  // KE fehlt in PAYPAL_COUNTRIES — nicht weil PayPal dort ausgeschlossen wäre,
  // sondern weil es nicht belegt ist. Lieber ein Weg zu wenig als ein Knopf,
  // der im Checkout ins Leere führt.
  assert.ok(!paymentMethodsFor('KE', 'saas_license').some((m) => m.id === 'paypal'));
  for (const cc of PAYPAL_COUNTRIES) {
    if (cc === 'EU') continue; // Sammelprofil, nicht über den Ländercode erreichbar
    assert.ok(paymentMethodsFor(cc, 'saas_license').some((m) => m.id === 'paypal'), `PayPal fehlt in ${cc}`);
  }
});

test('die neuen Bezahlwege verdrängen Krypto in KEINEM Land und KEINEM Zweck', () => {
  // Das ist die stehende Zusage des Owners. Sie wird hier über die volle
  // Kreuzmenge geprüft, nicht an einem Beispiel.
  let geprueft = 0;
  for (const cc of Object.keys(COMPLIANCE_PROFILES)) {
    for (const zweck of PURPOSES) {
      let methods;
      try { methods = paymentMethodsFor(cc, zweck); }
      catch (e) { continue; } // Zweck im Land nicht freigeschaltet
      const krypto = methods.filter((m) => m.rail === 'crypto');
      assert.equal(krypto.length, 6, `${cc}/${zweck}: nur ${krypto.length} Krypto-Wege`);
      geprueft++;
    }
  }
  assert.ok(geprueft >= 17, `nur ${geprueft} Kombinationen geprüft`);
});
