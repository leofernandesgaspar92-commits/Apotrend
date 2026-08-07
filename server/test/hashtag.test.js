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
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { social, a: A.user.id, b: B.user.id };
}

test('Hashtag-Filter findet passende Beiträge, exakt (kein Präfix-Treffer)', () => {
  const { social, a } = setup();
  social.createPost(a, { body: 'Engpass bei #Amoxicillin gemeldet' });
  social.createPost(a, { body: 'Neues zu #Amoxicillin1000 (anderes Tag)' });
  social.createPost(a, { body: 'Ohne Tag' });
  const hits = social.postsByHashtag(a, 'Amoxicillin');
  assert.equal(hits.length, 1);
  assert.ok(hits[0].body.includes('#Amoxicillin gemeldet'));
});

test('Hashtag-Filter ist case-insensitiv und akzeptiert führendes #', () => {
  const { social, a } = setup();
  social.createPost(a, { body: 'Thema #Lieferengpass heute' });
  assert.equal(social.postsByHashtag(a, '#lieferengpass').length, 1);
  assert.equal(social.postsByHashtag(a, 'LIEFERENGPASS').length, 1);
});

test('Hashtag-Filter respektiert Sichtbarkeit', () => {
  const { social, a, b } = setup();
  social.createPost(a, { body: 'privat #geheim', visibility: 'followers' });
  assert.equal(social.postsByHashtag(b, 'geheim').length, 0); // Ben folgt nicht
  assert.equal(social.postsByHashtag(a, 'geheim').length, 1); // Autor sieht es
});

test('Leeres Tag liefert nichts', () => {
  const { social, a } = setup();
  assert.equal(social.postsByHashtag(a, '   ').length, 0);
});

test('Hashtag-Feed blendet Beiträge stummgeschalteter Personen aus', () => {
  const { social, a, b } = setup();
  const pb = social.createPost(b, { body: 'Engpass bei #Metformin (Ben)' });
  assert.ok(social.postsByHashtag(a, 'Metformin').some(p => p.id === pb.id));
  social.mute(a, 'ben');
  assert.ok(!social.postsByHashtag(a, 'Metformin').some(p => p.id === pb.id), 'nach Mute nicht mehr im Hashtag-Feed');
  // Trending zählt den Beitrag für a auch nicht mehr
  const trend = social.trendingHashtags(a) || [];
  assert.ok(!trend.some(x => (x.tag||x.hashtag||'').toLowerCase() === 'metformin'), 'Metformin nicht im Trending für a');
});
