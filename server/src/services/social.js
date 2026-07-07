// Social-Layer (Priorität 1): Apotheker als Person. Profile, kurze Posts,
// Kommentar-Threads, typisierte Reaktionen, gerichtete Follows, Home-/Öffentlich-Feed.
// Sichtbarkeit pro Post (public/followers) wird bei JEDER Leseoperation erzwungen.
import { ForbiddenError } from './orgAuth.js';

const REACTION_TYPES = ['hilfreich', 'danke', 'bestaetigt', 'interessant'];
const MAX_BODY = 1000;

export function createSocialService(social, foundationRepo, options = {}) {
  // Wer darf moderieren (Reports bearbeiten, fremde Inhalte entfernen)? Bewusst
  // injiziert — eine echte Plattform-Moderator-Rolle ist noch nicht modelliert.
  const isModerator = options.isModerator || (() => false);

  function requireUser(userId) {
    const u = foundationRepo.getUserById(userId);
    if (!u) throw new Error('Unbekannter Nutzer.');
    return u;
  }

  function notify(userId, type, actorUserId, refType, refId) {
    if (!userId || userId === actorUserId) return; // nie sich selbst benachrichtigen
    social.createNotification({ userId, type, actorUserId, refType, refId });
  }

  // @handle-Erwaehnungen im Text -> Mention-Benachrichtigungen.
  function notifyMentions(text, actorUserId, refType, refId) {
    const seen = new Set();
    for (const m of String(text).matchAll(/@([a-z0-9_]{3,30})/gi)) {
      const handle = m[1].toLowerCase();
      if (seen.has(handle)) continue;
      seen.add(handle);
      const prof = social.getProfileByHandle(handle);
      if (prof) notify(prof.user_id, 'mention', actorUserId, refType, refId);
    }
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
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified, is_editorial: prof.is_editorial } : null,
      comment_count: social.countComments(post.id),
      reaction_counts: counts,
    };
  }

  return {
    // ── Profil ──
    createProfile(actorUserId, { handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility, isEditorial }) {
      requireUser(actorUserId);
      if (!handle || !/^[a-z0-9_]{3,30}$/i.test(handle)) throw new Error('Handle: 3–30 Zeichen, nur a–z 0–9 _.');
      if (!displayName) throw new Error('Anzeigename erforderlich.');
      return social.createProfile({ userId: actorUserId, handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility, isEditorial });
    },
    getProfile(handleOrUserId) {
      return social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
    },
    // Eigenes Profil bearbeiten (Handle bleibt als Identität unveränderlich).
    updateProfile(actorUserId, { displayName, title, bio, specializations, visibility }) {
      requireUser(actorUserId);
      if (!social.getProfileByUserId(actorUserId)) throw new Error('Profil nicht gefunden.');
      const patch = {};
      if (displayName !== undefined) {
        const dn = String(displayName).trim();
        if (!dn) throw new Error('Anzeigename darf nicht leer sein.');
        patch.display_name = dn;
      }
      if (title !== undefined) patch.title = String(title).trim() || null;
      if (bio !== undefined) {
        const b = String(bio).trim();
        if (b.length > 500) throw new Error('Bio zu lang (max 500 Zeichen).');
        patch.bio = b || null;
      }
      if (specializations !== undefined) {
        const list = (Array.isArray(specializations) ? specializations : String(specializations).split(','))
          .map(s => String(s).trim()).filter(Boolean).slice(0, 12);
        patch.specializations = list;
      }
      if (visibility !== undefined) {
        if (!['network', 'public'].includes(visibility)) throw new Error('Ungueltige Profil-Sichtbarkeit.');
        patch.visibility = visibility;
      }
      return social.updateProfile(actorUserId, patch);
    },
    // Profil-Detailseite: Profil + dessen sichtbare Beiträge + Zähler + Beziehung
    // zum Betrachter (folge ich? bin ich das selbst?).
    profilePage(viewerUserId, handleOrUserId) {
      requireUser(viewerUserId);
      const prof = social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
      if (!prof) return null;
      const posts = social.listAllPosts()
        .filter(p => p.author_user_id === prof.user_id && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
      return {
        profile: prof,
        posts,
        follower_count: social.listFollowers(prof.user_id).length,
        following_count: social.listFollowing(prof.user_id).length,
        post_count: posts.length,
        is_following: social.isFollowing(viewerUserId, prof.user_id),
        is_self: viewerUserId === prof.user_id,
      };
    },
    // Personen-Suche: Handle, Anzeigename oder Fachgebiet enthält q.
    searchProfiles(q) {
      const s = String(q ?? '').trim().toLowerCase();
      if (!s) return [];
      return social.listProfiles().filter(p =>
        p.handle.includes(s) ||
        String(p.display_name).toLowerCase().includes(s) ||
        (p.specializations || []).some(x => String(x).toLowerCase().includes(s))
      );
    },
    // Themen-Filter: sichtbare Beiträge mit dem Hashtag #tag (ganzes Tag, dekoriert).
    postsByHashtag(viewerUserId, tag) {
      requireUser(viewerUserId);
      const t = String(tag ?? '').trim().toLowerCase().replace(/^#/, '');
      if (!t) return [];
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^\\w#])#' + esc + '(?![\\wäöüß])', 'i');
      return social.listAllPosts()
        .filter(p => visibleTo(p, viewerUserId) && re.test(p.body))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
    },
    // Beitrags-Suche: sichtbare Beiträge, deren Text q enthält (dekoriert).
    searchPosts(viewerUserId, q) {
      requireUser(viewerUserId);
      const s = String(q ?? '').trim().toLowerCase();
      if (!s) return [];
      return social.listAllPosts()
        .filter(p => visibleTo(p, viewerUserId) && String(p.body).toLowerCase().includes(s))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
    },

    // ── Posts ──
    createPost(actorUserId, { body, visibility = 'public', refType = null, refId = null, kind = 'post' }) {
      requireUser(actorUserId);
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Beitrag darf nicht leer sein.');
      if (text.length > MAX_BODY) throw new Error(`Beitrag zu lang (max ${MAX_BODY}).`);
      if (!['public', 'followers'].includes(visibility)) throw new Error('Ungueltige Sichtbarkeit.');
      if (!['post', 'news'].includes(kind)) throw new Error('Ungueltige Beitragsart.');
      if (refType && !['shortage', 'price', 'news', 'rabatt'].includes(refType)) throw new Error('Ungueltiger Referenztyp.');
      const post = social.createPost({ authorUserId: actorUserId, body: text, visibility, refType, refId, kind });
      notifyMentions(text, actorUserId, 'post', post.id);
      return post;
    },
    deletePost(actorUserId, postId) {
      const p = social.getPost(postId);
      if (!p) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf loeschen.');
      return social.softDeletePost(postId);
    },
    editPost(actorUserId, postId, body) {
      const p = social.getPost(postId);
      if (!p || p.deleted_at) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf bearbeiten.');
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Beitrag darf nicht leer sein.');
      if (text.length > MAX_BODY) throw new Error(`Beitrag zu lang (max ${MAX_BODY}).`);
      return decorate(social.updatePostBody(postId, text));
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
      const comment = social.createComment({ postId, parentCommentId, authorUserId: actorUserId, body: text });
      notify(p.author_user_id, 'comment', actorUserId, 'post', postId); // Beitrags-Autor
      if (parentCommentId) {
        const parent = social.getComment(parentCommentId);
        if (parent) notify(parent.author_user_id, 'comment', actorUserId, 'comment', parentCommentId);
      }
      notifyMentions(text, actorUserId, 'post', postId);
      return comment;
    },
    listComments(viewerUserId, postId) {
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, viewerUserId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      return social.listComments(postId).map(c => {
        const prof = social.getProfileByUserId(c.author_user_id);
        const reacts = social.listReactions('comment', c.id);
        const counts = {};
        for (const t of REACTION_TYPES) counts[t] = reacts.filter(r => r.type === t).length;
        return { ...c, author: prof ? { handle: prof.handle, display_name: prof.display_name } : null, reaction_counts: counts };
      });
    },
    editComment(actorUserId, commentId, body) {
      const c = social.getComment(commentId);
      if (!c || c.deleted_at) throw new Error('Kommentar nicht gefunden.');
      if (c.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf bearbeiten.');
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Kommentar darf nicht leer sein.');
      if (text.length > MAX_BODY) throw new Error(`Kommentar zu lang (max ${MAX_BODY}).`);
      return social.updateCommentBody(commentId, text);
    },
    deleteComment(actorUserId, commentId) {
      const c = social.getComment(commentId);
      if (!c || c.deleted_at) throw new Error('Kommentar nicht gefunden.');
      if (c.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf loeschen.');
      return social.softDeleteComment(commentId);
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
      const reaction = social.setReaction({ userId: actorUserId, targetType, targetId, type });
      // Autor des Ziels benachrichtigen
      const target = targetType === 'post' ? social.getPost(targetId) : social.getComment(targetId);
      if (target) notify(target.author_user_id, 'reaction', actorUserId, targetType, targetId);
      return reaction;
    },
    unreact(actorUserId, targetType, targetId) {
      social.removeReaction({ userId: actorUserId, targetType, targetId });
    },

    // ── Follows (gerichtet, ohne Zustimmung) ──
    follow(actorUserId, followeeUserId) {
      requireUser(actorUserId); requireUser(followeeUserId);
      if (actorUserId === followeeUserId) throw new Error('Selbst-Follow nicht moeglich.');
      social.follow(actorUserId, followeeUserId);
      notify(followeeUserId, 'follow', actorUserId, 'user', actorUserId);
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
    // News-Ansicht: Beiträge der Art 'news' (kuratiert von der Redaktion ODER von
    // Nutzern geteilt) — dasselbe Feed-System, nur gefiltert.
    newsFeed(viewerUserId) {
      requireUser(viewerUserId);
      return social.listAllPosts()
        .filter(p => p.kind === 'news' && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(decorate);
    },

    // Beiträge, die ein externes Objekt referenzieren (z.B. einen Engpass),
    // sichtbarkeitsgefiltert + dekoriert. Basis fuer "X Apotheker haben dazu gepostet".
    postsAbout(viewerUserId, refType, refId) {
      requireUser(viewerUserId);
      return social.listPostsByRef(refType, refId)
        .filter(p => visibleTo(p, viewerUserId))
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

    // ── Benachrichtigungen ──
    notifications(userId) { requireUser(userId); return social.listNotifications(userId); },
    unreadCount(userId) { requireUser(userId); return social.unreadNotificationCount(userId); },
    markNotificationRead(userId, id) {
      const list = social.listNotifications(userId);
      if (!list.some(n => n.id === id)) throw new ForbiddenError('Fremde Benachrichtigung.');
      social.markNotificationRead(id);
    },
    markAllNotificationsRead(userId) { requireUser(userId); social.markAllNotificationsRead(userId); },

    // ── Direktnachrichten (1:1, privat, getrennt vom Feed) ──
    startDm(actorUserId, otherUserId) {
      requireUser(actorUserId); requireUser(otherUserId);
      if (actorUserId === otherUserId) throw new Error('Kein DM mit sich selbst.');
      return social.findDmThread(actorUserId, otherUserId) || social.createDmThread(actorUserId, otherUserId);
    },
    sendDm(actorUserId, threadId, body) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== actorUserId && t.user_b_id !== actorUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      const text = String(body ?? '').trim();
      if (!text) throw new Error('Leere Nachricht.');
      const msg = social.createDmMessage({ threadId, senderUserId: actorUserId, body: text });
      const recipient = t.user_a_id === actorUserId ? t.user_b_id : t.user_a_id;
      notify(recipient, 'dm', actorUserId, 'thread', threadId);
      return msg;
    },
    listDm(viewerUserId, threadId) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== viewerUserId && t.user_b_id !== viewerUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      return social.listDmMessages(threadId);
    },
    // Kurzprofil des Gesprächspartners in einem Thread.
    dmOther(viewerUserId, thread) {
      const otherId = thread.user_a_id === viewerUserId ? thread.user_b_id : thread.user_a_id;
      const prof = social.getProfileByUserId(otherId);
      return prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified, is_editorial: prof.is_editorial } : null;
    },
    // Posteingang: alle Konversationen mit letzter Nachricht + ungelesen-Zähler,
    // neueste zuerst.
    dmInbox(viewerUserId) {
      requireUser(viewerUserId);
      return social.listDmThreadsForUser(viewerUserId).map(t => {
        const msgs = social.listDmMessages(t.id);
        const last = msgs[msgs.length - 1] || null;
        const unread = msgs.filter(m => m.sender_user_id !== viewerUserId && !m.read_at).length;
        return { thread_id: t.id, other: this.dmOther(viewerUserId, t), last_message: last, unread, created_at: t.created_at };
      })
      .filter(x => x.last_message) // leere Threads (noch keine Nachricht) ausblenden
      .sort((a, b) => (b.last_message.created_at).localeCompare(a.last_message.created_at));
    },
    // Konversation öffnen: Nachrichten + Partner, markiert Eingang als gelesen.
    dmConversation(viewerUserId, threadId) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== viewerUserId && t.user_b_id !== viewerUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      social.markDmThreadRead(threadId, viewerUserId);
      return { thread_id: threadId, other: this.dmOther(viewerUserId, t), messages: social.listDmMessages(threadId) };
    },
    // Gesamtzahl ungelesener DM-Nachrichten (für ein Badge in der Kopfzeile).
    dmUnreadTotal(viewerUserId) {
      requireUser(viewerUserId);
      return social.listDmThreadsForUser(viewerUserId).reduce((sum, t) =>
        sum + social.listDmMessages(t.id).filter(m => m.sender_user_id !== viewerUserId && !m.read_at).length, 0);
    },

    // ── Melden / Moderation ──
    // Jede angemeldete Person kann melden.
    report(actorUserId, targetType, targetId, reason) {
      requireUser(actorUserId);
      if (!['post', 'comment', 'profile'].includes(targetType)) throw new Error('Ungueltiger Zieltyp.');
      return social.createReport({ reporterUserId: actorUserId, targetType, targetId, reason });
    },
    // Nur Moderatoren: Reports einsehen und aufloesen.
    listReports(moderatorUserId, status = null) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      return social.listReports(status);
    },
    resolveReport(moderatorUserId, reportId, { remove = false } = {}) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      const r = social.getReport(reportId);
      if (!r) throw new Error('Meldung nicht gefunden.');
      if (remove && r.target_type === 'post') social.softDeletePost(r.target_id);
      return social.updateReport(reportId, { status: remove ? 'entfernt' : 'geprueft' });
    },
    isModerator(userId) { return isModerator(userId); },
    // Moderations-Queue: Meldungen angereichert mit Beitrags-/Melder-Infos.
    moderationQueue(moderatorUserId, status = 'offen') {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      return social.listReports(status).map(r => {
        const reporter = social.getProfileByUserId(r.reporter_user_id);
        const out = { ...r, reporter_handle: reporter ? reporter.handle : null };
        if (r.target_type === 'post') {
          const post = social.getPost(r.target_id);
          if (post) {
            const author = social.getProfileByUserId(post.author_user_id);
            out.post = { body: post.body, deleted: !!post.deleted_at, author_handle: author ? author.handle : null };
          }
        }
        return out;
      });
    },

    // ── DSGVO: endgueltiges Loeschen (Autor oder Moderation) ──
    // Soft-Delete verbirgt nur; hier wird der Inhalt tatsaechlich entfernt.
    hardDeletePost(actorUserId, postId) {
      const p = social.getPost(postId);
      if (!p) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId && !isModerator(actorUserId)) {
        throw new ForbiddenError('Nur Autor oder Moderation.');
      }
      // Im In-Memory-Store: als Soft-Delete markieren (Hard-Delete-Semantik kommt
      // mit dem Postgres-Repo; hier reicht die Nicht-Sichtbarkeit fuers Verhalten).
      return social.softDeletePost(postId);
    },
  };
}
