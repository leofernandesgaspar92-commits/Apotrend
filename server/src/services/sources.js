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
//  Ein dritter Weg kam dazu: SOZIALE NETZWERKE (format='mastodon'). Er ist am
//  strengsten von allen — bevor auch nur ein Beitrag geholt wird, muss das
//  Konto nachgewiesen haben, dass es die amtliche Domain der Behoerde
//  kontrolliert (services/socialSources.js). Eingebaute Konten gibt es
//  bewusst KEINE: Handles zu raten waere genau der Fehler, den die Pruefung
//  verhindern soll. Sie werden per Umgebungsvariable eingetragen.
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
import { discoverFeed } from './feedDiscovery.js';

export const SOURCE_KINDS = ['news', 'shortages'];
export const SOURCE_FORMATS = ['rss', 'json', 'csv', 'mastodon'];

// --- Voreingestellte Quellen -------------------------------------------------
//  id -> Definition. Überschreibbar mit APOPULSE_SOURCE_<ID>_URL (leer = aus).

const BUILTIN = [
  {
    id: 'bfarm_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'BfArM — Aktuelles',
    url: 'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSSNewsfeed.xml',
    homepage: [
      'https://www.bfarm.de/DE/Service/RSS/_node.html',
      'https://www.bfarm.de/DE/Aktuelles/_node.html',
      'https://www.bfarm.de/DE/Aktuelles/Newsletter/_node.html',
    ],
    fallbacks: ['https://www.bundesgesundheitsministerium.de/rss/aktuelles.xml'],
    official: true, verified: false,
  },
  {
    id: 'pei_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'Paul-Ehrlich-Institut — Aktuelles',
    url: 'https://www.pei.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/rss-newsfeed.xml',
    homepage: [
      'https://www.pei.de/DE/service/rss/rss-node.html',
      'https://www.pei.de/DE/newsroom/newsroom-node.html',
    ],
    official: true, verified: false,
  },
  {
    id: 'basg_news', kind: 'news', country: 'AT', format: 'rss',
    label: 'BASG — Neuigkeiten',
    // DIE ERSTE NACHWEISLICH GEPRÜFTE ADRESSE DIESER DATEI.
    //
    // Sie ist nicht geraten, sondern gefunden: Die Selbstfindung hat sie im
    // Betrieb auf Render aus der Auszeichnung von /en/whatsnew gelesen und
    // erfolgreich abgerufen — nachzulesen im Deploy-Protokoll vom 05.09.2026:
    //   „basg_news — Feed selbst gefunden unter …/en/whatsnew/rss".
    // Damit ist hier zum ersten Mal `verified: true` gerechtfertigt.
    //
    // Die alte Voreinstellung /rss (404) wandert in die Ersatzadressen: Sollte
    // das BASG sie wieder aufleben lassen, greift sie erneut, ohne Deploy.
    url: 'https://www.basg.gv.at/en/whatsnew/rss',
    homepage: 'https://www.basg.gv.at/en/whatsnew',
    fallbacks: ['https://www.basg.gv.at/rss', 'https://www.sozialministerium.at/rss'],
    official: true, verified: true,
  },
  {
    id: 'ema_news', kind: 'news', country: 'EU', format: 'rss',
    label: 'EMA — News and press releases',
    url: 'https://www.ema.europa.eu/en/rss.xml',
    homepage: [
      'https://www.ema.europa.eu/en/news-events/rss-feeds',
      'https://www.ema.europa.eu/en/news',
      'https://www.ema.europa.eu/en/homepage',
    ],
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
    homepage: [
      'https://www.swissmedic.ch/swissmedic/de/home/news/news.html',
      'https://www.swissmedic.ch/swissmedic/de/home.html',
    ],
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
    homepage: 'https://www.fda.gov/about-fda/contact-fda/subscribe-podcasts-and-news-feeds',
    official: true, verified: false,
  },
  {
    id: 'healthcanada_news', kind: 'news', country: 'CA', format: 'rss',
    label: 'Health Canada — Recalls and safety alerts',
    url: 'https://recalls-rappels.canada.ca/en/feed/recalls-alerts-rss',
    homepage: [
      'https://recalls-rappels.canada.ca/en',
      'https://recalls-rappels.canada.ca/en/search/site',
    ],
    official: true, verified: false,
  },
  {
    id: 'tga_news', kind: 'news', country: 'AU', format: 'rss',
    // Korrigiert nach dem ersten Live-Lauf: /news/rss.xml lief in die
    // Zeitüberschreitung. Die TGA führt ihre Feeds selbst unter /feeds/ —
    // belegt durch den Inhalt ihrer eigenen RSS-Seite (homepage unten).
    // Weiterhin verified:false: Auch diese Adresse konnte hier nicht
    // abgerufen werden. Erst ein Lauf auf Render darf sie bestätigen.
    label: 'TGA — News',
    url: 'https://www.tga.gov.au/feeds/article/news.xml',
    fallbacks: ['https://www.tga.gov.au/feeds/article.xml', 'https://www.tga.gov.au/feeds/alert.xml'],
    homepage: 'https://www.tga.gov.au/news/subscribe-updates/rss-feeds',
    // Alle DREI Adressen liefen in die Zeitüberschreitung — nicht in 404.
    // Das ist ein anderer Befund: Die Pfade stimmen vermutlich, die Antwort
    // kommt nur nicht in 15 s. Australien ist von Frankfurt aus rund 16 000 km
    // entfernt, und dreimal 15 s hintereinander deutet auf einen langsamen
    // Server, nicht auf drei falsche Pfade. Deshalb hier mehr Geduld statt
    // neuer URLs. Kostet nichts: Die Quellen werden parallel geholt.
    timeoutMs: 30_000,
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
  // ENTFERNT: ashp_shortages_news
  //
  // Der erste Live-Lauf beantwortete beide hinterlegten Adressen mit 403 —
  // nicht 404. Das ist ein Unterschied, auf den es ankommt: 404 heißt „hier
  // ist nichts", 403 heißt „Sie nicht". ASHP ist ein privater Fachverband,
  // kein Amt; die Engpassliste ist deren redaktionelle Eigenleistung und
  // ausdrücklich lizenziert. Ein Verband, der maschinelle Abrufe abweist,
  // hat sich damit geäußert.
  //
  // Es wäre technisch leicht, das zu umgehen (anderer User-Agent, langsamer
  // takten). Genau das unterbleibt: CLAUDE.md verlangt „kostenlos UND
  // rechtlich erlaubt", und eine Plattform, die Engpassmeldungen als belastbar
  // ausweist, kann sie nicht gegen den erklärten Willen der Quelle beschaffen.
  // Für die USA bleibt openFDA — gemeinfrei, strukturiert und ausdrücklich
  // zur Weiterverwendung bestimmt (siehe unten). Der Verlust ist gering.
  //
  // Wer ASHP dennoch anbindet (etwa mit einer Lizenz), kann das ohne Deploy:
  //   APOPULSE_SOURCE_ASHP_URL=…  APOPULSE_SOURCE_ASHP_COUNTRY=US

  // --- Engpässe als strukturierter Export ---------------------------------
  //  Das ist der EINZIGE Weg, auf dem Engpass-Datensätze entstehen: benannte
  //  Felder, keine Interpretation von Schlagzeilen (siehe Kopf dieser Datei).
  {
    id: 'openfda_shortages', kind: 'shortages', country: 'US', format: 'json',
    label: 'FDA — Drug Shortages (openFDA)',
    // Die einzige mir bekannte echte Engpass-SCHNITTSTELLE: JSON, dokumentiert,
    // ohne Schluessel nutzbar. Damit stehen fuer die USA strukturierte
    // Datensaetze statt blosser Schlagzeilen zur Verfuegung.
    //
    // Gemeinfrei (US-Bundesbehoerde). Die Nutzungsbedingungen verlangen zwei
    // Dinge, die diese Anwendung ohnehin tut: keine Behauptung einer
    // Zusammenarbeit mit der Behoerde, und keine Darstellung der Daten als
    // amtlich gepruefte Einzelfallauskunft. Die Herkunft faehrt bei jeder
    // Zeile mit (provenance) und die Quelle steht am Datensatz.
    url: 'https://api.fda.gov/drug/shortages.json?limit=1000',
    official: true, verified: false,
  },
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
      // Nur fuer format=mastodon: das Konto auf diesem Server. Ohne Konto
      // laesst sich keine Identitaet pruefen — die Quelle wird dann beim
      // Abruf mit klarer Ansage abgelehnt, nicht stillschweigend ignoriert.
      account: env[`APOPULSE_SOURCE_${m[1]}_ACCOUNT`] || null,
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
/**
 * Kennung, mit der sich dieser Server bei Behörden vorstellt.
 *
 * WARUM DAS KEINE KOSMETIK IST — der teuerste Befund des ersten Live-Laufs:
 * Von 19 Quellen antworteten 8 nicht, sieben davon mit 404. Die naheliegende
 * Deutung („die Behörden haben ihre Feeds verschoben") ist die falsche.
 * Denn dieselbe FDA-Adresse, die auf Render 404 lieferte, ist in Suchindizes
 * als gültiger Feed verzeichnet. Sieben Behörden verschieben nicht am selben
 * Tag ihren Feed — aber sieben Behörden stehen sehr wohl hinter denselben
 * CDNs/Schutzschichten (Akamai, Cloudflare), und die weisen Anfragen OHNE
 * User-Agent routinemäßig ab. Node's `fetch` sendet von sich aus keinen.
 * Ein 404 statt 403 ist dabei üblich: Wer blockt, verrät ungern, dass er blockt.
 *
 * Deshalb eine ehrliche Kennung statt einer Browser-Tarnung: Name, Zweck und
 * eine Adresse, unter der eine Behörde nachfragen oder uns aussperren kann.
 * Sich als Chrome auszugeben würde vielleicht mehr Türen öffnen — es wäre
 * aber eine Lüge gegenüber genau den Stellen, deren Daten wir als amtlich
 * ausweisen. Wer so anfängt, kann die Herkunftskennzeichnung gleich lassen.
 */
export const USER_AGENT = 'ApoPulseBot/1.0 (Fachinformationsdienst für Apotheken; +https://apopulse-feed.onrender.com/)';

export async function fetchTextDefault(url, { timeoutMs = 15_000, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/csv, application/json;q=0.8, */*;q=0.5',
      'user-agent': USER_AGENT,
      // Ohne diesen Kopf liefern mehrsprachige Behördenauftritte (Swissmedic,
      // EMA, Health Canada) irgendeine Sprache — meist Englisch. Die Reihenfolge
      // bildet die Zielgruppe ab: DACH zuerst, dann EU-Englisch.
      'accept-language': 'de,en;q=0.8,pt;q=0.6',
    },
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
/**
 * Merkzettel der selbst gefundenen Adressen (siehe feedDiscovery.js).
 *
 * Nur im Arbeitsspeicher und mit Absicht: Die Suche kostet einen zusätzlichen
 * Seitenabruf, und der Takt sind fünf Minuten — ohne Merkzettel läge die
 * Startseite jeder kaputten Behörde 288-mal am Tag auf dem Server. Nach einem
 * Neustart ist er leer; das ist richtig so, denn dann gilt wieder zuerst die
 * eingetragene Voreinstellung — sie könnte inzwischen repariert sein.
 */
const gefundeneAdressen = new Map(); // sourceId -> url

export const __discoveryCache = {
  get: (id) => gefundeneAdressen.get(id) || null,
  clear: () => gefundeneAdressen.clear(),
  size: () => gefundeneAdressen.size,
};

export async function fetchSource(source, opts = {}) {
  const { discover = discoverFeed, log = null } = opts;
  // Eigenes Zeitlimit der Quelle durchreichen. Nötig geworden für die TGA:
  // Australien ist von Frankfurt aus weit, und 15 s reichten dort auf allen
  // drei Adressen nicht — sie liefen sämtlich in die Zeitüberschreitung.
  // Ein längeres Limit kostet nichts, solange es die Ausnahme bleibt: Die
  // Abrufe laufen parallel, nur der langsamste bestimmt die Dauer.
  const basis = opts.fetchText || fetchTextDefault;
  const fetchText = source.timeoutMs
    ? (u) => basis(u, { timeoutMs: source.timeoutMs })
    : basis;
  const unterOpts = { ...opts, fetchText };

  // Eine früher selbst gefundene Adresse wird MITPROBIERT, ersetzt die
  // Voreinstellung aber nicht: Steht die richtige Adresse wieder, gewinnt sie.
  const gemerkt = gefundeneAdressen.get(source.id);
  const adressen = [source.url, ...(source.fallbacks || []), gemerkt]
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i);
  const fehler = [];
  for (const [i, url] of adressen.entries()) {
    try {
      const raw = await fetchWithRetry(url, unterOpts);
      return {
        raw, url, usedFallback: i > 0, fallbackIndex: i, errors: fehler,
        usedDiscovery: url === gemerkt && i > 0,
      };
    } catch (e) {
      fehler.push({ url, error: (e && e.message) || String(e) });
    }
  }

  // Letzter Versuch: Sagt die Behörde selbst, wo ihr Feed jetzt liegt?
  // Nur für Feeds sinnvoll — eine JSON-Schnittstelle zeichnet niemand als
  // <link rel="alternate"> aus, dort wäre das nur ein verlorener Abruf.
  if (source.format === 'rss' && discover) {
    // Die Voreinstellung war falsch, nicht die Suche: Das gehört gemeldet,
    // sonst bleibt die falsche URL für immer im Quelltext stehen.
    gefundeneAdressen.delete(source.id);
    const fund = await discover(source, { ...unterOpts, log });
    if (fund) {
      gefundeneAdressen.set(source.id, fund.url);
      return {
        raw: fund.raw, url: fund.url, usedFallback: true, fallbackIndex: adressen.length,
        errors: fehler, usedDiscovery: true, discoveredVia: fund.page,
      };
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
/**
 * Gesehen-Schlüssel einer Meldung.
 *
 * Bewusst eine eigene Funktion und nicht eine Zeichenkette an zwei Stellen:
 * Die Aufnahme bildet ihn aus dem Feed-Eintrag, die Wiederherstellung aus der
 * Datenbankzeile. Liefen die beiden auseinander, käme der Fehler als
 * doppelter Beitrag heraus — und zwar erst nach dem nächsten Deploy.
 */
export function newsKey(sourceId, link) {
  return `${sourceId}:${String(link || '').trim()}`;
}

export function newsFromSource(source, raw) {
  if (source.format !== 'rss') {
    throw new Error(`Format ${source.format} ist für News nicht vorgesehen (nur rss/atom).`);
  }
  const { feedTitle, items } = parseFeed(raw);
  return items.map((it) => ({
    // Stabile Kennung über die Quelle hinweg: derselbe Beitrag bei zwei
    // Quellen bleibt zwei Beiträge, derselbe Beitrag bei einem erneuten Abruf
    // bleibt einer.
    //
    // Der LINK, nicht `it.id` (guid). Beide sind stabil, aber nur der Link
    // steht auch in der Datenbank — er ist dort der eindeutige Schlüssel. Erst
    // dadurch lässt sich der Gesehen-Stand aus der Datenbank wiederherstellen:
    // Nach einem Deploy ist der Snapshot auf dem kostenlosen Tarif weg, und
    // ohne rekonstruierbaren Schlüssel legte die nächste Aufnahme jede bereits
    // gespeicherte Meldung ein zweites Mal an.
    //
    // Einmalige Folge der Umstellung: Meldungen, die unter dem alten
    // guid-Schlüssel als gesehen galten, gelten es nicht mehr. Sie werden
    // einmal neu aufgenommen — auf dem Freitarif ohnehin folgenlos, weil der
    // Snapshot einen Deploy nicht überlebt.
    key: newsKey(source.id, it.link),
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
  // --- openFDA (US-Behoerde) --------------------------------------------
  //  Die Behoerde nennt ihre Statuswerte anders als jedes europaeische
  //  Register. Ohne diese Zeilen wuerde JEDE ihrer Meldungen verworfen —
  //  unbekannter Status heisst in diesem Projekt bewusst „Zeile weg".
  //  ⚠️ Aus der Dokumentation uebernommen, hier NICHT gegen die echte
  //  Schnittstelle geprueft (Bauumgebung ohne Netz). Was tatsaechlich
  //  ankommt, zeigt der erste Lauf: Liefert die Quelle nur verworfene
  //  Zeilen, meldet der Lauf das mit den ersten Gruenden.
  'currently in shortage': 'kritisch',
  'to be discontinued': 'eingeschraenkt',
  'no longer available': 'kritisch',
  discontinued: 'kritisch',
  resolved: 'verfuegbar',
  available: 'verfuegbar',
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
  wirkstoff: ['wirkstoff', 'substance', 'active_substance', 'wirkstoffe', 'generic_name'],
  bezeichnung: ['bezeichnung', 'arzneispezialität', 'arzneispezialitaet', 'praeparat', 'präparat', 'name', 'product', 'proprietary_name', 'company_name'],
  status: ['status', 'vertriebsstatus', 'availability'],
  grund: ['grund', 'reason', 'ursache', 'reason_for_shortage'],
  gemeldet_am: ['gemeldet_am', 'meldedatum', 'von', 'start', 'reported', 'initial_posting_date'],
  voraussichtlich_bis: ['voraussichtlich_bis', 'bis', 'ende', 'expected_end', 'end', 'estimated_shortage_duration'],
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

    // Fehlt die Handelsbezeichnung, tritt der Wirkstoff an ihre Stelle.
    //
    // Ohne diese Regel verlor die openFDA-Quelle den GROSSTEIL ihrer Zeilen:
    // Generika haben oft gar keinen Handelsnamen, dort steht nur
    // `generic_name`. Ein Engpass von „Metformin" ohne Markennamen ist eine
    // echte Information — sie wegzuwerfen waere schlechter, als sie unter dem
    // Wirkstoffnamen zu fuehren. Dieselbe Regel gilt bereits beim Schreiben in
    // die Datenbank (repo/prismaStore.js); sie hier NICHT zu haben hiess, dass
    // dieselbe Zeile je nach Weg einmal ankam und einmal nicht.
    const anzeigename = bezeichnung || wirkstoff;
    if (!anzeigename) { rejected.push(`#${i}: weder Bezeichnung noch Wirkstoff`); continue; }
    if (!status) { rejected.push(`#${i}: Status unbekannt (${rohStatus || 'leer'})`); continue; }

    out.push({
      wirkstoff: wirkstoff || anzeigename,
      bezeichnung: anzeigename,
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
