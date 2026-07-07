// Zustandsloses Session-Token: HMAC-signierte userId. Kein Klartext, kein
// externer Dependency. Secret pro Prozess (Neustart = neu einloggen — fuer die
// Demo ausreichend; Produktion: persistentes Secret + Ablaufzeit).
import crypto from 'node:crypto';

const SECRET = crypto.randomBytes(32);

export function issueToken(userId) {
  const payload = Buffer.from(String(userId)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, 'base64url').toString();
}
