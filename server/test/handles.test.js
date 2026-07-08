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

test('Handle-Vorschläge: Präfix zuerst, dann Teiltreffer; leer bei leerem q', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  mk(orgAuth, social, 'Anna', 'anna', 'a@a.at');
  mk(orgAuth, social, 'Anton', 'anton', 'b@b.at');
  mk(orgAuth, social, 'Bea', 'bea_anna', 'c@c.at'); // enthält 'anna', aber kein Präfix

  const r = social.searchHandles('an');
  const handles = r.map(x => x.handle);
  assert.ok(handles.includes('anna') && handles.includes('anton'), 'Präfixtreffer');
  // Präfixtreffer stehen vor reinen Teiltreffern
  assert.ok(handles.indexOf('anna') < handles.indexOf('bea_anna'));
  assert.equal(social.searchHandles('').length, 0);
});
