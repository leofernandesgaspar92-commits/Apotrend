// @ts-check
// ============================================================================
//  Beschaffung international: Einstandskosten, Ankunft, Proforma-Anfrage
// ============================================================================
//  Für B2B-Käufer (Apotheke, Klinik, Großhandel), die z. B. in Indien bestellen.
//
//  EHRLICHKEITSREGELN — warum der Rechner nichts selbst schätzt:
//   • Fracht, Versicherung und Zollsatz hängen an Ware, Gewicht, Incoterm und
//     Zolltarifnummer. Eine freie, verlässliche Quelle dafür gibt es nicht. Ein
//     geschätzter Pauschalwert sähe aus wie ein Angebot und wäre keines. Deshalb
//     trägt die Fachperson ein, was ihr Spediteur/Lieferant nennt; der Rechner
//     rechnet sauber und nennt die Zoll-BASIS richtig (CIF oder FOB je Zielland).
//   • Ankunft = heute + Transitzeit laut Spediteur. Dazu, wo vorhanden, echte
//     Hafensignale (Open-Meteo, AISStream) als HINWEIS, nicht als Prognose.
//   • Umrechnung über die bestehenden Kurse (EZB/Frankfurter vor open.er-api) —
//     fehlt ein Kurs, sagt der Rechner das, statt mit 1 zu rechnen.
//  Die Einfuhr von Arzneimitteln braucht im Zielland Zulassung/Einfuhrerlaubnis;
//  ApoPulse vermittelt nur die Anfrage.
// ============================================================================
import { AppError } from '../domain/errors.js';

/** Zielländer, deren Zollwert auf FOB beruht (Transaktionswert ohne internationale Fracht). */
export const FOB_LAENDER = new Set(['US', 'CA', 'AU', 'NZ']);
/** Seehafen, über den ein Land überwiegend beliefert wird (nur wo eindeutig; HAEFEN in extern/wetter.js). */
export const HAFEN_FUER_LAND = { KE: 'mombasa', UG: 'mombasa', GH: 'tema', NG: 'lagos', ZA: 'durban', LS: 'durban', SZ: 'durban', AT: 'koper', SI: 'koper', NL: 'rotterdam' };
export const TRANSPORTARTEN = ['see', 'luft'];
export const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'];
export const ANFRAGE_STATUS = ['neu', 'in_bearbeitung', 'beantwortet', 'abgelehnt']; // setzt das Handelsteam
/** Setzt nur, wer angefragt hat — solange die Anfrage offen ist. */
export const ZURUECKGEZOGEN = 'zurueckgezogen';
export const OFFENE_STATUS = ['neu', 'in_bearbeitung'];

const zahl = (v, feld, { max = 1e12 } = {}) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new AppError('sourcing_zahl', `Ungültige Zahl: ${feld}.`, 400);
  return n;
};
const runde = (n) => Math.round(n * 100) / 100;
const iso = (w) => { const s = String(w || '').trim().toUpperCase(); return /^[A-Z]{3}$/.test(s) ? s : null; };

/**
 * Einstandskosten (Landed Cost). Alle Beträge werden in `zielWaehrung` umgerechnet.
 * @param {object} e  Eingaben der Fachperson
 * @param {{ convert: (a: number, von: string, nach: string, d?: any) => number|null }} fx
 * @param {any} kurse  Kurs-Stand (fxRates.rates())
 */
