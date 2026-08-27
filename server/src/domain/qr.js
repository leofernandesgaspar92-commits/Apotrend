// ============================================================================
//  QR-Encoder (Byte-Modus, Fehlerkorrektur-Stufe M)
// ============================================================================
//  Gebraucht für die Krypto-Zahlung: Die Empfangsadresse samt Betrag soll sich
//  mit der Wallet-App scannen lassen, statt abgetippt zu werden. Eine falsch
//  abgetippte Wallet-Adresse bedeutet unwiederbringlich verlorenes Geld — das
//  ist genau der Fall, für den es QR-Codes gibt.
//
//  Warum selbst geschrieben statt Bibliothek: Das Checkout-Modal ist eine
//  EINZELNE, in sich geschlossene HTML-Datei ohne Netzzugriff (eine externe
//  QR-Bibliothek per CDN wäre sowohl ein Ladefehler-Risiko als auch ein
//  Datenschutzproblem, weil die Wallet-Adresse an den CDN-Betreiber ginge).
//
//  BELEGT, nicht behauptet: tools/verify-qr.mjs vergleicht die erzeugte
//  Modul-Matrix Zelle für Zelle mit `segno` (unabhängige, etablierte
//  Python-Implementierung) — für mehrere Nutzlasten × alle acht Masken.
//  Ohne diesen Abgleich wäre ein selbstgebauter Encoder eine Zumutung: ein
//  QR-Code, der aussieht wie einer, aber falsch decodiert, ist schlimmer als
//  gar keiner.
//
//  Umfang: Byte-Modus, Stufe M, Versionen 1–12 (bis 213 Byte Nutzlast).
//  Das deckt Wallet-URIs einschließlich WalletConnect ab.
// ============================================================================

// --- Galois-Feld GF(256), Primitivpolynom 0x11D ------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generatorpolynom für `degree` Fehlerkorrektur-Codewörter. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon-Rest von `data` für `degree` Prüf-Codewörter. */
function rsEncode(data, degree) {
  const gen = rsGenerator(degree);
  const remainder = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let j = 0; j < degree; j++) remainder[j] ^= gfMul(gen[j + 1], factor);
  }
  return remainder;
}

// --- Versionstabellen (nur Stufe M) -----------------------------------------
//  [ecCodewordsProBlock, [gruppe1Blöcke, datenCodewörterProBlock],
//                        [gruppe2Blöcke, datenCodewörterProBlock] | null]

const EC_M = {
  1: [10, [1, 16], null],
  2: [16, [1, 28], null],
  3: [26, [1, 44], null],
  4: [18, [2, 32], null],
  5: [24, [2, 43], null],
  6: [16, [4, 27], null],
  7: [18, [4, 31], null],
  8: [22, [2, 38], [2, 39]],
  9: [22, [3, 36], [2, 37]],
  10: [26, [4, 43], [1, 44]],
  11: [30, [1, 50], [4, 51]],
  12: [22, [6, 36], [2, 37]],
};

/** Mittelpunkte der Ausrichtungsmuster je Version. */
const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58],
};

/** Zusätzliche Restbits nach den Codewörtern. */
const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

function dataCapacityBytes(version) {
  const [, g1, g2] = EC_M[version];
  return g1[0] * g1[1] + (g2 ? g2[0] * g2[1] : 0);
}

export class QrError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QrError';
  }
}

// --- Bitstrom ---------------------------------------------------------------

function buildBitStream(bytes, version) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // Modusindikator: Byte
  push(bytes.length, version <= 9 ? 8 : 16); // Zeichenzähler

  for (const b of bytes) push(b, 8);

  const capacityBits = dataCapacityBytes(version) * 8;
  if (bits.length > capacityBits) {
    throw new QrError(`Nutzlast passt nicht in Version ${version}.`);
  }

  // Abschlusszeichen: bis zu vier Nullbits, aber nur so viele wie noch passen.
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  // Auffüll-Codewörter im vorgeschriebenen Wechsel.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (bits.length < capacityBits) {
    push(padBytes[padIndex % 2], 8);
    padIndex++;
  }

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

/** Daten- und Prüfblöcke verschränken, wie die Norm es vorschreibt. */
function interleave(codewords, version) {
  const [ecCount, g1, g2] = EC_M[version];
  const blocks = [];
  let offset = 0;

  const take = (count, size) => {
    for (let i = 0; i < count; i++) {
      const data = codewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ec: rsEncode(data, ecCount) });
    }
  };
  take(g1[0], g1[1]);
  if (g2) take(g2[0], g2[1]);

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

