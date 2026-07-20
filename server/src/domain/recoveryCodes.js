// Einmal-Wiederherstellungscodes für „Passwort vergessen" OHNE externen E-Mail-Dienst
// (Constraint: nur Built-ins). Bei der Registrierung werden Codes erzeugt und der
// Nutzer:in EINMAL im Klartext gezeigt; gespeichert werden nur die Hashes. Zum
// Zurücksetzen gibt die Nutzer:in E-Mail + einen Code + neues Passwort ein; der
// passende Code wird verbraucht (einmalig gültig).
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';

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
  const hashes = codes.map(c => hashPassword(normalizeCode(c)));
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
    if (verifyPassword(norm, hashes[i]) && found === -1) found = i;
  }
  return found;
}
