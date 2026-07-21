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
  const mk = (name, mail) => orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo ' + name }, owner: { name, email: mail, password: 'geheim123' } }).user.id;
  const a = mk('Anna', 'anna@a.at'), b = mk('Ben', 'ben@b.at'), c = mk('Cem', 'cem@c.at');
  social.createProfile(a, { handle: 'anna', displayName: 'Anna' });
  social.createProfile(b, { handle: 'ben', displayName: 'Ben' });
  social.createProfile(c, { handle: 'cem', displayName: 'Cem' });
  return { social, a, b, c };
}

test('Repost: erstellt kind=repost, bettet Original im Feed ein', () => {
  const { social, a, b } = setup();
  const orig = social.createPost(a, { body: 'Engpass bei Amoxicillin', visibility: 'public' });
  const res = social.repost(b, orig.id);
  assert.equal(res.reposted, true);
  const rp = res.post;
  assert.equal(rp.kind, 'repost');
  assert.equal(rp.repost_of, orig.id);
  const seen = social.publicFeed(b).find(p => p.id === rp.id);
  assert.ok(seen.repost_of_post, 'Original eingebettet');
  assert.equal(seen.repost_of_post.body, 'Engpass bei Amoxicillin');
  assert.equal(seen.repost_of_post.author.handle, 'anna');
  // Original trägt Repost-Zähler + reposted_by_me aus B-Sicht
  const origSeen = social.publicFeed(b).find(p => p.id === orig.id);
  assert.equal(origSeen.repost_count, 1);
  assert.equal(origSeen.reposted_by_me, true);
});

test('Repost eines Reposts wird auf das Original geflacht', () => {
  const { social, a, b, c } = setup();
  const orig = social.createPost(a, { body: 'Original', visibility: 'public' });
  const rp1 = social.repost(b, orig.id).post;
  const rp2 = social.repost(c, rp1.id).post; // C teilt Bens Repost
  assert.equal(rp2.repost_of, orig.id, 'zeigt aufs Original, nicht auf den Repost');
});

test('Repost ist ein Umschalter: zweiter Aufruf nimmt das Teilen zurück (kein Doppel)', () => {
  const { social, a, b } = setup();
  const orig = social.createPost(a, { body: 'Original', visibility: 'public' });
  const on = social.repost(b, orig.id);
  assert.equal(on.reposted, true);
  const off = social.repost(b, orig.id); // erneut -> zurücknehmen
  assert.equal(off.reposted, false);
  assert.equal(off.post, null);
  // Zähler zurück auf 0, kein Repost mehr im Feed
  const origSeen = social.publicFeed(b).find(p => p.id === orig.id);
  assert.equal(origSeen.repost_count, 0);
  assert.equal(origSeen.reposted_by_me, false);
  assert.equal(social.publicFeed(b).filter(p => p.kind === 'repost').length, 0);
  // erneut teilen geht wieder
  assert.equal(social.repost(b, orig.id).reposted, true);
});

test('Repost benachrichtigt die Original-Autor:in (nicht sich selbst)', () => {
  const { social, a, b } = setup();
  const orig = social.createPost(a, { body: 'X', visibility: 'public' });
  social.repost(b, orig.id);
  const na = social.notifications(a).filter(n => n.type === 'repost');
  assert.equal(na.length, 1);
  assert.equal(na[0].post_id, orig.id);
  // Eigener Repost (A teilt selbst) erzeugt keine Selbst-Benachrichtigung
  social.repost(a, orig.id);
  assert.equal(social.notifications(a).filter(n => n.type === 'repost').length, 1);
});

test('Repost eines nicht sichtbaren (Follower-only) Beitrags -> post_not_found', () => {
  const { social, a, b } = setup();
  const priv = social.createPost(a, { body: 'nur Follower', visibility: 'followers' });
  assert.throws(() => social.repost(b, priv.id), e => e.code === 'post_not_found');
});

test('Repost eines gelöschten Beitrags -> post_not_found', () => {
  const { social, a, b } = setup();
  const orig = social.createPost(a, { body: 'weg gleich', visibility: 'public' });
  social.deletePost(a, orig.id);
  assert.throws(() => social.repost(b, orig.id), e => e.code === 'post_not_found');
});

test('Wird das Original nach dem Repost gelöscht, zeigt der Feed „gelöscht"', () => {
  const { social, a, b } = setup();
  const orig = social.createPost(a, { body: 'temporär', visibility: 'public' });
  const rp = social.repost(b, orig.id).post;
  social.deletePost(a, orig.id);
  const seen = social.publicFeed(b).find(p => p.id === rp.id);
  assert.deepEqual(seen.repost_of_post, { deleted: true });
});
