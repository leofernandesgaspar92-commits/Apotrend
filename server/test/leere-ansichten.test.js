// Rundgang 23.10.2026 (neues Konto in Ghana/Senegal, Handy 360 px): was ein
// leeres Land zeigt. Leere Werkzeugleisten, eine Erklärung, die zur falschen
// Situation passt („Kein Präparat für diese Suche" ohne Suche) und Ersparnisse
// aus einem anderen Land kosten Vertrauen und Scrollzeit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createSocialService } from '../src/services/social.js';
import { createPricesService } from '../src/services/prices.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/http/server.js', import.meta.url), 'utf8');

test('Ersparnis nur aus dem angesehenen Land — keine österreichischen Euro in Ghana', () => {
  const prices = createPricesService(createPricesRepo({ seed: true }), createSocialService(createSocialRepo(), createMemoryRepo()));
  assert.ok(prices.savingsSummary({ country: 'AT' }).count > 0, 'Referenzdaten AT');
  assert.deepEqual(prices.savingsSummary({ country: 'GH' }), { count: 0, total_abs: 0, top: [] });
  assert.match(server, /savings: prices\.savingsSummary\(\{ country: activeCountry\(userId, query\) \}\)/);
  const ov = readFileSync(new URL('../src/services/overview.js', import.meta.url), 'utf8');
  assert.match(ov, /prices\.savingsSummary\(\{ country \}\)/, 'auch die Kachel auf der Übersicht');
});

test('Leere Engpass-Liste: keine Filterleiste; leere Preise: ein ehrlicher Satz statt Suche/Export', () => {
  const sh = app.slice(app.indexOf('async function loadShortages('), app.indexOf('async function ladeEngpassEbene('));
  assert.match(sh, /if \(!d\.shortages\.length\) bar\.hidden = true;/);
  const pr = app.slice(app.indexOf('async function loadPrices('), app.indexOf('// CSV-Export für Einkauf/Großhandel'));
  assert.match(pr, /if \(!d\.comparisons\.length\) \{[\s\S]*data-preiseleer[\s\S]*pr_leer_land[\s\S]*return;/);
});

test('Codes-Karte zweispaltig auch am Handy', () => {
  assert.match(app, /<ol class="recovery-codes rc-zwei"/);
  const i = css.indexOf('ol.recovery-codes.rc-zwei { grid-template-columns:1fr 1fr;');
  assert.ok(i > css.indexOf('@media (max-width:420px){ ol.recovery-codes { grid-template-columns:1fr; } }'), 'muss nach der Ein-Spalten-Regel stehen');
});

test('Melde-Formular: Beschriftungen mit den Feldern verknüpft, großer Absende-Knopf, Bestätigung oben', () => {
  const k = app.slice(app.indexOf('function reportShortageCard('), app.indexOf('// Vorbelegung aus der Suche'));
  for (const id of ['rep_w', 'rep_b', 'rep_s', 'rep_g', 'rep_vb']) {
    assert.match(k, new RegExp(`<label for="${id}"`), id);
    assert.match(k, new RegExp(`id="${id}"`), id);
  }
  assert.match(k, /<button class="auth-gross" data-send style="width:100%;min-height:52px">/);
  assert.match(k, /data-gemeldet[\s\S]*ti\('sh_rep_ok', \{ w: wirkstoff \}\)/);
});

test('Rundgang Kenia: kein „Alle gelesen" ohne Ungelesenes, „Angaben" statt „item(s)", keine Wien-Beispiele außerhalb Deutsch', () => {
  assert.match(app, /\$\{unreadN \? `<button class="small" id="readall">/);
  assert.match(app, /nlabel\(missing\.length, 'pfc_missing_1', 'pfc_missing'\)/);
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.doesNotMatch(i18n, /item\(s\)|Angabe\(n\)|élément\(s\)|item\(ns\)/);
  assert.doesNotMatch(i18n, /AT-K-2026-1188|Vienna|Vienne|فيينا|Viena|Universidade de Lisboa/);
});

test('Desktop-Rundgang Nigeria: Namens-Beispiel ohne Länderbezug, Preise-Reiter ohne €-Symbol', () => {
  assert.doesNotMatch(app, /placeholder="Dr\. Anna Huber"/);
  assert.match(app, /placeholder="\$\{esc\(t\('au_name_ph'\)\)\}"/);
  assert.match(app, /prices: 'coins'/);
});
