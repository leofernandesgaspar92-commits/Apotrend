// ============================================================================
//  VerifiedSignal — eine Meldung wird zum Datensatz
// ============================================================================
//  Hier laufen die zwei Stränge zusammen:
//    · der ABRUF liefert Herkunft (Adresse, Quellenname, Land) — mechanisch
//    · die KI liefert Struktur (Wirkstoff, Schweregrad, Übersetzung) — optional
//
//  Die Trennung ist der Kern dieser Datei. `baueSignal` nimmt beides getrennt
//  entgegen und lässt die KI-Seite die Herkunft NICHT überschreiben — auch
//  dann nicht, wenn das Modell Felder zurückgibt, die so heißen. Ein Test
//  schiebt genau das hinein und prüft, dass es ignoriert wird.
//
//  Ohne diese Regel wäre der gesamte Herkunfts-Proof wertlos: Eine Angabe, die
//  ein Sprachmodell setzen kann, ist kein Beleg, sondern eine Behauptung.
// ============================================================================

import { KATEGORIEN, SCHWEREGRADE } from './aiExtract.js';

/** Fallback-Kategorie je Quellenart, wenn die KI nichts sagt oder nicht lief. */
const KATEGORIE_AUS_ART = { shortages: 'SHORTAGE', news: 'NEWS' };

/**
 * Stabile Kennung einer Meldung: Quelle + Original-Adresse.
 *
 * Bewusst NICHT der Titel: Behörden ändern Überschriften nach, und eine
 * Meldung würde dann als neu gelten. Die Adresse bleibt.
 */
export function dedupeKey(sourceId, originalUrl) {
  return `${String(sourceId || 'unbekannt').trim()}:${String(originalUrl || '').trim()}`;
}

const kurz = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Ein VerifiedSignal bauen.
 *
 * `herkunft` MUSS vollständig sein — ohne Adresse und Quellenname entsteht
 * kein Signal. Das ist keine Formalie: Eine Engpassmeldung ohne Rückverweis
 * ist ein Gerücht mit Amtsanstrich (CLAUDE.md).
 *
 * `extraktion` ist das Ergebnis aus aiExtract (oder der unveränderte
 * Basiszustand, wenn keine KI lief).
 */
export function baueSignal({ meldung, herkunft, extraktion = {}, jetzt = () => new Date() }) {
  const url = String(herkunft && herkunft.originalUrl || '').trim();
  const quelle = String(herkunft && herkunft.sourceName || '').trim();
  const land = String(herkunft && herkunft.country || '').trim().toUpperCase();
  if (!url) throw new Error('VerifiedSignal ohne originalUrl — eine Meldung ohne Rückverweis wird nicht gespeichert.');
  if (!quelle) throw new Error('VerifiedSignal ohne sourceName — die Herkunft gehört zu jeder Zeile.');
  if (!/^[A-Z]{2}$/.test(land)) throw new Error(`VerifiedSignal mit unbrauchbarem Land ("${land}").`);

  const titel = kurz(meldung && meldung.title, 500);
  if (!titel) throw new Error('VerifiedSignal ohne Titel.');

  // Kategorie: KI-Vorschlag, sonst die Art der Quelle, sonst NEWS. Ein
  // unbekannter Wert aus der KI wird verworfen, nicht übernommen.
  const kategorie = KATEGORIEN.includes(extraktion.kategorie)
    ? extraktion.kategorie
    : (KATEGORIE_AUS_ART[herkunft.kind] || 'NEWS');

  const schweregrad = SCHWEREGRADE.includes(extraktion.schweregrad) ? extraktion.schweregrad : null;
  const ue = extraktion.uebersetzungen || {};

  return {
    dedupeKey: dedupeKey(herkunft.sourceId, url),
    title: titel,
    summary: kurz(meldung.summary, 2000),

    // ── Herkunfts-Proof. Ausschliesslich aus `herkunft`. ──
    originalUrl: url,
    sourceName: quelle,
    sourceId: kurz(herkunft.sourceId, 80),
    country: land,

    language: kurz(herkunft.language, 8) || 'de',
    category: kategorie,

    wirkstoff: kurz(extraktion.wirkstoff, 160),
    handelsname: kurz(extraktion.handelsname, 200),
    schweregrad,
    ursache: kurz(extraktion.ursache, 300),
    gueltigVon: extraktion.gueltigVon || null,
    gueltigBis: extraktion.gueltigBis || null,

    summaryDe: kurz(ue.de, 1200),
    summaryEn: kurz(ue.en, 1200),
    summaryPt: kurz(ue.pt, 1200),

    // Gekürzt: dient der Nachvollziehbarkeit („was stand da wirklich"), nicht
    // der Volltextsuche. Ungekürzt wäre die Tabelle in Wochen unhandlich.
    rawPayload: kurz(meldung.raw, 8000),

    confidenceScore: Number(extraktion.confidence) || 0,
    verifiedAt: jetzt().toISOString(),
    publishedAt: meldung.publishedAt || null,
  };
}

