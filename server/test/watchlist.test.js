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
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const shortagesRepo = createShortagesRepo({ seed: true });
  const shortages = createShortagesService(shortagesRepo, social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { shortages, shortagesRepo, uid: A.user.id };
}

test('Watchlist: Wirkstoff beobachten liefert aktuellen Status (kritisch)', () => {
  const { shortages, uid } = setup();
  const items = shortages.watch(uid, 'Amoxicillin');
  const amox = items.find(i => i.wirkstoff.toLowerCase() === 'amoxicillin');
  assert.ok(amox, 'Amoxicillin in Liste');
  assert.equal(amox.status, 'kritisch');
  assert.ok(amox.shortage_id, 'shortage_id gesetzt');
});

test('Watchlist: unbekannter Wirkstoff -> Status unauffaellig', () => {
  const { shortages, uid } = setup();
  const items = shortages.watch(uid, 'Vitamin C');
  const v = items.find(i => i.wirkstoff === 'Vitamin C');
  assert.equal(v.status, 'unauffaellig');
  assert.equal(v.shortage_id, null);
});

test('Watchlist: kritische zuerst sortiert', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Metformin');    // verfuegbar
  shortages.watch(uid, 'Vitamin C');    // unauffaellig
  const items = shortages.watch(uid, 'Amoxicillin'); // kritisch
  assert.equal(items[0].wirkstoff, 'Amoxicillin', 'kritisch ganz oben');
  assert.equal(items[items.length - 1].wirkstoff, 'Vitamin C', 'unauffaellig ganz unten');
});

test('Watchlist: kein Duplikat, unabhängig von Groß/Kleinschreibung', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const items = shortages.watch(uid, 'amoxicillin');
  assert.equal(items.filter(i => i.wirkstoff.toLowerCase() === 'amoxicillin').length, 1);
});

test('Watchlist: entfernen', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const items = shortages.unwatch(uid, 'AMOXICILLIN');
  assert.equal(items.length, 0);
});

test('Watchlist: leerer Wirkstoff wird abgelehnt', () => {
  const { shortages, uid } = setup();
  assert.throws(() => shortages.watch(uid, '   '), /Wirkstoff/);
});

test('Watchlist: watched-Flag in listWithCounts', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const list = shortages.listWithCounts(uid);
  const amox = list.find(s => s.wirkstoff === 'Amoxicillin');
  assert.equal(amox.watched, true);
  const other = list.find(s => s.wirkstoff === 'Ibuprofen');
  assert.equal(other.watched, false);
});

test('Watchlist: Persistenz über __dump/__load', () => {
  const { shortages, shortagesRepo, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const dump = shortagesRepo.__dump();
  const fresh = createShortagesRepo({ seed: false });
  fresh.__load(dump);
  assert.equal(fresh.isWatched(uid, 'amoxicillin'), true);
  assert.deepEqual(fresh.listWatch(uid), ['Amoxicillin']);
});

test('Watchlist: __load bleibt rückwärtskompatibel zu altem Array-Snapshot', () => {
  const oldSnapshot = [['id1', { id: 'id1', wirkstoff: 'Alt', status: 'kritisch' }]];
  const repo = createShortagesRepo({ seed: false });
  repo.__load(oldSnapshot);
  assert.equal(repo.get('id1').wirkstoff, 'Alt');
});

test('Watchlist: purgeUser entfernt Beobachtungen (DSGVO)', () => {
  const { shortages, shortagesRepo, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  shortagesRepo.purgeUser(uid);
  assert.equal(shortagesRepo.listWatch(uid).length, 0);
});
