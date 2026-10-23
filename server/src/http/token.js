// Zustandsloses Session-Token: HMAC-signierte userId. Kein Klartext, kein
// externer Dependency.
// Secret: aus APOPULSE_TOKEN_SECRET (Produktion — bleibt über Neustarts/Deploys
// stabil, Sessions überleben). Ohne die Variable: zufälliges Secret pro Prozess
// (Dev/Demo — Neustart = neu einloggen). In Produktion die Variable setzen (>=16 Zeichen).
import crypto from 'node:crypto';

const envSecret = process.env.APOPULSE_TOKEN_SECRET;
const SECRET = envSecret && envSecret.length >= 16 ? Buffer.from(envSecret, 'utf8') : crypto.randomBytes(32);
if (!envSecret) console.warn('Hinweis: APOPULSE_TOKEN_SECRET nicht gesetzt — Sessions überleben keinen Neustart. Für Produktion setzen.');

// Seit 10/2026 trägt das Token den Ausstellungszeitpunkt („userId|ms"). Damit lassen
// sich alle älteren Sitzungen eines Kontos beenden (Passwort geändert, „Auf allen
// anderen Geräten abmelden"), ohne eine Sitzungstabelle zu führen. Ältere Token ohne
// Zeitpunkt bleiben gültig, bis das Konto zum ersten Mal Sitzungen beendet.
export function issueToken(userId, ausgestellt = Date.now()) {
  const payload = Buffer.from(`${userId}|${ausgestellt}`).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Geprüftes Token → { userId, ausgestellt } (ausgestellt null bei alten Token) oder null. */
export function tokenDetails(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const roh = Buffer.from(payload, 'base64url').toString();
  const i = roh.lastIndexOf('|');
  if (i < 0) return { userId: roh, ausgestellt: null };
  return { userId: roh.slice(0, i), ausgestellt: Number(roh.slice(i + 1)) || null };
}

export function verifyToken(token) {
  const d = tokenDetails(token);
  return d ? d.userId : null;
}

/** Gilt die Sitzung noch? Nein, wenn das Konto danach alle Sitzungen beendet hat. */
export function sitzungGueltig(details, user) {
  if (!details || !user) return false;
  if (!user.sitzungen_ab) return true;
  return details.ausgestellt != null && details.ausgestellt >= user.sitzungen_ab;
}

// Zweck-Token (z. B. Abmelde-Link im Wochenbericht). Eigener, aus dem Secret
// ABGELEITETER Schlüssel je Zweck: Ein Abmelde-Link darf nie als Sitzung
// taugen — er steht in einer E-Mail, die weitergeleitet werden kann.
const zweckKey = (zweck) => crypto.createHmac('sha256', SECRET).update('zweck:' + zweck).digest();
export function issueZweckToken(zweck, userId) {
  const payload = Buffer.from(String(userId)).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', zweckKey(zweck)).update(payload).digest('base64url')}`;
}
export function verifyZweckToken(zweck, token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', zweckKey(zweck)).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, 'base64url').toString();
}
