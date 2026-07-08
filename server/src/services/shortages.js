// Engpass-Modul (Priorität 2) + Verknüpfung mit dem Feed (Priorität 1).
// Liest Engpässe (mit Herkunfts-Flag) und verbindet sie mit den Beiträgen, die
// sie referenzieren ("X Apotheker haben dazu gepostet").
import { cleanSourceUrl } from '../domain/media.js';

const STATUS_LABEL = { kritisch: 'Kritischer Engpass', eingeschraenkt: 'Eingeschränkt lieferbar', verfuegbar: 'Wieder verfügbar' };
const VALID_STATUS = Object.keys(STATUS_LABEL);

export function createShortagesService(shortagesRepo, social) {
  return {
    list() { return shortagesRepo.list(); },
    get(id) { return shortagesRepo.get(id); },

    // Engpass + Feed-Aktivität (sichtbarkeitsgefiltert fuer den Betrachter).
    withActivity(viewerUserId, id) {
      const shortage = shortagesRepo.get(id);
      if (!shortage) return null;
      const posts = social.postsAbout(viewerUserId, 'shortage', id);
      return { shortage, post_count: posts.length, posts };
    },

    // Aus einem Engpass heraus in den Feed posten (Beitrag referenziert den Engpass).
    postAbout(actorUserId, id, { body, visibility = 'public' }) {
      const shortage = shortagesRepo.get(id);
      if (!shortage) throw new Error('Engpass nicht gefunden.');
      return social.createPost(actorUserId, { body, visibility, refType: 'shortage', refId: id });
    },

    // Liste mit Aktivitäts-Zähler pro Engpass (fuer das Dashboard).
    listWithCounts(viewerUserId) {
      return shortagesRepo.list().map(s => ({
        ...s,
        post_count: social.postsAbout(viewerUserId, 'shortage', s.id).length,
        watched: shortagesRepo.isWatched(viewerUserId, s.wirkstoff),
      }));
    },

    // ── Engpass-Status ändern (nur Redaktion/Moderation) + Watcher benachrichtigen ──
    // Sicherheitsrelevante Aussage => Quelle (http[s]-Link) ist Pflicht (CLAUDE.md).
    updateStatus(actorUserId, id, { status, sourceUrl }) {
      if (!social.isModerator(actorUserId)) {
        const e = new Error('Nur Redaktion/Moderation darf den Status ändern.');
        e.status = 403; throw e;
      }
      if (!VALID_STATUS.includes(status)) throw new Error('Unbekannter Status.');
      const quelle = cleanSourceUrl(sourceUrl); // wirft ohne gültigen Link
      if (!quelle) throw new Error('Quelle (Link) ist erforderlich.');
      const before = shortagesRepo.get(id);
      if (!before) { const e = new Error('Engpass nicht gefunden.'); e.status = 404; throw e; }
      const today = new Date().toISOString().slice(0, 10);
      const updated = shortagesRepo.setStatus(id, { status, quelle, provenance: 'editorial', gemeldet_am: today });

      // Nur bei tatsächlicher Änderung die Beobachter:innen informieren.
      if (before.status !== status) {
        const label = `${updated.wirkstoff} · ${STATUS_LABEL[status]}`;
        for (const uid of shortagesRepo.usersWatching(updated.wirkstoff)) {
          social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId, refType: 'shortage', refId: id, label });
        }
      }
      return updated;
    },

    // ── Beobachtungsliste: Wirkstoffe, die ein:e Apotheker:in im Blick behalten will ──
    watch(userId, wirkstoff) {
      const w = String(wirkstoff || '').trim();
      if (!w) throw new Error('Wirkstoff fehlt.');
      if (w.length > 120) throw new Error('Wirkstoff zu lang.');
      shortagesRepo.addWatch(userId, w);
      return this.myWatchlist(userId);
    },
    unwatch(userId, wirkstoff) {
      shortagesRepo.removeWatch(userId, wirkstoff);
      return this.myWatchlist(userId);
    },

    // Beobachtete Wirkstoffe mit aktuellem Engpass-Status (rot = kritisch).
    // Kein passender Engpass-Eintrag => Status 'unauffaellig' (derzeit keine Meldung).
    myWatchlist(userId) {
      const all = shortagesRepo.list(); // nach Kritikalität sortiert
      const byWirkstoff = new Map();
      for (const s of all) {
        const k = s.wirkstoff.trim().toLowerCase();
        if (!byWirkstoff.has(k)) byWirkstoff.set(k, s); // erster Treffer = kritischster
      }
      return shortagesRepo.listWatch(userId).map(w => {
        const s = byWirkstoff.get(w.trim().toLowerCase());
        return {
          wirkstoff: w,
          status: s ? s.status : 'unauffaellig',
          bezeichnung: s ? s.bezeichnung : null,
          shortage_id: s ? s.id : null,
          quelle: s ? s.quelle : null,
          provenance: s ? s.provenance : null,
        };
      }).sort((a, b) => {
        const rank = { kritisch: 3, eingeschraenkt: 2, verfuegbar: 1, unauffaellig: 0 };
        return (rank[b.status] || 0) - (rank[a.status] || 0) || a.wirkstoff.localeCompare(b.wirkstoff);
      });
    },
  };
}
