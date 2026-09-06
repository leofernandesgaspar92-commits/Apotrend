import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createPricesService } from '../src/services/prices.js';

function setup(seed = true) {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const pricesRepo = createPricesRepo({ seed });
  const prices = createPricesService(pricesRepo, social);
  const u = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'A', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(u.user.id, { handle: 'apo', displayName: 'A' });
  return { prices, pricesRepo, uid: u.user.id };
}

test('comparisons: Ersparnis günstigster vs. teuerster pro Gruppe', () => {
  const { prices, uid } = setup();
  const groups = prices.comparisons(uid);
  const amox = groups.find(g => g.bezeichnung === 'Amoxicillin 1000 mg');
  // Angebote: 3.98, 3.01, 4.10 -> min 3.01, max 4.10 -> saving 1.09
  assert.equal(amox.best_aep, 3.01);
  assert.equal(amox.best_supplier, 'Großhandel B');
  assert.equal(amox.saving_abs, 1.09);
  assert.equal(amox.saving_pct, 26.6); // (4.10-3.01)/4.10 = 26.58 -> 26.6
});

test('comparisons: günstigster Anbieter steht oben', () => {
  const { prices, uid } = setup();
  const amox = prices.comparisons(uid).find(g => g.bezeichnung === 'Amoxicillin 1000 mg');
  assert.equal(amox.offers[0].supplier, 'Großhandel B');
});

test('savingsSummary: Gesamtsumme + Top-3, nur Gruppen mit Ersparnis', () => {
  const { prices, uid } = setup();
  const s = prices.savingsSummary();
  assert.ok(s.count >= 1);
  assert.ok(s.total_abs > 0);
  assert.ok(s.top.length >= 1 && s.top.length <= 3);
  // Top-3 absteigend nach Ersparnis
  for (let i = 1; i < s.top.length; i++) assert.ok(s.top[i-1].saving_abs >= s.top[i].saving_abs);
  // Amoxicillin (1.09) sollte oben stehen
  assert.equal(s.top[0].bezeichnung, 'Amoxicillin 1000 mg');
});

test('savingsSummary: Gruppe mit nur einem Anbieter zählt nicht', () => {
  const { prices, pricesRepo } = setup(false);
  pricesRepo.upsert({ bezeichnung: 'Solo 10 mg', supplier: 'Großhandel B', aep: 5.0, prev_aep: 5.0 });
  const s = prices.savingsSummary();
  assert.equal(s.count, 0);
  assert.equal(s.total_abs, 0);
});

test('savingsSummary: gleiche Preise => keine Ersparnis', () => {
  const { prices, pricesRepo } = setup(false);
  pricesRepo.upsert({ bezeichnung: 'Gleich 5 mg', supplier: 'A', aep: 4.0 });
  pricesRepo.upsert({ bezeichnung: 'Gleich 5 mg', supplier: 'B', aep: 4.0 });
  const s = prices.savingsSummary();
  assert.equal(s.count, 0);
});
