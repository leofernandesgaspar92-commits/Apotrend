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
  const prov = mk('apo', 'Apo Premium', 'p@a.at');   // wird Premium (Anbieter)
  const cust = mk('kunde', 'Kunde', 'k@a.at');        // registriert, kostenlos (Anfrager)
  return { repo, social, prov, cust };
}

test('Videosprechstunde: nur Premium-Apotheken sind buchbar', () => {
  const { repo, social, prov, cust } = setup();
  // Ohne Premium: Anfrage abgelehnt
  assert.throws(() => social.requestVideoAppointment(cust, 'apo', { datum: '2026-09-01', uhrzeit: '10:00' }), /Premium/);
  // Anbieter wird Premium -> Anfrage möglich
  repo.grantEntitlement(prov, 'premium');
  const a = social.requestVideoAppointment(cust, 'apo', { datum: '2026-09-01', uhrzeit: '10:00', grund: 'Beratung' });
  assert.equal(a.status, 'angefragt');
  assert.equal(a.provider.handle, 'apo');
  assert.equal(a.requester.handle, 'kunde');
  assert.equal(a.room_url, null, 'Raum erst bei Bestätigung');
});

test('Videosprechstunde: bestätigen erzeugt Video-Raum; ablehnen nicht; nur Anbieter darf', () => {
  const { repo, social, prov, cust } = setup();
  repo.grantEntitlement(prov, 'premium');
  const a = social.requestVideoAppointment(cust, 'apo', { datum: '2026-09-01', uhrzeit: '10:00' });
  // Anfrager darf nicht bestätigen
  assert.throws(() => social.respondVideoAppointment(cust, a.id, true), ForbiddenError);
  // Anbieter bestätigt -> Raum-URL
  const conf = social.respondVideoAppointment(prov, a.id, true);
  assert.equal(conf.status, 'bestaetigt');
  assert.match(conf.room_url, /^https:\/\/meet\.jit\.si\/apopulse-/);
  // Anfrager wurde benachrichtigt
  assert.ok(social.notifications(cust).some(n => n.type === 'appt_confirmed'));
  // Nicht mehr offen -> erneute Antwort abgelehnt
  assert.throws(() => social.respondVideoAppointment(prov, a.id, false), /nicht mehr offen|not_pending/i);
});

test('Videosprechstunde: Validierung (Datum/Uhrzeit) + Selbstbuchung', () => {
  const { repo, social, prov } = setup();
  repo.grantEntitlement(prov, 'premium');
  assert.throws(() => social.requestVideoAppointment(prov, 'apo', { datum: '2026-09-01', uhrzeit: '10:00' }), /sich selbst/);
  const { social: s2, repo: r2, prov: p2, cust: c2 } = setup();
  r2.grantEntitlement(p2, 'premium');
  assert.throws(() => s2.requestVideoAppointment(c2, 'apo', { datum: '01.09.2026', uhrzeit: '10:00' }), /Datum/);
  assert.throws(() => s2.requestVideoAppointment(c2, 'apo', { datum: '2026-09-01', uhrzeit: '25 Uhr' }), /Uhrzeit/);
});

test('Videosprechstunde: stornieren durch beide Seiten; Liste je Nutzer', () => {
  const { repo, social, prov, cust } = setup();
  repo.grantEntitlement(prov, 'premium');
  const a = social.requestVideoAppointment(cust, 'apo', { datum: '2026-09-01', uhrzeit: '10:00' });
  // Fremde dürfen nicht stornieren
  const outsiderRepo = setup();
  // Anfrager storniert
  const cancelled = social.cancelVideoAppointment(cust, a.id);
  assert.equal(cancelled.status, 'storniert');
  assert.ok(social.notifications(prov).some(n => n.type === 'appt_cancelled'));
  // Beide sehen den Termin in ihrer Liste
  assert.equal(social.listVideoAppointments(prov).length, 1);
  assert.equal(social.listVideoAppointments(cust).length, 1);
  assert.equal(social.listVideoAppointments(prov)[0].i_am_provider, true);
  assert.ok(outsiderRepo);
});
