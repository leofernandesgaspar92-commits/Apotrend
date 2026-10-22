// Arabisch als fünfte Sprache (10/2026) — von rechts nach links. Voraussetzung
// für Ägypten, Libyen, Sudan und als zweite Sprache für Marokko, Algerien,
// Tunesien und Mauretanien.
//
// Geprüft wird, was im Betrieb kaputtgehen würde: fehlende Texte oder
// Platzhalter, Seiten ohne dir="rtl" (Sätze kleben am falschen Rand),
// physische left/right-Abstände, die sich nicht mitdrehen, und Wirkstoffnamen
// in arabischer Schrift, die keine Behördenliste je trifft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SUPPORTED_LOCALES, COUNTRIES, listCountries } from '../src/data/countries.js';
import { richtung } from '../src/domain/schreibrichtung.js';
import { createPatientInfoService } from '../src/services/patientInfo.js';
import { rendereWochenbericht } from '../src/services/wochenbericht.js';
import { kopfSprache, startseiteKopf, manifestSprache } from '../src/http/startseiteKopf.js';
import { teilseite, TEILSEITE_SPRACHEN } from '../src/http/teilseite.js';
import { pushNachricht, testNachricht } from '../src/services/webPush.js';
import { LAGEBILD_HINWEIS } from '../src/services/lagebild.js';
import { ZIELSPRACHEN } from '../src/services/aiTranslate.js';
import { SUCHWOERTER, presseQuery } from '../src/services/presse.js';
import { ersteSchritte } from '../src/services/ersteSchritte.js';
import { createOeffentlicheSeiten } from '../src/services/oeffentlicheSeiten.js';
import { wirkstoffSchluessel } from '../src/domain/inn.js';

const i18nText = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(i18nText + ';this.I = I18N;', ctx);
const I = ctx.I;
const platzhalter = (s) => (String(s).match(/\{[a-zA-Z_]+\}/g) || []).sort().join(',');
const ARABISCH = /[؀-ۿ]/;

test('i18n: ar hat genau die Schlüssel von de, gleiche Platzhalter wie en, wirklich Arabisch', () => {
  assert.ok(I.ar, 'ar-Block fehlt');
  assert.deepEqual(Object.keys(I.ar).sort(), Object.keys(I.de).sort());
  const falsch = Object.keys(I.en).filter((k) => platzhalter(I.ar[k]) !== platzhalter(I.en[k]));
  assert.deepEqual(falsch, [], 'Platzhalter');
  // Jeder Text mit Wörtern enthält arabische Schrift — außer Marken/Formeln (ApoPulse Premium, Apple Pay …).
  const hatWoerter = (s) => /\p{L}{3}/u.test(s.replace(/\{[a-zA-Z_]+\}/g, ''));
  const ohne = Object.keys(I.en).filter((k) => !k.startsWith('_') && hatWoerter(I.en[k]) && I.en[k].length > 25 && !ARABISCH.test(I.ar[k]));
  assert.deepEqual(ohne, [], 'nicht übersetzt');
  assert.equal(I.ar._bcp47, 'ar-EG-u-nu-latn', 'westliche Ziffern wie auf Packungen');
});

test('Zurück-Pfeile zeigen von rechts nach links nach rechts (→ رجوع)', () => {
  for (const k of ['gen_back', 'search_back', 'post_back', 'dm_back', 'fl_back', 'cs_change', 'rs_back']) assert.match(I.ar[k], /^→ /, k);
});

test('Wirkstoff-Beispiele lateinisch: so schreiben Behörden in Ägypten/Maghreb, nur so trifft die Frühwarnung', () => {
  for (const k of ['es_eigene_ph', 'wl_ph', 'sh_rep_w_ph', 'srt_ph', 'bz_med_ph']) assert.match(I.ar[k], /[A-Z][a-z]{4,}/, k);
  const e = ersteSchritte({ shortagesRepo: { list: () => [] }, land: 'EG', sprache: 'ar', region: 'AFRICA' }).vorschlaege.map((v) => v.wirkstoff);
  assert.ok(e.includes('Amoxicillin') && !e.some((w) => ARABISCH.test(w)));
  // Auch außerhalb der Afrika-Liste: englische INN statt des deutschen Rückfalls („Amlodipin").
  const eu = ersteSchritte({ shortagesRepo: { list: () => [] }, land: 'XX', sprache: 'ar', region: 'EUROPE' }).vorschlaege.map((v) => v.wirkstoff);
  assert.ok(eu.includes('Amlodipine'), eu.join(', '));
  assert.equal(wirkstoffSchluessel('Amoxicillin'), wirkstoffSchluessel('Amoxicilline'));
});

test('Oberfläche: dir="rtl" bei Arabisch — beim Laden, beim Sprachwechsel, im Druck', () => {
  assert.match(app, /const SUPPORTED_LOCALES = \[[^\]]*'ar'[^\]]*\];/);
  assert.match(app, /const RTL_SPRACHEN = \['ar'\];/);
  const setLocale = app.slice(app.indexOf('function setLocale('), app.indexOf('\n}\n', app.indexOf('function setLocale(')));
  assert.match(setLocale, /setAttribute\('dir', richtungVon\(LOCALE\)\)/);
  assert.match(app, /<html lang="\$\{esc\(lang\)\}" dir="\$\{richtungVon\(lang\)\}">/, 'Druckfenster');
  assert.match(app, /<html lang="\$\{esc\(z\.lang\)\}" dir="\$\{richtungVon\(z\.lang\)\}">/, 'Begleitzettel');
});

