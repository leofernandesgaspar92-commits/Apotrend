// Sortiments-Check (services/sortiment.js): eigene Liste gegen die Behördenlisten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createSortiment, zeilenAusText, FREI_ZEILEN } from '../src/services/sortiment.js';

const TAG = 86400000;
const z = (wirkstoff, country, status = 'kritisch') => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status, country, provenance: 'verified', quelle: country === 'AT' ? 'BASG' : 'FDA' });

function aufbau(premium = false) {
  let t = Date.parse('2026-09-01T09:00:00Z');
  const chronik = createChronik({ jetzt: () => t, log: { warn() {} } });
  const repo = createShortagesRepo({ seed: false });
  const lauf = (zeilen, laender) => { repo.replaceFeed(zeilen, { provenance: 'verified', quelle: 'Behörde', laender }); chronik.beobachte({ zeilen: repo.list(), laender }); };
  // Verlauf in AT: Cefuroxim war 10 Tage knapp, ist es jetzt nicht mehr.
  lauf([z('Cefuroxim', 'AT'), z('Rest', 'AT'), z('Rest', 'US')], ['AT', 'US']);
  t += 10 * TAG;
  lauf([z('Amoxicillin', 'AT'), z('Rest', 'AT'), z('Rest', 'US'), z('Salbutamol', 'US')], ['AT', 'US']);
  t += 2 * TAG;
  lauf([z('Amoxicillin', 'AT'), z('Rest', 'AT'), z('Rest', 'US'), z('Albuterol Sulfate', 'US'), z('Ibuprofen', 'US', 'verfuegbar')], ['AT', 'US']);
  const s = createSortiment({ shortagesRepo: repo, chronik, istPremium: () => premium });
  return { s, repo };
}

test('Zeilen aus Text: Liste, Kommaliste, CSV mit Wirkstoff-Spalte, CSV ohne', () => {
  assert.deepEqual(zeilenAusText('Amoxicillin\r\n\r\n Ibuprofen \n'), ['Amoxicillin', 'Ibuprofen']);
  assert.deepEqual(zeilenAusText('Amoxicillin, Ibuprofen; Cefuroxim'), ['Amoxicillin', 'Ibuprofen', 'Cefuroxim']);
  assert.deepEqual(zeilenAusText('﻿PZN;Artikel;Wirkstoff;Menge\n0123;Amoxi 1A 1000;Amoxicillin;20\n0456;Ibu Hexal;Ibuprofen;5'), ['Amoxicillin', 'Ibuprofen']);
  // Warenwirtschaft: Artikel-Spalte statt ganzer Zeile; ohne benannte Spalte fallen Kopfzeile und Zahlenfelder weg.
  assert.deepEqual(zeilenAusText('PZN;Artikel;Menge\n0123;Amoxi 1000 mg;20\n0456;Ibu 400;5'), ['Amoxi 1000 mg', 'Ibu 400']);
  assert.deepEqual(zeilenAusText('Nr;X;Stk\n0123;Amoxicillin 1000 mg;20\n0456;Ibuprofen 400;5'), ['Amoxicillin 1000 mg', 'Ibuprofen 400']);
});

test('Einstufung: knapp / ausland / wiederholt / ruhig / unbekannt — knapp zuerst', () => {
  const { s } = aufbau();
  const r = s.pruefen('u', 'Ibuprofen\nCefuroxim\nSalbutamol 100 µg Dosieraerosol\nAmoxicillin Sandoz 1000 mg Filmtabletten\nGibtsnichtin', 'AT');
  const kurz = r.ergebnisse.map((e) => [e.eingabe.split(' ')[0], e.einstufung]);
  assert.deepEqual(kurz, [['Amoxicillin', 'knapp'], ['Salbutamol', 'ausland'], ['Cefuroxim', 'wiederholt'], ['Ibuprofen', 'ruhig'], ['Gibtsnichtin', 'unbekannt']]);
  const amox = r.ergebnisse[0];
  assert.equal(amox.wirkstoff, 'Amoxicillin'); assert.equal(amox.status, 'kritisch'); assert.equal(amox.seit_tagen, 2);
  assert.equal(amox.herkunft, 'verified');
  const salb = r.ergebnisse[1];
  assert.deepEqual(salb.ausland.map((a) => a.land), ['US'], 'US-Name „Albuterol" ist Salbutamol');
  assert.deepEqual(r.ergebnisse[2].verlauf, { anzahl: 1, durchschnitt_tage: 10 });
  assert.deepEqual(r.zusammenfassung, { knapp: 1, ausland: 1, wiederholt: 1, ruhig: 1, unbekannt: 1 });
  assert.deepEqual(r.laender.map((l) => l.land), ['AT', 'US'], 'nennt die Listen, gegen die geprüft wurde');
});

