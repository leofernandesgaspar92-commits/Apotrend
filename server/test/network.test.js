import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createNetworkService } from '../src/services/network.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const net = createNetworkService(repo, orgAuth);

  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo A', ort: 'Wien', profile_visibility: 'network' }, owner: { name: 'AdminA', email: 'a@a.at', password: 'geheim123' } });
  const aPta = orgAuth.addMember({ organizationId: A.organization.id, name: 'PtaA', email: 'pta@a.at', password: 'geheim123', role: 'pta' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo B', ort: 'Graz', profile_visibility: 'contacts_only' }, owner: { name: 'AdminB', email: 'b@b.at', password: 'geheim123' } });
  const C = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo C' }, owner: { name: 'AdminC', email: 'c@c.at', password: 'geheim123' } });
  // Lieferant mit Pharmareferent
  const S = repo.createOrganization({ type: 'supplier', name: 'Pharma GmbH' });
  const refUser = orgAuth.addMember({ organizationId: S.id, name: 'Referent', email: 'ref@pharma.at', password: 'geheim123', role: 'pharmareferent' });

  return { repo, orgAuth, net, A, aPta, B, C, S, refUser };
}

test('Feed-Sichtbarkeit: network oeffentlich, contacts_only nur fuer Kontakte', () => {
  const { net, A, B } = setup();
  net.createPost(A.user.id, A.organization.id, { kind: 'news_geteilt', body: 'Oeffentliche Info', visibility: 'network' });
  net.createPost(A.user.id, A.organization.id, { kind: 'ankuendigung', body: 'Nur fuer Kontakte', visibility: 'contacts_only' });

  // B (nicht verbunden) sieht nur den oeffentlichen Beitrag
  let feedB = net.listFeed(B.user.id, B.organization.id);
  assert.equal(feedB.length, 1);
  assert.equal(feedB[0].body, 'Oeffentliche Info');

  // nach bestaetigter Verbindung sieht B auch den contacts_only-Beitrag
  const conn = net.requestConnection(A.user.id, A.organization.id, B.organization.id);
  net.respondConnection(B.user.id, B.organization.id, conn.id, true);
  feedB = net.listFeed(B.user.id, B.organization.id);
  assert.equal(feedB.length, 2);
});

test('Kontakt-Flow: Anfrage -> pending -> accept -> verbunden', () => {
  const { net, A, B } = setup();
  const c = net.requestConnection(A.user.id, A.organization.id, B.organization.id);
  assert.equal(c.status, 'pending');
  assert.equal(net.areConnected(A.organization.id, B.organization.id), false);
  net.respondConnection(B.user.id, B.organization.id, c.id, true);
  assert.equal(net.areConnected(A.organization.id, B.organization.id), true);
});

test('Nur die angefragte Org darf die Verbindung annehmen', () => {
  const { net, A, B, C } = setup();
  const c = net.requestConnection(A.user.id, A.organization.id, B.organization.id);
  // C ist unbeteiligt und darf nicht antworten
  assert.throws(() => net.respondConnection(C.user.id, C.organization.id, c.id, true), ForbiddenError);
});

test('RBAC: PTA darf nicht posten, Apotheker/Admin und Pharmareferent schon', () => {
  const { net, A, aPta, S, refUser } = setup();
  assert.throws(() => net.createPost(aPta.user.id, A.organization.id, { kind: 'frage', body: 'darf nicht?' }), ForbiddenError);
  assert.doesNotThrow(() => net.createPost(A.user.id, A.organization.id, { kind: 'frage', body: 'Wer hat Amoxicillin?' }));
  assert.doesNotThrow(() => net.createPost(refUser.user.id, S.id, { kind: 'ankuendigung', body: 'Neue Charge verfuegbar' }));
});

test('Fachliche Antwort statt Like: Antwort auf sichtbaren Beitrag', () => {
  const { net, A, B } = setup();
  const post = net.createPost(A.user.id, A.organization.id, { kind: 'frage', body: 'Wer hat Salbutamol?', visibility: 'network' });
  net.respondToPost(B.user.id, B.organization.id, post.id, 'Wir haben 5 Stueck.');
  const responses = net.listResponses(A.user.id, A.organization.id, post.id);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].body, 'Wir haben 5 Stueck.');
});

test('Direktnachrichten: nur die zwei Parteien, Dritte abgewiesen', () => {
  const { net, A, B, C } = setup();
  const th = net.startThread(A.user.id, A.organization.id, B.organization.id);
  net.sendMessage(A.user.id, A.organization.id, th.id, 'Habt ihr Metformin zum Tausch?');
  net.sendMessage(B.user.id, B.organization.id, th.id, 'Ja, 20 Packungen.');
  assert.equal(net.listMessages(B.user.id, B.organization.id, th.id).length, 2);
  // Apotheke C ist nicht Teil des Threads
  assert.throws(() => net.listMessages(C.user.id, C.organization.id, th.id), ForbiddenError);
  assert.throws(() => net.sendMessage(C.user.id, C.organization.id, th.id, 'spion'), ForbiddenError);
});

test('Profil-Sichtbarkeit: contacts_only ist fuer Fremde unsichtbar', () => {
  const { net, A, B } = setup();
  // B hat profile_visibility contacts_only
  assert.equal(net.getProfile(A.organization.id, B.organization.id), null);
  const c = net.requestConnection(A.user.id, A.organization.id, B.organization.id);
  net.respondConnection(B.user.id, B.organization.id, c.id, true);
  const prof = net.getProfile(A.organization.id, B.organization.id);
  assert.equal(prof.name, 'Apo B');
});
