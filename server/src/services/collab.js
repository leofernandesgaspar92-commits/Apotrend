// collab-Modul (Teams-artig, apothekenintern). Jede Operation leitet die
// Organisation aus dem betroffenen Objekt (Kanal/Notiz/Aufgabe) ab und prueft
// die Mitgliedschaft + Rolle des Handelnden in GENAU dieser Organisation.
// Dadurch ist Zugriff ueber Apotheken-Grenzen hinweg strukturell unmoeglich.
import { can } from '../domain/roles.js';
import { ForbiddenError } from './orgAuth.js';

export function createCollabService(repo, orgAuth) {
  function orgRole(userId, orgId) {
    const m = orgAuth.membershipOf(userId, orgId);
    if (!m) throw new ForbiddenError('Kein Mitglied dieser Organisation.'); // Isolation
    return m.role;
  }
  const canParticipate = (role) => can(role, 'collab') || can(role, 'collab_assigned');

  function requireChannel(id) {
    const c = repo.getChannel(id);
    if (!c) throw new Error('Kanal nicht gefunden.');
    return c;
  }

  // Org-Mitglied? Bei privatem Kanal zusaetzlich Kanal-Mitglied?
  function assertChannelAccess(userId, channel) {
    const role = orgRole(userId, channel.organization_id);
    if (!canParticipate(role)) throw new ForbiddenError('Rolle darf nicht am collab teilnehmen.');
    if (channel.visibility === 'private' && !repo.isChannelMember(channel.id, userId)) {
      throw new ForbiddenError('Kein Mitglied dieses privaten Kanals.');
    }
    return role;
  }

  return {
    createChannel(actorUserId, organizationId, { name, visibility = 'all_members' }) {
      const role = orgRole(actorUserId, organizationId);
      if (!can(role, 'collab')) throw new ForbiddenError('Diese Rolle darf keine Kanaele anlegen.');
      const ch = repo.createChannel({ organizationId, name, visibility, createdBy: actorUserId });
      repo.addChannelMember(ch.id, actorUserId);
      return ch;
    },

    addChannelMember(actorUserId, channelId, targetUserId) {
      const ch = requireChannel(channelId);
      const role = orgRole(actorUserId, ch.organization_id);
      if (!can(role, 'collab')) throw new ForbiddenError('Diese Rolle darf keine Mitglieder hinzufuegen.');
      if (!orgAuth.membershipOf(targetUserId, ch.organization_id)) {
        throw new ForbiddenError('Zielnutzer gehoert nicht zur Organisation.');
      }
      repo.addChannelMember(channelId, targetUserId);
      return { channelId, userId: targetUserId };
    },

    listChannels(actorUserId, organizationId) {
      orgRole(actorUserId, organizationId); // Isolation
      return repo.listChannelsForOrganization(organizationId)
        .filter(c => c.visibility !== 'private' || repo.isChannelMember(c.id, actorUserId));
    },

    postMessage(actorUserId, channelId, body) {
      const ch = requireChannel(channelId);
      assertChannelAccess(actorUserId, ch);
      if (!body || !String(body).trim()) throw new Error('Leere Nachricht.');
      return repo.createMessage({ channelId, authorUserId: actorUserId, body: String(body) });
    },

    listMessages(actorUserId, channelId) {
      const ch = requireChannel(channelId);
      assertChannelAccess(actorUserId, ch);
      return repo.listMessages(channelId);
    },

    createNote(actorUserId, organizationId, { title, body = null, docUrl = null, channelId = null, pinned = false }) {
      const role = orgRole(actorUserId, organizationId);
      if (!canParticipate(role)) throw new ForbiddenError('Rolle darf keine Notizen anlegen.');
      if (channelId) assertChannelAccess(actorUserId, requireChannel(channelId));
      if (!title) throw new Error('Notiz braucht einen Titel.');
      return repo.createNote({ organizationId, channelId, title, body, docUrl, pinned, createdBy: actorUserId });
    },

    setNotePinned(actorUserId, noteId, pinned) {
      const n = repo.getNote(noteId);
      if (!n) throw new Error('Notiz nicht gefunden.');
      const role = orgRole(actorUserId, n.organization_id);
      if (!can(role, 'collab')) throw new ForbiddenError('Rolle darf nicht anheften.');
      return repo.setNotePinned(noteId, !!pinned);
    },

    listNotes(actorUserId, organizationId) {
      orgRole(actorUserId, organizationId); // Isolation
      return repo.listNotes(organizationId);
    },

    // Notiz bearbeiten: Ersteller:in ODER eine Rolle mit 'collab' (Admin/Apotheker:in/PTA).
    // Nur übergebene Felder werden geändert (title/body/docUrl); Titel darf nicht leeren.
    updateNote(actorUserId, noteId, { title, body, docUrl } = {}) {
      const n = repo.getNote(noteId);
      if (!n) throw new Error('Notiz nicht gefunden.');
      const role = orgRole(actorUserId, n.organization_id); // Isolation
      if (n.created_by !== actorUserId && !can(role, 'collab')) {
        throw new ForbiddenError('Nur Ersteller:in oder eine berechtigte Rolle darf bearbeiten.');
      }
      const fields = {};
      if (title !== undefined) {
        if (!title || !String(title).trim()) throw new Error('Notiz braucht einen Titel.');
        fields.title = String(title);
      }
      if (body !== undefined) fields.body = body;
      if (docUrl !== undefined) fields.docUrl = docUrl;
      return repo.updateNote(noteId, fields);
    },

    // Notiz löschen: Ersteller:in ODER eine Rolle mit 'collab' (Admin/Apotheker:in/PTA).
    deleteNote(actorUserId, noteId) {
      const n = repo.getNote(noteId);
      if (!n) throw new Error('Notiz nicht gefunden.');
      const role = orgRole(actorUserId, n.organization_id); // Isolation
      if (n.created_by !== actorUserId && !can(role, 'collab')) {
        throw new ForbiddenError('Nur Ersteller:in oder eine berechtigte Rolle darf löschen.');
      }
      repo.deleteNote(noteId);
      return { ok: true };
    },

    createTask(actorUserId, organizationId, { title, description = null, assigneeUserId = null, dueDate = null, channelId = null }) {
      const role = orgRole(actorUserId, organizationId);
      if (!can(role, 'assign_tasks')) throw new ForbiddenError('Diese Rolle darf keine Aufgaben anlegen/zuweisen.');
      if (assigneeUserId && !orgAuth.membershipOf(assigneeUserId, organizationId)) {
        throw new ForbiddenError('Zugewiesene Person gehoert nicht zur Organisation.');
      }
      if (!title) throw new Error('Aufgabe braucht einen Titel.');
      return repo.createTask({ organizationId, title, description, assigneeUserId, dueDate, channelId, createdBy: actorUserId });
    },

    updateTaskStatus(actorUserId, taskId, status) {
      const t = repo.getTask(taskId);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const role = orgRole(actorUserId, t.organization_id); // Isolation
      const isAssignee = t.assignee_user_id === actorUserId;
      if (!can(role, 'assign_tasks') && !isAssignee) {
        throw new ForbiddenError('Nur die zugewiesene Person oder eine berechtigte Rolle darf den Status aendern.');
      }
      if (!['offen', 'in_arbeit', 'erledigt'].includes(status)) throw new Error('Ungueltiger Status.');
      return repo.updateTask(taskId, { status });
    },

    // Aufgabe neu zuweisen (oder Zuweisung entfernen mit null) — nur berechtigte Rolle.
    reassignTask(actorUserId, taskId, assigneeUserId) {
      const t = repo.getTask(taskId);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const role = orgRole(actorUserId, t.organization_id); // Isolation
      if (!can(role, 'assign_tasks')) throw new ForbiddenError('Diese Rolle darf Aufgaben nicht zuweisen.');
      const newAssignee = assigneeUserId || null;
      if (newAssignee && !orgAuth.membershipOf(newAssignee, t.organization_id)) {
        throw new ForbiddenError('Zugewiesene Person gehoert nicht zur Organisation.');
      }
      return repo.updateTask(taskId, { assignee_user_id: newAssignee });
    },

    // Aufgabe bearbeiten (Titel/Beschreibung/Fälligkeit) — nur berechtigte Rolle.
    // Nur übergebene Felder werden geändert; Titel darf nicht geleert werden.
    editTask(actorUserId, taskId, { title, description, dueDate } = {}) {
      const t = repo.getTask(taskId);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const role = orgRole(actorUserId, t.organization_id); // Isolation
      if (!can(role, 'assign_tasks')) throw new ForbiddenError('Diese Rolle darf Aufgaben nicht bearbeiten.');
      const fields = {};
      if (title !== undefined) {
        if (!title || !String(title).trim()) throw new Error('Aufgabe braucht einen Titel.');
        fields.title = String(title).trim();
      }
      if (description !== undefined) fields.description = description;
      if (dueDate !== undefined) fields.due_date = dueDate || null;
      return repo.updateTask(taskId, fields);
    },

    listTasks(actorUserId, organizationId) {
      orgRole(actorUserId, organizationId); // Isolation
      return repo.listTasks(organizationId);
    },
  };
}
