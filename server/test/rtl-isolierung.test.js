// Arabisch (27.10.2026): Lateinische Namen in arabischen Sätzen und Codes/Adressen behalten
// ihre Schreibrichtung — „أكّده Sara Mahmoud" riss sonst auseinander, Adressen konnten kippen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');

test('Codes, Adressen, Transaktions-IDs: immer links→rechts, abgeschottet', () => {
  assert.match(css, /\bcode \{ direction:ltr; unicode-bidi:isolate; \}/);
  assert.match(app, /<div class="crypto-addr"><code>\$\{esc\(c\.address\)\}<\/code><\/div>/);
});

test('„Seit deinem letzten Besuch": Wirkstoff und Name in <bdi>', () => {
  const k = app.slice(app.indexOf('async function seitBesuchKarte('), app.indexOf('async function modAufgabenKarte('));
  assert.match(k, /<b><bdi>\$\{esc\(z\.w\)\}<\/bdi><\/b>/);
  assert.match(k, /replace\('\\u0000', `<bdi>\$\{esc\(z\.wer\)\}<\/bdi>`\)/);
  assert.doesNotMatch(k, /\$\{esc\(text\(z\)\)\}/, 'Text doppelt maskiert');
});
