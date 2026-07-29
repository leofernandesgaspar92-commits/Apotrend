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
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { social, a: A.user.id };
}

test('Profil bearbeiten: Anzeigename, Titel, Bio, Fachgebiete werden übernommen', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { displayName: 'Dr. Anna Huber', title: 'Fachapothekerin', bio: 'Onkologie-Schwerpunkt in Wien.', specializations: 'Onkologie, Diabetes , ,Impfen' });
  assert.equal(p.display_name, 'Dr. Anna Huber');
  assert.equal(p.title, 'Fachapothekerin');
  assert.equal(p.bio, 'Onkologie-Schwerpunkt in Wien.');
  assert.deepEqual(p.specializations, ['Onkologie', 'Diabetes', 'Impfen']); // leere getrimmt
  // Handle bleibt unverändert
  assert.equal(p.handle, 'anna');
});

test('Profil bearbeiten: leerer Anzeigename wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.updateProfile(a, { displayName: '   ' }), /Anzeigename/);
});

test('Profil bearbeiten: zu lange Bio wird abgelehnt', () => {
  const { social, a } = setup();
  assert.throws(() => social.updateProfile(a, { bio: 'x'.repeat(501) }), /zu lang/);
});

test('Profil bearbeiten: leere Felder löschen Titel/Bio (null)', () => {
  const { social, a } = setup();
  social.updateProfile(a, { title: 'X', bio: 'Y' });
  const p = social.updateProfile(a, { title: '', bio: '' });
  assert.equal(p.title, null);
  assert.equal(p.bio, null);
});

test('Profil bearbeiten: Profilbild wird gesetzt, geleert (null) und ungültiges Format abgelehnt', () => {
  const { social, a } = setup();
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const p = social.updateProfile(a, { avatarUrl: png });
  assert.equal(p.avatar_url, png);
  // Feed-Autor trägt das Avatar mit (für Karten-Anzeige).
  const post = social.createPost(a, { body: 'Hallo', visibility: 'public' });
  const dec = social.profilePage(a, 'anna').posts.find(x => x.id === post.id);
  assert.equal(dec.author.avatar_url, png);
  // Leerer String entfernt das Bild.
  const cleared = social.updateProfile(a, { avatarUrl: '' });
  assert.equal(cleared.avatar_url, null);
  // Fremd-URL / Nicht-Bild wird abgelehnt.
  assert.throws(() => social.updateProfile(a, { avatarUrl: 'https://evil.example/x.png' }), /Bildformat/);
});

test('Profil bearbeiten: Titelbild + Website werden gesetzt, geleert und validiert', () => {
  const { social, a } = setup();
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const p = social.updateProfile(a, { coverUrl: png, website: 'https://apotrend.at' });
  assert.equal(p.cover_url, png);
  assert.equal(p.website, 'https://apotrend.at');
  // Leeren entfernt beide.
  const cleared = social.updateProfile(a, { coverUrl: '', website: '' });
  assert.equal(cleared.cover_url, null);
  assert.equal(cleared.website, null);
  // Ungültiges Titelbild-Format wird abgelehnt.
  assert.throws(() => social.updateProfile(a, { coverUrl: 'https://evil.example/x.png' }), /Bildformat/);
  // Nicht-http(s)-Website wird abgelehnt.
  assert.throws(() => social.updateProfile(a, { website: 'javascript:alert(1)' }), /http/);
});

test('Profil bearbeiten: Werdegang wird gesetzt, leere Stationen verworfen, Rolle Pflicht, gekappt', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { experience: [
    { role: 'Filialleiterin', org: 'Bahnhof-Apotheke', from: '2018', to: 'heute', description: 'Leitung Team' },
    { role: '', org: 'Ignoriert' }, // ohne Rolle -> verworfen
    { role: '  Pharmareferent  ', org: '  Pharma AG  ' }, // getrimmt
  ] });
  assert.equal(p.experience.length, 2);
  assert.equal(p.experience[0].role, 'Filialleiterin');
  assert.equal(p.experience[0].org, 'Bahnhof-Apotheke');
  assert.equal(p.experience[1].role, 'Pharmareferent');
  assert.equal(p.experience[1].org, 'Pharma AG');
  // Überlange Beschreibung wird gekappt (<=300).
  const long = social.updateProfile(a, { experience: [{ role: 'X', description: 'y'.repeat(400) }] });
  assert.equal(long.experience[0].description.length, 300);
  // Mehr als 20 Stationen werden gekappt.
  const many = social.updateProfile(a, { experience: Array.from({ length: 25 }, (_, i) => ({ role: 'R' + i })) });
  assert.equal(many.experience.length, 20);
  // Werdegang übersteht dump/load.
  assert.deepEqual(social.getProfile('anna').experience, many.experience);
});

test('Profil bearbeiten: gültiges Bundesland wird gesetzt, ungültiges abgelehnt', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { bundesland: 'Wien' });
  assert.equal(p.bundesland, 'Wien');
  assert.throws(() => social.updateProfile(a, { bundesland: 'Bayern' }), /Bundesland/);
  const cleared = social.updateProfile(a, { bundesland: '' });
  assert.equal(cleared.bundesland, null);
});
