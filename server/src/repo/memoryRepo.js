// In-Memory-Umsetzung des Repository-Interface. Lauffaehig & testbar ohne
// externen Dienst. Dieselben Methoden implementiert spaeter ein Postgres-Repo
// (Repository-Seam) — die Service-Schicht kennt nur dieses Interface.
//
// Interface (Vertrag):
//   createOrganization(data) -> org
//   getOrganization(id) -> org | null
//   createUser({email,name,passwordHash,status?}) -> user   (wirft bei Dublette)
//   getUserByEmail(email) -> user | null
//   getUserById(id) -> user | null
//   createMembership({userId,organizationId,role}) -> membership (unique/User+Org)
//   getMembershipsForUser(userId) -> membership[]
//   listUsersForOrganization(orgId) -> user[]
import crypto from 'node:crypto';

export function createMemoryRepo() {
  const organizations = new Map();
  const users = new Map();
  const usersByEmail = new Map(); // lower(email) -> userId
  const memberships = new Map();
  // collab-Modul
  const channels = new Map();
  const channelMembers = new Map(); // channelId -> Set(userId)
  const messages = new Map();
  const notes = new Map();
  const tasks = new Map();

  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  return {
    createOrganization(data) {
      if (!data?.name) throw new Error('Organisation braucht einen Namen.');
      if (!['pharmacy', 'supplier'].includes(data.type)) throw new Error('Ungueltiger Org-Typ.');
      const org = {
        id: uuid(), type: data.type, name: data.name,
        ort: data.ort ?? null, plz: data.plz ?? null, bundesland: data.bundesland ?? null,
        konzessionsnr: data.konzessionsnr ?? null,
        specializations: data.specializations ?? [],
        profile_text: data.profile_text ?? null,
        profile_visibility: data.profile_visibility ?? 'network',
        created_at: now(),
      };
      organizations.set(org.id, org);
      return { ...org };
    },

    getOrganization(id) {
      const o = organizations.get(id);
      return o ? { ...o } : null;
    },

    createUser({ email, name, passwordHash, status = 'active' }) {
      if (!email || !name || !passwordHash) throw new Error('email, name, passwordHash erforderlich.');
      const key = String(email).trim().toLowerCase();
      if (usersByEmail.has(key)) throw new Error('E-Mail ist bereits vergeben.');
      const user = { id: uuid(), email: key, name, password_hash: passwordHash, status, twofa_secret: null, created_at: now() };
      users.set(user.id, user);
      usersByEmail.set(key, user.id);
      return { ...user };
    },

    getUserByEmail(email) {
      const id = usersByEmail.get(String(email).trim().toLowerCase());
      return id ? { ...users.get(id) } : null;
    },

    getUserById(id) {
      const u = users.get(id);
      return u ? { ...u } : null;
    },

    createMembership({ userId, organizationId, role }) {
      if (!users.has(userId)) throw new Error('Unbekannter User.');
      if (!organizations.has(organizationId)) throw new Error('Unbekannte Organisation.');
      for (const m of memberships.values()) {
        if (m.user_id === userId && m.organization_id === organizationId) {
          throw new Error('User ist bereits Mitglied dieser Organisation.');
        }
      }
      const m = { id: uuid(), user_id: userId, organization_id: organizationId, role, created_at: now() };
      memberships.set(m.id, m);
      return { ...m };
    },

    getMembershipsForUser(userId) {
      return [...memberships.values()].filter(m => m.user_id === userId).map(m => ({ ...m }));
    },

    listUsersForOrganization(orgId) {
      const ids = [...memberships.values()].filter(m => m.organization_id === orgId).map(m => m.user_id);
      return ids.map(id => ({ ...users.get(id) }));
    },

    // ── collab-Modul ────────────────────────────────────────────────────────
    createChannel({ organizationId, name, visibility = 'all_members', createdBy = null }) {
      const c = { id: uuid(), organization_id: organizationId, name, visibility, created_by: createdBy, created_at: now() };
      channels.set(c.id, c);
      channelMembers.set(c.id, new Set());
      return { ...c };
    },
    getChannel(id) { const c = channels.get(id); return c ? { ...c } : null; },
    listChannelsForOrganization(orgId) {
      return [...channels.values()].filter(c => c.organization_id === orgId).map(c => ({ ...c }));
    },
    addChannelMember(channelId, userId) {
      const set = channelMembers.get(channelId); if (set) set.add(userId);
    },
    isChannelMember(channelId, userId) {
      return channelMembers.get(channelId)?.has(userId) ?? false;
    },

    createMessage({ channelId, authorUserId, body }) {
      const m = { id: uuid(), channel_id: channelId, author_user_id: authorUserId, body, created_at: now(), edited_at: null, deleted_at: null };
      messages.set(m.id, m);
      return { ...m };
    },
    listMessages(channelId) {
      return [...messages.values()].filter(m => m.channel_id === channelId && !m.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => ({ ...m }));
    },

    createNote({ organizationId, channelId = null, title, body = null, docUrl = null, pinned = false, createdBy = null }) {
      const n = { id: uuid(), organization_id: organizationId, channel_id: channelId, title, body, doc_url: docUrl, pinned, created_by: createdBy, created_at: now() };
      notes.set(n.id, n);
      return { ...n };
    },
    getNote(id) { const n = notes.get(id); return n ? { ...n } : null; },
    setNotePinned(id, pinned) { const n = notes.get(id); if (n) n.pinned = pinned; return n ? { ...n } : null; },
    listNotes(orgId) {
      return [...notes.values()].filter(n => n.organization_id === orgId).map(n => ({ ...n }));
    },

    createTask({ organizationId, channelId = null, title, description = null, assigneeUserId = null, dueDate = null, createdBy = null }) {
      const t = { id: uuid(), organization_id: organizationId, channel_id: channelId, title, description, assignee_user_id: assigneeUserId, status: 'offen', due_date: dueDate, created_by: createdBy, created_at: now() };
      tasks.set(t.id, t);
      return { ...t };
    },
    getTask(id) { const t = tasks.get(id); return t ? { ...t } : null; },
    updateTask(id, patch) { const t = tasks.get(id); if (!t) return null; Object.assign(t, patch); return { ...t }; },
    listTasks(orgId) {
      return [...tasks.values()].filter(t => t.organization_id === orgId).map(t => ({ ...t }));
    },
  };
}
