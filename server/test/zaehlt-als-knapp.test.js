// Umstrittene und veraltete Apotheken-Meldungen — eine Regel je Zweck:
//  • Automatische Schlüsse (Frühwarnung an Großhändler, Einstufung „knapp" im Sortiments-Check):
//    zaehltAlsKnapp — umstritten und veraltet zählen NICHT. Fund 11/2026: beides zählte mit.
//  • Anzeigen/Übersichten (Afrika/Welt, Länder-Vorschau, Lage im Zielland): umstrittene Meldungen
//    bleiben sichtbar (nie „bestätigt"), damit zwei Widersprüche keinen Engpass verstecken; veraltete
//    nicht. Fund 11/2026: Die Lage im Zielland zählte auch 30+ Tage alte Meldungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zaehltAlsKnapp } from '../src/services/shortages.js';
import { regionLage } from '../src/services/regionLage.js';
import { regionaleSignale } from '../src/services/ausbruch.js';
import { createSortiment } from '../src/services/sortiment.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createChronik } from '../src/services/chronik.js';
import { COUNTRIES, laenderInRegion, regionVon } from '../src/data/countries.js';

const heute = new Date().toISOString().slice(0, 10);
const vor = (t) => new Date(Date.now() - t * 86_400_000).toISOString().slice(0, 10);
let n = 0;
const apo = (wirkstoff, { tage = 0, widerspruch = 0, country = 'KE' } = {}) => ({
  id: 'c' + (++n), wirkstoff, bezeichnung: wirkstoff, status: 'kritisch', country, provenance: 'community', reporter_user_id: 'u' + n,
  gemeldet_am: vor(tage), zuletzt_aktiv: vor(tage), confirmations: [], history: [{ am: vor(tage), status: 'kritisch' }],
  widersprueche: Array.from({ length: widerspruch }, (_, i) => ({ userId: `w${n}_${i}`, grund: 'bei_uns_lieferbar' })),
});

test('Regel: frisch zählt; umstritten, veraltet, wieder lieferbar nicht; amtlich immer', () => {
  assert.equal(zaehltAlsKnapp(apo('Metformin'), heute), true);
  assert.equal(zaehltAlsKnapp(apo('Oxytocin', { widerspruch: 2 }), heute), false, 'umstritten');
  assert.equal(zaehltAlsKnapp(apo('Oxytocin', { widerspruch: 1 }), heute), true, 'ein einzelner Widerspruch macht noch nicht umstritten');
  assert.equal(zaehltAlsKnapp(apo('Salbutamol', { tage: 40 }), heute), false, 'veraltet');
  assert.equal(zaehltAlsKnapp(apo('Salbutamol', { tage: 20 }), heute), true, '„Status unklar" bleibt sichtbar, ist aber nicht veraltet');
  assert.equal(zaehltAlsKnapp({ ...apo('X'), status: 'verfuegbar' }, heute), false);
  assert.equal(zaehltAlsKnapp({ wirkstoff: 'X', status: 'kritisch', provenance: 'verified', country: 'AT' }, heute), true);
});

test('Afrika/Welt-Übersicht: umstritten bleibt sichtbar, veraltet nicht', () => {
  const zeilen = [apo('Metformin'), apo('Oxytocin', { widerspruch: 2 }), apo('Salbutamol', { tage: 40 })];
  const r = regionLage({ shortagesRepo: { list: () => zeilen }, chronik: { aufzeichnungSeit: () => null }, laender: COUNTRIES, codes: laenderInRegion('AFRICA') });
  assert.deepEqual([r.laender.find((l) => l.land === 'KE').apotheken, r.laender.find((l) => l.land === 'KE').apotheken_bestaetigt], [2, 0]);
});

test('Ausbruchs-Radar: umstrittene Meldungen lösen keine Frühwarnung aus', () => {
  const sig = (meldungen) => regionaleSignale({ episoden: [], meldungen, regionVon, heute: Date.now() });
  const drei = (w) => [apo('Oxytocin', { country: 'KE' }), apo('Oxytocin', { country: 'UG', widerspruch: w }), apo('Oxytocin', { country: 'TZ', widerspruch: w })];
  assert.equal(sig(drei(0)).length, 1, 'Kontrolle: drei echte Meldungen ergeben ein Signal');
  assert.equal(sig(drei(2)).length, 0, 'zwei umstrittene Meldungen haben die Frühwarnung ausgelöst');
});

test('Sortiments-Check: umstrittene Meldung macht den Wirkstoff nicht „knapp"', () => {
  const basis = createShortagesRepo({ seed: false });
  const eigene = [apo('Oxytocin', { widerspruch: 2 }), apo('Metformin')];
  const repo = { ...basis, list: (o = {}) => [...basis.list(o), ...eigene.filter((z) => !o.country || z.country === o.country)] };
  const chronik = createChronik({ log: { warn() {} } });
  const s = createSortiment({ shortagesRepo: repo, chronik, istPremium: () => true });
  const r = s.pruefen('u-test', 'Oxytocin\nMetformin', 'KE');
  const e = Object.fromEntries(r.ergebnisse.map((x) => [x.wirkstoff, x.einstufung]));
  assert.equal(e.Metformin, 'knapp');
  assert.notEqual(e.Oxytocin, 'knapp');
});

test('Zulassungs-Check (Lage im Zielland): veraltete Meldungen zählen nicht', () => {
  const server = readFileSync(new URL('../src/http/server.js', import.meta.url), 'utf8');
  const lageIn = server.slice(server.indexOf('const lageIn = (w) => {'), server.indexOf('const lageIn = (w) => {') + 600);
  assert.match(lageIn, /aktualitaet\(z, new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\)\.stufe !== 'veraltet'/, 'Lage im Zielland zählt 30+ Tage alte Meldungen');
});
