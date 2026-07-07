import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createSearchService } from '../src/services/search.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const search = createSearchService({
    social,
    shortagesRepo: createShortagesRepo(),
    pricesRepo: createPricesRepo(),
    rabatteRepo: createRabatteRepo({ today: '2026-07-07' }),
  });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna Huber', specializations: ['Onkologie'] });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben Mayer' });
  return { social, search, a: A.user.id, b: B.user.id };
}

test('Suche bündelt Treffer aus allen Modulen (Amoxicillin)', () => {
  const { social, search, a } = setup();
  social.createPost(a, { body: 'Engpass bei Amoxicillin in Wien' });
  const r = search.search(a, 'Amoxicillin');
  assert.ok(r.posts.length >= 1, 'Beitrag gefunden');
  assert.ok(r.shortages.some(s => s.wirkstoff === 'Amoxicillin'), 'Engpass gefunden');
  assert.ok(r.prices.some(p => p.bezeichnung.startsWith('Amoxicillin')), 'Preis gefunden');
  assert.ok(r.total >= 3);
});

test('Personen-Suche findet über Handle, Name und Fachgebiet', () => {
  const { search, a } = setup();
  assert.ok(search.search(a, 'huber').people.some(p => p.handle === 'anna'));   // Name
  assert.ok(search.search(a, 'onkolog').people.some(p => p.handle === 'anna')); // Fachgebiet
  assert.ok(search.search(a, 'ben').people.some(p => p.handle === 'ben'));      // Handle/Name
});

test('Suche respektiert Beitrags-Sichtbarkeit', () => {
  const { social, search, a, b } = setup();
  social.createPost(a, { body: 'geheime Sache nur für Follower', visibility: 'followers' });
  // Ben folgt Anna nicht -> findet den followers-only-Beitrag nicht
  assert.equal(search.search(b, 'geheime').posts.length, 0);
  // Anna selbst findet ihn
  assert.equal(search.search(a, 'geheime').posts.length, 1);
});

test('Leere Suche liefert leeres Ergebnis', () => {
  const { search, a } = setup();
  const r = search.search(a, '   ');
  assert.equal(r.total, 0);
  assert.deepEqual(r.people, []);
});

test('Rabatt-Treffer nach Rabatt-Höhe sortiert', () => {
  const { search, a } = setup();
  const r = search.search(a, 'Kwizda');
  assert.ok(r.rabatte.length >= 1);
  for (let i = 1; i < r.rabatte.length; i++) assert.ok(r.rabatte[i-1].rabatt_pct >= r.rabatte[i].rabatt_pct);
});
