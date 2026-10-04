// ============================================================================
//  FIAT-Zahlungen: PayPal direkt, Klarna, Spiegel nach PostgreSQL
// ============================================================================
//  Diese Datei prueft vor allem die eine Stelle, an der PayPal-Anbindungen
//  ueblicherweise Geld verlieren oder verschenken:
//
//    · GESCHENKT: `CHECKOUT.ORDER.APPROVED` als „bezahlt" zu lesen. Genehmigt
//      heisst, die Kundin HAT ERLAUBT, dass belastet wird — das Geld bewegt
//      sich erst beim Einzug. Wer hier freischaltet, gibt Premium gratis ab.
//    · ERSCHLICHEN: den Webhook ungeprueft zu verarbeiten. PayPal signiert
//      nicht mit gemeinsamem Geheimnis wie Stripe; die Echtheit muss per
//      Rueckfrage bestaetigt werden. Ohne sie genuegt die Kenntnis der
//      Adresse, um sich selbst freizuschalten.
//
//  Beide Faelle stehen unten als Test, der bei falschem Verhalten FEHLSCHLAEGT
//  — nicht als Kommentar, der um gutes Verhalten bittet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import {
  createPaymentsService, buildPaymentProvidersFromEnv,
  createPayPalAdapter, createStripeAdapter,
} from '../src/services/payments.js';
import { paymentMethodsFor, KLARNA_COUNTRIES, COMPLIANCE_PROFILES } from '../src/domain/compliance.js';
import { toPaymentMethod, toPaymentProvider, toPaymentStatus } from '../src/repo/prismaStore.js';

const KOPF_OK = {
  'paypal-transmission-id': 'tid',
  'paypal-transmission-time': '2026-10-04T12:00:00Z',
  'paypal-transmission-sig': 'sig',
  'paypal-cert-url': 'https://api.paypal.com/cert',
  'paypal-auth-algo': 'SHA256withRSA',
};

/**
 * PayPal-Adapter mit gefaelschten Netzantworten.
 * `verify` steuert, was die Signaturpruefung sagt; `capture` den Einzug.
 */
