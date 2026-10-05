// In-Memory-Store für Kühlketten- und Transportmeldungen. Gleicher
// Repository-Seam wie die übrigen Module; __dump/__load für den Snapshot.
//
// Kein PostgreSQL-Spiegel in diesem Schritt: Der Bereich ist am Anfang leer,
// und eine Tabelle für Daten, die es noch nicht gibt, ist Ballast. Sobald die
// ersten Betriebe melden, zieht sie nach — der Snapshot hält den Bestand
// bis dahin über Neustarts, wie bei den übrigen Repos.
import crypto from 'node:crypto';

export function createLogistikRepo() {
  const meldungen = new Map();
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  return {
    create(m) {
      const row = {
        id: uuid(),
        author_user_id: m.authorUserId,
        art: m.art,
        titel: m.titel,
        beschreibung: m.beschreibung ?? null,
        region: m.region ?? null,
        betroffen: m.betroffen ?? null,
        dringlichkeit: m.dringlichkeit || 'hinweis',
        gueltig_bis: m.gueltigBis ?? null,
        country: m.country ?? null,
        created_at: now(),
        updated_at: now(),
      };
      meldungen.set(row.id, row);
      return { ...row };
    },
    get(id) { const m = meldungen.get(id); return m ? { ...m } : null; },
    update(id, patch) {
      const m = meldungen.get(id);
      if (!m) return null;
      Object.assign(m, patch, { updated_at: now() });
      return { ...m };
    },
    remove(id) { meldungen.delete(id); },
    /** Neueste zuerst — bei einer Störungsmeldung zählt die Aktualität. */
    list() {
      return [...meldungen.values()]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((m) => ({ ...m }));
    },
    purgeUser(userId) {
      for (const [id, m] of meldungen) if (m.author_user_id === userId) meldungen.delete(id);
    },
    size: () => meldungen.size,
    __dump() { return [...meldungen]; },
    __load(rows) { if (!rows) return; meldungen.clear(); for (const [k, v] of rows) meldungen.set(k, v); },
  };
}
