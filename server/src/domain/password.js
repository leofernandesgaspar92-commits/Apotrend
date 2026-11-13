// Passwort-Hashing mit Node-Built-in scrypt (kein externer Dependency).
// Format: scrypt$<salt-hex>$<hash-hex>. Vergleich in konstanter Zeit.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

const KEYLEN = 64;
const SALTLEN = 16;

// ── Zu leicht zu erraten? (Fund 11/2026: nur „mindestens 8 Zeichen" wurde geprüft) ──
// Die häufigsten Passwörter weltweit und aus unseren Sprachen/Branche (Kleinschreibung), dazu Wiederholungen,
// Zahlen-/Buchstabenfolgen, Tastaturreihen und der eigene Name bzw. E-Mail-Name mit ein paar Zeichen dazu.
// Bewusst kurz und erklärbar — keine Liste mit Millionen Einträgen.
const HAEUFIG = new Set(['password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'passwort', 'passwort1',
  'passwort12', 'passwort123', 'motdepasse', 'motdepasse1', 'motdepasse123', 'senha123', 'senha1234', 'contrasena', 'contraseña', 'iloveyou',
  'iloveyou1', 'sunshine', 'princess', 'football', 'baseball', 'welcome1', 'welcome123', 'letmein1', 'admin123', 'administrator', 'qwerty123',
  'qwerty12', 'azerty123', '1q2w3e4r', '1q2w3e4r5t', 'zaq12wsx', 'abc12345', 'abcd1234', 'a1b2c3d4', '12345678a', '123456789a', 'trustno1',
  'superman', 'starwars', 'dragon12', 'monkey12', 'charlie1', 'computer', 'internet', 'samsung1', 'michael1', 'jennifer', 'whatever',
  'freedom1', 'master12', 'changeme', 'default1', 'secret12', 'geheim12', 'hallo123', 'bonjour1', 'soleil123', 'pharmacy', 'pharmacy1',
  'pharmacie', 'pharmacie1', 'farmacia', 'farmacia1', 'apotheke', 'apotheke1', 'pharmacist', 'medicine', 'medicine1', 'hospital', 'doctor123',
  'apopulse', 'apopulse1', 'apotrend', 'apotrend1', 'nairobi1', 'lagos123', 'kenya123', 'nigeria1', 'ghana123', '11223344', '12341234']);
const REIHEN = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', 'qwertyuiop', 'qwertzuiop', 'azertyuiop',
  'asdfghjkl', 'qsdfghjklm', 'yxcvbnm', 'zxcvbnm', 'wxcvbn', '1qaz2wsx3edc', 'qazwsxedc'];
const nurZeichen = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function passwortZuEinfach(pw, { email = '', name = '' } = {}) {
  const k = String(pw || '').toLowerCase();
  if (HAEUFIG.has(k)) return true;
  if (/^(.{1,4})\1+$/.test(k)) return true; // aaaaaaaa, 12121212, abcabcabc
  if (REIHEN.some((r) => (r + r).includes(k))) return true; // 12345678, abcdefgh, qwertyui (auch umlaufend)
  const kern = nurZeichen(k);
  const eigene = [String(email).split('@')[0], String(name), ...String(name).split(/\s+/)].map(nurZeichen).filter((w) => w.length >= 4);
  // Eigener Name/E-Mail-Name, höchstens 4 Zeichen dazu (wanjiru123, Kamau2026).
  return eigene.some((w) => kern.includes(w) && kern.length - w.length <= 4);
}
export function pruefeNeuesPasswort(pw, kontext = {}) {
  if (passwortZuEinfach(pw, kontext)) {
    const e = new Error('Dieses Passwort ist zu leicht zu erraten. Bitte ein anderes wählen — gut merkbar sind drei bis vier Wörter.');
    e.code = 'pw_zu_einfach'; e.status = 400; throw e;
  }
}

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

// Dieselben Hashes, aber im Hintergrund-Thread (libuv) gerechnet: Ein Hash kostet
// ~50 ms Rechenzeit. Synchron blockiert er den GANZEN Server — beim Start-Ansturm
// warteten Lesende sonst Sekunden, während andere sich registrierten. Für die
// häufigen Wege (Registrieren, Anmelden) diese Varianten nehmen.
export async function hashPasswordAsync(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    const e = new Error('Passwort muss mindestens 8 Zeichen haben.'); e.code = 'pw_too_short'; throw e;
  }
  const salt = crypto.randomBytes(SALTLEN);
  const dk = await scryptAsync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

export async function verifyPasswordAsync(plain, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let actual;
  try {
    actual = await scryptAsync(String(plain), salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
