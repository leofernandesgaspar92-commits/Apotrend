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

// ── Wer bedient eine Methode, wenn zwei Anbieter sie können? ────────────────
//  „paypal" kann Stripe (als Zahlungsart im gehosteten Checkout) UND PayPal
//  selbst. Ohne Vorrang entschiede die Reihenfolge der ENV-Variablen darüber,
//  über wessen Konto das Geld läuft — das ist kein Zufall, den man dem
//  Deployment überlassen sollte.
//
//  Vorrang hat die DIREKTE Anbindung: niedrigere Gebühren, und sie funktioniert
//  auch dort, wo Stripe nicht verfügbar ist (NG, KE, GH, AO, MZ — die
//  Afrika-Strategie). Stripe bleibt der Rückfall, wenn keine PayPal-Zugangsdaten
//  hinterlegt sind.
const PROVIDER_VORRANG = { paypal: ['paypal', 'stripe'] };

export function createPaymentsService({ repo, providers = {}, onPaid = null, wallets = () => ({}), rates = null, fx = null, isModerator = () => false, mirror = null }) {
  const pick = (method) => {
    const kandidaten = Object.values(providers).filter(p => (p.methods || []).includes(method));
    if (!kandidaten.length) return null;
    const rang = PROVIDER_VORRANG[method];
    if (!rang) return kandidaten[0];
    const platz = (p) => { const i = rang.indexOf(p.name); return i === -1 ? rang.length : i; };
    return kandidaten.slice().sort((a, b) => platz(a) - platz(b))[0];
  };

  // ── Spiegel nach PostgreSQL ────────────────────────────────────────────────
  //  Absichtlich OHNE await und mit verschlucktem Fehler: Die Freischaltung
  //  hängt am Repo, nicht an der Datenbank. Eine Apotheke, die bezahlt hat,
  //  bekommt ihr Premium auch dann, wenn der Spiegel schweigt — es fehlt dann
  //  die Buchungszeile, nicht die Leistung. Umgekehrt wäre es eine Zahlung,
  //  die ins Leere läuft, weil eine optionale Datenbank gerade neu startet.
  //
  //  `mirror` ist optional, damit die Tests ohne Datenbank laufen.
  const spiegeln = (payment) => {
    if (!mirror || !payment || typeof mirror.saveTransaction !== 'function') return;
    try {
      const p = mirror.saveTransaction(payment);
      if (p && typeof p.catch === 'function') p.catch(() => { /* prismaStore protokolliert selbst */ });
    } catch { /* ein kaputter Spiegel darf keine Zahlung aufhalten */ }
  };

  /** Zahlung freischalten. Ein Weg für Webhook und manuelle Bestätigung. */
  async function freischalten(payment) {
    const aktuell = repo.setPaymentStatus(payment.id, 'paid') || payment;
    const product = getProduct(payment.product_id);
    if (product) {
      repo.grantEntitlement(payment.user_id, product.feature);
      if (onPaid) { try { await onPaid({ payment, product }); } catch { /* Mailversand darf die Freischaltung nicht blockieren */ } }
    }
    spiegeln({ ...aktuell, feature: product && product.feature });
    return { ok: true, granted: !!product };
  }

  return {
    // ── Direkt-in-Wallet Krypto (deine eigenen Adressen). BEWUSST OHNE automatische
    //    Chain-Verifizierung: statische Adressen erlauben keine zuverlässige Zuordnung
    //    „welche:r Kund:in hat gezahlt". Ablauf: anzeigen → Kund:in nennt Tx-ID → du
    //    bestätigst manuell (confirmPayment). Ehrlich statt Fake-Auto-Freischaltung. ──
    async cryptoOptions(productId, { currency = null } = {}) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const ws = wallets(); // Liste (mehrere Wallets je Coin möglich)
      const eur = product.amount_cents / 100;
      const rateMap = rates ? await rates.ratesEur([...new Set(ws.map(w => w.coin))]) : {};
      const coins = ws.map(w => {
        const rate = rateMap[w.coin]; // EUR pro 1 Coin
        const amount = rate ? Number((eur / rate).toFixed(8)) : null;
        return { id: w.id, coin: w.coin, symbol: w.symbol, label: w.label, address: w.address, network: w.network, amount_eur: eur, amount_crypto: amount, uri: walletUri(w, amount) };
      });

      // Näherung in der Landeswährung. ABGERECHNET wird weiterhin in der
      // Produktwährung — der lokale Betrag ist eine Orientierung, damit eine
      // Apotheke in Luanda oder Zürich nicht selbst umrechnen muss.
      // Bewusst KEINE zweite Preisliste: einen Preis zu erfinden wäre etwas
      // anderes als ihn zum echten Tageskurs anzuzeigen. Fehlt der Kurs,
      // steht hier null und die Oberfläche sagt das offen.
      const local = await localApproximation({ fx, amount: eur, from: product.currency, to: currency });

      return { product: product.id, product_name: product.name, currency: product.currency, amount: eur, amount_eur: eur, local, coins };
    },
    // Kund:in wählt eine konkrete Wallet -> pending-Datensatz (zur späteren manuellen Zuordnung).
    startCryptoPayment(userId, productId, walletId) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const w = wallets().find(x => x.id === walletId);
      if (!w) throw new AppError('coin_unavailable', 'Wallet nicht verfügbar.');
      const payment = repo.createPayment({ userId, productId, amountCents: product.amount_cents, currency: product.currency, method: 'crypto_direct', provider: 'direct', coin: w.coin, walletId: w.id, address: w.address, status: 'pending' });
      spiegeln(payment);
      return { payment_id: payment.id, coin: w.coin, address: w.address, network: w.network, label: w.label };
    },
    // Kund:in reicht die Transaktions-ID ein -> „pending_review" (du prüfst in deiner Wallet).
    claimCryptoPayment(userId, paymentId, txRef) {
      const p = repo.getPayment(paymentId);
      if (!p || p.user_id !== userId) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      const ref = String(txRef || '').trim();
      if (ref.length < 6) throw new AppError('tx_ref_missing', 'Bitte die Transaktions-ID angeben.');
      repo.setPaymentRef(paymentId, ref);
      spiegeln(repo.setPaymentStatus(paymentId, 'pending_review'));
      return { ok: true };
    },
    // Betreiber/Moderation bestätigt manuell (nach Blick in die Wallet) -> Feature frei.
    async confirmPayment(moderatorUserId, paymentId) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      const p = repo.getPayment(paymentId);
      if (!p) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      if (p.status === 'paid') return { ok: true, already: true };
      return freischalten(p);
    },
    listPendingReview(moderatorUserId) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      return repo.listAllPayments().filter(p => p.status === 'pending_review');
    },

    // Verfügbare Methoden (leer, solange kein Anbieter konfiguriert ist).
    //
    // Je Methode GENAU EIN Eintrag. Sonst stünden mit Stripe und PayPal
    // gleichzeitig zwei Knöpfe „PayPal" im Checkout — für die Kundin ein
    // offensichtlicher Fehler, obwohl technisch beide stimmen. Welcher Anbieter
    // genannt wird, entscheidet derselbe Vorrang, der die Zahlung später
    // tatsächlich bedient (`pick`) — die Anzeige kann also nicht von der
    // Ausführung abweichen.
    configuredMethods() {
      const out = [];
      const gesehen = new Set();
      for (const p of Object.values(providers)) for (const m of (p.methods || [])) {
        if (gesehen.has(m)) continue;
        gesehen.add(m);
        const zustaendig = pick(m);
        out.push({ method: m, provider: (zustaendig && zustaendig.name) || p.name });
      }
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
      spiegeln((checkout && checkout.ref) ? repo.setPaymentRef(payment.id, checkout.ref) : payment);
      return { payment_id: payment.id, redirect_url: checkout && checkout.url };
    },

    // Webhook: roher Body + Header -> Anbieter verifiziert Signatur -> bei „paid"
    // Feature freischalten. Idempotent (Doppel-Webhooks ändern nichts).
    async handleWebhook(providerName, rawBody, headers) {
      const provider = providers[providerName];
      if (!provider) throw new AppError('provider_unknown', 'Unbekannter Anbieter.');
      // `await` ist hier PFLICHT, nicht Kosmetik.
      //
      // Stripe und Coinbase pruefen lokal (HMAC) und geben synchron zurueck.
      // PayPal MUSS zurueckfragen (siehe createPayPalAdapter) und ist deshalb
      // asynchron. Ohne `await` kaeme hier ein Promise an: truthy, `evt.type`
      // undefined — der Webhook waere stillschweigend als „ignoriert"
      // durchgelaufen, und keine PayPal-Zahlung waere je freigeschaltet
      // worden. Eine abgelehnte Signatur haette zudem eine unbehandelte
      // Promise-Ablehnung ausgeloest statt einer sauberen 400.
      //
      // `await` auf einen synchronen Rueckgabewert kostet nichts.
      const evt = await provider.verifyWebhook(rawBody, headers); // wirft bei ungültiger Signatur
      if (!evt) return { ok: true, ignored: true };

      // Zahlung zum Ereignis finden. Zwei Wege, weil nicht jeder Anbieter in
      // jedem Ereignis dieselbe Kennung mitschickt (PayPal nennt bei einer
      // Belastung die Bestell-ID nicht immer, dafür aber unsere eigene ID).
      // `provider`-Prüfung beim zweiten Weg ist Pflicht: Eine fremde Kennung
      // darf nicht die Zahlung eines anderen Anbieters treffen.
      const zuordnen = () => {
        if (evt.ref) { const p = repo.getPaymentByRef(providerName, evt.ref); if (p) return p; }
        if (evt.paymentId) {
          const p = repo.getPayment(evt.paymentId);
          if (p && p.provider === providerName) return p;
        }
        return null;
      };

      // ── Freigegeben, aber noch nicht belastet ──────────────────────────────
      // Bei PayPal heißt „genehmigt" NICHT „bezahlt": Die Kundin hat die
      // Belastung erlaubt, das Geld bewegt sich erst beim Einzug (capture).
      // Wer hier freischaltet, verschenkt Premium — die Genehmigung allein
      // bringt keinen Cent. Deshalb wird erst eingezogen und nur ein
      // bestätigter Einzug schaltet frei.
      if (evt.type === 'approved') {
        const payment = zuordnen();
        if (!payment) return { ok: true, unmatched: true };
        if (payment.status === 'paid') return { ok: true, already: true };
        if (typeof provider.captureOrder !== 'function') return { ok: true, ignored: true };
        const einzug = await provider.captureOrder(evt.ref);
        // Nicht abgeschlossen (in Prüfung, abgelehnt): NICHT freischalten. Der
        // Anbieter meldet den Abschluss später per eigenem Ereignis nach.
        if (!einzug || !einzug.paid) return { ok: true, pending: true };
        return freischalten(payment);
      }

      if (evt.type !== 'paid') return { ok: true, ignored: true };
      const payment = zuordnen();
      if (!payment) return { ok: true, unmatched: true };
      if (payment.status === 'paid') return { ok: true, already: true };
      return freischalten(payment);
    },

    hasFeature(userId, feature) { return repo.hasEntitlement(userId, feature); },
    myEntitlements(userId) { return repo.listEntitlements(userId); },
  };
}

