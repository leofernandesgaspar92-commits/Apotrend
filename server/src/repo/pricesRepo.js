// In-Memory-Store für Preise (Repository-Seam). Beim Deployment ersetzbar durch
// echte Großhandels-/Marktdaten (provenance='verified'). Hier: kuratierte
// Referenzdaten (provenance='reference'), Herkunft ehrlich gekennzeichnet.
//
// ──────────────────────────────────────────────────────────────────────────
// WARUM DIE LIEFERANTEN „Großhandel A/B/C" HEISSEN
// ──────────────────────────────────────────────────────────────────────────
// Bis zum 06.09.2026 standen hier die Namen real existierender österreichischer
// Großhändler — mit Preisen, die nicht von ihnen stammen. Intern war das als
// provenance='reference' sauber gekennzeichnet, und die Oberfläche zeigt
// „📌 Referenzdaten".
//
// Das genügt nicht. Eine Apothekerin liest „<echter Name>: 3,01 €" als Preis
// dieses Hauses; das Wort „Referenzdaten" erklärt ihr nicht, dass die Zahl
// erfunden ist. Und ein Großhändler, der seinen Namen neben einem nie
// gemachten Preis findet, hat ein berechtigtes Anliegen — wettbewerbs- wie
// äußerungsrechtlich.
//
// Neutrale Namen kosten nichts und nehmen dem Vergleich nichts: Der Nutzen
// dieser Ansicht liegt in der Mechanik (mehrere Anbieter, Verlauf, Ersparnis),
// nicht darin, welcher Name danebensteht. Sobald ECHTE Lieferantendaten
// vorliegen, kommen mit ihnen auch die echten Namen zurück — dann aber mit
// provenance='verified', und dann stimmt die Zuordnung auch.
import crypto from 'node:crypto';

// Mehrere Lieferanten je Präparat -> Preisvergleich. series = letzte Preise.
// Oesterreichische Referenzdaten (EUR, AT-Praeparate, AT-Preisniveau).
// Bis zum 06.09.2026 trugen sie kein Land und erschienen deshalb in allen
// 16 Laendern — ein kenianischer Einkauf haette danach kalkuliert. Dieselbe
// Entscheidung wie bei Engpaessen und Rabatten, aus demselben Grund.
const SEED_LAND = 'AT';
const SEED = [
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Großhandel A', aep: 3.98, prev_aep: 3.72, series: [3.55, 3.60, 3.72, 3.98] },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Großhandel B',         aep: 3.01, prev_aep: 3.05, series: [3.10, 3.08, 3.05, 3.01] },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Großhandel C',      aep: 4.10, prev_aep: 4.02, series: [3.95, 4.00, 4.02, 4.10] },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Großhandel A', aep: 6.80, prev_aep: 6.95, series: [7.10, 7.00, 6.95, 6.80] },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Großhandel B',         aep: 7.05, prev_aep: 7.05, series: [7.05, 7.05, 7.05, 7.05] },
  { bezeichnung: 'Pantoprazol 40 mg',   wirkstoff: 'Pantoprazol',  supplier: 'Großhandel C',      aep: 5.08, prev_aep: 4.90, series: [4.80, 4.85, 4.90, 5.08] },
  { bezeichnung: 'Ibuprofen 400 mg',    wirkstoff: 'Ibuprofen',    supplier: 'Großhandel A', aep: 2.35, prev_aep: 2.20, series: [2.10, 2.15, 2.20, 2.35] },
];

export function createPricesRepo({ seed = true } = {}) {
  const prices = new Map();
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  function trendPct(aep, prev) {
    if (!prev || prev === 0) return 0;
    return Math.round(((aep - prev) / prev) * 1000) / 10; // eine Nachkommastelle
  }

  function upsert(p) {
    const row = {
      id: p.id || uuid(), bezeichnung: p.bezeichnung, wirkstoff: p.wirkstoff ?? null,
      supplier: p.supplier, aep: p.aep, prev_aep: p.prev_aep ?? null, currency: p.currency || 'EUR',
      series: p.series ?? [], trend_pct: trendPct(p.aep, p.prev_aep),
      // Land, fuer das dieser Preis gilt. `null` heisst ausdruecklich
      // „ueberall" und bleibt moeglich; ein leerer String wird dazu
      // normalisiert, sonst entstuende eine Zeile, die kein Filter je findet.
      country: p.country === undefined ? null : (p.country ? String(p.country).toUpperCase() : null),
      provenance: p.provenance || 'reference', quelle: p.quelle || 'Referenzdaten', updated_at: now(),
    };
    prices.set(row.id, row);
    return { ...row };
  }

  if (seed) SEED.forEach(p => upsert({ ...p, country: SEED_LAND }));

  return {
    upsert,
    // Live-/Referenz-Feed komplett ersetzen (Preise haben keine Community-Meldungen —
    // alle Einträge stammen aus dem Feed). Gibt die Anzahl übernommener Einträge zurück.
    replaceFeed(rows, { provenance = 'verified', quelle = null } = {}) {
      prices.clear();
      let n = 0;
      for (const r of (rows || [])) { upsert({ ...r, provenance, quelle }); n++; }
      return n;
    },
    get(id) { const p = prices.get(id); return p ? { ...p } : null; },
    // Nach Präparat gruppiert, je Gruppe guenstigster Lieferant zuerst.
    /**
     * `country` filtert auf ein Land. Zeilen ohne Land gelten ueberall.
     *
     * Ohne diesen Filter sah eine Apotheke in Nairobi oesterreichische
     * Referenzpreise als ihre Marktlage — und ein Einkauf haette danach
     * kalkuliert. Preise sind noch unmittelbarer als Engpaesse: Daran haengt
     * eine Zahl, die jemand einer Verhandlung zugrunde legt.
     */
    listComparisons({ country = null } = {}) {
      const cc = country ? String(country).toUpperCase() : null;
      const groups = new Map();
      for (const p of prices.values()) {
        if (cc && p.country && p.country !== cc) continue;
        if (!groups.has(p.bezeichnung)) groups.set(p.bezeichnung, []);
        groups.get(p.bezeichnung).push({ ...p });
      }
      return [...groups.entries()].map(([bezeichnung, offers]) => ({
        bezeichnung,
        wirkstoff: offers[0].wirkstoff,
        offers: offers.sort((a, b) => a.aep - b.aep),
      }));
    },
    listFlat() { return [...prices.values()].map(p => ({ ...p })); },
    __dump() { return [...prices]; },
    __load(rows) { if (!rows) return; prices.clear(); for (const [k, v] of rows) prices.set(k, v); },
  };
}
