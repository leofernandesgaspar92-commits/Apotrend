// Zahlungen — provider-AGNOSTISCHER Kern (wie beim Social-Login). Grundsätze:
//  • NIE Karten- oder Wallet-Rohdaten im Code/DB — alles läuft über LIZENZIERTE,
//    gehostete Anbieter (Stripe = Karte/Wallet/PayPal, Coinbase Commerce = Krypto).
//  • Rohe Wallet-Adressen werden NICHT eingebettet; der Krypto-Prozessor nimmt
//    entgegen, rechnet EUR live um, zählt Bestätigungen und zahlt an das dort
//    verifizierte Konto aus (Direkt-in-eigene-Wallet = separates BTCPay Server).
//  • Provider sind NUR aktiv, wenn eigene, verifizierte Schlüssel als ENV-Variablen
//    vorliegen (der KYC-Schritt bei den Anbietern ist die Sicherheitshürde).
//  • Freischaltung erfolgt ausschließlich über signierte Webhooks (kein „Client sagt bezahlt").
import crypto from 'node:crypto';
import { getProduct } from '../data/products.js';
import { walletUri } from '../data/cryptoWallets.js';
import { AppError } from '../domain/errors.js';

export function createPaymentsService({ repo, providers = {}, onPaid = null, wallets = () => ({}), rates = null, isModerator = () => false }) {
  const pick = (method) => Object.values(providers).find(p => (p.methods || []).includes(method)) || null;
  return {
    // ── Direkt-in-Wallet Krypto (deine eigenen Adressen). BEWUSST OHNE automatische
    //    Chain-Verifizierung: statische Adressen erlauben keine zuverlässige Zuordnung
    //    „welche:r Kund:in hat gezahlt". Ablauf: anzeigen → Kund:in nennt Tx-ID → du
    //    bestätigst manuell (confirmPayment). Ehrlich statt Fake-Auto-Freischaltung. ──
    async cryptoOptions(productId) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const ws = wallets();
      const eur = product.amount_cents / 100;
      const rateMap = rates ? await rates.ratesEur(Object.values(ws).map(w => w.coin)) : {};
      const coins = Object.values(ws).map(w => {
        const rate = rateMap[w.coin]; // EUR pro 1 Coin
        const amount = rate ? Number((eur / rate).toFixed(8)) : null;
        return { coin: w.coin, symbol: w.symbol, address: w.address, network: w.network, amount_eur: eur, amount_crypto: amount, uri: walletUri(w, amount) };
      });
      return { product: product.id, product_name: product.name, amount_eur: eur, coins };
    },
    // Kund:in wählt einen Coin -> pending-Datensatz (zur späteren manuellen Zuordnung).
    startCryptoPayment(userId, productId, coin) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const w = wallets()[coin];
      if (!w) throw new AppError('coin_unavailable', 'Kryptowährung nicht verfügbar.');
      const payment = repo.createPayment({ userId, productId, amountCents: product.amount_cents, currency: product.currency, method: 'crypto_direct', provider: 'direct', status: 'pending' });
      return { payment_id: payment.id, coin: w.coin, address: w.address, network: w.network };
    },
    // Kund:in reicht die Transaktions-ID ein -> „pending_review" (du prüfst in deiner Wallet).
    claimCryptoPayment(userId, paymentId, txRef) {
      const p = repo.getPayment(paymentId);
      if (!p || p.user_id !== userId) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      const ref = String(txRef || '').trim();
      if (ref.length < 6) throw new AppError('tx_ref_missing', 'Bitte die Transaktions-ID angeben.');
      repo.setPaymentRef(paymentId, ref);
      repo.setPaymentStatus(paymentId, 'pending_review');
      return { ok: true };
    },
    // Betreiber/Moderation bestätigt manuell (nach Blick in die Wallet) -> Feature frei.
    async confirmPayment(moderatorUserId, paymentId) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      const p = repo.getPayment(paymentId);
      if (!p) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      if (p.status === 'paid') return { ok: true, already: true };
      repo.setPaymentStatus(paymentId, 'paid');
      const product = getProduct(p.product_id);
      if (product) { repo.grantEntitlement(p.user_id, product.feature); if (onPaid) { try { await onPaid({ payment: p, product }); } catch { /* Mail darf nicht blockieren */ } } }
      return { ok: true, granted: !!product };
    },
    listPendingReview(moderatorUserId) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      return repo.listAllPayments().filter(p => p.status === 'pending_review');
    },

    // Verfügbare Methoden (leer, solange kein Anbieter konfiguriert ist).
    configuredMethods() {
      const out = [];
      for (const p of Object.values(providers)) for (const m of (p.methods || [])) out.push({ method: m, provider: p.name });
      return out;
    },
    isConfigured() { return Object.keys(providers).length > 0; },

    // Gehosteten Checkout beim Anbieter anlegen; lokal einen „pending"-Datensatz führen.
    async createCheckout(userId, { productId, method, successUrl, cancelUrl }) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const provider = pick(method);
      if (!provider) throw new AppError('method_unavailable', 'Zahlungsmethode nicht verfügbar.');
      const payment = repo.createPayment({ userId, productId, amountCents: product.amount_cents, currency: product.currency, method, provider: provider.name, status: 'pending' });
      const checkout = await provider.createCheckout({ payment, product, method, successUrl, cancelUrl });
      if (checkout && checkout.ref) repo.setPaymentRef(payment.id, checkout.ref);
      return { payment_id: payment.id, redirect_url: checkout && checkout.url };
    },

    // Webhook: roher Body + Header -> Anbieter verifiziert Signatur -> bei „paid"
    // Feature freischalten. Idempotent (Doppel-Webhooks ändern nichts).
    async handleWebhook(providerName, rawBody, headers) {
      const provider = providers[providerName];
      if (!provider) throw new AppError('provider_unknown', 'Unbekannter Anbieter.');
      const evt = provider.verifyWebhook(rawBody, headers); // wirft bei ungültiger Signatur
      if (!evt || evt.type !== 'paid' || !evt.ref) return { ok: true, ignored: true };
      const payment = repo.getPaymentByRef(providerName, evt.ref);
      if (!payment) return { ok: true, unmatched: true };
      if (payment.status === 'paid') return { ok: true, already: true };
      repo.setPaymentStatus(payment.id, 'paid');
      const product = getProduct(payment.product_id);
      if (product) { repo.grantEntitlement(payment.user_id, product.feature); if (onPaid) { try { await onPaid({ payment, product }); } catch { /* Mailversand darf die Freischaltung nicht blockieren */ } } }
      return { ok: true, granted: !!product };
    },

    hasFeature(userId, feature) { return repo.hasEntitlement(userId, feature); },
    myEntitlements(userId) { return repo.listEntitlements(userId); },
  };
}

