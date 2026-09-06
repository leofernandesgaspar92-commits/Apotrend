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
  const shortages = createShortagesService(createShortagesRepo(), social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { social, shortages, a: A.user.id, b: B.user.id };
}

test('watchMany: mehrere Wirkstoffe auf einmal, getrennt + dedupliziert', () => {
  const { shortages, a } = setup();
  const items = shortages.watchMany(a, 'Amoxicillin, Ibuprofen; Metformin\nAmoxicillin');
  const names = items.map(i => i.wirkstoff.toLowerCase());
  assert.ok(names.includes('amoxicillin') && names.includes('ibuprofen') && names.includes('metformin'));
  assert.equal(names.filter(n => n === 'amoxicillin').length, 1, 'kein Duplikat');
  // Array-Eingabe funktioniert ebenso; leere/zu lange Einträge werden ignoriert
  const items2 = shortages.watchMany(a, ['Ramipril', '  ', 'x'.repeat(200)]);
  assert.ok(items2.some(i => i.wirkstoff === 'Ramipril'));
  // Nichts Gültiges -> Fehler
  assert.throws(() => shortages.watchMany(a, ' , ; '), /gültig|watch_none|Wirkstoff/);
});

test('Engpass-Liste: Referenzdaten mit Herkunfts-Flag, kritisch zuerst', () => {
  const { shortages } = setup();
  const list = shortages.list();
  assert.ok(list.length >= 5);
  assert.equal(list[0].status, 'kritisch');       // kritisch oben
  assert.equal(list[0].provenance, 'reference');   // ehrlich gekennzeichnet
  assert.ok(list.every(s => ['verified', 'reference', 'simulated'].includes(s.provenance)));
});

test('Aus Engpass heraus posten -> Beitrag referenziert den Engpass', () => {
  const { shortages, a } = setup();
  const s = shortages.list()[0];
  const post = shortages.postAbout(a, s.id, { body: 'Wir haben noch 3 Packungen zum Tausch.' });
  assert.equal(post.ref_type, 'shortage');
  assert.equal(post.ref_id, s.id);
});

test('"X Apotheker haben dazu gepostet": Aktivität am Engpass', () => {
  const { shortages, a, b } = setup();
  const s = shortages.list()[0];
  shortages.postAbout(a, s.id, { body: 'Bei uns aus.' });
  shortages.postAbout(b, s.id, { body: 'Alternativpräparat vorhanden.' });

  const act = shortages.withActivity(a, s.id);
  assert.equal(act.post_count, 2);
  assert.equal(act.shortage.id, s.id);

  // Liste mit Zähler
  const withCounts = shortages.listWithCounts(a);
  assert.equal(withCounts.find(x => x.id === s.id).post_count, 2);
});

test('Sichtbarkeit gilt auch bei Engpass-Aktivität: followers-Post zählt nicht für Fremde', () => {
  const { shortages, a, b } = setup();
  const s = shortages.list()[0];
  shortages.postAbout(a, s.id, { body: 'nur meine Follower', visibility: 'followers' });
  // Ben folgt Anna nicht -> sieht/zählt den Beitrag nicht
  assert.equal(shortages.withActivity(b, s.id).post_count, 0);
  // Anna selbst sieht ihn
  assert.equal(shortages.withActivity(a, s.id).post_count, 1);
});

test('Posten zu unbekanntem Engpass wird abgelehnt', () => {
  const { shortages, a } = setup();
  assert.throws(() => shortages.postAbout(a, 'gibt-es-nicht', { body: 'x' }), /nicht gefunden/);
});

// ── Engpässe gehören zu einem Land ──────────────────────────────────────────
// Befund vom 06.09.2026: /api/shortages filterte gar nicht nach Land. Eine
// Apotheke in Nairobi sah österreichische Referenzdaten („Levothyroxin 100 µg,
// kritisch") als IHRE Engpässe — korrekt als Referenzdaten gekennzeichnet und
// trotzdem im falschen Land. Auf Engpassangaben hin wird umbestellt; das ist
// die eine Stelle, an der eine plausible Falschanzeige teuer wird.

test('die Referenzdaten gehören nach Österreich — und nur dorthin', () => {
  const repo = createShortagesRepo();
  const alle = repo.list();
  assert.ok(alle.length > 0, 'ohne Referenzdaten prüft dieser Test nichts');
  assert.ok(alle.every((s) => s.country === 'AT'),
    'jede Referenzzeile trägt AT: ' + alle.map((s) => `${s.bezeichnung}=${s.country}`).join(', '));
  assert.equal(repo.list({ country: 'AT' }).length, alle.length);
  assert.equal(repo.list({ country: 'KE' }).length, 0, 'Kenia darf keine AT-Referenzdaten sehen');
});

test('eine Zeile ohne Land gilt überall', () => {
  // „Kein Land" heißt ausdrücklich „gilt überall" und ist erlaubt. Ohne diese
  // Regel verschwände ein bewusst länderloser Eintrag stillschweigend.
  const repo = createShortagesRepo({ seed: false });
  repo.upsert({ wirkstoff: 'Weltweit', bezeichnung: 'Weltweit 1 mg', status: 'kritisch', country: null });
  assert.equal(repo.list({ country: 'KE' }).length, 1);
  assert.equal(repo.list({ country: 'AT' }).length, 1);
});

test('ohne Länderangabe bleibt alles sichtbar', () => {
  // Die Entscheidung, wer filtert, liegt beim Aufrufer — die Wirkstoff-
  // Detailseite darf auch über Ländergrenzen schauen.
  const repo = createShortagesRepo({ seed: false });
  repo.upsert({ wirkstoff: 'A', bezeichnung: 'A', status: 'kritisch', country: 'AT' });
  repo.upsert({ wirkstoff: 'B', bezeichnung: 'B', status: 'kritisch', country: 'KE' });
  assert.equal(repo.list().length, 2);
});

test('das Land wird normalisiert, nicht roh übernommen', () => {
  const repo = createShortagesRepo({ seed: false });
  const r = repo.upsert({ wirkstoff: 'A', bezeichnung: 'A', status: 'kritisch', country: 'ke' });
  assert.equal(r.country, 'KE');
  assert.equal(repo.list({ country: 'KE' }).length, 1);
  // Ein leerer String ist kein Land, sondern „überall" — sonst entstünde ein
  // Eintrag, den kein Länderfilter je findet.
  const leer = repo.upsert({ wirkstoff: 'B', bezeichnung: 'B', status: 'kritisch', country: '' });
  assert.equal(leer.country, null);
});
