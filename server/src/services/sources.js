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
//  id -> Definition. Überschreibbar mit APOPULSE_SOURCE_<ID>_URL (leer = aus).

const BUILTIN = [
  {
    id: 'bfarm_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'BfArM — Aktuelles',
    url: 'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSSNewsfeed.xml',
    fallbacks: ['https://www.bundesgesundheitsministerium.de/rss/aktuelles.xml'],
    official: true, verified: false,
  },
  {
    id: 'pei_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'Paul-Ehrlich-Institut — Aktuelles',
    url: 'https://www.pei.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/rss-newsfeed.xml',
    official: true, verified: false,
  },
  {
    id: 'basg_news', kind: 'news', country: 'AT', format: 'rss',
    label: 'BASG — Neuigkeiten',
    url: 'https://www.basg.gv.at/rss',
    fallbacks: ['https://www.basg.gv.at/rss/news', 'https://www.sozialministerium.at/rss'],
    official: true, verified: false,
  },
  {
    id: 'ema_news', kind: 'news', country: 'EU', format: 'rss',
    label: 'EMA — News and press releases',
    url: 'https://www.ema.europa.eu/en/rss.xml',
    official: true, verified: false,
  },
  // --- Vom Owner benannte Länder ------------------------------------------
  //  Alle sechs Behörden stehen bereits im Länder-Register (data/countries.js)
  //  mit genau diesen Namen — die Quellenangabe am Beitrag passt damit zum
  //  Land, das die Nutzerin ausgewählt hat.
  {
    id: 'swissmedic_news', kind: 'news', country: 'CH', format: 'rss',
    label: 'Swissmedic — Mitteilungen',
    url: 'https://www.swissmedic.ch/swissmedic/de/home/news/mitteilungen.rss',
    official: true, verified: false,
  },
  {
    id: 'mhra_news', kind: 'news', country: 'GB', format: 'rss',
    label: 'MHRA — News and announcements',
    // Atom statt RSS 2.0 — der Parser erkennt beides am Wurzelelement.
    url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom',
    official: true, verified: false,
  },
  {
    id: 'fda_news', kind: 'news', country: 'US', format: 'rss',
    label: 'FDA — Press releases',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
    official: true, verified: false,
  },
  {
    id: 'healthcanada_news', kind: 'news', country: 'CA', format: 'rss',
    label: 'Health Canada — Recalls and safety alerts',
    url: 'https://recalls-rappels.canada.ca/en/feed/recalls-alerts-rss',
    official: true, verified: false,
  },
  {
    id: 'tga_news', kind: 'news', country: 'AU', format: 'rss',
    label: 'TGA — News',
    url: 'https://www.tga.gov.au/news/rss.xml',
    official: true, verified: false,
  },
  {
    id: 'sahpra_news', kind: 'news', country: 'ZA', format: 'rss',
    label: 'SAHPRA — News',
    url: 'https://www.sahpra.org.za/feed/',
    official: true, verified: false,
  },
  // --- Restliche Länder des Registers -------------------------------------
  //  Damit sind alle 16 Länder aus data/countries.js abgedeckt.
  //
  //  `verified: false` heißt: Die Adresse ist ein begründeter Startwert, aber
  //  in der Bauumgebung war kein Netz — sie konnte NICHT abgerufen werden.
  //  Das gilt für ALLE Quellen dieser Datei, auch die älteren: Dass eine URL
  //  schon länger hier steht, macht sie nicht überprüft. `/api/live/status`
  //  zeigt nach dem ersten Lauf, welche tatsächlich antwortet — erst dann
  //  darf `verified` bei einer Quelle auf `true` gesetzt werden.
  //
  //  `fallbacks` ist der vom Owner gewünschte Rückfall: Antwortet die
  //  Fachbehörde nicht, wird die Pressemitteilung des Gesundheitsministeriums
  //  bzw. der Regierung versucht. Lieber die Meldung einer Ebene höher als
  //  eine leere Länderansicht.
  {
    id: 'li_news', kind: 'news', country: 'LI', format: 'rss',
    label: 'Liechtenstein — Amt für Gesundheit / Regierung',
    // Liechtenstein hat keine eigene Zulassungsbehörde: Es übernimmt
    // Swissmedic-Zulassungen. Ein eigener Arzneimittel-Feed ist daher
    // unwahrscheinlich — deshalb direkt die Regierungsmitteilungen.
    url: 'https://www.llv.li/de/rss/mitteilungen',
    fallbacks: ['https://www.regierung.li/rss/mitteilungen'],
    official: true, verified: false,
  },
  {
    id: 'infarmed_news', kind: 'news', country: 'PT', format: 'rss',
    label: 'INFARMED — Notícias',
    url: 'https://www.infarmed.pt/web/infarmed/rss',
    fallbacks: ['https://www.sns.gov.pt/feed/'],
    official: true, verified: false,
  },
  {
    id: 'anvisa_news', kind: 'news', country: 'BR', format: 'rss',
    label: 'ANVISA — Notícias',
    url: 'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/RSS',
    fallbacks: ['https://www.gov.br/saude/pt-br/assuntos/noticias/RSS'],
    official: true, verified: false,
  },
  {
    id: 'armed_news', kind: 'news', country: 'AO', format: 'rss',
    label: 'ARMED Angola — Notícias',
    url: 'https://armed.gov.ao/feed/',
    fallbacks: ['https://www.minsa.gov.ao/feed/'],
    official: true, verified: false,
  },
  {
    id: 'anarme_news', kind: 'news', country: 'MZ', format: 'rss',
    label: 'ANARME Moçambique — Notícias',
    url: 'https://anarme.gov.mz/feed/',
    fallbacks: ['https://www.misau.gov.mz/index.php/noticias?format=feed&type=rss'],
    official: true, verified: false,
  },
  {
    id: 'nafdac_news', kind: 'news', country: 'NG', format: 'rss',
    label: 'NAFDAC — News',
    url: 'https://nafdac.gov.ng/feed/',
    fallbacks: ['https://www.health.gov.ng/feed/'],
    official: true, verified: false,
  },
  {
    id: 'ppb_news', kind: 'news', country: 'KE', format: 'rss',
    label: 'Pharmacy and Poisons Board Kenya — News',
    url: 'https://web.pharmacyboardkenya.org/feed/',
    fallbacks: ['https://www.health.go.ke/feed/'],
    official: true, verified: false,
  },
  {
    id: 'fdaghana_news', kind: 'news', country: 'GH', format: 'rss',
    label: 'FDA Ghana — News',
    url: 'https://fdaghana.gov.gh/feed/',
    fallbacks: ['https://www.moh.gov.gh/feed/'],
    official: true, verified: false,
  },
  {
    id: 'ashp_shortages_news', kind: 'news', country: 'US', format: 'rss',
    label: 'ASHP — Drug Shortages (Meldungen)',
    // ABSICHTLICH als News-Quelle, nicht als Engpass-Quelle: ASHP liefert
    // redaktionelle Meldungen, keinen strukturierten Export mit Statusspalte.
    // Daraus Engpass-Datensätze zu schneiden hieße raten — siehe Dateikopf.
    url: 'https://www.ashp.org/drug-shortages/current-shortages/rss',
    fallbacks: ['https://www.ashp.org/rss/news'],
    official: false, verified: false,
  },

  // --- Engpässe als strukturierter Export ---------------------------------
  //  Das ist der EINZIGE Weg, auf dem Engpass-Datensätze entstehen: benannte
  //  Felder, keine Interpretation von Schlagzeilen (siehe Kopf dieser Datei).
  {
    id: 'basg_shortages', kind: 'shortages', country: 'AT', format: 'json',
    label: 'BASG — Vertriebseinschränkungen',
    url: 'https://vertriebseinschraenkungen.basg.gv.at/api/v1/public/shortages',
    official: true, verified: false,
  },
];

