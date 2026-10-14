// ============================================================================
//  Rechnungsnummern — EINE fortlaufende Reihe für alle Rechnungen
// ============================================================================
//  Rechnungsnummern müssen eindeutig und fortlaufend sein (DE § 14 Abs. 4
//  UStG, AT § 11 UStG). Anzeigen und Tarife (Premium/Business) zogen sonst
//  aus zwei eigenen Zählern — zweimal „AP-2026-0001" bei demselben
//  Rechnungssteller. Deshalb ein gemeinsamer Zähler für beide.
// ============================================================================

export function createRechnungsnummern({ jetzt = () => Date.now() } = {}) {
  let zaehler = 0;
  return {
    naechste() {
      const jahr = new Date(jetzt()).getUTCFullYear();
      return `AP-${jahr}-${String(++zaehler).padStart(4, '0')}`;
    },
    /** Ältere Sicherung (eigener Zähler der Anzeigen): nie dahinter zurückfallen. */
    mindestens(n) { zaehler = Math.max(zaehler, Number(n) || 0); },
    stand: () => zaehler,
    __dump() { return { zaehler }; },
    __load(d) { zaehler = Math.max(0, Number(d && d.zaehler) || 0); },
  };
}
