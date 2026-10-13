// Vorrats-Radar (services/radar.js): im Ausland knapp, bei dir nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { vorratsRadar, RADAR_FREI } from '../src/services/radar.js';

const TAG = 86400000;
const z = (wirkstoff, country) => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status: 'kritisch', country, provenance: 'verified', quelle: country });

function aufbau() {
  let t = Date.parse('2026-09-01T09:00:00Z');
  const c = createChronik({ jetzt: () => t, log: { warn() {} } });
  const lauf = (zeilen, laender) => c.beobachte({ zeilen, laender });
  // AT: Cefuroxim war schon einmal knapp (5 Tage).
  lauf([z('Cefuroxim', 'AT'), z('Rest', 'AT'), z('Alt', 'US'), z('Alt', 'DE')], ['AT', 'US', 'DE']);
  t += 5 * TAG;
  lauf([z('Rest', 'AT'), z('Alt', 'US'), z('Alt', 'DE'), z('Cefuroxim', 'US')], ['AT', 'US', 'DE']);
  t += 3 * TAG;
  lauf([z('Rest', 'AT'), z('Alt', 'US'), z('Alt', 'DE'), z('Cefuroxim', 'US'), z('Albuterol Sulfate', 'US'), z('Salbutamol', 'DE'), z('Neu', 'DE'), z('Rest', 'DE')], ['AT', 'US', 'DE']);
  return c;
}

test('Rangfolge: mehr Länder, dann „war bei dir schon knapp", dann frischeste', () => {
  const r = vorratsRadar({ chronik: aufbau(), land: 'AT', premium: true });
  assert.equal(r.eintraege.length, 4);
  const namen = r.eintraege.map((e) => e.wirkstoff.toLowerCase());
  assert.ok(namen.indexOf('cefuroxim') < namen.indexOf('neu'), 'gleich viele Länder: Cefuroxim war bei uns schon knapp -> vorne');
  assert.ok(r.eintraege.slice(0, 2).every((e) => e.laender.length === 2), 'zwei Länder vor einem Land');
  assert.ok(!namen.includes('rest'), 'bei dir schon knapp gehört nicht in den Radar');
  const salb = r.eintraege.find((e) => /salbutamol|albuterol/i.test(e.wirkstoff));
  assert.deepEqual(salb.laender.map((l) => l.land).sort(), ['DE', 'US'], 'Albuterol (US) = Salbutamol (DE)');
  assert.deepEqual(r.eintraege.find((e) => e.wirkstoff === 'Cefuroxim').verlauf_hier, { anzahl: 1, durchschnitt_tage: 5 });
  assert.equal(r.heimat_beobachtet, true);
});

test('gratis: nur die ersten Einträge, Gesamtzahl bekannt', () => {
  const frei = vorratsRadar({ chronik: aufbau(), land: 'AT', premium: false });
  assert.equal(frei.eintraege.length, RADAR_FREI);
  assert.equal(frei.gesamt, 4);
  assert.equal(frei.gesperrt, 4 - RADAR_FREI);
  assert.equal(vorratsRadar({ chronik: aufbau(), land: 'AT', premium: true }).gesperrt, 0);
});

test('Land ohne Behördenliste: ehrlich markiert', () => {
  const r = vorratsRadar({ chronik: aufbau(), land: 'PT', premium: true });
  assert.equal(r.heimat_beobachtet, false);
});

test('beobachtet über den Wirkstoff-Schlüssel', () => {
  const r = vorratsRadar({ chronik: aufbau(), land: 'AT', premium: true, beobachtet: ['Albuterol'] });
  assert.equal(r.eintraege.find((e) => /salbutamol|albuterol/i.test(e.wirkstoff)).beobachtet, true);
});

test('Radar zeigt die Schreibweise der eigenen Sprache', () => {
  let t = Date.parse('2026-09-01T09:00:00Z');
  const c = createChronik({ jetzt: () => t, log: { warn() {} } });
  c.beobachte({ zeilen: [z('Methylphenidate Hydrochloride', 'US'), z('Methylphenidathydrochlorid', 'DE'), z('Rest', 'AT')], laender: ['US', 'DE', 'AT'] });
  assert.equal(vorratsRadar({ chronik: c, land: 'AT', premium: true }).eintraege[0].wirkstoff, 'Methylphenidathydrochlorid');
  assert.equal(vorratsRadar({ chronik: c, land: 'GB', premium: true }).eintraege[0].wirkstoff, 'Methylphenidate Hydrochloride');
});
