// ============================================================================
//  Werbeplätze und Preise
// ============================================================================
//  Preise je Platz, je Land und je Woche (Cent, EUR). Die Zahlen hier sind
//  STARTPREISE des Betreibers, keine Marktpreise — sie lassen sich ohne
//  Code-Änderung setzen:
//      APOPULSE_WERBEPREISE="start:490,feed:290,seite:190"   (EUR je Land und Woche)
//
//  BEWUSST NICHT buchbar: Engpass-Liste, Live-Warnungen (Rückrufe,
//  Sicherheitsmeldungen) und Wirkstoff-Seiten. Neben einer Engpass- oder
//  Rückrufmeldung wirkt jede Anzeige wie eine Empfehlung („nimm stattdessen
//  unser Präparat") — Substitutionsaussagen gibt es hier nur mit Quelle,
//  nie gekauft. Siehe docs/WERBUNG.md.
// ============================================================================

export const WERBEPLAETZE = {
  start: { id: 'start', preis_woche_cents: 49000 },
  feed: { id: 'feed', preis_woche_cents: 29000 },
  seite: { id: 'seite', preis_woche_cents: 19000 },
};

/** Preise aus der Umgebung übernehmen („start:490,feed:290"); Unbrauchbares bleibt beim Standard. */
export function werbeplaetzeAusUmgebung(env = process.env) {
  const plaetze = Object.fromEntries(Object.entries(WERBEPLAETZE).map(([k, v]) => [k, { ...v }]));
  for (const teil of String(env.APOPULSE_WERBEPREISE || '').split(',')) {
    const [id, eur] = teil.split(':').map((s) => (s || '').trim());
    const n = Number(eur);
    if (plaetze[id] && Number.isFinite(n) && n > 0 && n < 1_000_000) plaetze[id].preis_woche_cents = Math.round(n * 100);
  }
  return plaetze;
}

// Berufsgruppen, die man ansprechen kann (Kontotypen aus data/accountTypes.js).
export const ZIELGRUPPEN = ['pharmacy', 'pharma', 'wholesale', 'logistics', 'authority', 'private'];
// Wer werben darf: Unternehmen der Branche. Behörden und Privatpersonen nicht.
export const WERBEKUNDEN_TYPEN = ['pharma', 'wholesale', 'logistics', 'pharmacy'];
