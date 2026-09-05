// ============================================================================
//  News-Aufnahme: Behörden-Meldungen werden zu Fach-News-Beiträgen
// ============================================================================
//  Ablauf je Durchlauf:
//    1. Quellen abrufen (parallel, mit Zeitlimit)
//    2. Meldungen normalisieren (sources.js)
//    3. Bereits gesehene aussortieren (stabile Kennung, dauerhaft gemerkt)
//    4. Aus den neuen Beiträge anlegen — mit Quelle und Link
//
//  Zwei Regeln, die nicht verhandelbar sind:
//
//  · JEDER Beitrag trägt seinen Link. CLAUDE.md verlangt für sicherheits-
//    relevante Aussagen eine Quelle; eine Behördenmeldung ohne Rückverweis wäre
//    ein Gerücht mit Amtsanstrich.
//  · KEINE Zusammenfassung wird umformuliert. Übernommen wird der Titel und der
//    Anriss der Behörde. Wer eine Engpassmeldung umschreibt, haftet für die
//    Umschreibung.
// ============================================================================

import { newsFromSource, sourcesByKind, fetchTextDefault, fetchSource, regulatorOf } from './sources.js';
import { fetchMastodonSource } from './socialSources.js';

/** Wie viele Meldungen je Quelle und Durchlauf höchstens übernommen werden. */
export const MAX_PER_SOURCE = 10;
/** Ältere Meldungen werden beim ERSTEN Lauf nicht nachgeholt (kein Rückstau). */
export const MAX_AGE_DAYS = 21;

/**
 * Speicher der bereits verarbeiteten Meldungen.
 * Bewusst als eigener kleiner Repo-Seam: er muss den Neustart überleben, sonst
 * legt der Server nach jedem Deploy dieselben Beiträge erneut an.
 */
export function createNewsSeenStore({ max = 5000 } = {}) {
  const seen = new Map(); // key -> ISO-Zeitpunkt der Aufnahme

  return {
    has: (key) => seen.has(key),
    add(key) {
      seen.set(key, new Date().toISOString());
      // Ältestes zuerst vergessen, damit der Speicher nicht unbegrenzt wächst.
      // Map bewahrt die Einfügereihenfolge — das reicht hier völlig.
      while (seen.size > max) seen.delete(seen.keys().next().value);
    },
    size: () => seen.size,
    __dump: () => [...seen],
    __load(rows) { if (!rows) return; seen.clear(); for (const [k, v] of rows) seen.set(k, v); },
  };
}

/** Beitragstext bauen: Anriss plus Quellenzeile. Nichts Erfundenes dazu. */
export function composePost(item) {
  const parts = [item.title.trim()];
  if (item.summary && item.summary !== item.title) {
    // Auf eine lesbare Länge kürzen, aber an einer Satzgrenze — ein mitten im
    // Wort abgeschnittener Behördentext liest sich wie ein Fehler.
    const s = item.summary.length > 400 ? cutAtSentence(item.summary, 400) : item.summary;
    parts.push(s);
  }
  return parts.join('\n\n');
}

function cutAtSentence(text, limit) {
  const slice = text.slice(0, limit);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return (lastStop > limit * 0.5 ? slice.slice(0, lastStop + 1) : slice.trimEnd() + ' …');
}

/**
 * Ist die Meldung frisch genug für die Aufnahme?
 * Ohne Datum wird sie zugelassen — manche Feeds liefern keins, und eine
 * Meldung wegen eines fehlenden Feldes zu verwerfen wäre übereifrig.
 */
export function isFreshEnough(item, { now = Date.now(), maxAgeDays = MAX_AGE_DAYS } = {}) {
  if (!item.publishedAt) return true;
  const age = now - Date.parse(item.publishedAt);
  return Number.isFinite(age) && age <= maxAgeDays * 86400000;
}

/**
 * Einen Durchlauf ausführen.
 *
 * `createPost(item)` legt den Beitrag an und gibt ihn zurück; injiziert, damit
 * dieser Dienst nichts über die Social-Schicht wissen muss (und testbar bleibt).
 */
