// Owner-Regel (CLAUDE.md): „Gut lesbar vor maximaler Dichte: keine Winzig-Schrift".
// Bis 10/2026 standen 128 Stellen auf 11–12 px (Rechtshinweise, Badges, Zeitstempel) —
// genau die Texte, die Apotheker:innen am Handy im Laden lesen müssen. Untergrenze 13 px;
// der Browser-Audit prüft dieselbe Grenze an den berechneten Größen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('keine Schrift unter 13 px in app.js, app.css, index.html', () => {
  for (const datei of ['app.js', 'app.css', 'index.html']) {
    const s = readFileSync(new URL('../public/' + datei, import.meta.url), 'utf8');
    const winzig = s.match(/font-size:\s*([0-9]|1[0-2])(\.\d+)?px/g) || [];
    assert.deepEqual(winzig, [], datei);
  }
  const audit = readFileSync(new URL('../tools/loop-browser-audit.mjs', import.meta.url), 'utf8');
  assert.match(audit, /parseFloat\(getComputedStyle\(e\)\.fontSize\) < 13\)/);
});

// Owner-Regel: „Buttons müssen als solche erkennbar sein" — und gesperrte als gesperrt.
// Bis 10/2026 gab es keine Regel für :disabled: Der gesperrte Erste-Schritte-Knopf
// („Bitte mindestens einen Wirkstoff wählen") war genauso grün wie ein aktiver.
test('gesperrte Knöpfe grau, ohne Hand-Zeiger — nach allen Knopf-Varianten (sonst überschrieben)', () => {
  const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
  const i = css.indexOf('button:disabled, button:disabled:hover { background:var(--chip-bg); color:var(--muted);');
  assert.ok(i > 0, 'Regel fehlt');
  assert.match(css.slice(i, i + 200), /cursor:not-allowed/);
  for (const v of ['button.ghost {', 'button.sortbtn {', 'button.linklike {']) assert.ok(css.indexOf(v) < i, `${v} steht dahinter und färbt gesperrte Knöpfe wieder`);
});
