// ============================================================================
//  Wallet-Adressen prüfen: Format und Prüfsumme je Kette
// ============================================================================
//  Die Empfangsadressen kommen aus den Render-Einstellungen (APOPULSE_WALLET_*).
//  Ein Kopierfehler — abgeschnitten, Leerzeichen, die Ethereum-Adresse im Tron-Feld —
//  hieße: Kundinnen schicken Geld an eine Adresse, die es nicht gibt oder die nicht
//  dem Betreiber gehört. Bis 11/2026 wurde jede Eingabe ungeprüft angezeigt.
//
//  Geprüft wird ohne Netz und ohne fremde Bibliothek:
//   · Tron     Base58Check, 25 Byte, Versionsbyte 0x41 (beginnt mit „T")
//   · Bitcoin  bech32/bech32m („bc1…", mit Prüfsumme) oder Base58Check („1…"/„3…")
//   · Ethereum 0x + 40 Hex-Zeichen (die EIP-55-Prüfsumme bräuchte Keccak — nicht geprüft)
//   · Solana   Base58, genau 32 Byte (keine Prüfsumme in Solana — ein fehlendes letztes Zeichen
//              kann formal gültig bleiben; deutlich Gekürztes, Fremdformate und Leerzeichen nicht)
//  Server-only (node:crypto). cryptoWallets.js bleibt browsertauglich (Checkout-Demo).
// ============================================================================
import crypto from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(s) {
  let n = 0n;
  for (const c of s) { const i = B58.indexOf(c); if (i < 0) return null; n = n * 58n + BigInt(i); }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

function base58check(s, laenge, versionen) {
  const b = base58(s);
  if (!b || b.length !== laenge) return false;
  const nutz = b.subarray(0, -4);
  if (!versionen.includes(nutz[0])) return false;
  return sha256(sha256(nutz)).subarray(0, 4).equals(b.subarray(-4));
}

const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Gueltig(s) {
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return false;
  const a = s.toLowerCase();
  const pos = a.lastIndexOf('1');
  if (a.slice(0, pos) !== 'bc' || a.length < 14 || a.length > 74) return false;
  const daten = [...a.slice(pos + 1)].map((c) => BECH.indexOf(c));
  if (daten.length < 6 || daten.some((x) => x < 0)) return false;
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of [...[...'bc'].map((c) => c.charCodeAt(0) >> 5), 0, ...[...'bc'].map((c) => c.charCodeAt(0) & 31), ...daten]) {
    const top = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= G[i];
  }
  return chk === 1 || chk === 0x2bc830a3; // bech32 (SegWit v0) bzw. bech32m (Taproot)
}

const REGELN = {
  tron: { pruefe: (a) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a) && base58check(a, 25, [0x41]), erwartet: 'Tron-Adresse: beginnt mit T, 34 Zeichen' },
  bitcoin: { pruefe: (a) => (/^bc1/i.test(a) ? bech32Gueltig(a) : base58check(a, 25, [0x00, 0x05])), erwartet: 'Bitcoin-Adresse: beginnt mit bc1, 1 oder 3' },
  ethereum: { pruefe: (a) => /^0x[0-9a-fA-F]{40}$/.test(a), erwartet: 'Ethereum-Adresse: 0x und 40 Zeichen 0–9/a–f' },
  solana: { pruefe: (a) => { const b = base58(a); return !!b && b.length === 32 && a.length >= 32 && a.length <= 44; }, erwartet: 'Solana-Adresse: 32–44 Zeichen Base58' },
};

/** @returns {{ ok: boolean, erwartet: string }} */
export function adresseGueltig(coin, adresse) {
  const r = REGELN[coin];
  if (!r) return { ok: false, erwartet: 'unbekannte Kette' };
  const a = String(adresse || '');
  return { ok: a.length > 0 && a === a.trim() && r.pruefe(a), erwartet: r.erwartet };
}

/** Wallet-ID → Render-Variable (für Hinweise). */
export const WALLET_VARIABLE = { btc: 'APOPULSE_WALLET_BTC', eth: 'APOPULSE_WALLET_ETH', sol_seeker: 'APOPULSE_WALLET_SOL_SEEKER', sol_phantom: 'APOPULSE_WALLET_SOL_PHANTOM', tron: 'APOPULSE_WALLET_TRON' };

/** Liste in gültige und ungültige Wallets teilen. */
export function walletsPruefen(liste) {
  const gueltig = []; const ungueltig = [];
  for (const w of liste) {
    const r = adresseGueltig(w.coin, w.address);
    if (r.ok) gueltig.push(w); else ungueltig.push({ id: w.id, variable: WALLET_VARIABLE[w.id] || w.id, erwartet: r.erwartet });
  }
  return { gueltig, ungueltig };
}
