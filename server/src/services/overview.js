// Persönliche Startübersicht ("Für dich"): bündelt auf einen Blick, was für eine
// Apothekerin/einen Apotheker gerade zählt — kritische Engpässe, offene Angebote/
// Gesuche, ungelesene Benachrichtigungen/Nachrichten, Top-Rabatt. Reine Komposition
// bereits getesteter Dienste.
export function createOverviewService({ shortages, exchange, social, rabatte, prices }) {
  return {
    forUser(userId) {
      const sh = shortages.listWithCounts(userId);
      const kritisch = sh.filter(s => s.status === 'kritisch');
      const ex = exchange.list(userId, {}); // offene Einträge
      const topRabatte = rabatte.top10(userId);
      const topR = topRabatte[0] || null;
      const expiringSoon = topRabatte.filter(r => r.expiring_soon);
      const watchlist = shortages.myWatchlist(userId);

      // Bezugsquellen zu beobachteten Wirkstoffen: offene "Biete"-Einträge, deren
      // Bezeichnung einen beobachteten Wirkstoff enthält — hilft beim Beschaffen
      // während eines Engpasses. Nur wo es Angebote gibt.
      const openBiete = exchange.list(userId, { kind: 'biete', status: 'offen' });
      const watchOffers = watchlist.map(w => {
        const key = w.wirkstoff.trim().toLowerCase();
        const offers_count = openBiete.filter(e => (e.bezeichnung || '').toLowerCase().includes(key)).length;
        return { wirkstoff: w.wirkstoff, status: w.status, offers_count };
      }).filter(x => x.offers_count > 0);

      // Aktionen zu beobachteten Wirkstoffen: verbindet Beobachtungsliste mit laufenden
      // Rabatten (beste Aktion je beobachtetem Wirkstoff). Doppelnutzen auf einen Blick.
      const dealByWirkstoff = new Map();
      for (const r of topRabatte) {
        const k = (r.wirkstoff || '').trim().toLowerCase();
        if (!k) continue;
        const cur = dealByWirkstoff.get(k);
        if (!cur || r.rabatt_pct > cur.rabatt_pct) dealByWirkstoff.set(k, r);
      }
      const watchDeals = watchlist
        .map(w => ({ wirkstoff: w.wirkstoff, deal: dealByWirkstoff.get(w.wirkstoff.trim().toLowerCase()) || null }))
        .filter(x => x.deal)
        .map(x => ({
          wirkstoff: x.wirkstoff,
          bezeichnung: x.deal.bezeichnung, supplier: x.deal.supplier,
          rabatt_pct: x.deal.rabatt_pct, aktionspreis: x.deal.aktionspreis,
          gueltig_bis: x.deal.gueltig_bis, days_left: x.deal.days_left, expiring_soon: x.deal.expiring_soon,
        }));

      return {
        shortages: { kritisch: kritisch.length, total: sh.length, top: kritisch.slice(0, 3) },
        watchlist: { total: watchlist.length, items: watchlist, alerts: watchlist.filter(w => w.status === 'kritisch' || w.status === 'eingeschraenkt').length },
        watch_deals: watchDeals,
        watch_offers: watchOffers,
        exchange: {
          biete: ex.filter(e => e.kind === 'biete').length,
          suche: ex.filter(e => e.kind === 'suche').length,
          recent: ex.slice(0, 3),
        },
        notifications: { unread: social.unreadCount(userId), dm_unread: social.dmUnreadTotal(userId) },
        top_rabatt: topR,
        rabatte_expiring: { count: expiringSoon.length, soonest: expiringSoon.sort((a, b) => a.days_left - b.days_left)[0] || null },
        savings: prices ? prices.savingsSummary() : null,
      };
    },
  };
}
