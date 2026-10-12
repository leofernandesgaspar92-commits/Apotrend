// Erfundene Startmeldungen verschwinden auch aus GESICHERTEN Beständen.
//
// Den Code, der sie anlegte, gibt es nicht mehr (reference-data.test.js prüft
// den Frischstart). Ein Bestand, der sie schon gespeichert hat, trüge sie aber
// weiter — in Render liegt der Zustand in der Datenbank und überlebt Deploys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { erfundeneStartmeldungenEntfernen, ERFUNDENE_STARTMELDUNGEN } from '../src/services/startbereinigung.js';

const BASG = 'BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika betroffen.';

function bestand() {
  const r = createSocialRepo();
  r.createProfile({ userId: 'red', handle: 'apopulse', displayName: 'Redaktion', isEditorial: true });
  r.createProfile({ userId: 'mensch', handle: 'mag_huber', displayName: 'Mag. Huber' });
  return r;
}

test('entfernt die erfundenen Redaktions-News — alle sechs', () => {
  const r = bestand();
  for (const body of ERFUNDENE_STARTMELDUNGEN) r.createPost({ authorUserId: 'red', body, kind: 'news', visibility: 'public', country: 'AT' });
  assert.equal(erfundeneStartmeldungenEntfernen(r), 6);
  assert.equal(r.listAllPosts().length, 0);
  assert.equal(erfundeneStartmeldungenEntfernen(r), 0, 'zweiter Lauf findet nichts mehr');
});

test('lässt alles andere stehen', () => {
  const r = bestand();
  const echt = r.createPost({ authorUserId: 'red', body: 'BASG: Rückruf Charge 123 (Link)', kind: 'news', visibility: 'public', country: 'AT' });
  const mensch = r.createPost({ authorUserId: 'mensch', body: BASG, kind: 'news', visibility: 'public', country: 'AT' });
  const beitrag = r.createPost({ authorUserId: 'red', body: BASG, kind: 'post', visibility: 'public', country: 'AT' });
  assert.equal(erfundeneStartmeldungenEntfernen(r), 0);
  const ids = r.listAllPosts().map((p) => p.id).sort();
  assert.deepEqual(ids, [echt.id, mensch.id, beitrag.id].sort(),
    'nur Redaktion + Art news + exakt einer der sechs Texte wird entfernt');
});
