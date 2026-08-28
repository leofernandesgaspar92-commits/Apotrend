// ============================================================================
//  Quellen-Registrierung für die automatische Datenaufnahme
// ============================================================================
//  Eine Quelle ist: { id, kind, country, url, format, … }. Der Planer
//  (scheduler.js) holt sie ab, der passende Adapter wandelt sie um.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE WICHTIGSTE ENTSCHEIDUNG HIER — warum aus News KEINE Engpass-Datensätze
//  gemacht werden
//  ──────────────────────────────────────────────────────────────────────────
//  Eine RSS-Schlagzeile wie „Lieferengpass: Amoxicillin 1000 mg Filmtabletten"
//  ist eine MELDUNG, kein Datensatz. Daraus per Regex Wirkstoff, Status und
//  Enddatum zu raten, erzeugt Zahlen, die aussehen wie geprüfte Daten und
//  keine sind. Bei Engpässen entscheidet eine Apotheke danach, ob sie
//  umbestellt — das ist die eine Stelle, an der Raten teuer wird.
//
//  Deshalb zwei getrennte Wege:
//
//   · NEWS  (RSS/Atom) -> Beiträge im Fach-News-Feed. Titel, Datum, Quelle,
//                         Link. Keine Interpretation, kein Statuswert.
//   · ENGPÄSSE (JSON/CSV) -> Datensätze in `shortages`. Nur aus STRUKTURIERTEN
//                         Exporten mit benannten Spalten. Fehlt eine
//                         Pflichtspalte, wird die Zeile verworfen, nicht geraten.
//
//  Wenn ein Register nur HTML anbietet, landet es im News-Weg — sichtbar und
//  verlinkt, aber ohne erfundenen Status.
//
//  ──────────────────────────────────────────────────────────────────────────
//  ZU DEN VOREINGESTELLTEN URLs
//  ──────────────────────────────────────────────────────────────────────────
//  Die Bauumgebung dieses Projekts hat KEINEN Netzzugang — die URLs unten
//  konnten hier nicht abgerufen werden. Sie sind Startwerte, keine Zusage.
//  `GET /api/live/status` zeigt nach dem ersten Lauf auf Render, welche Quelle
//  tatsächlich geantwortet hat; jede lässt sich per Umgebungsvariable
//  überschreiben oder mit leerem Wert abschalten.
// ============================================================================

import { COUNTRIES } from '../data/countries.js';
import { parseFeed, parseCsv } from './feedParsers.js';

export const SOURCE_KINDS = ['news', 'shortages'];
export const SOURCE_FORMATS = ['rss', 'json', 'csv'];

// --- Voreingestellte Quellen -------------------------------------------------
//  id -> Definition. Überschreibbar mit APOTREND_SOURCE_<ID>_URL (leer = aus).

const BUILTIN = [
  {
    id: 'bfarm_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'BfArM — Aktuelles',
    url: 'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSSNewsfeed.xml',
    official: true,
  },
  {
    id: 'pei_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'Paul-Ehrlich-Institut — Aktuelles',
    url: 'https://www.pei.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/rss-newsfeed.xml',
    official: true,
  },
  {
    id: 'basg_news', kind: 'news', country: 'AT', format: 'rss',
    label: 'BASG — Neuigkeiten',
    url: 'https://www.basg.gv.at/rss',
    official: true,
  },
  {
    id: 'ema_news', kind: 'news', country: 'EU', format: 'rss',
    label: 'EMA — News and press releases',
    url: 'https://www.ema.europa.eu/en/rss.xml',
    official: true,
  },
  // --- Vom Owner benannte Länder ------------------------------------------
  //  Alle sechs Behörden stehen bereits im Länder-Register (data/countries.js)
  //  mit genau diesen Namen — die Quellenangabe am Beitrag passt damit zum
  //  Land, das die Nutzerin ausgewählt hat.
  {
    id: 'swissmedic_news', kind: 'news', country: 'CH', format: 'rss',
    label: 'Swissmedic — Mitteilungen',
    url: 'https://www.swissmedic.ch/swissmedic/de/home/news/mitteilungen.rss',
    official: true,
  },
  {
    id: 'mhra_news', kind: 'news', country: 'GB', format: 'rss',
    label: 'MHRA — News and announcements',
    // Atom statt RSS 2.0 — der Parser erkennt beides am Wurzelelement.
    url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom',
    official: true,
  },
  {
    id: 'fda_news', kind: 'news', country: 'US', format: 'rss',
    label: 'FDA — Press releases',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
    official: true,
  },
  {
    id: 'healthcanada_news', kind: 'news', country: 'CA', format: 'rss',
    label: 'Health Canada — Recalls and safety alerts',
    url: 'https://recalls-rappels.canada.ca/en/feed/recalls-alerts-rss',
    official: true,
  },
  {
    id: 'tga_news', kind: 'news', country: 'AU', format: 'rss',
    label: 'TGA — News',
    url: 'https://www.tga.gov.au/news/rss.xml',
    official: true,
  },
  {
    id: 'sahpra_news', kind: 'news', country: 'ZA', format: 'rss',
    label: 'SAHPRA — News',
    url: 'https://www.sahpra.org.za/feed/',
    official: true,
  },
  // --- Engpässe als strukturierter Export ---------------------------------
  //  Das ist der EINZIGE Weg, auf dem Engpass-Datensätze entstehen: benannte
  //  Felder, keine Interpretation von Schlagzeilen (siehe Kopf dieser Datei).
  {
    id: 'basg_shortages', kind: 'shortages', country: 'AT', format: 'json',
    label: 'BASG — Vertriebseinschränkungen',
    url: 'https://vertriebseinschraenkungen.basg.gv.at/api/v1/public/shortages',
    official: true,
  },
];

