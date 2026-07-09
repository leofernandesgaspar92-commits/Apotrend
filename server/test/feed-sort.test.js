import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

test('publicFeed sort=top: meiste Reaktionen zuerst', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });

  const p1 = social.createPost(A.user.id, { body: 'wenig' });
  const p2 = social.createPost(A.user.id, { body: 'viel' });
  social.react(A.user.id, 'post', p2.id, 'hilfreich');
  social.react(B.user.id, 'post', p2.id, 'danke');

  const top = social.publicFeed(B.user.id, { sort: 'top' });
  assert.equal(top[0].id, p2.id, 'meist-reagierter zuerst');
  // p1 hat keine Reaktionen und landet hinter p2
  assert.equal(top[top.length - 1].id, p1.id, 'reaktionsloser zuletzt');

  // neu-Sortierung liefert beide Posts (Reihenfolge bei gleichem Zeitstempel egal)
  const neu = social.publicFeed(B.user.id, { sort: 'neu' });
  assert.deepEqual(new Set(neu.map(p => p.id)), new Set([p1.id, p2.id]));
});

test('publicFeed filter=questions: nur Fragen, offene zuerst', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });

  social.createPost(A.user.id, { body: 'normaler Beitrag' });               // keine Frage
  const qOffen = social.createPost(A.user.id, { body: 'offene Frage?', kind: 'frage' });
  const qBeantwortet = social.createPost(A.user.id, { body: 'beantwortete Frage?', kind: 'frage' });
  const c = social.comment(B.user.id, qBeantwortet.id, { body: 'Antwort' });
  social.acceptAnswer(A.user.id, qBeantwortet.id, c.id);

  const qs = social.publicFeed(B.user.id, { filter: 'questions' });
  assert.equal(qs.length, 2, 'nur Fragen');
  assert.ok(qs.every(p => p.is_question));
  assert.equal(qs[0].id, qOffen.id, 'offene Frage zuerst');
  assert.equal(qs[1].id, qBeantwortet.id, 'beantwortete danach');
});