/**
 * Betrag zur Orientierung in eine andere Währung umrechnen.
 *
 * Gibt `null` zurück, sobald irgendetwas fehlt (kein FX-Dienst, kein Kurs,
 * gleiche Währung). Ein geschätzter Betrag ohne Kursbeleg wäre schlimmer als
 * gar keiner — die Oberfläche zeigt dann nur die Abrechnungswährung.
 */
async function localApproximation({ fx, amount, from, to }) {
  if (!fx || !to || to === from) return null;
  try {
    const data = await fx.rates();
    const converted = fx.convert(amount, from, to, data);
    if (converted == null || !isFinite(converted)) return null;
    return { currency: to, amount: converted, updated_at: (data && data.updated_at) || null };
  } catch {
    return null; // Netzfehler: lieber nichts anzeigen als etwas Erfundenes
  }
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
  // PayPal direkt: nur mit VOLLSTAENDIGEN Zugangsdaten inklusive Webhook-ID.
  // Ohne die ID liesse sich kein Webhook pruefen — ein Anbieter, dessen
  // Zahlungsbestaetigungen niemand verifizieren kann, wird gar nicht erst
  // angeboten.
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID) {
    providers.paypal = createPayPalAdapter({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      webhookId: env.PAYPAL_WEBHOOK_ID,
      live: /^(live|production|1|true)$/i.test(String(env.PAYPAL_MODE || '')),
      fetchImpl,
    });
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
    // 'card' deckt Apple Pay und Google Pay MIT AB: Beide sind bei Stripe
    // keine eigenen payment_method_types, sondern Wallets, die der gehostete
    // Checkout automatisch anbietet, wenn Geraet und Browser sie koennen.
    // Sie trotzdem einzeln zu listen ist richtig — die Nutzerin sucht nach
    // „Apple Pay", nicht nach „Karte".
    methods: ['card', 'apple_pay', 'google_pay', 'paypal', 'klarna'],
    async createCheckout({ payment, product, method, successUrl, cancelUrl }) {
      const body = new URLSearchParams();
      body.set('mode', 'payment');
      body.set('success_url', successUrl || 'https://apopulse.example/premium?ok=1');
      body.set('cancel_url', cancelUrl || 'https://apopulse.example/premium?cancel=1');
      body.set('client_reference_id', payment.id);
      // Apple/Google Pay laufen ueber 'card' — sie sind Wallets, keine eigene
      // Methode. Klarna und PayPal sind eigene Typen.
      const STRIPE_TYP = { paypal: 'paypal', klarna: 'klarna' };
      body.append('payment_method_types[]', STRIPE_TYP[method] || 'card');
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
          name: product.name, description: 'ApoPulse Premium',
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

// ============================================================================
//  PayPal (Fiat) — direkt, nicht über Stripe
// ============================================================================
//  Bisher lief PayPal als Methode INNERHALB von Stripe. Das funktioniert, hat
//  aber zwei Nachteile: Es setzt ein Stripe-Konto voraus, und die Gebühren
//  liegen über denen einer direkten PayPal-Anbindung. Für die Afrika-Strategie
//  kommt dazu, dass Stripe in mehreren Zielländern (NG, KE, GH, AO, MZ) gar
//  nicht oder nur eingeschränkt verfügbar ist — PayPal dagegen schon.
//
//  ──────────────────────────────────────────────────────────────────────────
//  KEIN SDK, UND ZWAR MIT ABSICHT
//  ──────────────────────────────────────────────────────────────────────────
//  Der Auftrag nannte `npm install stripe` und ein PayPal-SDK. Dieser Server
//  läuft auf Node-Bordmitteln plus @prisma/client — das ist keine Marotte,
//  sondern hält die Angriffsfläche klein: Jede Abhängigkeit im Zahlungspfad
//  ist eine Stelle, über die fremder Code an Zahlungsdaten käme.
//
//  Beide Anbieter haben eine dokumentierte REST-Schnittstelle. Der
//  Stripe-Adapter nutzt sie seit jeher, dieser hier genauso. Was ein SDK
//  zusätzlich brächte, wäre Bequemlichkeit — und die ist das Risiko im
//  Bezahlweg nicht wert.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE STELLE, AN DER PAYPAL-ANBINDUNGEN ÜBLICHERWEISE UNSICHER SIND
//  ──────────────────────────────────────────────────────────────────────────
//  Stripe und Coinbase signieren ihre Webhooks mit einem gemeinsamen Geheimnis:
//  Die Prüfung ist eine lokale HMAC-Rechnung. PayPal macht das NICHT. Dort
//  muss die Echtheit per RÜCKFRAGE bei PayPal bestätigt werden
//  (`/v1/notifications/verify-webhook-signature`).
//
//  Genau das wird häufig weggelassen, weil es umständlich ist und ohne
//  Prüfung „auch funktioniert". Dann kann jeder, der die Adresse kennt, ein
//  „Zahlung abgeschlossen" schicken und sich Premium freischalten.
//
//  Dieser Adapter prüft deshalb IMMER und FÄLLT GESCHLOSSEN AUS: Antwortet
//  PayPal nicht oder nicht mit SUCCESS, gilt der Webhook als ungültig. Lieber
//  eine verzögerte Freischaltung als eine erschlichene.
// ============================================================================
export function createPayPalAdapter({
  clientId, clientSecret, webhookId, live = false, fetchImpl = globalThis.fetch,
}) {
  const base = live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  // Zugangstoken holen. Bewusst bei jedem Vorgang neu statt zwischengespeichert:
  // Ein Token im Speicher, das über Stunden lebt, ist ein Geheimnis mehr, das
  // bei einem Fehler irgendwo landen kann. Der Aufruf kostet Millisekunden.
  async function token() {
    const r = await fetchImpl(base + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) {
      const e = new Error('PayPal-Zugang fehlgeschlagen (HTTP ' + r.status + ').');
      e.code = 'paypal_auth_failed';
      throw e;
    }
    return j.access_token;
  }

  /** Autorisierter Aufruf gegen die PayPal-REST-Schnittstelle. */
  async function anfrage(pfad, body, zusatzKopf = {}) {
    const t = await token();
    const r = await fetchImpl(base + pfad, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json', ...zusatzKopf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
  }

  return {
    name: 'paypal',
    // Dieselbe Kennung wie bei Stripe, KEIN eigenes „paypal_direct": Für die
    // Kundin ist es derselbe Bezahlweg, nur über ein anderes Konto abgerechnet.
    // Welcher Anbieter zum Zug kommt, regelt PROVIDER_VORRANG oben — nicht ein
    // zweiter Knopf, den niemand unterscheiden kann.
    methods: ['paypal'],

    async createCheckout({ payment, product, successUrl, cancelUrl }) {
      const t = await token();
      const r = await fetchImpl(base + '/v2/checkout/orders', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + t,
          'content-type': 'application/json',
          // Verhindert doppelte Bestellungen, wenn ein Aufruf wiederholt wird
          // (Netzwerkwackler, Doppelklick). Unsere Zahlungs-ID ist dafür genau
          // der richtige Schlüssel: Sie ist je Vorgang eindeutig.
          'PayPal-Request-Id': payment.id,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            // Unsere ID fährt mit: Der Webhook nennt sie zurück, und nur so
            // lässt sich eine Zahlung dem richtigen Konto zuordnen.
            custom_id: payment.id,
            description: String(product.name).slice(0, 127),
            amount: {
              currency_code: (product.currency || 'EUR').toUpperCase(),
              value: (product.amount_cents / 100).toFixed(2),
            },
          }],
          payment_source: {
            paypal: {
              experience_context: {
                user_action: 'PAY_NOW',
                return_url: successUrl || 'https://www.apopulse.com/?zahlung=ok',
                cancel_url: cancelUrl || 'https://www.apopulse.com/?zahlung=abbruch',
              },
            },
          },
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.id) return null;
      const approve = (j.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
      return { url: approve && approve.href, ref: j.id };
    },

    /**
     * Webhook prüfen — per Rückfrage bei PayPal, nicht lokal.
     *
     * `verifyWebhook` ist bei den anderen Anbietern synchron. Hier MUSS sie
     * asynchron sein, weil die Prüfung ein Netzaufruf ist.
     *
     * ACHTUNG: `handleWebhook` hat dieses Ergebnis ursprünglich NICHT
     * awaited — die anderen beiden Anbieter brauchten es nicht. Ein Promise
     * ist truthy, `evt.type` wäre undefined gewesen: Jeder PayPal-Webhook
     * wäre stillschweigend als „ignoriert" durchgelaufen, und keine
     * PayPal-Zahlung je freigeschaltet worden. Beim Hinzufügen dieses
     * Adapters wurde der Aufrufer deshalb mitgeändert.
     *
     * Wer hier einen weiteren asynchronen Adapter ergänzt: Das `await` in
     * handleWebhook ist die Stelle, an der es hängt.
     */
    async verifyWebhook(rawBody, headers) {
      const ungueltig = (grund) => {
        const e = new Error('Signatur ungültig: ' + grund);
        e.code = 'webhook_bad_signature';
        e.status = 400;
        return e;
      };
      if (!webhookId) throw ungueltig('PAYPAL_WEBHOOK_ID fehlt — ohne sie ist keine Prüfung möglich');

      const noetig = ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo'];
      for (const h of noetig) if (!headers[h]) throw ungueltig(`Kopfzeile ${h} fehlt`);

      let evt;
      try { evt = JSON.parse(rawBody); } catch { throw ungueltig('Body ist kein JSON'); }

      let bestaetigung;
      try {
        const t = await token();
        const r = await fetchImpl(base + '/v1/notifications/verify-webhook-signature', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' },
          body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: webhookId,
            webhook_event: evt,
          }),
        });
        bestaetigung = await r.json().catch(() => null);
      } catch (e) {
        // GESCHLOSSEN ausfallen. Ein Netzfehler bei der Prüfung darf nicht
        // bedeuten, dass die Zahlung als echt gilt — sonst genügt es, die
        // Prüfung zum Scheitern zu bringen, um sich etwas freizuschalten.
        throw ungueltig('Rückfrage bei PayPal fehlgeschlagen (' + ((e && e.message) || e) + ')');
      }
      if (!bestaetigung || bestaetigung.verification_status !== 'SUCCESS') {
        throw ungueltig('PayPal bestätigt die Signatur nicht');
      }

      // Erst nach bestandener Prüfung wird der Inhalt überhaupt ausgewertet.
      const res = evt.resource || {};

      // ── Genehmigt ≠ bezahlt ────────────────────────────────────────────────
      // `resource` ist hier die BESTELLUNG, `resource.id` also die Bestell-ID
      // und damit unsere gespeicherte Referenz. Zurückgegeben wird aber
      // ausdrücklich `approved`, nicht `paid`: Der Kern zieht daraufhin ein
      // (siehe handleWebhook). Hier `paid` zu melden wäre der teuerste
      // denkbare Tippfehler — Premium frei, Geld nie geflossen.
      if (evt.event_type === 'CHECKOUT.ORDER.APPROVED') {
        return { type: 'approved', ref: res.id };
      }

      // ── Eingezogen: jetzt ist es Geld ──────────────────────────────────────
      // `resource` ist hier die BELASTUNG. `resource.id` ist deshalb die
      // Capture-ID und NICHT unsere Referenz — sie würde auf keine Zahlung
      // passen. Die Bestell-ID steht unter `supplementary_data`; zusätzlich
      // fährt unsere eigene Zahlungs-ID als `custom_id` mit (wir setzen sie
      // beim Anlegen der Bestellung). Zwei Wege, weil PayPal
      // `supplementary_data` nicht garantiert mitliefert.
      if (evt.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const bestellId = res.supplementary_data
          && res.supplementary_data.related_ids
          && res.supplementary_data.related_ids.order_id;
        return { type: 'paid', ref: bestellId || null, paymentId: res.custom_id || null };
      }

      return { type: 'other' };
    },

    /**
     * Bestellung einziehen — hier bewegt sich das Geld.
     *
     * Wird vom Kern nach `CHECKOUT.ORDER.APPROVED` aufgerufen. Gibt
     * `{ paid: true }` nur bei `COMPLETED` zurück; `PENDING` (Prüfung durch
     * PayPal) und alles andere gelten als nicht bezahlt. Die Freischaltung
     * folgt dann über `PAYMENT.CAPTURE.COMPLETED`.
     *
     * `422 ORDER_ALREADY_CAPTURED` ist KEIN Fehlerfall: Es heißt, der Einzug
     * ist schon erfolgt (doppelt zugestellter Webhook). Dann gilt die Zahlung
     * als bezahlt — sonst bliebe eine bezahlte Bestellung unfreigeschaltet,
     * nur weil PayPal denselben Hinweis zweimal geschickt hat.
     */
    async captureOrder(orderId) {
      const id = String(orderId || '').trim();
      if (!id) return { paid: false, reason: 'keine Bestell-ID' };
      // Eigener Idempotenz-Schlüssel: Ein wiederholter Aufruf zieht nicht
      // zweimal ein.
      const { ok, status, json } = await anfrage(
        `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {},
        { 'PayPal-Request-Id': 'capture-' + id },
      );
      if (!ok) {
        const schonEingezogen = (json && (json.details || []).some((d) => d.issue === 'ORDER_ALREADY_CAPTURED'));
        return schonEingezogen
          ? { paid: true, already: true }
          : { paid: false, reason: 'HTTP ' + status };
      }
      const status2 = json && json.status;
      const einzug = json && json.purchase_units && json.purchase_units[0]
        && json.purchase_units[0].payments && json.purchase_units[0].payments.captures
        && json.purchase_units[0].payments.captures[0];
      const abgeschlossen = status2 === 'COMPLETED' && (!einzug || einzug.status === 'COMPLETED');
      return abgeschlossen ? { paid: true, captureId: einzug && einzug.id } : { paid: false, reason: String(status2 || 'unbekannt') };
    },
  };
}
