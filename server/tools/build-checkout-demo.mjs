#!/usr/bin/env node
// ============================================================================
//  Checkout-Demo bauen
// ============================================================================
//  Erzeugt aus tools/checkout-demo.src.html zwei Dateien:
//
//    public/checkout-demo.html          vollständiges Dokument, direkt im
//                                       Browser oder vom Server ausliefarbar
//    ../docs/demos/dynamic-checkout.html  nur der Inhalt, zum Veröffentlichen
//                                       als Artifact (dort kommt die Hülle
//                                       vom Dienst)
//
//  Drei Dinge werden eingebettet:
//
//   1. TAILWIND-CSS, erzeugt statt per CDN geladen. Ein CDN-Skript wäre in
//      einer eigenständigen Datei ein Ladefehler-Risiko — und beim Krypto-Teil
//      auch ein Datenschutzproblem, weil der Aufruf die Seite beim
//      CDN-Betreiber bekannt macht.
//
//   2. DIE ENGINE, unverändert aus src/domain/compliance.js, src/domain/qr.js,
//      src/data/plans.js und src/data/countries.js. Nicht nachgebaut: eine
//      zweite Fassung derselben Compliance-Regeln würde garantiert von der
//      ersten abweichen, und zwar an der teuersten denkbaren Stelle.
//
//   3. EIN ZEITSTEMPEL, damit sichtbar ist, wie alt der Stand ist.
//
//  Aufruf:  node tools/build-checkout-demo.mjs
//           node tools/build-checkout-demo.mjs --check   (Drift-Prüfung)
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const REPO = join(SERVER, '..');

const SRC = join(HERE, 'checkout-demo.src.html');
const OUT_PAGE = join(SERVER, 'public', 'checkout-demo.html');
const OUT_ARTIFACT = join(REPO, 'docs', 'demos', 'dynamic-checkout.html');

// Reihenfolge zählt: plans.js benutzt compliance.js.
const MODULES = [
  join(SERVER, 'src/data/countries.js'),
  // Die echten Empfangsadressen des Betreibers — nicht abgetippt, sondern
  // dieselbe Datei, die auch der Server benutzt.
  join(SERVER, 'src/data/cryptoWallets.js'),
  join(SERVER, 'src/domain/compliance.js'),
  join(SERVER, 'src/domain/qr.js'),
  join(SERVER, 'src/data/plans.js'),
];

// ---------------------------------------------------------------------------
//  ESM zu Browser-Skript
// ---------------------------------------------------------------------------
//  Die Module sind bewusst so geschrieben, dass diese Umwandlung trivial ist:
//  nur einzeilige `import`-Anweisungen, nur `export const/function/class` am
//  Zeilenanfang. Trifft das nicht zu, bricht der Build ab — lieber ein lauter
//  Fehler als eine still kaputte Datei.

