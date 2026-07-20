import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/domain/rateLimiter.js';

test('sperrt nach max Fehlversuchen, check() ist seiteneffektfrei', () => {
  let clock = 1000;
  const rl = createRateLimiter({ max: 3, windowMs: 10000, now: () => clock });
  const k = 'ip|a@a.at';
  assert.equal(rl.check(k).blocked, false);
  assert.equal(rl.check(k).remaining, 3, 'check zählt nicht');
  rl.fail(k); rl.fail(k);
  assert.equal(rl.check(k).blocked, false, 'zwei Versuche -> noch offen');
  assert.equal(rl.check(k).remaining, 1);
  rl.fail(k); // dritter
  assert.equal(rl.check(k).blocked, true, 'drei Versuche -> gesperrt');
  assert.ok(rl.check(k).retryAfterMs > 0);
});

test('gleitendes Fenster: alte Fehlversuche verfallen', () => {
  let clock = 0;
  const rl = createRateLimiter({ max: 2, windowMs: 1000, now: () => clock });
  const k = 'ip|b';
  rl.fail(k); rl.fail(k);
  assert.equal(rl.check(k).blocked, true);
  clock = 1001; // Fenster vorbei
  assert.equal(rl.check(k).blocked, false, 'nach Fensterablauf wieder frei');
  assert.equal(rl._size(), 0, 'leerer Eintrag wird aufgeräumt');
});

test('reset() hebt die Sperre sofort auf (erfolgreicher Login)', () => {
  let clock = 0;
  const rl = createRateLimiter({ max: 2, windowMs: 10000, now: () => clock });
  const k = 'ip|c';
  rl.fail(k); rl.fail(k);
  assert.equal(rl.check(k).blocked, true);
  rl.reset(k);
  assert.equal(rl.check(k).blocked, false);
});

test('Schlüssel sind unabhängig (verschiedene IP/E-Mail)', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 10000 });
  rl.fail('ip1|x'); rl.fail('ip1|x');
  assert.equal(rl.check('ip1|x').blocked, true);
  assert.equal(rl.check('ip2|x').blocked, false, 'andere IP nicht betroffen');
  assert.equal(rl.check('ip1|y').blocked, false, 'andere E-Mail nicht betroffen');
});
