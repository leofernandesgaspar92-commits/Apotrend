import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const mk = (handle, name, email) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    return r.user.id;
  };
  const seller = mk('shop', 'Shop Premium', 's@a.at');   // wird Premium (Werbetreibender)
  const buyer = mk('kunde', 'Kunde', 'k@a.at');          // registriert, kostenlos
  return { repo, social, seller, buyer };
}

test('Werbung: nur Premium-Mitglieder dürfen inserieren', () => {
  const { repo, social, seller } = setup();
  assert.throws(() => social.createPromotion(seller, { titel: 'Ibuprofen 400', kategorie: 'medikamente' }), /Premium/);
  repo.grantEntitlement(seller, 'premium');
  const p = social.createPromotion(seller, { titel: 'Ibuprofen 400', beschreibung: '100 Stk auf Lager', kategorie: 'medikamente', preis: 4.99, einheit: '€/Packung' });
  assert.equal(p.titel, 'Ibuprofen 400');
  assert.equal(p.kategorie, 'medikamente');
  assert.equal(p.preis, 4.99);
  assert.equal(p.like_count, 0);
  assert.equal(p.is_mine, true);
});

test('Werbung: Validierung (Titel, Preis, Kategorie-Fallback)', () => {
  const { repo, social, seller } = setup();
  repo.grantEntitlement(seller, 'premium');
  assert.throws(() => social.createPromotion(seller, { titel: 'ab', kategorie: 'medikamente' }), /Titel/);
  assert.throws(() => social.createPromotion(seller, { titel: 'Gültig', preis: -5 }), /Preis/);
  const p = social.createPromotion(seller, { titel: 'Ohne Kategorie' });
  assert.equal(p.kategorie, 'sonstiges', 'unbekannte/fehlende Kategorie -> sonstiges');
  assert.equal(p.preis, null);
});

test('Werbung: alle registrierten Nutzer sehen die Liste + Kategoriefilter', () => {
  const { repo, social, seller, buyer } = setup();
  repo.grantEntitlement(seller, 'premium');
  social.createPromotion(seller, { titel: 'Vitamin C', kategorie: 'nahrungsergaenzung' });
  social.createPromotion(seller, { titel: 'Blutdruckmessgerät', kategorie: 'medizinprodukte' });
  assert.equal(social.listPromotions(buyer).length, 2);
  assert.equal(social.listPromotions(buyer, { kategorie: 'medizinprodukte' }).length, 1);
  assert.equal(social.listPromotions(buyer, { kategorie: 'medizinprodukte' })[0].titel, 'Blutdruckmessgerät');
});

test('Werbung: Gefällt-mir umschalten + Kommentar benachrichtigt Autor', () => {
  const { repo, social, seller, buyer } = setup();
  repo.grantEntitlement(seller, 'premium');
  const p = social.createPromotion(seller, { titel: 'Handcreme', kategorie: 'kosmetik' });
  const l1 = social.likePromotion(buyer, p.id);
  assert.equal(l1.liked, true);
  assert.equal(l1.like_count, 1);
  const l2 = social.likePromotion(buyer, p.id);
  assert.equal(l2.liked, false);
  assert.equal(l2.like_count, 0);
  const c = social.commentPromotion(buyer, p.id, { body: 'Ist das noch verfügbar?' });
  assert.equal(c.author.handle, 'kunde');
  assert.ok(social.notifications(seller).some(n => n.type === 'promo_comment'));
  const detail = social.getPromotion(seller, p.id);
  assert.equal(detail.comment_count, 1);
  assert.equal(detail.comments.length, 1);
});

test('Werbung: nur Autor darf bearbeiten/löschen', () => {
  const { repo, social, seller, buyer } = setup();
  repo.grantEntitlement(seller, 'premium');
  const p = social.createPromotion(seller, { titel: 'Original', kategorie: 'medikamente' });
  assert.throws(() => social.updatePromotion(buyer, p.id, { titel: 'Gekapert' }), ForbiddenError);
  assert.throws(() => social.deletePromotion(buyer, p.id), ForbiddenError);
  const upd = social.updatePromotion(seller, p.id, { titel: 'Aktualisiert', preis: 9.5 });
  assert.equal(upd.titel, 'Aktualisiert');
  assert.equal(upd.preis, 9.5);
  social.deletePromotion(seller, p.id);
  assert.equal(social.listPromotions(buyer).length, 0);
  assert.throws(() => social.getPromotion(seller, p.id), /nicht gefunden/);
});