/** Umgebungsvariablen-Namen einer Quelle. */
export const sourceEnvKeys = (id) => ({
  url: `APOPULSE_SOURCE_${id.toUpperCase()}_URL`,
  format: `APOPULSE_SOURCE_${id.toUpperCase()}_FORMAT`,
});

/**
 * Alle aktiven Quellen.
 *
 * Zusätzlich zu den eingebauten lassen sich beliebige eigene definieren:
 *   APOPULSE_SOURCE_MEINE_URL=https://…   APOPULSE_SOURCE_MEINE_FORMAT=rss
 * Der Ländercode kommt aus APOPULSE_SOURCE_MEINE_COUNTRY (Standard: EU).
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
    // Hat der Betreiber eine eigene Adresse gesetzt, gelten die eingebauten
    // Ausweichadressen NICHT mehr: Sonst landete man bei einem Tippfehler in
    // der eigenen URL stillschweigend wieder beim Voreinstellungs-Feed und
    // hielte dessen Daten für die selbst konfigurierten.
    const fallbacks = override !== undefined ? [] : (def.fallbacks || []);
    out.push({ ...def, url, format, fallbacks, configured: override !== undefined });
  }

  // Eigene Quellen aus der Umgebung einsammeln.
  const seen = new Set(out.map((s) => s.id));
  for (const key of Object.keys(env)) {
    const m = key.match(/^APOPULSE_SOURCE_([A-Z0-9_]+)_URL$/);
    if (!m) continue;
    const id = m[1].toLowerCase();
    if (seen.has(id)) continue;
    const url = String(env[key] || '').trim();
    if (!url) continue;
    const format = env[`APOPULSE_SOURCE_${m[1]}_FORMAT`] || 'rss';
    if (!SOURCE_FORMATS.includes(format)) continue;
    const kind = env[`APOPULSE_SOURCE_${m[1]}_KIND`] || 'news';
    if (!SOURCE_KINDS.includes(kind)) continue;
    const country = (env[`APOPULSE_SOURCE_${m[1]}_COUNTRY`] || 'EU').toUpperCase();
    out.push({
      id, kind, country, format, url, configured: true, official: false,
      label: env[`APOPULSE_SOURCE_${m[1]}_LABEL`] || id,
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
  if (!res.ok) {
    const e = new Error('HTTP ' + res.status);
    e.status = res.status;
    throw e;
  }
  return res.text();
}

// --- Wiederholen und Ausweichen ---------------------------------------------
//  Behördenserver sind unzuverlässig, und die Voreinstellungen unten konnten
//  hier nicht geprüft werden (keine Netzverbindung in der Bauumgebung). Beides
//  zusammen verlangt zwei getrennte Mechanismen — sie lösen verschiedene
//  Probleme und dürfen nicht vermischt werden:
//
//   · WIEDERHOLEN hilft gegen VORÜBERGEHENDE Störungen (Zeitüberschreitung,
//     502 vom Lastverteiler, Verbindungsabbruch). Dieselbe URL, später nochmal.
//   · AUSWEICHEN hilft gegen DAUERHAFTE (404, weil die Behörde ihren Feed
//     verschoben hat). Eine 404 hundertmal zu wiederholen ändert nichts —
//     dann muss eine andere Adresse her.
//
//  Deshalb wird bei 4xx NICHT wiederholt, sondern sofort ausgewichen.

/** Fehler, bei denen ein zweiter Versuch sinnlos ist (die Antwort bleibt gleich). */
export function isPermanentError(err) {
  const status = err && err.status;
  // 429 ist formal 4xx, aber ausdrücklich ein „später nochmal" — also nicht dauerhaft.
  if (typeof status === 'number') return status >= 400 && status < 500 && status !== 429;
  return false;
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Eine URL mit Wiederholung holen.
 *
 * `attempts: 2` heißt: ein Versuch plus EINE Wiederholung nach 0,5 s.
 *
 * Warum nicht mehr — die Rechnung im schlimmsten Fall: 20 Quellen, je zwei
 * Adressen (Behörde + Ministerium), Zeitlimit 15 s je Abruf. Bei zwei
 * Versuchen sind das 2 × 2 × 15 s = 60 s, bei dreien schon 90 s. Die Abrufe
 * laufen zwar parallel, aber es ist eine kostenlose Render-Instanz, und der
 * Takt ist fünf Minuten. Eine zweite Wiederholung fängt kaum eine Störung
 * mehr ein, die die erste nicht schon aufgefangen hätte — sie kostet nur.
 */
export async function fetchWithRetry(url, {
  fetchText = fetchTextDefault, attempts = 2, baseDelayMs = 500, sleep = schlaf, log = null,
} = {}) {
  let letzter;
  for (let versuch = 1; versuch <= attempts; versuch++) {
    try {
      return await fetchText(url);
    } catch (e) {
      letzter = e;
      if (isPermanentError(e)) throw e;         // sinnlos zu wiederholen
      if (versuch === attempts) break;
      log?.(`ApoPulse Quellen: ${url} Versuch ${versuch} fehlgeschlagen (${e.message}) — neuer Versuch`);
      await sleep(baseDelayMs * versuch);
    }
  }
  throw letzter;
}

/**
 * Eine Quelle holen und dabei ihre Ausweichadressen berücksichtigen.
 *
 * Gibt zurück, WELCHE Adresse geantwortet hat. Das ist kein Beiwerk: Läuft eine
 * Quelle dauerhaft über die Ausweichadresse, ist die Voreinstellung falsch und
 * gehört korrigiert — ohne diese Angabe merkt das niemand, weil ja Daten kommen.
 */
export async function fetchSource(source, opts = {}) {
  const adressen = [source.url, ...(source.fallbacks || [])].filter(Boolean);
  const fehler = [];
  for (const [i, url] of adressen.entries()) {
    try {
      const raw = await fetchWithRetry(url, opts);
      return { raw, url, usedFallback: i > 0, fallbackIndex: i, errors: fehler };
    } catch (e) {
      fehler.push({ url, error: (e && e.message) || String(e) });
    }
  }
  const e = new Error(`Keine Adresse erreichbar (${adressen.length} versucht): `
    + fehler.map((f) => `${f.url} -> ${f.error}`).join(' | '));
  e.attempts = fehler;
  throw e;
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
 * APOPULSE_SOURCE_<ID>_COLUMNS='{"wirkstoff":"Wirkstoff","bezeichnung":"Arzneispezialität",…}'
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
