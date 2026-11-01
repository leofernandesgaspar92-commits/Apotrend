// @ts-check
// ============================================================================
//  Vertrauensstufe und Vertrauenswert einer Engpass-Meldung (Sprint 4, 11/2026)
// ============================================================================
//  EINE Stelle entscheidet, wie verlässlich eine Engpass-Zeile ist — Liste,
//  Detailseite, Suche und Daten-Schnittstelle zeigen dasselbe.
//
//  Stufen (Reihenfolge = Vorrang bei Apotheken-Meldungen):
//    offiziell   Behördenliste (BfArM, BASG, openFDA …), Quelle an der Zeile
//    redaktion   von der Redaktion mit Quellen-Link gesetzt
//    umstritten  Redaktion zweifelt (mit Begründung) — oder mindestens
//                UMSTRITTEN_AB Fachleute widersprechen und es widersprechen
//                mindestens so viele, wie bestätigen
//    unklar      seit PRUEFEN_NACH_TAGEN (14) Tagen von niemandem bestätigt:
//                „Status unklar — Prüfung erforderlich"
//    hoch        ein VERIFIZIERTER Großhandel oder Hersteller meldet/bestätigt
//    bestaetigt  mindestens 3 Apotheken (Konten ab 24 h) — „Community-verifiziert"
//    ungeprueft  einzelne Erst-Meldung, mit Warnhinweis
//
//  Der Vertrauenswert (0–100) macht die Stufe nachvollziehbar, ersetzt sie aber
//  nicht: Angezeigt wird immer zuerst die Stufe im Klartext. Die Formel ist
//  bewusst einfach, damit die Redaktion sie erklären kann (DEPLOY.md):
//    Erst-Meldung 25 · je weitere zählende Apotheke +20 (höchstens +50)
//    verifizierter Betrieb meldet +10 · verifizierter Großhandel/Hersteller ≥ 85
//    je Widerspruch −25 · Redaktion zweifelt ≤ 10
//    14 Tage ohne Bestätigung −20 · 30 Tage −40
// ============================================================================

export const STUFEN = ['offiziell', 'redaktion', 'umstritten', 'unklar', 'hoch', 'bestaetigt', 'ungeprueft'];
/** Kontoarten, deren verifizierte Meldung als „hohe Zuverlässigkeit" gilt. */
export const HOCH_KONTOARTEN = ['wholesale', 'pharma'];
export const UMSTRITTEN_AB = 2;
export const WIDERSPRUCH_GRUENDE = ['bei_uns_lieferbar', 'falscher_wirkstoff', 'doppelt', 'sonstiges'];

const begrenzen = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * @param {{
 *   provenance: string,
 *   bestaetigt: boolean,                 // istBestaetigt (3 zählende Apotheken, nicht veraltet)
 *   zaehlend: number,                    // zählende Apotheken inkl. Meldender
 *   aktualitaet: 'aktuell'|'pruefen'|'veraltet',
 *   meldendVerifiziert?: boolean,
 *   fachbetrieb?: boolean,               // verifizierter Großhandel/Hersteller beteiligt
 *   widersprueche?: number,              // Widersprüche aus der Community
 *   redaktionZweifel?: boolean,
 * }} e
 * @returns {{ stufe: string, punkte: number }}
 */
export function bewerte(e) {
  if (e.provenance === 'verified') return { stufe: 'offiziell', punkte: 100 };
  if (e.provenance === 'editorial') return { stufe: 'redaktion', punkte: 90 };
  if (e.provenance !== 'community') return { stufe: 'ungeprueft', punkte: 0 };

  const wid = Math.max(0, e.widersprueche || 0);
  const zaehlend = Math.max(0, e.zaehlend || 0);
  let p = 25 + Math.min(50, Math.max(0, zaehlend - 1) * 20);
  if (e.meldendVerifiziert) p += 10;
  if (e.fachbetrieb) p = Math.max(p, 85);
  p -= wid * 25;
  if (e.aktualitaet === 'pruefen') p -= 20;
  if (e.aktualitaet === 'veraltet') p -= 40;
  if (e.redaktionZweifel) p = Math.min(p, 10);
  const punkte = begrenzen(p);

  let stufe;
  if (e.redaktionZweifel || (wid >= UMSTRITTEN_AB && wid >= zaehlend)) stufe = 'umstritten';
  else if (e.aktualitaet !== 'aktuell') stufe = 'unklar';
  else if (e.fachbetrieb) stufe = 'hoch';
  else if (e.bestaetigt) stufe = 'bestaetigt';
  else stufe = 'ungeprueft';
  return { stufe, punkte };
}