export function einstandskosten(e, fx, kurse) {
  const ziel = String(e.zielLand || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(ziel)) throw new AppError('sourcing_ziel', 'Bitte das Zielland wählen.', 400);
  const zielW = iso(e.zielWaehrung), warenW = iso(e.waehrung) || 'USD', frachtW = iso(e.frachtWaehrung) || warenW;
  if (!zielW) throw new AppError('sourcing_waehrung', 'Bitte die Zielwährung wählen.', 400);
  const ware = zahl(e.warenwert, 'Warenwert');
  if (!(ware > 0)) throw new AppError('sourcing_warenwert', 'Bitte den Warenwert laut Angebot eintragen.', 400);
  const fracht = zahl(e.fracht, 'Fracht');
  const versPct = zahl(e.versicherungPct, 'Versicherung %', { max: 100 });
  const zollPct = zahl(e.zollPct, 'Zollsatz %', { max: 1000 });
  const mwstPct = zahl(e.mwstPct, 'Einfuhrumsatzsteuer %', { max: 100 });
  const gebuehren = zahl(e.gebuehren, 'Gebühren');
  const menge = Math.floor(zahl(e.menge, 'Menge', { max: 1e9 })) || 1;
  if (!kurse || !kurse.rates) throw new AppError('kurs_fehlt', 'Wechselkurse gerade nicht verfügbar — bitte später erneut versuchen.', 503);
  const um = (betrag, von) => {
    if (!betrag) return 0;
    const r = von === zielW ? betrag : fx.convert(betrag, von, zielW, kurse);
    if (r == null) throw new AppError('kurs_fehlt', `Kein Kurs für ${von} → ${zielW}.`, 422);
    return r;
  };
  const wareZ = um(ware, warenW), frachtZ = um(fracht, frachtW), gebZ = um(gebuehren, zielW);
  const versicherung = (wareZ + frachtZ) * versPct / 100;
  const cif = wareZ + frachtZ + versicherung;
  const basisArt = e.zollBasis === 'FOB' || e.zollBasis === 'CIF' ? e.zollBasis : (FOB_LAENDER.has(ziel) ? 'FOB' : 'CIF');
  const zollBasis = basisArt === 'FOB' ? wareZ : cif;
  const zoll = zollBasis * zollPct / 100;
  const mwst = (cif + zoll) * mwstPct / 100; // Einfuhrumsatzsteuer: üblich auf Zollwert + Zoll
  const gesamt = cif + zoll + mwst + gebZ;
  const quelleVon = (w) => (kurse.quellen && kurse.quellen[w]) || kurse.quelle || null;
  return {
    waehrung: zielW, menge, zoll_basis: basisArt,
    posten: [
      { art: 'ware', betrag: runde(wareZ) },
      { art: 'fracht', betrag: runde(frachtZ) },
      { art: 'versicherung', betrag: runde(versicherung) },
      { art: 'zoll', betrag: runde(zoll), basis: basisArt, satz: zollPct },
      { art: 'mwst', betrag: runde(mwst), satz: mwstPct },
      { art: 'gebuehren', betrag: runde(gebZ) },
    ],
    cif: runde(cif), gesamt: runde(gesamt), je_einheit: runde(gesamt / menge),
    kurse: { stand: kurse.updated_at || null, veraltet: !!kurse.veraltet, quellen: [...new Set([warenW, frachtW, zielW].map(quelleVon).filter(Boolean))] },
  };
}

/** Ankunft = Abfahrt + Transitzeit laut Spediteur (Kalendertage). */
export function ankunft({ transitTage, ab }) {
  const t = Math.floor(zahl(transitTage, 'Transitzeit', { max: 365 }));
  if (!t) return null;
  const start = ab && /^\d{4}-\d{2}-\d{2}$/.test(ab) ? Date.parse(ab + 'T00:00:00Z') : Date.now();
  return new Date(start + t * 86_400_000).toISOString().slice(0, 10);
}

