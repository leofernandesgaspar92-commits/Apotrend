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
  return { social, a: A.user.id, b: B.user.id, postId: post.id };
}

test('Kommentar bearbeiten: Autor ändert Text, edited_at gesetzt', () => {
  const { social, a, postId } = setup();
  const c = social.comment(a, postId, { body: 'Tippfehla' });
  const e = social.editComment(a, c.id, 'korrigiert');
  assert.equal(e.body, 'korrigiert');
  assert.ok(e.edited_at);
});

test('Kommentar bearbeiten/löschen: nur der Autor', () => {
  const { social, a, b, postId } = setup();
  const c = social.comment(a, postId, { body: 'Annas Kommentar' });
  assert.throws(() => social.editComment(b, c.id, 'fremd'), /Nur der Autor/);
  assert.throws(() => social.deleteComment(b, c.id), /Nur der Autor/);
});

test('Kommentar löschen: verschwindet aus der Liste', () => {
  const { social, a, postId } = setup();
  const c = social.comment(a, postId, { body: 'weg gleich' });
  assert.equal(social.listComments(a, postId).length, 1);
  social.deleteComment(a, c.id);
  assert.equal(social.listComments(a, postId).length, 0);
});

test('Gelöschter Kommentar nicht mehr editierbar', () => {
  const { social, a, postId } = setup();
  const c = social.comment(a, postId, { body: 'x' });
  social.deleteComment(a, c.id);
  assert.throws(() => social.editComment(a, c.id, 'zurück'), /nicht gefunden/);
});
