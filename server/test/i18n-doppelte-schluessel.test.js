// ============================================================================
//  Kein Sprachschlüssel darf innerhalb einer Sprache doppelt vorkommen
// ============================================================================
//  In einem Objektliteral gewinnt bei doppeltem Schlüssel stillschweigend der
//  LETZTE. Die Paritätsprüfung (gleiche Schlüssel in de/en/pt) sieht das nicht
//  — sie zählt Schlüssel, und ein Duplikat in allen drei Sprachen ist paritätisch.
//
//  Anlass: Beim Presse-Bereich hießen zwei neue Schlüssel `pr_title` und
//  `pr_empty`. Beide gab es schon — als Titel der Premium-Seite und als
//  Leermeldung der Preisliste. Die Premium-Seite hätte danach „Presse aus
//  {land}" geheißen, ohne dass ein Test rot wird.
// ============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quelle = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

function bloecke() {
  const out = {};
  const re = /^ {2}([a-z]{2}): \{$/gm;
  const starts = [...quelle.matchAll(re)];
  for (const [i, m] of starts.entries()) {
    const anfang = m.index + m[0].length;
    const ende = i + 1 < starts.length ? starts[i + 1].index : quelle.length;
    out[m[1]] = quelle.slice(anfang, ende);
  }
  return out;
}

function doppelte(block) {
  // Schlüssel = Bezeichner vor `:` mit folgendem String-Literal. Texte selbst
  // werden vorher entfernt, damit ein „foo:" INNERHALB eines Textes nicht zählt.
  const ohneTexte = block.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
  const zaehler = new Map();
  for (const m of ohneTexte.matchAll(/(?:^|[\s,{])([A-Za-z_][\w]*)\s*:\s*''/g)) {
    zaehler.set(m[1], (zaehler.get(m[1]) || 0) + 1);
  }
  return [...zaehler].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n}×)`);
}

test('i18n: drei Sprachblöcke gefunden', () => {
  assert.deepEqual(Object.keys(bloecke()).sort(), ['de', 'en', 'pt']);
});

for (const [sprache, block] of Object.entries(bloecke())) {
  test(`i18n ${sprache}: kein Schlüssel doppelt`, () => {
    assert.deepEqual(doppelte(block), [], 'der spätere Wert überschreibt den früheren stillschweigend');
  });
}