test('CSS: keine physischen left/right-Abstände — sie drehen sich bei Arabisch nicht mit', () => {
  // Erlaubt sind nur POSITIONEN (left:/right:), die der RTL-Block am Ende eigens umdreht.
  for (const [name, text] of [['app.css', css], ['app.js', app], ['index.html', index]]) {
    const treffer = text.match(/(?<![\w-])(margin|padding|border)-(left|right)\b|text-align:\s*(left|right)\b/g) || [];
    assert.deepEqual(treffer, [], name);
  }
  for (const sel of ['.badge', '.kopf-menue', '.suche-ic', '.backtotop', '.poll-bar', 'body.mit-nav .tabs', 'body.mit-nav .rechte-spalte']) {
    assert.ok(css.includes(`[dir="rtl"] ${sel} {`), `RTL-Gegenstück fehlt: ${sel}`);
  }
});

test('Sprachwahl in mehrsprachigen Ländern (echte spracheFuer aus app.js)', () => {
  const a = app.indexOf('const RTL_SPRACHEN');
  const e = app.indexOf('\n}\n', app.indexOf('function spracheFuer(')) + 3;
  const speicher = {};
  const c = { localStorage: { getItem: (k) => speicher[k] ?? null } };
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf('const SUPPORTED_LOCALES'), app.indexOf('\n', app.indexOf('const SUPPORTED_LOCALES'))) + '\n' + app.slice(a, e) + ';globalThis.f = spracheFuer;', c);
  const ma = COUNTRIES.MA;
  assert.equal(c.f(ma, 'fr'), 'fr', 'ohne Wahl: Landessprache');
  speicher.apo_sprachwahl = 'ar';
  assert.equal(c.f(ma, 'fr'), 'ar', 'Marokko auf Arabisch');
  assert.equal(c.f(COUNTRIES.SN, 'fr'), 'fr', 'Senegal führt kein Arabisch → Wahl gilt dort nicht');
  assert.ok(index.includes('id="btnSprache"'), 'Sprach-Knopf im Menü');
  for (const cc of ['MA', 'DZ', 'TN', 'MR', 'EG', 'SD', 'LY', 'SO']) assert.ok(COUNTRIES[cc].locales.includes('ar'), cc);
  assert.deepEqual(COUNTRIES.CM.locales, ['fr', 'en']);
});

test('Server: alle Texte auf Arabisch, jede gebaute Seite mit dir="rtl"', () => {
  assert.ok(SUPPORTED_LOCALES.includes('ar') && ZIELSPRACHEN.includes('ar') && LAGEBILD_HINWEIS.ar && TEILSEITE_SPRACHEN.includes('ar'));
  assert.equal(richtung('ar'), 'rtl'); assert.equal(richtung('fr'), 'ltr');
  assert.equal(kopfSprache('ar-EG,ar;q=0.9'), 'ar');
  assert.match(startseiteKopf('<html lang="de"><title>x</title>', { sp: 'ar' }), /<html lang="ar" dir="rtl">/);
  assert.equal(JSON.parse(manifestSprache('{"name":"x"}', 'ar')).dir, 'rtl');
  const t = teilseite({ art: 'wirkstoff', land: 'EG', sprache: 'ar', wirkstoff: 'Amoxicillin', beobachtet_land: true, knapp: true, seit_tagen: 3, herkunft: 'verified', quelle: 'EDA', stand: '2026-10-20' }, { basis: 'https://x' });
  assert.match(t, /dir="rtl"/); assert.match(t, /ناقص في/);
  const s = createOeffentlicheSeiten({ chronik: { kurz: () => null, beobachteteLaender: () => [] }, shortagesRepo: { list: () => [] }, laender: {}, stand: () => null });
  assert.match(s.index({ basis: 'https://x', sp: 'ar' }), /<html lang="ar" dir="rtl">/);
  assert.match(s.nichtGefunden({ sp: 'ar' }), /dir="rtl"/);
  const b = rendereWochenbericht({ locale: 'ar', landName: 'مصر', name: 'منى', kw: 43, appUrl: 'https://x', abmeldeUrl: 'https://x/a',
    beobachtet: [], bilanz: { neu: [], beendet: [], offen: 2, aufzeichnung_seit: '2026-10-04' } });
  assert.match(b.html, /dir="rtl"/); assert.match(b.text, /صباح الخير منى/); assert.match(b.text, /04.*10.*2026/);
  const p = pushNachricht({ type: 'shortage_home', label: 'Amoxicillin · EG', ref_type: 'wirkstoff', ref_id: 'Amoxicillin' }, { sprache: 'ar', landName: () => 'مصر' });
  assert.match(p.text, /ناقص في مصر/);
  assert.match(testNachricht('ar').titel, /الإشعارات تعمل/);
  assert.ok(SUCHWOERTER.ar.length >= 4); assert.match(presseQuery('EG', {}), /الأدوية/);
});

test('Patienten-Infokarten und Begleitzettel auf Arabisch, Karten mit eigener Schreibrichtung', () => {
  const d = createPatientInfoService().cards('ar', { land: 'EG' });
  assert.equal(d.lang, 'ar');
  assert.ok(d.cards.every((c) => ARABISCH.test(c.title) && ARABISCH.test(c.body)));
  assert.doesNotMatch(d.cards.find((c) => c.id === 'entsorgung').body, /أعد البقايا إلى الصيدلية/, 'kein Rücknahme-Versprechen außerhalb AT');
  assert.match(app, /\n {2}ar: \{ title: 'جدول تناول الدواء'/);
  assert.match(app, /class="card" lang="\$\{esc\(d\.lang\)\}" dir="\$\{richtungVon\(d\.lang\)\}"/);
});

test('Alle 54 Länder Afrikas im Register', () => {
  const afrika = listCountries().filter((c) => c.region === 'AFRICA');
  assert.equal(afrika.length, 54);
});
