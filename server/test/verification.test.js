import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  // Moderator = wer is_editorial im Profil hat
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo, {
    isModerator: (uid) => { const p = socialRepo.getProfileByUserId(uid); return !!(p && p.is_editorial); },
  });
  const M = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Red' }, owner: { name: 'Mod', email: 'm@m.at', password: 'geheim123' } });
  social.createProfile(M.user.id, { handle: 'mod', displayName: 'Moderation', isEditorial: true });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { social, mod: M.user.id, a: A.user.id };
}

test('Verifizierung beantragen -> in Moderations-Queue', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, { note: 'Konzession 12345, Apotheke Zum Hirschen, Wien' });
  const q = social.verificationQueue(mod);
  assert.equal(q.length, 1);
  assert.equal(q[0].handle, 'anna');
  assert.match(q[0].note, /Konzession 12345/);
  assert.equal(social.myVerification(a).status, 'offen');
});

test('Genehmigen setzt verified + benachrichtigt', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, {});
  social.resolveVerification(mod, a, true);
  assert.equal(social.getProfile('anna').verified, true);
  assert.equal(social.myVerification(a).status, 'verifiziert');
  assert.equal(social.verificationQueue(mod).length, 0);
  assert.ok(social.notifications(a).some(n => n.type === 'verified'));
});

test('Ablehnen setzt nicht verified', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, {});
  social.resolveVerification(mod, a, false);
  assert.equal(social.getProfile('anna').verified, false);
  assert.equal(social.myVerification(a).status, 'abgelehnt');
});

test('Nicht-Moderator darf Queue nicht sehen; bereits verifizierte nicht erneut beantragen', () => {
  const { social, mod, a } = setup();
  assert.throws(() => social.verificationQueue(a), /Nur Moderation/);
  social.requestVerification(a, {});
  social.resolveVerification(mod, a, true);
  assert.throws(() => social.requestVerification(a, {}), /bereits verifiziert/);
});