// --- BCH-Codes für Format- und Versionsinformation --------------------------
//  Berechnet statt tabelliert: eine abgetippte Tabelle ist eine Fehlerquelle,
//  die Rechnung ist nachvollziehbar.

function bch(value, generator, generatorBits) {
  let rest = value << (generatorBits - 1);
  const total = bitLength(generator);
  while (bitLength(rest) >= total) {
    rest ^= generator << (bitLength(rest) - total);
  }
  return rest;
}

function bitLength(n) {
  let len = 0;
  while (n >>> len) len++;
  return len;
}

/** 15 Bit: 2 Bit Fehlerkorrekturstufe + 3 Bit Maske, BCH(15,5), XOR 0x5412. */
function formatBits(mask) {
  const EC_LEVEL_M = 0b00;
  const data = (EC_LEVEL_M << 3) | mask;
  return ((data << 10) | bch(data, 0b10100110111, 11)) ^ 0b101010000010010;
}

/**
 * 18 Bit ab Version 7: 6 Bit Version + 12 Bit BCH(18,6).
 * Generatorpolynom G(x) = x¹² + x¹¹ + x¹⁰ + x⁹ + x⁸ + x⁵ + x² + 1 = 0x1F25.
 * (Ein um die letzten Stellen gekürztes Polynom erzeugt einen Code, der bis
 * Version 6 unauffällig bleibt und erst ab Version 7 falsch wird — genau
 * dieser Fall fiel beim Abgleich mit python-qrcode auf.)
 */
function versionBits(version) {
  return (version << 12) | bch(version, 0b1111100100101, 13);
}

// --- Matrix -----------------------------------------------------------------

function createMatrix(version) {
  const size = version * 4 + 17;
  // null = noch frei; true/false = gesetztes Modul
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (row, col, dark, isFunction = true) => {
    modules[row][col] = dark;
    if (isFunction) reserved[row][col] = true;
  };

  // Suchmuster mit Trennern
  const placeFinder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || col < 0 || row >= size || col >= size) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row, col, inRing || inCore);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Taktmuster
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Ausrichtungsmuster (nicht über den Suchmustern)
  const centers = ALIGNMENT[version];
  for (const r of centers) {
    for (const c of centers) {
      const nearFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      }
    }
  }

  // Dunkles Modul
  set(size - 8, 8, true);

  // Formatbereiche freihalten
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) set(8, i, false);
    if (modules[i][8] === null) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === null) set(8, size - 1 - i, false);
    if (modules[size - 1 - i][8] === null) set(size - 1 - i, 8, false);
  }

  // Versionsbereiche ab Version 7 freihalten
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        set(size - 11 + j, i, false);
        set(i, size - 11 + j, false);
      }
    }
  }

  return { modules, reserved, size };
}

/** Daten im Zickzack von rechts unten nach oben einlegen. */
function placeData(matrix, data) {
  const { modules, reserved, size } = matrix;
  let bitIndex = 0;
  const totalBits = data.length * 8;
  const nextBit = () => {
    if (bitIndex >= totalBits) return false; // Restbits sind 0
    const bit = (data[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit === 1;
  };

  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Die Taktspalte 6 wird übersprungen.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row][col]) continue;
        modules[row][col] = nextBit();
      }
    }
    upward = !upward;
  }
}

const MASK_FN = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function applyMask(matrix, mask) {
  const { modules, reserved, size } = matrix;
  const fn = MASK_FN[mask];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) modules[r][c] = !modules[r][c];
    }
  }
}