function paypal({ verify = 'SUCCESS', capture = null, captureOk = true, aufrufe = [] } = {}) {
  const fetchImpl = async (url, opts) => {
    aufrufe.push(url);
    if (url.endsWith('/v1/oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) };
    }
    if (url.endsWith('/verify-webhook-signature')) {
      return { ok: true, status: 200, json: async () => ({ verification_status: verify }) };
    }
    if (url.includes('/capture')) {
      return { ok: captureOk, status: captureOk ? 201 : 422, json: async () => capture };
    }
    if (url.endsWith('/v2/checkout/orders')) {
      return {
        ok: true, status: 201,
        json: async () => ({ id: 'ORDER1', links: [{ rel: 'payer-action', href: 'https://paypal.test/approve' }] }),
      };
    }
    throw new Error('unerwarteter Aufruf: ' + url);
  };
  return createPayPalAdapter({
    clientId: 'cid', clientSecret: 'secret', webhookId: 'whid', live: false, fetchImpl,
  });
}

function setup(providers, { mirror = null } = {}) {
  const repo = createMemoryRepo();
  const u = repo.createUser({ email: 'a@a.at', name: 'A', passwordHash: 'x' });
  const svc = createPaymentsService({ repo, providers, mirror });
  return { repo, u, svc };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Genehmigt ist nicht bezahlt
// ─────────────────────────────────────────────────────────────────────────────

test('CHECKOUT.ORDER.APPROVED meldet „approved" — ausdruecklich NICHT „paid"', async () => {
  const a = paypal();
  const evt = await a.verifyWebhook(
    JSON.stringify({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' } }),
    KOPF_OK,
  );
  assert.equal(evt.type, 'approved');
  assert.equal(evt.ref, 'ORDER1');
  // Der Kern unterscheidet die beiden Worte. Waere hier 'paid', wuerde eine
  // blosse Genehmigung freischalten — Premium ohne Zahlung.
  assert.notEqual(evt.type, 'paid');
});

test('Genehmigung loest den EINZUG aus und schaltet erst danach frei', async () => {
  const aufrufe = [];
  const a = paypal({
    aufrufe,
    capture: {
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED' }] } }],
    },
  });
  const { repo, u, svc } = setup({ paypal: a });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  assert.ok(co.redirect_url);

  assert.equal(svc.hasFeature(u.id, 'premium'), false);
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  assert.equal(res.granted, true);
  assert.equal(svc.hasFeature(u.id, 'premium'), true);
  assert.equal(repo.getPayment(co.payment_id).status, 'paid');
  // Der Einzug muss tatsaechlich gelaufen sein — nicht nur die Pruefung.
  assert.ok(aufrufe.some((u2) => u2.includes('/ORDER1/capture')), 'kein Einzug ausgeloest: ' + aufrufe.join(', '));
});

test('COUNTER-PROOF: Einzug noch in Pruefung (PENDING) schaltet NICHTS frei', async () => {
  const a = paypal({ capture: { status: 'PENDING' } });
  const { repo, u, svc } = setup({ paypal: a });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  assert.equal(res.pending, true);
  assert.equal(res.granted, undefined);
  assert.equal(svc.hasFeature(u.id, 'premium'), false);
  assert.equal(repo.getPayment(co.payment_id).status, 'pending');
});

test('ORDER_ALREADY_CAPTURED ist kein Fehler, sondern „schon bezahlt"', async () => {
  // Doppelt zugestellter Webhook: PayPal lehnt den zweiten Einzug mit 422 ab.
  // Das als Fehlschlag zu lesen hiesse, eine bezahlte Bestellung nicht
  // freizuschalten — der Kunde hat gezahlt und bekommt nichts.
  const a = paypal({ captureOk: false, capture: { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } });
  const { u, svc } = setup({ paypal: a });
  await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  assert.equal(res.granted, true);
  assert.equal(svc.hasFeature(u.id, 'premium'), true);
});

test('ein abgelehnter Einzug (HTTP-Fehler ohne Hinweis) schaltet NICHT frei', async () => {
  const a = paypal({ captureOk: false, capture: { details: [{ issue: 'INSTRUMENT_DECLINED' }] } });
  const { u, svc } = setup({ paypal: a });
  await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  assert.equal(res.pending, true);
  assert.equal(svc.hasFeature(u.id, 'premium'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Die Belastung findet die richtige Zahlung
// ─────────────────────────────────────────────────────────────────────────────

test('PAYMENT.CAPTURE.COMPLETED nutzt die BESTELL-ID, nicht die Capture-ID', async () => {
  // `resource.id` ist bei diesem Ereignis die ID der BELASTUNG. Sie als
  // Referenz zu nehmen (der naheliegende Fehler) trifft keine Zahlung — jede
  // Belastung liefe als „unmatched" ins Leere.
  const a = paypal();
  const evt = await a.verifyWebhook(JSON.stringify({
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAPTURE_XYZ',
      custom_id: 'pay_42',
      supplementary_data: { related_ids: { order_id: 'ORDER1' } },
    },
  }), KOPF_OK);
  assert.deepEqual(evt, { type: 'paid', ref: 'ORDER1', paymentId: 'pay_42' });
  assert.notEqual(evt.ref, 'CAPTURE_XYZ');
});

test('ohne supplementary_data greift unsere eigene Zahlungs-ID aus custom_id', async () => {
  const a = paypal();
  const { repo, u, svc } = setup({ paypal: a });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  // Referenz loeschen, damit NUR der custom_id-Weg bleibt.
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'CAPTURE_XYZ', custom_id: co.payment_id },
  }), KOPF_OK);
  assert.equal(res.granted, true);
  assert.equal(repo.getPayment(co.payment_id).status, 'paid');
});

test('eine fremde Zahlungs-ID trifft keine Zahlung eines anderen Anbieters', async () => {
  // Der custom_id-Weg umgeht die Anbieter-Referenz. Ohne Anbieter-Pruefung
  // koennte ein PayPal-Ereignis eine Krypto-Zahlung freischalten.
  const a = paypal();
  const { repo, u, svc } = setup({ paypal: a });
  const krypto = repo.createPayment({
    userId: u.id, productId: 'premium_monthly', amountCents: 999, currency: 'EUR',
    method: 'crypto_direct', provider: 'direct', status: 'pending',
  });
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'CAPTURE_XYZ', custom_id: krypto.id },
  }), KOPF_OK);
  assert.equal(res.unmatched, true);
  assert.equal(repo.getPayment(krypto.id).status, 'pending');
  assert.equal(svc.hasFeature(u.id, 'premium'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Fail-closed: die Pruefung ist nicht optional
// ─────────────────────────────────────────────────────────────────────────────

test('fehlende PayPal-Kopfzeile = ungueltige Signatur', async () => {
  const a = paypal();
  const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} });
  for (const weg of Object.keys(KOPF_OK)) {
    const kopf = { ...KOPF_OK };
    delete kopf[weg];
    await assert.rejects(() => a.verifyWebhook(body, kopf), (e) => e.code === 'webhook_bad_signature',
      `ohne ${weg} haette die Pruefung scheitern muessen`);
  }
});

test('PayPal bestaetigt die Signatur NICHT -> wirft, schaltet nichts frei', async () => {
  const a = paypal({ verify: 'FAILURE' });
  const { u, svc } = setup({ paypal: a });
  await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  await assert.rejects(() => svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK), (e) => e.code === 'webhook_bad_signature');
  assert.equal(svc.hasFeature(u.id, 'premium'), false);
});

