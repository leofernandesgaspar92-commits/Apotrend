// ============================================================================
//  Rechnungen für Tarife (Premium, Business)
// ============================================================================
//  Wer kauft, braucht einen Beleg: Eine Apotheke oder ein Großhändler bucht
//  990 € nicht ohne Rechnung — auch nicht, wenn mit Krypto gezahlt wurde. Und
//  viele Firmen zahlen ÜBERHAUPT nur per Rechnung und Überweisung.
//
//  Zwei Wege:
//   1. Beleg zu einer bezahlten Zahlung (Krypto, Karte): Die Rechnung wird
//      beim ersten Abruf ausgestellt und trägt „bezahlt am … per …".
//   2. Per Rechnung bestellen: Rechnung sofort, Zahlung offen; die Redaktion
//      verbucht den Eingang in derselben Prüfliste wie Krypto — dann ist der
//      Tarif frei.
//
//  Regeln:
//   - Ohne Rechnungssteller (Firmenname + Anschrift des Betreibers) keine
//     Rechnung; ohne IBAN keine Überweisung. Keine halbe Rechnung.
//   - Empfänger und Beträge werden beim Ausstellen FESTGESCHRIEBEN. Spätere
//     Änderungen an den Rechnungsangaben ändern keine ausgestellte Rechnung.
//   - Tarifpreise sind Endpreise (das, was gezahlt wird). Mit Umsatzsteuer-
//     satz weist die Rechnung die enthaltene Steuer aus. (Anzeigen dagegen
//     haben Nettopreise — siehe anzeigen.js.) Steuerfragen wie Reverse Charge
//     klärt die Steuerberatung, docs/RECHNUNGEN.md.
//   - Rechnungsnummern aus der gemeinsamen Reihe (rechnungsnummern.js).
// ============================================================================
import { AppError } from '../domain/errors.js';
import { ustFuerEmpfaenger } from '../domain/umsatzsteuer.js';
import { ISO_LAENDER } from '../domain/iso3166.js';

export const ANGABEN_FELDER = ['firma', 'ansprechpartner', 'strasse', 'plz', 'ort', 'land', 'ust_id', 'email'];
// PLZ nicht Pflicht: Uganda, Ruanda u. a. haben keine Postleitzahlen (vorher musste man eine erfinden).
const PFLICHT = ['firma', 'strasse', 'ort', 'land', 'email'];

