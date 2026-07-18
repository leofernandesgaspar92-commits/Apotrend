// ApoTrend Self-Improvement-Loop — Schritt GATHER.
// Sammelt ECHTE, messbare Signale über den Code-/UX-Zustand (keine erfundenen
// Business-Zahlen). Node-Built-ins only, passend zum Projekt-Constraint.
//
// Aufruf:  node tools/loop-audit.mjs           (menschenlesbar)
//          node tools/loop-audit.mjs --json     (nur JSON, für den Loop)
//
// Die Zahlen sind Steuergrößen für THINK/ANALYSE: sinkende Test-Zahl, steigende
// TODOs, wachsende index.html, i18n-Drift zwischen de/en/pt = Handlungsbedarf.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jsonOnly = process.argv.includes('--json');

function countMatches(text, re) { return (text.match(re) || []).length; }

// 1) Tests: die harte Absicherung. count/pass/fail aus `node --test`.
function tests() {
  try {
    const out = execSync('node --test', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const g = (re) => (out.match(re) || [])[1];
    return { count: +g(/# tests (\d+)/), pass: +g(/# pass (\d+)/), fail: +g(/# fail (\d+)/) };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    const g = (re) => (out.match(re) || [])[1];
    return { count: +g(/# tests (\d+)/) || null, pass: +g(/# pass (\d+)/) || null, fail: +g(/# fail (\d+)/) || null, error: true };
  }
}

// 2) i18n-Parität: dieselben Schlüssel in de/en/pt? Fehlende = fehlende Übersetzung.
// KEIN Regex-Raten (an Apostrophen in Werten zerbricht das) — stattdessen das echte
// I18N-Objektliteral extrahieren und mit dem JS-Parser auswerten: 100 % exakt.
function i18nParity(html) {
  const anchor = 'const I18N = {';
  const start = html.indexOf(anchor);
  const close = html.indexOf('\n};', start);
  if (start < 0 || close < 0) return { de: null, en: null, pt: null, balanced: null, error: 'I18N nicht gefunden' };
  const objText = html.slice(start + anchor.length - 1, close + 2); // von '{' bis '}'
  let I18N;
  try { I18N = new Function(`return (${objText})`)(); }
  catch (e) { return { de: null, en: null, pt: null, balanced: null, error: 'eval: ' + e.message }; }
  const locales = ['de', 'en', 'pt'];
  const sets = Object.fromEntries(locales.map((l) => [l, new Set(Object.keys(I18N[l] || {}))]));
  const missing = (a, b) => [...sets[a]].filter((k) => !sets[b].has(k));
  const gaps = { en: missing('de', 'en'), pt: missing('de', 'pt') };
  const extra = { en: missing('en', 'de'), pt: missing('pt', 'de') }; // in en/pt, aber nicht de
  const counts = Object.fromEntries(locales.map((l) => [l, sets[l].size]));
  return {
    ...counts,
    gaps_en: gaps.en.length, gaps_pt: gaps.pt.length,
    extra_en: extra.en.length, extra_pt: extra.pt.length,
    gap_samples: [...new Set([...gaps.en, ...gaps.pt, ...extra.en, ...extra.pt])].slice(0, 10),
    balanced: gaps.en.length === 0 && gaps.pt.length === 0 && extra.en.length === 0 && extra.pt.length === 0,
  };
}

function run() {
  const html = rd('public/index.html');
  const srcFiles = execSync("find src public -name '*.js' -o -name '*.html'", { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const allSrc = srcFiles.map((f) => { try { return rd(f); } catch { return ''; } }).join('\n');

  const snapshot = {
    ts: new Date().toISOString(),
    tests: tests(),
    // Regressions-Wächter: hartkodierte Dialog-Strings (Ziel 0 — waren mal viele).
    hardcoded_dialogs: countMatches(html, /(confirm|alert|prompt)\('[^']*[a-zäöü][^']*'/gi),
    // Hartkodierte deutsche UI-Strings: UI-Eigenschaften (title/text/label/placeholder),
    // die einem deutschen Umlaut-Literal statt t() zugewiesen sind — außerhalb des I18N-
    // Wörterbuchs (dort ist Deutsch legitim). Fing Cycle #6 nicht ab -> jetzt Wächter.
    hardcoded_ui_de: (() => {
      // Übersetzungs-Wörterbücher ausblenden — dort sind literale UI-Texte legitim.
      let outside = html;
      for (const anchor of ['const I18N = {', 'const ZETTEL_L = {']) {
        const s = outside.indexOf(anchor);
        const e = s >= 0 ? outside.indexOf('\n};', s) : -1;
        if (s >= 0 && e > s) outside = outside.slice(0, s) + outside.slice(e + 3);
      }
      const hits = [];
      // (a) UI-Eigenschaft mit Mehrwort-Literal statt t().
      hits.push(...(outside.match(/\b(title|text|label):\s*'[^']* [^']*'/g) || []));
      // (b) Deutscher Umlaut-Text in <label>/placeholder OHNE data-i18n — die #8-Blindstelle.
      //     Der data-i18n-Ausschluss verhindert Fehlalarme auf legitimen Fallback-Texten.
      hits.push(...(outside.match(/<label(?![^>]*data-i18n)[^>]*>[^<]*[äöüßÄÖÜ][^<]*<\/label>/g) || []));
      hits.push(...(outside.match(/<(?:input|textarea)(?![^>]*data-i18n-ph)[^>]*placeholder="[^"]*[äöüßÄÖÜ][^"]*"/g) || []));
      // ${...}-Interpolationen sind bereits übersetzt -> als Fehlalarm ausschließen.
      const real = hits.filter((h) => !h.includes('${'));
      return { count: real.length, samples: real.slice(0, 6).map((x) => x.replace(/\s+/g, ' ').slice(0, 52)) };
    })(),
    // Dark-Mode-Falle: hartkodierte HELLE Hex-Hintergründe in INLINE-Styles (außerhalb
    // des <style>-Blocks). Im <style> ist das ok — dort überschreibt body.dark via
    // CSS-Variablen. Inline erreicht der Dark-Mode sie NICHT -> heller Text auf hellem
    // Grund (Cycle #36). Ziel 0: solche Flächen sollen theme-aware Variablen nutzen.
    hardcoded_light_bg: (() => {
      const styleEnd = html.indexOf('</style>');
      const body = styleEnd >= 0 ? html.slice(styleEnd) : html;
      // background(-color):#[d/e/f]xxxxx = helle Farbe (hoher Startwert).
      const hits = body.match(/background(-color)?:\s*#[def][0-9a-f]{5}/gi) || [];
      return { count: hits.length, samples: [...new Set(hits)].slice(0, 6) };
    })(),
    // i18n-Abdeckung (mehr = besser) und Drift-Check zwischen Sprachen.
    data_i18n_attrs: countMatches(html, /data-i18n(-ph|-title|-aria)?=/g),
    i18n_parity: i18nParity(html),
    // Aufräum-Signale (Trend beobachten, nicht Nulldogma):
    todos: countMatches(allSrc, /\b(TODO|FIXME|XXX|HACK)\b/g),
    frontend_console: countMatches(html, /console\.(log|warn|error|debug)\(/g),
    css_important: countMatches(html, /!important/g),
    // Wartbarkeit: die Single-File-SPA wächst — Größe im Blick behalten.
    index_html: { lines: html.split('\n').length, kb: Math.round(Buffer.byteLength(html) / 1024) },
  };

  if (jsonOnly) { process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n'); return; }

  const t = snapshot.tests;
  const p = snapshot.i18n_parity;
  console.log('── ApoTrend Loop · GATHER-Snapshot ──', snapshot.ts);
  console.log(`Tests:              ${t.pass}/${t.count} grün${t.fail ? `  ⚠️ ${t.fail} rot` : ''}`);
  console.log(`i18n-Attribute:     ${snapshot.data_i18n_attrs}   Schlüssel de/en/pt: ${p.de}/${p.en}/${p.pt}`);
  console.log(`i18n-Lücken:        en fehlen ${p.gaps_en}, pt fehlen ${p.gaps_pt} ${p.balanced ? '✓' : '⚠️ ' + (p.gap_samples || []).join(', ')}`);
  console.log(`Hartkod. Dialoge:   ${snapshot.hardcoded_dialogs} ${snapshot.hardcoded_dialogs === 0 ? '✓' : '⚠️'}`);
  const hu = snapshot.hardcoded_ui_de;
  console.log(`Hartkod. UI-DE:     ${hu.count} ${hu.count === 0 ? '✓' : '⚠️ ' + hu.samples.join(' | ')}`);
  const lb = snapshot.hardcoded_light_bg;
  console.log(`Helle Inline-BGs:   ${lb.count} ${lb.count === 0 ? '✓' : '⚠️ ' + lb.samples.join(' | ')}`);
  console.log(`TODO/FIXME:         ${snapshot.todos}`);
  console.log(`console.* (FE):     ${snapshot.frontend_console}`);
  console.log(`!important (CSS):   ${snapshot.css_important}`);
  console.log(`index.html:         ${snapshot.index_html.lines} Zeilen · ${snapshot.index_html.kb} KB`);
}

run();
