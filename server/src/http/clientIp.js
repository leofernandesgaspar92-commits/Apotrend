// ============================================================================
//  Client-IP hinter dem Render-Proxy — einstellbar und selbst prüfbar
// ============================================================================
//  Die Sperren gegen Passwort-Durchprobieren, SMS-Code-Flut und Link-Flut zählen je IP-Adresse.
//  Bis 11/2026 nahm der Server fest den ERSTEN Eintrag von X-Forwarded-For — den kann jeder
//  Absender selbst setzen, wenn der Proxy nur hinten anhängt. Wie Render die Kopfzeilen genau
//  füllt, ist nicht offiziell dokumentiert (Community: „hängt an" vs. „erster ist echt";
//  Render läuft womöglich hinter Cloudflare → CF-Connecting-IP). Darum nicht raten:
//   · APOPULSE_CLIENT_IP wählt die Quelle (ohne Variable: wie bisher, xff-erster).
//   · Der Startklar-Check der Redaktion schickt eine erfundene Adresse in ALLEN Kandidaten-
//     Kopfzeilen mit (Kopfzeile x-apo-ip-pruefung). Kommt sie beim gewählten Weg an, ist die
//     Erkennung fälschbar; empfohlen wird die erste Quelle, die die Infrastruktur überschreibt.
// ============================================================================

export const IP_QUELLEN = ['xff-erster', 'xff-letzter', 'cf-connecting-ip', 'true-client-ip', 'x-real-ip'];
export const PRUEF_IP = '203.0.113.77'; // TEST-NET-3 (RFC 5737): nie eine echte Adresse
export const PRUEF_KOPF = 'x-apo-ip-pruefung';
// Reihenfolge der Empfehlung: Kopfzeilen, die ein vorgeschalteter Dienst ÜBERSCHREIBT, vor dem
// letzten X-Forwarded-For-Eintrag (der bei zwei Proxys eine Adresse des Proxys sein könnte).
const EMPFEHLUNG = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'xff-letzter'];

const eins = (v) => { const s = String(Array.isArray(v) ? v[0] : v || '').trim(); return s || null; };

export function ipKandidaten(headers = {}, socketAdresse = null) {
  const xff = String(headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'xff-erster': xff[0] || null,
    'xff-letzter': xff[xff.length - 1] || null,
    'cf-connecting-ip': eins(headers['cf-connecting-ip']),
    'true-client-ip': eins(headers['true-client-ip']),
    'x-real-ip': eins(headers['x-real-ip']),
    socket: socketAdresse || null,
  };
}

export const gewaehlteQuelle = (env = process.env) => (IP_QUELLEN.includes(String(env.APOPULSE_CLIENT_IP || '').trim()) ? String(env.APOPULSE_CLIENT_IP).trim() : 'xff-erster');

export function clientIp(headers, socketAdresse, env = process.env) {
  const k = ipKandidaten(headers, socketAdresse);
  return k[gewaehlteQuelle(env)] || k['xff-erster'] || k.socket || 'unknown';
}

/** Nur für eine Prüf-Anfrage (Kopfzeile x-apo-ip-pruefung, erfundene Adresse in allen Kandidaten). */
export function ipPruefung(headers, socketAdresse, env = process.env) {
  if (!headers || !headers[PRUEF_KOPF]) return null;
  const k = ipKandidaten(headers, socketAdresse);
  const quelle = gewaehlteQuelle(env);
  const faelschbar = clientIp(headers, socketAdresse, env) === PRUEF_IP;
  const empfehlung = EMPFEHLUNG.find((q) => k[q] && k[q] !== PRUEF_IP) || null;
  return { quelle, faelschbar, empfehlung };
}
