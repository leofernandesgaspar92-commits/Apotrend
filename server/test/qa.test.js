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
  const mk = (name, handle) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: handle + '@a.at', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    return r.user.id;
  };
  return { social, asker: mk('Fragerin', 'ask'), answerer: mk('Antworter', 'ans'), other: mk('Andere', 'oth') };
}

test('Frage posten: kind=frage, is_question, answered=false', () => {
  const { social, asker } = setup();
  const p = social.createPost(asker, { body: 'Wie lagere ich X?', kind: 'frage' });
  const dec = social.getPost(asker, p.id);
  assert.equal(dec.kind, 'frage');
  assert.equal(dec.is_question, true);
  assert.equal(dec.answered, false);
});

test('acceptAnswer: Fragesteller:in markiert beste Antwort', () => {
  const { social, asker, answerer } = setup();
  const p = social.createPost(asker, { body: 'Frage?', kind: 'frage' });
  const c = social.comment(answerer, p.id, { body: 'So geht das.' });
  const upd = social.acceptAnswer(asker, p.id, c.id);
  assert.equal(upd.accepted_comment_id, c.id);
  assert.equal(upd.answered, true);
});

test('acceptAnswer: nur Fragesteller:in darf markieren', () => {
  const { social, asker, answerer, other } = setup();
  const p = social.createPost(asker, { body: 'Frage?', kind: 'frage' });
  const c = social.comment(answerer, p.id, { body: 'Antwort' });
  assert.throws(() => social.acceptAnswer(other, p.id, c.id), /Fragesteller/);
});

test('acceptAnswer: erneut derselbe Kommentar hebt Markierung auf (Toggle)', () => {
  const { social, asker, answerer } = setup();
  const p = social.createPost(asker, { body: 'Frage?', kind: 'frage' });
  const c = social.comment(answerer, p.id, { body: 'Antwort' });
  social.acceptAnswer(asker, p.id, c.id);
  const upd = social.acceptAnswer(asker, p.id, c.id);
  assert.equal(upd.accepted_comment_id, null);
  assert.equal(upd.answered, false);
});

test('acceptAnswer: Kommentar muss zur Frage gehören', () => {
  const { social, asker, answerer } = setup();
  const p1 = social.createPost(asker, { body: 'Frage 1?', kind: 'frage' });
  const p2 = social.createPost(asker, { body: 'Frage 2?', kind: 'frage' });
  const c2 = social.comment(answerer, p2.id, { body: 'Antwort auf 2' });
  assert.throws(() => social.acceptAnswer(asker, p1.id, c2.id), /Ungueltige Antwort/);
});

test('acceptAnswer: nur auf Fragen (nicht auf normale Beiträge)', () => {
  const { social, asker, answerer } = setup();
  const p = social.createPost(asker, { body: 'Normaler Beitrag' }); // kind=post
  const c = social.comment(answerer, p.id, { body: 'Kommentar' });
  assert.throws(() => social.acceptAnswer(asker, p.id, c.id), /Nur Fragen/);
});

test('acceptAnswer: benachrichtigt den/die Antwortende:n', () => {
  const { social, asker, answerer } = setup();
  const p = social.createPost(asker, { body: 'Frage?', kind: 'frage' });
  const c = social.comment(answerer, p.id, { body: 'Antwort' });
  social.acceptAnswer(asker, p.id, c.id);
  const n = social.notifications(answerer).find(x => x.type === 'answer_accepted');
  assert.ok(n, 'answer_accepted Benachrichtigung');
});

test('createPost: ungültige Beitragsart abgelehnt', () => {
  const { social, asker } = setup();
  assert.throws(() => social.createPost(asker, { body: 'x', kind: 'quatsch' }), /Beitragsart/);
});