test('Netzfehler bei der Rueckfrage faellt GESCHLOSSEN aus', async () => {
  // Sonst genuegt es, die Pruefung zum Scheitern zu bringen, um freizuschalten.
  const a = createPayPalAdapter({
    clientId: 'cid', clientSecret: 'secret', webhookId: 'whid',
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  await assert.rejects(
    () => a.verifyWebhook(JSON.stringify({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} }), KOPF_OK),
    (e) => e.code === 'webhook_bad_signature',
  );
});

test('kaputter Body wird abgewiesen, bevor irgendetwas geprueft wird', async () => {
  const a = paypal();
  await assert.rejects(() => a.verifyWebhook('{kein json', KOPF_OK), (e) => e.code === 'webhook_bad_signature');
});

test('ohne PAYPAL_WEBHOOK_ID ist PayPal gar nicht aktiv', () => {
  const ohne = buildPaymentProvidersFromEnv({
    PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'sec',
  }, async () => ({}));
  assert.equal(ohne.paypal, undefined);
  const mit = buildPaymentProvidersFromEnv({
    PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'whid',
  }, async () => ({}));
  assert.ok(mit.paypal);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Ein Bezahlweg, ein Knopf
// ─────────────────────────────────────────────────────────────────────────────

test('„paypal" wird von der DIREKTEN Anbindung bedient, nicht von Stripe', async () => {
  const stripeAufrufe = [];
  const stripe = createStripeAdapter({
    secretKey: 'sk', webhookSecret: 'whsec',
    fetchImpl: async (url) => { stripeAufrufe.push(url); return { json: async () => ({ id: 'cs_1', url: 'https://stripe.test/cs_1' }) }; },
  });
  const { svc } = setup({ stripe, paypal: paypal() });
  const methoden = svc.configuredMethods();
  const paypalEintraege = methoden.filter((m) => m.method === 'paypal');
  // Genau EIN Eintrag: zwei PayPal-Knoepfe im Checkout waeren fuer die Kundin
  // ein offensichtlicher Fehler, obwohl technisch beide stimmen.
  assert.equal(paypalEintraege.length, 1);
  assert.equal(paypalEintraege[0].provider, 'paypal');

  const { u, svc: svc2, repo } = setup({ stripe, paypal: paypal() });
  const co = await svc2.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  assert.equal(repo.getPayment(co.payment_id).provider, 'paypal');
  // Karte laeuft weiter ueber Stripe — der Vorrang gilt nur fuer 'paypal'.
  const karte = await svc2.createCheckout(u.id, { productId: 'premium_monthly', method: 'card' });
  assert.equal(repo.getPayment(karte.payment_id).provider, 'stripe');
});

test('ohne PayPal-Zugangsdaten bedient Stripe „paypal" weiterhin', async () => {
  const stripe = createStripeAdapter({
    secretKey: 'sk', webhookSecret: 'whsec',
    fetchImpl: async () => ({ json: async () => ({ id: 'cs_1', url: 'https://stripe.test/cs_1' }) }),
  });
  const { u, svc, repo } = setup({ stripe });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  assert.equal(repo.getPayment(co.payment_id).provider, 'stripe');
});

test('Stripe bietet Klarna und die Geldboersen an', () => {
  const stripe = createStripeAdapter({ secretKey: 'sk', webhookSecret: 'whsec', fetchImpl: async () => ({ json: async () => ({}) }) });
  for (const m of ['card', 'apple_pay', 'google_pay', 'paypal', 'klarna']) {
    assert.ok(stripe.methods.includes(m), 'Stripe kennt ' + m + ' nicht');
  }
});

test('Klarna und PayPal gehen als EIGENER Stripe-Typ raus, Geldboersen als Karte', async () => {
  const koerper = [];
  const stripe = createStripeAdapter({
    secretKey: 'sk', webhookSecret: 'whsec',
    fetchImpl: async (url, opts) => { koerper.push(String(opts.body)); return { json: async () => ({ id: 'cs_1', url: 'u' }) }; },
  });
  const produkt = { name: 'Premium', amount_cents: 999, currency: 'EUR' };
  for (const [methode, erwartet] of [['card', 'card'], ['apple_pay', 'card'], ['google_pay', 'card'], ['klarna', 'klarna'], ['paypal', 'paypal']]) {
    koerper.length = 0;
    await stripe.createCheckout({ payment: { id: 'p1' }, product: produkt, method: methode });
    assert.ok(koerper[0].includes('payment_method_types%5B%5D=' + erwartet),
      `${methode} haette als ${erwartet} rausgehen muessen: ${koerper[0]}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Klarna: Laender- UND Waehrungsbedingung
// ─────────────────────────────────────────────────────────────────────────────

test('Klarna steht nur in den EUR-Profilen — und dort, wo es hinterlegt ist', () => {
  for (const land of Object.keys(COMPLIANCE_PROFILES)) {
    const ids = paymentMethodsFor(land, 'saas_license').map((m) => m.id);
    const erwartet = KLARNA_COUNTRIES.includes(land);
    assert.equal(ids.includes('klarna'), erwartet, `${land}: Klarna ${erwartet ? 'fehlt' : 'steht zu Unrecht da'}`);
  }
});

test('jedes Klarna-Land rechnet in EUR ab — sonst bricht der Checkout', () => {
  // Klarna weist in der Waehrung des Kaeuferlandes aus; unsere Preise stehen
  // in EUR. Ein Klarna-Knopf in einem CHF-/GBP-Profil fuehrte zu einer
  // Waehrungs-Fehlermeldung bei Stripe. Diese Zusicherung macht die
  // Begruendung aus KLARNA_COUNTRIES pruefbar.
  for (const land of KLARNA_COUNTRIES) {
    assert.equal(COMPLIANCE_PROFILES[land].currency, 'EUR', `${land} rechnet nicht in EUR`);
  }
});

test('Klarna gibt es NICHT fuer Warenbestellungen', () => {
  // Fuer Arzneimittel eine Ratenzahlung anzubieten waere eine
  // Finanzierungszusage, die diese Plattform nicht gibt.
  for (const land of Object.keys(COMPLIANCE_PROFILES)) {
    if (!COMPLIANCE_PROFILES[land].transactionFeeAllowed) continue;
    const ids = paymentMethodsFor(land, 'marketplace_order').map((m) => m.id);
    assert.equal(ids.includes('klarna'), false, `${land}: Klarna bei Warenbestellung`);
  }
});

test('Klarna verdraengt Krypto in keinem Land', () => {
  for (const land of Object.keys(COMPLIANCE_PROFILES)) {
    const krypto = paymentMethodsFor(land, 'saas_license').filter((m) => m.rail === 'crypto');
    assert.ok(krypto.length > 0, land + ' ohne Krypto');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Spiegel nach PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────

test('Zuordnung Anwendungswerte -> Schema-Enums; Unbekanntes wird NICHT geraten', () => {
  assert.equal(toPaymentMethod('crypto_direct'), 'CRYPTO_DIRECT');
  assert.equal(toPaymentMethod('apple_pay'), 'APPLE_PAY');
  assert.equal(toPaymentMethod('klarna'), 'KLARNA');
  assert.equal(toPaymentProvider('direct'), 'DIRECT');
  assert.equal(toPaymentStatus('pending_review'), 'PENDING_REVIEW');
  // Der entscheidende Teil: ein neuer Bezahlweg darf nicht still als „CARD"
  // verbucht werden.
  assert.equal(toPaymentMethod('ideal'), null);
  assert.equal(toPaymentProvider('adyen'), null);
  assert.equal(toPaymentStatus('halb'), null);
});

test('jede Zustandsaenderung einer Zahlung wird gespiegelt', async () => {
  const gespiegelt = [];
  const mirror = { saveTransaction: async (p) => { gespiegelt.push({ id: p.id, status: p.status, method: p.method }); } };
  const { u, svc } = setup({ paypal: paypal({ capture: { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED' }] } }] } }) }, { mirror });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  const fuerDiese = gespiegelt.filter((g) => g.id === co.payment_id);
  assert.deepEqual(fuerDiese.map((g) => g.status), ['pending', 'paid']);
  assert.equal(fuerDiese[1].method, 'paypal');
});

test('ein kaputter Spiegel haelt keine Zahlung auf', async () => {
  // Die Apotheke hat bezahlt. Dass die Datenbank gerade neu startet, darf
  // daran nichts aendern — es fehlt dann die Buchungszeile, nicht die
  // Leistung.
  const mirror = { saveTransaction: async () => { throw new Error('P1001 DB weg'); } };
  const { u, svc } = setup({ paypal: paypal({ capture: { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'C', status: 'COMPLETED' }] } }] } }) }, { mirror });
  await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  const res = await svc.handleWebhook('paypal', JSON.stringify({
    event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER1' },
  }), KOPF_OK);
  assert.equal(res.granted, true);
  assert.equal(svc.hasFeature(u.id, 'premium'), true);
});

test('ein synchron werfender Spiegel ebenso', async () => {
  const mirror = { saveTransaction: () => { throw new Error('kaputt'); } };
  const { u, svc } = setup({ paypal: paypal() }, { mirror });
  const co = await svc.createCheckout(u.id, { productId: 'premium_monthly', method: 'paypal' });
  assert.ok(co.payment_id);
});
