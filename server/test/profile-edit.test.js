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

test('Profil bearbeiten: Aus- & Weiterbildung setzen, ohne Abschluss verwerfen, kappen, dump/load', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { education: [
    { degree: 'Mag. pharm.', school: 'Universität Wien', year: '2015' },
    { degree: '', school: 'Ignoriert' },
    { degree: '  Fachapothekerin  ', school: '  ÖAK  ', year: '  2019  ' },
  ] });
  assert.equal(p.education.length, 2);
  assert.equal(p.education[0].degree, 'Mag. pharm.');
  assert.equal(p.education[1].degree, 'Fachapothekerin');
  assert.equal(p.education[1].school, 'ÖAK');
  const many = social.updateProfile(a, { education: Array.from({ length: 25 }, (_, i) => ({ degree: 'D' + i })) });
  assert.equal(many.education.length, 20);
  assert.deepEqual(social.getProfile('anna').education, many.education);
});

test('Profil bearbeiten: „Offen für" nimmt nur bekannte Schlüssel, dedupliziert', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { openTo: ['kooperation', 'jobs', 'kooperation', 'unbekannt', 'einkauf'] });
  assert.deepEqual(p.open_to, ['kooperation', 'jobs', 'einkauf']); // dedupe + Reihenfolge, Müll raus
  // Leeren
  const cleared = social.updateProfile(a, { openTo: [] });
  assert.deepEqual(cleared.open_to, []);
  // dump/load
  const set = social.updateProfile(a, { openTo: ['mentoring'] });
  assert.deepEqual(social.getProfile('anna').open_to, set.open_to);
});

test('Profil-Besuche: Fremdbesuch wird protokolliert, nur Eigentümer sieht Besucher, dedupliziert, dump/load', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const srepo = createSocialRepo();
  const social = createSocialService(srepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });

  // Ben besucht Annas Profil zweimal -> ein Besucher (dedupliziert)
  social.profilePage(B.user.id, 'anna');
  social.profilePage(B.user.id, 'anna');
  // Fremde Sicht (Ben) enthält KEINE Besucherliste
  const benView = social.profilePage(B.user.id, 'anna');
  assert.equal(benView.viewers, null);
  // Anna sieht ihre Besucher (nur Ben, dedupliziert)
  const annaView = social.profilePage(A.user.id, 'anna');
  assert.equal(annaView.viewer_count, 1);
  assert.deepEqual(annaView.viewers.map(v => v.handle), ['ben']);
  // Eigener Besuch zählt nicht
  assert.equal(social.profilePage(A.user.id, 'anna').viewer_count, 1);
  // dump/load: Besuche überstehen Round-Trip
  const srepo2 = createSocialRepo(); srepo2.__load(srepo.__dump());
  const social2 = createSocialService(srepo2, repo);
  assert.equal(social2.profilePage(A.user.id, 'anna').viewer_count, 1);
});

test('Fachgebiet-Bestätigung: umschalten, Zähler, nicht selbst, nur echte Fachgebiete, Benachrichtigung, dump/load', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const srepo = createSocialRepo();
  const social = createSocialService(srepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  social.updateProfile(A.user.id, { specializations: 'Onkologie, Impfen' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });

  // Ben bestätigt Annas „Onkologie"
  const r1 = social.endorseSkill(B.user.id, 'anna', 'Onkologie');
  assert.deepEqual(r1, { skill: 'Onkologie', count: 1, mine: true });
  // Benachrichtigung an Anna
  assert.ok(social.notifications(A.user.id).some(n => n.type === 'endorsement' && n.label === 'Onkologie'));
  // Profilseite zeigt Zähler + mine (aus Bens Sicht)
  const page = social.profilePage(B.user.id, 'anna');
  assert.equal(page.endorsements['Onkologie'].count, 1);
  assert.equal(page.endorsements['Onkologie'].mine, true);
  assert.equal(page.endorsements['Impfen'].count, 0);
  // Umschalten (zurücknehmen)
  const r2 = social.endorseSkill(B.user.id, 'anna', 'Onkologie');
  assert.deepEqual(r2, { skill: 'Onkologie', count: 0, mine: false });
  // Eigenes Fachgebiet nicht bestätigbar; unbekanntes Fachgebiet abgelehnt
  social.endorseSkill(B.user.id, 'anna', 'Onkologie'); // wieder an, für dump/load
  assert.throws(() => social.endorseSkill(A.user.id, 'anna', 'Onkologie'), /bestätigen/);
  assert.throws(() => social.endorseSkill(B.user.id, 'anna', 'Kardiologie'), /Fachgebiet/);
  // dump/load: Bestätigung übersteht Round-Trip
  const srepo2 = createSocialRepo(); srepo2.__load(srepo.__dump());
  const social2 = createSocialService(srepo2, repo);
  assert.equal(social2.profilePage(B.user.id, 'anna').endorsements['Onkologie'].count, 1);
});

test('„Offen für"-Entdecken: findet passende Kolleg:innen, nicht sich selbst, unbekannte Kategorie abgelehnt', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  social.updateProfile(A.user.id, { openTo: ['kooperation', 'einkauf'] });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  social.updateProfile(B.user.id, { openTo: ['kooperation'] });
  const found = social.discoverByOpenTo(A.user.id, 'kooperation');
  assert.equal(found.key, 'kooperation');
  assert.deepEqual(found.people.map(p => p.handle), ['ben']); // nur Ben, nicht man selbst
  // Kategorie, für die nur man selbst offen ist -> leer
  assert.equal(social.discoverByOpenTo(A.user.id, 'einkauf').people.length, 0);
  assert.throws(() => social.discoverByOpenTo(A.user.id, 'quatsch'), /Offen für/);
});

test('Profil bearbeiten: öffentliche Kontaktdaten setzen/leeren/validieren', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { publicEmail: 'kontakt@apo.at', phone: '+43 1 234567' });
  assert.equal(p.public_email, 'kontakt@apo.at');
  assert.equal(p.phone, '+43 1 234567');
  const cleared = social.updateProfile(a, { publicEmail: '', phone: '' });
  assert.equal(cleared.public_email, null);
  assert.equal(cleared.phone, null);
  assert.throws(() => social.updateProfile(a, { publicEmail: 'keine-mail' }), /E-Mail/);
  assert.throws(() => social.updateProfile(a, { phone: 'abc<script>' }), /Telefon/);
});

test('Profil bearbeiten: gültiges Bundesland wird gesetzt, ungültiges abgelehnt', () => {
  const { social, a } = setup();
  const p = social.updateProfile(a, { bundesland: 'Wien' });
  assert.equal(p.bundesland, 'Wien');
  assert.throws(() => social.updateProfile(a, { bundesland: 'Bayern' }), /Bundesland/);
  const cleared = social.updateProfile(a, { bundesland: '' });
  assert.equal(cleared.bundesland, null);
});
