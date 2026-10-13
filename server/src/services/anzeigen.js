// ============================================================================
//  Anzeigen für Unternehmen der Branche (Pharma, Großhandel, Logistik)
// ============================================================================
//  Ablauf einer Kampagne:
//
//    entwurf ──einreichen──▶ zur_pruefung ──freigeben──▶ freigegeben
//       ▲                        │                            │ Zahlung (Krypto bestätigt
//       └──── bearbeiten ◀── abgelehnt (mit Grund)            ▼  oder Überweisung verbucht)
//                                                          bezahlt ─▶ läuft im Zeitraum
//
//  Erst prüfen, DANN zahlen: Niemand soll für eine Anzeige zahlen, die nicht
//  erscheinen darf. Pausieren kann die Werbekundin und — als Notbremse — die
//  Redaktion.
//
//  Regeln (konservativ, kein Rechtsrat — siehe docs/WERBUNG.md):
//   1. KENNZEICHNUNG: Jede Auslieferung trägt Firma und die Angaben für
//      „Warum sehe ich das?" (wer zahlt, nach welchen Merkmalen ausgewählt).
//   2. RX NUR FÜR FACHKREISE: Werbung für ein verschreibungspflichtiges oder
//      nicht eindeutig gekennzeichnetes Arzneimittel geht nur an verifizierte
//      Fachkreise (domain/jurisdiction.js). Privatpersonen sieht sie nie —
//      auch wenn die Buchung sie auswählt; die Buchung wird dann abgelehnt.
//   3. PFLICHTANGABEN: Arzneimittelwerbung ohne Pflichtangaben wird nicht
//      angenommen. Ob sie inhaltlich stimmen, prüft die Redaktion.
//   4. NUR https-ZIELE, keine Zugangsdaten im Link.
//   5. ZAHLEN SIND ECHT: Impressionen und Klicks werden beim Ausliefern und
//      beim Klick gezählt, nicht geschätzt. Klicks nur mit gültigem Zeichen
//      (einmal je Person, Anzeige und Tag) — eine Konkurrentin kann die
//      Klickzahl nicht hochtreiben, und der Link funktioniert trotzdem.
//   6. FREQUENZ: höchstens MAX_AM_TAG Einblendungen je Person und Anzeige am
//      Tag; wer eine Anzeige ausblendet, sieht sie nicht wieder.
// ============================================================================

import { cleanImage } from '../domain/media.js';
import { ZIELGRUPPEN, WERBEKUNDEN_TYPEN } from '../data/werbeplaetze.js';

const TAG = 86400000;
export const MAX_AM_TAG = 3;
const isoTag = (ms) => new Date(ms).toISOString().slice(0, 10);

function fehler(code, text, status = 400) { const e = new Error(text); e.code = code; e.status = status; return e; }

/** Ziel-Link: nur https, keine Zugangsdaten. */
export function zielLinkFehler(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch { return 'Bitte eine vollständige Adresse angeben (https://…).'; }
  if (u.protocol !== 'https:') return 'Nur https-Adressen.';
  if (u.username || u.password) return 'Keine Zugangsdaten in der Adresse.';
  return null;
}

