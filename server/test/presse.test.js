// Presse je Land (services/presse.js) — GDELT-Abfrage, Auswertung, Zwischenspeicher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  presseQuery, presseUrl, artikelAusGdelt, gdeltDatum, createPresseDienst, GDELT_LAND, presseEnv,
} from '../src/services/presse.js';
import { COUNTRIES } from '../src/data/countries.js';

const antwort = (articles) => JSON.stringify({ articles });
const artikel = (o = {}) => ({
  url: 'https://www.premiumtimesng.com/health/1.html', title: 'Nigeria faces drug shortage as naira falls',
  seendate: '20261010T081500Z', domain: 'premiumtimesng.com', language: 'English', sourcecountry: 'Nigeria', ...o,
});

test('jedes Land der Plattform hat eine Presse-Abfrage', () => {
  // Wer ein Land anbietet und auf „Angola" klicken lässt, muss dort auch etwas
  // abfragen können. Ein neues Land ohne Eintrag fällt hier auf.
  for (const cc of Object.keys(COUNTRIES)) {
    assert.ok(GDELT_LAND[cc], `kein GDELT-Land für ${cc}`);
    assert.ok(presseQuery(cc, {}), `keine Abfrage für ${cc}`);
  }
});

test('Abfrage: Presse DES Landes, in seiner Sprache', () => {
  const ng = presseQuery('NG', {});
  assert.match(ng, /sourcecountry:nigeria$/);
  assert.match(ng, /pharmaceutical/);
  const ao = presseQuery('AO', {});
  assert.match(ao, /sourcecountry:angola$/);
  assert.match(ao, /medicamentos/, 'angolanische Presse schreibt Portugiesisch');
  assert.doesNotMatch(presseQuery('US', {}), /(^|[ (])drug( |\)|$)/, 'nacktes „drug" holt jede Drogenrazzia herein');
});

test('Abfrage ist je Land ohne Deploy ersetzbar', () => {
  const env = { [presseEnv('NG')]: '(insulin) sourcecountry:nigeria' };
  assert.equal(presseQuery('NG', env), '(insulin) sourcecountry:nigeria');
  assert.match(presseUrl('NG', { env }), /query=%28insulin%29/);
});

test('unbekanntes Land: keine Abfrage', () => {
  assert.equal(presseQuery('XX', {}), null);
  assert.equal(presseUrl('XX', { env: {} }), null);
});

test('gdeltDatum: kompaktes Format -> ISO, anderes -> null', () => {
  assert.equal(gdeltDatum('20261010T081500Z'), '2026-10-10T08:15:00.000Z');
  assert.equal(gdeltDatum('2026-10-10'), null);
  assert.equal(gdeltDatum(''), null);
});

test('Auswertung: Titel, Link, Medium, Datum — Herkunft „presse"', () => {
  const [a] = artikelAusGdelt(antwort([artikel()]));
  assert.equal(a.herkunft, 'presse');
  assert.equal(a.quelle, 'premiumtimesng.com');
  assert.equal(a.url, 'https://www.premiumtimesng.com/health/1.html');
  assert.equal(a.datum, '2026-10-10T08:15:00.000Z');
});

test('Auswertung: ohne http(s)-Link oder Titel kein Artikel', () => {
  // Verschiedene Titel — mit gleichem Titel räumte die Titel-Dublettenprüfung
  // den GÜLTIGEN Artikel ab und ließ den `javascript:`-Artikel stehen; die
  // Zählung blieb bei 1 und der Test grün, obwohl die Linkprüfung fehlte.
  const out = artikelAusGdelt(antwort([
    artikel({ url: 'javascript:alert(1)', title: 'A' }), artikel({ url: '', title: 'B' }),
    artikel({ url: 'ftp://x.ng/c', title: 'C' }), artikel({ title: '' }), artikel({ title: 'D' }),
  ]));
  assert.deepEqual(out.map((a) => a.titel), ['D']);
  assert.ok(out.every((a) => /^https:\/\//.test(a.url)));
});

test('Auswertung: Agenturmeldung in zehn Zeitungen erscheint einmal', () => {
  const out = artikelAusGdelt(antwort([
    artikel({ url: 'https://a.ng/1' }), artikel({ url: 'https://b.ng/2' }), artikel({ url: 'https://c.ng/3', title: 'NIGERIA faces drug-shortage as naira falls!' }),
  ]));
  assert.equal(out.length, 1);
});

test('Auswertung: Klartext statt JSON -> Fehler mit dem Satz', () => {
  assert.throws(() => artikelAusGdelt('Your search contained invalid syntax.'), /invalid syntax/);
});

test('Dienst: zwischengespeichert, Fehlschlag nur kurz, Gründe getrennt', async () => {
  let aufrufe = 0, t = 0, antworten = [antwort([artikel()])];
  const dienst = createPresseDienst({
    env: {}, jetzt: () => t,
    holen: async () => { aufrufe++; const a = antworten.shift(); if (a instanceof Error) throw a; return a; },
  });
  const a = await dienst.fuerLand('NG');
  assert.equal(a.artikel.length, 1);
  assert.equal(a.grund, null);
  await dienst.fuerLand('NG');
  assert.equal(aufrufe, 1, 'zweiter Aufruf aus dem Speicher');

  antworten = [new Error('HTTP 503'), antwort([])];
  const b = await dienst.fuerLand('KE');
  assert.equal(b.grund, 'nicht_erreichbar');
  assert.match(b.fehler, /503/);
  t += 6 * 60 * 1000; // nach 6 Minuten erneut versuchen
  const c = await dienst.fuerLand('KE');
  assert.equal(c.grund, 'keine_artikel', '„nichts gefunden" ist etwas anderes als „nicht erreichbar"');
});

test('Dienst: abschaltbar und ehrlich bei fremdem Land', async () => {
  const aus = createPresseDienst({ env: { APOPULSE_PRESSE: 'aus' }, holen: async () => { throw new Error('darf nicht'); } });
  assert.equal((await aus.fuerLand('NG')).grund, 'abgeschaltet');
  const an = createPresseDienst({ env: {}, holen: async () => { throw new Error('darf nicht'); } });
  assert.equal((await an.fuerLand('XX')).grund, 'land_nicht_abgedeckt');
});
