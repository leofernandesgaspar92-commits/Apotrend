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

// Speicher (11/2026): Ein Schlüssel (z. B. IP-Adresse) verschwand nur, wenn er erneut geprüft wurde. Jede
// Adresse, die einmal ein falsches Passwort probierte und nie wiederkam, blieb für immer gespeichert.
test('abgelaufene Schlüssel werden auch ohne erneute Prüfung aufgeräumt', () => {
  let t = 0;
  const rl = createRateLimiter({ max: 5, windowMs: 1000, now: () => t });
  for (let i = 0; i < 5000; i++) rl.fail('ip-' + i);
  assert.equal(rl._size(), 5000);
  t += 2000; // Fenster für alle abgelaufen
  for (let i = 0; i < 2000; i++) rl.fail('neu-' + i);
  assert.ok(rl._size() <= 2000, `nach Ablauf noch ${rl._size()} Schlüssel (alte nicht aufgeräumt)`);
  // Laufende Sperren bleiben unangetastet.
  for (let i = 0; i < 5; i++) rl.fail('angreifer');
  for (let i = 0; i < 3000; i++) rl.fail('x-' + i);
  assert.equal(rl.check('angreifer').blocked, true);
});
