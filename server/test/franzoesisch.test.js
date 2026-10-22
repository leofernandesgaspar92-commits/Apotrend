// Französisch als vierte Sprache (10/2026) — Voraussetzung für das
// frankophone Afrika (Senegal, Côte d'Ivoire, Kamerun, Kongo …).
//
// Geprüft wird nicht nur „Schlüssel vorhanden", sondern was im Betrieb
// schiefgehen würde: ein fehlender Platzhalter ({n}, {land}) zeigt rohe
// Klammern, ein Server-Text ohne fr-Fassung fällt still auf Deutsch zurück,
// ein französischer Wirkstoffname ohne Schlüssel-Treffer verpasst die
// Frühwarnung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SUPPORTED_LOCALES, normalizeLocale } from '../src/data/countries.js';
import { createPatientInfoService } from '../src/services/patientInfo.js';
import { rendereWochenbericht } from '../src/services/wochenbericht.js';
import { kopfSprache, startseiteKopf, manifestSprache } from '../src/http/startseiteKopf.js';
import { teilseite, TEILSEITE_SPRACHEN } from '../src/http/teilseite.js';
import { pushNachricht, testNachricht } from '../src/services/webPush.js';
import { LAGEBILD_HINWEIS, SPRACHEN as LAGEBILD_SPRACHEN } from '../src/services/lagebild.js';
import { ZIELSPRACHEN } from '../src/services/aiTranslate.js';
import { SUCHWOERTER, presseQuery } from '../src/services/presse.js';
import { ersteSchritte } from '../src/services/ersteSchritte.js';
import { createOeffentlicheSeiten } from '../src/services/oeffentlicheSeiten.js';
import { wirkstoffSchluessel, gleicherWirkstoff } from '../src/domain/inn.js';
import { frLand, FR_LAND } from '../src/domain/franzLand.js';

const i18nText = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(i18nText + ';this.I = I18N;', ctx);
const I = ctx.I;

const platzhalter = (s) => (String(s).match(/\{[a-zA-Z_]+\}/g) || []).sort().join(',');

test('i18n: fr hat genau die Schlüssel von de, jeder Text ist ein nicht-leerer String', () => {
  assert.ok(I.fr, 'fr-Block fehlt');
  assert.deepEqual(Object.keys(I.fr).sort(), Object.keys(I.de).sort());
  const leer = Object.entries(I.fr).filter(([k, v]) => typeof v !== 'string' || (!v.trim() && String(I.en[k]).trim()));
  assert.deepEqual(leer, []);
});

test('i18n: fr hat in jedem Text dieselben Platzhalter wie en', () => {
  const falsch = Object.keys(I.en).filter((k) => platzhalter(I.fr[k]) !== platzhalter(I.en[k]));
  assert.deepEqual(falsch, [], 'falsche Platzhalter zeigen rohe {…} oder verlieren Zahlen');
});

test('i18n: fr ist wirklich Französisch, nicht kopiertes Englisch', () => {
  assert.equal(I.fr._bcp47, 'fr-FR');
  // Längere Texte, die wortgleich mit en sind, wären vergessene Übersetzungen.
  // Ausgenommen: reine Formeln wie „{preis} × {laender} = {summe}".
  const hatWoerter = (s) => /\p{L}{3}/u.test(s.replace(/\{[a-zA-Z_]+\}/g, ''));
  const gleich = Object.keys(I.en).filter((k) => !k.startsWith('_') && I.en[k].length > 25 && hatWoerter(I.en[k]) && I.fr[k] === I.en[k]);
  assert.deepEqual(gleich, []);
  assert.match(I.fr.cs_title, /Choisissez votre pays/);
  assert.match(I.fr.e_unbekannt, /erreur/);
});

