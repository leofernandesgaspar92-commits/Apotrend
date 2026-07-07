import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna Huber', specializations: ['Onkologie'] });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben Mayer' });
  return { social, a: A.user.id, b: B.user.id };
}

test('Profilseite: Profil + Beiträge + Zähler + Beziehung zum Betrachter', () => {
  const { social, a, b } = setup();
  social.createPost(a, { body: 'Anna Beitrag 1' });
  social.createPost(a, { body: 'Anna Beitrag 2' });
  social.follow(b, a); // Ben folgt Anna

  const page = social.profilePage(b, 'anna');
  assert.equal(page.profile.handle, 'anna');
  assert.equal(page.profile.display_name, 'Anna Huber');
  assert.equal(page.post_count, 2);
  assert.equal(page.follower_count, 1);   // Ben
  assert.equal(page.is_following, true);  // Ben folgt Anna
  assert.equal(page.is_self, false);
});

test('Profilseite zeigt eigenes Profil mit is_self=true', () => {
  const { social, a } = setup();
  social.createPost(a, { body: 'mein Beitrag' });
  const page = social.profilePage(a, 'anna');
  assert.equal(page.is_self, true);
  assert.equal(page.is_following, false);
});

test('Profilseite respektiert Sichtbarkeit: followers-only nicht für Fremde', () => {
  const { social, a, b } = setup();
  social.createPost(a, { body: 'öffentlich' });
  social.createPost(a, { body: 'nur Follower', visibility: 'followers' });
  // Ben folgt Anna NICHT -> sieht nur den öffentlichen
  const asStranger = social.profilePage(b, 'anna');
  assert.equal(asStranger.post_count, 1);
  // Anna selbst sieht beide
  const asSelf = social.profilePage(a, 'anna');
  assert.equal(asSelf.post_count, 2);
});

test('Profilseite für unbekanntes Handle -> null', () => {
  const { social, a } = setup();
  assert.equal(social.profilePage(a, 'gibtsnicht'), null);
});
