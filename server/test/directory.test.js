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
  const mk = (handle, email, accountType, country = 'AT', extra = {}) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: handle }, owner: { name: handle, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: handle, accountType, country, ...extra });
    return r.user.id;
  };
  const meApo = mk('meine_apo', 'me@a.at', 'pharmacy', 'AT');
  mk('bayer', 'b@a.at', 'pharma', 'AT', { title: 'Antibiotika-Hersteller' });
  mk('sandoz', 's@a.at', 'pharma', 'AT');
  mk('basg', 'x@a.at', 'authority', 'AT');
  mk('deutsche_pharma', 'd@a.de', 'pharma', 'DE'); // anderes Land -> nicht sichtbar
  mk('privat', 'p@a.at', 'private', 'AT');          // Privat -> nicht im Fachverzeichnis
  return { repo, social, meApo };
}

test('Verzeichnis: Zähler je Kontotyp im eigenen Land (ohne sich selbst)', () => {
  const { social, meApo } = setup();
  const c = social.directoryCounts(meApo);
  assert.equal(c.counts.pharma, 2, 'bayer + sandoz (AT)');
  assert.equal(c.counts.authority, 1);
  assert.equal(c.counts.pharmacy, 0, 'nur meine_apo (self) ist Apotheke -> 0');
  assert.equal(c.country, 'AT');
});

test('Verzeichnis: Liste nach Typ, länderbeschränkt, Privat ausgeschlossen', () => {
  const { social, meApo } = setup();
  const pharma = social.directory(meApo, 'pharma');
  const handles = pharma.people.map(p => p.handle).sort();
  assert.deepEqual(handles, ['bayer', 'sandoz'], 'nur AT-Pharma, kein DE');
  // Privat ist kein gültiger Verzeichnistyp
  assert.throws(() => social.directory(meApo, 'private'), /Kontotyp/);
});

test('Verzeichnis: Suche filtert nach Name/Fachgebiet', () => {
  const { social, meApo } = setup();
  const res = social.directory(meApo, 'pharma', { q: 'antibiotika' });
  assert.equal(res.people.length, 1);
  assert.equal(res.people[0].handle, 'bayer');
});

test('Verzeichnis: is_following spiegelt Beziehung', () => {
  const { social, meApo } = setup();
  const bayer = social.getProfile('bayer');
  social.follow(meApo, bayer.user_id);
  const res = social.directory(meApo, 'pharma');
  assert.equal(res.people.find(p => p.handle === 'bayer').is_following, true);
  assert.equal(res.people.find(p => p.handle === 'sandoz').is_following, false);
});
