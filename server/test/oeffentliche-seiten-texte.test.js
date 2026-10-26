// Öffentliche Engpass-Seiten (26.10.2026): richtige Herkunftsangabe auf Seiten ohne amtliche
// Liste, Ländernamen in der Sprache der Seite, Besuche aus Suchmaschinen messbar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOeffentlicheSeiten } from '../src/services/oeffentlicheSeiten.js';

const chronik = { kurz: () => null, beobachteteLaender: () => [{ land: 'AU' }], bekannteWirkstoffe: () => [], fuer: () => null, offenAnderswo: () => [] };
const repo = { list: ({ country }) => country === 'AU' ? [{ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxil 500', status: 'kritisch', provenance: 'verified', country: 'AU', quelle: 'TGA' }] : [] };
const laender = { SN: { locale_default: 'fr', regulator: 'ARP' }, NG: { locale_default: 'en', regulator: 'NAFDAC' }, EG: { locale_default: 'ar', regulator: 'EDA' }, AU: { locale_default: 'en', regulator: 'TGA' } };
const seiten = createOeffentlicheSeiten({ chronik, shortagesRepo: repo, laender, ohneQuelle: (cc) => cc !== 'AU' });
const basis = 'https://www.apopulse.com';

test('Seite ohne amtliche Liste behauptet keine amtliche Quelle', () => {
  const sn = seiten.land('SN', { basis }); const ng = seiten.land('NG', { basis });
  assert.doesNotMatch(sn, /issues de la liste officielle/);
  assert.match(sn, /ne sont pas confirmés officiellement/);
  assert.doesNotMatch(ng, /Data from the official shortage list/);
  assert.match(ng, /not officially confirmed/);
  // Seite MIT amtlicher Liste behält den Hinweis auf die amtliche Liste.
  assert.match(seiten.land('AU', { basis }), /Data from the official shortage list/);
});

test('Übersicht: Ländernamen in der Sprache der Seite und danach sortiert', () => {
  const fr = seiten.index({ basis, sp: 'fr' });
  assert.match(fr, />Égypte</); assert.match(fr, />Australie</);
  assert.doesNotMatch(fr, /مصر/, 'arabischer Name auf der französischen Seite');
  const namen = [...fr.matchAll(/<li><a href="\/engpaesse\/[a-z]{2}">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  assert.deepEqual(namen, [...namen].sort((a, b) => a.localeCompare(b, 'fr')));
});

test('Knöpfe in die App tragen die Herkunft „suchmaschine" (Cockpit: Besuche → Konten)', () => {
  for (const html of [seiten.land('SN', { basis }), seiten.land('AU', { basis }), seiten.wirkstoff('AU', 'amoxicillin', { basis })]) {
    const knopf = html.match(/<a class="b" href="([^"]+)"/)[1];
    assert.match(knopf, /[?&]amp;k=suchmaschine|&amp;k=suchmaschine/, knopf);
  }
});

test('Cockpit nennt den Kanal in Klartext („Suchmaschinen (Google & Co.)")', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /k === 'suchmaschine' \? t\('bt_kanal_suche'\)/);
  assert.equal((readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8').match(/bt_kanal_suche:'/g) || []).length, 5);
});
