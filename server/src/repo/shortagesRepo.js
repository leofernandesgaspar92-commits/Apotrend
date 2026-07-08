// In-Memory-Store für Lieferengpässe (Repository-Seam). Beim Deployment ersetzt
// eine echte Quelle diesen Store: der bestehende BASG-Parser (backend/api/
// engpass.js) liefert LIVE-Daten mit provenance='verified'. Hier: kuratierte
// Referenzdaten (provenance='reference'), damit die Herkunft ehrlich sichtbar ist.
import crypto from 'node:crypto';

// Kuratierte AT-Referenzdaten (NICHT live) — klar als 'reference' gekennzeichnet.
const SEED = [
  { wirkstoff: 'Amoxicillin',     bezeichnung: 'Amoxicillin 1000 mg Filmtabletten', status: 'kritisch',       grund: 'Erhöhte Nachfrage', gemeldet_am: '2026-06-14' },
  { wirkstoff: 'Salbutamol',      bezeichnung: 'Salbutamol Inhalat 100 µg',          status: 'eingeschraenkt', grund: 'Produktionsverzögerung', gemeldet_am: '2026-06-20' },
  { wirkstoff: 'Clarithromycin',  bezeichnung: 'Clarithromycin 500 mg',              status: 'kritisch',       grund: 'Wirkstoffknappheit', gemeldet_am: '2026-06-25' },
  { wirkstoff: 'Levothyroxin',    bezeichnung: 'Levothyroxin 100 µg Tabletten',      status: 'kritisch',       grund: 'Herstellungsproblem', gemeldet_am: '2026-06-28' },
  { wirkstoff: 'Ibuprofen',       bezeichnung: 'Ibuprofen 400 mg',                   status: 'eingeschraenkt', grund: 'Kontingentierung', gemeldet_am: '2026-07-01' },
  { wirkstoff: 'Metformin',       bezeichnung: 'Metformin 850 mg',                   status: 'verfuegbar',     grund: null, gemeldet_am: '2026-07-03' },
];

export function createShortagesRepo({ seed = true } = {}) {
  const shortages = new Map();
  // Beobachtungsliste je Nutzer: userId -> Map<wirkstoffLower, Anzeigename>
  const watch = new Map();
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const norm = (w) => String(w || '').trim().toLowerCase();

  function upsert(s) {
    const row = {
      id: s.id || uuid(), wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung,
      status: s.status || 'kritisch', grund: s.grund ?? null,
      gemeldet_am: s.gemeldet_am ?? null, voraussichtlich_bis: s.voraussichtlich_bis ?? null,
      provenance: s.provenance || 'reference', quelle: s.quelle || 'Referenzdaten',
      created_at: now(),
    };
    shortages.set(row.id, row);
    return { ...row };
  }

  if (seed) SEED.forEach(s => upsert(s));

  return {
    upsert,
    get(id) { const s = shortages.get(id); return s ? { ...s } : null; },
    list() {
      const rank = { kritisch: 2, eingeschraenkt: 1, verfuegbar: 0 };
      return [...shortages.values()].sort((a, b) => rank[b.status] - rank[a.status]).map(s => ({ ...s }));
    },

    // ── Beobachtungsliste (Wirkstoffe je Nutzer) ──
    addWatch(userId, wirkstoff) {
      const key = norm(wirkstoff);
      if (!key) return;
      if (!watch.has(userId)) watch.set(userId, new Map());
      watch.get(userId).set(key, String(wirkstoff).trim());
    },
    removeWatch(userId, wirkstoff) {
      const m = watch.get(userId);
      if (m) { m.delete(norm(wirkstoff)); if (m.size === 0) watch.delete(userId); }
    },
    isWatched(userId, wirkstoff) {
      const m = watch.get(userId);
      return !!(m && m.has(norm(wirkstoff)));
    },
    listWatch(userId) {
      const m = watch.get(userId);
      return m ? [...m.values()] : [];
    },
    purgeUser(userId) { watch.delete(userId); },

    __dump() { return { shortages: [...shortages], watch: [...watch].map(([u, m]) => [u, [...m]]) }; },
    __load(data) {
      if (!data) return;
      // Rückwärtskompatibel: alter Snapshot war ein reines Engpass-Array.
      const rows = Array.isArray(data) ? data : data.shortages;
      if (rows) { shortages.clear(); for (const [k, v] of rows) shortages.set(k, v); }
      watch.clear();
      if (!Array.isArray(data) && data.watch) {
        for (const [u, entries] of data.watch) watch.set(u, new Map(entries));
      }
    },
  };
}
