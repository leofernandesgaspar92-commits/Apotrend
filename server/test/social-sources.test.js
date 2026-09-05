// ============================================================================
//  Amtliche Konten in sozialen Netzwerken — das Verifizierungs-Tor
// ============================================================================
//  Diese Datei prüft eine einzige Zusage, und zwar von beiden Seiten:
//  Ein Konto kommt NUR durch, wenn es nachweislich die amtliche Domain der
//  Behörde kontrolliert. Ein Konto, das lediglich so heißt und ein Logo trägt,
//  kommt nicht durch — auch nicht „fast".
//
//  Eine falsche Engpass- oder Rückrufmeldung mit Amtsanstrich ist der teuerste
//  denkbare Fehler dieser Plattform.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hostOf, isSameOrSubdomain, verifiedUrls, checkOfficial,
  postsFromMastodon, fetchMastodonSource,
} from '../src/services/socialSources.js';

const stumm = { warn() {}, log() {} };

/** Konto wie von Mastodon. `verified` steuert, ob der Nachweis vorliegt. */
const konto = ({ url = 'https://www.bfarm.de', verified = true, id = '42' } = {}) => ({
  id,
  acct: 'bfarm',
  fields: [
    { name: 'Web', value: `<a href="${url}" rel="me">${url}</a>`, verified_at: verified ? '2026-01-01T00:00:00Z' : null },
  ],
});

// ── Bausteine ───────────────────────────────────────────────────────────────

test('Host wird sauber ausgelesen, www entfällt', () => {
  assert.equal(hostOf('https://www.bfarm.de/irgendwas'), 'bfarm.de');
  assert.equal(hostOf('https://BFARM.de'), 'bfarm.de');
  assert.equal(hostOf('kein url'), null);
  assert.equal(hostOf(null), null);
});

test('DIE SICHERHEITSRELEVANTE STELLE: nicht-bfarm.de ist keine Unterdomain von bfarm.de', () => {
  // Ein naives endsWith() würde hier durchlassen — das wäre eine Lücke, keine
  // Bequemlichkeit: Wer „nicht-bfarm.de" registriert, gälte als BfArM.
  assert.equal(isSameOrSubdomain('nicht-bfarm.de', 'bfarm.de'), false);
  assert.equal(isSameOrSubdomain('bfarm.de.beispiel.com', 'bfarm.de'), false);
  // Echte Fälle:
  assert.equal(isSameOrSubdomain('bfarm.de', 'bfarm.de'), true);
  assert.equal(isSameOrSubdomain('www2.bfarm.de', 'bfarm.de'), true);
});

test('nur nachgewiesene Adressen werden gelesen', () => {
  const a = {
    fields: [
      { name: 'Echt', value: '<a href="https://bfarm.de">bfarm.de</a>', verified_at: '2026-01-01T00:00:00Z' },
      { name: 'Behauptet', value: '<a href="https://beispiel.test">beispiel.test</a>', verified_at: null },
    ],
  };
  assert.deepEqual(verifiedUrls(a), ['https://bfarm.de']);
});

// ── Das Tor ─────────────────────────────────────────────────────────────────

test('ein Konto mit nachgewiesener Behördendomain wird akzeptiert', () => {
  const b = checkOfficial(konto(), 'DE');
  assert.equal(b.ok, true);
  assert.equal(b.domain, 'bfarm.de');
  assert.equal(b.regulator, 'BfArM');
});

test('ohne Nachweis kein Durchkommen — auch wenn die Adresse stimmt', () => {
  // Das Konto TRÄGT bfarm.de im Profil, hat es aber nicht nachgewiesen.
  // Genau so sähe ein Nachahmer aus.
  const b = checkOfficial(konto({ verified: false }), 'DE');
  assert.equal(b.ok, false);
  assert.match(b.reason, /keine nachgewiesene Adresse/);
});

test('nachgewiesen, aber die FALSCHE Domain — abgelehnt mit Begründung', () => {
  const b = checkOfficial(konto({ url: 'https://mein-pharma-blog.example' }), 'DE');
  assert.equal(b.ok, false);
  assert.match(b.reason, /mein-pharma-blog\.example/);
  assert.match(b.reason, /bfarm\.de/, 'die Begründung muss sagen, was erwartet wurde');
});