/**
 * Speicher für Signale.
 *
 * Wie die übrigen Repos ein Seam: in-memory, mit __dump/__load für den
 * Snapshot. Der PostgreSQL-Spiegel hängt daneben (repo/prismaStore.js) und
 * darf ausfallen, ohne dass der Dienst steht.
 */
export function createSignalStore({ max = 5000 } = {}) {
  const signale = new Map(); // dedupeKey -> Signal

  /** Neueste zuerst. `verifiedAt` ist ISO, damit reicht ein Stringvergleich. */
  const neuesteZuerst = (a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt));

  return {
    /** Anlegen oder aktualisieren. Gibt zurück, ob es neu war. */
    upsert(signal) {
      const neu = !signale.has(signal.dedupeKey);
      const alt = signale.get(signal.dedupeKey);
      // Beim Aktualisieren den ERSTEN Zeitpunkt behalten: Sonst wandert eine
      // Meldung bei jedem Durchlauf wieder an die Spitze des Feeds, obwohl
      // sich nichts geändert hat.
      signale.set(signal.dedupeKey, { ...signal, verifiedAt: alt ? alt.verifiedAt : signal.verifiedAt });
      while (signale.size > max) signale.delete(signale.keys().next().value);
      return neu;
    },

    /**
     * Abfragen — dieselben Filter wie der Index in der Datenbank.
     * `wirkstoff` sucht als Teilzeichenkette, damit „amoxi" auch
     * „amoxicillin" findet.
     */
    list({ country = null, category = null, wirkstoff = null, limit = 100 } = {}) {
      const cc = country ? String(country).toUpperCase() : null;
      const kat = category ? String(category).toUpperCase() : null;
      const wk = wirkstoff ? String(wirkstoff).trim().toLowerCase() : null;
      return [...signale.values()]
        .filter((s) => !cc || s.country === cc)
        .filter((s) => !kat || s.category === kat)
        .filter((s) => !wk || (s.wirkstoff && s.wirkstoff.toLowerCase().includes(wk))
          || (s.handelsname && s.handelsname.toLowerCase().includes(wk)))
        .sort(neuesteZuerst)
        .slice(0, Math.min(Math.max(1, Number(limit) || 100), 500));
    },

    /**
     * Zustand eines Landes — für die ehrliche Leermeldung.
     * Unterscheidet „noch nie etwas bekommen" von „verbunden, gerade nichts
     * Neues". Das ist der ganze Unterschied zwischen „kaputt" und „ruhig".
     */
    landStand(country) {
      const cc = String(country || '').toUpperCase();
      const eigene = [...signale.values()].filter((s) => s.country === cc);
      if (!eigene.length) return { land: cc, signale: 0, letzte: null };
      const letzte = eigene.sort(neuesteZuerst)[0];
      return { land: cc, signale: eigene.length, letzte: letzte.verifiedAt };
    },

    get: (key) => signale.get(key) || null,
    size: () => signale.size,
    __dump: () => [...signale],
    __load(rows) { if (!rows) return; signale.clear(); for (const [k, v] of rows) signale.set(k, v); },
  };
}
