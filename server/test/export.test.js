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

test('Datenexport enthält eigene Inhalte', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Mein Beitrag' });
  social.comment(a, post.id, { body: 'Mein Kommentar' });
  const bp = social.createPost(b, { body: 'Bens Beitrag' });
  social.toggleBookmark(a, bp.id);
  const t = social.startDm(a, b); social.sendDm(a, t.id, 'Hallo');

  const ex = social.exportData(a);
  assert.equal(ex.profile.handle, 'anna');
  assert.equal(ex.posts.length, 1);
  assert.equal(ex.comments.length, 1);
  assert.deepEqual(ex.bookmarks_post_ids, [bp.id]);
  assert.equal(ex.direct_messages.length, 1);
  assert.equal(ex.direct_messages[0].with, 'ben');
  assert.ok(ex.exported_at);
});
