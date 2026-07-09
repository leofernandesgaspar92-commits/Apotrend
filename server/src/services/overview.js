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
      return {
        shortages: { kritisch: kritisch.length, total: sh.length, top: kritisch.slice(0, 3) },
        watchlist: { total: watchlist.length, items: watchlist, alerts: watchlist.filter(w => w.status === 'kritisch' || w.status === 'eingeschraenkt').length },
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
