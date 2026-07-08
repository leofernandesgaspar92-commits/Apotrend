import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo, {
    isModerator: (uid) => { const p = socialRepo.getProfileByUserId(uid); return !!(p && p.is_editorial); },
  });
  const M = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Red' }, owner: { name: 'Mod', email: 'm@m.at', password: 'geheim123' } });
  social.createProfile(M.user.id, { handle: 'mod', displayName: 'Mod', isEditorial: true });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { social, mod: M.user.id, a: A.user.id, b: B.user.id };
}

test('Kommentar melden -> in Queue mit Kommentartext; Entfernen löscht Kommentar', () => {
  const { social, mod, a, b } = setup();
  const post = social.createPost(a, { body: 'Beitrag' });
  const c = social.comment(b, post.id, { body: 'unangemessener Kommentar' });
  social.report(a, 'comment', c.id, 'Beleidigung');

  const q = social.moderationQueue(mod);
  const item = q.find(x => x.target_type === 'comment');
  assert.ok(item);
  assert.equal(item.post.is_comment, true);
  assert.match(item.post.body, /unangemessener/);

  social.resolveReport(mod, item.id, { remove: true });
  // Kommentar ist jetzt gelöscht -> nicht mehr in der Liste
  assert.equal(social.listComments(a, post.id).length, 0);
});