// ── Proforma-/Angebotsanfragen ───────────────────────────────────────────────
//  Gehen an den Handelsarm (Redaktion/Handel im Cockpit) — dort wird an
//  verifizierte Großhändler weitervermittelt. Wer anfragt, sieht den Status.
export function createSourcingAnfragen({ jetzt = () => Date.now() } = {}) {
  /** @type {Map<string, any>} */
  const anfragen = new Map();
  let nr = 0;
  // Einzeilige Felder ohne Steuerzeichen (landen u. a. im E-Mail-Betreff); die Notiz behält Zeilenumbrüche.
  const text = (v, max, zeilen = false) => String(v ?? '').replace(zeilen ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  return {
    erstellen(userId, b = {}) {
      const produkt = text(b.produkt, 160);
      if (produkt.length < 2) throw new AppError('sourcing_produkt', 'Bitte Präparat bzw. Wirkstoff angeben.', 400);
      const menge = text(b.menge, 60);
      if (!menge) throw new AppError('sourcing_menge', 'Bitte die Menge angeben (z. B. 10.000 Tabletten).', 400);
      const herkunft = String(b.herkunft || '').toUpperCase(), ziel = String(b.ziel || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(herkunft) || !/^[A-Z]{2}$/.test(ziel)) throw new AppError('sourcing_land', 'Bitte Herkunfts- und Zielland wählen.', 400);
      const incoterm = INCOTERMS.includes(String(b.incoterm || '').toUpperCase()) ? String(b.incoterm).toUpperCase() : null;
      const offen = [...anfragen.values()].filter((a) => a.userId === userId && a.status === 'neu').length;
      if (offen >= 20) throw new AppError('sourcing_zu_viele', 'Sie haben schon 20 offene Anfragen. Bitte warten Sie auf Antworten.', 429);
      const id = `pf${(jetzt()).toString(36)}${(++nr).toString(36)}`;
      const a = { id, userId, produkt, menge, herkunft, ziel, incoterm, transport: TRANSPORTARTEN.includes(b.transport) ? b.transport : null,
        notiz: text(b.notiz, 1000, true) || null, status: 'neu', antwort: null, erstellt: new Date(jetzt()).toISOString(), aktualisiert: null };
      anfragen.set(id, a);
      return { ...a };
    },
    meine(userId) { return [...anfragen.values()].filter((a) => a.userId === userId).sort((x, y) => (x.erstellt < y.erstellt ? 1 : -1)).map((a) => ({ ...a })); },
    // Offene zuerst, darin die neuesten oben.
    alle() { return [...anfragen.values()].sort((x, y) => Number(y.status === 'neu') - Number(x.status === 'neu') || (x.erstellt < y.erstellt ? 1 : -1)).map((a) => ({ ...a })); },
    status(id, status, antwort) {
      const a = anfragen.get(id);
      if (!a) throw new AppError('sourcing_unbekannt', 'Anfrage nicht gefunden.', 404);
      if (!ANFRAGE_STATUS.includes(status)) throw new AppError('sourcing_status', 'Unbekannter Status.', 400);
      if (a.status === ZURUECKGEZOGEN) throw new AppError('sourcing_zurueckgezogen', 'Diese Anfrage wurde vom Betrieb zurückgezogen.', 409);
      const neu = text(antwort, 1000, true) || a.antwort;
      // „Beantwortet" ohne Text hieß für die Apotheke: Benachrichtigung „beantwortet" — und nichts zu lesen.
      // Bei „Abgelehnt" braucht sie den Grund, um anders zu bestellen.
      if ((status === 'beantwortet' || status === 'abgelehnt') && !neu) throw new AppError('sourcing_antwort_fehlt', 'Bitte die Antwort bzw. den Grund eintragen — die anfragende Stelle sieht sonst nur den Status.', 400);
      a.status = status; a.antwort = neu; a.aktualisiert = new Date(jetzt()).toISOString();
      return { ...a };
    },
    /** Eigene, noch offene Anfrage zurückziehen (z. B. anderweitig beschafft). */
    zurueckziehen(userId, id) {
      const a = anfragen.get(id);
      if (!a || a.userId !== userId) throw new AppError('sourcing_unbekannt', 'Anfrage nicht gefunden.', 404);
      if (!OFFENE_STATUS.includes(a.status)) throw new AppError('sourcing_abgeschlossen', 'Diese Anfrage ist schon abgeschlossen.', 409);
      a.status = ZURUECKGEZOGEN; a.aktualisiert = new Date(jetzt()).toISOString();
      return { ...a };
    },
    get: (id) => (anfragen.has(id) ? { ...anfragen.get(id) } : null),
    /** DSGVO: alle Anfragen des Kontos löschen (Freitext-Notiz, Betrieb, Menge). */
    nutzerEntfernen(userId) { for (const [id, a] of anfragen) if (a.userId === userId) anfragen.delete(id); },
    __dump: () => [...anfragen.values()],
    __load(liste) {
      anfragen.clear();
      for (const a of Array.isArray(liste) ? liste : []) if (a && typeof a.id === 'string' && typeof a.userId === 'string') anfragen.set(a.id, a);
    },
  };
}
