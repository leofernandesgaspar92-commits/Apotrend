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
//      in einer Behördenliste standen. Handelsnamen erkennen wir, wenn der
//      Wirkstoff in der Zeile steht ODER der Name in einer Meldung/Liste genau
//      einem Wirkstoff zugeordnet ist (dann mit Herkunft); PZN nie.
//   3. Geprüft wird nur gegen Länder, deren Liste wir mitschreiben — die
//      Antwort nennt sie (`laender`), damit niemand mehr Abdeckung annimmt.
//
//  Gratis: die ersten FREI_ZEILEN Zeilen — genug, um den Nutzen zu sehen.
//  Premium: bis MAX_ZEILEN Zeilen auf einmal, dazu Export und Beobachtung.
// ============================================================================

import { wirkstoffSchluessel } from '../domain/inn.js';
import { aktualitaet } from './shortages.js';
import { anzeigeName } from '../domain/anzeigename.js';

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
  // Export aus der Warenwirtschaft: „PZN;Artikel;Menge" — dann die Artikel-Spalte.
  const artikel = kopf.findIndex((k) => /artikel|bezeichnung|produkt|pr[aä]parat|arzneimittel|^name$|description|product|designa/i.test(k));
  if (artikel >= 0) return zeilen.slice(1).map((z) => zellen(z)[artikel] || '').filter(Boolean);
  // Ohne erkennbare Spalte: ganze Zeile ohne reine Zahlenfelder (PZN, Menge);
  // eine Kopfzeile ohne Ziffern fällt weg, wenn die übrigen Zeilen Ziffern haben.
  const ohneZahlen = (z) => zellen(z).filter((c) => !/^[\d.,\s]+$/.test(c)).join(' ');
  const kopfzeile = !/\d/.test(zeilen[0]) && zeilen.slice(1).filter((z) => /\d/.test(z)).length >= (zeilen.length - 1) / 2;
  return (kopfzeile ? zeilen.slice(1) : zeilen).map(ohneZahlen).filter(Boolean);
}