// Konstante-Zeit-Vergleich zweier Hex-Signaturen.
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8'); const bb = Buffer.from(String(b || ''), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ── Provider-Registry aus ENV. Nur Anbieter mit vollständigen Schlüsseln sind aktiv. ──
export function buildPaymentProvidersFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const providers = {};
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    providers.stripe = createStripeAdapter({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET, fetchImpl });
  }
  if (env.COINBASE_COMMERCE_API_KEY && env.COINBASE_COMMERCE_WEBHOOK_SECRET) {
    providers.coinbase = createCoinbaseAdapter({ apiKey: env.COINBASE_COMMERCE_API_KEY, webhookSecret: env.COINBASE_COMMERCE_WEBHOOK_SECRET, fetchImpl });
  }
  return providers;
}

// Stripe (Fiat): gehosteter Checkout. Apple/Google Pay laufen automatisch über „card".
export function createStripeAdapter({ secretKey, webhookSecret, fetchImpl = globalThis.fetch }) {
  return {
    name: 'stripe',
    methods: ['card', 'paypal'],
    async createCheckout({ payment, product, method, successUrl, cancelUrl }) {
      const body = new URLSearchParams();
      body.set('mode', 'payment');
      body.set('success_url', successUrl || 'https://apotrend.example/premium?ok=1');
      body.set('cancel_url', cancelUrl || 'https://apotrend.example/premium?cancel=1');
      body.set('client_reference_id', payment.id);
      body.append('payment_method_types[]', method === 'paypal' ? 'paypal' : 'card');
      body.append('line_items[0][price_data][currency]', (product.currency || 'eur').toLowerCase());
      body.append('line_items[0][price_data][product_data][name]', product.name);
      body.append('line_items[0][price_data][unit_amount]', String(product.amount_cents));
      body.append('line_items[0][quantity]', '1');
      const r = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST', headers: { authorization: 'Bearer ' + secretKey, 'content-type': 'application/x-www-form-urlencoded' }, body,
      });
      const s = await r.json();
      if (!s || !s.id) return null;
      return { url: s.url, ref: s.id };
    },
    // Stripe-Signatur: Header „Stripe-Signature: t=…,v1=…"; HMAC-SHA256 über „t.payload".
    verifyWebhook(rawBody, headers) {
      const sig = String(headers['stripe-signature'] || '');
      const t = (sig.match(/t=([^,]+)/) || [])[1];
      const v1 = (sig.match(/v1=([^,]+)/) || [])[1];
      if (!t || !v1) { const e = new Error('Signatur fehlt.'); e.code = 'webhook_bad_signature'; e.status = 400; throw e; }
      const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody}`).digest('hex');
      if (!safeEqualHex(expected, v1)) { const e = new Error('Signatur ungültig.'); e.code = 'webhook_bad_signature'; e.status = 400; throw e; }
      const evt = JSON.parse(rawBody);
      if (evt.type === 'checkout.session.completed' && evt.data?.object?.payment_status === 'paid') {
        return { type: 'paid', ref: evt.data.object.id };
      }
      return { type: 'other' };
    },
  };
}

// Coinbase Commerce (Krypto): gehosteter Charge. EUR-Preis rein — der Prozessor rechnet
// live in die Kryptowährung um und zählt Netzwerk-Bestätigungen. Keine rohen Wallets im Code.
export function createCoinbaseAdapter({ apiKey, webhookSecret, fetchImpl = globalThis.fetch }) {
  return {
    name: 'coinbase',
    methods: ['crypto'],
    async createCheckout({ payment, product }) {
      const r = await fetchImpl('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-CC-Api-Key': apiKey, 'X-CC-Version': '2018-03-22' },
        body: JSON.stringify({
          name: product.name, description: 'ApoTrend Premium',
          pricing_type: 'fixed_price',
          local_price: { amount: (product.amount_cents / 100).toFixed(2), currency: product.currency || 'EUR' },
          metadata: { payment_id: payment.id },
        }),
      });
      const j = await r.json();
      const charge = j && j.data;
      if (!charge || !charge.code) return null;
      return { url: charge.hosted_url, ref: charge.code };
    },
    // Coinbase-Signatur: Header „X-CC-Webhook-Signature" = HMAC-SHA256 des rohen Bodys.
    verifyWebhook(rawBody, headers) {
      const sig = String(headers['x-cc-webhook-signature'] || '');
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (!sig || !safeEqualHex(expected, sig)) { const e = new Error('Signatur ungültig.'); e.code = 'webhook_bad_signature'; e.status = 400; throw e; }
      const evt = JSON.parse(rawBody);
      if (evt.event?.type === 'charge:confirmed') return { type: 'paid', ref: evt.event.data?.code };
      return { type: 'other' };
    },
  };
}
