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

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('Beitrag mit Bild (data:image) + Quelle wird gespeichert', () => {
  const { social, a } = setup();
  const p = social.createPost(a, { body: 'Mit Bild', image: PNG, sourceUrl: 'https://www.basg.gv.at/' });
  assert.equal(p.image, PNG);
  assert.equal(p.source_url, 'https://www.basg.gv.at/');
});

test('Bild-only-Beitrag (leerer Text) ist erlaubt', () => {
  const { social, a } = setup();
  const p = social.createPost(a, { body: '', image: PNG });
  assert.equal(p.image, PNG);
});

test('Fremdformat/Skript-URL als Bild wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.createPost(a, { body: 'x', image: 'https://evil.example/x.png' }), /Bildformat/);
  assert.throws(() => social.createPost(a, { body: 'x', image: 'data:text/html;base64,AAAA' }), /Bildformat/);
});

test('Quelle muss http(s) sein (keine javascript:-URL)', () => {
  const { social, a } = setup();
  assert.throws(() => social.createPost(a, { body: 'x', sourceUrl: 'javascript:alert(1)' }), /http/);
});

test('Ohne Text und ohne Bild -> abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.createPost(a, { body: '   ' }), /leer/);
});
