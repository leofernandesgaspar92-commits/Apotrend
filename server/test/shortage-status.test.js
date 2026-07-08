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
  const mods = new Set();
  const social = createSocialService(socialRepo, repo, { isModerator: (id) => mods.has(id) });
  const shortagesRepo = createShortagesRepo({ seed: true });
  const shortages = createShortagesService(shortagesRepo, social);
  const mk = (name, handle) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: handle + '@a.at', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    return r.user.id;
  };
  const redUid = mk('Redaktion', 'red'); mods.add(redUid);
  const apoUid = mk('Apotheke', 'apo');
  const amox = shortagesRepo.list().find(s => s.wirkstoff === 'Amoxicillin');
  return { social, shortages, shortagesRepo, redUid, apoUid, amoxId: amox.id };
}

test('updateStatus: nur Moderation darf ändern', () => {
  const { shortages, apoUid, amoxId } = setup();
  assert.throws(() => shortages.updateStatus(apoUid, amoxId, { status: 'verfuegbar', sourceUrl: 'https://basg.gv.at/x' }), /Redaktion|Moderation/);
});

test('updateStatus: Quelle ist Pflicht', () => {
  const { shortages, redUid, amoxId } = setup();
  assert.throws(() => shortages.updateStatus(redUid, amoxId, { status: 'verfuegbar', sourceUrl: '' }), /Quelle|Link/);
  assert.throws(() => shortages.updateStatus(redUid, amoxId, { status: 'verfuegbar', sourceUrl: 'kein-link' }), /Link/);
});

test('updateStatus: ungültiger Status abgelehnt', () => {
  const { shortages, redUid, amoxId } = setup();
  assert.throws(() => shortages.updateStatus(redUid, amoxId, { status: 'quatsch', sourceUrl: 'https://basg.gv.at/x' }), /Status/);
});

test('updateStatus: setzt Status, Quelle und Herkunft editorial', () => {
  const { shortages, shortagesRepo, redUid, amoxId } = setup();
  const u = shortages.updateStatus(redUid, amoxId, { status: 'verfuegbar', sourceUrl: 'https://www.basg.gv.at/meldung' });
  assert.equal(u.status, 'verfuegbar');
  assert.equal(u.quelle, 'https://www.basg.gv.at/meldung');
  assert.equal(u.provenance, 'editorial');
  assert.equal(shortagesRepo.get(amoxId).status, 'verfuegbar');
});

test('updateStatus: benachrichtigt Beobachter:innen bei Änderung', () => {
  const { social, shortages, shortagesRepo, redUid, apoUid, amoxId } = setup();
  shortagesRepo.addWatch(apoUid, 'Amoxicillin');
  shortages.updateStatus(redUid, amoxId, { status: 'verfuegbar', sourceUrl: 'https://basg.gv.at/x' });
  const notifs = social.notifications(apoUid);
  const alert = notifs.find(n => n.type === 'watch_alert');
  assert.ok(alert, 'watch_alert Benachrichtigung vorhanden');
  assert.match(alert.label, /Amoxicillin/);
  assert.match(alert.label, /Wieder verfügbar/);
});

test('updateStatus: keine Benachrichtigung ohne echte Änderung', () => {
  const { social, shortages, shortagesRepo, redUid, apoUid, amoxId } = setup();
  shortagesRepo.addWatch(apoUid, 'Amoxicillin'); // ist bereits kritisch
  shortages.updateStatus(redUid, amoxId, { status: 'kritisch', sourceUrl: 'https://basg.gv.at/x' });
  const notifs = social.notifications(apoUid).filter(n => n.type === 'watch_alert');
  assert.equal(notifs.length, 0);
});

test('updateStatus: Nicht-Beobachter bekommen nichts', () => {
  const { social, shortages, redUid, apoUid, amoxId } = setup();
  shortages.updateStatus(redUid, amoxId, { status: 'verfuegbar', sourceUrl: 'https://basg.gv.at/x' });
  assert.equal(social.notifications(apoUid).filter(n => n.type === 'watch_alert').length, 0);
});
