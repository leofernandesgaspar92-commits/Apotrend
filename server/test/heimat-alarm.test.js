// Heimat-Alarm (fruehwarnung.meldeHeimat): Die Behörde des EIGENEN Landes
// führt einen beobachteten Wirkstoff neu als knapp — oder nicht mehr.
//
// Bis 10/2026 kam dieser Hinweis nie: Die Frühwarnung übersprang das
// Heimatland („meldet der normale Alarm"), der normale Alarm feuerte aber nur
// bei Community- und Redaktionsmeldungen. Der wichtigste Fall blieb stumm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createFruehwarnung } from '../src/services/fruehwarnung.js';
import { createShortagesService } from '../src/services/shortages.js';

const TAG = 86400000;
const z = (wirkstoff, country, o = {}) => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status: 'kritisch', country, provenance: 'verified', ...o });

function aufbau(heimat = { at: 'AT', de: 'DE', frei: 'AT' }) {
  let t = Date.parse('2026-10-01T09:00:00Z');
  const chronik = createChronik({ jetzt: () => t, log: { warn() {} } });
  const repo = createShortagesRepo({ seed: false });
  const glocke = [];
  const social = { pushNotification: (n) => { glocke.push(n); return n; } };
  // Niemand hat Premium: Der Heimat-Alarm ist gratis.
  const fw = createFruehwarnung({ chronik, shortagesRepo: repo, social, istPremium: () => false, heimatVon: (u) => heimat[u] });
  const lauf = (zeilen, laender) => { const b = chronik.beobachte({ zeilen, laender }); fw.melde(b.neue); fw.meldeHeimat(b.neue, b.beendete); return b; };
  return { repo, glocke, lauf, weiter: (d) => { t += d * TAG; } };
}

test('Behörde des Heimatlands meldet neu knapp -> Hinweis, auch ohne Premium', () => {
  const a = aufbau();
  a.repo.addWatch('at', 'Cefuroxim');
  a.lauf([z('Rest', 'AT')], ['AT']); // erster Lauf
  a.weiter(1);
  a.lauf([z('Rest', 'AT'), z('Cefuroxim', 'AT')], ['AT']);
  assert.deepEqual(a.glocke.map((g) => [g.userId, g.type, g.label]), [['at', 'shortage_home', 'Cefuroxim · AT']]);
});

test('Schreibweise der Behörde zählt nicht: „Amoxicillin" trifft „Amoxicillin-Trihydrat"', () => {
  const a = aufbau();
  a.repo.addWatch('de', 'Amoxicillin');
  a.lauf([z('Rest', 'DE')], ['DE']);
  a.weiter(1);
  a.lauf([z('Rest', 'DE'), z('Amoxicillin-Trihydrat', 'DE')], ['DE']);
  assert.equal(a.glocke.length, 1);
  assert.equal(a.glocke[0].label, 'Amoxicillin · DE', 'im Hinweis der Name, den die Person beobachtet');
});

test('wieder lieferbar -> Hinweis; nur im Heimatland, nicht am ersten Lauf', () => {
  const a = aufbau();
  a.repo.addWatch('at', 'Cefuroxim');
  a.repo.addWatch('de', 'Cefuroxim');
  a.lauf([z('Rest', 'AT'), z('Cefuroxim', 'AT')], ['AT']); // erster Lauf: kein Alarm für Altfall
  assert.equal(a.glocke.length, 0);
  a.weiter(3);
  a.lauf([z('Rest', 'AT')], ['AT']);
  assert.deepEqual(a.glocke.map((g) => [g.userId, g.type, g.label]), [['at', 'shortage_ended', 'Cefuroxim · AT']], 'DE-Apotheke betrifft das Ende in AT nicht');
});

test('fremdes Land löst keinen Heimat-Alarm aus; Verdacht auf abgeschnittene Antwort meldet kein „lieferbar"', () => {
  const a = aufbau();
  a.repo.addWatch('at', 'Cefuroxim');
  a.lauf([z('Rest', 'DE')], ['DE']);
  a.weiter(1);
  a.lauf([z('Rest', 'DE'), z('Cefuroxim', 'DE')], ['DE']);
  assert.equal(a.glocke.filter((g) => g.type === 'shortage_home').length, 0);
  // 12 offene in AT, dann fehlen alle bis auf einen: Chronik hält zurück -> keine Entwarnung.
  const b = aufbau();
  b.repo.addWatch('at', 'W0');
  const viele = Array.from({ length: 12 }, (_, i) => z('W' + i, 'AT'));
  b.lauf(viele, ['AT']);
  b.weiter(1);
  b.lauf([z('W11', 'AT')], ['AT']);
  assert.equal(b.glocke.length, 0, 'abgeschnittene Antwort darf nicht „wieder lieferbar" melden');
});

test('Beobachtungsliste zeigt den Status auch bei anderer Schreibweise der Behörde', () => {
  const repo = createShortagesRepo({ seed: false });
  repo.replaceFeed([{ wirkstoff: 'Amoxicillin-Trihydrat', bezeichnung: 'Amoxi 1000', status: 'kritisch', country: 'DE', gemeldet_am: '2026-10-01' }], { provenance: 'verified', quelle: 'BfArM', laender: ['DE'] });
  const social = { pushNotification() {}, getProfile: () => null, isModerator: () => false };
  const svc = createShortagesService(repo, social, { hasPremium: () => false, heimatVon: () => 'DE' });
  repo.addWatch('u', 'Amoxicillin');
  const [w] = svc.myWatchlist('u');
  assert.equal(w.status, 'kritisch', 'beobachtet „Amoxicillin", BfArM schreibt „Amoxicillin-Trihydrat"');
});
