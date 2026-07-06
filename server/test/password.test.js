import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/domain/password.js';

test('hash ist kein Klartext und pro Aufruf unterschiedlich (Salt)', () => {
  const a = hashPassword('geheim123');
  const b = hashPassword('geheim123');
  assert.ok(!a.includes('geheim123'));
  assert.notEqual(a, b); // unterschiedlicher Salt
  assert.match(a, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
});

test('verifyPassword: richtig true, falsch false', () => {
  const h = hashPassword('geheim123');
  assert.equal(verifyPassword('geheim123', h), true);
  assert.equal(verifyPassword('falsch', h), false);
});

test('verifyPassword robust gegen Muell-Eingaben', () => {
  assert.equal(verifyPassword('x', 'kaputt'), false);
  assert.equal(verifyPassword('x', null), false);
});

test('zu kurzes Passwort wird abgelehnt', () => {
  assert.throws(() => hashPassword('kurz'), /mindestens 8/);
});