export function createSortiment({ shortagesRepo, chronik, istPremium }) {
  /** Schlüssel -> angezeigter Name. Schreibweise des eigenen Landes bevorzugt. */
  function verzeichnis(land) {
    const namen = new Map(); // Schlüssel -> [{ land, wirkstoff }]
    const nimm = (wirkstoff, l) => {
      const k = wirkstoffSchluessel(wirkstoff);
      if (!k) return;
      if (!namen.has(k)) namen.set(k, []);
      namen.get(k).push({ land: String(l || '').toUpperCase(), wirkstoff: String(wirkstoff).trim() });
    };
    for (const e of chronik.bekannteWirkstoffe()) nimm(e.wirkstoff, e.land);
    for (const z of shortagesRepo.list()) if (z.wirkstoff) nimm(z.wirkstoff, z.country);
    const v = new Map();
    for (const [k, liste] of namen) v.set(k, anzeigeName(liste, land));
    return v;
  }

  /**
   * Für nicht zugeordnete Zeilen: Behördeneinträge, deren Name ein Wort der
   * Zeile als Bestandteil enthält („Cefuroxim" -> „Cefuroxim-Axetil").
   * NUR als Hinweis, nie als Einstufung: Cefuroxim-Axetil (Tablette) ist
   * nicht Cefuroxim-Natrium (Infusion) — domain/inn.js setzt sie bewusst
   * nicht gleich. „Keine Meldung" ohne diesen Hinweis wäre aber irreführend.
   */
  function aehnliche(zeile, v) {
    const teile = new Map();
    for (const name of v.values()) {
      for (const teil of name.split(/[\s/+,-]+/)) {
        const k = teil.length >= 5 && wirkstoffSchluessel(teil);
        if (!k) continue;
        if (!teile.has(k)) teile.set(k, new Set());
        teile.get(k).add(name);
      }
    }
    const treffer = new Set();
    for (const wort of zeile.split(/[^\p{L}]+/u)) {
      const k = wort.length >= 5 && wirkstoffSchluessel(wort);
      for (const n of (k && teile.get(k)) || []) treffer.add(n);
    }
    // „Cefuroxime Axetil" (FDA) und „Cefuroxim-Axetil" (BfArM) nur einmal nennen.
    const gleich = (n) => n.toLowerCase().split(/[^a-zäöüß]+/).map((w) => w.replace(/e$/, '')).filter(Boolean).join(' ');
    const einmal = new Map();
    for (const n of treffer) if (!einmal.has(gleich(n))) einmal.set(gleich(n), n);
    return [...einmal.values()].slice(0, 3);
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

  /**
   * Produkt-/Markennamen aus den Engpassdaten selbst: „Amoxil 500 mg capsules"
   * mit Wirkstoff Amoxicillin heißt: „Amoxil" ist Amoxicillin. In Afrika bestellt
   * man fast nur nach Markennamen — bis 10/2026 meldete der Check bei
   * „Amoxil 500mg caps" „nichts gefunden", obwohl genau dieses Präparat als
   * kritisch gemeldet war. KEINE eigene Markenliste: nur, was in einer Meldung
   * oder Behördenliste steht, mit Herkunft im Ergebnis. Ein Name, der in den
   * Daten zu mehr als einem Wirkstoff gehört (Hersteller wie „Sandoz"), zählt nicht.
   */
  const GATTUNG = /^(tabs?|tablets?|tabletten|filmtabletten|caps?|capsules?|kapseln?|syrup|sirup|saft|susp|suspension|inj|injection|injektion|infusion|cream|creme|ointment|salbe|solution|l[oö]sung|sachets?|drops|tropfen|gel|spray|retard|forte|mite|plus|extra|comp|depot|junior|kids|generic|generique|g[eé]n[eé]rique)$/i;
  const ersteWort = (s) => (String(s || '').trim().match(/^\p{L}[\p{L}-]{3,}/u) || [])[0] || null;
  function handelsnamen(v) {
    const m = new Map(); // wort -> { schluessel: Set, beispiel }
    for (const z of shortagesRepo.list()) {
      if (!z.wirkstoff || !z.bezeichnung) continue;
      const k = wirkstoffSchluessel(z.wirkstoff);
      const w = ersteWort(z.bezeichnung);
      if (!k || !w || GATTUNG.test(w) || v.has(wirkstoffSchluessel(w))) continue; // Wirkstoffname selbst: erkennt erkenne()
      const key = w.toLowerCase();
      if (!m.has(key)) m.set(key, { schluessel: new Set(), beispiel: String(z.bezeichnung).trim().slice(0, 80) });
      m.get(key).schluessel.add(k);
    }
    return m;
  }

  return {
    // `zeilenFilter` (Daten-Schnittstelle): nur Engpasszeilen echter Herkunft.
    pruefen(userId, text, land, { zeilenFilter = null } = {}) {
      const cc = String(land || '').toUpperCase();
      const premium = !!istPremium(userId);
      const alle = zeilenAusText(text);
      const grenze = premium ? MAX_ZEILEN : FREI_ZEILEN;
      const zuPruefen = alle.slice(0, grenze);
      const v = verzeichnis(cc);
      const hier = shortagesRepo.list({ country: cc }).filter((z) => AKTIV.has(z.status) && z.wirkstoff && (!zeilenFilter || zeilenFilter(z))
        && aktualitaet(z, new Date().toISOString().slice(0, 10)).stufe !== 'veraltet'); // veraltete Apotheken-Meldungen nicht
      const beobachtet = new Set(shortagesRepo.listWatch(userId).map((w) => wirkstoffSchluessel(w) || w.toLowerCase()));

      const hn = handelsnamen(v);
      // Dieselbe Substanz mehrfach in der Liste (Kapseln UND Saft): EIN Ergebnis, die weiteren
      // Zeilen unter `auch` — bis 10/2026 fielen sie still weg (9 Zeilen geprüft, 8 angezeigt).
      const proSchluessel = new Map();
      const ergebnisse = [];
      for (const zeile of zuPruefen) {
        let k = erkenne(zeile, v);
        let ueber = null; // über welchen Produktnamen erkannt (Herkunft für die Anzeige)
        if (!k) {
          const h = hn.get((ersteWort(zeile) || '').toLowerCase());
          if (h && h.schluessel.size === 1) { k = [...h.schluessel][0]; ueber = h.beispiel; }
        }
        if (k && proSchluessel.has(k)) { proSchluessel.get(k).auch.push(zeile); continue; }
        if (!k) { ergebnisse.push({ eingabe: zeile, einstufung: 'unbekannt', aehnlich: aehnliche(zeile, v) }); continue; }
        const name = v.get(k);
        const meldungen = hier.filter((z) => wirkstoffSchluessel(z.wirkstoff) === k)
          .sort((a, b) => (RANG[b.status] || 0) - (RANG[a.status] || 0));
        const verlauf = chronik.kurz(name, cc);
        const ausland = chronik.offenAnderswo(name, cc).map((a) => ({ land: a.land, seit_tagen: a.dauer_tage, quelle: a.quelle || null }));
        const m = meldungen[0];
        const einstufung = m ? 'knapp' : ausland.length ? 'ausland' : verlauf && verlauf.anzahl ? 'wiederholt' : 'ruhig';
        const eintrag = {
          eingabe: zeile, wirkstoff: name, einstufung, erkannt_ueber: ueber, auch: [],
          status: m ? m.status : null,
          quelle: m ? (m.quelle || null) : null,
          herkunft: m ? (m.provenance || null) : null, // verified = Behörde, community = Meldung aus Apotheken
          voraussichtlich_bis: m ? (m.voraussichtlich_bis || null) : null,
          praeparate: meldungen.length,
          seit_tagen: verlauf && verlauf.offen_seit_tagen != null ? verlauf.offen_seit_tagen : null,
          verlauf: verlauf ? { anzahl: verlauf.anzahl, durchschnitt_tage: verlauf.durchschnitt_tage } : null,
          ausland,
          beobachtet: beobachtet.has(k),
        };
        ergebnisse.push(eintrag);
        proSchluessel.set(k, eintrag);
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
