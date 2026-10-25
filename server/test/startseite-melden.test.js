// Rundgang „Apothekerin kommt über TikTok" (25.10.2026): worum es geht steht über dem Formular,
// „Engpass melden" ist ein großer Knopf auf der Startseite, die Codes stehen hinter dem Überblick,
// und nach dem Melden kommt gleich der nächste Schritt (Kolleg:innen um Bestätigung bitten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const abschnitt = (von, bis) => app.slice(app.indexOf(von), app.indexOf(bis, app.indexOf(von)));

test('Anmeldeseite: eine Zeile „worum es geht" vor dem Formular — nur am Handy', () => {
  const auth = abschnitt('function authScreen(', '<div class="auth-forms">');
  assert.ok(auth.indexOf('data-authkurz') > 0 && auth.indexOf('data-authkurz') < auth.indexOf('auth-grid'));
  assert.match(css, /@media \(min-width:820px\)\{ \.auth-kurz \{ display:none; \} \}/);
  const texte = [...i18n.matchAll(/au_kurz:'([^']*)'/g)].map((m) => m[1]);
  assert.equal(texte.length, 5);
  for (const x of texte) assert.ok(x.length < 120, 'zu lang für eine Handyzeile: ' + x);
});

test('Startseite: großer Knopf „Engpass melden" (nicht für Privatkonten) öffnet das Formular mit Cursor', () => {
  const ov = abschnitt('async function loadOverview(', 'pushHinweis(feed)');
  assert.match(ov, /me\.account_type === 'private' \? '' : `<button class="auth-gross" data-ovmelden/);
  assert.match(ov, /meldeFormAuf = true; goTab\('shortages'\)/);
  const rk = abschnitt('function reportShortageCard(', 'if (shortageReportPrefill)');
  assert.match(rk, /if \(meldeFormAuf\) \{\s*meldeFormAuf = false;\s*form\.classList\.remove\('hidden'\)/);
  assert.match(rk, /winput\.focus\(\)/);
});

test('Codes-Karte steht NACH dem Überblick und ist zugeklappt', () => {
  const ov = abschnitt('async function loadOverview(', 'pushHinweis(feed)');
  const head = ov.indexOf('feed.appendChild(head);');
  const rc = ov.indexOf('rcKarte()');
  assert.ok(head > 0 && rc > head, 'rcKarte vor dem Überblick');
  assert.match(abschnitt('function rcKarte(', 'function recoveryCodesScreen('), /<details data-rcauf[^>]*><summary[^>]*>\$\{esc\(ti\('rc_zeigen'/);
});

test('Nach dem Melden: „Kolleg:innen um Bestätigung bitten" direkt in der Rückmeldung', () => {
  const rk = abschnitt('function reportShortageCard(', 'if (meldeFormAuf)');
  assert.match(rk, /data-gemeldetbitten/);
  assert.match(rk, /bestaetigungErbitten\(\{ wirkstoff, country: viewCountry\(\) \}\)/);
});
