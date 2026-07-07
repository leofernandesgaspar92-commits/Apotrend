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

test('Beitrag bearbeiten: Autor ändert Text, edited_at wird gesetzt', () => {
  const { social, a } = setup();
  const post = social.createPost(a, { body: 'Tippfehla' });
  assert.equal(post.edited_at, null);
  const edited = social.editPost(a, post.id, 'Tippfehler korrigiert');
  assert.equal(edited.body, 'Tippfehler korrigiert');
  assert.ok(edited.edited_at, 'edited_at gesetzt');
});

test('Beitrag bearbeiten: nur der Autor darf', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Annas Beitrag' });
  assert.throws(() => social.editPost(b, post.id, 'Ben pfuscht rein'), /Nur der Autor/);
});

test('Beitrag bearbeiten: leerer Text wird abgelehnt', () => {
  const { social, a } = setup();
  const post = social.createPost(a, { body: 'etwas' });
  assert.throws(() => social.editPost(a, post.id, '   '), /leer/);
});

test('Beitrag bearbeiten: gelöschter Beitrag nicht editierbar', () => {
  const { social, a } = setup();
  const post = social.createPost(a, { body: 'weg gleich' });
  social.deletePost(a, post.id);
  assert.throws(() => social.editPost(a, post.id, 'zurück'), /nicht gefunden/);
});
