#!/usr/bin/env node
// ============================================================================
//  Demo-Medien erzeugen — echte Dateien, keine Attrappen
// ============================================================================
//  Der Feed, der GIF-Picker und die Kommentar-Anhänge brauchen Medien, die im
//  Browser wirklich laden. Fremdmaterial (Stockfotos, Tenor-Downloads) wandert
//  aber nicht ungefragt in ein fremdes Repo — Lizenzlage unklar.
//
//  Deshalb werden die Demo-Medien hier ERZEUGT:
//    · Bilder + Video-Poster als SVG (vektoriell, winzig, in beiden Themes lesbar)
//    · GIFs als echte, animierte GIF89a-Dateien mit eigenem LZW-Encoder
//    · Untertitel als echtes WebVTT
//
//  Aufruf:  node tools/make-demo-media.mjs        (schreibt nach public/media)
//           node tools/make-demo-media.mjs --check (prüft nur, ob alles da ist)
// ============================================================================

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'media')

// ---------------------------------------------------------------------------
//  GIF89a-Encoder
// ---------------------------------------------------------------------------
//  Bewusst mit FESTER Codebreite (9 Bit, minCodeSize 8) und einem Clear-Code
//  alle 200 Wörterbuch-Einträge. Damit entfällt die Umschaltung der Codebreite
//  komplett — genau dort sitzt bei LZW-Implementierungen der klassische
//  Off-by-one, der Dateien erzeugt, die in manchen Decodern kaputt aussehen.
//  Die Dateien werden dadurch ein paar hundert Byte größer. Bei 96×96 Pixeln
//  ist das der richtige Tausch.

function lzwEncode(indices) {
  const MIN_CODE_SIZE = 8
  const CLEAR = 1 << MIN_CODE_SIZE // 256
  const EOI = CLEAR + 1 // 257
  const CODE_SIZE = MIN_CODE_SIZE + 1 // 9 Bit, konstant
  const RESET_AFTER = 200 // < 511 - 258, also nie Überlauf

  const out = []
  let bitBuffer = 0
  let bitCount = 0

  const emit = (code) => {
    bitBuffer |= code << bitCount
    bitCount += CODE_SIZE
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff)
      bitBuffer >>= 8
      bitCount -= 8
    }
  }

  let dict = new Map()
  let nextCode = EOI + 1
  const resetDict = () => {
    dict = new Map()
    nextCode = EOI + 1
  }

  resetDict()
  emit(CLEAR)

  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const combined = prefix + ',' + k
    if (dict.has(combined)) {
      prefix = combined
      continue
    }
    emit(dict.has(prefix) ? dict.get(prefix) : Number(prefix))
    dict.set(combined, nextCode++)
    if (nextCode - (EOI + 1) >= RESET_AFTER) {
      emit(CLEAR)
      resetDict()
    }
    prefix = String(k)
  }
  emit(dict.has(prefix) ? dict.get(prefix) : Number(prefix))
  emit(EOI)
  if (bitCount > 0) out.push(bitBuffer & 0xff)

  return out
}

/** Datenblöcke à max. 255 Byte, wie das Format es verlangt. */
function subBlocks(bytes) {
  const out = []
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0x00)
  return out
}

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff]

/**
 * @param {{width:number,height:number,palette:number[][],frames:number[][],delayCs:number}} spec
 *   `frames` sind Arrays aus Paletten-Indizes, ein Eintrag je Pixel.
 */
function encodeGif({ width, height, palette, frames, delayCs }) {
  const bytes = []
  const push = (...b) => bytes.push(...b)

  // Header + Logical Screen Descriptor
  push(...[...'GIF89a'].map((c) => c.charCodeAt(0)))
  push(...u16(width), ...u16(height))
  // Globale Farbtabelle vorhanden (0x80) | Farbtiefe 8 (0x70) | Tabellengröße 256 (0x07)
  push(0x80 | 0x70 | 0x07, 0x00, 0x00)

  // Globale Farbtabelle: immer volle 256 Einträge (passend zu minCodeSize 8)
  for (let i = 0; i < 256; i++) {
    const c = palette[i] ?? [0, 0, 0]
    push(c[0], c[1], c[2])
  }

  // Netscape-Erweiterung: Endlosschleife
  push(0x21, 0xff, 0x0b)
  push(...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)))
  push(0x03, 0x01, ...u16(0), 0x00)

  for (const frame of frames) {
    // Graphic Control Extension: Verzögerung, kein Transparenz-Index
    push(0x21, 0xf9, 0x04, 0x04, ...u16(delayCs), 0x00, 0x00)
    // Image Descriptor: volle Fläche, keine lokale Farbtabelle, nicht interlaced
    push(0x2c, ...u16(0), ...u16(0), ...u16(width), ...u16(height), 0x00)
    push(8) // LZW minimum code size
    push(...subBlocks(lzwEncode(frame)))
  }

  push(0x3b) // Trailer
  return Buffer.from(bytes)
}

// ---------------------------------------------------------------------------
//  Bildinhalte der GIFs — kleine, klare Pikto-Animationen
// ---------------------------------------------------------------------------

