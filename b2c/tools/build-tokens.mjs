#!/usr/bin/env node
// ============================================================================
//  Token-Generator: tokens.mjs  ->  src/styles/tokens.css
// ============================================================================
//  Die CSS-Variablen werden NICHT von Hand gepflegt. Damit kann die CSS-Datei
//  nicht von der geprüften Quelle abweichen (und das Kontrast-Gate nicht ins
//  Leere prüfen).
//
//    node tools/build-tokens.mjs           schreibt die Datei
//    node tools/build-tokens.mjs --check   prüft nur (CI: Drift-Wächter)
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { themes } from '../src/styles/tokens.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'src', 'styles', 'tokens.css')

/** '#RRGGBB' -> 'R G B' (Tailwind-freundlich: erlaubt rgb(var(--x) / <alpha>)) */
function toChannels(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function block(selector, tokens, extra = '') {
  const lines = Object.entries(tokens)
    .map(([name, hex]) => `  --${name}: ${toChannels(hex)}; /* ${hex} */`)
    .join('\n')
  return `${selector} {\n${extra}${lines}\n}`
}

const header = `/* =============================================================
 * ERZEUGTE DATEI — NICHT VON HAND BEARBEITEN.
 * Quelle: src/styles/tokens.mjs   Generator: tools/build-tokens.mjs
 * Änderungen hier gehen beim nächsten Build verloren und lassen
 * "npm run check:tokens" fehlschlagen.
 * ============================================================= */`

const css = [
  header,
  block(':root', themes.light, '  color-scheme: light;\n'),
  block('[data-theme="dark"]', themes.dark, '  color-scheme: dark;\n'),
  '',
].join('\n\n')

const isCheck = process.argv.includes('--check')

if (isCheck) {
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    console.error('✗ tokens.css fehlt — `npm run build:tokens` ausführen.')
    process.exit(1)
  }
  if (current !== css) {
    console.error('✗ tokens.css weicht von tokens.mjs ab (Design-Drift).')
    console.error('  Beheben mit: npm run build:tokens')
    process.exit(1)
  }
  console.log('✓ tokens.css ist synchron mit tokens.mjs.')
  process.exit(0)
}

writeFileSync(target, css, 'utf8')
const count = Object.keys(themes.light).length + Object.keys(themes.dark).length
console.log(`✓ tokens.css geschrieben (${count} Variablen, 2 Themes).`)
