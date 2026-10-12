// Frühwarnung (services/fruehwarnung.js): beobachteter Wirkstoff im Ausland neu knapp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createFruehwarnung } from '../src/services/fruehwarnung.js';

const TAG = 86400000;
const z = (wirkstoff, country, o = {}) => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status: 'kritisch', country, provenance: 'verified', ...o });

function aufbau({ premium = ['at1', 'de1', 'pt1', 'us1'], heimat = { at1: 'AT', de1: 'DE', pt1: 'PT', us1: 'US', frei: 'AT' } } = {}) {
  let t = Date.parse('2026-10-01T09:00:00Z');
  const chronik = createChronik({ jetzt: () => t, log: { warn() {} } });
  const repo = createShortagesRepo({ seed: false });
  const glocke = [];
  const social = { pushNotification: (n) => { glocke.push(n); return n; } };
  const fw = createFruehwarnung({ chronik, shortagesRepo: repo, social, istPremium: (u) => premium.includes(u), heimatVon: (u) => heimat[u] });
  const lauf = (zeilen, laender) => { const b = chronik.beobachte({ zeilen, laender }); fw.melde(b.neue); return b; };
  return { chronik, repo, glocke, fw, lauf, weiter: (d) => { t += d * TAG; } };
}

test('neu im Ausland -> Premium-Beobachter:in im anderen Land wird benachrichtigt', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'Cefuroxim');
  a.lauf([z('Rest', 'US'), z('Rest', 'AT')], ['US', 'AT']); // erster Lauf
  a.weiter(1);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US'), z('Rest', 'AT')], ['US', 'AT']);
  assert.equal(a.glocke.length, 1);
  assert.deepEqual([a.glocke[0].userId, a.glocke[0].type, a.glocke[0].label], ['at1', 'shortage_abroad', 'Cefuroxim · US']);
});

test('Regel 2: kein Alarm am ersten Lauf eines Landes (Altfälle)', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'Cefuroxim');
  a.lauf([z('Cefuroxim', 'US')], ['US']);
  assert.equal(a.glocke.length, 0, 'jeder laufende US-Engpass hätte beim ersten Abruf alarmiert');
});

test('Regel 3: kein Alarm, wenn es im Heimatland schon knapp ist', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'Cefuroxim');
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'AT')], ['US', 'AT']);
  a.weiter(1);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US'), z('Cefuroxim', 'AT')], ['US', 'AT']);
  assert.equal(a.glocke.length, 0);
});

test('Regel 4: das eigene Land meldet der normale Alarm, nicht die Frühwarnung', () => {
  const a = aufbau();
  a.repo.addWatch('us1', 'Cefuroxim');
  a.lauf([z('Rest', 'US')], ['US']);
  a.weiter(1);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US')], ['US']);
  assert.equal(a.glocke.length, 0);
});

test('nur Premium bekommt die Push-Benachrichtigung', () => {
  const a = aufbau();
  a.repo.addWatch('frei', 'Cefuroxim');
  a.repo.addWatch('pt1', 'Cefuroxim');
  a.lauf([z('Rest', 'US')], ['US']);
  a.weiter(1);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US')], ['US']);
  assert.deepEqual(a.glocke.map((g) => g.userId), ['pt1'], 'auch ein nie abgerufenes Heimatland (PT) bekommt die Warnung');
});

test('Regel 5: Namen gefaltet, nicht übersetzt', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'cefuroxim');
  a.repo.addWatch('pt1', 'Cefuroxima');
  a.lauf([z('Rest', 'US')], ['US']);
  a.weiter(1);
  a.lauf([z('Rest', 'US'), z('CEFUROXIM', 'US')], ['US']);
  assert.deepEqual(a.glocke.map((g) => g.userId), ['at1']);
});

test('Wiederaufnahme nach kurzer Lücke alarmiert nicht erneut', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'Cefuroxim');
  a.lauf([z('Rest', 'US')], ['US']); a.weiter(1);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US')], ['US']); a.weiter(1);
  a.lauf([z('Rest', 'US')], ['US']); a.weiter(2);
  a.lauf([z('Rest', 'US'), z('Cefuroxim', 'US')], ['US']);
  assert.equal(a.glocke.length, 1);
});

test('Anzeige: im Ausland knapp, Beobachtungsliste nur ohne heimischen Engpass', () => {
  const a = aufbau();
  a.repo.addWatch('at1', 'Cefuroxim');
  a.repo.addWatch('at1', 'Amoxicillin');
  a.lauf([z('Cefuroxim', 'US'), z('Amoxicillin', 'US'), z('Amoxicillin', 'AT')], ['US', 'AT']);
  a.weiter(4);
  assert.deepEqual(a.fw.imAusland('Cefuroxim', 'AT').map((x) => [x.land, x.dauer_tage]), [['US', 4]]);
  assert.deepEqual(a.fw.imAusland('Cefuroxim', 'US'), [], 'das angesehene Land zählt nicht als Ausland');
  const liste = a.fw.fuerBeobachtungsliste('at1', 'AT');
  assert.deepEqual(liste.map((x) => x.wirkstoff), ['Cefuroxim'], 'Amoxicillin ist hier schon knapp — keine Frühwarnung');
});
