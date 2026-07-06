// network-Modul (Vernetzung ZWISCHEN Organisationen). Anders als collab ist der
// Zugriff hier bewusst org-uebergreifend — aber nur ueber kontrollierte Flaechen
// (Profil / Feed / Direktnachricht) mit EXPLIZITER Sichtbarkeit. Der/die Handelnde
// agiert stets im Namen der EIGENEN Organisation (Mitgliedschaft wird geprueft).
import { can } from '../domain/roles.js';
import { ForbiddenError } from './orgAuth.js';

export function createNetworkService(repo, orgAuth) {
  function requireMember(userId, orgId) {
    const m = orgAuth.membershipOf(userId, orgId);
    if (!m) throw new ForbiddenError('Kein Mitglied dieser Organisation.');
    return m;
  }
  function requireCap(userId, orgId, cap) {
    const m = requireMember(userId, orgId);
    if (!can(m.role, cap)) throw new ForbiddenError(`Rolle "${m.role}" darf "${cap}" nicht.`);
    return m;
  }
  function connected(orgX, orgY) {
    const c = repo.findConnection(orgX, orgY);
    return !!c && c.status === 'accepted';
  }
  // Darf viewerOrg diesen Beitrag/dieses Profil sehen?
  function postVisibleTo(post, viewerOrgId) {
    return post.author_org_id === viewerOrgId ||
      post.visibility === 'network' ||
      (post.visibility === 'contacts_only' && connected(viewerOrgId, post.author_org_id));
  }

  return {
    // ── Profil ──────────────────────────────────────────────────────────────
    getProfile(viewerOrgId, targetOrgId) {
      const org = repo.getOrganization(targetOrgId);
      if (!org) return null;
      const isSelf = viewerOrgId === targetOrgId;
      if (org.profile_visibility === 'contacts_only' && !isSelf && !connected(viewerOrgId, targetOrgId)) {
        return null; // nicht sichtbar fuer Fremde
      }
      return {
        id: org.id, type: org.type, name: org.name,
        ort: org.ort, plz: org.plz, bundesland: org.bundesland,
        specializations: org.specializations, profile_text: org.profile_text,
      };
    },

    // ── Kontakte ────────────────────────────────────────────────────────────
    requestConnection(actorUserId, fromOrgId, toOrgId) {
      requireCap(actorUserId, fromOrgId, 'manage_network');
      if (fromOrgId === toOrgId) throw new Error('Selbstverbindung nicht moeglich.');
      if (!repo.getOrganization(toOrgId)) throw new Error('Zielorganisation unbekannt.');
      return repo.findConnection(fromOrgId, toOrgId) || repo.createConnection({ requesterOrgId: fromOrgId, addresseeOrgId: toOrgId });
    },
    respondConnection(actorUserId, orgId, connectionId, accept) {
      requireCap(actorUserId, orgId, 'manage_network');
      const c = repo.getConnection(connectionId);
      if (!c) throw new Error('Verbindung nicht gefunden.');
      if (c.addressee_org_id !== orgId) throw new ForbiddenError('Nur die angefragte Organisation darf antworten.');
      return repo.updateConnection(connectionId, { status: accept ? 'accepted' : 'blocked', responded_at: new Date().toISOString() });
    },
    listConnections(actorUserId, orgId) {
      requireCap(actorUserId, orgId, 'manage_network');
      return repo.listConnectionsForOrg(orgId);
    },
    areConnected(orgX, orgY) { return connected(orgX, orgY); },

    // ── Feed ────────────────────────────────────────────────────────────────
    createPost(actorUserId, orgId, { kind, title = null, body, visibility = 'network' }) {
      requireCap(actorUserId, orgId, 'network_post');
      if (!body || !String(body).trim()) throw new Error('Beitrag braucht Inhalt.');
      if (!['frage', 'bestand_angebot', 'bestand_gesucht', 'news_geteilt', 'ankuendigung'].includes(kind)) throw new Error('Ungueltige Beitragsart.');
      if (!['network', 'contacts_only'].includes(visibility)) throw new Error('Ungueltige Sichtbarkeit.');
      return repo.createFeedPost({ authorOrgId: orgId, authorUserId: actorUserId, kind, title, body, visibility });
    },
    // Feed aus Sicht einer Organisation: eigene + oeffentliche + (nur-Kontakte, wenn verbunden).
    listFeed(viewerUserId, viewerOrgId) {
      requireMember(viewerUserId, viewerOrgId);
      return repo.listAllFeedPosts().filter(p => postVisibleTo(p, viewerOrgId));
    },
    // Fachliche Antwort (kein Like-Zaehler). Nur, wenn der Beitrag sichtbar ist.
    respondToPost(actorUserId, orgId, postId, body) {
      requireCap(actorUserId, orgId, 'network_post');
      const post = repo.getFeedPost(postId);
      if (!post) throw new Error('Beitrag nicht gefunden.');
      if (!postVisibleTo(post, orgId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      if (!body || !String(body).trim()) throw new Error('Leere Antwort.');
      return repo.createPostResponse({ postId, authorOrgId: orgId, authorUserId: actorUserId, body });
    },
    listResponses(viewerUserId, viewerOrgId, postId) {
      requireMember(viewerUserId, viewerOrgId);
      const post = repo.getFeedPost(postId);
      if (!post) throw new Error('Beitrag nicht gefunden.');
      if (!postVisibleTo(post, viewerOrgId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      return repo.listPostResponses(postId);
    },

    // ── Direktnachrichten (1:1 zwischen Organisationen) ──────────────────────
    startThread(actorUserId, fromOrgId, otherOrgId) {
      requireCap(actorUserId, fromOrgId, 'network_dm');
      if (fromOrgId === otherOrgId) throw new Error('Kein Thread mit sich selbst.');
      if (!repo.getOrganization(otherOrgId)) throw new Error('Zielorganisation unbekannt.');
      return repo.findThread(fromOrgId, otherOrgId) || repo.createThread({ orgAId: fromOrgId, orgBId: otherOrgId });
    },
    sendMessage(actorUserId, orgId, threadId, body) {
      requireCap(actorUserId, orgId, 'network_dm');
      const t = repo.getThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.org_a_id !== orgId && t.org_b_id !== orgId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      if (!body || !String(body).trim()) throw new Error('Leere Nachricht.');
      return repo.createDirectMessage({ threadId, senderOrgId: orgId, senderUserId: actorUserId, body });
    },
    listMessages(viewerUserId, orgId, threadId) {
      requireMember(viewerUserId, orgId);
      const t = repo.getThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.org_a_id !== orgId && t.org_b_id !== orgId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      return repo.listDirectMessages(threadId);
    },
  };
}