const PALETTE = [
  [250, 249, 247], // 0 Fläche hell
  [11, 61, 46], // 1 Offizin-Grün dunkel
  [26, 122, 90], // 2 Offizin-Grün
  [180, 226, 208], // 3 Offizin-Grün hell
  [30, 64, 124], // 4 Medizin-Blau
  [214, 158, 46], // 5 Warm/Gold
  [140, 40, 32], // 6 Rot
  [90, 86, 80], // 7 Neutral
]

/** Malfläche mit einfachen Primitiven — reicht für Piktogramme vollkommen. */
function canvas(size, bg = 0) {
  const px = new Array(size * size).fill(bg)
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < size && y < size) px[y * size + x] = c
  }
  return {
    px,
    set,
    disc(cx, cy, r, c) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c)
    },
    rect(x0, y0, w, h, c) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c)
    },
    ring(cx, cy, r, thickness, c) {
      const inner = (r - thickness) ** 2
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = (x - cx) ** 2 + (y - cy) ** 2
          if (d <= r * r && d >= inner) set(x, y, c)
        }
    },
  }
}

const S = 96

/** „Danke" — winkende Hand, drei Neigungen. */
function gifDanke() {
  return [-1, 0, 1, 0].map((tilt) => {
    const c = canvas(S)
    c.disc(48, 52, 30, 3)
    // Handfläche
    c.rect(38 + tilt * 4, 40, 22, 30, 5)
    // Finger
    for (let f = 0; f < 4; f++) c.rect(38 + tilt * 4 + f * 6, 26 + Math.abs(tilt) * 3, 4, 16, 5)
    // Daumen
    c.rect(32 + tilt * 4, 44, 6, 12, 5)
    return c.px
  })
}

/** „Informativ" — Glühbirne, die an- und ausgeht. */
function gifInformativ() {
  return [0, 1, 2, 1].map((step) => {
    const c = canvas(S)
    const glow = [3, 5, 5][step] ?? 3
    if (step > 0) c.disc(48, 42, 30 + step * 3, 3)
    c.disc(48, 42, 22, glow)
    c.ring(48, 42, 22, 3, 1)
    c.rect(40, 62, 16, 8, 7)
    c.rect(42, 70, 12, 6, 1)
    return c.px
  })
}

/** „Hilfreich" — pulsierendes Herz aus zwei Kreisen und einem Dreieck. */
function gifHilfreich() {
  return [0, 1, 2, 1].map((step) => {
    const c = canvas(S)
    const r = 16 + step * 2
    c.disc(48 - r * 0.55, 40, r, 6)
    c.disc(48 + r * 0.55, 40, r, 6)
    for (let y = 0; y < r * 2.2; y++) {
      const half = Math.round(r * 1.35 * (1 - y / (r * 2.2)))
      c.rect(48 - half, 40 + y - 2, half * 2, 1, 6)
    }
    return c.px
  })
}

/** „Erinnerung" — Wecker mit wanderndem Zeiger. */
function gifErinnerung() {
  return [0, 1, 2, 3].map((step) => {
    const c = canvas(S)
    c.disc(48, 50, 32, 4)
    c.disc(48, 50, 27, 0)
    c.rect(44, 14, 8, 8, 4)
    const angle = (step / 4) * Math.PI * 2 - Math.PI / 2
    for (let r = 0; r < 20; r++)
      c.disc(48 + Math.cos(angle) * r, 50 + Math.sin(angle) * r, 1.5, 6)
    c.disc(48, 50, 3, 1)
    return c.px
  })
}

// ---------------------------------------------------------------------------
//  SVG-Inhalte — Hero-Bilder und Video-Poster
// ---------------------------------------------------------------------------
//  Alle Farben fest kodiert: eine SVG-Datei kennt die CSS-Variablen der Seite
//  nicht. Die Werte stammen aus derselben Palette wie tokens.mjs, damit die
//  Bilder im Feed nicht aus dem Rahmen fallen.

function svg(width, height, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${title}">
<title>${title}</title>
${body}
</svg>
`
}

const heroBlister = svg(
  1200,
  675,
  `<rect width="1200" height="675" fill="#eaf5f0"/>
<g transform="translate(150 130)">
  <rect x="0" y="0" width="900" height="420" rx="28" fill="#ffffff" stroke="#1a7a5a" stroke-width="6"/>
  ${Array.from({ length: 10 }, (_, i) => {
    const col = i % 5
    const row = Math.floor(i / 5)
    const x = 90 + col * 160
    const y = 110 + row * 180
    return `<g><rect x="${x - 52}" y="${y - 42}" width="104" height="84" rx="42" fill="#eaf5f0" stroke="#1a7a5a" stroke-width="5"/><rect x="${x - 2}" y="${y - 42}" width="4" height="84" fill="#1a7a5a" opacity="0.45"/></g>`
  }).join('\n  ')}
</g>`,
  'Tablettenblister mit zehn Tabletten',
)

const heroSpray = svg(
  1200,
  675,
  `<rect width="1200" height="675" fill="#e8eef8"/>
<g transform="translate(470 90)">
  <rect x="40" y="150" width="180" height="380" rx="34" fill="#ffffff" stroke="#1e407c" stroke-width="7"/>
  <rect x="96" y="70" width="68" height="90" rx="14" fill="#1e407c"/>
  <rect x="78" y="34" width="104" height="44" rx="16" fill="#1e407c"/>
  <rect x="72" y="250" width="116" height="180" rx="14" fill="#cfe0f5"/>
</g>
<g fill="#1e407c" opacity="0.55">
  ${Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI - Math.PI / 2
    return `<circle cx="${600 + Math.cos(a) * (120 + i * 9)}" cy="${100 + Math.sin(a) * 60}" r="${9 - i * 0.4}"/>`
  }).join('\n  ')}