function writeFormatAndVersion(matrix, version, mask) {
  const { modules, size } = matrix;
  const bits = formatBits(mask);
  const bit = (n) => ((bits >> n) & 1) === 1;

  // Reihenfolge: das höchstwertige Bit zuerst. (Die naheliegende Annahme
  // „Bit 0 zuerst" erzeugt einen Code, der strukturell einwandfrei aussieht,
  // aber nicht decodiert — der Abgleich mit segno hat genau das aufgedeckt.)

  // Erste Kopie: Zeile 8 nach rechts, dann Spalte 8 nach oben.
  for (let i = 0; i <= 5; i++) modules[8][i] = bit(14 - i);
  modules[8][7] = bit(8);
  modules[8][8] = bit(7);
  modules[7][8] = bit(6);
  for (let r = 0; r <= 5; r++) modules[r][8] = bit(r);

  // Zweite Kopie: Spalte 8 von unten, dann Zeile 8 nach rechts.
  // Das dunkle Modul liegt bei (size-8, 8) und wird davon nicht berührt.
  for (let i = 0; i <= 6; i++) modules[size - 1 - i][8] = bit(14 - i);
  for (let i = 0; i <= 7; i++) modules[8][size - 8 + i] = bit(7 - i);

  if (version >= 7) {
    const vbits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = ((vbits >> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      modules[r][c] = on;
      modules[c][r] = on;
    }
  }
}

// --- Maskenbewertung --------------------------------------------------------

function penalty(matrix) {
  const { modules, size } = matrix;
  let score = 0;

  // Regel 1: fünf oder mehr gleiche Module in Folge
  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) total += run - 2;
        run = 1;
      }
    }
    if (run >= 5) total += run - 2;
    return total;
  };
  for (let r = 0; r < size; r++) score += runScore(modules[r]);
  for (let c = 0; c < size; c++) score += runScore(modules.map((row) => row[c]));

  // Regel 2: gleichfarbige 2×2-Blöcke
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
    }
  }

  // Regel 3: suchmusterähnliche Folgen
  const PATTERN_A = [true, false, true, true, true, false, true, false, false, false, false];
  const PATTERN_B = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (line, start, pattern) => {
    for (let i = 0; i < pattern.length; i++) if (line[start + i] !== pattern[i]) return false;
    return true;
  };
  const scanLine = (line) => {
    let total = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      if (matches(line, i, PATTERN_A) || matches(line, i, PATTERN_B)) total += 40;
    }
    return total;
  };
  for (let r = 0; r < size; r++) score += scanLine(modules[r]);
  for (let c = 0; c < size; c++) score += scanLine(modules.map((row) => row[c]));

  // Regel 4: Abweichung vom Gleichgewicht hell/dunkel
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r][c]) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// --- Öffentliche Schnittstelle ----------------------------------------------

function utf8Bytes(text) {
  // TextEncoder gibt es in Node und im Browser — kein Polyfill nötig.
  return Array.from(new TextEncoder().encode(text));
}

function chooseVersion(byteLength) {
  for (const version of Object.keys(EC_M).map(Number).sort((a, b) => a - b)) {
    const headerBits = 4 + (version <= 9 ? 8 : 16);
    if (headerBits + byteLength * 8 <= dataCapacityBytes(version) * 8) return version;
  }
  throw new QrError(
    `Nutzlast von ${byteLength} Byte übersteigt Version 12 (Stufe M). ` +
      'Für längere Inhalte müssen die Versionstabellen erweitert werden.',
  );
}

/**
 * Erzeugt die Modul-Matrix.
 *
 * @param {string} text  Nutzlast (z. B. `bitcoin:bc1…?amount=0.001`)
 * @param {{mask?: number}} options  Maske erzwingen (sonst beste nach Bewertung)
 * @returns {{ size: number, modules: boolean[][], version: number, mask: number }}
 */
export function encodeQr(text, { mask = null } = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new QrError('Leere Nutzlast.');
  }
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  const codewords = interleave(buildBitStream(bytes, version), version);

  const build = (m) => {
    const matrix = createMatrix(version);
    placeData(matrix, codewords);
    // Restbits sind bereits 0, weil placeData jenseits der Daten `false` legt.
    void REMAINDER_BITS[version];
    applyMask(matrix, m);
    writeFormatAndVersion(matrix, version, m);
    return matrix;
  };

  let best;
  let bestMask;
  if (mask !== null) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 7) throw new QrError(`Maske ${mask} ungültig.`);
    best = build(mask);
    bestMask = mask;
  } else {
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      const candidate = build(m);
      const score = penalty(candidate);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
        bestMask = m;
      }
    }
  }

  return {
    size: best.size,
    modules: best.modules.map((row) => row.map(Boolean)),
    version,
    mask: bestMask,
  };
}

/**
 * QR als SVG-Zeichenkette. `dark`/`light` als CSS-Farben, damit sich der Code
 * in beide Themes einfügt — ein QR auf weißem Kasten im Dunkelmodus ist zwar
 * scannbar, sieht aber aus wie ein Fremdkörper.
 */
export function qrToSvg(text, { moduleSize = 4, quietZone = 4, dark = '#000', light = '#fff', mask = null } = {}) {
  const { modules, size } = encodeQr(text, { mask });
  const total = (size + quietZone * 2) * moduleSize;

  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      const x = (c + quietZone) * moduleSize;
      const y = (r + quietZone) * moduleSize;
      path += `M${x} ${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    '</svg>'
  );
}
