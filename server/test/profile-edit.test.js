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
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { social, a: A.user.id };
}

test('Profil bearbeiten: Anzeigename, Titel, Bio, Fachgebiete werden übernommen', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { displayName: 'Dr. Anna Huber', title: 'Fachapothekerin', bio: 'Onkologie-Schwerpunkt in Wien.', specializations: 'Onkologie, Diabetes , ,Impfen' });
  assert.equal(p.display_name, 'Dr. Anna Huber');
  assert.equal(p.title, 'Fachapothekerin');
  assert.equal(p.bio, 'Onkologie-Schwerpunkt in Wien.');
  assert.deepEqual(p.specializations, ['Onkologie', 'Diabetes', 'Impfen']); // leere getrimmt
  // Handle bleibt unverändert
  assert.equal(p.handle, 'anna');
});

test('Profil bearbeiten: leerer Anzeigename wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.updateProfile(a, { displayName: '   ' }), /Anzeigename/);
});

test('Profil bearbeiten: zu lange Bio wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.updateProfile(a, { bio: 'x'.repeat(501) }), /zu lang/);
});

test('Profil bearbeiten: leere Felder löschen Titel/Bio (null)', () => {
  const { social, a } = setup();
  social.updateProfile(a, { title: 'X', bio: 'Y' });
  const p = social.updateProfile(a, { title: '', bio: '' });
  assert.equal(p.title, null);
  assert.equal(p.bio, null);
});

test('Profil bearbeiten: gültiges Bundesland wird gesetzt, ungültiges abgelehnt', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { bundesland: 'Wien' });
  assert.equal(p.bundesland, 'Wien');
  assert.throws(() => social.updateProfile(a, { bundesland: 'Bayern' }), /Bundesland/);
  const cleared = social.updateProfile(a, { bundesland: '' });
  assert.equal(cleared.bundesland, null);
});
