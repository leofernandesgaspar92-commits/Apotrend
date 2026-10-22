// Datumsformat je Land: Tag vor Monat (außer USA). Bei Engpass-, Liefer- und
// Ablaufdaten ist ein vertauschtes Datum eine Fehlinformation: 03/04/2026 ist
// in den USA der 4. März, in Uganda der 3. April.
//
// Geprüft wird die ECHTE Funktion bcp47() aus public/app.js (per vm
// ausgeführt), nicht ein Nachbau — sonst bliebe ein Test grün, dessen
// Gegenstand längst kaputt ist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { COUNTRIES } from '../src/data/countries.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const start = app.indexOf('const REGIONAL_TAGS = {');
const ende = app.indexOf('\n}\n', app.indexOf('function bcp47() {')) + 3;
assert.ok(start > 0 && ende > start, 'bcp47() in app.js nicht gefunden');
const STANDARD = Object.fromEntries([...i18n.matchAll(/\n {2}([a-z]{2}): \{[\s\S]*?_bcp47:'([^']+)'/g)].map((m) => [m[1], m[2]]));

function bcp47Fuer(land, sprache) {
  const ctx = { LOCALE: sprache, viewCountry: () => land, t: (k) => (k === '_bcp47' ? STANDARD[sprache] : k), Intl };
  vm.createContext(ctx);
  vm.runInContext(app.slice(start, ende) + '\n;globalThis.__tag = bcp47();', ctx);
  return ctx.__tag;
}

const reihenfolge = (tag) => new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  .formatToParts(new Date(Date.UTC(2026, 2, 4))).filter((p) => ['day', 'month', 'year'].includes(p.type)).map((p) => p.type).join('-');

test('Jedes Land hat eine Schreibweise, und kein Land außer den USA bekommt Monat vor Tag', () => {
  assert.deepEqual(Object.keys(STANDARD).sort(), ['de', 'en', 'fr', 'pt']);
  const tabelle = app.slice(start, app.indexOf('};', start));
  for (const [code, land] of Object.entries(COUNTRIES)) {
    assert.match(tabelle, new RegExp(`\\b${code}:'`), `${code} fehlt in REGIONAL_TAGS`);
    const tag = bcp47Fuer(code, land.locale_default);
    const r = reihenfolge(tag);
    if (code === 'US') assert.equal(r, 'month-day-year');
    else assert.ok(r === 'day-month-year' || r.startsWith('year-'), `${code} (${tag}): ${r}`);
  }
});

test('Äthiopien: Tag/Monat, nicht das US-Format, das „en-ET" still liefern würde', () => {
  assert.equal(new Intl.DateTimeFormat('en-ET').resolvedOptions().locale, 'en', 'Annahme über die Bibliothek stimmt nicht mehr');
  assert.equal(reihenfolge(bcp47Fuer('ET', 'en')), 'day-month-year');
  assert.equal(bcp47Fuer('UG', 'en'), 'en-UG');
  // Wer auf Deutsch bleibt, behält die deutsche Schreibweise.
  assert.equal(bcp47Fuer('UG', 'de'), 'de-AT');
});
