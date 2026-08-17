// Persönliche Startübersicht ("Für dich"): bündelt auf einen Blick, was für eine
// Apothekerin/einen Apotheker gerade zählt — kritische Engpässe, offene Angebote/
// Gesuche, ungelesene Benachrichtigungen/Nachrichten, Top-Rabatt. Reine Komposition
// bereits getesteter Dienste.
export function createOverviewService({ shortages, exchange, social, rabatte, prices, amr = null }) {
  return {
    forUser(userId, opts = {}) {
      const sh = shortages.listWithCounts(userId);
      const kritisch = sh.filter(s => s.status === 'kritisch');
      // Aktive Antibiotika-Engpässe (nicht "wieder verfügbar") — für die AMR-Kachel.
      const antibiotika = amr ? sh.filter(s => s.status !== 'verfuegbar' && amr.isAntibiotic(s.wirkstoff)).length : 0;
      const ex = exchange.list(userId, {}); // offene Einträge
      const topRabatte = rabatte.top10(userId);
      const topR = topRabatte[0] || null;
      const expiringSoon = topRabatte.filter(r => r.expiring_soon);
      const watchlist = shortages.myWatchlist(userId);

      // Wochenrückblick: Änderungen an beobachteten Wirkstoffen der letzten 7 Tage
      // (neu gemeldet / wieder verfügbar / Status geändert). Ein kompakter „Was hat
      // sich getan"-Blick, den flüchtige Push-Benachrichtigungen allein nicht bieten —
      // eine leicht zu überfliegende Wochen-Zusammenfassung fürs Team.
      const weekChanged = watchlist.filter(w => w.week_change);
      const weekReview = {
        total: weekChanged.length,
        neu: weekChanged.filter(w => w.week_change.kind === 'neu'),
        wieder_verfuegbar: weekChanged.filter(w => w.week_change.kind === 'wieder_verfuegbar'),
        status: weekChanged.filter(w => w.week_change.kind === 'status'),
      };

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
        .map(w => ({ wirkstoff: w.wirkstoff, alert_pct: w.alert_pct || null, deal: dealByWirkstoff.get(w.wirkstoff.trim().toLowerCase()) || null }))
        .filter(x => x.deal)
        .map(x => ({
          wirkstoff: x.wirkstoff, alert_pct: x.alert_pct,
          bezeichnung: x.deal.bezeichnung, supplier: x.deal.supplier,
          rabatt_pct: x.deal.rabatt_pct, aktionspreis: x.deal.aktionspreis,
          ersparnis: x.deal.ersparnis, min_menge: x.deal.min_menge,
          gueltig_bis: x.deal.gueltig_bis, days_left: x.deal.days_left, expiring_soon: x.deal.expiring_soon,
        }));

      // Eigene „Biete"-Angebote, deren Verfallsdatum naht (≤ 30 Tage) oder bereits
      // überschritten ist: aktiver Anstoß, Restbestand rechtzeitig abzugeben, bevor er
      // verfällt — spart Geld und vermeidet Arzneimittel-Verschwendung. days_until_expiry
      // kommt bereits aus exchange.mine(); expired = Datum liegt in der Vergangenheit.
      const EXPIRY_SOON_DAYS = 30;
      const myOffers = exchange.mine(userId, { status: 'offen' }).filter(e => e.kind === 'biete');
      const expiringOffers = myOffers
        .filter(e => e.days_until_expiry != null && e.days_until_expiry <= EXPIRY_SOON_DAYS)
        .sort((a, b) => a.days_until_expiry - b.days_until_expiry)
        .map(e => ({
          id: e.id, bezeichnung: e.bezeichnung, menge: e.menge || null,
          ablauf: e.ablauf, days_until_expiry: e.days_until_expiry,
          expired: e.days_until_expiry < 0, match_count: e.match_count || 0,
        }));

      // Eigene, lange offene Community-Engpass-Meldungen (≥14 Tage, noch nicht „wieder
      // lieferbar"): Anstoß an die Melder:in, den Status zu prüfen/aktualisieren. Hält die
      // Engpass-Daten vertrauenswürdig — direkt aus dem Owner-Prinzip „sicherheitsrelevante
      // Aussagen (Engpass) aktuell halten". Nur eigene Community-Meldungen, nie fremde.
      const STALE_REPORT_DAYS = 14;
      const myStaleReports = sh
        .filter(s => s.provenance === 'community' && s.is_reporter && s.status !== 'verfuegbar' && (s.days_reported || 0) >= STALE_REPORT_DAYS)
        .map(s => ({ id: s.id, wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung, status: s.status, days_reported: s.days_reported, confirm_count: s.confirm_count || 0 }))
        .sort((a, b) => (b.days_reported || 0) - (a.days_reported || 0));

      // Eigene offene Gesuche mit passenden Angeboten: schließt die Nachfrageseite —
      // wer per „Ich suche das" Bedarf meldet, sieht hier, wo inzwischen „Biete"-Angebote
      // existieren, und springt direkt zu den Treffern. match_count = eindeutige Anbieter.
      const mySeeks = exchange.mine(userId, { status: 'offen' }).filter(e => e.kind === 'suche');
      const seeksWithMatches = mySeeks
        .filter(e => (e.match_count || 0) > 0)
        .map(e => ({ id: e.id, bezeichnung: e.bezeichnung, match_count: e.match_count }))
        .sort((a, b) => b.match_count - a.match_count);

      // Rabatt-Alarm: wenn die aktuelle beste Aktion die gesetzte Schwelle erreicht und diese
      // konkrete Aktion noch nicht gemeldet wurde -> einmalig benachrichtigen (Dedup). Läuft
      // bei jedem Übersichts-Aufruf; sobald Live-Daten angeschlossen sind, greift es automatisch.
      // Rechts-Gate: In Ländern mit Rabatt-/Werbeverbot (deals gesperrt) dürfen auch keine
      // Rabatt-Push-Meldungen ausgelöst werden — sonst umgeht die Benachrichtigung die Sperre.
      if (social.pushNotification && shortages.wasAlerted && !opts.dealsBlocked) {
        for (const wd of watchDeals) {
          if (!wd.alert_pct || wd.rabatt_pct < wd.alert_pct) continue;
          const dealKey = `${wd.wirkstoff.trim().toLowerCase()}|${wd.gueltig_bis}|${wd.rabatt_pct}`;
          if (shortages.wasAlerted(userId, dealKey)) continue;
          shortages.markAlerted(userId, dealKey);
          social.pushNotification({ userId, type: 'price_alert', refType: 'wirkstoff', refId: wd.wirkstoff, label: `${wd.wirkstoff} · −${wd.rabatt_pct}%` });
        }
      }

      return {
        shortages: { kritisch: kritisch.length, total: sh.length, antibiotika, top: kritisch.slice(0, 3) },
        watchlist: { total: watchlist.length, items: watchlist, alerts: watchlist.filter(w => w.status === 'kritisch' || w.status === 'eingeschraenkt').length },
        week_review: weekReview,
        watch_deals: watchDeals,
        watch_offers: watchOffers,
        expiring_offers: { count: expiringOffers.length, items: expiringOffers.slice(0, 5) },
        my_reports: { count: myStaleReports.length, items: myStaleReports.slice(0, 5) },
        my_seeks: { open: mySeeks.length, with_matches: seeksWithMatches.length, items: seeksWithMatches.slice(0, 3) },
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
