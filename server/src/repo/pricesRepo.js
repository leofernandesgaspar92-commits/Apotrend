// In-Memory-Store für Preise (Repository-Seam). Beim Deployment ersetzbar durch
// echte Großhandels-/Marktdaten (provenance='verified'). Hier: kuratierte
// Referenzdaten (provenance='reference'), Herkunft ehrlich gekennzeichnet.
import crypto from 'node:crypto';

// Mehrere Lieferanten je Präparat -> Preisvergleich. series = letzte Preise.
const SEED = [
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Herba Chemosan', aep: 3.98, prev_aep: 3.72, series: [3.55, 3.60, 3.72, 3.98] },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Kwizda',         aep: 3.01, prev_aep: 3.05, series: [3.10, 3.08, 3.05, 3.01] },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', supplier: 'Jacoby GM',      aep: 4.10, prev_aep: 4.02, series: [3.95, 4.00, 4.02, 4.10] },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Herba Chemosan', aep: 6.80, prev_aep: 6.95, series: [7.10, 7.00, 6.95, 6.80] },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Kwizda',         aep: 7.05, prev_aep: 7.05, series: [7.05, 7.05, 7.05, 7.05] },
  { bezeichnung: 'Pantoprazol 40 mg',   wirkstoff: 'Pantoprazol',  supplier: 'Jacoby GM',      aep: 5.08, prev_aep: 4.90, series: [4.80, 4.85, 4.90, 5.08] },
  { bezeichnung: 'Ibuprofen 400 mg',    wirkstoff: 'Ibuprofen',    supplier: 'Herba Chemosan', aep: 2.35, prev_aep: 2.20, series: [2.10, 2.15, 2.20, 2.35] },
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
      provenance: p.provenance || 'reference', quelle: p.quelle || 'Referenzdaten', updated_at: now(),
    };
    prices.set(row.id, row);
    return { ...row };
  }

  if (seed) SEED.forEach(p => upsert(p));

  return {
    upsert,
    get(id) { const p = prices.get(id); return p ? { ...p } : null; },
    // Nach Präparat gruppiert, je Gruppe guenstigster Lieferant zuerst.
    listComparisons() {
      const groups = new Map();
      for (const p of prices.values()) {
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
  };
}