test('Kombination in einer Präparatzeile bleibt Kombination', () => {
  const { s, repo } = aufbau();
  repo.replaceFeed([...repo.list().filter((x) => x.country !== 'AT'), z('Amoxicillin/Clavulansäure', 'AT'), z('Amoxicillin', 'AT')], { provenance: 'verified', quelle: 'BASG', laender: ['AT'] });
  for (const zeile of ['Amoxicillin/Clavulansäure 875/125 mg Filmtabletten', 'Amoxicillin + Clavulansäure 875/125 mg Filmtabletten', 'Amoxicillin und Clavulansäure Pulver']) {
    const r = s.pruefen('u', zeile, 'AT');
    assert.equal(r.ergebnisse[0].wirkstoff, 'Amoxicillin/Clavulansäure', `„${zeile}": Kombination darf nicht als Monopräparat zählen`);
  }
});

test('dieselbe Substanz zweimal (andere Schreibweise) zählt einmal', () => {
  const { s } = aufbau();
  const r = s.pruefen('u', 'Amoxicillin\nAmoxicillin-Trihydrat\nAmoxicilina', 'AT');
  assert.equal(r.ergebnisse.length, 1);
});

test('gratis: nur die ersten Zeilen, Rest gesperrt; Premium: alles', () => {
  const liste = Array.from({ length: 40 }, (_, i) => 'Wirkstoff' + i).join('\n') + '\nAmoxicillin';
  const frei = aufbau(false).s.pruefen('u', liste, 'AT');
  assert.deepEqual([frei.geprueft, frei.gesperrt, frei.grenze], [FREI_ZEILEN, 41 - FREI_ZEILEN, FREI_ZEILEN]);
  assert.ok(!frei.ergebnisse.some((e) => e.wirkstoff === 'Amoxicillin'), 'gesperrte Zeile wurde trotzdem ausgewertet');
  const voll = aufbau(true).s.pruefen('u', liste, 'AT');
  assert.equal(voll.gesperrt, 0);
  assert.ok(voll.ergebnisse.some((e) => e.einstufung === 'knapp'));
});

test('beobachtet: auch unter anderer Schreibweise erkannt', () => {
  const { s, repo } = aufbau();
  repo.addWatch('u', 'Amoxicilina');
  const r = s.pruefen('u', 'Amoxicillin', 'AT');
  assert.equal(r.ergebnisse[0].beobachtet, true);
});

test('Anzeige in der eigenen Sprache; „ähnlich" nur als Hinweis', () => {
  let t = Date.parse('2026-09-01T09:00:00Z');
  const chronik = createChronik({ jetzt: () => t, log: { warn() {} } });
  const repo = createShortagesRepo({ seed: false });
  const zeilen = [z('Methylphenidate Hydrochloride', 'US'), z('Methylphenidathydrochlorid', 'DE'), z('Cefuroxim-Axetil', 'DE'), z('Cefuroxime Axetil', 'US'), z('Rest', 'AT')];
  repo.replaceFeed(zeilen, { provenance: 'verified', quelle: 'x', laender: ['US', 'DE', 'AT'] });
  chronik.beobachte({ zeilen: repo.list(), laender: ['US', 'DE', 'AT'] });
  const s = createSortiment({ shortagesRepo: repo, chronik, istPremium: () => false });
  const r = s.pruefen('u', 'Methylphenidat Hexal 10 mg\nCefuroxim Sandoz 500 mg', 'AT');
  const mph = r.ergebnisse.find((e) => e.einstufung === 'ausland');
  assert.equal(mph.wirkstoff, 'Methylphenidathydrochlorid', 'österreichische Apotheke sieht den deutschen Namen, nicht den der FDA');
  const cef = r.ergebnisse.find((e) => /Cefuroxim/.test(e.eingabe));
  assert.equal(cef.einstufung, 'unbekannt', 'Cefuroxim ist nicht Cefuroxim-Axetil — keine Gleichsetzung');
  assert.equal(cef.aehnlich.length, 1, 'ein Hinweis statt „nie gemeldet" — beide Schreibweisen nur einmal: ' + JSON.stringify(cef.aehnlich));
  assert.match(cef.aehnlich[0], /Cefuroxim/);
});
