// Social-Layer (Priorität 1): Apotheker als Person. Profile, kurze Posts,
// Kommentar-Threads, typisierte Reaktionen, gerichtete Follows, Home-/Öffentlich-Feed.
// Sichtbarkeit pro Post (public/followers) wird bei JEDER Leseoperation erzwungen.
import { ForbiddenError } from './orgAuth.js';

const REACTION_TYPES = ['hilfreich', 'danke', 'bestaetigt', 'interessant'];
const MAX_BODY = 1000;

export function createSocialService(social, foundationRepo) {
  function requireUser(userId) {
    const u = foundationRepo.getUserById(userId);
    if (!u) throw new Error('Unbekannter Nutzer.');
    return u;
  }
  // Darf viewer diesen Post sehen?
  function visibleTo(post, viewerId) {
    if (post.deleted_at) return false;
    if (post.author_user_id === viewerId) return true;
    if (post.visibility === 'public') return true;
    return post.visibility === 'followers' && social.isFollowing(viewerId, post.author_user_id);
  }
  // Post + leichte Metadaten (Autor, Zähler) fuer die Anzeige.
  function decorate(post) {
    const prof = social.getProfileByUserId(post.author_user_id);
    const reacts = social.listReactions('post', post.id);
    const counts = {};
    for (const t of REACTION_TYPES) counts[t] = reacts.filter(r => r.type === t).length;
    return {
      ...post,
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified } : null,
      comment_count: social.countComments(post.id),
      reaction_counts: counts,
    };
  }

  return {
    // ── Profil ──
    createProfile(actorUserId, { handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility }) {
      requireUser(actorUserId);
      if (!handle || !/^[a-z0-9_]{3,30}$/i.test(handle)) throw new Error('Handle: 3–30 Zeichen, nur a–z 0–9 _.');
      if (!displayName) throw new Error('Anzeigename erforderlich.');
      return social.createProfile({ userId: actorUserId, handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility });
    },
    getProfile(handleOrUserId) {
      return social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
    },

    // ── Posts ──
    createPost(actorUserId, { body, visibility = 'public', refType = null, refId = null }) {
      requireUser(actorUserId);
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Beitrag darf nicht leer sein.');
      if (text.length > MAX_BODY) throw new Error(`Beitrag zu lang (max ${MAX_BODY}).`);
      if (!['public', 'followers'].includes(visibility)) throw new Error('Ungueltige Sichtbarkeit.');
      if (refType && !['shortage', 'price', 'news'].includes(refType)) throw new Error('Ungueltiger Referenztyp.');
      return social.createPost({ authorUserId: actorUserId, body: text, visibility, refType, refId });
    },
    deletePost(actorUserId, postId) {
      const p = social.getPost(postId);
      if (!p) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf loeschen.');
      return social.softDeletePost(postId);
    },
    getPost(viewerUserId, postId) {
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, viewerUserId)) return null;
      return decorate(p);
    },

    // ── Kommentare (Thread) ──
    comment(actorUserId, postId, { body, parentCommentId = null }) {
      requireUser(actorUserId);
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      if (parentCommentId) {
        const parent = social.getComment(parentCommentId);
        if (!parent || parent.post_id !== postId) throw new Error('Ungueltiger Eltern-Kommentar.');
      }
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Kommentar darf nicht leer sein.');
      return social.createComment({ postId, parentCommentId, authorUserId: actorUserId, body: text });
    },
    listComments(viewerUserId, postId) {
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, viewerUserId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      return social.listComments(postId);
    },

    // ── Reaktionen (typisiert, kein reines Like) ──
    react(actorUserId, targetType, targetId, type) {
      requireUser(actorUserId);
      if (!REACTION_TYPES.includes(type)) throw new Error('Ungueltige Reaktionsart.');
      if (targetType === 'post') {
        const p = social.getPost(targetId);
        if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Ziel nicht sichtbar.');
      } else if (targetType === 'comment') {
        const c = social.getComment(targetId);
        if (!c) throw new Error('Kommentar nicht gefunden.');
        const p = social.getPost(c.post_id);
        if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Ziel nicht sichtbar.');
      } else throw new Error('Ungueltiger Zieltyp.');
      return social.setReaction({ userId: actorUserId, targetType, targetId, type });
    },
    unreact(actorUserId, targetType, targetId) {
      social.removeReaction({ userId: actorUserId, targetType, targetId });
    },

    // ── Follows (gerichtet, ohne Zustimmung) ──
    follow(actorUserId, followeeUserId) {
      requireUser(actorUserId); requireUser(followeeUserId);
      if (actorUserId === followeeUserId) throw new Error('Selbst-Follow nicht moeglich.');
      social.follow(actorUserId, followeeUserId);
      return { follower: actorUserId, followee: followeeUserId };
    },
    unfollow(actorUserId, followeeUserId) { social.unfollow(actorUserId, followeeUserId); },
    following(userId) { return social.listFollowing(userId); },
    followers(userId) { return social.listFollowers(userId); },

    // ── Feeds ──
    // Home: Beiträge von gefolgten Personen + eigene, sichtbarkeitsgefiltert.
    homeFeed(viewerUserId) {
      requireUser(viewerUserId);
      const authors = new Set(social.listFollowing(viewerUserId));
      authors.add(viewerUserId);
      return social.listAllPosts()
        .filter(p => authors.has(p.author_user_id) && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
    },
    // Entdecken: alle oeffentlichen Beiträge (netzwerkweite Reichweite).
    publicFeed(viewerUserId) {
      requireUser(viewerUserId);
      return social.listAllPosts()
        .filter(p => p.visibility === 'public')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
    },
  };
}
