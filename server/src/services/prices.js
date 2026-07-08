// Preis-Modul (Priorität 3) + Feed-Verknüpfung (Priorität 1).
// Preisvergleich je Präparat (mehrere Lieferanten) + "Nutzer postet dazu"
// (posts.ref_type='price').
export function createPricesService(pricesRepo, social) {
  // Ersparnis je Vergleichsgruppe: günstigster vs. teuerster Anbieter (pro Packung).
  function withSavings(g) {
    const offers = g.offers.map(o => ({ ...o }));
    const aeps = offers.map(o => Number(o.aep)).filter(n => Number.isFinite(n));
    const min = aeps.length ? Math.min(...aeps) : null;
    const max = aeps.length ? Math.max(...aeps) : null;
    const saving_abs = (min != null && max != null) ? Math.round((max - min) * 100) / 100 : 0;
    const saving_pct = (max && max > 0) ? Math.round(((max - min) / max) * 1000) / 10 : 0;
    const best = offers.find(o => Number(o.aep) === min) || null;
    return { ...g, offers, best_supplier: best ? best.supplier : null, best_aep: min, saving_abs, saving_pct };
  }

  return {
    // Preisvergleich, je Gruppe mit Aktivitäts-Zähler pro Angebot + Ersparnis.
    comparisons(viewerUserId) {
      return pricesRepo.listComparisons().map(g => withSavings({
        ...g,
        offers: g.offers.map(o => ({ ...o, post_count: social.postsAbout(viewerUserId, 'price', o.id).length })),
      }));
    },

    // Gesamt-Ersparnis: wie viel bei optimaler Lieferantenwahl je Packung frei wird.
    savingsSummary() {
      const groups = pricesRepo.listComparisons().map(withSavings).filter(g => g.offers.length >= 2 && g.saving_abs > 0);
      const total_abs = Math.round(groups.reduce((s, g) => s + g.saving_abs, 0) * 100) / 100;
      const top = [...groups].sort((a, b) => b.saving_abs - a.saving_abs).slice(0, 3)
        .map(g => ({ bezeichnung: g.bezeichnung, best_supplier: g.best_supplier, saving_abs: g.saving_abs, saving_pct: g.saving_pct }));
      return { count: groups.length, total_abs, top };
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