/** Umgebungsvariablen-Namen einer Quelle. */
export const sourceEnvKeys = (id) => ({
  url: `APOTREND_SOURCE_${id.toUpperCase()}_URL`,
  format: `APOTREND_SOURCE_${id.toUpperCase()}_FORMAT`,
});

/**
 * Alle aktiven Quellen.
 *
 * Zusätzlich zu den eingebauten lassen sich beliebige eigene definieren:
 *   APOTREND_SOURCE_MEINE_URL=https://…   APOTREND_SOURCE_MEINE_FORMAT=rss
 * Der Ländercode kommt aus APOTREND_SOURCE_MEINE_COUNTRY (Standard: EU).
 */
export function activeSources(env = process.env) {
  const out = [];

  for (const def of BUILTIN) {
    const keys = sourceEnvKeys(def.id);
    const override = env[keys.url];
    // Gesetzt und leer heißt ABGESCHALTET — nicht „nimm den Standard".
    const url = override === undefined ? def.url : String(override).trim();
    if (!url) continue;
    const format = env[keys.format] || def.format;
    if (!SOURCE_FORMATS.includes(format)) continue;
    out.push({ ...def, url, format, configured: override !== undefined });
  }

  // Eigene Quellen aus der Umgebung einsammeln.
  const seen = new Set(out.map((s) => s.id));
  for (const key of Object.keys(env)) {
    const m = key.match(/^APOTREND_SOURCE_([A-Z0-9_]+)_URL$/);
    if (!m) continue;
    const id = m[1].toLowerCase();
    if (seen.has(id)) continue;
    const url = String(env[key] || '').trim();
    if (!url) continue;
    const format = env[`APOTREND_SOURCE_${m[1]}_FORMAT`] || 'rss';
    if (!SOURCE_FORMATS.includes(format)) continue;
    const kind = env[`APOTREND_SOURCE_${m[1]}_KIND`] || 'news';
    if (!SOURCE_KINDS.includes(kind)) continue;
    const country = (env[`APOTREND_SOURCE_${m[1]}_COUNTRY`] || 'EU').toUpperCase();
    out.push({
      id, kind, country, format, url, configured: true, official: false,
      label: env[`APOTREND_SOURCE_${m[1]}_LABEL`] || id,
    });
  }

  return out;
}

export function sourcesByKind(kind, env = process.env) {
  return activeSources(env).filter((s) => s.kind === kind);
}

/** Anzeigename der Behörde für ein Land (für die Quellenangabe am Beitrag). */
export function regulatorOf(country) {
  const c = COUNTRIES[String(country || '').toUpperCase()];
  return (c && c.regulator) || null;
}

// --- Abruf -------------------------------------------------------------------

/**
 * Rohtext einer Quelle holen. Bewusst mit Zeitlimit: Ein Behörden-Server, der
 * nicht antwortet, darf den Planer nicht blockieren.
 */
