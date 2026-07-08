import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';

function setup() {
  const repo = createMemoryRepo();
  const socialRepo = createSocialRepo();
  const exchangeRepo = createExchangeRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(socialRepo, repo);
  const exchange = createExchangeService(exchangeRepo, social, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { repo, socialRepo, exchangeRepo, orgAuth, social, exchange, a: A.user.id, b: B.user.id };
}

test('Konto löschen entfernt alle Daten + Login danach unmöglich', () => {
  const { repo, socialRepo, exchangeRepo, orgAuth, social, exchange, a, b } = setup();
  social.createPost(a, { body: 'Annas Beitrag' });
  const bp = social.createPost(b, { body: 'Bens Beitrag' });
  social.comment(a, bp.id, { body: 'Annas Kommentar' });
  social.follow(a, b);
  exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin' });

  // Passwortprüfung
  assert.equal(orgAuth.verifyUserPassword(a, 'falsch'), false);
  assert.equal(orgAuth.verifyUserPassword(a, 'geheim123'), true);

  // Löschen
  socialRepo.purgeUser(a); exchangeRepo.purgeUser(a); repo.deleteUser(a);

  assert.equal(social.getProfile('anna'), null);
  assert.equal(repo.getUserByEmail('a@a.at'), null);
  assert.equal(orgAuth.login({ email: 'a@a.at', password: 'geheim123' }).ok, false);
  assert.equal(social.publicFeed(b).some(p => p.author?.handle === 'anna'), false);
  assert.equal(exchange.list(b).length, 0);
  // Bens Daten bleiben
  assert.ok(social.getProfile('ben'));
});
