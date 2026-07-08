import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function mk(orgAuth, social, name, handle, email) {
  const u = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email, password: 'geheim123' } });
  social.createProfile(u.user.id, { handle, displayName: name });
  return u.user.id;
}

test('Folge-Vorschläge: keine eigenen, keine schon gefolgten, aktivste zuerst', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const a = mk(orgAuth, social, 'Anna', 'anna', 'a@a.at');
  const b = mk(orgAuth, social, 'Ben', 'ben', 'b@b.at');
  const c = mk(orgAuth, social, 'Cara', 'cara', 'c@c.at');
  // Ben hat 1 Follower (Cara), Cara 0 -> Ben zuerst
  social.follow(c, b);

  const sug = social.suggestFollows(a);
  const handles = sug.map(s => s.handle);
  assert.ok(!handles.includes('anna'), 'nicht man selbst');
  assert.deepEqual(handles, ['ben', 'cara']);

  // Nachdem Anna Ben folgt, ist Ben kein Vorschlag mehr
  social.follow(a, b);
  assert.deepEqual(social.suggestFollows(a).map(s => s.handle), ['cara']);
});
