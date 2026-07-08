import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const post = social.createPost(A.user.id, { body: 'Beitrag' });
  return { social, a: A.user.id, postId: post.id };
}

test('Kommentar mit Bild wird gespeichert + in listComments sichtbar', () => {
  const { social, a, postId } = setup();
  social.comment(a, postId, { body: 'siehe Foto', image: PNG });
  const c = social.listComments(a, postId)[0];
  assert.equal(c.image, PNG);
});

test('Bild-only-Kommentar erlaubt, Fremdformat abgelehnt', () => {
  const { social, a, postId } = setup();
  const c = social.comment(a, postId, { body: '', image: PNG });
  assert.equal(c.image, PNG);
  assert.throws(() => social.comment(a, postId, { body: 'x', image: 'https://evil/x.png' }), /Bildformat/);
  assert.throws(() => social.comment(a, postId, { body: '' }), /leer/);
});
