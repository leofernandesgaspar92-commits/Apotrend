import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesService, shortageAging } from '../src/services/shortages.js';

test('shortageAging: Tage seit Meldung + Countdown bis Termin', () => {
  // gemeldet vor 40 Tagen, Termin in 10 Tagen
  const a = shortageAging('2026-06-20', '2026-08-09', 'kritisch', '2026-07-30');
  assert.equal(a.days_reported, 40);
  assert.equal(a.days_until, 10);
  assert.equal(a.overdue, false);
});

test('shortageAging: überschrittener Termin ist overdue (negativ)', () => {
  const a = shortageAging('2026-05-01', '2026-07-20', 'kritisch', '2026-07-30');
  assert.equal(a.days_until, -10);
  assert.equal(a.overdue, true);
});

test('shortageAging: „verfuegbar" hat keinen offenen Termin mehr', () => {
  const a = shortageAging('2026-07-01', '2026-08-01', 'verfuegbar', '2026-07-30');
  assert.equal(a.days_until, null);
  assert.equal(a.overdue, false);
  assert.equal(a.days_reported, 29);
});

test('shortageAging: fehlende/ungültige Daten ergeben null (kein Absturz)', () => {
  assert.deepEqual(shortageAging(null, null, 'kritisch', '2026-07-30'), { days_reported: null, days_until: null, overdue: false });
  assert.equal(shortageAging('kaputt', '2026-08-01', 'kritisch', '2026-07-30').days_reported, null);
  // Zukünftiges Meldedatum (unplausibel) wird nicht als negatives Alter ausgewiesen.
  assert.equal(shortageAging('2026-08-05', null, 'kritisch', '2026-07-30').days_reported, null);
});

test('myWatchlist: überfälliger Termin landet als overdue am beobachteten Wirkstoff', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const shortages = createShortagesService(shortagesRepo, social, { today: () => '2026-07-30' });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const a = A.user.id;
  // Engpass mit überschrittenem Termin + Beobachtung
  shortagesRepo.upsert({ wirkstoff: 'Ramipril', bezeichnung: 'Ramipril 5 mg', status: 'kritisch', provenance: 'community', gemeldet_am: '2026-06-01', voraussichtlich_bis: '2026-07-20' });
  shortages.watch(a, 'Ramipril');
  shortages.watch(a, 'Gibtsnicht'); // ohne Engpass -> keine Frist
  const wl = shortages.myWatchlist(a);
  const r = wl.find(x => x.wirkstoff === 'Ramipril');
  assert.equal(r.days_until, -10);
  assert.equal(r.overdue, true);
  const none = wl.find(x => x.wirkstoff === 'Gibtsnicht');
  assert.equal(none.days_until, null);
  assert.equal(none.overdue, false);
});

test('decorate: Alters-/Fristfelder landen an der Engpass-Zeile (today injizierbar)', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const shortages = createShortagesService(shortagesRepo, social, { today: () => '2026-07-30' });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  shortagesRepo.upsert({ wirkstoff: 'Ramipril', bezeichnung: 'Ramipril 5 mg', status: 'kritisch', provenance: 'community', reporter_user_id: A.user.id, gemeldet_am: '2026-06-30', voraussichtlich_bis: '2026-08-04' });
  const row = shortages.listWithCounts(A.user.id).find(s => s.wirkstoff === 'Ramipril');
  assert.equal(row.days_reported, 30);
  assert.equal(row.days_until, 5);
  assert.equal(row.overdue, false);
});
