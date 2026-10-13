// ============================================================================
//  Sortiments-Check: „Was davon betrifft MICH?"
// ============================================================================
//  Eine Apotheke führt hunderte Wirkstoffe, ein Großhandel tausende. Niemand
//  tippt sie einzeln in eine Suche. Hier wird die eigene Liste eingefügt (aus
//  der Warenwirtschaft kopiert, als CSV oder einfach Zeile für Zeile), und
//  jede Zeile bekommt eine Einordnung aus den Behördendaten:
//
//    knapp       — die Behörde des eigenen Landes führt ihn gerade als knapp
//    ausland     — anderswo amtlich knapp, hier (noch) nicht
//    wiederholt  — war hier schon knapp, gerade nicht
//    ruhig       — erkannt, in keiner beobachteten Liste aktuell knapp
//    unbekannt   — in keiner Behördenliste je gesehen (oder nicht erkannt)
//
//  Ehrlichkeitsregeln:
//   1. KEINE PROGNOSE. „ausland" ist eine Tatsache mit Quelle, keine Vorhersage.
//   2. „unbekannt" heißt nicht „sicher lieferbar": Wir kennen nur Namen, die je
//      in einer Behördenliste standen. Handelsnamen und PZN erkennen wir nur,
//      wenn der Wirkstoff in der Zeile steht. Das sagt die Antwort auch.
//   3. Geprüft wird nur gegen Länder, deren Liste wir mitschreiben — die
//      Antwort nennt sie (`laender`), damit niemand mehr Abdeckung annimmt.
//
//  Gratis: die ersten FREI_ZEILEN Zeilen — genug, um den Nutzen zu sehen.
//  Premium: bis MAX_ZEILEN Zeilen auf einmal, dazu Export und Beobachtung.
// ============================================================================

import { wirkstoffSchluessel } from '../domain/inn.js';

export const FREI_ZEILEN = 15;
export const MAX_ZEILEN = 500;
const MAX_TEXT = 200_000;
const AKTIV = new Set(['kritisch', 'eingeschraenkt']);
const RANG = { kritisch: 2, eingeschraenkt: 1 };

/** Text (eingefügt oder CSV) -> Zeilen. Bei CSV mit Wirkstoff-Spalte nur diese. */
export function zeilenAusText(text) {
  const roh = String(text || '').slice(0, MAX_TEXT).replace(/^﻿/, '');
  let zeilen = roh.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  // Eine einzige Zeile mit Kommas/Semikolons: „Amoxicillin, Ibuprofen, …"
  if (zeilen.length === 1 && /[,;]/.test(zeilen[0])) zeilen = zeilen[0].split(/[,;]/).map((z) => z.trim()).filter(Boolean);
  if (zeilen.length < 2) return zeilen;
  const trenner = [';', '\t', ','].find((t) => zeilen[0].split(t).length > 1 && zeilen[1].split(t).length === zeilen[0].split(t).length);
  if (!trenner) return zeilen;
  const kopf = zeilen[0].split(trenner).map((k) => k.trim().replace(/^"|"$/g, ''));
  const spalte = kopf.findIndex((k) => /wirkstoff|substan|active|ingredient|\binn\b|princ[ií]pio/i.test(k));
  const zellen = (z) => z.split(trenner).map((c) => c.trim().replace(/^"|"$/g, ''));
  if (spalte >= 0) return zeilen.slice(1).map((z) => zellen(z)[spalte] || '').filter(Boolean);
  // Ohne erkennbare Spalte: ganze Zeile (die Erkennung sucht den Wirkstoff darin).
  return zeilen.map((z) => zellen(z).join(' '));
}

