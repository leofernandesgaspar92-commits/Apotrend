// ============================================================================
//  Fehler → Antwort: erwartete Fehler sprechen, Programmfehler schweigen nach außen
// ============================================================================
//  ERWARTET ist ein Fehler mit Code (AppError, e.code) oder bewusst gesetztem Status
//  (e.status, z. B. 403/429): Die Meldung ist für Nutzer:innen gedacht, die App
//  übersetzt sie über den Code.
//  UNERWARTET ist alles andere — TypeError & Co. aus einem Programmfehler. Bis 11/2026
//  ging so ein Fehler roh mit 400 an die Oberfläche („Cannot read properties of null
//  (reading 'email')"), unübersetzbar, und erschien weder im Log noch im Betriebs-
//  Cockpit. Jetzt: 500 mit dem übersetzbaren Code „unbekannt", ohne Interna; der
//  Aufrufer protokolliert und zählt (`unerwartet: true`).
// ============================================================================

export const UNBEKANNT_TEXT = 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';

/** @returns {{ status: number, body: object, unerwartet: boolean }} */
export function fehlerAntwort(e, { verboten = () => false } = {}) {
  const x = e || {};
  if (verboten(x)) return { status: 403, body: x.code ? { error: x.message, code: x.code } : { error: x.message }, unerwartet: false };
  if (!x.code && !x.status) return { status: 500, body: { error: UNBEKANNT_TEXT, code: 'unbekannt' }, unerwartet: true };
  const body = x.code ? { error: x.message, code: x.code } : { error: x.message };
  // Werte für Platzhalter der übersetzten Meldung (z. B. erwartetes Format der Transaktions-ID).
  if (x.code && x.params && typeof x.params === 'object') body.params = x.params;
  if (x.retryAfterS != null) body.retry_after_s = x.retryAfterS; // 429: Wartezeit fürs Frontend
  return { status: x.status || 400, body, unerwartet: false };
}
