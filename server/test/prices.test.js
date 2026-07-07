import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createPricesService } from '../src/services/prices.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const prices = createPricesService(createPricesRepo(), social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { prices, a: A.user.id };
}

test('Preisvergleich: nach Präparat gruppiert, günstigster Lieferant zuerst, Trend + Herkunft', () => {
  const { prices, a } = setup();
  const cmp = prices.comparisons(a);
  const amox = cmp.find(g => g.bezeichnung.startsWith('Amoxicillin'));
  assert.ok(amox.offers.length >= 2);
  // guenstigster zuerst
  assert.ok(amox.offers[0].aep <= amox.offers[1].aep);
  assert.equal(amox.offers[0].provenance, 'reference');
  // Trend: Herba 3.98 (prev 3.72) -> positiv; Kwizda 3.01 (prev 3.05) -> negativ
  const herba = amox.offers.find(o => o.supplier === 'Herba Chemosan');
  const kwizda = amox.offers.find(o => o.supplier === 'Kwizda');
  assert.ok(herba.trend_pct > 0);
  assert.ok(kwizda.trend_pct < 0);
});

test('Aus Preis heraus posten -> Beitrag referenziert das Angebot + Aktivität', () => {
  const { prices, a } = setup();
  const offer = prices.comparisons(a)[0].offers[0];
  const post = prices.postAbout(a, offer.id, { body: 'Preis bei ' + offer.supplier + ' gerade gestiegen.' });
  assert.equal(post.ref_type, 'price');
  assert.equal(post.ref_id, offer.id);

  const act = prices.withActivity(a, offer.id);
  assert.equal(act.post_count, 1);
  // Zähler taucht im Vergleich auf
  const again = prices.comparisons(a).flatMap(g => g.offers).find(o => o.id === offer.id);
  assert.equal(again.post_count, 1);
});

test('Posten zu unbekanntem Preis wird abgelehnt', () => {
  const { prices, a } = setup();
  assert.throws(() => prices.postAbout(a, 'nope', { body: 'x' }), /nicht gefunden/);
});