export function createSortiment({ shortagesRepo, chronik, istPremium }) {
  /** Schlüssel -> angezeigter Name. Schreibweise des eigenen Landes bevorzugt. */
  function verzeichnis(land) {
    const v = new Map();
    const nimm = (name, eigenes) => {
      const k = wirkstoffSchluessel(name);
      if (!k) return;
      if (!v.has(k) || eigenes) v.set(k, String(name).trim());
    };
    for (const e of chronik.bekannteWirkstoffe()) nimm(e.wirkstoff, e.land === land);
    for (const z of shortagesRepo.list()) if (z.wirkstoff) nimm(z.wirkstoff, z.country === land);
    return v;
  }

  /**
   * Den Wirkstoff in einer Zeile finden: ganze Zeile, Text vor der Stärke,
   * dann Wortgruppen — LÄNGSTE zuerst. Beides schützt Kombinationen:
   * „Amoxicillin + Clavulansäure 875/125 mg" trifft über den Text vor der
   * Stärke, „Amoxicillin und Clavulansäure Pulver" über die Dreiergruppe.
   * Sonst fände das einzelne Wort „Amoxicillin" zuerst — und eine
   * Kombination zählte als Monopräparat.
   */
  function erkenne(zeile, v) {
    const versuche = [zeile, zeile.split(/\d/)[0]];
    const woerter = zeile.split(/[^\p{L}/-]+/u).filter((w) => w.length >= 3);
    for (let n = Math.min(3, woerter.length); n >= 1; n--) {
      for (let i = 0; i + n <= woerter.length; i++) versuche.push(woerter.slice(i, i + n).join(' '));
    }
    for (const x of versuche) {
      const k = wirkstoffSchluessel(x);
      if (k && v.has(k)) return k;
    }
    return null;
  }

  return {
    pruefen(userId, text, land) {
      const cc = String(land || '').toUpperCase();
      const premium = !!istPremium(userId);
      const alle = zeilenAusText(text);
      const grenze = premium ? MAX_ZEILEN : FREI_ZEILEN;
      const zuPruefen = alle.slice(0, grenze);
      const v = verzeichnis(cc);
      const hier = shortagesRepo.list({ country: cc }).filter((z) => AKTIV.has(z.status) && z.wirkstoff);
      const beobachtet = new Set(shortagesRepo.listWatch(userId).map((w) => wirkstoffSchluessel(w) || w.toLowerCase()));

      const gesehen = new Set();
      const ergebnisse = [];
      for (const zeile of zuPruefen) {
        const k = erkenne(zeile, v);
        if (k && gesehen.has(k)) continue; // dieselbe Substanz zweimal in der Liste
        if (k) gesehen.add(k);
        if (!k) { ergebnisse.push({ eingabe: zeile, einstufung: 'unbekannt' }); continue; }
        const name = v.get(k);
        const meldungen = hier.filter((z) => wirkstoffSchluessel(z.wirkstoff) === k)
          .sort((a, b) => (RANG[b.status] || 0) - (RANG[a.status] || 0));
        const verlauf = chronik.kurz(name, cc);
        const ausland = chronik.offenAnderswo(name, cc).map((a) => ({ land: a.land, seit_tagen: a.dauer_tage, quelle: a.quelle || null }));
        const m = meldungen[0];
        const einstufung = m ? 'knapp' : ausland.length ? 'ausland' : verlauf && verlauf.anzahl ? 'wiederholt' : 'ruhig';
        ergebnisse.push({
          eingabe: zeile, wirkstoff: name, einstufung,
          status: m ? m.status : null,
          quelle: m ? (m.quelle || null) : null,
          herkunft: m ? (m.provenance || null) : null, // verified = Behörde, community = Meldung aus Apotheken
          voraussichtlich_bis: m ? (m.voraussichtlich_bis || null) : null,
          praeparate: meldungen.length,
          seit_tagen: verlauf && verlauf.offen_seit_tagen != null ? verlauf.offen_seit_tagen : null,
          verlauf: verlauf ? { anzahl: verlauf.anzahl, durchschnitt_tage: verlauf.durchschnitt_tage } : null,
          ausland,
          beobachtet: beobachtet.has(k),
        });
      }
      const ordnung = { knapp: 0, ausland: 1, wiederholt: 2, ruhig: 3, unbekannt: 4 };
      ergebnisse.sort((a, b) => ordnung[a.einstufung] - ordnung[b.einstufung]
        || (RANG[b.status] || 0) - (RANG[a.status] || 0) || (b.ausland || []).length - (a.ausland || []).length);
      const zusammenfassung = { knapp: 0, ausland: 0, wiederholt: 0, ruhig: 0, unbekannt: 0 };
      for (const e of ergebnisse) zusammenfassung[e.einstufung]++;
      return {
        land: cc, premium,
        zeilen_gesamt: alle.length, geprueft: zuPruefen.length,
        gesperrt: Math.max(0, alle.length - grenze), grenze,
        zusammenfassung, ergebnisse,
        // Regel 3: gegen welche Behördenlisten überhaupt geprüft wurde.
        laender: chronik.beobachteteLaender(),
      };
    },
  };
}
