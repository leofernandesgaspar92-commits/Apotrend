#!/usr/bin/env node
// ============================================================================
//  WCAG-2.1-Kontrast-Gate
// ============================================================================
//  Prüft JEDE in tokens.mjs zugesagte Farbpaarung in BEIDEN Themes und bricht
//  den Build ab, wenn eine Zusage verletzt wird.
//
//  Warum eigenständig statt axe/Lighthouse: Diese beiden prüfen nur, was auf
//  einer gerenderten Seite gerade sichtbar ist. Ein Badge, das nur im Fehlerfall
//  erscheint, wird dort nie geprüft. Hier wird die PALETTE selbst geprüft —
//  vollständig, in Millisekunden, ohne Browser.
//
//  Aufruf:  node tools/check-contrast.mjs
// ============================================================================

import { themes, contrastPairs } from '../src/styles/tokens.mjs'

/** '#RRGGBB' -> [r, g, b] mit 0..255 */
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) throw new Error(`Kein gültiger Hex-Wert: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Relative Leuchtdichte nach WCAG 2.1 */
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhältnis nach WCAG 2.1 (1..21) */
export function contrastRatio(hexA, hexB) {
  const la = luminance(hexA)
  const lb = luminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const round = (n) => Math.round(n * 100) / 100

function run() {
  const failures = []
  const results = []

  for (const [themeName, tokens] of Object.entries(themes)) {
    for (const pair of contrastPairs) {
      const fg = tokens[pair.fg]
      const bg = tokens[pair.bg]

      // Ein fehlender Token ist selbst ein Fehler — sonst prüft das Gate ins Leere.
      if (!fg || !bg) {
        failures.push({
          theme: themeName, ...pair,
          ratio: null,
          reason: `Token fehlt: ${!fg ? pair.fg : pair.bg}`,
        })
        continue
      }

      const ratio = contrastRatio(fg, bg)
      const ok = ratio >= pair.min
      results.push({ theme: themeName, ...pair, fgHex: fg, bgHex: bg, ratio, ok })
      if (!ok) failures.push({ theme: themeName, ...pair, fgHex: fg, bgHex: bg, ratio })
    }
  }

  const pad = (s, n) => String(s).padEnd(n)
  console.log('── Kontrast-Gate (WCAG 2.1 AA) ─────────────────────────────────')
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗'
    console.log(
      `${mark} ${pad(r.theme, 5)} ${pad(r.note, 32)} ${pad(round(r.ratio) + ':1', 8)} (min ${r.min})`,
    )
  }

  console.log('')
  if (failures.length === 0) {
    console.log(`✓ Alle ${results.length} Paarungen erfüllen die Zusage.`)
    return 0
  }

  console.log(`✗ ${failures.length} von ${results.length} Paarungen verletzen die Zusage:`)
  for (const f of failures) {
    if (f.reason) {
      console.log(`  - [${f.theme}] ${f.note}: ${f.reason}`)
    } else {
      console.log(
        `  - [${f.theme}] ${f.note}: ${round(f.ratio)}:1 < ${f.min}:1` +
          `  (${f.fg}=${f.fgHex} auf ${f.bg}=${f.bgHex})`,
      )
    }
  }
  return 1
}

process.exit(run())
