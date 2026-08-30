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
  // Redaktions-Account
  const R = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Redaktion' }, owner: { name: 'ApoPulse Redaktion', email: 'red@apopulse.at', password: 'geheim123' } });
  social.createProfile(R.user.id, { handle: 'apopulse', displayName: 'ApoPulse-Redaktion', isEditorial: true });
  // normaler Apotheker
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { social, red: R.user.id, a: A.user.id };
}

test('News-Feed zeigt nur kind=news (kuratiert + geteilt), nicht normale Posts', () => {
  const { social, red, a } = setup();
  social.createPost(red, { body: 'Kammer: neue Rezeptpflicht ab August', kind: 'news' });
  social.createPost(a, { body: 'Gesetzesänderung geteilt: Details hier', kind: 'news' });     // Nutzer teilt News
  social.createPost(a, { body: 'Ganz normaler Beitrag', kind: 'post' });                      // kein News

  const news = social.newsFeed(a);
  assert.equal(news.length, 2);
  assert.ok(news.every(p => p.kind === 'news'));
});

test('Redaktions-News trägt is_editorial-Kennzeichnung', () => {
  const { social, red, a } = setup();
  social.createPost(red, { body: 'Offizielle Mitteilung', kind: 'news' });
  const news = social.newsFeed(a);
  const item = news.find(p => p.author.is_editorial);
  assert.ok(item, 'Redaktions-Beitrag als editorial markiert');
});

test('News-Ansicht respektiert Sichtbarkeit (followers-News nicht für Fremde)', () => {
  const { social, red, a } = setup();
  social.createPost(a, { body: 'nur meine Follower', kind: 'news', visibility: 'followers' });
  // Redaktion folgt Anna nicht -> sieht die followers-News nicht
  assert.equal(social.newsFeed(red).length, 0);
  assert.equal(social.newsFeed(a).length, 1);
});

test('News erscheinen auch im normalen Feed (dasselbe System)', () => {
  const { social, red, a } = setup();
  social.createPost(red, { body: 'News im öffentlichen Feed', kind: 'news' });
  assert.ok(social.publicFeed(a).some(p => p.kind === 'news'));
});
