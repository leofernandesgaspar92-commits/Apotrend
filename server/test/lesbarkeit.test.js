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
