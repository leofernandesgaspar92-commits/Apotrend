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

test('DM: Thread starten, senden, Posteingang zeigt letzte Nachricht + ungelesen', () => {
  const { social, a, b } = setup();
  const t = social.startDm(a, b);
  social.sendDm(a, t.id, 'Hallo Ben, hast du Amoxicillin?');

  // Bens Posteingang: eine Konversation mit Anna, 1 ungelesen
  const inbox = social.dmInbox(b);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].other.handle, 'anna');
  assert.equal(inbox[0].last_message.body, 'Hallo Ben, hast du Amoxicillin?');
  assert.equal(inbox[0].unread, 1);
  assert.equal(social.dmUnreadTotal(b), 1);
});

test('DM: Konversation öffnen markiert als gelesen', () => {
  const { social, a, b } = setup();
  const t = social.startDm(a, b);
  social.sendDm(a, t.id, 'Nachricht 1');
  assert.equal(social.dmUnreadTotal(b), 1);

  const conv = social.dmConversation(b, t.id);
  assert.equal(conv.other.handle, 'anna');
  assert.equal(conv.messages.length, 1);
  // nach dem Öffnen: nichts mehr ungelesen für Ben
  assert.equal(social.dmUnreadTotal(b), 0);
});

test('DM: Fremde können eine Konversation nicht lesen', () => {
  const { social, a, b } = setup();
  const repo = createMemoryRepo();
  const t = social.startDm(a, b);
  social.sendDm(a, t.id, 'privat');
  // ein Dritter
  const orgAuth = createOrgAuthService(repo);
  // Nutze einen fremden, aber im selben social-Service registrierten Dritten:
  assert.throws(() => social.dmConversation('fremde-id', t.id), /Nicht Teil|nicht gefunden|Unbekannt/);
});

test('DM: eigener Posteingang zeigt keine leeren Threads', () => {
  const { social, a, b } = setup();
  social.startDm(a, b); // Thread ohne Nachricht
  assert.equal(social.dmInbox(a).length, 0);
});

test('DM: archivieren blendet Konversation nur für die archivierende Person aus; neue Nachricht holt sie zurück', () => {
  const { social, a, b } = setup();
  const t = social.startDm(a, b);
  social.sendDm(a, t.id, 'Hallo Ben');
  // Ben archiviert die Konversation -> verschwindet aus SEINEM Posteingang + Badge auf 0
  social.setDmConversationHidden(b, t.id, true);
  assert.equal(social.dmInbox(b).length, 0);
  assert.equal(social.dmUnreadTotal(b), 0);
  // ...taucht aber im Archiv auf (wiederherstellbar, keine Sackgasse)
  assert.equal(social.dmArchived(b).length, 1);
  assert.equal(social.dmArchived(b)[0].thread_id, t.id);
  // Bei Anna ist nichts archiviert
  assert.equal(social.dmArchived(a).length, 0);
  // Bei Anna ist die Konversation weiterhin sichtbar (nur Bens Sicht betroffen)
  assert.equal(social.dmInbox(a).length, 1);
  // Öffnen/Lesen bleibt möglich (kein Datenverlust)
  assert.equal(social.dmConversation(b, t.id).messages.length, 1);
  // Neue Nachricht von Anna holt die Konversation in Bens Posteingang zurück
  social.sendDm(a, t.id, 'Noch da?');
  assert.equal(social.dmInbox(b).length, 1);
  assert.equal(social.dmUnreadTotal(b), 1);
  // Wieder-Einblenden (hidden=false) funktioniert ebenfalls
  social.setDmConversationHidden(b, t.id, true);
  assert.equal(social.dmInbox(b).length, 0);
  social.setDmConversationHidden(b, t.id, false);
  assert.equal(social.dmInbox(b).length, 1);
  // Nicht-Teilnehmer:in darf nicht archivieren
  assert.throws(() => social.setDmConversationHidden('fremde-id', t.id, true), /Nicht Teil|nicht gefunden/);
});

test('DM: archivierter Thread übersteht dump/load (hidden_by persistiert)', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  const a = A.user.id, b = B.user.id;
  const t = social.startDm(a, b);
  social.sendDm(a, t.id, 'Hallo');
  social.setDmConversationHidden(b, t.id, true);
  // dump/load auf Repo-Ebene (analog Shortage-/Persistenz-Tests)
  const fresh = createSocialRepo();
  fresh.__load(socialRepo.__dump());
  const freshSocial = createSocialService(fresh, repo);
  assert.equal(freshSocial.dmInbox(b).length, 0, 'archiviert bleibt archiviert nach load');
  assert.equal(freshSocial.dmInbox(a).length, 1);
});