export function createAnzeigen({
  jetzt = () => Date.now(), plaetze, profilVon = () => null, rxErlaubtFuer = () => false,
  istModerator = () => false, moderatoren = () => [], benachrichtige = () => {},
  betreiber = {}, klickZeichen = null,
} = {}) {
  const kampagnen = new Map();   // id -> Kampagne
  const kunden = new Map();      // userId -> Firmenangaben
  const gesehen = new Map();     // `${tag}|${uid}|${id}` -> Anzahl Einblendungen
  const geklickt = new Set();    // `${tag}|${uid}|${id}`
  const ausgeblendet = new Map(); // uid -> Set(id)
  let zaehler = 0; let rechnungsNr = 0;

  const melde = (o) => { try { benachrichtige(o); } catch { /* eine Glocke hält nichts auf */ } };
  const heute = () => isoTag(jetzt());
  const kopie = (k) => (k ? JSON.parse(JSON.stringify(k)) : null);
  const ueberweisungMoeglich = () => !!(betreiber.firma && betreiber.anschrift && betreiber.iban);

  function eigene(userId, id) {
    const k = kampagnen.get(String(id));
    if (!k || k.user_id !== userId) throw fehler('anzeige_nicht_gefunden', 'Anzeige nicht gefunden.', 404);
    return k;
  }
  function nurModeration(uid) { if (!istModerator(uid)) throw fehler('forbidden', 'Nur Redaktion.', 403); }

  /** Laufzeit-Zustand aus gespeichertem Status + Datum. */
  function zustand(k, tag = heute()) {
    if (k.status !== 'bezahlt') return k.status;
    if (k.pausiert) return 'pausiert';
    if (tag < k.start) return 'geplant';
    if (tag > k.ende) return 'beendet';
    return 'laeuft';
  }

  function preis({ platz, laender, wochen }) {
    const p = plaetze[platz];
    return p ? p.preis_woche_cents * laender.length * wochen : 0;
  }

  /** Eingaben prüfen und normalisieren. Wirft mit verständlichem Grund. */
  function pruefe(e) {
    const titel = String(e.titel || '').trim();
    const text = String(e.text || '').trim();
    if (titel.length < 3 || titel.length > 70) throw fehler('anzeige_titel', 'Überschrift: 3 bis 70 Zeichen.');
    if (text.length < 10 || text.length > 280) throw fehler('anzeige_text', 'Text: 10 bis 280 Zeichen.');
    const lf = zielLinkFehler(e.link);
    if (lf) throw fehler('anzeige_link', lf);
    if (!plaetze[e.platz]) throw fehler('anzeige_platz', 'Bitte einen Werbeplatz wählen.');
    const laender = [...new Set((Array.isArray(e.laender) ? e.laender : []).map((l) => String(l).toUpperCase()).filter((l) => /^[A-Z]{2}$/.test(l)))];
    if (!laender.length) throw fehler('anzeige_laender', 'Mindestens ein Land wählen.');
    const zielgruppen = [...new Set((Array.isArray(e.zielgruppen) ? e.zielgruppen : []).filter((z) => ZIELGRUPPEN.includes(z)))];
    if (!zielgruppen.length) throw fehler('anzeige_zielgruppen', 'Mindestens eine Berufsgruppe wählen.');
    const wochen = Math.round(Number(e.wochen));
    if (!(wochen >= 1 && wochen <= 52)) throw fehler('anzeige_wochen', 'Laufzeit: 1 bis 52 Wochen.');
    const start = String(e.start || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < heute()) throw fehler('anzeige_start', 'Startdatum: heute oder später.');
    const art = e.art === 'arzneimittel' ? 'arzneimittel' : 'unternehmen';
    let rx = null; let pflichtangaben = null;
    if (art === 'arzneimittel') {
      // „unbestimmt" zählt wie verschreibungspflichtig (fail closed).
      rx = e.rx === false || e.rx === 'otc' ? false : true;
      pflichtangaben = String(e.pflichtangaben || '').trim();
      if (pflichtangaben.length < 40) throw fehler('anzeige_pflichtangaben', 'Arzneimittelwerbung braucht die Pflichtangaben (Bezeichnung, Zusammensetzung, Anwendungsgebiete, Gegenanzeigen, Nebenwirkungen, Warnhinweise, Verschreibungspflicht, Zulassungsinhaber).');
      if (pflichtangaben.length > 3000) throw fehler('anzeige_pflichtangaben', 'Pflichtangaben: höchstens 3000 Zeichen.');
      if (rx && zielgruppen.includes('private')) throw fehler('anzeige_rx_publikum', 'Werbung für verschreibungspflichtige Arzneimittel ist an Privatpersonen nicht zulässig. Bitte „Privatpersonen" abwählen.');
    }
    const bild = e.bild ? cleanImage(e.bild) : null;
    const cta = String(e.cta || '').trim().slice(0, 24) || null;
    const ende = isoTag(Date.parse(start + 'T12:00:00Z') + (wochen * 7 - 1) * TAG);
    return { titel, text, link: String(e.link).trim(), platz: e.platz, laender, zielgruppen, wochen, start, ende, art, rx, pflichtangaben, bild, cta };
  }

  function ausgabe(k) {
    const o = kopie(k);
    o.zustand = zustand(k);
    o.impressionen = Object.values(k.stats.imp).reduce((s, n) => s + n, 0);
    o.klicks = Object.values(k.stats.klick).reduce((s, n) => s + n, 0);
    return o;
  }

  return {
    ueberweisungMoeglich,
    plaetze: () => Object.values(plaetze).map((p) => ({ ...p })),
    preis,

    // ── Werbekunde ────────────────────────────────────────────────────────
    firmaSetzen(userId, f) {
      const prof = profilVon(userId);
      if (!prof || !WERBEKUNDEN_TYPEN.includes(prof.account_type)) {
        throw fehler('werbekunde_typ', 'Werben können Unternehmen der Branche (Pharma, Großhandel, Logistik, Apotheken). Bitte den Kontotyp im Profil anpassen.', 403);
      }
      const pflicht = ['firma', 'strasse', 'plz', 'ort', 'land', 'email'];
      const d = {};
      for (const k of [...pflicht, 'ust_id', 'ansprechpartner']) d[k] = String((f && f[k]) || '').trim().slice(0, 160);
      for (const k of pflicht) if (!d[k]) throw fehler('werbekunde_angaben', 'Bitte Firma, Anschrift, Land und Rechnungs-E-Mail angeben.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw fehler('werbekunde_email', 'Bitte eine gültige Rechnungs-E-Mail angeben.');
      d.land = d.land.toUpperCase().slice(0, 2);
      kunden.set(userId, d);
      return { ...d };
    },
    firma(userId) { const d = kunden.get(userId); return d ? { ...d } : null; },

    // ── Kampagnen ─────────────────────────────────────────────────────────
    anlegen(userId, eingabe) {
      if (!kunden.has(userId)) throw fehler('werbekunde_fehlt', 'Bitte zuerst die Firmen- und Rechnungsangaben ausfüllen.');
      const d = pruefe(eingabe);
      const id = 'k' + (++zaehler).toString(36) + Math.random().toString(36).slice(2, 6);
      const k = { id, user_id: userId, status: 'entwurf', ...d, preis_cents: preis(d), waehrung: 'EUR', erstellt: new Date(jetzt()).toISOString(),
        pruefung: null, zahlung: null, rechnung: null, pausiert: false, stats: { imp: {}, klick: {}, typ: {} } };
      kampagnen.set(id, k);
      return ausgabe(k);
    },
    bearbeiten(userId, id, eingabe) {
      const k = eigene(userId, id);
      if (!['entwurf', 'abgelehnt'].includes(k.status)) throw fehler('anzeige_gesperrt', 'Nach dem Einreichen lässt sich die Anzeige nicht mehr ändern.', 409);
      const d = pruefe(eingabe);
      Object.assign(k, d, { preis_cents: preis(d), status: 'entwurf' });
      return ausgabe(k);
    },
    einreichen(userId, id) {
      const k = eigene(userId, id);
      if (!['entwurf', 'abgelehnt'].includes(k.status)) throw fehler('anzeige_status', 'Diese Anzeige ist schon eingereicht.', 409);
      if (k.start < heute()) throw fehler('anzeige_start', 'Das Startdatum liegt in der Vergangenheit — bitte anpassen.');
      k.status = 'zur_pruefung'; k.eingereicht = new Date(jetzt()).toISOString();
      for (const m of moderatoren() || []) melde({ userId: m, type: 'anzeige_pruefen', actorUserId: userId, refType: 'anzeige', refId: id, label: k.titel });
      return ausgabe(k);
    },
    meine(userId) { return [...kampagnen.values()].filter((k) => k.user_id === userId).map(ausgabe).sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1)); },
    eine(userId, id) { return ausgabe(eigene(userId, id)); },
    pausieren(userId, id, an = true) {
      const k = kampagnen.get(String(id));
      if (!k || (k.user_id !== userId && !istModerator(userId))) throw fehler('anzeige_nicht_gefunden', 'Anzeige nicht gefunden.', 404);
      k.pausiert = !!an;
      return ausgabe(k);
    },

    /** Tagesstatistik für das Cockpit: [{ tag, impressionen, klicks }] + je Berufsgruppe. */
    statistik(userId, id) {
      const k = eigene(userId, id);
      const tage = [...new Set([...Object.keys(k.stats.imp), ...Object.keys(k.stats.klick)])].sort();
      return { id: k.id, tage: tage.map((t) => ({ tag: t, impressionen: k.stats.imp[t] || 0, klicks: k.stats.klick[t] || 0 })), je_gruppe: { ...k.stats.typ } };
    },

    // ── Redaktion ─────────────────────────────────────────────────────────
    zurPruefung(modId) { nurModeration(modId); return [...kampagnen.values()].filter((k) => k.status === 'zur_pruefung').map((k) => ({ ...ausgabe(k), firma: kunden.get(k.user_id) || null })); },
    alleLaufenden(modId) { nurModeration(modId); return [...kampagnen.values()].filter((k) => k.status === 'bezahlt' || k.status === 'freigegeben').map((k) => ({ ...ausgabe(k), firma: kunden.get(k.user_id) || null })); },
    freigeben(modId, id) {
      nurModeration(modId);
      const k = kampagnen.get(String(id));
      if (!k || k.status !== 'zur_pruefung') throw fehler('anzeige_status', 'Nur eingereichte Anzeigen lassen sich freigeben.', 409);
      k.status = 'freigegeben'; k.pruefung = { von: modId, am: new Date(jetzt()).toISOString(), ergebnis: 'frei' };
      melde({ userId: k.user_id, type: 'anzeige_freigegeben', actorUserId: modId, refType: 'anzeige', refId: k.id, label: k.titel });
      return ausgabe(k);
    },
    ablehnen(modId, id, grund) {
      nurModeration(modId);
      const k = kampagnen.get(String(id));
      if (!k || k.status !== 'zur_pruefung') throw fehler('anzeige_status', 'Nur eingereichte Anzeigen lassen sich ablehnen.', 409);
      const g = String(grund || '').trim().slice(0, 500);
      if (!g) throw fehler('anzeige_grund', 'Bitte einen Grund angeben — die Werbekundin bekommt ihn mitgeteilt.');
      k.status = 'abgelehnt'; k.pruefung = { von: modId, am: new Date(jetzt()).toISOString(), ergebnis: 'abgelehnt', grund: g };
      melde({ userId: k.user_id, type: 'anzeige_abgelehnt', actorUserId: modId, refType: 'anzeige', refId: k.id, label: k.titel });
      return ausgabe(k);
    },

    // ── Zahlung ───────────────────────────────────────────────────────────
    /** Rechnung für Überweisung ausstellen (nur wenn Betreiberangaben vollständig). */
    rechnungAusstellen(userId, id) {
      const k = eigene(userId, id);
      if (k.status !== 'freigegeben') throw fehler('anzeige_status', 'Bezahlen lässt sich eine freigegebene Anzeige.', 409);
      if (!ueberweisungMoeglich()) throw fehler('ueberweisung_aus', 'Zahlung per Rechnung ist noch nicht eingerichtet.', 409);
      if (!k.rechnung) {
        const jahr = new Date(jetzt()).getUTCFullYear();
        k.rechnung = { nummer: `AP-${jahr}-${String(++rechnungsNr).padStart(4, '0')}`, datum: heute() };
      }
      k.zahlung = { methode: 'ueberweisung', offen: true };
      return { ...ausgabe(k), rechnung: this.rechnung(userId, id) };
    },
    /** Rechnungsdaten (Anzeige als druckbare Seite im Browser). */
    rechnung(userId, id) {
      const k = kampagnen.get(String(id));
      if (!k || (k.user_id !== userId && !istModerator(userId)) || !k.rechnung) throw fehler('rechnung_fehlt', 'Keine Rechnung vorhanden.', 404);
      const satz = Number(betreiber.ust_satz) || 0;
      const ust = Math.round(k.preis_cents * satz / 100);
      return {
        nummer: k.rechnung.nummer, datum: k.rechnung.datum,
        aussteller: { firma: betreiber.firma, anschrift: betreiber.anschrift, ust_id: betreiber.ust_id || null, iban: betreiber.iban, bic: betreiber.bic || null, inhaber: betreiber.inhaber || betreiber.firma },
        empfaenger: kunden.get(k.user_id) || null,
        leistung: { titel: k.titel, platz: k.platz, laender: k.laender, wochen: k.wochen, start: k.start, ende: k.ende },
        netto_cents: k.preis_cents, ust_satz: satz, ust_cents: ust, brutto_cents: k.preis_cents + ust, waehrung: k.waehrung,
        bezahlt: k.status === 'bezahlt',
      };
    },
    /** Zahlungseingang (Krypto bestätigt oder Überweisung verbucht) -> Kampagne bezahlt. */
    bezahlt(id, { methode, payment_id = null, von = null } = {}) {
      const k = kampagnen.get(String(id));
      if (!k || k.status !== 'freigegeben') return null;
      k.status = 'bezahlt'; k.zahlung = { methode, payment_id, am: new Date(jetzt()).toISOString(), von };
      melde({ userId: k.user_id, type: 'anzeige_bezahlt', refType: 'anzeige', refId: k.id, label: k.titel });
      return ausgabe(k);
    },
    ueberweisungVerbuchen(modId, id) {
      nurModeration(modId);
      const k = kampagnen.get(String(id));
      if (!k || k.status !== 'freigegeben' || !k.rechnung) throw fehler('anzeige_status', 'Keine offene Rechnung zu dieser Anzeige.', 409);
      return this.bezahlt(id, { methode: 'ueberweisung', von: modId });
    },
    kampagneFuerZahlung(userId, id) {
      const k = eigene(userId, id);
      if (k.status !== 'freigegeben') throw fehler('anzeige_status', 'Bezahlen lässt sich eine freigegebene Anzeige.', 409);
      return { id: k.id, betrag_cents: k.preis_cents, waehrung: k.waehrung, name: `Anzeige „${k.titel}"` };
    },

    // ── Auslieferung ──────────────────────────────────────────────────────
    /**
     * Eine Anzeige für diesen Platz und diese Person — oder null.
     * Zählt die Einblendung. Faire Rotation: die Kampagne mit den wenigsten
     * Einblendungen heute zuerst.
     */
    ausliefern(uid, platz) {
      const prof = profilVon(uid);
      if (!prof) return null;
      const land = String(prof.country || '').toUpperCase();
      const tag = heute();
      const weg = ausgeblendet.get(uid) || new Set();
      const kandidaten = [...kampagnen.values()].filter((k) => k.platz === platz && zustand(k, tag) === 'laeuft'
        && k.user_id !== uid && k.laender.includes(land) && k.zielgruppen.includes(prof.account_type) && !weg.has(k.id)
        && (gesehen.get(`${tag}|${uid}|${k.id}`) || 0) < MAX_AM_TAG
        // Regel 2: Arzneimittelwerbung (Rx oder unbestimmt) nur an verifizierte Fachkreise.
        && !(k.art === 'arzneimittel' && k.rx !== false && !rxErlaubtFuer(uid)));
      if (!kandidaten.length) return null;
      kandidaten.sort((a, b) => (a.stats.imp[tag] || 0) - (b.stats.imp[tag] || 0));
      const k = kandidaten[0];
      const sk = `${tag}|${uid}|${k.id}`;
      gesehen.set(sk, (gesehen.get(sk) || 0) + 1);
      k.stats.imp[tag] = (k.stats.imp[tag] || 0) + 1;
      k.stats.typ[prof.account_type] = (k.stats.typ[prof.account_type] || 0) + 1;
      const firma = kunden.get(k.user_id) || {};
      return {
        id: k.id, platz: k.platz, titel: k.titel, text: k.text, bild: k.bild, cta: k.cta,
        firma: firma.firma || null,
        pflichtangaben: k.pflichtangaben, art: k.art, rx: k.rx,
        klick: klickZeichen ? `/api/anzeigen/${k.id}/klick?z=${encodeURIComponent(klickZeichen.ausstellen(uid, k.id, tag))}` : null,
        // Regel 1: „Warum sehe ich das?"
        warum: { firma: firma.firma || null, bezahlt_von: firma.firma || null, laender: k.laender, zielgruppen: k.zielgruppen, nur_fachkreise: k.art === 'arzneimittel' && k.rx !== false },
      };
    },
    /** Klick: zählt nur mit gültigem Zeichen, einmal je Person/Anzeige/Tag. Liefert das Ziel. */
    klick(id, zeichen) {
      const k = kampagnen.get(String(id));
      if (!k) return null;
      const z = klickZeichen && zeichen ? klickZeichen.pruefen(zeichen, k.id) : null;
      if (z) {
        const sk = `${z.tag}|${z.uid}|${k.id}`;
        if (!geklickt.has(sk)) { geklickt.add(sk); k.stats.klick[z.tag] = (k.stats.klick[z.tag] || 0) + 1; }
      }
      return k.link;
    },
    ausblenden(uid, id) {
      if (!ausgeblendet.has(uid)) ausgeblendet.set(uid, new Set());
      ausgeblendet.get(uid).add(String(id));
      return { ok: true };
    },
    melden(uid, id, grund) {
      const k = kampagnen.get(String(id));
      if (!k) throw fehler('anzeige_nicht_gefunden', 'Anzeige nicht gefunden.', 404);
      const g = String(grund || '').trim().slice(0, 300) || 'ohne Angabe';
      for (const m of moderatoren() || []) melde({ userId: m, type: 'anzeige_gemeldet', actorUserId: uid, refType: 'anzeige', refId: k.id, label: `${k.titel} · ${g}` });
      this.ausblenden(uid, id);
      return { ok: true };
    },

    __dump() {
      return { zaehler, rechnungsNr, kampagnen: [...kampagnen.values()], kunden: [...kunden], ausgeblendet: [...ausgeblendet].map(([u, s]) => [u, [...s]]) };
    },
    __load(d) {
      kampagnen.clear(); kunden.clear(); ausgeblendet.clear(); gesehen.clear(); geklickt.clear();
      if (!d) return;
      zaehler = Number(d.zaehler) || 0; rechnungsNr = Number(d.rechnungsNr) || 0;
      for (const k of d.kampagnen || []) if (k && k.id) kampagnen.set(k.id, k);
      for (const [u, f] of d.kunden || []) kunden.set(u, f);
      for (const [u, s] of d.ausgeblendet || []) ausgeblendet.set(u, new Set(s));
    },
  };
}
