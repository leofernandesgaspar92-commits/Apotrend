// In-Memory-Store für Rabatt-Aktionen (Repository-Seam). Beim Deployment
// ersetzbar durch echte Großhandels-Aktionsdaten (provenance='verified').
// Hier: kuratierte Referenzdaten (provenance='reference'), Herkunft ehrlich
// gekennzeichnet. Top-10 = laufende Aktionen, nach Rabatt-Höhe absteigend.
import crypto from 'node:crypto';

// listenpreis > aktionspreis; rabatt_pct wird berechnet. gueltig_bis: laufend.
const SEED = [
  { bezeichnung: 'Ibuprofen 400 mg',    wirkstoff: 'Ibuprofen',    supplier: 'Herba Chemosan', listenpreis: 2.35, aktionspreis: 1.65, min_menge: 50,  gueltig_bis: '2026-09-30' },
  { bezeichnung: 'Pantoprazol 40 mg',   wirkstoff: 'Pantoprazol',  supplier: 'Kwizda',         listenpreis: 5.08, aktionspreis: 3.90, min_menge: 20,  gueltig_bis: '2026-08-31' },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Jacoby GM',      listenpreis: 6.95, aktionspreis: 5.20, min_menge: 30,  gueltig_bis: '2026-08-15' },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin',  supplier: 'Kwizda',         listenpreis: 3.98, aktionspreis: 3.10, min_menge: 100, gueltig_bis: '2026-07-31' },
  { bezeichnung: 'Cetirizin 10 mg',     wirkstoff: 'Cetirizin',    supplier: 'Herba Chemosan', listenpreis: 1.90, aktionspreis: 1.45, min_menge: 40,  gueltig_bis: '2026-10-31' },
  { bezeichnung: 'Vitamin D3 20.000 IE', wirkstoff: 'Colecalciferol', supplier: 'Jacoby GM',   listenpreis: 4.20, aktionspreis: 3.15, min_menge: 25,  gueltig_bis: '2026-09-15' },
  { bezeichnung: 'Simvastatin 40 mg',   wirkstoff: 'Simvastatin',  supplier: 'Herba Chemosan', listenpreis: 5.60, aktionspreis: 4.55, min_menge: 30,  gueltig_bis: '2026-08-20' },
  { bezeichnung: 'Omeprazol 20 mg',     wirkstoff: 'Omeprazol',    supplier: 'Kwizda',         listenpreis: 3.30, aktionspreis: 2.75, min_menge: 50,  gueltig_bis: '2026-09-05' },
  { bezeichnung: 'ASS 100 mg',          wirkstoff: 'Acetylsalicylsäure', supplier: 'Jacoby GM', listenpreis: 1.40, aktionspreis: 1.20, min_menge: 60, gueltig_bis: '2026-11-30' },
  { bezeichnung: 'Ramipril 5 mg',       wirkstoff: 'Ramipril',     supplier: 'Herba Chemosan', listenpreis: 4.80, aktionspreis: 4.15, min_menge: 20,  gueltig_bis: '2026-08-10' },
  { bezeichnung: 'Salbutamol Spray',    wirkstoff: 'Salbutamol',   supplier: 'Kwizda',         listenpreis: 7.90, aktionspreis: 7.10, min_menge: 10,  gueltig_bis: '2026-12-31' },
  // Abgelaufene Aktion — darf NICHT im Top-10 auftauchen (heute = 2026-07-07).
  { bezeichnung: 'Diclofenac 50 mg',    wirkstoff: 'Diclofenac',   supplier: 'Jacoby GM',      listenpreis: 3.00, aktionspreis: 1.50, min_menge: 30,  gueltig_bis: '2026-06-01' },
];

export function createRabatteRepo({ seed = true, today = null } = {}) {
  const rabatte = new Map();
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  // Vergleichsdatum (YYYY-MM-DD). Injizierbar für deterministische Tests.
  const heute = () => today || new Date().toISOString().slice(0, 10);

  function rabattPct(listenpreis, aktionspreis) {
    if (!listenpreis || listenpreis === 0) return 0;
    return Math.round(((listenpreis - aktionspreis) / listenpreis) * 1000) / 10; // 1 Nachkommastelle
  }

  function upsert(r) {
    const row = {
      id: r.id || uuid(), bezeichnung: r.bezeichnung, wirkstoff: r.wirkstoff ?? null,
      supplier: r.supplier, listenpreis: r.listenpreis, aktionspreis: r.aktionspreis,
      currency: r.currency || 'EUR', min_menge: r.min_menge ?? null, gueltig_bis: r.gueltig_bis,
      rabatt_pct: rabattPct(r.listenpreis, r.aktionspreis),
      ersparnis: Math.round((r.listenpreis - r.aktionspreis) * 100) / 100,
      provenance: r.provenance || 'reference', quelle: r.quelle || 'Referenzdaten', updated_at: now(),
    };
    rabatte.set(row.id, row);
    return { ...row };
  }

  if (seed) SEED.forEach(r => upsert(r));

  return {
    upsert,
    get(id) { const r = rabatte.get(id); return r ? { ...r } : null; },
    // Top-10 laufende Aktionen, höchster Rabatt zuerst. Abgelaufene fliegen raus.
    listTop10() {
      const cutoff = heute();
      return [...rabatte.values()]
        .filter(r => r.gueltig_bis >= cutoff)
        .sort((a, b) => b.rabatt_pct - a.rabatt_pct)
        .slice(0, 10)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    },
    listFlat() { return [...rabatte.values()].map(r => ({ ...r })); },
    __dump() { return [...rabatte]; },
    __load(rows) { if (!rows) return; rabatte.clear(); for (const [k, v] of rows) rabatte.set(k, v); },
  };
}
