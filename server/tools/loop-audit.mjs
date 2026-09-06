// ApoPulse Self-Improvement-Loop — Schritt GATHER.
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
// In `npm run verify` läuft `node --test` bereits als Gate VOR diesem Audit (&&-Kette),
// grün ist dort also garantiert. --skip-tests vermeidet den doppelten (teuren) Testlauf.
const skipTests = process.argv.includes('--skip-tests');

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
  // Frontend ist seit der Monolith-Entflechtung dreigeteilt: Markup (index.html),
  // Logik+i18n (app.js), Styles (app.css). Jede Prüfung liest die richtige Quelle.
  const html = rd('public/index.html');
  // Die Sprachtexte liegen seit dem 06.09.2026 in public/i18n.js. Beide
  // Dateien zusammen ergeben das, was der Browser sieht — die Pruefungen
  // unten (Sprachparitaet, hartkodierte Texte) muessen ueber beide laufen,
  // sonst meldet die Paritaetspruefung ploetzlich 0/0/0 und sieht dabei
  // gruen aus.
  const appJs = rd('public/app.js');
  const i18nJs = rd('public/i18n.js');
  const js = i18nJs + '\n' + appJs;
  const css = (() => { try { return rd('public/app.css'); } catch { return ''; } })();
  const frontend = html + '\n' + js; // für Prüfungen, die Markup UND JS-Templates umspannen
  const srcFiles = execSync("find src public -name '*.js' -o -name '*.html'", { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const allSrc = srcFiles.map((f) => { try { return rd(f); } catch { return ''; } }).join('\n');

  const snapshot = {
    ts: new Date().toISOString(),
    tests: skipTests ? { skipped: true } : tests(),
    // Regressions-Wächter: hartkodierte Dialog-Strings (Ziel 0 — waren mal viele).
    hardcoded_dialogs: countMatches(js, /(confirm|alert|prompt)\('[^']*[a-zäöü][^']*'/gi),
    // Hartkodierte deutsche UI-Strings: UI-Eigenschaften (title/text/label/placeholder),
    // die einem deutschen Umlaut-Literal statt t() zugewiesen sind — außerhalb des I18N-
    // Wörterbuchs (dort ist Deutsch legitim). Fing Cycle #6 nicht ab -> jetzt Wächter.
    hardcoded_ui_de: (() => {
      // Übersetzungs-Wörterbücher ausblenden — dort sind literale UI-Texte legitim.
      let outside = frontend;
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
      // (c) Deutsche UI-Wörter als LITERALER HTML-Textinhalt in Template-Literalen
      //     (z.B. `>Quelle 🔗</a>`, `>Quelle: …`). Genau diese Klasse fanden manuelle
      //     Sweeps, aber (a)/(b) verfehlten sie: kein Property, kein <label>, kein Umlaut.
      //     Das führende `>` verankert echten Textinhalt und schließt Kommentare (dort
      //     steht kein `>` vor dem Wort) sowie Wörterbuch-Werte (dort `:'Wort'`) aus.
      hits.push(...(outside.match(/>(?:Quelle|Drucken|Speichern|Löschen|Abbrechen|Schließen|Zurück|Senden|Melden|Bearbeiten|Kopieren|Hinzufügen|Entfernen|Absenden)\b/g) || []));
      // ${...}-Interpolationen sind bereits übersetzt -> als Fehlalarm ausschließen.
      const real = hits.filter((h) => !h.includes('${'));
      return { count: real.length, samples: real.slice(0, 6).map((x) => x.replace(/\s+/g, ' ').slice(0, 52)) };
    })(),
    // Hartkodierter Text in JS-DOM-Zuweisungen (.textContent/.title/.placeholder = 'Wort…'
    // bzw. setAttribute('aria-label'|'title'|'placeholder'|'alt', 'Wort…')). Umgeht die
    // UI-DE-Heuristik (kein Markup, kein t()). Fängt jetzt auch umlautloses Deutsch, das
    // Cycle #61 durchrutschte: JEDES Literal mit 4+ zusammenhängenden Buchstaben, das nicht
    // über t() kommt (Lade-Spinner ausgenommen) — user-sichtbarer Text gehört in t().
    hardcoded_js_de: (() => {
      const seen = new Set();
      // Den GANZEN Ausdruck bis zum Statement-Ende betrachten (auch Ternäre wie a?'X':'Y' —
      // genau die Form, die Cycle #61 durchrutschte). t()/ti()-Aufrufe vorher entfernen,
      // dann jedes verbleibende Literal mit 4+ Buchstaben melden (Lade-Spinner ausgenommen).
      const stmtRe = /(?:\.(?:textContent|title|placeholder)\s*=|setAttribute\('(?:aria-label|title|placeholder|alt)',)([^;\n]*)/g;
      let m;
      while ((m = stmtRe.exec(js))) {
        // t()/ti()/getAttribute()-Aufrufe herauslösen — deren String-Argumente sind Keys/
        // Attributnamen, kein UI-Text.
        const expr = m[1].replace(/\b(?:ti?|getAttribute)\('[^']*'\)?/g, '');
        let lm; const litRe = /'([^']*)'/g;
        while ((lm = litRe.exec(expr))) {
          const val = lm[1];
          // Nur echter UI-Text: 4+ Buchstaben UND enthält Großbuchstabe, Leerzeichen oder
          // Nicht-ASCII (Umlaut/Emoji). Reine lowercase-hyphen-Tokens (Keys/Attr) fallen raus.
          if (/[A-Za-zÄÖÜäöü]{4,}/.test(val) && /[A-ZÄÖÜ]|\s|[^\x00-\x7f]/.test(val) && !/class="loading"/.test(val)) {
            seen.add(val.replace(/\s+/g, ' ').slice(0, 40));
          }
        }
      }
      const hits = [...seen];
      return { count: hits.length, samples: hits.slice(0, 6) };
    })(),
    // Dark-Mode-Falle: hartkodierte HELLE Hex-Hintergründe in INLINE-Styles (in den
    // JS-Template-Literalen). In app.css ist Hex ok — dort überschreibt body.dark via
    // CSS-Variablen. Inline erreicht der Dark-Mode sie NICHT -> heller Text auf hellem
    // Grund (Cycle #36). Ziel 0: solche Flächen sollen theme-aware Variablen nutzen.
    hardcoded_light_bg: (() => {
      // background(-color):#[d/e/f]xxxxx = helle Farbe (hoher Startwert) in Markup + JS-Inline-Styles.
      const hits = frontend.match(/background(-color)?:\s*#[def][0-9a-f]{5}/gi) || [];
      return { count: hits.length, samples: [...new Set(hits)].slice(0, 6) };
    })(),
    // i18n-Abdeckung (mehr = besser) und Drift-Check zwischen Sprachen.
    data_i18n_attrs: countMatches(frontend, /data-i18n(-ph|-title|-aria)?=/g),
    i18n_parity: i18nParity(js),
    // Aufräum-Signale (Trend beobachten, nicht Nulldogma):
    todos: countMatches(allSrc, /\b(TODO|FIXME|XXX|HACK)\b/g),
    frontend_console: countMatches(js, /console\.(log|warn|error|debug)\(/g),
    css_important: countMatches(css + js, /!important/g),
    // Wartbarkeit nach Entflechtung: Markup, Logik und Styles getrennt im Blick behalten.
    index_html: { lines: html.split('\n').length, kb: Math.round(Buffer.byteLength(html) / 1024) },
    app_js: { lines: appJs.split('\n').length, kb: Math.round(Buffer.byteLength(appJs) / 1024) },
    i18n_js: { lines: i18nJs.split('\n').length, kb: Math.round(Buffer.byteLength(i18nJs) / 1024) },
    app_css: { lines: css.split('\n').length, kb: Math.round(Buffer.byteLength(css) / 1024) },
  };

  if (jsonOnly) { process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n'); return; }

  const t = snapshot.tests;
  const p = snapshot.i18n_parity;
  console.log('── ApoPulse Loop · GATHER-Snapshot ──', snapshot.ts);
  console.log(t.skipped
    ? 'Tests:              im Gate geprüft ✓ (node --test lief in der verify-Kette davor)'
    : `Tests:              ${t.pass}/${t.count} grün${t.fail ? `  ⚠️ ${t.fail} rot` : ''}`);
  console.log(`i18n-Attribute:     ${snapshot.data_i18n_attrs}   Schlüssel de/en/pt: ${p.de}/${p.en}/${p.pt}`);
  console.log(`i18n-Lücken:        en fehlen ${p.gaps_en}, pt fehlen ${p.gaps_pt} ${p.balanced ? '✓' : '⚠️ ' + (p.gap_samples || []).join(', ')}`);
  console.log(`Hartkod. Dialoge:   ${snapshot.hardcoded_dialogs} ${snapshot.hardcoded_dialogs === 0 ? '✓' : '⚠️'}`);
  const hu = snapshot.hardcoded_ui_de;
  console.log(`Hartkod. UI-DE:     ${hu.count} ${hu.count === 0 ? '✓' : '⚠️ ' + hu.samples.join(' | ')}`);
  const lb = snapshot.hardcoded_light_bg;
  console.log(`Helle Inline-BGs:   ${lb.count} ${lb.count === 0 ? '✓' : '⚠️ ' + lb.samples.join(' | ')}`);
  const jd = snapshot.hardcoded_js_de;
  console.log(`Hartkod. JS-DE:     ${jd.count} ${jd.count === 0 ? '✓' : '⚠️ ' + jd.samples.join(' | ')}`);
  console.log(`TODO/FIXME:         ${snapshot.todos}`);
  console.log(`console.* (FE):     ${snapshot.frontend_console}`);
  console.log(`!important (CSS):   ${snapshot.css_important}`);
  console.log(`Frontend-Größe:     index.html ${snapshot.index_html.lines} Z · app.js ${snapshot.app_js.lines} Z (${snapshot.app_js.kb} KB) · i18n.js ${snapshot.i18n_js.lines} Z (${snapshot.i18n_js.kb} KB) · app.css ${snapshot.app_css.lines} Z`);
}

run();