export function createRechnungen({
  betreiber = {}, nummern, payments, produkt, jetzt = () => Date.now(), istModerator = () => false,
} = {}) {
  const angaben = new Map();    // userId -> Rechnungsangaben
  const rechnungen = new Map(); // nummer -> Rechnung (festgeschrieben)
  const zuZahlung = new Map();  // payment_id -> nummer

  const rechnungMoeglich = () => !!(betreiber.firma && betreiber.anschrift);
  const ueberweisungMoeglich = () => rechnungMoeglich() && !!betreiber.iban;
  const tag = () => new Date(jetzt()).toISOString().slice(0, 10);
  const kopie = (o) => JSON.parse(JSON.stringify(o));

  // Endpreis aufteilen. Empfänger außerhalb der EU: keine EU-Umsatzsteuer, stattdessen
  // Hinweis auf der Rechnung (domain/umsatzsteuer.js).
  function beitraege(brutto, land) {
    const { satz, hinweis } = ustFuerEmpfaenger(betreiber.ust_satz, land, { drittlandMitSteuer: betreiber.ust_drittland === 'mit' });
    const ust = satz ? Math.round(brutto * satz / (100 + satz)) : 0;
    return { brutto_cents: brutto, ust_satz: satz, ust_cents: ust, netto_cents: brutto - ust, ust_hinweis: hinweis };
  }
  function zahlart(p) {
    if (p.method === 'invoice') return { art: 'ueberweisung' };
    if (p.method === 'crypto_direct') return { art: 'krypto', coin: p.coin || null, tx: p.provider_ref || null };
    return { art: 'online', anbieter: p.provider || null };
  }
  function ausstellen(p, empfaenger) {
    const pr = produkt(p.product_id);
    if (!pr) throw new AppError('rechnung_produkt', 'Für diese Zahlung gibt es keine Tarif-Rechnung.', 409);
    const nummer = nummern.naechste();
    const r = {
      nummer, datum: tag(), user_id: p.user_id, payment_id: p.id,
      aussteller: { firma: betreiber.firma, anschrift: betreiber.anschrift, ust_id: betreiber.ust_id || null, iban: betreiber.iban || null, bic: betreiber.bic || null, inhaber: betreiber.inhaber || betreiber.firma },
      empfaenger: { ...empfaenger },
      leistung: { produkt: pr.id, name: pr.name, monate: pr.monate || null },
      ...beitraege(p.amount_cents, empfaenger && empfaenger.land), waehrung: p.currency || 'EUR',
      zahlart: zahlart(p),
    };
    rechnungen.set(nummer, r); zuZahlung.set(p.id, nummer);
    return r;
  }
  /** Ausgabe mit aktuellem Zahlungsstand (bezahlt ja/nein, wann). */
  function ausgabe(r) {
    const p = payments.zahlung(r.payment_id);
    return { ...kopie(r), bezahlt: !!(p && p.status === 'paid'), bezahlt_am: (p && p.paid_at) || null, abgelehnt: !!(p && p.status === 'failed') };
  }
  function brauchtAngaben(userId) {
    const a = angaben.get(userId);
    if (!a) throw new AppError('rechnung_angaben_fehlen', 'Bitte zuerst die Rechnungsangaben ausfüllen (Firma, Anschrift, E-Mail).', 409);
    return a;
  }

  return {
    rechnungMoeglich, ueberweisungMoeglich,

    angabenSetzen(userId, f) {
      const d = {};
      for (const k of ANGABEN_FELDER) d[k] = String((f && f[k]) || '').trim().slice(0, 160);
      for (const k of PFLICHT) if (!d[k]) throw new AppError('rechnung_angaben', 'Bitte Firma, Straße, Ort, Land und Rechnungs-E-Mail angeben.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new AppError('rechnung_email', 'Bitte eine gültige Rechnungs-E-Mail angeben.');
      d.land = d.land.toUpperCase();
      // Das Land entscheidet über die Umsatzsteuer — nur echte Ländercodes (Auswahlliste).
      if (!ISO_LAENDER.has(d.land)) throw new AppError('rechnung_land', 'Bitte das Land aus der Liste wählen.');
      angaben.set(userId, d);
      return { ...d };
    },
    angaben(userId) { const a = angaben.get(userId); return a ? { ...a } : null; },

    /** Weg 2: per Rechnung bestellen. Rechnung sofort, Tarif nach Zahlungseingang. */
    perRechnungBestellen(userId, productId) {
      if (!ueberweisungMoeglich()) throw new AppError('ueberweisung_aus', 'Zahlung per Rechnung ist noch nicht eingerichtet.', 409);
      const pr = produkt(productId);
      if (!pr) throw new AppError('product_unknown', 'Unbekanntes Produkt.');
      const a = brauchtAngaben(userId);
      // Eine offene Rechnung für denselben Tarif genügt — kein Stapel offener Rechnungen.
      for (const r of rechnungen.values()) {
        if (r.user_id !== userId || r.leistung.produkt !== pr.id || r.zahlart.art !== 'ueberweisung') continue;
        const p = payments.zahlung(r.payment_id);
        if (p && p.status === 'pending_review') return ausgabe(r);
      }
      const p = payments.ueberweisungAnlegen(userId, pr.id);
      const r = ausstellen(p, a);
      payments.ueberweisungVermerken(p.id, r.nummer);
      return ausgabe(r);
    },

    /** Weg 1: Beleg zu einer bezahlten Zahlung (einmal ausgestellt, danach dieselbe Rechnung). */
    fuerZahlung(userId, paymentId) {
      const vorhanden = zuZahlung.get(paymentId);
      if (vorhanden) { const r = rechnungen.get(vorhanden); if (r.user_id === userId || istModerator(userId)) return ausgabe(r); }
      const p = payments.zahlung(paymentId);
      if (!p || p.user_id !== userId) throw new AppError('payment_not_found', 'Zahlung nicht gefunden.', 404);
      if (p.status !== 'paid') throw new AppError('rechnung_unbezahlt', 'Eine Rechnung gibt es für bestätigte Zahlungen.', 409);
      if (!rechnungMoeglich()) throw new AppError('rechnung_aus', 'Rechnungen sind noch nicht eingerichtet (Angaben des Betreibers fehlen).', 409);
      return ausgabe(ausstellen(p, brauchtAngaben(userId)));
    },

    rechnung(userId, nummer) {
      const r = rechnungen.get(String(nummer));
      if (!r || (r.user_id !== userId && !istModerator(userId))) throw new AppError('rechnung_fehlt', 'Rechnung nicht gefunden.', 404);
      return ausgabe(r);
    },

    /** Übersicht: ausgestellte Rechnungen + bezahlte Tarif-Zahlungen ohne Rechnung. */
    meine(userId) {
      const liste = [...rechnungen.values()].filter((r) => r.user_id === userId).sort((a, b) => b.nummer.localeCompare(a.nummer)).map(ausgabe);
      const ohne = payments.zahlungenVon(userId)
        .filter((p) => p.status === 'paid' && produkt(p.product_id) && !zuZahlung.has(p.id))
        .map((p) => ({ payment_id: p.id, produkt: produkt(p.product_id).name, betrag_cents: p.amount_cents, waehrung: p.currency, bezahlt_am: p.paid_at || null }));
      return { rechnungen: liste, ohne_rechnung: ohne };
    },

    /** Nummer zu einer Zahlung (für die Prüfliste der Redaktion). */
    nummerZu: (paymentId) => zuZahlung.get(paymentId) || null,

    nutzerEntfernen(userId) {
      // Rechnungen sind Buchungsbelege mit Aufbewahrungspflicht (DE § 147 AO,
      // AT § 132 BAO) — sie bleiben. Gelöscht werden nur die Angaben für künftige Rechnungen.
      angaben.delete(userId);
    },

    __dump() { return { angaben: [...angaben], rechnungen: [...rechnungen.values()] }; },
    __load(d) {
      angaben.clear(); rechnungen.clear(); zuZahlung.clear();
      for (const [u, a] of (d && d.angaben) || []) angaben.set(u, a);
      for (const r of (d && d.rechnungen) || []) { rechnungen.set(r.nummer, r); zuZahlung.set(r.payment_id, r.nummer); }
    },
  };
}
