import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createRabatteService } from '../src/services/rabatte.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  // festes Vergleichsdatum -> deterministisch (abgelaufene Aktion = 2026-06-01)
  const rabatte = createRabatteService(createRabatteRepo({ today: '2026-07-07' }), social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { rabatte, a: A.user.id };
}

test('Top-10: höchster Rabatt zuerst, max. 10, mit Rang + Rabatt-% + Ersparnis', () => {
  const { rabatte, a } = setup();
  const top = rabatte.top10(a);
  assert.ok(top.length <= 10);
  // absteigend nach rabatt_pct
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].rabatt_pct >= top[i].rabatt_pct);
  // Rang beginnt bei 1
  assert.equal(top[0].rank, 1);
  // Ibuprofen 2.35 -> 1.65 = 29.8 % soll ganz oben stehen
  assert.equal(top[0].bezeichnung, 'Ibuprofen 400 mg');
  assert.equal(top[0].rabatt_pct, 29.8);
  assert.equal(top[0].ersparnis, 0.7);
});

test('Abgelaufene Aktionen erscheinen nicht im Top-10', () => {
  const { rabatte, a } = setup();
  const top = rabatte.top10(a);
  assert.ok(!top.some(r => r.bezeichnung === 'Diclofenac 50 mg'), 'abgelaufene Aktion ausgeblendet');
});

test('Aus Rabatt heraus posten -> Beitrag referenziert die Aktion + Aktivität', () => {
  const { rabatte, a } = setup();
  const offer = rabatte.top10(a)[0];
  const post = rabatte.postAbout(a, offer.id, { body: 'Lohnt sich der Aktionspreis bei ' + offer.supplier + '?' });
  assert.equal(post.ref_type, 'rabatt');
  assert.equal(post.ref_id, offer.id);

  const act = rabatte.withActivity(a, offer.id);
  assert.equal(act.post_count, 1);
  // Zähler taucht im Ranking auf
  const again = rabatte.top10(a).find(r => r.id === offer.id);
  assert.equal(again.post_count, 1);
});

test('Posten zu unbekannter Aktion wird abgelehnt', () => {
  const { rabatte, a } = setup();
  assert.throws(() => rabatte.postAbout(a, 'nope', { body: 'x' }), /nicht gefunden/);
});
