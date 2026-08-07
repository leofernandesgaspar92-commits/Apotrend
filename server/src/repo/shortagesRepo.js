// In-Memory-Store für Lieferengpässe (Repository-Seam). Beim Deployment ersetzt
// eine echte Quelle diesen Store: der bestehende BASG-Parser (backend/api/
// engpass.js) liefert LIVE-Daten mit provenance='verified'. Hier: kuratierte
// Referenzdaten (provenance='reference'), damit die Herkunft ehrlich sichtbar ist.
import crypto from 'node:crypto';

// Kuratierte AT-Referenzdaten (NICHT live) — klar als 'reference' gekennzeichnet.
const SEED = [
  { wirkstoff: 'Amoxicillin',     bezeichnung: 'Amoxicillin 1000 mg Filmtabletten', status: 'kritisch',       grund: 'Erhöhte Nachfrage', gemeldet_am: '2026-06-14' },
  { wirkstoff: 'Salbutamol',      bezeichnung: 'Salbutamol Inhalat 100 µg',          status: 'eingeschraenkt', grund: 'Produktionsverzögerung', gemeldet_am: '2026-06-20', voraussichtlich_bis: '2026-08-15' },
  { wirkstoff: 'Clarithromycin',  bezeichnung: 'Clarithromycin 500 mg',              status: 'kritisch',       grund: 'Wirkstoffknappheit', gemeldet_am: '2026-06-25', voraussichtlich_bis: '2026-09-30' },
  { wirkstoff: 'Levothyroxin',    bezeichnung: 'Levothyroxin 100 µg Tabletten',      status: 'kritisch',       grund: 'Herstellungsproblem', gemeldet_am: '2026-06-28' },
  { wirkstoff: 'Ibuprofen',       bezeichnung: 'Ibuprofen 400 mg',                   status: 'eingeschraenkt', grund: 'Kontingentierung', gemeldet_am: '2026-07-01' },
  { wirkstoff: 'Metformin',       bezeichnung: 'Metformin 850 mg',                   status: 'verfuegbar',     grund: null, gemeldet_am: '2026-07-03' },
];

