// Passwort-Hashing mit Node-Built-in scrypt (kein externer Dependency).
// Format: scrypt$<salt-hex>$<hash-hex>. Vergleich in konstanter Zeit.
import crypto from 'node:crypto';

const KEYLEN = 64;
const SALTLEN = 16;

export function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    const e = new Error('Passwort muss mindestens 8 Zeichen haben.'); e.code = 'pw_too_short'; throw e;
  }
  const salt = crypto.randomBytes(SALTLEN);
  const dk = crypto.scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

export function verifyPassword(plain, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let actual;
  try {
    actual = crypto.scryptSync(String(plain), salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
