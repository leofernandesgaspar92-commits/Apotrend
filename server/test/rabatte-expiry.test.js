import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';

// Die Referenzdaten tragen RELATIVE Laufzeiten (Tage ab dem Vergleichsdatum),
// keine festen Kalenderdaten mehr. Tests dürfen sich deshalb nicht auf das
// Enddatum einer bestimmten Seed-Zeile stützen — genau daran ist dieser Test
// schon einmal umgefallen, an einem Kalendertag, ohne Codeänderung.
// Wer eine konkrete Restlaufzeit prüfen will, legt sich seine Zeile selbst an.
function repoAt(today) { return createRabatteRepo({ seed: true, today }); }

test('daysLeft: Kalendertage bis Aktionsende', () => {
  const r = repoAt('2026-07-20');
  assert.equal(r.daysLeft('2026-07-31'), 11);
  assert.equal(r.daysLeft('2026-07-20'), 0);
  assert.equal(r.daysLeft('2026-07-21'), 1);
});

test('listTop10: expiring_soon markiert Aktionen mit <=14 Tagen Restlaufzeit', () => {
  const r = repoAt('2026-07-20');
  // Eigene Zeilen statt Seed-Zeilen: So steht die Restlaufzeit im Test selbst
  // und haengt nicht daran, wie lange eine Referenz-Aktion gerade laeuft.
  r.upsert({ bezeichnung: 'Bald weg', supplier: 'X', listenpreis: 2, aktionspreis: 1, gueltig_bis: '2026-07-31' }); // 11 Tage
  r.upsert({ bezeichnung: 'Noch lange', supplier: 'X', listenpreis: 2, aktionspreis: 1, gueltig_bis: '2026-10-31' });

  const top = r.listTop10();
  const bald = top.find((x) => x.bezeichnung === 'Bald weg');
  assert.equal(bald.days_left, 11);
  assert.equal(bald.expiring_soon, true);
  assert.equal(top.find((x) => x.bezeichnung === 'Noch lange').expiring_soon, false);
});

test('listTop10: Aktion mit genau 14 Tagen ist noch "bald", mit 15 nicht', () => {
  const r = repoAt('2026-07-01');
  r.upsert({ bezeichnung: 'Test14', supplier: 'X', listenpreis: 2, aktionspreis: 1, gueltig_bis: '2026-07-15' }); // 14 Tage
  r.upsert({ bezeichnung: 'Test15', supplier: 'X', listenpreis: 2, aktionspreis: 1, gueltig_bis: '2026-07-16' }); // 15 Tage
  const top = r.listTop10();
  assert.equal(top.find(x => x.bezeichnung === 'Test14').expiring_soon, true);
  assert.equal(top.find(x => x.bezeichnung === 'Test15').expiring_soon, false);
});

test('listTop10: abgelaufene Aktionen tauchen nicht auf', () => {
  const top = repoAt('2026-07-20').listTop10();
  assert.equal(top.find(r => r.bezeichnung === 'Diclofenac 50 mg'), undefined);
});
