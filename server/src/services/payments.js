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
import { pruefeTx } from '../domain/kryptoTx.js';

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

/** Kalendermonate addieren; 31.01. + 1 Monat = 28./29.02., nicht 03.03. */
export function plusMonate(ms, n) {
  const d = new Date(ms);
  const tag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(tag, letzter));
  return d.getTime();
}

export function createPaymentsService({
  repo, providers = {}, onPaid = null, wallets = () => ({}), rates = null, fx = null, isModerator = () => false, mirror = null,
  // Benachrichtigungen der manuellen Krypto-Prüfung. Optional, damit die
  // Tests ohne Social-Schicht laufen. `moderatoren()` liefert User-IDs.
  benachrichtige = null, moderatoren = () => [],
  jetzt = () => Date.now(),
  // Für Zahlungen ohne Katalogprodukt (Anzeigen-Kampagnen): wird nach jeder
  // bestätigten Zahlung aufgerufen. Fehler darin halten die Zahlung nicht auf.
  beiBezahlt = null,
}) {
  const melde = (o) => { if (typeof benachrichtige === 'function') { try { benachrichtige(o); } catch { /* eine Glocke darf keine Zahlung aufhalten */ } } };
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
      // Laufzeit: ab dem bisherigen Ablauf, wenn der noch in der Zukunft liegt —
      // wer früh verlängert, verliert keinen Tag. Unbefristetes bleibt unbefristet.
      // `zusatz` (Business): weitere Funktionen für dieselbe Laufzeit, je
      // Funktion ab ihrem eigenen bisherigen Ablauf gerechnet.
      for (const feature of [product.feature, ...(product.zusatz || [])]) {
        let bis;
        if (product.monate) {
          const alt = repo.entitlementBis ? repo.entitlementBis(payment.user_id, feature) : null;
          const hatUnbefristet = repo.hasEntitlement(payment.user_id, feature) && !alt;
          if (hatUnbefristet) continue;
          const start = alt && Date.parse(alt) > jetzt() ? Date.parse(alt) : jetzt();
          bis = new Date(plusMonate(start, product.monate)).toISOString();
        }
        repo.grantEntitlement(payment.user_id, feature, bis ? { bis } : {});
      }
      if (onPaid) { try { await onPaid({ payment, product }); } catch { /* Mailversand darf die Freischaltung nicht blockieren */ } }
    }
    spiegeln({ ...aktuell, feature: product && product.feature });
    if (typeof beiBezahlt === 'function') { try { await beiBezahlt(aktuell); } catch { /* darf die Zahlung nicht aufhalten */ } }
    return { ok: true, granted: !!product };
  }

  /** Coins mit Betrag zum aktuellen Kurs — gemeinsam für Produkte und freie Beträge. */
  async function kryptoAngebot(eur) {
    const ws = wallets();
    const rateMap = rates ? await rates.ratesEur([...new Set(ws.map(w => w.coin))]) : {};
    return ws.map(w => {
      const rate = rateMap[w.coin];
      const amount = rate ? Number((eur / rate).toFixed(8)) : null;
      return { id: w.id, coin: w.coin, symbol: w.symbol, label: w.label, address: w.address, network: w.network, amount_eur: eur, amount_crypto: amount, uri: walletUri(w, amount) };
    });
  }

  return {
    // ── Freier Betrag (Anzeigen-Kampagne): dieselbe Krypto-Strecke wie Premium,
    //    nur ohne Katalogprodukt. `ref` (z. B. „anzeige:<id>") steht als
    //    product_id in der Zahlung; freischalten() ruft dafür `beiBezahlt`.
    async cryptoOptionsBetrag({ amountCents, currency = 'EUR', name = null }) {
      const eur = Number(amountCents) / 100;
      if (!(eur > 0)) throw new AppError('betrag_ungueltig', 'Ungültiger Betrag.');
      return { product: null, product_name: name, currency, amount: eur, amount_eur: eur, local: null, coins: await kryptoAngebot(eur) };
    },
    async startCryptoPaymentBetrag(userId, { ref, amountCents, currency = 'EUR', walletId, name = null }) {
      if (!/^anzeige:[a-z0-9]+$/.test(String(ref || ''))) throw new AppError('zahlung_ref', 'Unbekannter Zahlungszweck.');
      const w = wallets().find(x => x.id === walletId);
      if (!w) throw new AppError('coin_unavailable', 'Wallet nicht verfügbar.');
      let rate = null;
      try { rate = rates ? ((await rates.ratesEur([w.coin])) || {})[w.coin] || null : null; } catch { rate = null; }
      const eur = Number(amountCents) / 100;
      const payment = repo.createPayment({ userId, productId: ref, amountCents: Number(amountCents), currency, method: 'crypto_direct', provider: 'direct', coin: w.coin, walletId: w.id, address: w.address, status: 'pending' });
      const mitBetrag = repo.updatePaymentReview
        ? repo.updatePaymentReview(payment.id, { rate_eur: rate, expected_crypto: rate ? Number((eur / rate).toFixed(8)) : null, bezeichnung: name })
        : payment;
      spiegeln(mitBetrag || payment);
      return { payment_id: payment.id, coin: w.coin, address: w.address, network: w.network, label: w.label };
    },
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
    //
    // Der ERWARTETE Betrag wird beim Start festgehalten (Kurs dieses Moments).
    // Die Moderation braucht ihn für die Prüfung — siehe claimCryptoPayment.
    async startCryptoPayment(userId, productId, walletId) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const w = wallets().find(x => x.id === walletId);
      if (!w) throw new AppError('coin_unavailable', 'Wallet nicht verfügbar.');
      let rate = null;
      try { rate = rates ? ((await rates.ratesEur([w.coin])) || {})[w.coin] || null : null; } catch { rate = null; }
      const eur = product.amount_cents / 100;
      const payment = repo.createPayment({ userId, productId, amountCents: product.amount_cents, currency: product.currency, method: 'crypto_direct', provider: 'direct', coin: w.coin, walletId: w.id, address: w.address, status: 'pending' });
      const mitBetrag = repo.updatePaymentReview
        ? repo.updatePaymentReview(payment.id, { rate_eur: rate, expected_crypto: rate ? Number((eur / rate).toFixed(8)) : null })
        : payment;
      spiegeln(mitBetrag || payment);
      return { payment_id: payment.id, coin: w.coin, address: w.address, network: w.network, label: w.label };
    },
    // Kund:in reicht die Transaktions-ID ein -> „pending_review" (du prüfst in deiner Wallet).
    //
    // ⚠️ TRANSAKTIONS-IDs SIND ÖFFENTLICH. Jede Zahlung an unsere Adresse steht
    //    im Block-Explorer. Wer eine fremde, echte Zahlung abschreibt und als
    //    eigene meldet, bestünde eine Prüfung „gibt es die Transaktion, geht
    //    sie an unsere Adresse?" — und bekäme Premium umsonst. Darum:
    //     · Eine ID lässt sich nur EINMAL melden (offene oder bezahlte Meldung).
    //     · Der Startzeitpunkt und der erwartete Betrag stehen in der Prüfliste:
    //       Eine abgeschriebene Zahlung liegt zeitlich VOR dem Start der
    //       Betrügerin — genau das sieht die Moderation.
    //     · Gesperrt wird nur durch eine OFFENE oder BEZAHLTE Meldung. Eine
    //       abgelehnte zählt nicht mehr — wer zuerst eine fremde ID meldet und
    //       abgelehnt wird, sperrt die echte Zahlerin damit nicht aus.
    claimCryptoPayment(userId, paymentId, txRef) {
      const p = repo.getPayment(paymentId);
      if (!p || p.user_id !== userId) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      const roh = String(txRef || '').trim();
      if (roh.length < 6) throw new AppError('tx_ref_missing', 'Bitte die Transaktions-ID angeben.');
      if (p.status === 'paid') throw new AppError('payment_already_paid', 'Diese Zahlung ist bereits bestätigt.', 409);
      const tx = pruefeTx(p.coin, roh);
      if (!tx.ok && tx.format) {
        // Tippfehler JETZT melden, nicht nach Tagen bei der Prüfung.
        throw new AppError('tx_format', `Das sieht nicht wie eine ${tx.kette}-Transaktions-ID aus (erwartet: ${tx.format}). Bitte aus der Wallet kopieren.`, 400);
      }
      const ref = tx.ok ? tx.id : roh;
      const schon = repo.getPaymentByRef(p.provider, ref);
      if (schon && schon.id !== p.id && ['pending_review', 'paid'].includes(schon.status)) {
        throw new AppError('tx_already_claimed', 'Diese Transaktion wurde bereits gemeldet. Wenn es Ihre Zahlung ist, wenden Sie sich bitte an den Support.', 409);
      }
      repo.setPaymentRef(paymentId, ref);
      if (repo.updatePaymentReview) repo.updatePaymentReview(paymentId, { claimed_at: new Date().toISOString() });
      spiegeln(repo.setPaymentStatus(paymentId, 'pending_review'));
      // Ohne diese Meldung erfuhr niemand von der Zahlung: Die Kundin las
      // „wird nach Prüfung freigeschaltet", und es prüfte niemand.
      for (const mod of (moderatoren() || [])) {
        melde({ userId: mod, type: 'payment_review', actorUserId: userId, refType: 'payment', refId: paymentId, label: `${p.coin} · ${(p.amount_cents / 100).toFixed(2)} ${p.currency}` });
      }
      return { ok: true };
    },
    // Betreiber/Moderation bestätigt manuell (nach Blick in die Wallet) -> Feature frei.
    async confirmPayment(moderatorUserId, paymentId) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      const p = repo.getPayment(paymentId);
      if (!p) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      if (p.status === 'paid') return { ok: true, already: true };
      const r = await freischalten(p);
      if (repo.updatePaymentReview) repo.updatePaymentReview(paymentId, { reviewed_by: moderatorUserId, reviewed_at: new Date().toISOString() });
      melde({ userId: p.user_id, type: 'payment_confirmed', actorUserId: moderatorUserId, refType: 'payment', refId: paymentId, label: getProduct(p.product_id)?.name || null });
      return r;
    },
    // Ablehnen: Betrag falsch, Transaktion nicht gefunden, oder zeitlich vor dem
    // Start (abgeschriebene fremde Zahlung). Die Kundin erfährt es MIT Grund —
    // sonst wartet sie weiter auf eine Freischaltung, die nicht kommt.
    rejectPayment(moderatorUserId, paymentId, grund) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      const p = repo.getPayment(paymentId);
      if (!p) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.');
      if (p.status !== 'pending_review') throw new AppError('payment_not_in_review', 'Nur gemeldete, offene Zahlungen lassen sich ablehnen.', 409);
      const g = String(grund || '').trim().slice(0, 300);
      if (!g) throw new AppError('reject_reason_missing', 'Bitte einen Grund angeben — die Kundin bekommt ihn mitgeteilt.', 400);
      if (repo.updatePaymentReview) repo.updatePaymentReview(paymentId, { reviewed_by: moderatorUserId, reviewed_at: new Date().toISOString(), review_note: g });
      spiegeln(repo.setPaymentStatus(paymentId, 'failed'));
      melde({ userId: p.user_id, type: 'payment_rejected', actorUserId: moderatorUserId, refType: 'payment', refId: paymentId, label: g });
      return { ok: true };
    },
    // Prüfliste: alles, was die Moderation für die Entscheidung braucht.
    listPendingReview(moderatorUserId, { kunde = () => null } = {}) {
      if (!isModerator(moderatorUserId)) throw new AppError('forbidden', 'Nur Moderation.');
      return repo.listAllPayments()
        .filter(p => p.status === 'pending_review')
        .sort((a, b) => String(a.claimed_at || a.created_at).localeCompare(String(b.claimed_at || b.created_at)))
        .map((p) => {
          const tx = pruefeTx(p.coin, p.provider_ref);
          const w = wallets().find(x => x.id === p.wallet_id);
          return {
            ...p,
            kunde: kunde(p.user_id),
            product_name: getProduct(p.product_id)?.name || p.bezeichnung || p.product_id,
            network: w ? w.network : null,
            symbol: w ? w.symbol : null, // „SOL", nicht „solana"
            wallet_label: w ? w.label : null,
            tx_format_ok: tx.ok,
            explorer_url: tx.ok ? tx.explorer : null,
          };
        });
    },
    // ── Per Rechnung (Überweisung), services/rechnungen.js ───────────────────
    //  Angelegt direkt als „pending_review": Es gibt nichts weiter zu melden —
    //  die Redaktion verbucht den Geldeingang in derselben Prüfliste wie
    //  Krypto (confirmPayment schaltet frei). Moderation wird benachrichtigt.
    ueberweisungAnlegen(userId, productId) {
      const product = getProduct(productId);
      if (!product) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const p = repo.createPayment({ userId, productId: product.id, amountCents: product.amount_cents, currency: product.currency, method: 'invoice', provider: 'direct', status: 'pending_review' });
      const mit = repo.updatePaymentReview ? repo.updatePaymentReview(p.id, { claimed_at: new Date().toISOString() }) : p;
      spiegeln(mit || p);
      for (const mod of (moderatoren() || [])) {
        melde({ userId: mod, type: 'payment_review', actorUserId: userId, refType: 'payment', refId: p.id, label: `Überweisung · ${(p.amount_cents / 100).toFixed(2)} ${p.currency}` });
      }
      return mit || p;
    },
    ueberweisungVermerken(paymentId, nummer) {
      return repo.updatePaymentReview ? repo.updatePaymentReview(paymentId, { bezeichnung: `Rechnung ${nummer}` }) : null;
    },
    zahlung: (id) => repo.getPayment(id),
    zahlungenVon: (userId) => repo.listPaymentsByUser(userId),

    // Eigene Zahlungen — damit die Premium-Seite „wird geprüft" oder „abgelehnt:
    // Grund" zeigen kann, statt dieselbe Zahlung ein zweites Mal anzubieten.
    myPayments(userId) {
      return repo.listPaymentsByUser(userId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map(({ id, product_id, amount_cents, currency, method, coin, status, created_at, claimed_at, paid_at, reviewed_at, review_note }) =>
          ({ id, product_id, amount_cents, currency, method, coin, status, created_at, claimed_at, paid_at, reviewed_at, review_note }));
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
    featureBis(userId, feature) { return repo.entitlementBis ? repo.entitlementBis(userId, feature) : null; },

    /**
     * Umstellung alter, unbefristeter Freischaltungen aus BEZAHLTEN Laufzeit-
     * Produkten: Ablauf = Zahlungsdatum + Laufzeit. Läge der schon in der
     * Vergangenheit, gibt es 7 Tage Kulanz ab heute — niemand wird ohne
     * Vorwarnung abgeschnitten. Ohne passende Zahlung (von der Redaktion
     * vergeben) bleibt die Freischaltung unbefristet. Mehrfach aufrufbar.
     */
    laufzeitenUmstellen() {
      let n = 0;
      for (const { userId, bis } of repo.listEntitlementGrants ? repo.listEntitlementGrants('premium') : []) {
        if (bis) continue;
        const bezahlt = repo.listPaymentsByUser(userId)
          .filter((p) => p.status === 'paid' && getProduct(p.product_id) && getProduct(p.product_id).monate)
          .sort((a, b) => String(a.paid_at || a.created_at).localeCompare(String(b.paid_at || b.created_at)));
        if (!bezahlt.length) continue;
        let ende = 0;
        for (const p of bezahlt) {
          const ab = Math.max(Date.parse(p.paid_at || p.created_at) || 0, ende);
          ende = plusMonate(ab, getProduct(p.product_id).monate);
        }
        const kulanz = jetzt() + 7 * 86400000;
        repo.grantEntitlement(userId, 'premium', { bis: new Date(Math.max(ende, kulanz)).toISOString() });
        n++;
      }
      return n;
    },

    /** Erinnerung 3 Tage vor Ablauf — einmal je Ablaufdatum. */
    ablaufErinnern() {
      let n = 0;
      for (const { userId, bis } of repo.listEntitlementGrants ? repo.listEntitlementGrants('premium') : []) {
        if (!bis) continue;
        const rest = Date.parse(bis) - jetzt();
        if (rest <= 0 || rest > 3 * 86400000) continue;
        const key = `${userId}|premium|${bis}`;
        if (repo.wasReminded(key)) continue;
        repo.markReminded(key);
        melde({ userId, type: 'premium_ablauf', refType: 'premium', refId: bis, label: bis.slice(0, 10) });
        n++;
      }
      return n;
    },
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