export async function fetchTextDefault(url, { timeoutMs = 15_000, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(url, {
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/csv, application/json;q=0.8, */*;q=0.5' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

// --- News-Adapter ------------------------------------------------------------

/**
 * Roh-Antwort einer News-Quelle in normalisierte Meldungen wandeln.
 * Jede Meldung trägt Quelle und Link — ohne Beleg wird nichts veröffentlicht.
 */
export function newsFromSource(source, raw) {
  if (source.format !== 'rss') {
    throw new Error(`Format ${source.format} ist für News nicht vorgesehen (nur rss/atom).`);
  }
  const { feedTitle, items } = parseFeed(raw);
  return items.map((it) => ({
    // Stabile Kennung über die Quelle hinweg: derselbe Beitrag bei zwei
    // Quellen bleibt zwei Beiträge, derselbe Beitrag bei einem erneuten Abruf
    // bleibt einer.
    key: `${source.id}:${it.id}`,
    sourceId: source.id,
    sourceLabel: source.label || feedTitle || source.id,
    official: !!source.official,
    country: source.country,
    title: it.title,
    link: it.link,
    summary: it.summary,
    publishedAt: it.publishedAt,
    categories: it.categories,
  })).filter((n) => n.title && n.link); // ohne Link keine belegbare Meldung
}

// --- Engpass-Adapter ---------------------------------------------------------

const STATUS_MAP = {
  kritisch: 'kritisch', critical: 'kritisch', 'nicht lieferbar': 'kritisch',
  eingeschraenkt: 'eingeschraenkt', eingeschränkt: 'eingeschraenkt',
  limited: 'eingeschraenkt', 'eingeschraenkt lieferbar': 'eingeschraenkt',
  verfuegbar: 'verfuegbar', verfügbar: 'verfuegbar', available: 'verfuegbar',
  behoben: 'verfuegbar', resolved: 'verfuegbar',
};

export function normalizeStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return STATUS_MAP[key] || null;
}

/**
 * Spaltenzuordnung für CSV-Exporte. Register benennen ihre Spalten
 * unterschiedlich — deshalb konfigurierbar statt geraten.
 * APOTREND_SOURCE_<ID>_COLUMNS='{"wirkstoff":"Wirkstoff","bezeichnung":"Arzneispezialität",…}'
 */
export const DEFAULT_COLUMNS = {
  wirkstoff: ['wirkstoff', 'substance', 'active_substance', 'wirkstoffe'],
  bezeichnung: ['bezeichnung', 'arzneispezialität', 'arzneispezialitaet', 'praeparat', 'präparat', 'name', 'product'],
  status: ['status', 'vertriebsstatus', 'availability'],
  grund: ['grund', 'reason', 'ursache'],
  gemeldet_am: ['gemeldet_am', 'meldedatum', 'von', 'start', 'reported'],
  voraussichtlich_bis: ['voraussichtlich_bis', 'bis', 'ende', 'expected_end', 'end'],
};

function pickColumn(row, candidates) {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const hit = keys.find((k) => k.trim().toLowerCase() === cand);
    if (hit) return row[hit];
  }
  return '';
}

/**
 * CSV-Export eines Registers in Engpass-Zeilen wandeln.
 *
 * Verwirft eine Zeile, sobald eine Pflichtangabe fehlt oder der Status
 * unbekannt ist — und zählt das mit. Lieber zehn belastbare Zeilen als
 * hundert, von denen dreißig geraten sind.
 */
export function shortagesFromCsv(raw, { columns = {} } = {}) {
  const { rows } = parseCsv(raw);
  const map = { ...DEFAULT_COLUMNS };
  for (const [field, name] of Object.entries(columns)) {
    if (name) map[field] = [String(name).toLowerCase(), ...(map[field] || [])];
  }

  const out = [];
  const rejected = [];
  for (const [i, row] of rows.entries()) {
    const wirkstoff = String(pickColumn(row, map.wirkstoff) || '').trim();
    const bezeichnung = String(pickColumn(row, map.bezeichnung) || '').trim();
    const status = normalizeStatus(pickColumn(row, map.status));

    if (!bezeichnung) { rejected.push(`Zeile ${i + 2}: Bezeichnung fehlt`); continue; }
    if (!status) { rejected.push(`Zeile ${i + 2}: Status unbekannt (${pickColumn(row, map.status) || 'leer'})`); continue; }

    out.push({
      // Ohne eigene Wirkstoffspalte lieber die Bezeichnung übernehmen als
      // einen Wirkstoff aus dem Produktnamen zu schneiden.
      wirkstoff: wirkstoff || bezeichnung,
      bezeichnung,
      status,
      grund: String(pickColumn(row, map.grund) || '').trim() || null,
      gemeldet_am: String(pickColumn(row, map.gemeldet_am) || '').trim() || null,
      voraussichtlich_bis: String(pickColumn(row, map.voraussichtlich_bis) || '').trim() || null,
    });
  }
  return { rows: out, rejected };
}

/**
 * JSON-Export eines Registers in Engpass-Zeilen wandeln.
 *
 * Gebaut für die BASG-Schnittstelle (Vertriebseinschränkungen), aber bewusst
 * nicht auf sie festgenagelt: Die genaue Antwortform ließ sich hier nicht
 * abrufen (die Bauumgebung hat keinen Netzzugang). Deshalb
 *
 *  · wird die Liste auch in einer üblichen Hülle gefunden (`items`, `data`,
 *    `results`, `shortages`) statt nur als nacktes Array,
 *  · werden Feldnamen über Kandidatenlisten gesucht (deutsch UND englisch),
 *  · und wird eine Zeile VERWORFEN statt geraten, sobald Bezeichnung oder
 *    Status fehlen.
 *
 * Der letzte Punkt ist der entscheidende. Ein `status: item.status || 'LIMITED'`
 * würde den Rohwert der Behörde ungeprüft in eine Statusspalte schreiben: Ein
 * unbekannter Wert flöge entweder beim Schreiben auf die Nase oder — schlimmer —
 * ein „nicht lieferbar" käme als „eingeschränkt lieferbar" in der Apotheke an.
 * Genau an dieser Stelle entscheidet jemand, ob umbestellt wird.
 */
export function shortagesFromJson(raw, { columns = {} } = {}) {
  let payload;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('Antwort ist kein gültiges JSON: ' + (e && e.message));
  }

  const list = Array.isArray(payload)
    ? payload
    : ['items', 'data', 'results', 'shortages', 'content'].reduce(
      (found, key) => found || (payload && Array.isArray(payload[key]) ? payload[key] : null), null);

  if (!list) {
    throw new Error('Keine Liste gefunden (weder Array noch items/data/results/shortages).');
  }

  const map = { ...DEFAULT_COLUMNS };
  for (const [field, name] of Object.entries(columns)) {
    if (name) map[field] = [String(name).toLowerCase(), ...(map[field] || [])];
  }

  const out = [];
  const rejected = [];
  for (const [i, row] of list.entries()) {
    if (!row || typeof row !== 'object') { rejected.push(`#${i}: kein Objekt`); continue; }
    const wirkstoff = String(pickColumn(row, map.wirkstoff) ?? '').trim();
    const bezeichnung = String(pickColumn(row, map.bezeichnung) ?? '').trim();
    const rohStatus = pickColumn(row, map.status);
    const status = normalizeStatus(rohStatus);

    if (!bezeichnung) { rejected.push(`#${i}: Bezeichnung fehlt`); continue; }
    if (!status) { rejected.push(`#${i}: Status unbekannt (${rohStatus || 'leer'})`); continue; }

    out.push({
      wirkstoff: wirkstoff || bezeichnung,
      bezeichnung,
      status,
      grund: String(pickColumn(row, map.grund) ?? '').trim() || null,
      gemeldet_am: String(pickColumn(row, map.gemeldet_am) ?? '').trim() || null,
      voraussichtlich_bis: String(pickColumn(row, map.voraussichtlich_bis) ?? '').trim() || null,
    });
  }
  return { rows: out, rejected };
}

/** Duplikate innerhalb eines Abrufs zusammenführen (Bezeichnung + Wirkstoff). */
export function dedupeShortages(rows) {
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.bezeichnung.toLowerCase()}|${(r.wirkstoff || '').toLowerCase()}`;
    const prev = seen.get(key);
    // Bei Doppelmeldung gewinnt der kritischere Status — die vorsichtigere
    // Aussage ist bei Engpässen die richtige.
    const rank = { kritisch: 3, eingeschraenkt: 2, verfuegbar: 1 };
    if (!prev || rank[r.status] > rank[prev.status]) seen.set(key, r);
  }
  return [...seen.values()];
}
