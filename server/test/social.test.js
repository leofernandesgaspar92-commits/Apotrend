import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

// Drei Apotheker-Personen aufsetzen (ueber das Fundament) + Social-Service.
function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);

  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo A' }, owner: { name: 'Anna Huber', email: 'anna@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo B' }, owner: { name: 'Ben Mayer', email: 'ben@b.at', password: 'geheim123' } });
  const C = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo C' }, owner: { name: 'Cem Yildiz', email: 'cem@c.at', password: 'geheim123' } });
  const a = A.user.id, b = B.user.id, c = C.user.id;

  social.createProfile(a, { handle: 'anna', displayName: 'Anna Huber', title: 'Apothekerin' });
  social.createProfile(b, { handle: 'ben', displayName: 'Ben Mayer', title: 'Apotheker' });
  social.createProfile(c, { handle: 'cem', displayName: 'Cem Yildiz', title: 'Apotheker' });

  return { social, a, b, c };
}

test('Profil: Handle eindeutig und validiert', () => {
  const { social, a } = setup();
  assert.equal(social.getProfile('anna').display_name, 'Anna Huber');
  assert.throws(() => social.createProfile(a, { handle: 'zweitprofil', displayName: 'X' }), /existiert bereits/);
  const { social: s2, a: a2 } = setup();
  assert.throws(() => s2.createProfile(a2, { handle: 'anna', displayName: 'Y' }), /existiert|vergeben/); // a2 hat schon 'anna'
});

test('Home-Feed: eigene + gefolgte Personen, nicht Fremde', () => {
  const { social, a, b, c } = setup();
  const pB = social.createPost(b, { body: 'Engpass bei Amoxicillin' });
  social.createPost(c, { body: 'Preis fuer Metformin gestiegen' });
  const pA = social.createPost(a, { body: 'Guten Morgen Kollegen' });

  social.follow(a, b); // Anna folgt Ben, nicht Cem
  const feed = social.homeFeed(a).map(p => p.id);
  assert.ok(feed.includes(pB.id), 'Beitrag von gefolgtem Ben');
  assert.ok(feed.includes(pA.id), 'eigener Beitrag');
  assert.equal(feed.length, 2); // Cem (nicht gefolgt) faellt raus
});

test('Sichtbarkeit followers: nur Follower sehen den Beitrag', () => {
  const { social, a, b, c } = setup();
  const secret = social.createPost(a, { body: 'Nur fuer meine Follower', visibility: 'followers' });
  social.follow(b, a); // Ben folgt Anna, Cem nicht

  // im oeffentlichen Feed taucht ein followers-Post nicht auf
  assert.equal(social.publicFeed(c).some(p => p.id === secret.id), false);
  // Ben (Follower) sieht ihn ueber getPost; Cem nicht
  assert.ok(social.getPost(b, secret.id));
  assert.equal(social.getPost(c, secret.id), null);
});

test('Öffentlicher Feed: nur public-Beiträge, neueste zuerst', () => {
  const { social, a, b } = setup();
  social.createPost(a, { body: 'oeffentlich 1', visibility: 'public' });
  social.createPost(b, { body: 'privat', visibility: 'followers' });
  const pub = social.publicFeed(a);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].body, 'oeffentlich 1');
});

test('Kommentar-Thread: verschachtelt, nur auf sichtbaren Beitrag', () => {
  const { social, a, b, c } = setup();
  const post = social.createPost(a, { body: 'Wer hat Erfahrung mit Lieferant Y?' });
  const c1 = social.comment(b, post.id, { body: 'Ja, gut erreichbar.' });
  social.comment(c, post.id, { body: 'Antwort auf Ben', parentCommentId: c1.id });
  assert.equal(social.listComments(a, post.id).length, 2);

  // followers-Post: Nicht-Follower darf nicht kommentieren
  const secret = social.createPost(a, { body: 'intern', visibility: 'followers' });
  assert.throws(() => social.comment(c, secret.id, { body: 'darf nicht' }), ForbiddenError);
});

test('Reaktionen: typisiert, eine je Nutzer+Ziel, umschaltbar, gezaehlt', () => {
  const { social, a, b, c } = setup();
  const post = social.createPost(a, { body: 'Hilfreicher Tipp' });
  social.react(b, 'post', post.id, 'hilfreich');
  social.react(c, 'post', post.id, 'danke');
  // Ben wechselt seine Reaktion (bleibt EINE)
  social.react(b, 'post', post.id, 'bestaetigt');

  const decorated = social.getPost(a, post.id);
  assert.equal(decorated.reaction_counts.hilfreich, 0);
  assert.equal(decorated.reaction_counts.bestaetigt, 1);
  assert.equal(decorated.reaction_counts.danke, 1);
  assert.equal(decorated.comment_count, 0);
});

test('Reaktion: my_reaction markiert eigene Reaktion; dieselbe nochmal = Toggle-off', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Toggle-Test' });
  social.react(b, 'post', post.id, 'hilfreich');
  let db = social.getPost(b, post.id);
  assert.equal(db.my_reaction, 'hilfreich', 'eigene Reaktion wird markiert');
  assert.equal(db.reaction_counts.hilfreich, 1);
  // Andere:r Betrachter:in sieht keine eigene Reaktion
  assert.equal(social.getPost(a, post.id).my_reaction, null);
  // Dieselbe Reaktion erneut -> entfernt (Umschalten)
  const res = social.react(b, 'post', post.id, 'hilfreich');
  assert.equal(res, null, 'Toggle-off gibt null zurück');
  db = social.getPost(b, post.id);
  assert.equal(db.my_reaction, null, 'Reaktion nach Toggle entfernt');
  assert.equal(db.reaction_counts.hilfreich, 0);
});

test('Löschen: nur Autor, danach aus Feeds verschwunden', () => {
  const { social, a, b } = setup();
  const post = social.createPost(a, { body: 'Loeschbar' });
  assert.throws(() => social.deletePost(b, post.id), ForbiddenError);
  social.deletePost(a, post.id);
  assert.equal(social.publicFeed(a).some(p => p.id === post.id), false);
  assert.equal(social.getPost(a, post.id), null);
});
