// Übergreifende Suche (Priorität 7). Ein Suchbegriff, gebündelte Treffer aus
// allen Modulen: Personen, Beiträge, Engpässe, Preise, Rabatte. Sichtbarkeit von
// Beiträgen wird über die Social-Schicht (visibleTo) erzwungen. Marktdaten sind
// nicht personenbezogen und daher frei durchsuchbar.
export function createSearchService({ social, shortagesRepo, pricesRepo, rabatteRepo }) {
  const norm = (v) => String(v ?? '').toLowerCase();

  return {
    search(viewerUserId, query, { limit = 10 } = {}) {
      const q = norm(query).trim();
      if (!q) return { query: '', people: [], posts: [], shortages: [], prices: [], rabatte: [], total: 0 };

      const match = (...fields) => fields.some(f => norm(f).includes(q));

      const people = social.searchProfiles(q).slice(0, limit).map(p => ({
        handle: p.handle, display_name: p.display_name, verified: p.verified,
        is_editorial: p.is_editorial, specializations: p.specializations || [],
      }));

      const posts = social.searchPosts(viewerUserId, q).slice(0, limit);

      const shortages = shortagesRepo.list()
        .filter(s => match(s.wirkstoff, s.bezeichnung, s.grund))
        .slice(0, limit);

      const prices = pricesRepo.listFlat()
        .filter(p => match(p.bezeichnung, p.wirkstoff, p.supplier))
        .sort((a, b) => a.aep - b.aep)
        .slice(0, limit);

      const rabatte = rabatteRepo.listFlat()
        .filter(r => match(r.bezeichnung, r.wirkstoff, r.supplier))
        .sort((a, b) => b.rabatt_pct - a.rabatt_pct)
        .slice(0, limit);

      const total = people.length + posts.length + shortages.length + prices.length + rabatte.length;
      return { query: q, people, posts, shortages, prices, rabatte, total };
    },
  };
}