test('Sprachlisten: Server und Oberfläche kennen fr', () => {
  assert.ok(SUPPORTED_LOCALES.includes('fr'));
  assert.equal(normalizeLocale('fr', 'AT'), 'fr');
  assert.match(app, /const SUPPORTED_LOCALES = \['de','en','pt','fr'\];/);
  assert.ok(ZIELSPRACHEN.includes('fr'), 'Übersetzen auf Zuruf');
  assert.ok(LAGEBILD_SPRACHEN.includes('fr') && LAGEBILD_HINWEIS.fr, 'Lagebild');
  assert.ok(TEILSEITE_SPRACHEN.includes('fr'), 'Teilseite');
});

test('Datums- und Zahlenformat folgt _bcp47 statt fester de/en/pt-Weiche', () => {
  assert.doesNotMatch(app, /LOCALE === 'pt' \? 'pt-PT' : /, 'eine feste Weiche würde fr als de-AT formatieren');
});

test('Patienten-Infokarten und Begleitzettel auf Französisch', () => {
  const pi = createPatientInfoService();
  assert.ok(pi.langs().some((l) => l.code === 'fr' && l.label === 'Français'));
  for (const land of ['AT', 'SN']) {
    const d = pi.cards('fr', { land });
    assert.equal(d.lang, 'fr');
    assert.match(d.disclaimer, /Information générale/);
    assert.match(d.source.label, land === 'AT' ? /Autriche/ : /OMS/);
    for (const c of d.cards) {
      assert.ok(c.title && c.body, c.id);
      assert.doesNotMatch(c.body, /\b(the|und|die|não)\b/i, `${c.id}: Sprachmischung`);
    }
  }
  // Entsorgung außerhalb Österreichs: kein Rücknahme-Versprechen ohne Quelle.
  assert.doesNotMatch(pi.cards('fr', { land: 'SN' }).cards.find((c) => c.id === 'entsorgung').body, /Rapportez/);
  assert.match(app, /const PATIENT_SPRACHEN = \['de', 'en', 'pt', 'fr', 'tr'\];/);
  assert.match(app, /\['fr','Français'\]/, 'Sprachknopf am Begleitzettel');
  assert.match(app, /\n {2}fr: \{ title: 'Plan de prise'/, 'Begleitzettel-Texte');
});

test('Wochenbericht auf Französisch, Datum Tag/Monat/Jahr', () => {
  const b = rendereWochenbericht({
    locale: 'fr', landName: 'Sénégal', name: 'Awa', kw: 43, appUrl: 'https://x', abmeldeUrl: 'https://x/a',
    beobachtet: [{ wirkstoff: 'Amoxicilline', hier: { tage: 5, status: 'kritisch', quelle: 'ARP' }, ausland: [], anzahl: 1 }],
    bilanz: { neu: [], beendet: [], offen: 3, aufzeichnung_seit: '2026-10-04' },
  });
  assert.match(b.betreff, /rapport hebdomadaire Sénégal · semaine 43/);
  assert.match(b.text, /Bonjour Awa,/);
  assert.match(b.text, /en pénurie depuis 5 jours \(critique, ARP\)/);
  assert.match(b.text, /04\/10\/2026/);
  assert.doesNotMatch(b.text, /Guten Morgen|Good morning/);
});

test('Startseite, App-Manifest, Teilseite und Push auf Französisch', () => {
  assert.equal(kopfSprache('fr-CI,fr;q=0.9,en;q=0.5'), 'fr');
  const kopf = startseiteKopf('<html lang="de"><title>x</title>', { sp: 'fr' });
  assert.match(kopf, /<html lang="fr">/);
  assert.match(kopf, /pénuries de médicaments/);
  const m = JSON.parse(manifestSprache(JSON.stringify({ name: 'x', shortcuts: [{ url: '/?tab=shortages' }], screenshots: [] }), 'fr'));
  assert.equal(m.lang, 'fr');
  assert.equal(m.shortcuts[0].name, 'Pénuries');
  const html = teilseite({ art: 'wirkstoff', land: 'SN', sprache: 'fr', wirkstoff: 'Amoxicilline', beobachtet_land: true, knapp: true, seit_tagen: 3, herkunft: 'verified', quelle: 'ARP', stand: '2026-10-20' }, { basis: 'https://x' });
  assert.match(html, /Amoxicilline : en pénurie au Sénégal/, 'au Sénégal, nicht en Sénégal');
  assert.match(html, /depuis 3 jours/);
  const p = pushNachricht({ type: 'shortage_home', label: 'Amoxicilline · SN', ref_type: 'wirkstoff', ref_id: 'Amoxicilline' }, { sprache: 'fr', landName: () => 'Sénégal' });
  assert.equal(p.titel, 'Pénurie : Amoxicilline');
  assert.match(p.text, /est en pénurie au Sénégal selon/);
  assert.match(testNachricht('fr').titel, /notifications fonctionnent/);
});

test('Öffentliche Engpass-Seiten: Übersicht und 404 auf Französisch', () => {
  const s = createOeffentlicheSeiten({ chronik: { kurz: () => null, beobachteteLaender: () => [] }, shortagesRepo: { list: () => [] }, laender: {}, stand: () => null });
  assert.match(s.index({ basis: 'https://x', sp: 'fr' }), /Pénuries de médicaments — à jour, avec sources/);
  assert.match(s.nichtGefunden({ sp: 'fr' }), /Page introuvable/);
});

test('Presse: französische Suchwörter für frankophone Länder', () => {
  assert.ok(SUCHWOERTER.fr.includes('médicaments'));
  assert.match(presseQuery('MU', {}), /médicaments/, 'Mauritius: Presse überwiegend französisch');
  assert.match(presseQuery('MU', {}), /pharmaceutical/, 'und weiterhin englisch');
});

test('Erste Schritte (Afrika, fr): jeder Vorschlag trifft denselben Wirkstoff wie die englische Liste', () => {
  const repo = { list: () => [] };
  const fr = ersteSchritte({ shortagesRepo: repo, land: 'SN', sprache: 'fr', region: 'AFRICA' }).vorschlaege.map((v) => v.wirkstoff);
  const en = ersteSchritte({ shortagesRepo: repo, land: 'SN', sprache: 'en', region: 'AFRICA' }).vorschlaege.map((v) => v.wirkstoff);
  assert.ok(fr.includes('Ocytocine') && fr.includes('Sulfate de zinc'));
  assert.equal(fr.length, en.length);
  fr.forEach((w, i) => assert.equal(wirkstoffSchluessel(w), wirkstoffSchluessel(en[i]), `${w} ≠ ${en[i]}`));
});

test('Wirkstoff-Schlüssel: fr/pt-Schreibweisen treffen, Verschiedenes bleibt verschieden', () => {
  for (const [a, b] of [
    ['Ocytocine', 'Oxytocin'], ['Ocitocina', 'Oxytocin'],
    ['Sulfate de zinc', 'Zinksulfat'], ['Sulfato de zinco', 'Zinc sulfate'],
    ['Sulfate de magnésium', 'Magnesiumsulfat'], ['Sulfato de magnésio', 'Magnesium sulfate'],
    ['Sels de réhydratation orale', 'Oral rehydration salts'], ['Sais de reidratação oral', 'Oral rehydration salts'],
    ['Amoxicilline', 'Amoxicillin'], ['Lévothyroxine', 'Levothyroxin'],
  ]) assert.ok(gleicherWirkstoff(a, b), `${a} = ${b}`);
  for (const [a, b] of [
    ['Sulfate de zinc', 'Sulfate de magnésium'], ['Magnesium', 'Magnesiumsulfat'],
    ['Kaliumchlorid', 'Kaliumcitrat'], ['Prednison', 'Prednisolon'], ['Natriumchlorid', 'Kaliumchlorid'],
  ]) assert.ok(!gleicherWirkstoff(a, b), `${a} ≠ ${b}`);
});

test('Präposition vor Ländernamen: au Sénégal, en Côte d’Ivoire, aux Comores, à Madagascar', () => {
  const n = new Intl.DisplayNames(['fr'], { type: 'region' });
  const erwartet = {
    SN: 'au Sénégal', CM: 'au Cameroun', ML: 'au Mali', TD: 'au Tchad', BF: 'au Burkina Faso', MA: 'au Maroc', CG: 'au Congo-Brazzaville',
    MZ: 'au Mozambique', ZW: 'au Zimbabwe', CV: 'au Cap-Vert',
    CI: 'en Côte d’Ivoire', GN: 'en Guinée', MR: 'en Mauritanie', TN: 'en Tunisie', DZ: 'en Algérie', EG: 'en Égypte', UG: 'en Ouganda',
    CF: 'en République centrafricaine', GQ: 'en Guinée équatoriale',
    KM: 'aux Comores', SC: 'aux Seychelles', US: 'aux États-Unis',
    MG: 'à Madagascar', MU: 'à Maurice', DJ: 'à Djibouti',
  };
  for (const [cc, soll] of Object.entries(erwartet)) assert.equal(frLand(n.of(cc)), soll, cc);
  assert.equal(frLand(n.of('SN'), 'de'), 'du Sénégal');
  assert.equal(frLand(n.of('EG'), 'de'), 'd’Égypte');
  assert.equal(frLand(n.of('KM'), 'de'), 'des Comores');
  assert.equal(frLand('🇸🇳 Sénégal'), 'au 🇸🇳 Sénégal', 'Flagge bleibt am Namen');
  // Die Kopie in app.js muss dieselben Regeln tragen.
  for (const liste of Object.values(FR_LAND)) for (const name of liste) assert.ok(app.includes(`'${name}'`), `app.js: ${name}`);
});

test('Server-Texte auf Französisch: nirgends „en ${…}" vor einem Ländernamen', () => {
  for (const datei of ['../src/services/oeffentlicheSeiten.js', '../src/http/teilseite.js', '../src/services/webPush.js']) {
    const s = readFileSync(new URL(datei, import.meta.url), 'utf8');
    const fr = s.slice(s.indexOf('\n  fr: {'), s.indexOf('\n  },\n};', s.indexOf('\n  fr: {')));
    assert.ok(fr.length > 200, datei);
    assert.doesNotMatch(fr, /\ben \$\{(l|land)\}/, datei);
  }
});

test('Oberfläche (fr): ti() setzt au/en/du korrekt — die echte Funktion aus app.js', () => {
  const a = app.indexOf('const FR_LAND = {');
  const e = app.indexOf('\n}\n', app.indexOf('function ti(key, vars) {')) + 3;
  assert.ok(a > 0 && e > a, 'ti() in app.js nicht gefunden');
  const ctx = { LOCALE: 'fr', t: (k) => I.fr[k] };
  vm.createContext(ctx);
  vm.runInContext(app.slice(a, e) + ';globalThis.ti = ti;', ctx);
  assert.equal(ctx.ti('au_lage_title', { land: '🇸🇳 Sénégal' }), 'Situation actuelle au 🇸🇳 Sénégal');
  assert.equal(ctx.ti('au_lage_title', { land: '🇨🇮 Côte d’Ivoire' }), 'Situation actuelle en 🇨🇮 Côte d’Ivoire');
  assert.equal(ctx.ti('presse_title', { land: 'Cameroun' }), 'Presse du Cameroun');
  assert.equal(ctx.ti('presse_title', { land: 'Égypte' }), 'Presse d’Égypte');
  assert.match(ctx.ti('legal_deals_blocked', { country: 'Mali' }), /^Au Mali, /);
  assert.equal(ctx.ti('vc_back', { flag: '🇲🇬', land: 'Madagascar' }), '↩ Retour à 🇲🇬 Madagascar');
  // Andere Sprachen bleiben unberührt.
  ctx.LOCALE = 'en'; ctx.t = (k) => I.en[k];
  assert.equal(ctx.ti('au_lage_title', { land: 'Senegal' }), I.en.au_lage_title.replace('{land}', 'Senegal'));
});