function toBrowserScript(path) {
  const raw = readFileSync(path, 'utf8');
  const out = [];

  for (const line of raw.split('\n')) {
    if (/^import\s.*from\s+['"].*['"];?\s*$/.test(line)) continue; // interne Abhängigkeit
    if (/^import\s*\{[^}]*$/.test(line)) {
      throw new Error(`${path}: mehrzeiliger import — bitte einzeilig schreiben.`);
    }
    out.push(line.replace(/^export\s+(const|let|var|function|class|async)\b/, '$1'));
  }

  const text = out.join('\n');
  const leftover = text.split('\n').find((l) => /^\s*(import|export)\b/.test(l));
  if (leftover) {
    throw new Error(`${path}: nicht umwandelbar — "${leftover.trim().slice(0, 60)}"`);
  }
  return text;
}

function buildEngine() {
  return MODULES.map((path) => {
    const name = path.replace(SERVER + '/', '');
    return `/* ---- ${name} ---------------------------------------------- */\n${toBrowserScript(path)}`;
  }).join('\n\n');
}

// ---------------------------------------------------------------------------
//  Tailwind
// ---------------------------------------------------------------------------

function buildTailwind(html) {
  const bin = join(REPO, 'b2c', 'node_modules', '.bin', 'tailwindcss');
  if (!existsSync(bin)) {
    throw new Error(
      'Tailwind-CLI nicht gefunden.\n' +
        `  erwartet: ${bin}\n` +
        '  einmalig einrichten mit:  npm --prefix b2c install',
    );
  }

  const tmp = join(HERE, '.tw-tmp');
  mkdirSync(tmp, { recursive: true });
  const htmlPath = join(tmp, 'scan.html');
  const cssIn = join(tmp, 'in.css');
  const cfg = join(tmp, 'tailwind.config.cjs');

  writeFileSync(htmlPath, html);
  writeFileSync(
    cssIn,
    `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Wiederkehrende Bausteine als Komponenten — sonst stehen dieselben zwölf
   Utilities an fünfzehn Stellen und laufen bei der ersten Änderung auseinander. */
@layer components {
  .ctrl {
    @apply block min-h-[3rem] w-full rounded-lg border border-linestrong bg-surface px-3
           text-base text-ink;
  }
  .btn-primary {
    @apply inline-flex min-h-[3rem] items-center justify-center rounded-lg bg-accent px-5
           text-base font-semibold text-accentink transition-colors
           hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50;
  }
  .btn-secondary {
    @apply inline-flex min-h-[3rem] items-center justify-center rounded-lg border
           border-linestrong bg-surface px-5 text-base font-semibold text-ink
           transition-colors hover:bg-sunken;
  }
  .card {
    @apply rounded-lg border border-line bg-surface p-4 shadow-card;
  }
  .card-label {
    @apply text-xs font-semibold uppercase tracking-wider text-muted;
  }
  .chip {
    @apply inline-flex items-center rounded-full border border-line bg-sunken px-3 py-1
           text-sm font-medium;
  }
  .chip-brass {
    @apply inline-flex items-center rounded-full border border-brass/50 bg-surface px-3 py-1
           text-sm font-semibold;
  }
  .chip-fixed {
    @apply inline-flex items-center rounded-full bg-brass px-3 py-1 text-[11px] font-bold
           uppercase tracking-wide text-surface;
  }
  .tab {
    @apply inline-flex min-h-[3rem] items-center rounded-lg border px-4 text-base font-semibold
           transition-colors border-line bg-surface text-ink hover:bg-sunken
           aria-selected:border-accent aria-selected:bg-accentsoft;
  }
}
`,
  );
  writeFileSync(
    cfg,
    `const rgb = (v) => \`rgb(var(\${v}) / <alpha-value>)\`
module.exports = {
  content: [${JSON.stringify(htmlPath)}],
  theme: {
    extend: {
      colors: {
        ground: rgb('--ground'),
        surface: rgb('--surface'),
        sunken: rgb('--sunken'),
        raised: rgb('--raised'),
        ink: rgb('--ink'),
        muted: rgb('--ink-muted'),
        line: rgb('--line'),
        linestrong: rgb('--line-strong'),
        accent: rgb('--accent'),
        accentink: rgb('--accent-ink'),
        accentsoft: rgb('--accent-soft'),
        ok: rgb('--ok'),
        oksoft: rgb('--ok-soft'),
        warn: rgb('--warn'),
        warnsoft: rgb('--warn-soft'),
        stop: rgb('--stop'),
        stopsoft: rgb('--stop-soft'),
        brass: rgb('--brass'),
        brasssoft: rgb('--brass-soft'),
      },
      borderColor: { DEFAULT: rgb('--line') },
      boxShadow: { card: 'var(--shadow)' },
    },
  },
  plugins: [],
}
`,
  );

  const res = spawnSync(bin, ['-c', cfg, '-i', cssIn, '--minify'], { encoding: 'utf8' });
  rmSync(tmp, { recursive: true, force: true });

  if (res.status !== 0) {
    throw new Error('Tailwind fehlgeschlagen:\n' + (res.stderr || res.stdout || '').slice(-1200));
  }
  // Die CLI schreibt Hinweise auf stderr, das CSS auf stdout.
  return res.stdout.trim();
}

// ---------------------------------------------------------------------------

/**
 * Marke genau einmal ersetzen.
 *
 * `String.replace` mit einer Zeichenkette trifft nur das ERSTE Vorkommen.
 * Steht die Marke zusätzlich in einem erklärenden Kommentar, landet der Inhalt
 * dort — die Seite baut fehlerfrei und ist trotzdem tot. Genau das ist hier
 * einmal passiert, deshalb zählt diese Funktion nach.
 */
function replaceMarker(text, marker, value) {
  const count = text.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(
      `Marke ${marker} kommt ${count}× vor, erwartet genau 1×. ` +
        'Erwähnungen in Kommentaren bitte umschreiben.',
    );
  }
  return text.replace(marker, () => value);
}

function render() {
  const src = readFileSync(SRC, 'utf8');
  const engine = buildEngine();
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  // Tailwind muss das fertige Markup sehen — sonst fehlen Klassen, die erst
  // durch die Ersetzungen entstehen.
  const css = buildTailwind(replaceMarker(src, '__ENGINE_SOURCE__', engine));

  let content = replaceMarker(src, '__TAILWIND_CSS__', css);
  content = replaceMarker(content, '__ENGINE_SOURCE__', engine);
  content = replaceMarker(content, '__BUILD_STAMP__', stamp);

  // Für das vollständige Dokument muss der Inhalt an der richtigen Stelle
  // landen: <title>/<link>/<style> gehören in den Kopf, alles ab dem ersten
  // <div> in den Rumpf. Alles pauschal in den <head> zu schreiben ergibt zwar
  // dank fehlertoleranter Parser eine anzeigbare Seite, aber eben nicht die
  // Struktur, die man auszuliefern glaubt.
  const splitAt = content.indexOf('<div class="min-h-screen">');
  if (splitAt < 0) throw new Error('Rumpf-Anfang nicht gefunden (<div class="min-h-screen">).');

  const head = content.slice(0, splitAt).trimEnd();
  const body = content.slice(splitAt).trimEnd();

  const page =
    '<!doctype html>\n<html lang="de">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="color-scheme" content="light dark">\n' +
    '<meta name="description" content="ApoPulse — Länder-Compliance, Mehrwährungs-Abos und Hybrid-Zahlungen im Checkout.">\n' +
    head +
    '\n</head>\n<body>\n' +
    body +
    '\n</body>\n</html>\n';

  // Für das Artifact: Kopf-Elemente bleiben stehen, die Hülle kommt vom Dienst.
  return { page, content: content.trimEnd() + '\n' };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { page, content } = render();

  if (checkOnly) {
    // Zeitstempel ausklammern — sonst schlägt die Prüfung immer an.
    const strip = (s) => s.replace(/Build \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/, 'Build —');
    const problems = [];
    for (const [path, expected] of [[OUT_PAGE, page], [OUT_ARTIFACT, content]]) {
      if (!existsSync(path)) { problems.push(`${path} fehlt`); continue; }
      if (strip(readFileSync(path, 'utf8')) !== strip(expected)) problems.push(`${path} weicht ab`);
    }
    if (problems.length) {
      console.error('✗ Checkout-Demo ist nicht aktuell:\n  ' + problems.join('\n  '));
      console.error('  Neu bauen mit: node tools/build-checkout-demo.mjs');
      process.exit(1);
    }
    console.log('✓ Checkout-Demo ist aktuell.');
    return;
  }

  mkdirSync(dirname(OUT_ARTIFACT), { recursive: true });
  writeFileSync(OUT_PAGE, page);
  writeFileSync(OUT_ARTIFACT, content);

  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' kB';
  console.log(`✓ public/checkout-demo.html            ${kb(page)}`);
  console.log(`✓ docs/demos/dynamic-checkout.html     ${kb(content)}`);
}

main();
