import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Muss VOR dem Import von token.js gesetzt sein (Secret wird beim Laden gelesen).
const SECRET = 'test-secret-mind-16-zeichen-lang';
process.env.APOPULSE_TOKEN_SECRET = SECRET;
const { issueToken, verifyToken } = await import('../src/http/token.js');

test('issueToken/verifyToken: Round-Trip', () => {
  const t = issueToken('user-123');
  assert.equal(verifyToken(t), 'user-123');
});

test('Token nutzt das gesetzte APOPULSE_TOKEN_SECRET (stabil über Neustarts)', () => {
  // Erwartete Signatur mit demselben Secret unabhängig nachrechnen.
  const payload = Buffer.from('user-123').toString('base64url');
  const expectSig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(payload).digest('base64url');
  assert.equal(issueToken('user-123'), `${payload}.${expectSig}`);
});

test('verifyToken: manipuliertes Token wird abgelehnt', () => {
  const t = issueToken('user-123');
  assert.equal(verifyToken(t.slice(0, -2) + 'xx'), null);
  assert.equal(verifyToken('quatsch'), null);
  assert.equal(verifyToken(null), null);
});

test('verifyToken: Token für andere userId liefert die richtige ID zurück', () => {
  assert.equal(verifyToken(issueToken('abc')), 'abc');
  assert.notEqual(verifyToken(issueToken('abc')), 'xyz');
});
