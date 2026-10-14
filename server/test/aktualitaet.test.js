// Aktualität von Apotheken-Meldungen: nach 14 Tagen ohne Bestätigung
// „noch aktuell?", nach 30 Tagen „veraltet" (nicht mehr gezählt, nicht mehr
// „bestätigt", nicht in Schnittstelle/Teilseiten). In Ländern, die fast nur
// Apotheken-Meldungen haben, darf eine alte Meldung nicht wie eine neue aussehen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createShortagesService, aktualitaet, PRUEFEN_NACH_TAGEN, VERALTET_NACH_TAGEN } from '../src/services/shortages.js';
import { regionLage } from '../src/services/regionLage.js';
import { COUNTRIES, laenderInRegion } from '../src/data/countries.js';

const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

test('Stufen: aktuell, noch aktuell?, veraltet — amtliche Zeilen immer aktuell', () => {
  const d0 = '2026-10-01';
  const z = (extra) => ({ provenance: 'community', status: 'kritisch', gemeldet_am: d0, ...extra });
  assert.equal(aktualitaet(z(), plus(d0, PRUEFEN_NACH_TAGEN - 1)).stufe, 'aktuell');
  assert.equal(aktualitaet(z(), plus(d0, PRUEFEN_NACH_TAGEN)).stufe, 'pruefen');
  assert.equal(aktualitaet(z(), plus(d0, VERALTET_NACH_TAGEN)).stufe, 'veraltet');
  // Eine Bestätigung frischt auf.
  assert.equal(aktualitaet(z({ zuletzt_aktiv: plus(d0, 20) }), plus(d0, 31)).stufe, 'aktuell');
  assert.equal(aktualitaet({ provenance: 'verified', status: 'kritisch', gemeldet_am: d0 }, plus(d0, 400)).stufe, 'aktuell');
  assert.equal(aktualitaet(z({ status: 'verfuegbar' }), plus(d0, 400)).stufe, 'aktuell');
});

function aufbau() {
  let tag = new Date().toISOString().slice(0, 10);
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const svc = createShortagesService(shortagesRepo, social, { today: () => tag });
  const anlegen = (name, country) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: name.replace(/\W/g, '') + '@ak.test', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle: name.replace(/\W/g, '').toLowerCase(), displayName: name, country, accountType: 'pharmacy' });
    return r.user.id;
  };
  return { svc, shortagesRepo, social, anlegen, vor: (n) => { tag = plus(tag, n); }, heute: () => tag };
}

test('Ablauf: Erinnerung einmal, „Still short" frischt auf, nach 30 Tagen veraltet und nicht mehr gezählt', () => {
  const { svc, shortagesRepo, social, anlegen, vor, heute } = aufbau();
  const a = anlegen('Apo A', 'UG'); const b = anlegen('Apo B', 'UG'); const c = anlegen('Apo C', 'UG'); const d = anlegen('Apo D', 'UG');
  const m = svc.reportShortage(a, { wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhaler', status: 'kritisch', country: 'UG' });
  svc.confirmShortage(b, m.id); svc.confirmShortage(c, m.id);
  const zeile = (uid) => svc.listWithCounts(uid, { country: 'UG' }).find((s) => s.id === m.id) || svc.listWithCounts(uid).find((s) => s.id === m.id);
  assert.deepEqual([zeile(d).aktualitaet, zeile(d).bestaetigt], ['aktuell', true]);

  vor(PRUEFEN_NACH_TAGEN + 1);
  assert.equal(zeile(d).aktualitaet, 'pruefen');
  assert.equal(svc.erinnern(), 1, 'Meldende nicht erinnert');
  assert.equal(svc.erinnern(), 0, 'Erinnerung doppelt');
  assert.ok(social.notifications(a).some((n) => n.type === 'shortage_noch_aktuell'));

  // Eine andere Apotheke sagt „Still short": aufgefrischt und mitgezählt.
  const nach = svc.nochAktuell(d, m.id);
  assert.deepEqual([nach.aktualitaet, nach.apotheken], ['aktuell', 4]);

  vor(VERALTET_NACH_TAGEN + 1);
  const alt = zeile(d);
  assert.deepEqual([alt.aktualitaet, alt.bestaetigt], ['veraltet', false], 'veraltete Meldung weiter als bestätigt');
  const lage = regionLage({ shortagesRepo, chronik: { aufzeichnungSeit: () => null }, laender: COUNTRIES, codes: laenderInRegion('AFRICA'), heute: heute() });
  assert.equal(lage.laender.find((l) => l.land === 'UG').apotheken, 0, 'veraltete Meldung in der Engpasslage gezählt');
});

test('„Wieder lieferbar": nur wer gemeldet oder bestätigt hat; Beobachter:innen im Land erfahren es', () => {
  const { svc, social, anlegen } = aufbau();
  const a = anlegen('Apo A', 'TZ'); const b = anlegen('Apo B', 'TZ'); const fremd = anlegen('Apo X', 'TZ'); const beob = anlegen('Beob', 'TZ');
  svc.watch(beob, 'Oxytocin');
  const m = svc.reportShortage(a, { wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'TZ' });
  svc.confirmShortage(b, m.id);
  assert.throws(() => svc.wiederLieferbar(fremd, m.id), (e) => e.status === 403);
  const r = svc.wiederLieferbar(b, m.id);
  assert.equal(r.status, 'verfuegbar');
  assert.ok(social.notifications(beob).some((n) => n.type === 'watch_alert' && /Wieder verfügbar/.test(n.label)));
  assert.throws(() => svc.nochAktuell(a, m.id), (e) => e.status === 409, 'erledigte Meldung aufgefrischt');
});
