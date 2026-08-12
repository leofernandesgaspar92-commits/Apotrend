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

test('Aufgabe neu zuweisen: Apotheker ja, Lehrling nein, Nicht-Mitglied abgewiesen, Entfernen mit null', () => {
  const { collab, orgAuth, A, aApo, aPta, aAzubi, B } = setup();
  const t = collab.createTask(aApo.user.id, A.organization.id, { title: 'Retoure', assigneeUserId: aPta.user.id });
  assert.equal(t.assignee_user_id, aPta.user.id);
  // Apotheker weist die Aufgabe dem Lehrling neu zu
  const re = collab.reassignTask(aApo.user.id, t.id, aAzubi.user.id);
  assert.equal(re.assignee_user_id, aAzubi.user.id);
  // Zuweisung entfernen (null)
  const cleared = collab.reassignTask(aApo.user.id, t.id, null);
  assert.equal(cleared.assignee_user_id, null);
  // Lehrling darf nicht neu zuweisen
  assert.throws(() => collab.reassignTask(aAzubi.user.id, t.id, aPta.user.id), ForbiddenError);
  // Person aus fremder Organisation kann nicht zugewiesen werden
  assert.throws(() => collab.reassignTask(aApo.user.id, t.id, B.user.id), ForbiddenError);
  // Fremdorg-Handelnder kommt gar nicht an die Aufgabe (Isolation)
  assert.throws(() => collab.reassignTask(B.user.id, t.id, B.user.id), ForbiddenError);
});

test('Notizen: PTA legt an & Apotheker heftet an; Lehrling darf nicht anheften', () => {
  const { collab, A, aApo, aPta, aAzubi } = setup();
  const n = collab.createNote(aPta.user.id, A.organization.id, { title: 'Notdienst-Plan', body: 'KW 28' });
  assert.equal(n.pinned, false);
  const pinned = collab.setNotePinned(aApo.user.id, n.id, true);
  assert.equal(pinned.pinned, true);
  assert.throws(() => collab.setNotePinned(aAzubi.user.id, n.id, false), ForbiddenError);
});

test('Aufgabe bearbeiten: Apotheker ändert Titel/Details/Fälligkeit, Lehrling nein, leerer Titel abgelehnt, Teiländerung, Isolation', () => {
  const { collab, A, aApo, aPta, aAzubi, B } = setup();
  const t = collab.createTask(aApo.user.id, A.organization.id, { title: 'Retoure', description: 'alt', assigneeUserId: aPta.user.id, dueDate: '2026-09-01' });
  // Apotheker (assign_tasks) bearbeitet Titel + Details + Fälligkeit
  const upd = collab.editTask(aApo.user.id, t.id, { title: 'Retoure Amoxicillin', description: 'neu', dueDate: '2026-09-15' });
  assert.equal(upd.title, 'Retoure Amoxicillin');
  assert.equal(upd.description, 'neu');
  assert.equal(upd.due_date, '2026-09-15');
  // Teiländerung: nur Fälligkeit entfernen (null), Titel/Details bleiben
  const upd2 = collab.editTask(aApo.user.id, t.id, { dueDate: null });
  assert.equal(upd2.due_date, null);
  assert.equal(upd2.title, 'Retoure Amoxicillin');
  assert.equal(upd2.description, 'neu');
  // Zuweisung bleibt durch Bearbeiten unberührt
  assert.equal(upd2.assignee_user_id, aPta.user.id);
  // Lehrling darf nicht bearbeiten
  assert.throws(() => collab.editTask(aAzubi.user.id, t.id, { title: 'Kaputt' }), ForbiddenError);
  // Leerer Titel abgelehnt
  assert.throws(() => collab.editTask(aApo.user.id, t.id, { title: '  ' }), /Titel/);
  // Fremde Organisation (Isolation)
  assert.throws(() => collab.editTask(B.user.id, t.id, { title: 'Spion' }), ForbiddenError);
});

test('Notizen bearbeiten: Ersteller:in & Apotheker ja, fremder Lehrling nein, Fremdorg nein, leerer Titel abgelehnt, Teiländerung', () => {
  const { collab, A, aApo, aPta, aAzubi, B } = setup();
  const n = collab.createNote(aPta.user.id, A.organization.id, { title: 'Notdienst-Plan', body: 'KW 28', docUrl: null });
  // Ersteller:in (PTA) darf bearbeiten
  const upd = collab.updateNote(aPta.user.id, n.id, { title: 'Notdienst-Plan KW 29', body: 'aktualisiert' });
  assert.equal(upd.title, 'Notdienst-Plan KW 29');
  assert.equal(upd.body, 'aktualisiert');
  // Teiländerung: nur der Link, Titel/Inhalt bleiben
  const upd2 = collab.updateNote(aApo.user.id, n.id, { docUrl: 'https://example.org/plan' });
  assert.equal(upd2.doc_url, 'https://example.org/plan');
  assert.equal(upd2.title, 'Notdienst-Plan KW 29');
  assert.equal(upd2.body, 'aktualisiert');
  // Lehrling (nicht Ersteller, keine collab-Rolle) darf NICHT bearbeiten
  assert.throws(() => collab.updateNote(aAzubi.user.id, n.id, { title: 'Kaputt' }), ForbiddenError);
  // Fremde Organisation (Isolation)
  assert.throws(() => collab.updateNote(B.user.id, n.id, { title: 'Spion' }), ForbiddenError);
  // Leerer Titel abgelehnt
  assert.throws(() => collab.updateNote(aApo.user.id, n.id, { title: '   ' }), /Titel/);
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
