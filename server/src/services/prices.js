// Preis-Modul (Priorität 3) + Feed-Verknüpfung (Priorität 1).
// Preisvergleich je Präparat (mehrere Lieferanten) + "Nutzer postet dazu"
// (posts.ref_type='price').
export function createPricesService(pricesRepo, social) {
  return {
    // Preisvergleich, je Gruppe mit Aktivitäts-Zähler pro Angebot.
    comparisons(viewerUserId) {
      return pricesRepo.listComparisons().map(g => ({
        ...g,
        offers: g.offers.map(o => ({ ...o, post_count: social.postsAbout(viewerUserId, 'price', o.id).length })),
      }));
    },
    get(id) { return pricesRepo.get(id); },

    withActivity(viewerUserId, id) {
      const price = pricesRepo.get(id);
      if (!price) return null;
      const posts = social.postsAbout(viewerUserId, 'price', id);
      return { price, post_count: posts.length, posts };
    },

    // Aus einem Preis-Eintrag heraus posten (Beitrag referenziert das Angebot).
    postAbout(actorUserId, id, { body, visibility = 'public' }) {
      const price = pricesRepo.get(id);
      if (!price) throw new Error('Preis-Eintrag nicht gefunden.');
      return social.createPost(actorUserId, { body, visibility, refType: 'price', refId: id });
    },
  };
}
