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
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { social, a: A.user.id, b: B.user.id };
}

test('Merken umschaltbar; Merkliste enthält gemerkte Beiträge', () => {
  const { social, a, b } = setup();
  const p = social.createPost(b, { body: 'Wichtiger Engpass-Hinweis' });
  assert.equal(social.toggleBookmark(a, p.id).bookmarked, true);
  assert.deepEqual(social.bookmarkIds(a), [p.id]);
  assert.equal(social.listBookmarks(a).length, 1);
  // nochmal -> entfernt
  assert.equal(social.toggleBookmark(a, p.id).bookmarked, false);
  assert.equal(social.listBookmarks(a).length, 0);
});

test('Merken respektiert Sichtbarkeit', () => {
  const { social, a, b } = setup();
  const p = social.createPost(b, { body: 'nur Follower', visibility: 'followers' });
  assert.throws(() => social.toggleBookmark(a, p.id), /nicht sichtbar/);
});

test('Gelöschter Beitrag verschwindet aus der Merkliste', () => {
  const { social, a, b } = setup();
  const p = social.createPost(b, { body: 'temporär' });
  social.toggleBookmark(a, p.id);
  social.deletePost(b, p.id);
  assert.equal(social.listBookmarks(a).length, 0);
});
