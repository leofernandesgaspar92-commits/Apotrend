import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'altesGeheim1' } });
  return { orgAuth, userId: A.user.id };
}

test('Passwort ändern: mit korrektem alten Passwort, danach neuer Login', () => {
  const { orgAuth, userId } = setup();
  orgAuth.changePassword(userId, { oldPassword: 'altesGeheim1', newPassword: 'neuesGeheim9' });
  assert.equal(orgAuth.login({ email: 'a@a.at', password: 'neuesGeheim9' }).ok, true);
  assert.equal(orgAuth.login({ email: 'a@a.at', password: 'altesGeheim1' }).ok, false);
});

test('Falsches altes Passwort wird abgelehnt', () => {
  const { orgAuth, userId } = setup();
  assert.throws(() => orgAuth.changePassword(userId, { oldPassword: 'falsch', newPassword: 'neuesGeheim9' }), /Aktuelles Passwort/);
});

test('Zu kurzes neues Passwort wird abgelehnt', () => {
  const { orgAuth, userId } = setup();
  assert.throws(() => orgAuth.changePassword(userId, { oldPassword: 'altesGeheim1', newPassword: 'kurz' }), /mindestens 8/);
});
