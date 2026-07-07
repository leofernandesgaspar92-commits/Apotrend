import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'anna@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'ben@b.at', password: 'geheim123' } });
  const C = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'C' }, owner: { name: 'Cem', email: 'cem@c.at', password: 'geheim123' } });
  const a = A.user.id, b = B.user.id, c = C.user.id;
  // Cem ist Moderator
  const social = createSocialService(createSocialRepo(), repo, { isModerator: (uid) => uid === c });
  social.createProfile(a, { handle: 'anna', displayName: 'Anna' });
  social.createProfile(b, { handle: 'ben', displayName: 'Ben' });
  social.createProfile(c, { handle: 'cem', displayName: 'Cem' });
  return { social, a, b, c };
}

test('Benachrichtigungen: Follow, Kommentar, Reaktion, Mention — nie sich selbst', () => {
  const { social, a, b } = setup();
  social.follow(b, a);                                   // -> Anna: follow
  const post = social.createPost(a, { body: 'Hallo @ben und Team' }); // -> Ben: mention
  social.comment(b, post.id, { body: 'Antwort' });       // -> Anna: comment
  social.react(b, 'post', post.id, 'hilfreich');         // -> Anna: reaction
  social.comment(a, post.id, { body: 'eigener Kommentar' }); // KEINE Selbst-Notif

  const annaTypes = social.notifications(a).map(n => n.type).sort();
  assert.deepEqual(annaTypes, ['comment', 'follow', 'reaction']);
  const benTypes = social.notifications(b).map(n => n.type);
  assert.ok(benTypes.includes('mention'));
  assert.equal(social.unreadCount(a), 3);
});

test('Benachrichtigung als gelesen markieren (nur eigene)', () => {
  const { social, a, b } = setup();
  social.follow(b, a);
  const notif = social.notifications(a)[0];
  assert.throws(() => social.markNotificationRead(b, notif.id), ForbiddenError); // fremd
  social.markNotificationRead(a, notif.id);
  assert.equal(social.unreadCount(a), 0);
});

test('Direktnachrichten: nur die zwei Parteien, Dritte abgewiesen, DM benachrichtigt', () => {
  const { social, a, b, c } = setup();
  const th = social.startDm(a, b);
  social.sendDm(a, th.id, 'Hast du Amoxicillin zum Tausch?');
  social.sendDm(b, th.id, 'Ja, 10 Packungen.');
  assert.equal(social.listDm(b, th.id).length, 2);
  assert.ok(social.notifications(b).some(n => n.type === 'dm'));
  // Cem ist nicht Teil des Threads
  assert.throws(() => social.listDm(c, th.id), ForbiddenError);
  assert.throws(() => social.sendDm(c, th.id, 'spion'), ForbiddenError);
});

test('Moderation: jeder meldet, nur Moderator loest auf & entfernt', () => {
  const { social, a, b, c } = setup();
  const post = social.createPost(a, { body: 'Fragwuerdiger Beitrag' });
  const rep = social.report(b, 'post', post.id, 'Unangemessen');
  // Nicht-Moderator (Ben) darf Reports weder sehen noch aufloesen
  assert.throws(() => social.listReports(b), ForbiddenError);
  assert.throws(() => social.resolveReport(b, rep.id, { remove: true }), ForbiddenError);
  // Moderator (Cem) loest auf und entfernt den Beitrag
  assert.equal(social.listReports(c, 'offen').length, 1);
  social.resolveReport(c, rep.id, { remove: true });
  assert.equal(social.getPost(a, post.id), null);           // entfernt
  assert.equal(social.listReports(c, 'entfernt').length, 1);
});

test('DSGVO-Hard-Delete: Autor oder Moderator', () => {
  const { social, a, b, c } = setup();
  const post = social.createPost(a, { body: 'Weg damit' });
  assert.throws(() => social.hardDeletePost(b, post.id), ForbiddenError); // Fremder
  social.hardDeletePost(c, post.id);                                       // Moderator ok
  assert.equal(social.getPost(a, post.id), null);
});