export async function ingestNews({
  env = process.env,
  fetchText = fetchTextDefault,
  // Eigener Abruf fuer soziale Netzwerke (JSON statt Text). Injizierbar wie
  // fetchText, damit die Tests ohne Netz auskommen.
  fetchJson = async (u) => JSON.parse(await fetchTextDefault(u)),
  seenStore,
  createPost,
  now = () => Date.now(),
  maxPerSource = MAX_PER_SOURCE,
  log = console,
} = {}) {
  const sources = sourcesByKind('news', env);
  const report = { sources: sources.length, fetched: 0, newItems: 0, created: 0, failures: [], perSource: {} };
  if (!sources.length) return report;

  // Parallel abrufen: eine langsame Behörde darf die anderen nicht aufhalten.
  // `fetchSource` wiederholt bei vorübergehenden Störungen und weicht bei
  // dauerhaften auf die hinterlegte Ersatzadresse aus (siehe sources.js).
  const results = await Promise.allSettled(sources.map(async (source) => {
    // Soziale Netzwerke gehen einen eigenen Weg: Dort wird ERST die Identitaet
    // des Kontos geprueft und nur bei bestandener Pruefung ueberhaupt gelesen
    // (services/socialSources.js). Ein nicht nachgewiesenes Konto liefert
    // nichts — auch dann nicht, wenn es echt aussieht.
    if (source.format === 'mastodon') {
      const res = await fetchMastodonSource(source, { fetchJson, log });
      return { source, items: res.items, social: res };
    }
    const holen = await fetchSource(source, { fetchText });
    return { source, items: newsFromSource(source, holen.raw), holen };
  }));

  for (const [i, res] of results.entries()) {
    const source = sources[i];
    if (res.status === 'rejected') {
      const message = (res.reason && res.reason.message) || String(res.reason);
      report.failures.push({ id: source.id, error: message });
      report.perSource[source.id] = { ok: false, error: message };
      log.warn?.(`ApoPulse News: ${source.id} nicht erreichbar — ${message}`);
      continue;
    }

    const { items, holen } = res.value;
    report.fetched += items.length;

    // Ein abgelehntes Konto gehört gemeldet: Wer es eingetragen hat, muss
    // erfahren WARUM — sonst probiert er ratlos herum oder hält die stille
    // Leere für einen Fehler der Plattform.
    if (res.value.social && !res.value.social.verified) {
      report.rejectedAccounts = (report.rejectedAccounts || 0) + 1;
      report.perSource[source.id] = { ok: true, verified: false, reason: res.value.social.reason, created: 0 };
      log.warn?.(`ApoPulse Social: ${source.id} liefert nichts — ${res.value.social.reason}`);
      continue;
    }

    // Lief die Quelle über eine Ersatzadresse? Das gehört gemeldet: Wer es
    // nicht sieht, hält die Voreinstellung weiter für richtig — es kommen ja
    // Daten. Die falsche URL bliebe dann für immer stehen.
    if (holen && holen.usedFallback) {
      report.fallbacksUsed = (report.fallbacksUsed || 0) + 1;
      log.warn?.(`ApoPulse News: ${source.id} antwortet nur über die Ersatzadresse `
        + `(${holen.url}). Die Voreinstellung ${source.url} gehört geprüft.`);
    }

    const fresh = items
      .filter((it) => !seenStore.has(it.key))
      .filter((it) => isFreshEnough(it, { now: now() }))
      // Neueste zuerst, damit bei der Obergrenze das Aktuellste durchkommt.
      .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0))
      .slice(0, maxPerSource);

    report.newItems += fresh.length;
    let created = 0;

    // Ältestes zuerst anlegen, damit die Reihenfolge im Feed stimmt.
    for (const item of [...fresh].reverse()) {
      try {
        await createPost({
          ...item,
          body: composePost(item),
          sourceUrl: item.link,
          regulator: regulatorOf(item.country),
        });
        // Erst nach dem erfolgreichen Anlegen merken — sonst ginge eine Meldung
        // verloren, wenn das Anlegen scheitert.
        seenStore.add(item.key);
        created++;
      } catch (e) {
        report.failures.push({ id: source.id, error: 'Beitrag: ' + (e && e.message) });
        log.warn?.(`ApoPulse News: Beitrag aus ${source.id} nicht angelegt — ${e && e.message}`);
      }
    }

    report.created += created;
    report.perSource[source.id] = {
      ok: true, fetched: items.length, created,
      country: source.country,
      url: holen ? holen.url : source.url,
      usedFallback: !!(holen && holen.usedFallback),
    };
  }

  return report;
}
