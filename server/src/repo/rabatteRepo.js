// In-Memory-Store für Rabatt-Aktionen (Repository-Seam). Beim Deployment
// ersetzbar durch echte Großhandels-Aktionsdaten (provenance='verified').
//
// Die Lieferanten heißen „Großhandel A/B/C" und nicht wie echte Häuser —
// die Begründung steht ausführlich in repo/pricesRepo.js. Kurz: Ein erfundener
// Preis unter einem echten Firmennamen ist auch dann ein Problem, wenn er
// korrekt als Referenzdatum gekennzeichnet ist.
// Hier: kuratierte Referenzdaten (provenance='reference'), Herkunft ehrlich
// gekennzeichnet. Top-10 = laufende Aktionen, nach Rabatt-Höhe absteigend.
import crypto from 'node:crypto';

// listenpreis > aktionspreis; rabatt_pct wird berechnet.
//
// `tage` ist die Laufzeit RELATIV zum Seed-Zeitpunkt, nicht ein festes Datum.
// Vorher standen hier Kalenderdaten, gesetzt fuer ein gedachtes „heute" im
// Juli 2026. Die liefen naturgemaess ab: Anfang September waren sechs von
// dreizehn Referenz-Aktionen tot, die Rabatt-Ansicht duennte still aus, und
// ein Test, der eine laufende Aktion erwartete, fiel an einem Kalendertag um —
// ohne dass sich am Code etwas geaendert haette.
//
// Negative Werte sind Absicht: Eine abgelaufene Aktion gehoert in den Seed,
// damit die Filterung „nur laufende" ueberhaupt etwas zu filtern hat.
const SEED = [
  { bezeichnung: 'Ibuprofen 400 mg',    wirkstoff: 'Ibuprofen',    supplier: 'Großhandel A', listenpreis: 2.35, aktionspreis: 1.65, min_menge: 50,  tage: 85 },
  { bezeichnung: 'Pantoprazol 40 mg',   wirkstoff: 'Pantoprazol',  supplier: 'Großhandel B',         listenpreis: 5.08, aktionspreis: 3.90, min_menge: 20,  tage: 55 },
  { bezeichnung: 'Metformin 850 mg',    wirkstoff: 'Metformin',    supplier: 'Großhandel C',      listenpreis: 6.95, aktionspreis: 5.20, min_menge: 30,  tage: 39 },
  { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin',  supplier: 'Großhandel B',         listenpreis: 3.98, aktionspreis: 3.10, min_menge: 100, tage: 24 },
  { bezeichnung: 'Cetirizin 10 mg',     wirkstoff: 'Cetirizin',    supplier: 'Großhandel A', listenpreis: 1.90, aktionspreis: 1.45, min_menge: 40,  tage: 116 },
  { bezeichnung: 'Vitamin D3 20.000 IE', wirkstoff: 'Colecalciferol', supplier: 'Großhandel C',   listenpreis: 4.20, aktionspreis: 3.15, min_menge: 25,  tage: 70 },
  { bezeichnung: 'Simvastatin 40 mg',   wirkstoff: 'Simvastatin',  supplier: 'Großhandel A', listenpreis: 5.60, aktionspreis: 4.55, min_menge: 30,  tage: 44 },
  { bezeichnung: 'Omeprazol 20 mg',     wirkstoff: 'Omeprazol',    supplier: 'Großhandel B',         listenpreis: 3.30, aktionspreis: 2.75, min_menge: 50,  tage: 60 },
  { bezeichnung: 'ASS 100 mg',          wirkstoff: 'Acetylsalicylsäure', supplier: 'Großhandel C', listenpreis: 1.40, aktionspreis: 1.20, min_menge: 60, tage: 146 },
  { bezeichnung: 'Ramipril 5 mg',       wirkstoff: 'Ramipril',     supplier: 'Großhandel A', listenpreis: 4.80, aktionspreis: 4.15, min_menge: 20,  tage: 34 },
  { bezeichnung: 'Salbutamol Spray',    wirkstoff: 'Salbutamol',   supplier: 'Großhandel B',         listenpreis: 7.90, aktionspreis: 7.10, min_menge: 10,  tage: 177 },
  // Zweite laufende Aktion zum selben Wirkstoff (Ibuprofen) — für den
  // "beste Aktion je Wirkstoff"-Vergleich.
  { bezeichnung: 'Ibuprofen 400 mg',    wirkstoff: 'Ibuprofen',    supplier: 'Großhandel B',         listenpreis: 2.35, aktionspreis: 1.80, min_menge: 30,  tage: 100 },
  // Abgelaufene Aktion — darf NICHT im Top-10 auftauchen.
  { bezeichnung: 'Diclofenac 50 mg',    wirkstoff: 'Diclofenac',   supplier: 'Großhandel C',      listenpreis: 3.00, aktionspreis: 1.50, min_menge: 30,  tage: -36 },
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
      // Wer die Aktion eingetragen hat (nur bei selbst eingetragenen gesetzt).
      // Ohne dieses Feld ließe sich „nur eigene zurückziehen" nicht durchsetzen.
      created_by: r.created_by ?? null,
      // Rechtsraum der Aktion. Bei selbst eingetragenen aus dem Profil des
      // Betriebs, bei Feed-Daten aus dem Land der Quelle. `null` = Altbestand
      // bzw. kuratierte Referenzdaten ohne Landeszuordnung.
      country: r.country ?? null,
    };
    rabatte.set(row.id, row);
    return { ...row };
  }

  /** Laufzeit in Tagen -> Kalenderdatum, gerechnet ab dem Vergleichsdatum. */
  function bisDatum(tage) {
    const ms = Date.parse(heute() + 'T00:00:00Z') + tage * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  if (seed) SEED.forEach(({ tage, ...r }) => upsert({ ...r, gueltig_bis: bisDatum(tage) }));

  return {
    upsert,
    // Live-/Referenz-Feed komplett ersetzen (Aktionen stammen vollständig aus dem Feed).
    replaceFeed(rows, { provenance = 'verified', quelle = null } = {}) {
      // Selbst eingetragene Aktionen überleben den Feed-Austausch. Sie stammen
      // nicht aus dem Feed — sie mit ihm zu löschen, würde einem Großhändler
      // ohne Vorwarnung seine Aktion entfernen.
      const own = [...rabatte.values()].filter((r) => r.created_by != null);
      rabatte.clear();
      for (const r of own) rabatte.set(r.id, r);
      let n = 0;
      for (const r of (rows || [])) { upsert({ ...r, provenance, quelle }); n++; }
      return n;
    },
    get(id) { const r = rabatte.get(id); return r ? { ...r } : null; },
    // Einzelne Aktion entfernen (zurückgezogene Eigen-Aktion).
    remove(id) { return rabatte.delete(id); },
    // Verbleibende Tage bis Aktionsende (relativ zum Vergleichsdatum), Kalendertage.
    daysLeft(gueltig_bis) {
      if (!gueltig_bis) return null;
      const ms = Date.parse(gueltig_bis + 'T00:00:00Z') - Date.parse(heute() + 'T00:00:00Z');
      return Math.round(ms / 86400000);
    },
    // Top-10 laufende Aktionen, höchster Rabatt zuerst. Abgelaufene fliegen raus.
    // days_left = Tage bis Aktionsende, expiring_soon = läuft in <=14 Tagen ab.
    // best_for_wirkstoff: laufen zum selben Wirkstoff mehrere Aktionen, wird die
    // mit dem niedrigsten Aktionspreis markiert (über ALLE laufenden berechnet,
    // nicht nur über die Top-10) — wirkstoff_alternatives = Zahl der weiteren.
    /**
     * Laufende Aktionen, beste zuerst.
     *
     * `country` filtert auf den Rechtsraum. Zeilen OHNE Land (kuratierte
     * Referenzdaten, Altbestand) bleiben sichtbar: Sie einem Land zuzuordnen,
     * das nicht belegt ist, waere geraten — und sie zu verstecken hiesse, dem
     * Owner beim Einschalten des Filters die halbe Ansicht zu leeren.
     * `q` sucht in Bezeichnung, Wirkstoff (INN) und Lieferant.
     */
    listTop10({ country = null, q = null } = {}) {
      const cutoff = heute();
      const cc = country ? String(country).toUpperCase() : null;
      const worte = q ? String(q).trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
      const active = [...rabatte.values()]
        .filter(r => r.gueltig_bis >= cutoff)
        .filter(r => !cc || !r.country || r.country === cc)
        .filter(r => !worte.length || (() => {
          const heu = `${r.bezeichnung || ''} ${r.wirkstoff || ''} ${r.supplier || ''}`.toLowerCase();
          return worte.every((w) => heu.includes(w));
        })());
      const byWirkstoff = new Map(); // wirkstoffLower -> { count, minPreis }
      for (const r of active) {
        const k = String(r.wirkstoff || '').trim().toLowerCase();
        if (!k) continue;
        const g = byWirkstoff.get(k) || { count: 0, minPreis: Infinity };
        g.count += 1; g.minPreis = Math.min(g.minPreis, Number(r.aktionspreis));
        byWirkstoff.set(k, g);
      }
      return active
        .sort((a, b) => b.rabatt_pct - a.rabatt_pct)
        .slice(0, 10)
        .map((r, i) => {
          const days_left = this.daysLeft(r.gueltig_bis);
          const g = byWirkstoff.get(String(r.wirkstoff || '').trim().toLowerCase());
          const multi = !!g && g.count >= 2;
          return {
            ...r, rank: i + 1, days_left, expiring_soon: days_left != null && days_left <= 14,
            best_for_wirkstoff: multi && Number(r.aktionspreis) === g.minPreis,
            wirkstoff_alternatives: multi ? g.count - 1 : 0,
          };
        });
    },
    listFlat() { return [...rabatte.values()].map(r => ({ ...r })); },
    __dump() { return [...rabatte]; },
    __load(rows) { if (!rows) return; rabatte.clear(); for (const [k, v] of rows) rabatte.set(k, v); },
  };
}
