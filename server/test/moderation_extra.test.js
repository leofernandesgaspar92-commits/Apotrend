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
  let modId = null;
  const social = createSocialService(socialRepo, repo, { isModerator: (uid) => uid === modId });
  const mk = (handle, email) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: handle }, owner: { name: handle, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: handle });
    return r.user.id;
  };
  const seller = mk('seller', 's@a.at');
  const user = mk('user', 'u@a.at');
  const mod = mk('mod', 'm@a.at');
  modId = mod;
  repo.grantEntitlement(seller, 'premium');
  return { repo, socialRepo, social, seller, user, mod };
}

test('Moderation: Werbung melden -> Queue zeigt sie -> Entfernen löscht Angebot + Interaktionen', () => {
  const { socialRepo, social, seller, user, mod } = setup();
  const p = social.createPromotion(seller, { titel: 'Fragwürdiges Angebot', kategorie: 'medikamente' });
  social.likePromotion(user, p.id);
  social.commentPromotion(user, p.id, { body: 'Anfrage' });
  // Melden
  const rep = social.report(user, 'promotion', p.id, 'Spam');
  assert.ok(rep.id);
  // Queue zeigt das Angebot mit Titel + Autor
  const q = social.moderationQueue(mod);
  const entry = q.find(x => x.id === rep.id);
  assert.ok(entry && entry.post);
  assert.match(entry.post.body, /Fragwürdiges Angebot/);
  assert.equal(entry.post.author_handle, 'seller');
  // Entfernen
  social.resolveReport(mod, rep.id, { remove: true });
  assert.throws(() => social.getPromotion(mod, p.id), /nicht gefunden/);
  assert.equal(socialRepo.listReactions('promotion', p.id).length, 0);
  assert.equal(socialRepo.countComments(p.id), 0);
});

test('Moderation: Live-Session melden + entfernen', () => {
  const { socialRepo, social, seller, user, mod } = setup();
  const s = social.createLiveSession(seller, { titel: 'Unerlaubte Session', geplant_am: '2026-09-01T18:00' });
  social.toggleLiveInterest(user, s.id);
  const rep = social.report(user, 'live', s.id, null);
  const q = social.moderationQueue(mod);
  const entry = q.find(x => x.id === rep.id);
  assert.match(entry.post.body, /Unerlaubte Session/);
  social.resolveReport(mod, rep.id, { remove: true });
  assert.equal(socialRepo.getLiveSession(s.id), null, 'Session entfernt');
  assert.equal(socialRepo.listReactions('live', s.id).length, 0);
});

test('Moderation: Werbung bleibt prüfbar, auch wenn der Autor sie nach der Meldung selbst löscht', () => {
  const { social, seller, user, mod } = setup();
  const p = social.createPromotion(seller, { titel: 'Heikles Angebot', kategorie: 'medikamente' });
  const rep = social.report(user, 'promotion', p.id, 'unangemessen');
  // Autor löscht das Angebot nach der Meldung (Umgehungsversuch)
  social.deletePromotion(seller, p.id);
  // Moderation sieht weiterhin den Original-Inhalt (nicht nur einen Platzhalter)
  const entry = social.moderationQueue(mod).find(x => x.id === rep.id);
  assert.ok(entry && entry.post);
  assert.match(entry.post.body, /Heikles Angebot/);
  assert.equal(entry.post.deleted, true);
});

test('Moderation: Melden nicht-existenter Ziele wird abgelehnt', () => {
  const { social, user } = setup();
  assert.throws(() => social.report(user, 'promotion', 'gibt-es-nicht', null), /nicht gefunden/);
  assert.throws(() => social.report(user, 'live', 'gibt-es-nicht', null), /nicht gefunden/);
  assert.throws(() => social.report(user, 'quatsch', 'x', null), /Zieltyp/);
});
