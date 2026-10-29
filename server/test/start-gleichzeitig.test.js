// Start der App auf langsamen Netzen: Bis 10/2026 fragte mainScreen() /api/me, /api/countries,
// /api/features, /api/country-config und die Merkliste NACHEINANDER ab. Auf einem einfachen
// Android mit 3G (400 ms Latenz) waren das fünf Runden — bedienbar erst nach 7,0 s, jetzt 5,1 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'app.js'), 'utf8');
const haupt = APP.slice(APP.indexOf('async function mainScreen()'), APP.indexOf('\n}\n', APP.indexOf('async function mainScreen()')));

test('mainScreen: alle unabhängigen Start-Abfragen sind unterwegs, bevor auf /api/me gewartet wird', () => {
  const vorMe = haupt.slice(0, haupt.indexOf("await api('GET','/api/me')"));
  assert.ok(vorMe.length > 0, '/api/me-Abfrage nicht gefunden');
  assert.ok(!/\bawait\b/.test(vorMe.replace(/\/\/.*$/gm, '')), 'vor /api/me wird schon gewartet');
  for (const muss of ['ensureCountries()', 'ladeFeatures()', "'/api/country-config'", "'/api/bookmarks/ids'"]) {
    assert.ok(vorMe.includes(muss), `${muss} wird nicht vorab gestartet`);
  }
  // Und später nicht noch einmal nacheinander abgefragt.
  for (const nicht of ['await ensureCountries()', 'await ladeFeatures()', "await api('GET','/api/bookmarks/ids')", 'await applyCountryGating()']) {
    assert.ok(!haupt.includes(nicht), `${nicht} wartet wieder einzeln`);
  }
});

test('Erster Besuch ohne Land: Länderliste startet vor dem Warten auf den Land-Vorschlag', () => {
  const start = APP.slice(APP.lastIndexOf('const _hasCountry = () =>'));
  const i = start.indexOf('ensureCountries()'), j = start.indexOf('await landAutomatisch()');
  assert.ok(j > 0, 'landAutomatisch() nicht gefunden');
  assert.ok(i > 0 && i < j, 'Länderliste wird erst nach dem Land-Vorschlag geholt');
});

test('ensureCountries: gleichzeitige Aufrufe teilen eine Abfrage; Fehler ergibt leere Liste', async () => {
  const quelle = APP.slice(APP.indexOf('let COUNTRIES_CACHE = null;'), APP.indexOf('function countryOptionsHtml('));
  const baue = (antwort) => {
    const aufrufe = [];
    const api = (m, p) => { aufrufe.push(p); return new Promise((ok, fail) => setTimeout(() => (antwort ? ok(antwort) : fail(new Error('netz'))), 5)); };
    const ensureCountries = new Function('api', `${quelle}; return ensureCountries;`)(api);
    return { aufrufe, ensureCountries };
  };
  const a = baue({ countries: [{ code: 'GH' }] });
  const [x, y] = await Promise.all([a.ensureCountries(), a.ensureCountries()]);
  assert.equal(a.aufrufe.length, 1, 'doppelt abgefragt');
  assert.deepEqual(x, [{ code: 'GH' }]); assert.equal(x, y);
  await a.ensureCountries();
  assert.equal(a.aufrufe.length, 1, 'Zwischenspeicher greift nicht');
  const b = baue(null);
  assert.deepEqual(await b.ensureCountries(), []);
});
