import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';

// Seed enthält u.a. Amoxicillin gültig bis 2026-07-31, Ramipril bis 2026-08-10.
function repoAt(today) { return createRabatteRepo({ seed: true, today }); }

test('daysLeft: Kalendertage bis Aktionsende', () => {
  const r = repoAt('2026-07-20');
  assert.equal(r.daysLeft('2026-07-31'), 11);
  assert.equal(r.daysLeft('2026-07-20'), 0);
  assert.equal(r.daysLeft('2026-07-21'), 1);
});

test('listTop10: expiring_soon markiert Aktionen mit <=14 Tagen Restlaufzeit', () => {
  const top = repoAt('2026-07-20').listTop10();
  const amox = top.find(r => r.bezeichnung === 'Amoxicillin 1000 mg'); // bis 2026-07-31 -> 11 Tage
  assert.equal(amox.days_left, 11);
  assert.equal(amox.expiring_soon, true);
  const cet = top.find(r => r.bezeichnung === 'Cetirizin 10 mg'); // bis 2026-10-31 -> weit weg
  assert.equal(cet.expiring_soon, false);
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