test('ist für ein Land keine amtliche Domain hinterlegt, wird NICHT durchgewunken', () => {
  // Für AO/MZ steht im Länder-Register bewusst null, weil die offizielle
  // Domain nicht belegt ist. Ohne Bezugspunkt lässt sich nichts prüfen — und
  // ungeprüft durchzulassen wäre das Gegenteil des Auftrags.
  const b = checkOfficial(konto({ url: 'https://armed.gov.ao' }), 'AO');
  assert.equal(b.ok, false);
  assert.match(b.reason, /keine amtliche Domain/);
});

test('unbekanntes Land wird abgelehnt', () => {
  assert.equal(checkOfficial(konto(), 'XX').ok, false);
});

// ── Beiträge ────────────────────────────────────────────────────────────────

const src = { id: 'bfarm_mastodon', label: 'BfArM (Mastodon)', country: 'DE' };

test('Weiterleitungen, Antworten und nicht-öffentliche Beiträge kommen nicht in den Feed', () => {
  const posts = postsFromMastodon([
    { id: '1', url: 'https://s/1', content: '<p>Echte Meldung</p>', visibility: 'public', created_at: '2026-08-01T00:00:00Z' },
    // Weitergeleitet: Der Ursprung gehört einer anderen Stelle, deren
    // Identität hier NICHT geprüft ist.
    { id: '2', url: 'https://s/2', content: '<p>Geteilt</p>', visibility: 'public', reblog: { id: 'x' } },
    { id: '3', url: 'https://s/3', content: '<p>Antwort</p>', visibility: 'public', in_reply_to_id: '1' },
    { id: '4', url: 'https://s/4', content: '<p>Nur Follower</p>', visibility: 'private' },
  ], { source: src });

  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, 'Echte Meldung');
  assert.equal(posts[0].country, 'DE');
  assert.equal(posts[0].official, true);
});

test('HTML wird entfernt, ohne aus kodierten Klammern echte zu machen', () => {
  const [p] = postsFromMastodon([
    { id: '1', url: 'https://s/1', visibility: 'public',
      content: '<p>Charge A &amp;amp; B betroffen &amp;lt;script&amp;gt;</p>' },
  ], { source: src });
  assert.match(p.summary, /Charge A & B betroffen/);
  assert.ok(!p.summary.includes('<script'), 'kein echtes Tag entstanden');
});

test('ein Beitrag ohne Rückverweis wird verworfen', () => {
  // Ohne Link wäre es eine Behauptung mit Amtsanstrich — dieselbe Regel wie
  // bei den Behörden-Feeds.
  const posts = postsFromMastodon([{ id: '1', content: '<p>Ohne Link</p>', visibility: 'public' }], { source: src });
  assert.equal(posts.length, 0);
});

// ── Abruf ───────────────────────────────────────────────────────────────────

test('DER KERNFALL: bei fehlendem Nachweis werden Beiträge GAR NICHT erst geholt', async () => {
  const angefragt = [];
  const res = await fetchMastodonSource(
    { id: 'x', url: 'https://social.example', account: '@bfarm', country: 'DE' },
    {
      fetchJson: async (u) => { angefragt.push(u); return konto({ verified: false }); },
      log: stumm,
    },
  );
  assert.equal(res.verified, false);
  assert.deepEqual(res.items, []);
  assert.equal(angefragt.length, 1, 'nur die Kontoabfrage — keine Beiträge geladen');
  assert.match(angefragt[0], /accounts\/lookup/);
});

test('mit Nachweis werden die Beiträge geholt', async () => {
  const angefragt = [];
  const res = await fetchMastodonSource(
    { id: 'x', url: 'https://social.example', account: 'bfarm', country: 'DE', label: 'BfArM' },
    {
      fetchJson: async (u) => {
        angefragt.push(u);
        if (u.includes('lookup')) return konto();
        return [{ id: '1', url: 'https://s/1', content: '<p>Rückruf</p>', visibility: 'public', created_at: '2026-08-01T00:00:00Z' }];
      },
      log: stumm,
    },
  );
  assert.equal(res.verified, true);
  assert.equal(res.regulator, 'BfArM');
  assert.equal(res.items.length, 1);
  assert.equal(angefragt.length, 2);
});

test('eine unvollständige Quelle wirft mit klarer Ansage', async () => {
  await assert.rejects(
    () => fetchMastodonSource({ id: 'x', url: 'https://social.example', country: 'DE' }, { fetchJson: async () => ({}) }),
    /Server und Konto/,
  );
});
