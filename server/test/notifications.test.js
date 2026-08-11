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
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna Huber' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben Mayer' });
  return { social, a: A.user.id, b: B.user.id };
}

test('Benachrichtigung enthält Akteur (Name/Handle)', () => {
  const { social, a, b } = setup();
  social.follow(b, a); // Ben folgt Anna -> Anna bekommt Follow-Benachrichtigung
  const n = social.notifications(a).find(x => x.type === 'follow');
  assert.ok(n);
  assert.equal(n.actor.handle, 'ben');
  assert.equal(n.actor.display_name, 'Ben Mayer');
});

test('Kommentar-Benachrichtigung liefert post_id als Sprungziel', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Annas Beitrag' });
  social.comment(b, post.id, { body: 'Bens Kommentar' }); // benachrichtigt Anna (Beitrags-Autor)
  const n = social.notifications(a).find(x => x.type === 'comment');
  assert.ok(n);
  assert.equal(n.post_id, post.id);
});

test('Antwort auf Kommentar: post_id wird aus dem Kommentar aufgelöst', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Beitrag' });
  const c = social.comment(a, post.id, { body: 'Annas Kommentar' });
  social.comment(b, post.id, { body: 'Bens Antwort', parentCommentId: c.id }); // benachrichtigt Anna (Eltern-Autor, ref=comment)
  const n = social.notifications(a).find(x => x.ref_type === 'comment');
  assert.ok(n, 'Kommentar-Referenz vorhanden');
  assert.equal(n.post_id, post.id, 'post_id aus Kommentar aufgelöst');
});

test('Gelesene aufräumen: entfernt nur gelesene, behält ungelesene; strikt pro Nutzer:in', () => {
  const { social, a, b } = setup();
  // Zwei Benachrichtigungen für Anna erzeugen (Follow + Kommentar auf ihren Beitrag).
  social.follow(b, a);
  const post = social.createPost(a, { body: 'Beitrag' });
  social.comment(b, post.id, { body: 'Bens Kommentar' });
  let list = social.notifications(a);
  assert.ok(list.length >= 2);
  // Eine als gelesen markieren, dann aufräumen -> nur die gelesene verschwindet.
  const first = list[0];
  social.markNotificationRead(a, first.id);
  const res = social.clearReadNotifications(a);
  assert.equal(res.removed, 1);
  const after = social.notifications(a);
  assert.equal(after.length, list.length - 1);
  assert.ok(!after.some(n => n.id === first.id), 'gelesene entfernt');
  assert.ok(after.every(n => !n.read), 'nur ungelesene bleiben');
  // Bens Liste bleibt unangetastet (strikte Trennung).
  const bBefore = social.notifications(b).length;
  social.clearReadNotifications(a);
  assert.equal(social.notifications(b).length, bBefore);
});
