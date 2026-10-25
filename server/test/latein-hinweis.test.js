// Wirkstoffnamen in arabischer Schrift fallen aus der INN-Zuordnung (Frühwarnung, Antibiotika-
// Kennzeichnung, Zusammenführen). Statt einer ungeprüften Übersetzungstabelle: Hinweis auf
// den internationalen Namen in lateinischer Schrift — an allen drei Eingabestellen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { wirkstoffSchluessel } from '../src/domain/inn.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

test('Anlass: arabisch geschrieben ergibt einen anderen Schlüssel als der INN', () => {
  assert.notEqual(wirkstoffSchluessel('أموكسيسيلين'), wirkstoffSchluessel('Amoxicillin'));
});

test('Erkennung: arabische und äthiopische Schrift ja, lateinisch (auch mit Akzent) nein', () => {
  const rx = vm.runInNewContext(app.match(/const NICHT_LATEIN = (\/[^\n]+\/u);/)[1]);
  for (const w of ['أموكسيسيلين', 'Amoxicillin أموكسيسيلين', 'አሞክሲሲሊን']) assert.ok(rx.test(w), w);
  for (const w of ['Amoxicillin', 'Artéméther/Luméfantrine', 'Ceftriaxona 1 g', '500 mg', '']) assert.ok(!rx.test(w), w);
});

test('Alle drei Eingabestellen zeigen den Hinweis: Meldeformular, Beobachtungsliste, Sortiments-Check', () => {
  const stellen = [...app.matchAll(/lateinHinweis\(card\.querySelector\('\[data-latein\]'\), (\w+)\.value\)/g)].map((m) => m[1]);
  for (const v of ['winput', 'input', 'ta']) assert.ok(stellen.includes(v), v);
  assert.equal((app.match(/<div data-latein><\/div>/g) || []).length, 3);
});

test('Hinweistext in allen fünf Sprachen, mit lateinischem Beispiel', () => {
  const texte = [...i18n.matchAll(/wk_latein:'([^']*)'/g)].map((m) => m[1]);
  assert.equal(texte.length, 5);
  for (const tx of texte) assert.match(tx, /Amoxicill?in/);
});