export function createShortagesRepo({ seed = true } = {}) {
  const shortages = new Map();
  // Beobachtungsliste je Nutzer: userId -> Map<wirkstoffLower, Anzeigename>
  const watch = new Map();
  const watchNotes = new Map(); // userId -> Map(normKey -> Notiz) — Premium: private Notizen je Wirkstoff
  const watchAlerts = new Map(); // userId -> Map(normKey -> pct) — Rabatt-Alarm-Schwelle je Wirkstoff
  const alertedDeals = new Map(); // userId -> Set(dealKey) — schon benachrichtigte Aktionen (Dedup)
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const norm = (w) => String(w || '').trim().toLowerCase();

  function upsert(s) {
    const row = {
      id: s.id || uuid(), wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung,
      status: s.status || 'kritisch', grund: s.grund ?? null,
      gemeldet_am: s.gemeldet_am ?? null, voraussichtlich_bis: s.voraussichtlich_bis ?? null,
      provenance: s.provenance || 'reference',
      quelle: s.quelle === undefined ? 'Referenzdaten' : s.quelle,
      reporter_user_id: s.reporter_user_id ?? null,
      confirmations: Array.isArray(s.confirmations) ? [...s.confirmations] : [],
      created_at: now(),
    };
    // Statusverlauf: erster Eintrag = Ausgangsmeldung (Datum, Status, Quelle, Herkunft).
    row.history = [{ am: row.gemeldet_am || now().slice(0, 10), status: row.status, quelle: row.quelle ?? null, provenance: row.provenance }];
    shortages.set(row.id, row);
    return { ...row, confirmations: [...row.confirmations] };
  }

  if (seed) SEED.forEach(s => upsert(s));

  return {
    upsert,
    // Live-/Referenz-Feed ersetzen: entfernt alle NICHT von Nutzer:innen gemeldeten Einträge
    // (Seed/Live) und setzt die übergebenen Zeilen neu. Community-Meldungen (reporter_user_id
    // gesetzt) bleiben unangetastet. Gibt die Anzahl der übernommenen Einträge zurück.
    replaceFeed(rows, { provenance = 'verified', quelle = null } = {}) {
      for (const [id, s] of shortages) if (!s.reporter_user_id) shortages.delete(id);
      let n = 0;
      for (const r of (rows || [])) { upsert({ ...r, provenance, quelle }); n++; }
      return n;
    },
    // Status (+ Quelle/Herkunft) eines bestehenden Engpasses ändern, andere Felder erhalten.
    setStatus(id, { status, quelle, provenance, gemeldet_am }) {
      const s = shortages.get(id);
      if (!s) return null;
      const before = s.status;
      if (status !== undefined) s.status = status;
      if (quelle !== undefined) s.quelle = quelle;
      if (provenance !== undefined) s.provenance = provenance;
      if (gemeldet_am !== undefined) s.gemeldet_am = gemeldet_am;
      // Statusverlauf fortschreiben (nur bei echter Statusänderung).
      if (status !== undefined && status !== before) {
        if (!Array.isArray(s.history)) s.history = []; // alte Snapshots ohne history
        s.history.push({ am: s.gemeldet_am || now().slice(0, 10), status, quelle: s.quelle ?? null, provenance: s.provenance });
      }
      return { ...s };
    },
    // Voraussichtlichen Wiederverfügbarkeits-Termin setzen/entfernen (null = unbekannt).
    setExpectedDate(id, voraussichtlich_bis) {
      const s = shortages.get(id);
      if (!s) return null;
      s.voraussichtlich_bis = voraussichtlich_bis ?? null;
      return { ...s };
    },
    get(id) { const s = shortages.get(id); return s ? { ...s, confirmations: [...(s.confirmations || [])], history: (s.history || []).map(h => ({ ...h })) } : null; },
    list() {
      const rank = { kritisch: 2, eingeschraenkt: 1, verfuegbar: 0 };
      return [...shortages.values()].sort((a, b) => rank[b.status] - rank[a.status]).map(s => ({ ...s, confirmations: [...(s.confirmations || [])], history: (s.history || []).map(h => ({ ...h })) }));
    },
    // Bestätigung ("auch bei uns") durch eine Apotheke; kein Doppel, nicht der Melder.
    confirm(id, userId) {
      const s = shortages.get(id);
      if (!s) return null;
      if (!Array.isArray(s.confirmations)) s.confirmations = [];
      if (userId && userId !== s.reporter_user_id && !s.confirmations.includes(userId)) s.confirmations.push(userId);
      return { ...s, confirmations: [...s.confirmations] };
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
    // Private Notiz je beobachtetem Wirkstoff (Premium). Leerer Text löscht die Notiz.
    setWatchNote(userId, wirkstoff, note) {
      const key = norm(wirkstoff); if (!key) return;
      const text = String(note ?? '').trim().slice(0, 280);
      if (!watchNotes.has(userId)) watchNotes.set(userId, new Map());
      const m = watchNotes.get(userId);
      if (text) m.set(key, text); else { m.delete(key); if (m.size === 0) watchNotes.delete(userId); }
    },
    getWatchNote(userId, wirkstoff) {
      const m = watchNotes.get(userId);
      return (m && m.get(norm(wirkstoff))) || '';
    },
    // Rabatt-Alarm-Schwelle je beobachtetem Wirkstoff (Prozent). 0/null löscht sie.
    setWatchAlert(userId, wirkstoff, pct) {
      const key = norm(wirkstoff); if (!key) return;
      if (!watchAlerts.has(userId)) watchAlerts.set(userId, new Map());
      const m = watchAlerts.get(userId);
      if (pct && pct > 0) m.set(key, pct); else { m.delete(key); if (m.size === 0) watchAlerts.delete(userId); }
    },
    getWatchAlert(userId, wirkstoff) { const m = watchAlerts.get(userId); return (m && m.get(norm(wirkstoff))) || null; },
    // Dedup: eine konkrete Aktion (dealKey) nur einmal je Nutzer:in melden.
    wasDealAlerted(userId, dealKey) { const s = alertedDeals.get(userId); return !!(s && s.has(dealKey)); },
    markDealAlerted(userId, dealKey) { if (!alertedDeals.has(userId)) alertedDeals.set(userId, new Set()); alertedDeals.get(userId).add(dealKey); },
    // Alle Nutzer, die diesen Wirkstoff beobachten (für Statusänderungs-Alerts).
    usersWatching(wirkstoff) {
      const key = norm(wirkstoff);
      const out = [];
      for (const [userId, m] of watch) if (m.has(key)) out.push(userId);
      return out;
    },
    // Beobachter:innen, deren Wirkstoff im Freitext vorkommt (z.B. Austausch-Bezeichnung).
    // Ein Treffer je Nutzer (erster passender Wirkstoff als Label).
    watchersForText(text) {
      const hay = String(text || '').toLowerCase();
      if (!hay) return [];
      const out = [];
      for (const [userId, m] of watch) {
        for (const [key, display] of m) {
          if (key && hay.includes(key)) { out.push({ userId, wirkstoff: display }); break; }
        }
      }
      return out;
    },
    purgeUser(userId) {
      watch.delete(userId);
      watchNotes.delete(userId);
      watchAlerts.delete(userId);
      alertedDeals.delete(userId);
      // Melder-Identität anonymisieren, Bestätigungen des Nutzers entfernen (DSGVO).
      for (const s of shortages.values()) {
        if (s.reporter_user_id === userId) s.reporter_user_id = null;
        if (Array.isArray(s.confirmations)) s.confirmations = s.confirmations.filter(u => u !== userId);
      }
    },

    __dump() { return { shortages: [...shortages], watch: [...watch].map(([u, m]) => [u, [...m]]), watchNotes: [...watchNotes].map(([u, m]) => [u, [...m]]), watchAlerts: [...watchAlerts].map(([u, m]) => [u, [...m]]), alertedDeals: [...alertedDeals].map(([u, s]) => [u, [...s]]) }; },
    __load(data) {
      if (!data) return;
      // Rückwärtskompatibel: alter Snapshot war ein reines Engpass-Array.
      const rows = Array.isArray(data) ? data : data.shortages;
      if (rows) { shortages.clear(); for (const [k, v] of rows) shortages.set(k, v); }
      watch.clear();
      if (!Array.isArray(data) && data.watch) {
        for (const [u, entries] of data.watch) watch.set(u, new Map(entries));
      }
      watchNotes.clear();
      if (!Array.isArray(data) && data.watchNotes) {
        for (const [u, entries] of data.watchNotes) watchNotes.set(u, new Map(entries));
      }
      watchAlerts.clear();
      if (!Array.isArray(data) && data.watchAlerts) {
        for (const [u, entries] of data.watchAlerts) watchAlerts.set(u, new Map(entries));
      }
      alertedDeals.clear();
      if (!Array.isArray(data) && data.alertedDeals) {
        for (const [u, keys] of data.alertedDeals) alertedDeals.set(u, new Set(keys));
      }
    },
  };
}
