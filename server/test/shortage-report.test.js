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
  const shortagesRepo = createShortagesRepo({ seed: false });
  const shortages = createShortagesService(shortagesRepo, social);
  const mk = (name, handle) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: handle + '@a.at', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    return r.user.id;
  };
  return { social, shortages, shortagesRepo, a: mk('Apo A', 'apoa'), b: mk('Apo B', 'apob'), c: mk('Apo C', 'apoc') };
}

test('reportShortage: legt Community-Meldung mit Herkunft community + Melder an', () => {
  const { shortages, a } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril', bezeichnung: 'Ramipril 5 mg', grund: 'Nichts lieferbar' });
  assert.equal(r.provenance, 'community');
  assert.equal(r.quelle, null);
  assert.equal(r.reporter.handle, 'apoa');
  assert.equal(r.is_reporter, true);
  assert.equal(r.confirm_count, 0);
});

test('reportShortage: leerer Wirkstoff abgelehnt', () => {
  const { shortages, a } = setup();
  assert.throws(() => shortages.reportShortage(a, { wirkstoff: '  ' }), /Wirkstoff/);
});

test('reportShortage: Bezeichnung fällt auf Wirkstoff zurück', () => {
  const { shortages, a } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  assert.equal(r.bezeichnung, 'Ramipril');
});

test('reportShortage: dieselbe Apotheke kann denselben Wirkstoff nicht doppelt offen melden', () => {
  const { shortages, a, b } = setup();
  shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  assert.throws(() => shortages.reportShortage(a, { wirkstoff: 'ramipril' }), /bereits gemeldet/);
  // andere Apotheke darf denselben Wirkstoff melden
  assert.doesNotThrow(() => shortages.reportShortage(b, { wirkstoff: 'Ramipril' }));
});

test('reportShortage: benachrichtigt Beobachter:innen (nicht den Melder)', () => {
  const { social, shortages, shortagesRepo, a, b } = setup();
  shortagesRepo.addWatch(b, 'Ramipril');
  shortagesRepo.addWatch(a, 'Ramipril'); // Melder soll KEINE bekommen
  shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  assert.equal(social.notifications(b).filter(n => n.type === 'watch_alert').length, 1);
  assert.equal(social.notifications(a).filter(n => n.type === 'watch_alert').length, 0);
});

test('confirmShortage: zählt Bestätigung, kein Doppel, nicht der Melder', () => {
  const { shortages, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  let u = shortages.confirmShortage(b, r.id);
  assert.equal(u.confirm_count, 1);
  assert.equal(u.i_confirmed, true);
  u = shortages.confirmShortage(b, r.id); // Doppel
  assert.equal(u.confirm_count, 1);
  u = shortages.confirmShortage(a, r.id); // Melder selbst
  assert.equal(u.confirm_count, 1);
});

test('confirmShortage: benachrichtigt Melder:in', () => {
  const { social, shortages, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.confirmShortage(b, r.id);
  const n = social.notifications(a).find(x => x.type === 'shortage_confirm');
  assert.ok(n);
  assert.match(n.label, /Ramipril/);
});

test('Kontotyp-Rechte: Privatnutzer:in darf Engpässe weder melden noch bestätigen; Fachkreis darf', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const shortages = createShortagesService(shortagesRepo, social);
  // Fachkreis (Apotheke) meldet
  const pro = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Pro' }, owner: { name: 'Pro', email: 'pro@a.at', password: 'geheim123' } });
  social.createProfile(pro.user.id, { handle: 'pro_apo', displayName: 'Profi-Apotheke', accountType: 'pharmacy' });
  const rep = shortages.reportShortage(pro.user.id, { wirkstoff: 'Ramipril' });
  assert.equal(rep.provenance, 'community');
  // Privatnutzer:in darf NICHT melden
  const priv = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Priv' }, owner: { name: 'Priv', email: 'priv@a.at', password: 'geheim123' } });
  social.createProfile(priv.user.id, { handle: 'privat_x', displayName: 'Privat', accountType: 'private' });
  assert.throws(() => shortages.reportShortage(priv.user.id, { wirkstoff: 'Ibuprofen' }), /Fachkreisen|sicherheitsrelevant/);
  // ... und NICHT bestätigen
  assert.throws(() => shortages.confirmShortage(priv.user.id, rep.id), /Fachkreisen|sicherheitsrelevant/);
  // Meldung des Fachkreises bleibt unbestätigt
  const row = shortages.listWithCounts(pro.user.id).find(s => s.wirkstoff === 'Ramipril');
  assert.equal(row.confirm_count, 0);
});

test('decorate: rohe confirmation-User-IDs werden nicht nach außen gegeben', () => {
  const { shortages, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.confirmShortage(b, r.id);
  const list = shortages.listWithCounts(a);
  const row = list.find(s => s.wirkstoff === 'Ramipril');
  assert.equal(row.confirmations, undefined);
  assert.equal(row.confirm_count, 1);
});

test('resolveShortage: Melder:in setzt wieder lieferbar + benachrichtigt Beobachter & Bestätiger', () => {
  const { social, shortages, shortagesRepo, a, b, c } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.confirmShortage(b, r.id);           // b bestätigt
  shortagesRepo.addWatch(c, 'Ramipril');        // c beobachtet
  const u = shortages.resolveShortage(a, r.id);
  assert.equal(u.status, 'verfuegbar');
  assert.equal(social.notifications(b).filter(n => n.type === 'watch_alert').length, 1, 'Bestätiger informiert');
  assert.equal(social.notifications(c).filter(n => n.type === 'watch_alert').length, 1, 'Beobachter informiert');
  assert.equal(social.notifications(a).filter(n => n.type === 'watch_alert').length, 0, 'Auslöser nicht');
});

test('resolveShortage: nur Melder:in (oder Moderation) darf auflösen', () => {
  const { shortages, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  assert.throws(() => shortages.resolveShortage(b, r.id), /meldende Apotheke|Moderation/);
});

test('resolveShortage: nach Auflösung darf Wirkstoff neu gemeldet werden (kein Dupe-Block)', () => {
  const { shortages, a } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.resolveShortage(a, r.id);
  assert.doesNotThrow(() => shortages.reportShortage(a, { wirkstoff: 'Ramipril' }));
});

test('purgeUser: anonymisiert Melder und entfernt dessen Bestätigungen (DSGVO)', () => {
  const { shortages, shortagesRepo, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.confirmShortage(b, r.id);
  shortagesRepo.purgeUser(a); // Melder gelöscht
  shortagesRepo.purgeUser(b); // Bestätiger gelöscht
  const s = shortagesRepo.get(r.id);
  assert.equal(s.reporter_user_id, null);
  assert.equal(s.confirmations.length, 0);
});

test('Persistenz: reporter + confirmations überstehen __dump/__load', () => {
  const { shortages, shortagesRepo, a, b } = setup();
  const r = shortages.reportShortage(a, { wirkstoff: 'Ramipril' });
  shortages.confirmShortage(b, r.id);
  const fresh = createShortagesRepo({ seed: false });
  fresh.__load(shortagesRepo.__dump());
  const s = fresh.get(r.id);
  assert.equal(s.reporter_user_id, a);
  assert.deepEqual(s.confirmations, [b]);
});
