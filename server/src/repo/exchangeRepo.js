// In-Memory-Store für den Bestandsaustausch (Biete/Suche). Gleicher
// Repository-Seam wie die anderen Module; __dump/__load für die Snapshot-Persistenz.
import crypto from 'node:crypto';

export function createExchangeRepo() {
  const entries = new Map();
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  return {
    create(e) {
      const row = {
        id: uuid(), kind: e.kind, author_user_id: e.authorUserId,
        bezeichnung: e.bezeichnung, menge: e.menge ?? null, ort: e.ort ?? null, bundesland: e.bundesland ?? null,
        ablauf: e.ablauf ?? null, // Verfallsdatum (v.a. bei „biete": Restbestand vor Ablauf)
        note: e.note ?? null, image: e.image ?? null, status: 'offen', reserved: false, created_at: now(), resolved_at: null,
      };
      entries.set(row.id, row);
      return { ...row };
    },
    get(id) { const e = entries.get(id); return e ? { ...e } : null; },
    update(id, patch) { const e = entries.get(id); if (!e) return null; Object.assign(e, patch); return { ...e }; },
    remove(id) { entries.delete(id); },
    list() {
      return [...entries.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(e => ({ ...e }));
    },
    purgeUser(userId) { for (const [id, e] of entries) if (e.author_user_id === userId) entries.delete(id); },
    __dump() { return [...entries]; },
    __load(rows) { if (!rows) return; entries.clear(); for (const [k, v] of rows) entries.set(k, v); },
  };
}
