// ============================================================================
//  Vorrats-Radar: im Ausland amtlich knapp — bei dir (noch) nicht
// ============================================================================
//  Die Frage hinter jedem Einkauf: „Muss ich mir das jetzt hinlegen?" Eine
//  Behördenliste beantwortet sie nicht — sie zeigt nur das eigene Land, und
//  dann ist es zu spät. Wer mehrere Länder nebeneinander mitschreibt
//  (services/chronik.js), sieht, was anderswo schon fehlt.
//
//  Ehrlichkeitsregeln:
//   1. KEINE PROGNOSE und kein Risiko-Prozentwert. Die Liste nennt Tatsachen:
//      in welchen Ländern, seit wann, laut welcher Behörde — und ob der
//      Wirkstoff bei dir schon einmal knapp war. Schlüsse zieht die Apotheke.
//   2. Rangfolge erklärbar: mehr Länder zuerst, dann „war bei dir schon
//      knapp", dann die frischeste Meldung. Kein verdecktes Gewicht.
//   3. Ohne Behördenliste für das eigene Land kann niemand sagen „bei dir
//      nicht knapp". Dann steht genau das in der Antwort (heimat_beobachtet).
//
//  Gratis: die ersten FREI Einträge und die Gesamtzahl. Premium: alles.
// ============================================================================

import { wirkstoffSchluessel } from '../domain/inn.js';
import { anzeigeName } from '../domain/anzeigename.js';

export const RADAR_FREI = 3;
const MAX = 100;

export function vorratsRadar({ chronik, land, premium = false, beobachtet = [] }) {
  const cc = String(land || '').toUpperCase();
  const beob = new Set(beobachtet.map((w) => wirkstoffSchluessel(w) || String(w).toLowerCase()));
  // Alle Schreibweisen je Substanz sammeln — angezeigt wird die der eigenen Sprache.
  const jeSubstanz = new Map();
  for (const e of chronik.bekannteWirkstoffe()) {
    const k = wirkstoffSchluessel(e.wirkstoff) || String(e.wirkstoff).toLowerCase();
    if (!jeSubstanz.has(k)) jeSubstanz.set(k, []);
    jeSubstanz.get(k).push(e);
  }
  const eintraege = [];
  for (const [k, namen] of jeSubstanz) {
    const wirkstoff = anzeigeName(namen, cc);
    if (chronik.offenIn(wirkstoff, cc)) continue; // bei dir schon knapp: kein Vorrats-, sondern ein Engpass-Fall
    const laender = chronik.offenAnderswo(wirkstoff, cc);
    if (!laender.length) continue;
    const verlauf = chronik.kurz(wirkstoff, cc);
    eintraege.push({
      wirkstoff,
      laender: laender.map((l) => ({ land: l.land, seit_tagen: l.dauer_tage, status: l.schwerster_status, quelle: l.quelle || null })),
      frischeste_tage: Math.min(...laender.map((l) => l.dauer_tage)),
      verlauf_hier: verlauf ? { anzahl: verlauf.anzahl, durchschnitt_tage: verlauf.durchschnitt_tage } : null,
      beobachtet: beob.has(k),
    });
  }
  eintraege.sort((a, b) => b.laender.length - a.laender.length
    || ((b.verlauf_hier && b.verlauf_hier.anzahl) || 0) - ((a.verlauf_hier && a.verlauf_hier.anzahl) || 0)
    || a.frischeste_tage - b.frischeste_tage
    || a.wirkstoff.localeCompare(b.wirkstoff));
  const gesamt = eintraege.length;
  const sichtbar = premium ? eintraege.slice(0, MAX) : eintraege.slice(0, RADAR_FREI);
  return {
    land: cc, premium, gesamt,
    gesperrt: Math.max(0, Math.min(gesamt, premium ? MAX : gesamt) - sichtbar.length),
    heimat_beobachtet: !!chronik.aufzeichnungSeit(cc),
    laender: chronik.beobachteteLaender(),
    eintraege: sichtbar,
  };
}
