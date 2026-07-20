import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecoveryCodes, matchRecoveryCode, normalizeCode } from '../src/domain/recoveryCodes.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';

test('normalizeCode: Groß/Klein, Leerzeichen, Bindestriche egal', () => {
  assert.equal(normalizeCode('ab2cd-ef3gh'), 'AB2CDEF3GH');
  assert.equal(normalizeCode('  AB2CD EF3GH  '), 'AB2CDEF3GH');
  assert.equal(normalizeCode(null), '');
});

test('generateRecoveryCodes: 8 Codes, jeder passt zu seinem Hash', () => {
  const { codes, hashes } = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(hashes.length, 8);
  codes.forEach((c, i) => assert.equal(matchRecoveryCode(c, hashes), i, `Code ${i} findet sich`));
  // Groß/Klein und Bindestrich-Varianten treffen ebenfalls
  assert.equal(matchRecoveryCode(codes[3].toLowerCase(), hashes), 3);
  assert.equal(matchRecoveryCode('WRONG-CODE9', hashes), -1);
  assert.equal(matchRecoveryCode('', hashes), -1);
});

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const reg = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo' }, owner: { name: 'Anna', email: 'anna@a.at', password: 'geheim123' } });
  return { repo, orgAuth, reg };
}

test('Registrierung liefert Codes zurück, aber nie den Hash im Nutzerobjekt', () => {
  const { orgAuth, reg } = setup();
  assert.equal(reg.recoveryCodes.length, 8);
  assert.equal(reg.user.recovery_hashes, undefined, 'publicUser enthält keine Hashes');
  assert.equal(orgAuth.remainingRecoveryCodes(reg.user.id), 8);
});

test('resetPassword: gültiger Code setzt neues Passwort und wird verbraucht', () => {
  const { orgAuth, reg } = setup();
  const code = reg.recoveryCodes[0];
  // altes Passwort geht, neues noch nicht
  assert.equal(orgAuth.login({ email: 'anna@a.at', password: 'geheim123' }).ok, true);
  const r = orgAuth.resetPassword({ email: 'anna@a.at', code, newPassword: 'neuespw123' });
  assert.equal(r.ok, true);
  assert.equal(r.remaining_codes, 7, 'ein Code verbraucht');
  // neues Passwort gilt, altes nicht mehr
  assert.equal(orgAuth.login({ email: 'anna@a.at', password: 'neuespw123' }).ok, true);
  assert.equal(orgAuth.login({ email: 'anna@a.at', password: 'geheim123' }).ok, false);
  // derselbe Code ist verbraucht -> nicht wiederverwendbar
  assert.throws(() => orgAuth.resetPassword({ email: 'anna@a.at', code, newPassword: 'nochwas123' }), e => e.code === 'reset_invalid');
});

test('resetPassword: falscher Code / unbekannte E-Mail -> generischer Fehler (keine Enumeration)', () => {
  const { orgAuth } = setup();
  assert.throws(() => orgAuth.resetPassword({ email: 'anna@a.at', code: 'FALSCH-CODE9', newPassword: 'neuespw123' }), e => e.code === 'reset_invalid');
  assert.throws(() => orgAuth.resetPassword({ email: 'niemand@x.com', code: 'FALSCH-CODE9', newPassword: 'neuespw123' }), e => e.code === 'reset_invalid');
});

test('resetPassword: zu kurzes Passwort wird abgelehnt (vor Code-Prüfung)', () => {
  const { orgAuth, reg } = setup();
  assert.throws(() => orgAuth.resetPassword({ email: 'anna@a.at', code: reg.recoveryCodes[0], newPassword: 'kurz' }), e => e.code === 'new_pw_short');
  // Code darf dabei NICHT verbraucht worden sein
  assert.equal(reg.recoveryCodes.length, 8);
  const r = orgAuth.resetPassword({ email: 'anna@a.at', code: reg.recoveryCodes[0], newPassword: 'langgenug123' });
  assert.equal(r.ok, true);
});

test('regenerateRecoveryCodes: erzeugt neue, invalidiert alle alten', () => {
  const { orgAuth, reg } = setup();
  const oldCode = reg.recoveryCodes[0];
  const { codes } = orgAuth.regenerateRecoveryCodes(reg.user.id);
  assert.equal(codes.length, 8);
  assert.equal(orgAuth.remainingRecoveryCodes(reg.user.id), 8);
  // alter Code funktioniert nicht mehr
  assert.throws(() => orgAuth.resetPassword({ email: 'anna@a.at', code: oldCode, newPassword: 'neuespw123' }), e => e.code === 'reset_invalid');
  // neuer Code funktioniert
  assert.equal(orgAuth.resetPassword({ email: 'anna@a.at', code: codes[0], newPassword: 'neuespw123' }).ok, true);
});
