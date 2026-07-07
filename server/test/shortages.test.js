import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesService } from '../src/services/shortages.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortages = createShortagesService(createShortagesRepo(), social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { social, shortages, a: A.user.id, b: B.user.id };
}

test('Engpass-Liste: Referenzdaten mit Herkunfts-Flag, kritisch zuerst', () => {
  const { shortages } = setup();
  const list = shortages.list();
  assert.ok(list.length >= 5);
  assert.equal(list[0].status, 'kritisch');       // kritisch oben
  assert.equal(list[0].provenance, 'reference');   // ehrlich gekennzeichnet
  assert.ok(list.every(s => ['verified', 'reference', 'simulated'].includes(s.provenance)));
});

test('Aus Engpass heraus posten -> Beitrag referenziert den Engpass', () => {
  const { shortages, a } = setup();
  const s = shortages.list()[0];
  const post = shortages.postAbout(a, s.id, { body: 'Wir haben noch 3 Packungen zum Tausch.' });
  assert.equal(post.ref_type, 'shortage');
  assert.equal(post.ref_id, s.id);
});

test('"X Apotheker haben dazu gepostet": Aktivität am Engpass', () => {
  const { shortages, a, b } = setup();
  const s = shortages.list()[0];
  shortages.postAbout(a, s.id, { body: 'Bei uns aus.' });
  shortages.postAbout(b, s.id, { body: 'Alternativpräparat vorhanden.' });

  const act = shortages.withActivity(a, s.id);
  assert.equal(act.post_count, 2);
  assert.equal(act.shortage.id, s.id);

  // Liste mit Zähler
  const withCounts = shortages.listWithCounts(a);
  assert.equal(withCounts.find(x => x.id === s.id).post_count, 2);
});

test('Sichtbarkeit gilt auch bei Engpass-Aktivität: followers-Post zählt nicht für Fremde', () => {
  const { shortages, a, b } = setup();
  const s = shortages.list()[0];
  shortages.postAbout(a, s.id, { body: 'nur meine Follower', visibility: 'followers' });
  // Ben folgt Anna nicht -> sieht/zählt den Beitrag nicht
  assert.equal(shortages.withActivity(b, s.id).post_count, 0);
  // Anna selbst sieht ihn
  assert.equal(shortages.withActivity(a, s.id).post_count, 1);
});

test('Posten zu unbekanntem Engpass wird abgelehnt', () => {
  const { shortages, a } = setup();
  assert.throws(() => shortages.postAbout(a, 'gibt-es-nicht', { body: 'x' }), /nicht gefunden/);
});
