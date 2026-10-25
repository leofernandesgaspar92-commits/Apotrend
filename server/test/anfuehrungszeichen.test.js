// Anführungszeichen je Sprache (Rundgang Tag 2, 25.10.2026): Die Benachrichtigung
// „Fatou Sarr confirme la rupture … : „Amoxicilline"" trug deutsche Zeichen — in Dakar
// liest sich das wie eine Maschinenübersetzung. „…“ ist nur deutsch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const i18nText = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(i18nText + ';this.I = I18N;', ctx);
const I = ctx.I;

test('Kein deutsches „ in englischen, portugiesischen, französischen oder arabischen Texten', () => {
  for (const sp of ['en', 'pt', 'fr', 'ar']) {
    const treffer = Object.entries(I[sp]).filter(([, v]) => typeof v === 'string' && v.includes('„')).map(([k]) => k);
    assert.deepEqual(treffer, [], sp);
  }
});

test('zitat(): je Sprache die richtigen Zeichen', () => {
  const code = app.slice(app.indexOf('const ZITAT = '), app.indexOf('function ti('));
  const erg = {};
  for (const sp of ['de', 'en', 'fr', 'pt', 'ar']) erg[sp] = vm.runInNewContext(code + `;zitat('Amoxicilline')`, { LOCALE: sp });
  assert.deepEqual(erg, { de: '„Amoxicilline“', en: '“Amoxicilline”', fr: '« Amoxicilline »', pt: '«Amoxicilline»', ar: '«Amoxicilline»' });
});

test('Oberfläche setzt keine festen deutschen Anführungszeichen um Inhalte', () => {
  const zeilen = app.split('\n').filter((z) => !/^\s*\/\//.test(z) && /„\$\{|' „'|„' \+|"„"/.test(z));
  assert.deepEqual(zeilen.map((z) => z.trim().slice(0, 80)), []);
});