</g>`,
  'Nasenspray-Flasche mit angedeutetem Sprühnebel',
)

const posterReel = svg(
  720,
  1280,
  `<rect width="720" height="1280" fill="#0b3d2e"/>
<circle cx="360" cy="560" r="150" fill="#ffffff" opacity="0.14"/>
<path d="M320 490 L470 560 L320 630 Z" fill="#ffffff"/>
<rect x="90" y="820" width="540" height="18" rx="9" fill="#ffffff" opacity="0.85"/>
<rect x="90" y="870" width="420" height="18" rx="9" fill="#ffffff" opacity="0.6"/>
<rect x="90" y="920" width="330" height="18" rx="9" fill="#ffffff" opacity="0.4"/>`,
  'Videovorschau: Anleitung zur Anwendung eines Nasensprays',
)

const heroWinter = svg(
  1200,
  675,
  `<rect width="1200" height="675" fill="#fdf6e6"/>
<circle cx="930" cy="180" r="110" fill="#d69e2e" opacity="0.85"/>
<g stroke="#d69e2e" stroke-width="10" stroke-linecap="round" opacity="0.6">
  ${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return `<line x1="${930 + Math.cos(a) * 135}" y1="${180 + Math.sin(a) * 135}" x2="${930 + Math.cos(a) * 175}" y2="${180 + Math.sin(a) * 175}"/>`
  }).join('\n  ')}
</g>
<path d="M0 470 L200 350 L380 470 L560 300 L760 470 L980 380 L1200 470 L1200 675 L0 675 Z" fill="#1a7a5a" opacity="0.9"/>
<path d="M0 545 L260 460 L520 560 L820 470 L1200 560 L1200 675 L0 675 Z" fill="#0b3d2e"/>`,
  'Tief stehende Wintersonne über einer Hügellandschaft',
)

// ---------------------------------------------------------------------------

const FILES = {
  'hero-blister.svg': heroBlister,
  'hero-spray.svg': heroSpray,
  'hero-winter.svg': heroWinter,
  'poster-anwendung.svg': posterReel,
  'gif-danke.gif': () => encodeGif({ width: S, height: S, palette: PALETTE, frames: gifDanke(), delayCs: 18 }),
  'gif-informativ.gif': () =>
    encodeGif({ width: S, height: S, palette: PALETTE, frames: gifInformativ(), delayCs: 22 }),
  'gif-hilfreich.gif': () =>
    encodeGif({ width: S, height: S, palette: PALETTE, frames: gifHilfreich(), delayCs: 20 }),
  'gif-erinnerung.gif': () =>
    encodeGif({ width: S, height: S, palette: PALETTE, frames: gifErinnerung(), delayCs: 25 }),
  'anwendung.vtt': `WEBVTT

00:00:00.000 --> 00:00:04.000
Vor der ersten Anwendung die Pumpe mehrmals betätigen,
bis ein feiner Nebel entsteht.

00:00:04.000 --> 00:00:09.000
Den Kopf aufrecht halten und ein Nasenloch mit dem Finger
leicht zuhalten.

00:00:09.000 --> 00:00:14.000
Beim Sprühen langsam durch die Nase einatmen —
nicht kräftig hochziehen.

00:00:14.000 --> 00:00:18.000
Nach Gebrauch die Sprühöffnung abwischen und
die Schutzkappe aufsetzen.
`,
}

function main() {
  const checkOnly = process.argv.includes('--check')

  if (checkOnly) {
    const missing = Object.keys(FILES).filter((name) => !existsSync(join(OUT, name)))
    if (missing.length > 0) {
      console.error(`✗ Demo-Medien fehlen: ${missing.join(', ')}`)
      console.error('  Erzeugen mit: node tools/make-demo-media.mjs')
      process.exit(1)
    }
    console.log(`✓ Demo-Medien vollständig (${Object.keys(FILES).length} Dateien).`)
    return
  }

  mkdirSync(OUT, { recursive: true })
  for (const [name, content] of Object.entries(FILES)) {
    const data = typeof content === 'function' ? content() : content
    writeFileSync(join(OUT, name), data)
    const size = typeof data === 'string' ? Buffer.byteLength(data) : data.length
    console.log(`  ${name.padEnd(24)} ${String(size).padStart(6)} Byte`)
  }
  console.log(`✓ ${Object.keys(FILES).length} Demo-Medien in public/media erzeugt.`)
}

main()
