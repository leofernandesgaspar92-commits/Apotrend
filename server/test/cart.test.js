import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const srepo = createSocialRepo();
  const social = createSocialService(srepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { srepo, social, a: A.user.id, b: B.user.id };
}

test('Einkaufsliste: hinzufügen, Summe, Menge ändern, entfernen, leeren', () => {
  const { social, a } = setup();
  const it = social.addToCart(a, { bezeichnung: 'Amoxi 1000', wirkstoff: 'Amoxicillin', supplier: 'GH Nord', aktionspreis: 4.5, rabattPct: 20, gueltigBis: '2026-12-31', menge: 10, sourceKind: 'rabatt' });
  assert.equal(it.bezeichnung, 'Amoxi 1000');
  assert.equal(it.menge, 10);
  let c = social.cart(a);
  assert.equal(c.count, 1);
  assert.equal(c.total_positions, 10);
  assert.equal(c.total_price, 45); // 4.5 * 10
  // Menge ändern
  social.updateCartItem(a, it.id, { menge: 3 });
  c = social.cart(a);
  assert.equal(c.total_positions, 3);
  assert.equal(c.total_price, 13.5);
  // Ungültige Menge -> mind. 1
  social.updateCartItem(a, it.id, { menge: 0 });
  assert.equal(social.cart(a).items[0].menge, 1);
  // Entfernen
  social.removeCartItem(a, it.id);
  assert.equal(social.cart(a).count, 0);
});

test('Einkaufsliste: leere Bezeichnung abgelehnt, Standardmenge 1', () => {
  const { social, a } = setup();
  assert.throws(() => social.addToCart(a, { bezeichnung: '   ' }), /Bezeichnung/);
  const it = social.addToCart(a, { bezeichnung: 'Ibuprofen' });
  assert.equal(it.menge, 1);
  assert.equal(it.source_kind, 'manual');
});

test('Einkaufsliste: strikt pro Nutzer:in getrennt; fremde Position nicht änderbar/löschbar', () => {
  const { social, a, b } = setup();
  const it = social.addToCart(a, { bezeichnung: 'Metformin' });
  assert.equal(social.cart(b).count, 0); // Ben sieht Annas Liste nicht
  assert.throws(() => social.updateCartItem(b, it.id, { menge: 5 }));
  assert.throws(() => social.removeCartItem(b, it.id));
});

test('Einkaufsliste: leeren betrifft nur die eigene Liste; dump/load erhält Positionen', () => {
  const { srepo, social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'A1' });
  social.addToCart(a, { bezeichnung: 'A2' });
  social.addToCart(b, { bezeichnung: 'B1' });
  social.clearCart(a);
  assert.equal(social.cart(a).count, 0);
  assert.equal(social.cart(b).count, 1); // Bens Liste bleibt
  // dump/load
  const srepo2 = createSocialRepo(); srepo2.__load(srepo.__dump());
  const repo2Social = createSocialService(srepo2, createMemoryRepo());
  // Nutzer existiert in repo2Social nicht -> requireUser würde werfen; deshalb direkt Repo prüfen
  assert.equal(srepo2.listCartItems(b).length, 1);
});
