// In-Memory-Store des Social-Layers (Priorität 1). Gleicher Repository-Seam wie
// die anderen Module: dieselben Methoden implementiert spaeter ein Postgres-Repo.
// Referenziert Nutzer nur ueber ihre id (Existenzpruefung macht die Service-Schicht
// gegen das Fundament-Repo).
import crypto from 'node:crypto';

export function createSocialRepo() {
  const profiles = new Map();       // userId -> profile
  const profilesByHandle = new Map(); // lower(handle) -> userId
  const posts = new Map();
  const comments = new Map();
  const reactions = new Map();      // key `${userId}|${type}|${id}` -> reaction
  const follows = new Map();        // `${follower}|${followee}` -> row
  const notifications = new Map();
  const dmThreads = new Map();
  const dmMessages = new Map();
  const reports = new Map();

  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const rkey = (u, tt, ti) => `${u}|${tt}|${ti}`;
  const fkey = (a, b) => `${a}|${b}`;

  return {
    // ── Profile ──
    createProfile(p) {
      const key = String(p.handle).trim().toLowerCase();
      if (profiles.has(p.userId)) throw new Error('Profil existiert bereits.');
      if (profilesByHandle.has(key)) throw new Error('Handle ist bereits vergeben.');
      const prof = {
        user_id: p.userId, handle: key, display_name: p.displayName,
        title: p.title ?? null, pharmacy_org_id: p.pharmacyOrgId ?? null,
        bio: p.bio ?? null, specializations: p.specializations ?? [],
        avatar_url: p.avatarUrl ?? null, verified: !!p.verified,
        visibility: p.visibility ?? 'network', created_at: now(),
      };
      profiles.set(p.userId, prof);
      profilesByHandle.set(key, p.userId);
      return { ...prof };
    },
    getProfileByUserId(userId) { const p = profiles.get(userId); return p ? { ...p } : null; },
    getProfileByHandle(handle) {
      const id = profilesByHandle.get(String(handle).trim().toLowerCase());
      return id ? { ...profiles.get(id) } : null;
    },

    // ── Posts ──
    createPost(p) {
      const post = {
        id: uuid(), author_user_id: p.authorUserId, body: p.body,
        visibility: p.visibility ?? 'public', ref_type: p.refType ?? null, ref_id: p.refId ?? null,
        created_at: now(), edited_at: null, deleted_at: null,
      };
      posts.set(post.id, post);
      return { ...post };
    },
    getPost(id) { const p = posts.get(id); return p ? { ...p } : null; },
    softDeletePost(id) { const p = posts.get(id); if (p) p.deleted_at = now(); return p ? { ...p } : null; },
    listAllPosts() { return [...posts.values()].filter(p => !p.deleted_at).map(p => ({ ...p })); },

    // ── Kommentare ──
    createComment(c) {
      const cm = {
        id: uuid(), post_id: c.postId, parent_comment_id: c.parentCommentId ?? null,
        author_user_id: c.authorUserId, body: c.body, created_at: now(), deleted_at: null,
      };
      comments.set(cm.id, cm);
      return { ...cm };
    },
    getComment(id) { const c = comments.get(id); return c ? { ...c } : null; },
    listComments(postId) {
      return [...comments.values()].filter(c => c.post_id === postId && !c.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)).map(c => ({ ...c }));
    },
    countComments(postId) { return [...comments.values()].filter(c => c.post_id === postId && !c.deleted_at).length; },

    // ── Reaktionen (upsert: eine je Nutzer+Ziel) ──
    setReaction({ userId, targetType, targetId, type }) {
      // vorhandene Reaktion desselben Nutzers auf dasselbe Ziel ersetzen
      for (const k of reactions.keys()) {
        if (k.startsWith(`${userId}|`)) {
          const r = reactions.get(k);
          if (r.target_type === targetType && r.target_id === targetId) reactions.delete(k);
        }
      }
      const r = { id: uuid(), user_id: userId, target_type: targetType, target_id: targetId, type, created_at: now() };
      reactions.set(rkey(userId, type, targetId), r);
      return { ...r };
    },
    removeReaction({ userId, targetType, targetId }) {
      for (const k of [...reactions.keys()]) {
        if (k.startsWith(`${userId}|`)) {
          const r = reactions.get(k);
          if (r.target_type === targetType && r.target_id === targetId) reactions.delete(k);
        }
      }
    },
    listReactions(targetType, targetId) {
      return [...reactions.values()].filter(r => r.target_type === targetType && r.target_id === targetId).map(r => ({ ...r }));
    },

    // ── Follows (gerichtet) ──
    follow(followerId, followeeId) {
      follows.set(fkey(followerId, followeeId), { follower_user_id: followerId, followee_user_id: followeeId, created_at: now() });
    },
    unfollow(followerId, followeeId) { follows.delete(fkey(followerId, followeeId)); },
    isFollowing(followerId, followeeId) { return follows.has(fkey(followerId, followeeId)); },
    listFollowing(userId) { return [...follows.values()].filter(f => f.follower_user_id === userId).map(f => f.followee_user_id); },
    listFollowers(userId) { return [...follows.values()].filter(f => f.followee_user_id === userId).map(f => f.follower_user_id); },

    // ── Benachrichtigungen ──
    createNotification(n) {
      const row = { id: uuid(), user_id: n.userId, type: n.type, actor_user_id: n.actorUserId ?? null, ref_type: n.refType ?? null, ref_id: n.refId ?? null, read: false, created_at: now() };
      notifications.set(row.id, row);
      return { ...row };
    },
    listNotifications(userId) {
      return [...notifications.values()].filter(n => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(n => ({ ...n }));
    },
    markNotificationRead(id) { const n = notifications.get(id); if (n) n.read = true; },
    markAllNotificationsRead(userId) { for (const n of notifications.values()) if (n.user_id === userId) n.read = true; },
    unreadNotificationCount(userId) { return [...notifications.values()].filter(n => n.user_id === userId && !n.read).length; },

    // ── Direktnachrichten (1:1) ──
    findDmThread(userX, userY) {
      for (const t of dmThreads.values()) {
        if ((t.user_a_id === userX && t.user_b_id === userY) || (t.user_a_id === userY && t.user_b_id === userX)) return { ...t };
      }
      return null;
    },
    createDmThread(userAId, userBId) {
      const t = { id: uuid(), user_a_id: userAId, user_b_id: userBId, created_at: now() };
      dmThreads.set(t.id, t);
      return { ...t };
    },
    getDmThread(id) { const t = dmThreads.get(id); return t ? { ...t } : null; },
    createDmMessage({ threadId, senderUserId, body }) {
      const m = { id: uuid(), thread_id: threadId, sender_user_id: senderUserId, body, created_at: now(), read_at: null };
      dmMessages.set(m.id, m);
      return { ...m };
    },
    listDmMessages(threadId) {
      return [...dmMessages.values()].filter(m => m.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => ({ ...m }));
    },

    // ── Moderation ──
    createReport(r) {
      const row = { id: uuid(), reporter_user_id: r.reporterUserId, target_type: r.targetType, target_id: r.targetId, reason: r.reason ?? null, status: 'offen', created_at: now() };
      reports.set(row.id, row);
      return { ...row };
    },
    getReport(id) { const r = reports.get(id); return r ? { ...r } : null; },
    listReports(status = null) {
      return [...reports.values()].filter(r => !status || r.status === status).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(r => ({ ...r }));
    },
    updateReport(id, patch) { const r = reports.get(id); if (!r) return null; Object.assign(r, patch); return { ...r }; },
  };
}
