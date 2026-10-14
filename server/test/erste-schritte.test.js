// Erste Schritte (services/ersteSchritte.js): Vorschläge zum Antippen —
// amtlich Knappes zuerst (mit Quelle), dann häufig Benötigtes OHNE Status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ersteSchritte } from '../src/services/ersteSchritte.js';

function repo(zeilen) { return { list: ({ country }) => zeilen.filter((z) => !country || z.country === country) }; }
const z = (wirkstoff, status, extra = {}) => ({ wirkstoff, status, country: 'AT', provenance: 'verified', quelle: 'BASG', reporter_user_id: null, ...extra });

test('Amtlich knapp zuerst, „nicht lieferbar" vor „eingeschränkt", ohne Doppelte', () => {
  const r = ersteSchritte({ shortagesRepo: repo([z('Ibuprofen', 'eingeschraenkt'), z('Amoxicillin', 'kritisch'), z('amoxicillin', 'eingeschraenkt'), z('Metformin', 'verfuegbar')]), land: 'AT' });
  assert.equal(r.amtlich, 2);
  assert.deepEqual(r.vorschlaege.slice(0, 2).map((v) => [v.wirkstoff, v.status, v.quelle]), [['Amoxicillin', 'kritisch', 'BASG'], ['Ibuprofen', 'eingeschraenkt', 'BASG']]);
  // Häufige ergänzen, aber nicht doppelt (Amoxicillin/Ibuprofen stehen schon oben).
  const namen = r.vorschlaege.map((v) => v.wirkstoff.toLowerCase());
  assert.equal(new Set(namen).size, namen.length);
  assert.equal(r.vorschlaege.length, 12);
});

test('Ohne Quelle kein Status: Apotheken-Meldungen, Beispieldaten und fremde Länder zählen nicht', () => {
  const r = ersteSchritte({ shortagesRepo: repo([
    z('Gemeldetin', 'kritisch', { provenance: 'community', reporter_user_id: 'u9', quelle: null }),
    z('Levothyroxin', 'kritisch', { provenance: 'reference' }),
    z('Salbutamol', 'kritisch', { country: 'DE' }),
  ]), land: 'AT' });
  assert.equal(r.amtlich, 0);
  assert.ok(r.vorschlaege.every((v) => v.status === null && v.quelle === null), 'Status ohne amtliche Quelle');
  assert.ok(!r.vorschlaege.some((v) => v.wirkstoff === 'Gemeldetin'));
});

test('Sprache des Landes und schon Beobachtetes markiert (auch über Sprachen hinweg)', () => {
  const r = ersteSchritte({ shortagesRepo: repo([]), land: 'AO', sprache: 'pt', beobachtet: ['Amoxicillin'] });
  assert.equal(r.vorschlaege[0].wirkstoff, 'Amoxicilina');
  assert.equal(r.vorschlaege[0].beobachtet, true, '„Amoxicillin" beobachtet = „Amoxicilina" beobachtet');
  assert.equal(r.vorschlaege[1].beobachtet, false);
});
