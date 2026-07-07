// Engpass-Modul (Priorität 2) + Verknüpfung mit dem Feed (Priorität 1).
// Liest Engpässe (mit Herkunfts-Flag) und verbindet sie mit den Beiträgen, die
// sie referenzieren ("X Apotheker haben dazu gepostet").
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
      }));
    },
  };
}
