// Übergreifende Suche (Priorität 7). Ein Suchbegriff, gebündelte Treffer aus
// allen Modulen: Personen, Beiträge, Engpässe, Preise, Rabatte. Sichtbarkeit von
// Beiträgen wird über die Social-Schicht (visibleTo) erzwungen. Marktdaten sind
// nicht personenbezogen und daher frei durchsuchbar.
export function createSearchService({ social, shortagesRepo, pricesRepo, rabatteRepo, exchange = null, rxnorm = null }) {
  const norm = (v) => String(v ?? '').toLowerCase();

  return {
    /**
     * Suche mit Wirkstoff-Verstaendnis.
     *
     * `rxnorm` ist optional und ADDITIV: Es erweitert den Suchbegriff um
     * Namensvarianten (Pantoprazol <-> Pantoloc). Faellt der Dienst aus oder
     * kennt er den Begriff nicht, sucht die Anwendung exakt wie vorher — die
     * Ergaenzung kann die Suche also nur besser machen, nie schlechter.
     *
     * Bewusst asynchron: Der Nachschlag geht ueber das Netz. Die uebrigen
     * Treffer entstehen weiterhin rein im Speicher.
     */
    async search(viewerUserId, query, { limit = 10, expand = true } = {}) {
      const q = norm(query).trim();
      if (!q) return { query: '', people: [], posts: [], shortages: [], prices: [], rabatte: [], exchange: [], total: 0, synonyms: [] };

      // Namensvarianten dazuholen. Nur fuer die Marktdaten (Engpaesse, Preise,
      // Rabatte, Boerse) — bei Personen und Beitraegen waere ein Wirkstoff-
      // Synonym sinnlos und braechte Zufallstreffer.
      let synonyms = [];
      if (rxnorm && expand) {
        try { synonyms = await rxnorm.synonyms(q); } catch { synonyms = []; }
      }
      const begriffe = [q, ...synonyms.map(norm)];
      const match = (...fields) => begriffe.some((b) => fields.some((f) => norm(f).includes(b)));

      const people = social.searchProfiles(q).slice(0, limit).map(p => ({
        handle: p.handle, display_name: p.display_name, verified: p.verified,
        is_editorial: p.is_editorial, specializations: p.specializations || [],
        avatar_url: p.avatar_url || null,
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

      // Offene Biete/Suche-Einträge im Bestandsaustausch (mit Autor-Profil).
      const exchangeHits = exchange ? exchange.list(viewerUserId, { q }).slice(0, limit) : [];

      const total = people.length + posts.length + shortages.length + prices.length + rabatte.length + exchangeHits.length;
      // `synonyms` gehoert in die Antwort: Die Oberflaeche kann damit sagen,
      // WARUM ein Treffer dabei ist („auch gesucht: Pantoloc"). Ohne diesen
      // Hinweis wirkt ein Treffer, der den Suchbegriff nicht enthaelt, wie ein
      // Fehler der Suche.
      return { query: q, people, posts, shortages, prices, rabatte, exchange: exchangeHits, total, synonyms };
    },
  };
}
