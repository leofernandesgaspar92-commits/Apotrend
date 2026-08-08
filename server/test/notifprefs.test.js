import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const mk = (handle, email) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: handle }, owner: { name: handle, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: handle });
    return r.user.id;
  };
  const a = mk('alice', 'a@a.at');
  const b = mk('bob', 'b@a.at');
  return { repo, socialRepo, social, a, b };
}

test('Einstellungen: Default sind alle Kategorien an', () => {
  const { social, a } = setup();
  const s = social.getNotifSettings(a);
  for (const c of social.notifCategories()) assert.equal(s[c], true, `${c} default an`);
});

test('Einstellungen: deaktivierte Community-Kategorie unterdrückt Kommentar-Benachrichtigung', () => {
  const { social, a, b } = setup();
  // Alice postet, Bob kommentiert -> Alice bekommt normalerweise 'comment'
  const post = social.createPost(a, { body: 'Hallo Welt' });
  social.comment(b, post.id, { body: 'Antwort 1' });
  assert.equal(social.notifications(a).filter(n => n.type === 'comment').length, 1);
  // Alice schaltet 'community' aus -> keine weitere Kommentar-Benachrichtigung
  social.setNotifSetting(a, 'community', false);
  social.comment(b, post.id, { body: 'Antwort 2' });
  assert.equal(social.notifications(a).filter(n => n.type === 'comment').length, 1, 'keine neue');
  // Wieder an -> kommt wieder
  social.setNotifSetting(a, 'community', true);
  social.comment(b, post.id, { body: 'Antwort 3' });
  assert.equal(social.notifications(a).filter(n => n.type === 'comment').length, 2);
});

test('Einstellungen: „follows" aus unterdrückt Follow-Benachrichtigung, andere Kategorien bleiben', () => {
  const { social, a, b } = setup();
  social.setNotifSetting(a, 'follows', false);
  social.follow(b, a); // Bob folgt Alice
  assert.equal(social.notifications(a).filter(n => n.type === 'follow').length, 0, 'Follow unterdrückt');
  // DM (andere Kategorie) kommt weiterhin an
  const thread = social.startDm(b, a);
  social.sendDm(b, thread.id, 'Hallo');
  assert.equal(social.notifications(a).filter(n => n.type === 'dm').length, 1, 'DM unberührt');
});

test('Einstellungen: watch_alert (cross-service pushNotification) respektiert „watch" aus', () => {
  const { social, socialRepo, a, b } = setup();
  // Alice deaktiviert „watch"
  social.setNotifSetting(a, 'watch', false);
  // Simuliere Cross-Service-Benachrichtigung (wie shortages/prices)
  const created = social.pushNotification({ userId: a, type: 'watch_alert', actorUserId: b, refType: 'shortage', refId: 'x', label: 'Amoxicillin' });
  assert.equal(created, null, 'unterdrückt');
  assert.equal(social.notifications(a).filter(n => n.type === 'watch_alert').length, 0);
  // Systemtyp 'verified' ist nicht abschaltbar -> kommt trotzdem
  social.pushNotification({ userId: a, type: 'verified' });
  assert.equal(social.notifications(a).filter(n => n.type === 'verified').length, 1);
  void socialRepo;
});

test('Einstellungen: transaktionale Termin-Benachrichtigungen sind nicht abschaltbar', () => {
  const { social, a, b } = setup();
  // Selbst mit „live" aus müssen Termin-Status-Meldungen ankommen (nicht gemappt = immer)
  social.setNotifSetting(a, 'live', false);
  social.pushNotification({ userId: a, type: 'appt_confirmed', actorUserId: b, refType: 'appointment', refId: 'x' });
  assert.equal(social.notifications(a).filter(n => n.type === 'appt_confirmed').length, 1);
  // live_start hingegen ist unter „live" abschaltbar
  social.pushNotification({ userId: a, type: 'live_start', actorUserId: b, refType: 'live', refId: 'y' });
  assert.equal(social.notifications(a).filter(n => n.type === 'live_start').length, 0, 'live_start unterdrückt');
});

test('Einstellungen: Austausch-Treffer (exchange_offer) respektieren „watch" aus', () => {
  const { social, a, b } = setup();
  social.setNotifSetting(a, 'watch', false);
  const created = social.pushNotification({ userId: a, type: 'exchange_offer', actorUserId: b, refType: 'exchange', refId: 'x', label: 'Amoxicillin' });
  assert.equal(created, null, 'unterdrückt (vorher immer-an)');
});

test('Einstellungen: unbekannte Kategorie wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.setNotifSetting(a, 'quatsch', false), /Kategorie/);
});
