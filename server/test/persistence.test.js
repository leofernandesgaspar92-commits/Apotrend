import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPersistence } from '../src/repo/persistence.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'apo-persist-')), 'data.json');
}

test('createPersistence: ohne Pfad -> null (reines In-Memory)', () => {
  assert.equal(createPersistence(null), null);
  assert.equal(createPersistence(''), null);
});

test('Persistenz: save/load ist verlustfrei (Round-Trip beliebiger Snapshot)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  const snapshot = {
    foundation: { users: [{ id: 'u1', email: 'a@a.at' }] },
    social: { profiles: [{ user_id: 'u1', handle: 'anna', account_type: 'pharma' }], posts: [] },
    shortages: { items: [{ id: 's1', wirkstoff: 'Ramipril', umlaut: 'Ä Ö Ü ß' }] },
    prices: {}, rabatte: {}, exchange: { entries: [] },
  };
  p.save(snapshot);
  assert.deepEqual(p.load(), snapshot, 'geladener Stand == gespeicherter Stand');
});

test('Persistenz: fehlende/kaputte Datei -> load() gibt null (Frischstart)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  assert.equal(p.load(), null, 'noch nichts gespeichert');
  fs.writeFileSync(fp, '{ kaputt json');
  assert.equal(p.load(), null, 'unparsbarer Inhalt -> null statt Absturz');
});

test('Persistenz: save ist atomar (keine zurückbleibende .tmp-Datei; letzter Stand gewinnt)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  p.save({ n: 1 });
  p.save({ n: 2 });
  assert.equal(p.load().n, 2);
  assert.equal(fs.existsSync(fp + '.tmp'), false, 'keine übrig gebliebene temp-Datei');
});

// Voller Persistenz-Pfad mit echten Daten: Repos -> __dump -> JSON (wie auf Platte)
// -> __load in FRISCHE Repos. Deckt die Lücke, die der reine File-Layer-Test lässt
// (dort ist der Snapshot generisch): fängt Feld-Verluste in einzelnen Repo-__dump/__load.
test('Persistenz-Integration: echte Social-Daten überleben dump -> JSON -> load in frische Repos', async () => {
  const { createMemoryRepo } = await import('../src/repo/memoryRepo.js');
  const { createSocialRepo } = await import('../src/repo/socialRepo.js');
  const { createOrgAuthService } = await import('../src/services/orgAuth.js');
  const { createSocialService } = await import('../src/services/social.js');

  const repo = createMemoryRepo();
  const socialRepo = createSocialRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(socialRepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Bo', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  social.createProfile(B.user.id, { handle: 'bob', displayName: 'Bo' });
  const post = social.createPost(A.user.id, { body: 'ROUNDTRIP-Beitrag', visibility: 'public' });
  social.follow(B.user.id, A.user.id);
  social.toggleBookmark(B.user.id, post.id);

  // Snapshot einsammeln + durch JSON schicken (exakt wie die Datei-Persistenz).
  const snapshot = JSON.parse(JSON.stringify({ foundation: repo.__dump(), social: socialRepo.__dump() }));

  // In frische Repos laden.
  const repo2 = createMemoryRepo();
  const socialRepo2 = createSocialRepo();
  repo2.__load(snapshot.foundation);
  socialRepo2.__load(snapshot.social);

  // Daten sind intakt: Nutzer, Profil, Beitrag, Follow, Bookmark.
  assert.ok(repo2.getUserById(A.user.id), 'Nutzer A wiederhergestellt');
  assert.equal(socialRepo2.getProfileByUserId(A.user.id).handle, 'anna', 'Profil wiederhergestellt');
  assert.equal(socialRepo2.getPost(post.id).body, 'ROUNDTRIP-Beitrag', 'Beitrag wiederhergestellt');
  assert.ok(socialRepo2.isFollowing(B.user.id, A.user.id), 'Follow wiederhergestellt');
  assert.ok(socialRepo2.isBookmarked(B.user.id, post.id), 'Bookmark wiederhergestellt');
});

// ── Wer warnt hier eigentlich? ───────────────────────────────────────────────
// Hintergrund: Am 05.09.2026 liefen zwei Render-Dienste vom selben Branch.
// Einer hatte die Datenbank, der andere die Kundendomain. Beide Protokolle
// sahen für sich plausibel aus; erst das Nebeneinanderlegen zeigte, dass der
// Dienst OHNE Datenbank die echte Adresse beantwortete. Eine Warnung, die
// nicht sagt WER warnt, ist bei mehreren Diensten wertlos.

import { dienstKennung } from '../src/http/serviceIdentity.js';

test('die Dienst-Kennung nennt Name und öffentliche Adresse', () => {
  assert.equal(
    dienstKennung({ RENDER_SERVICE_NAME: 'apotrend-feed', RENDER_EXTERNAL_URL: 'https://www.apopulse.com' }),
    ' [Dienst: apotrend-feed — https://www.apopulse.com]',
  );
});

test('die Dienst-Kennung bleibt leer, wo Render nichts setzt', () => {
  // Lokal und in Tests darf die Meldung nicht mit leeren Klammern enden.
  assert.equal(dienstKennung({}), '');
});

test('die Dienst-Kennung kommt auch mit nur einer der beiden Angaben aus', () => {
  assert.equal(dienstKennung({ RENDER_EXTERNAL_URL: 'https://x.onrender.com' }),
    ' [Dienst: unbenannt — https://x.onrender.com]');
  assert.equal(dienstKennung({ RENDER_SERVICE_NAME: 'nur-name' }), ' [Dienst: nur-name]');
});
