// Einmal-Wiederherstellungscodes für „Passwort vergessen" OHNE externen E-Mail-Dienst
// (Constraint: nur Built-ins). Bei der Registrierung werden Codes erzeugt und der
// Nutzer:in EINMAL im Klartext gezeigt; gespeichert werden nur die Hashes. Zum
// Zurücksetzen gibt die Nutzer:in E-Mail + einen Code + neues Passwort ein; der
// passende Code wird verbraucht (einmalig gültig).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { verifyPassword } from './password.js';

// Hash der Codes: scrypt mit N = 2048 statt der 16384 fürs Passwort. Passwörter
// sind von Menschen gewählt und darum ratbar — Codes sind ZUFÄLLIG (31^10 ≈ 2^49,5
// Möglichkeiten). Auch mit gestohlener Datenbank bleibt Durchprobieren damit
// jahrelange Rechenarbeit, aber eine Registrierung kostet nicht mehr 8 × 50 ms
// (blockierte beim Start-Ansturm den ganzen Server). Format: rc$<salt>$<hash>.
// Alte Hashes (scrypt$…, volle Kosten) werden weiter erkannt.
const RC_N = 2048;
const RC_KEYLEN = 32;
const scryptAsync = promisify(crypto.scrypt);
const rcHash = (salt, dk) => `rc$${salt.toString('hex')}$${dk.toString('hex')}`;
function hashCode(norm) {
  const salt = crypto.randomBytes(16);
  return rcHash(salt, crypto.scryptSync(norm, salt, RC_KEYLEN, { N: RC_N }));
}
async function hashCodeAsync(norm) {
  const salt = crypto.randomBytes(16);
  return rcHash(salt, await scryptAsync(norm, salt, RC_KEYLEN, { N: RC_N }));
}
function verifyCode(norm, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts[0] === 'scrypt') return verifyPassword(norm, stored);
  if (parts.length !== 3 || parts[0] !== 'rc') return false;
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== RC_KEYLEN) return false;
  const actual = crypto.scryptSync(norm, Buffer.from(parts[1], 'hex'), RC_KEYLEN, { N: RC_N });
  return crypto.timingSafeEqual(actual, expected);
}

// Verwechslungsarmes Alphabet (kein 0/O/1/I/L) — leichter abzuschreiben/vorzulesen.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_COUNT = 8;
const GROUP = 5; // zwei 5er-Gruppen -> 10 Zeichen (>= 8, passt zum Passwort-Hash)

// Klartext-Code, hübsch gruppiert: „AB2CD-EF3GH".
function randomCode() {
  const n = GROUP * 2;
  let s = '';
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s.slice(0, GROUP) + '-' + s.slice(GROUP);
}

// Eingegebenen Code robust normalisieren (Groß-/Kleinschreibung, Leerzeichen, Bindestriche egal).
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Erzeugt CODE_COUNT Codes: { codes: [Klartext…], hashes: [Hash…] }.
export function generateRecoveryCodes(count = CODE_COUNT) {
  const codes = Array.from({ length: count }, randomCode);
  const hashes = codes.map(c => hashCode(normalizeCode(c)));
  return { codes, hashes };
}

// Dasselbe im Hintergrund-Thread (für die Registrierung): blockiert den Server nicht.
export async function generateRecoveryCodesAsync(count = CODE_COUNT) {
  const codes = Array.from({ length: count }, randomCode);
  const hashes = await Promise.all(codes.map(c => hashCodeAsync(normalizeCode(c))));
  return { codes, hashes };
}

// Prüft einen Code gegen die Hash-Liste. Liefert den Index des Treffers oder -1.
// Läuft über ALLE Hashes (kein Früh-Abbruch), damit die Laufzeit nicht verrät,
// welcher/ob ein Code passt.
export function matchRecoveryCode(code, hashes) {
  const norm = normalizeCode(code);
  if (!norm || !Array.isArray(hashes)) return -1;
  let found = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (verifyCode(norm, hashes[i]) && found === -1) found = i;
  }
  return found;
}
