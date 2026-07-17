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
  const post = social.createPost(A.user.id, { body: 'Beitrag' });
  const c = social.comment(A.user.id, post.id, { body: 'Kommentar' });
  return { social, a: A.user.id, b: B.user.id, postId: post.id, commentId: c.id };
}

test('Reaktion auf Kommentar: Zähler erscheint in listComments', () => {
  const { social, b, postId, commentId } = setup();
  social.react(b, 'comment', commentId, 'hilfreich');
  const c = social.listComments(b, postId).find(x => x.id === commentId);
  assert.equal(c.reaction_counts.hilfreich, 1);
});

test('Reaktion auf Kommentar: umschaltbar (eine je Nutzer+Ziel)', () => {
  const { social, b, postId, commentId } = setup();
  social.react(b, 'comment', commentId, 'hilfreich');
  social.react(b, 'comment', commentId, 'danke'); // ersetzt hilfreich
  const c = social.listComments(b, postId).find(x => x.id === commentId);
  assert.equal(c.reaction_counts.hilfreich, 0);
  assert.equal(c.reaction_counts.danke, 1);
});

test('listComments: Autor:innen-Payload trägt Kontotyp/verified/is_editorial (für Badges)', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const P = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'P' }, owner: { name: 'Pharma', email: 'p@p.at', password: 'geheim123' } });
  social.createProfile(P.user.id, { handle: 'pharma_ag', displayName: 'Muster Pharma AG', accountType: 'pharma' });
  const post = social.createPost(P.user.id, { body: 'Beitrag' });
  const c = social.comment(P.user.id, post.id, { body: 'Antwort vom Pharma-Konto' });
  const listed = social.listComments(P.user.id, post.id).find(x => x.id === c.id);
  assert.equal(listed.author.account_type, 'pharma', 'Kontotyp im Kommentar-Autor');
  assert.equal(listed.author.verified, false);
  assert.equal(listed.author.is_editorial, false);
});
