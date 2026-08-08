import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';
import { createCollabService } from '../src/services/collab.js';

// Zwei Apotheken mit Team aufsetzen.
function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const collab = createCollabService(repo, orgAuth);

  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo A' }, owner: { name: 'AdminA', email: 'admin@a.at', password: 'geheim123' } });
  const aApo = orgAuth.addMember({ organizationId: A.organization.id, name: 'ApoA', email: 'apo@a.at', password: 'geheim123', role: 'apotheker' });
  const aPta = orgAuth.addMember({ organizationId: A.organization.id, name: 'PtaA', email: 'pta@a.at', password: 'geheim123', role: 'pta' });
  const aAzubi = orgAuth.addMember({ organizationId: A.organization.id, name: 'AzubiA', email: 'azubi@a.at', password: 'geheim123', role: 'lehrling' });

  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo B' }, owner: { name: 'AdminB', email: 'admin@b.at', password: 'geheim123' } });

  return { repo, orgAuth, collab, A, aApo, aPta, aAzubi, B };
}

test('Kanal anlegen: Admin ja, Lehrling nein', () => {
  const { collab, A, aAzubi } = setup();
  const ch = collab.createChannel(A.user.id, A.organization.id, { name: 'Allgemein' });
  assert.equal(ch.name, 'Allgemein');
  assert.throws(() => collab.createChannel(aAzubi.user.id, A.organization.id, { name: 'X' }), ForbiddenError);
});

test('Nachricht posten: Team-Mitglieder (inkl. Lehrling im offenen Kanal) ja', () => {
  const { collab, A, aAzubi } = setup();
  const ch = collab.createChannel(A.user.id, A.organization.id, { name: 'Allgemein' });
  collab.postMessage(A.user.id, ch.id, 'Hallo Team');
  collab.postMessage(aAzubi.user.id, ch.id, 'Hallo, bin der Lehrling'); // offener Kanal -> ok
  const msgs = collab.listMessages(A.user.id, ch.id);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].body, 'Hallo Team');
});

test('Privater Kanal: nur Mitglieder, andere abgewiesen', () => {
  const { collab, A, aApo, aPta } = setup();
  const ch = collab.createChannel(A.user.id, A.organization.id, { name: 'Leitung', visibility: 'private' });
  collab.addChannelMember(A.user.id, ch.id, aApo.user.id);
  collab.postMessage(aApo.user.id, ch.id, 'intern'); // Mitglied -> ok
  // PTA ist NICHT im privaten Kanal -> kein Zugriff
  assert.throws(() => collab.postMessage(aPta.user.id, ch.id, 'darf nicht'), ForbiddenError);
  assert.throws(() => collab.listMessages(aPta.user.id, ch.id), ForbiddenError);
  // privater Kanal taucht bei Nicht-Mitglied nicht in der Liste auf
  assert.equal(collab.listChannels(aPta.user.id, A.organization.id).length, 0);
  assert.equal(collab.listChannels(aApo.user.id, A.organization.id).length, 1);
});

test('Mandanten-Isolation: Apotheke B kommt NICHT an Kanaele/Nachrichten/Aufgaben von A', () => {
  const { collab, A, B } = setup();
  const ch = collab.createChannel(A.user.id, A.organization.id, { name: 'Allgemein' });
  collab.postMessage(A.user.id, ch.id, 'intern A');
  // B-Owner versucht Zugriff auf A
  assert.throws(() => collab.postMessage(B.user.id, ch.id, 'spion'), ForbiddenError);
  assert.throws(() => collab.listMessages(B.user.id, ch.id), ForbiddenError);
  assert.throws(() => collab.listChannels(B.user.id, A.organization.id), ForbiddenError);
  assert.throws(() => collab.createTask(B.user.id, A.organization.id, { title: 'x' }), ForbiddenError);
});

test('Aufgaben: Apotheker weist zu, Lehrling darf nicht anlegen, aber eigene erledigen', () => {
  const { collab, A, aApo, aPta, aAzubi } = setup();
  // Lehrling darf keine Aufgabe anlegen/zuweisen
  assert.throws(() => collab.createTask(aAzubi.user.id, A.organization.id, { title: 'x' }), ForbiddenError);
  // Apotheker weist dem Lehrling eine Aufgabe zu
  const t = collab.createTask(aApo.user.id, A.organization.id, { title: 'Kühlschrank prüfen', assigneeUserId: aAzubi.user.id });
  assert.equal(t.status, 'offen');
  // Lehrling darf SEINE Aufgabe erledigen
  const done = collab.updateTaskStatus(aAzubi.user.id, t.id, 'erledigt');
  assert.equal(done.status, 'erledigt');
  // Aufgabe von jemand anderem (PTA) darf der Lehrling NICHT aendern
  const t2 = collab.createTask(aApo.user.id, A.organization.id, { title: 'Bestellung', assigneeUserId: aPta.user.id });
  assert.throws(() => collab.updateTaskStatus(aAzubi.user.id, t2.id, 'erledigt'), ForbiddenError);
});

test('Notizen: PTA legt an & Apotheker heftet an; Lehrling darf nicht anheften', () => {
  const { collab, A, aApo, aPta, aAzubi } = setup();
  const n = collab.createNote(aPta.user.id, A.organization.id, { title: 'Notdienst-Plan', body: 'KW 28' });
  assert.equal(n.pinned, false);
  const pinned = collab.setNotePinned(aApo.user.id, n.id, true);
  assert.equal(pinned.pinned, true);
  assert.throws(() => collab.setNotePinned(aAzubi.user.id, n.id, false), ForbiddenError);
});

test('Notizen löschen: Ersteller:in ja, fremder Lehrling nein, Apotheker ja; Fremdorg nein', () => {
  const { collab, A, aApo, aPta, aAzubi, B } = setup();
  // Vom Azubi erstellte Notiz darf der Azubi selbst löschen
  const own = collab.createNote(aAzubi.user.id, A.organization.id, { title: 'Azubi-Notiz' });
  collab.deleteNote(aAzubi.user.id, own.id);
  assert.equal(collab.listNotes(aApo.user.id, A.organization.id).some(x => x.id === own.id), false);
  // Vom PTA erstellte Notiz: Azubi (nicht Ersteller, keine collab-Rolle) darf NICHT löschen
  const n = collab.createNote(aPta.user.id, A.organization.id, { title: 'PTA-Notiz' });
  assert.throws(() => collab.deleteNote(aAzubi.user.id, n.id), ForbiddenError);
  // Fremde Organisation (Isolation): B darf A-Notiz nicht löschen
  assert.throws(() => collab.deleteNote(B.user.id, n.id), ForbiddenError);
  // Apotheker (collab-Rolle) darf löschen
  collab.deleteNote(aApo.user.id, n.id);
  assert.equal(collab.listNotes(aApo.user.id, A.organization.id).some(x => x.id === n.id), false);
});
