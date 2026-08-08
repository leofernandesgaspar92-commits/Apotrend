import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const mk = (handle, name, email) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    return r.user.id;
  };
  const host = mk('host', 'Host Premium', 'h@a.at');
  const viewer = mk('viewer', 'Zuschauer', 'v@a.at');
  return { repo, social, host, viewer };
}

test('Live: nur Premium darf Sessions planen', () => {
  const { repo, social, host } = setup();
  assert.throws(() => social.createLiveSession(host, { titel: 'Antibiotika-Q&A', geplant_am: '2026-09-01T18:00' }), /Premium/);
  repo.grantEntitlement(host, 'premium');
  const s = social.createLiveSession(host, { titel: 'Antibiotika-Q&A', thema: 'Fragen zu Engpässen', geplant_am: '2026-09-01T18:00' });
  assert.equal(s.status, 'geplant');
  assert.equal(s.room_url, null, 'Raum erst beim Start');
  assert.equal(s.host.handle, 'host');
  assert.equal(s.i_am_host, true);
});

test('Live: Validierung (Titel, Termin-Format)', () => {
  const { repo, social, host } = setup();
  repo.grantEntitlement(host, 'premium');
  assert.throws(() => social.createLiveSession(host, { titel: 'ab', geplant_am: '2026-09-01T18:00' }), /Titel/);
  assert.throws(() => social.createLiveSession(host, { titel: 'Gültig', geplant_am: '2026-09-01' }), /Termin/);
  assert.throws(() => social.createLiveSession(host, { titel: 'Gültig', geplant_am: '01.09.2026 18:00' }), /Termin/);
});

test('Live: Start erzeugt Raum + benachrichtigt Follower; nur Host darf', () => {
  const { repo, social, host, viewer } = setup();
  repo.grantEntitlement(host, 'premium');
  social.follow(viewer, host);
  const s = social.createLiveSession(host, { titel: 'Produktvorstellung', geplant_am: '2026-09-01T18:00' });
  assert.throws(() => social.startLiveSession(viewer, s.id), ForbiddenError);
  const live = social.startLiveSession(host, s.id);
  assert.equal(live.status, 'live');
  assert.match(live.room_url, /^https:\/\/meet\.jit\.si\/apotrend-live-/);
  assert.ok(social.notifications(viewer).some(n => n.type === 'live_start'), 'Follower benachrichtigt');
});

test('Live: laufende Session zuerst; beendete verschwindet aus der Liste', () => {
  const { repo, social, host, viewer } = setup();
  repo.grantEntitlement(host, 'premium');
  const a = social.createLiveSession(host, { titel: 'Später', geplant_am: '2026-12-01T10:00' });
  const b = social.createLiveSession(host, { titel: 'Jetzt live', geplant_am: '2026-09-01T18:00' });
  social.startLiveSession(host, b.id);
  const list = social.listLiveSessions(viewer);
  assert.equal(list.length, 2);
  assert.equal(list[0].titel, 'Jetzt live', 'laufende zuerst');
  // Beenden -> aus der öffentlichen Liste raus
  social.endLiveSession(host, b.id);
  const after = social.listLiveSessions(viewer).map(s => s.titel);
  assert.deepEqual(after, ['Später']);
  assert.equal(social.listMyLiveSessions(host).length, 2, 'Host sieht auch beendete');
});

test('Live: „Erinnern" umschalten + Interessierte werden beim Start benachrichtigt', () => {
  const { repo, social, host, viewer } = setup();
  repo.grantEntitlement(host, 'premium');
  const s = social.createLiveSession(host, { titel: 'Q&A', geplant_am: '2026-09-01T18:00' });
  // Interesse setzen (viewer folgt dem Host NICHT -> nur über Erinnern erreichbar)
  const on = social.toggleLiveInterest(viewer, s.id);
  assert.equal(on.interested, true);
  assert.equal(on.interest_count, 1);
  assert.equal(social.listLiveSessions(viewer)[0].i_am_interested, true);
  assert.equal(social.listLiveSessions(host)[0].interest_count, 1, 'Host sieht die Nachfrage');
  // Start -> vorgemerkte Person wird benachrichtigt (obwohl kein Follower)
  social.startLiveSession(host, s.id);
  assert.ok(social.notifications(viewer).some(n => n.type === 'live_start'));
  // Umschalten aus
  const off = social.toggleLiveInterest(viewer, s.id);
  assert.equal(off.interested, false);
  assert.equal(off.interest_count, 0);
});

test('Live: Erinnern benachrichtigt nicht doppelt (Follower + Interesse)', () => {
  const { repo, social, host, viewer } = setup();
  repo.grantEntitlement(host, 'premium');
  social.follow(viewer, host);
  const s = social.createLiveSession(host, { titel: 'Doppelt?', geplant_am: '2026-09-01T18:00' });
  social.toggleLiveInterest(viewer, s.id); // zugleich Follower UND interessiert
  social.startLiveSession(host, s.id);
  const n = social.notifications(viewer).filter(x => x.type === 'live_start');
  assert.equal(n.length, 1, 'genau eine Benachrichtigung trotz Follower+Interesse');
});

test('Live: bereits laufende Session lässt sich nicht erneut starten (kein Notify-Spam)', () => {
  const { repo, social, host, viewer } = setup();
  repo.grantEntitlement(host, 'premium');
  social.follow(viewer, host);
  const s = social.createLiveSession(host, { titel: 'Q&A', geplant_am: '2026-09-01T18:00' });
  social.startLiveSession(host, s.id);
  assert.throws(() => social.startLiveSession(host, s.id), /gestartet|startable/i);
  // Genau EINE Live-Benachrichtigung trotz zweitem Startversuch
  assert.equal(social.notifications(viewer).filter(n => n.type === 'live_start').length, 1);
});

test('Live: nur Host/Mod darf löschen; Vormerkungen werden aufgeräumt', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const mk = (handle, email) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: handle }, owner: { name: handle, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: handle });
    return r.user.id;
  };
  const host = mk('host', 'h@a.at'); const viewer = mk('viewer', 'v@a.at');
  repo.grantEntitlement(host, 'premium');
  const s = social.createLiveSession(host, { titel: 'Test', geplant_am: '2026-09-01T18:00' });
  social.toggleLiveInterest(viewer, s.id);
  assert.equal(socialRepo.listReactions('live', s.id).length, 1);
  assert.throws(() => social.deleteLiveSession(viewer, s.id), ForbiddenError);
  social.deleteLiveSession(host, s.id);
  assert.equal(social.listLiveSessions(viewer).length, 0);
  assert.equal(socialRepo.listReactions('live', s.id).length, 0, 'Vormerkungen entfernt');
});
