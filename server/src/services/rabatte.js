// Rabatt-Modul (Priorität 5) + Feed-Verknüpfung (Priorität 1).
// Top-10 laufende Aktionsangebote (nach Rabatt-Höhe) + "Nutzer postet dazu"
// (posts.ref_type='rabatt').
export function createRabatteService(rabatteRepo, social) {
  return {
    // Top-10-Ranking, je Aktion mit Aktivitäts-Zähler aus dem Feed.
    top10(viewerUserId, { country = null, q = null } = {}) {
      return rabatteRepo.listTop10({ country, q }).map(r => ({
        ...r,
        post_count: social.postsAbout(viewerUserId, 'rabatt', r.id).length,
      }));
    },
    get(id) { return rabatteRepo.get(id); },

    withActivity(viewerUserId, id) {
      const rabatt = rabatteRepo.get(id);
      if (!rabatt) return null;
      const posts = social.postsAbout(viewerUserId, 'rabatt', id);
      return { rabatt, post_count: posts.length, posts };
    },

    // Aus einer Aktion heraus posten (Beitrag referenziert die Aktion).
    postAbout(actorUserId, id, { body, visibility = 'public' }) {
      const rabatt = rabatteRepo.get(id);
      if (!rabatt) throw new Error('Rabatt-Aktion nicht gefunden.');
      return social.createPost(actorUserId, { body, visibility, refType: 'rabatt', refId: id });
    },
  };
}
