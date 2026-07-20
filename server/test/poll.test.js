import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

// Drei Apotheker-Personen + Social-Service (wie in social.test.js).
function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);

  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo A' }, owner: { name: 'Anna Huber', email: 'anna@a.at', password: 'geheim123' } });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo B' }, owner: { name: 'Ben Mayer', email: 'ben@b.at', password: 'geheim123' } });
  const C = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo C' }, owner: { name: 'Cem Yildiz', email: 'cem@c.at', password: 'geheim123' } });
  const a = A.user.id, b = B.user.id, c = C.user.id;
  social.createProfile(a, { handle: 'anna', displayName: 'Anna Huber', title: 'Apothekerin' });
  social.createProfile(b, { handle: 'ben', displayName: 'Ben Mayer', title: 'Apotheker' });
  social.createProfile(c, { handle: 'cem', displayName: 'Cem Yildiz', title: 'Apotheker' });
  return { social, socialRepo, a, b, c };
}

function makePoll(social, uid, question = 'Welcher Wirkstoff ist knapp?', options = ['Amoxicillin', 'Cefuroxim', 'Ibuprofen']) {
  return social.createPost(uid, { body: question, visibility: 'public', kind: 'poll', pollOptions: options });
}

test('Umfrage erstellen: normalisiert Optionen zu {id,text}, kappt bei 6', () => {
  const { social, a } = setup();
  const p = makePoll(social, a, 'Frage?', ['  A  ', 'B', '', '   ', 'C', 'D', 'E', 'F', 'G']);
  assert.equal(p.kind, 'poll');
  // leere/whitespace verworfen, max 6 behalten
  assert.deepEqual(p.poll_options.map(o => o.id), ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']);
  assert.deepEqual(p.poll_options.map(o => o.text), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('Umfrage-Validierung: Frage nötig, mind. 2 Optionen', () => {
  const { social, a } = setup();
  assert.throws(() => social.createPost(a, { kind: 'poll', body: '', pollOptions: ['A', 'B'] }),
    e => e.code === 'poll_question_missing');
  assert.throws(() => social.createPost(a, { kind: 'poll', body: 'Frage?', pollOptions: ['A'] }),
    e => e.code === 'poll_options_missing');
  assert.throws(() => social.createPost(a, { kind: 'poll', body: 'Frage?', pollOptions: ['A', '   '] }),
    e => e.code === 'poll_options_missing', 'nur eine gültige Option nach Trim');
});

test('Abstimmen: eigene Stimme im Tally, Zähler stimmt', () => {
  const { social, a, b, c } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o1');
  const res = social.votePoll(c, p.id, 'o1');
  assert.equal(res.ok, true);
  assert.equal(res.poll.total, 2);
  assert.equal(res.poll.counts.o1, 2);
  assert.equal(res.poll.my, 'o1', 'Cs eigene Stimme');
});

test('Stimme ändern hält die Summe stabil (kein Doppelzählen)', () => {
  const { social, a, b } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o1');
  const res = social.votePoll(b, p.id, 'o2'); // B wechselt
  assert.equal(res.poll.total, 1, 'immer noch eine Stimme');
  assert.equal(res.poll.counts.o2, 1);
  assert.equal(res.poll.counts.o1, undefined, 'alte Option nicht mehr gezählt');
  assert.equal(res.poll.my, 'o2');
});

test('Stimme zurückziehen (optionId=null) entfernt sie ganz', () => {
  const { social, a, b } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o1');
  const res = social.votePoll(b, p.id, null);
  assert.equal(res.poll.total, 0);
  assert.equal(res.poll.my, null);
});

test('Abstimmen validiert: keine Umfrage / unbekannte Option', () => {
  const { social, a, b } = setup();
  const normal = social.createPost(a, { body: 'Kein Poll', visibility: 'public' });
  assert.throws(() => social.votePoll(b, normal.id, 'o1'), e => e.code === 'poll_not_a_poll');
  const p = makePoll(social, a);
  assert.throws(() => social.votePoll(b, p.id, 'o99'), e => e.code === 'poll_bad_option');
});

test('Feed reichert Umfrage an: options + counts + total + eigene Stimme', () => {
  const { social, a, b } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o2');
  const seen = social.publicFeed(b).find(x => x.id === p.id);
  assert.ok(seen.poll, 'poll-Payload vorhanden');
  assert.equal(seen.poll.total, 1);
  assert.equal(seen.poll.counts.o2, 1);
  assert.equal(seen.poll.my_vote, 'o2', 'eigene Stimme aus Betrachter-Sicht');
  // Betrachter ohne eigene Stimme (A hat nicht abgestimmt) sieht my_vote=null, gleiche Zähler
  const seenByA = social.publicFeed(a).find(x => x.id === p.id);
  assert.equal(seenByA.poll.my_vote, null, 'A hat nicht abgestimmt');
  assert.equal(seenByA.poll.total, 1);
  // Nicht-Umfrage-Beiträge tragen poll:null
  const normal = social.createPost(a, { body: 'Text', visibility: 'public' });
  const seenN = social.publicFeed(a).find(x => x.id === normal.id);
  assert.equal(seenN.poll, null);
});

test('Persistenz: Umfrage-Stimmen überstehen dump/load', () => {
  const { social, socialRepo, a, b } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o3');
  const snap = socialRepo.__dump();
  const fresh = createSocialRepo();
  fresh.__load(snap);
  const tally = fresh.pollTally(p.id, b);
  assert.equal(tally.total, 1);
  assert.equal(tally.counts.o3, 1);
  assert.equal(tally.my, 'o3');
});

test('Abstimmen benachrichtigt die Umfrage-Autor:in — nur bei neuer Stimme, nie sich selbst', () => {
  const { social, a, b } = setup();
  const p = makePoll(social, a);
  // B stimmt erstmalig ab -> A bekommt eine poll_vote-Benachrichtigung
  social.votePoll(b, p.id, 'o1');
  let na = social.notifications(a).filter(n => n.type === 'poll_vote');
  assert.equal(na.length, 1, 'eine neue Stimme = eine Benachrichtigung');
  assert.equal(na[0].post_id ?? na[0].ref_id, p.id);
  // B wechselt die Stimme -> KEINE zweite Benachrichtigung (spamfrei)
  social.votePoll(b, p.id, 'o2');
  assert.equal(social.notifications(a).filter(n => n.type === 'poll_vote').length, 1, 'Wechsel benachrichtigt nicht erneut');
  // B zieht zurück und stimmt neu ab -> zählt wieder als neue Stimme
  social.votePoll(b, p.id, null);
  social.votePoll(b, p.id, 'o3');
  assert.equal(social.notifications(a).filter(n => n.type === 'poll_vote').length, 2, 'nach Rückzug wieder benachrichtigt');
  // A stimmt bei der eigenen Umfrage ab -> keine Selbst-Benachrichtigung
  social.votePoll(a, p.id, 'o1');
  assert.equal(social.notifications(a).filter(n => n.type === 'poll_vote').length, 2, 'keine Selbst-Benachrichtigung');
});

test('Konto-Löschung entfernt die eigenen Umfrage-Stimmen', () => {
  const { social, socialRepo, a, b } = setup();
  const p = makePoll(social, a);
  social.votePoll(b, p.id, 'o1');
  assert.equal(socialRepo.pollTally(p.id, b).total, 1);
  socialRepo.purgeUser(b);
  assert.equal(socialRepo.pollTally(p.id, b).total, 0, 'B-Stimme weg nach Purge');
});
