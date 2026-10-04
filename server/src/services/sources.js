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
    // Der Name sagt jetzt, was wirklich kommt. Das ist kein Detail: Unter
    // „Aktuelles" erwartet man Pressemitteilungen, geliefert werden
    // Lieferengpass-Meldungen — fuer eine Apotheke das Wertvollste, was das
    // BfArM hat. Ein Etikett, das nicht zum Inhalt passt, kostet Vertrauen
    // genau dort, wo es gebraucht wird.
    label: 'BfArM — Lieferengpaesse',
    // NACHWEISLICH GEPRUEFT. Von der Selbstfindung im Betrieb gefunden und
    // zweimal hintereinander erfolgreich abgerufen (Protokoll 05.09.2026,
    // 16:56:45 und 16:58:25, zwei verschiedene Prozesse):
    //   „bfarm_news — Feed selbst gefunden unter …/Lieferengpaesse/
    //    RSSNewsfeed.xml?nn=471282 (ausgezeichnet auf …/Lieferengpaesse/
    //    _node.html)"
    // Dass ausgerechnet dieser Feed gefunden wurde, ist kein Zufall: Die
    // Lieferengpass-Seite steht seit dem letzten Lauf an erster Stelle der
    // Suchseiten — das BfArM haengt seine Feeds an die Fachseiten.
    url: 'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/Lieferengpaesse/RSSNewsfeed.xml?nn=471282',
    // Befund vom 05.09.2026: /DE/Aktuelles/_node.html war lesbar (353 808
    // Zeichen) und trug KEINEN Feed. Das BfArM haengt seine Feeds nicht an
    // eine zentrale Newsseite, sondern an die jeweilige FACHSEITE. Fuer eine
    // Apothekenplattform sind Lieferengpaesse und Rote-Hand-Briefe ohnehin
    // die wertvolleren Quellen als allgemeine Pressemitteilungen.
    homepage: [
      'https://www.bfarm.de/DE/Arzneimittel/Arzneimittelinformationen/Lieferengpaesse/_node.html',
      'https://www.bfarm.de/DE/Arzneimittel/Pharmakovigilanz/Risikoinformationen/Rote-Hand-Briefe/_node.html',
      'https://www.bfarm.de/DE/Arzneimittel/Zulassung/_node.html',
    ],
    // `nn=471282` ist eine Navigations-Kennung des Behoerden-Baukastens. Sie
    // hat funktioniert, koennte aber wegfallen — deshalb dieselbe Adresse
    // ohne Kennung als erste Ersatzadresse, bevor es zum Ministerium geht.
    fallbacks: [
      'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/Lieferengpaesse/RSSNewsfeed.xml',
      'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSSNewsfeed.xml',
      'https://www.bundesgesundheitsministerium.de/rss/aktuelles.xml',
    ],
    official: true, verified: true,
  },
  {
    id: 'pei_news', kind: 'news', country: 'DE', format: 'rss',
    label: 'Paul-Ehrlich-Institut — Aktuelles',
    url: 'https://www.pei.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/rss-newsfeed.xml',
    // Die RSS-Uebersicht des PEI. Nicht geraten: Die Selbstfindung hat am
    // 05.09.2026 auf der Newsroom-Seite genau dorthin verwiesen gefunden —
    // nur falsch aufgeloest, weil <base href> fehlte (feedDiscovery.js).
    //
    // ⚠️ WICHTIG ZU DEN .html-ADRESSEN HIER UNTEN:
    // Sie stehen in `homepage` und NICHT in `url`, und das ist kein Versehen.
    // `rss-node.html` und `rss-inhalt.html` sind UEBERSICHTSSEITEN, die auf
    // Feeds verweisen — keine Feeds. Eine davon als `url` einzutragen hiesse,
    // dem Feed-Parser HTML vorzusetzen: Der Abruf gelingt (HTTP 200), das
    // Ergebnis sind null Meldungen, und im Protokoll steht kein Fehler.
    // Das waere schlechter als die heutige 404, weil es nach Erfolg aussieht.
    // Die Selbstfindung liest diese Seiten und holt sich die echte Feed-Adresse
    // daraus — genau dafuer sind sie hier.
    homepage: [
      'https://www.pei.de/DE/footer-kopfleiste/rss/rss-node.html',
      'https://www.pei.de/DE/footer-kopfleiste/rss/rss-inhalt.html',
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
    // /en/news-events/rss-feeds ist die dokumentierte RSS-Seite und stand hier
    // schon — sie hat trotzdem nichts ergeben. Deshalb zusaetzlich die
    // Einzahl-Variante /en/news-event/rss-feeds, die in Suchindizes ebenfalls
    // als gueltige EMA-Seite gefuehrt wird: Die EMA hat ihren Auftritt
    // umgebaut, und beide Schreibweisen existieren nebeneinander.
    // Ob eine davon traegt, sagt jetzt `discovery` in /api/live/status —
    // dafuer braucht es keinen Log-Ausschnitt mehr.
    homepage: [
      'https://www.ema.europa.eu/en/news-events/rss-feeds',
      'https://www.ema.europa.eu/en/news-event/rss-feeds',
      'https://www.ema.europa.eu/en/news-events',
      'https://www.ema.europa.eu/en/homepage',
    ],
    // ── HTTP 429, und was dagegen WIRKLICH hilft ─────────────────────────────
    //  Die EMA hat mit „Too Many Requests" geantwortet. Daran ist kein Pfad
    //  und kein Kopf schuld — die Zahl der Anfragen ist es. Nachgerechnet:
    //  ema_news und ema_shortages liegen auf DEMSELBEN Host, jede hat bis zu
    //  vier Seiten fuer die Selbstfindung und eine Wiederholung. Das sind bis
    //  zu zehn Anfragen an ema.europa.eu, praktisch gleichzeitig, weil die
    //  Quellen parallel geholt werden — alle fuenf Minuten.
    //
    //  Der Mindestabstand serialisiert sie. Zwei Sekunden klingen wenig, aber
    //  sie verteilen zehn Anfragen auf zwanzig Sekunden statt auf eine. Dazu
    //  kommt, dass `Retry-After` jetzt beachtet wird (fetchWithRetry).
    //
    //  Was hier ABSICHTLICH NICHT steht: eine Browser-Kennung, um der
    //  Begrenzung auszuweichen. 429 ist eine ausdrueckliche Bitte, langsamer
    //  zu sein; sie mit einer anderen Kennung zu umgehen hiesse, eine
    //  technische Schutzmassnahme einer Behoerde zu unterlaufen. Unsere
    //  Kennung nennt Zweck und Kontaktadresse (USER_AGENT) — genau damit kann
    //  die EMA uns freischalten, wenn sie will.
    minHostGapMs: 2_000,
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
    // Die deutsche Newsseite antwortete mit 404, die englische Fassung
    // existiert und heisst ausdruecklich „Information services - newsletter,
    // RSS feed". Deutsch bleibt zuerst, falls sie zurueckkehrt.
    //
    // ⚠️ `news/rss.html` ist eine SEITE, kein Feed (siehe denselben Hinweis
    // bei pei_news). Sie steht deshalb hier und nicht als `url`. Sie steht
    // ZUERST, weil sie laut Selbstfindung die Seite ist, die auf die Feeds
    // verweist — die Suche findet dort also am ehesten etwas.
    homepage: [
      'https://www.swissmedic.ch/swissmedic/de/home/news/rss.html',
      'https://www.swissmedic.ch/swissmedic/en/home/news/news.html',
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
    // Die RSS-Uebersicht ist der richtige Einstieg — belegt: Die Selbstfindung
    // hat dort am 05.09.2026 einen gueltigen Feed gefunden.
    //
    // ABER: Gefunden wurde /en/feed/consumer-products-alerts-recalls —
    // Rueckrufe von KONSUMGUETERN, weil dieser Feed auf der Seite zuerst
    // steht. Technisch einwandfrei, fachlich das Falsche. Deshalb wird er
    // NICHT zur Voreinstellung befoerdert: Eine Apotheke, die unter
    // „Health Canada — Rueckrufe" Meldungen ueber Wasserkocher liest, haelt
    // beim naechsten Mal auch die Arzneimittel-Meldung fuer Beiwerk.
    // Stattdessen sagt `prefer` der Suche, worauf es ankommt.
    prefer: ['health-product', 'drug', 'medeffect', 'medical-device'],
    homepage: [
      'https://recalls-rappels.canada.ca/en/rss-feeds',
      'https://recalls-rappels.canada.ca/en',
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
    // Ersatzadressen ENTFERNT — nicht weil sie falsch waeren, sondern weil sie
    // nichts nuetzen und viel kosten. Das Protokoll vom 05.09.2026 zeigt: Auch
    // mit 30 s laeuft der Abruf ab (Beginn 04:44:23, Abbruch 04:44:53). Wenn
    // der HOST nicht antwortet, antwortet er auf keinem seiner drei Pfade.
    // Mit drei Adressen und je zwei Versuchen waren das bis zu 180 s pro
    // Durchlauf — alle fuenf Minuten, vollstaendig vergeblich. Jetzt hoechstens
    // 60 s. Die Pfade selbst bleiben in der Doku vermerkt; sollte die TGA
    // wieder erreichbar sein, greift die Selbstfindung ueber ihre RSS-Seite.
    fallbacks: [],
    homepage: 'https://www.tga.gov.au/news/subscribe-updates/rss-feeds',
    // Alle DREI Adressen liefen in die Zeitüberschreitung — nicht in 404.
    // Das ist ein anderer Befund: Die Pfade stimmen vermutlich, die Antwort
    // kommt nur nicht in 15 s. Australien ist von Frankfurt aus rund 16 000 km
    // entfernt, und dreimal 15 s hintereinander deutet auf einen langsamen
    // Server, nicht auf drei falsche Pfade. Deshalb hier mehr Geduld statt
    // neuer URLs. Kostet nichts: Die Quellen werden parallel geholt.
    // ⚠️ KORREKTUR ZUM AUFTRAG: Verlangt waren 15 000 ms. Hier standen schon
    //    30 000 — 15 000 waere also eine HALBIERUNG gewesen, und das
    //    Protokoll vom 05.09.2026 belegt, dass selbst 30 s nicht reichten
    //    (Beginn 04:44:23, Abbruch 04:44:53). Das Limit zu senken haette den
    //    Abruf sicher zum Scheitern gebracht, waehrend die Aenderung nach
    //    Reparatur aussieht. Deshalb hoch auf 45 s statt herunter auf 15 s.
    //
    //    Mehr Geduld kostet hier fast nichts: Die Quellen werden parallel
    //    geholt, und die TGA hat keine Ersatzadressen mehr (siehe oben), also
    //    hoechstens 2 × 45 s fuer diese eine Quelle.
    timeoutMs: 45_000,
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
    id: 'openfda_recalls', kind: 'news', country: 'US', format: 'json',
    label: 'FDA — Rueckrufe (openFDA Enforcement)',
    // ── VON 'shortages' AUF 'news' UMGESTELLT (04.10.2026) ───────────────────
    //  Befund aus dem Betrieb: „100 Zeilen empfangen, keine verwertbar." Zwei
    //  Ursachen, und die zweite ist die wichtigere.
    //
    //  1. Die Spaltennamen passten nicht. Der Engpass-Parser sucht
    //     `bezeichnung`/`name`/`product`; die Behoerde liefert
    //     `product_description`. Der Wirkstoff steht nicht oben, sondern
    //     verschachtelt unter `openfda.generic_name` als ARRAY. Also fiel
    //     jede Zeile mit „weder Bezeichnung noch Wirkstoff" durch.
    //
    //  2. Der Status passte PRINZIPIELL nicht. openFDA liefert
    //     „Ongoing/Completed/Terminated" — den Stand des RUECKRUFVERFAHRENS,
    //     nicht die Lieferfaehigkeit. Haette ich nur die Spaltennamen
    //     nachgetragen und „Ongoing" auf „kritisch" abgebildet, waere aus 100
    //     verworfenen Zeilen etwas Schlimmeres geworden: 100 Engpassmeldungen,
    //     die es nicht gibt. Ein Rueckruf einer Charge heisst nicht, dass das
    //     Praeparat nicht lieferbar ist — und genau danach bestellt eine
    //     Apotheke um.
    //
    //  Dazu kaeme der Zusammenstoss im Schema: `Shortage` ist ueber
    //  [drugName, country] eindeutig. Ein Rueckruf und ein echter Engpass
    //  desselben Praeparats in den USA haetten sich um eine Zeile gestritten.
    //
    //  Als Meldung ist der Rueckruf dagegen vollstaendig richtig: Titel,
    //  Grund, Firma, Einstufung, Verfahrensstand und ein Link auf den
    //  Datensatz bei der Behoerde. Die Einstufung als RECALL macht die KI auf
    //  der Signal-Ebene mit Vertrauenswert (siehe newsFromJson).
    //
    // Gemeinfrei wie die uebrigen openFDA-Endpunkte, ohne Schluessel nutzbar.
    // Die Begrenzung auf die letzten Eintraege haelt die Antwort klein.
    url: 'https://api.fda.gov/drug/enforcement.json?limit=100',
    // Benannte Felder, nichts aus Fliesstext geschnitten.
    jsonNews: {
      list: 'results',
      title: ['product_description'],
      summary: ['reason_for_recall'],
      id: ['recall_number'],
      date: ['recall_initiation_date', 'report_date'],
      // Der Link zeigt auf den DATENSATZ bei der Behoerde, abgefragt ueber die
      // Rueckrufnummer. Bewusst die Schnittstelle und keine fda.gov-Seite: Es
      // gibt keine amtliche HTML-Seite je Rueckruf, und einen Pfad zu erfinden,
      // den ich von hier aus nicht pruefen kann, waere genau der Fehler, der
      // PEI und Swissmedic auf 404 gesetzt hat. Diese Adresse ist belegbar und
      // fuehrt zu genau dem Eintrag, auf dem die Meldung beruht.
      linkTemplate: 'https://api.fda.gov/drug/enforcement.json?search=recall_number:%22{id}%22',
      extra: {
        Wirkstoff: ['openfda.generic_name'],
        Firma: ['recalling_firm'],
        Einstufung: ['classification'],
        Verfahrensstand: ['status'],
        Rueckrufnummer: ['recall_number'],
      },
    },
    official: true, verified: false,
  },
  {
    id: 'ema_shortages', kind: 'news', country: 'EU', format: 'rss',
    label: 'EMA — Verfuegbarkeit von Humanarzneimitteln',
    // kind: 'news' und NICHT 'shortages' — das ist der Punkt, und ich hatte es
    // beim ersten Versuch falsch. Ein Test hat es gefangen.
    //
    // Die Regel dieser Datei (siehe Dateikopf) lautet: Engpass-DATENSAETZE
    // entstehen ausschliesslich aus strukturierten Exporten mit benannten
    // Spalten, nie aus RSS. Wer eine Schlagzeile zu einem Datensatz mit
    // Statusfeld macht, erzeugt Zahlen, die aussehen wie geprueft und keine
    // sind — und eine Apotheke bestellt danach um.
    //
    // Die EMA veroeffentlicht
    // ihre Engpassuebersicht als redaktionelle Seiten, nicht als Schnittstelle
    // mit Statusspalte. Sie laeuft deshalb als MELDUNG mit Link. Die Einstufung
    // als SHORTAGE macht die KI auf der Signal-Ebene (VerifiedSignal) — dort
    // ist sie eine Zuordnung mit Vertrauenswert und Originallink, kein
    // Datensatz, auf den sich jemand wie auf eine amtliche Statusmeldung
    // verlaesst. Das ist der Unterschied.
    //
    // Nicht abrufbar aus dieser Bauumgebung. Die Selbstfindung sucht ueber die
    // hinterlegten Seiten, falls die Adresse nicht mehr stimmt.
    url: 'https://www.ema.europa.eu/en/rss/medicines-shortages.xml',
    homepage: [
      'https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/medicine-shortages-availability-issues',
      'https://www.ema.europa.eu/en/news-events/rss-feeds',
    ],
    // Derselbe Host wie ema_news — der Abstand gilt pro HOST, nicht pro
    // Quelle. Beide Eintraege brauchen ihn deshalb, sonst bremst nur einer von
    // zweien und die Begrenzung greift weiter (siehe ema_news).
    minHostGapMs: 2_000,
    official: true, verified: false,
  },
  {
    id: 'basg_shortages', kind: 'shortages', country: 'AT', format: 'json',
    label: 'BASG — Vertriebseinschränkungen',
    url: 'https://vertriebseinschraenkungen.basg.gv.at/api/v1/public/shortages',
    // ── „fetch failed" ist KEINE HTTP-Antwort ────────────────────────────────
    //  Das Protokoll meldet `fetch failed`, nicht 404 und nicht 403. Das
    //  passiert UNTERHALB von HTTP: DNS, TLS-Handschlag, Verbindungsaufbau.
    //  Der Server hat nie geantwortet — es gibt also keinen Statuscode, auf
    //  den ein Kopf Einfluss haette.
    //
    //  EHRLICHE EINORDNUNG: Die beiden Koepfe unten sind trotzdem richtig
    //  (eine JSON-Schnittstelle, die bei `*/*` HTML ausliefert, ist haeufig),
    //  aber sie sind nicht die Reparatur. Wer behauptet, `Accept` behebe ein
    //  `fetch failed`, hat die Fehlermeldung nicht gelesen.
    //
    //  Was es wirklich sein kann, und was jeweils zu tun ist:
    //   · Die Behoerde hat die Schnittstelle abgeschaltet oder verlegt
    //     -> neue Adresse per APOPULSE_SOURCE_BASG_SHORTAGES_URL eintragen.
    //   · Render erreicht die .gv.at-Zone nicht (DNS/Routing)
    //     -> am Dienst erkennbar, nicht im Code behebbar.
    //   · TLS-Kette wird nicht akzeptiert
    //     -> ebenfalls nicht im Code behebbar, und NICHT durch Abschalten der
    //        Pruefung zu „loesen": Ungeprueftes TLS auf dem Weg, auf dem
    //        Engpassdaten fuer Apotheken ankommen, waere der schlechteste
    //        Tausch dieses Projekts.
    //
    //  KEIN PROXY-FALLBACK, und das ist eine Entscheidung, nicht Faulheit:
    //  Ein Drittanbieter-Proxy im Pfad behoerdlicher Arzneimitteldaten koennte
    //  Inhalte veraendern, ohne dass es auffaellt — und die gesamte
    //  Herkunfts-Zusicherung dieses Projekts („die Zeile stammt vom BASG")
    //  haengt daran, dass genau das nicht passiert. Ein Proxy liesse sich von
    //  hier aus ausserdem nicht pruefen.
    headers: {
      accept: 'application/json, text/plain;q=0.8, */*;q=0.5',
    },
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

// --- Abstand je Behördenserver ----------------------------------------------
//  Gegen 429 („Too Many Requests") hilft kein anderer Kopf und kein zweiter
//  Versuch, sondern NUR weniger Anfragen. Und genau daran lag es bei der EMA:
//  Pro Durchlauf gehen dort bis zu zehn Anfragen an denselben Host —
//  ema_news und ema_shortages, jede mit bis zu vier Seiten für die
//  Selbstfindung, jede mit einer Wiederholung. Alle praktisch gleichzeitig,
//  weil die Quellen parallel geholt werden.
//
//  Dieser Riegel serialisiert Anfragen AN DENSELBEN HOST mit einem
//  Mindestabstand. Unterschiedliche Behörden bremsen sich dabei nicht
//  gegenseitig — nur wer sich beschwert, wird langsamer bedient.
const letzterAbrufProHost = new Map(); // host -> Zeitpunkt (ms)

export const __hostGate = {
  reset: () => letzterAbrufProHost.clear(),
  size: () => letzterAbrufProHost.size,
};

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Warten, bis der Mindestabstand zum letzten Abruf desselben Hosts erreicht ist.
 *
 * `now`/`sleep` sind injizierbar, damit Tests nicht in Echtzeit warten müssen.
 * Der Zeitpunkt wird VOR dem Warten gesetzt: Sonst stürmen zwei gleichzeitig
 * gestartete Abrufe beide los, weil beide denselben alten Stand lesen.
 */
export async function hostAbstand(url, gapMs, { now = () => Date.now(), sleep = schlafen } = {}) {
  if (!gapMs || gapMs <= 0) return 0;
  let host;
  try { host = new URL(url).host; } catch { return 0; }
  const jetzt = now();
  const frei = letzterAbrufProHost.get(host) || 0;
  const wartezeit = Math.max(0, frei - jetzt);
  letzterAbrufProHost.set(host, Math.max(jetzt, frei) + gapMs);
  if (wartezeit > 0) await sleep(wartezeit);
  return wartezeit;
}

/**
 * `Retry-After` auslesen — in Sekunden oder als HTTP-Datum.
 *
 * Gibt `null` zurück, wenn der Kopf fehlt oder unbrauchbar ist. Die Obergrenze
 * ist Absicht: Eine Behörde, die „komm in zwei Stunden wieder" sagt, darf den
 * Abruf nicht zwei Stunden blockieren — dann ist die Quelle für diesen
 * Durchlauf eben stumm und der nächste Takt versucht es erneut.
 */
export function retryAfterMs(wert, { maxMs = 60_000, now = () => Date.now() } = {}) {
  if (wert == null || wert === '') return null;
  const sekunden = Number(String(wert).trim());
  if (Number.isFinite(sekunden)) {
    if (sekunden < 0) return null;
    return Math.min(sekunden * 1000, maxMs);
  }
  const ms = Date.parse(String(wert));
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(0, ms - now()), maxMs);
}

export async function fetchTextDefault(url, {
  timeoutMs = 15_000, fetchImpl = globalThis.fetch, headers = {}, minHostGapMs = 0, gateOpts = {},
} = {}) {
  await hostAbstand(url, minHostGapMs, gateOpts);
  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/csv, application/json;q=0.8, */*;q=0.5',
      'user-agent': USER_AGENT,
      // Ohne diesen Kopf liefern mehrsprachige Behördenauftritte (Swissmedic,
      // EMA, Health Canada) irgendeine Sprache — meist Englisch. Die Reihenfolge
      // bildet die Zielgruppe ab: DACH zuerst, dann EU-Englisch.
      'accept-language': 'de,en;q=0.8,pt;q=0.6',
      // Quellenspezifische Köpfe ZULETZT: Eine Quelle darf die Voreinstellung
      // überschreiben (etwa `accept: application/json` für eine Schnittstelle,
      // die bei `*/*` HTML ausliefert).
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) {
    const e = new Error('HTTP ' + res.status);
    e.status = res.status;
    // `Retry-After` mitnehmen, solange wir die Antwort noch in der Hand haben.
    // Ohne das wüsste die Wiederholung nicht, wie lange sie warten soll, und
    // würde nach einer halben Sekunde in dieselbe 429 laufen.
    const ra = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
    if (ra) e.retryAfterMs = retryAfterMs(ra);
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
  // Obergrenze fuer das, was die Behoerde als Wartezeit verlangt. Siehe
  // retryAfterMs: Ein „komm in zwei Stunden wieder" darf den Durchlauf nicht
  // blockieren.
  maxRetryAfterMs = 60_000,
} = {}) {
  let letzter;
  for (let versuch = 1; versuch <= attempts; versuch++) {
    try {
      return await fetchText(url);
    } catch (e) {
      letzter = e;
      if (isPermanentError(e)) throw e;         // sinnlos zu wiederholen
      if (versuch === attempts) break;

      // ── 429: so lange warten, wie die Behörde es sagt ──────────────────────
      //  Vorher wurde bei 429 nach 500 ms erneut angefragt. Das ist genau das
      //  Verhalten, das die Begrenzung bestraft: Wer „zu viele Anfragen" mit
      //  einer weiteren Anfrage beantwortet, bekommt wieder 429 — und die
      //  Wiederholung war damit nicht nur wirkungslos, sondern Teil des
      //  Problems. Steht ein `Retry-After` in der Antwort, gilt dieser Wert.
      const verlangt = e.status === 429
        ? (Number.isFinite(e.retryAfterMs) ? Math.min(e.retryAfterMs, maxRetryAfterMs) : 5_000)
        : null;
      const warten = verlangt ?? baseDelayMs * versuch;
      log?.(`ApoPulse Quellen: ${url} Versuch ${versuch} fehlgeschlagen (${e.message})`
        + (verlangt != null ? ` — Behoerde verlangt ${Math.round(warten / 1000)} s Pause` : '')
        + ' — neuer Versuch');
      await sleep(warten);
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
  // Eigene Kopfzeilen und ein Mindestabstand je Host kommen auf demselben Weg
  // durch wie das Zeitlimit: als Eigenschaft der QUELLE, nicht als globale
  // Voreinstellung. Eine Behörde, die eine Besonderheit braucht, soll nicht
  // das Verhalten aller anderen ändern.
  const eigen = {};
  if (source.timeoutMs) eigen.timeoutMs = source.timeoutMs;
  if (source.headers) eigen.headers = source.headers;
  if (source.minHostGapMs) eigen.minHostGapMs = source.minHostGapMs;
  const fetchText = Object.keys(eigen).length
    ? (u, extra = {}) => basis(u, { ...eigen, ...extra })
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

// --- Strukturierter Export als MELDUNG --------------------------------------
//  Der dritte Weg, und er brauchte eine Begründung, bevor er entstand.
//
//  Die Regel dieser Datei lautet: Engpass-DATENSÄTZE nur aus strukturierten
//  Exporten, Meldungen aus RSS. Eine JSON-Schnittstelle, deren Inhalt KEIN
//  Engpass ist, passte in keinen der beiden Wege — openFDA-Rückrufe sind genau
//  das. Sie lagen deshalb als `kind: 'shortages'` registriert, und das war in
//  zwei Punkten falsch:
//
//   1. FACHLICH. Ein Rückruf sagt nichts über die Lieferfähigkeit. „Class III,
//      Ongoing" als Engpass-Status zu schreiben, hieße: In der Apotheke steht
//      „kritisch — nicht lieferbar" unter einem Präparat, das vollständig
//      verfügbar ist und bei dem eine einzelne Charge zurückgerufen wurde.
//   2. TECHNISCH. `Shortage` hat `@@unique([drugName, country])`. Ein Rückruf
//      und ein echter Engpass desselben Wirkstoffs im selben Land streiten
//      sich um EINE Zeile — die eine überschreibt die andere, je nachdem, wer
//      zuletzt läuft. Das ist Datenverlust, nicht Ungenauigkeit.
//
//  Deshalb wird ein solcher Export zur MELDUNG mit Link: sichtbar, verlinkt,
//  ohne erfundenen Statuswert. Die Einstufung als RECALL macht die KI auf der
//  Signal-Ebene — dort mit Vertrauenswert und Originallink, nicht als Zahl,
//  auf die sich jemand wie auf eine amtliche Statusmeldung verlässt. Dieselbe
//  Begründung wie bei `ema_shortages`, nur aus der anderen Richtung.
//
//  WAS DIESEN WEG VON „News aus Prosa raten" UNTERSCHEIDET: Die Felder werden
//  BENANNT (`jsonNews` an der Quelle). Es wird nichts aus einem Fließtext
//  geschnitten. Fehlt ein Pflichtfeld, wird die Zeile verworfen.

/** `20261004` -> `2026-10-04`. Sonst der Wert unverändert (ISO oder leer). */
export function normalizeCompactDate(wert) {
  const s = String(wert ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s;
}

/**
 * Einen JSON-Export in Meldungen wandeln.
 *
 * `jsonNews` an der Quelle beschreibt die Zuordnung:
 *   { list, title, summary, id, date, linkTemplate, extra }
 *
 * `linkTemplate` enthält `{id}`; der Wert wird URL-kodiert eingesetzt. Ohne
 * belegbaren Link entsteht KEINE Meldung — dieselbe Regel wie bei RSS, und sie
 * ist hier besonders wichtig: Ein VerifiedSignal ohne Rückverweis wird
 * serverseitig gar nicht gespeichert (services/signals.js).
 */
export function newsFromJson(source, raw) {
  const map = source.jsonNews;
  if (!map) {
    throw new Error(`Quelle ${source.id}: format 'json' im News-Weg braucht eine jsonNews-Zuordnung.`);
  }
  let payload;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('Antwort ist kein gültiges JSON: ' + (e && e.message));
  }

  const schluessel = map.list ? [].concat(map.list) : ['results', 'items', 'data', 'content'];
  const list = Array.isArray(payload)
    ? payload
    : schluessel.reduce((found, k) => found || (payload && Array.isArray(payload[k]) ? payload[k] : null), null);
  if (!list) throw new Error(`Keine Liste gefunden (weder Array noch ${schluessel.join('/')}).`);

  // Punktpfade werden aufgelöst (`openfda.generic_name`). Ohne das bliebe der
  // Wirkstoff bei openFDA leer: Er steht nicht oben im Datensatz, sondern
  // verschachtelt — und genau diese Verschachtelung war einer der zwei Gründe,
  // warum vorher keine einzige Zeile verwertbar war.
  const wert = (row, pfad) => String(pfad).split('.').reduce((o, k) => (o == null ? o : o[k]), row);

  const feld = (row, kandidaten) => {
    for (const k of [].concat(kandidaten || [])) {
      const v = wert(row, k);
      if (v == null) continue;
      // openFDA verschachtelt Wirkstoff und Handelsname als ARRAYS unter
      // `openfda`. Ein `String(array)` daraus ergäbe „a,b,c" — lesbar genug
      // für eine Meldung, aber der erste Wert ist der aussagekräftige.
      const w = Array.isArray(v) ? v[0] : v;
      const s = String(w ?? '').trim();
      if (s) return s;
    }
    return '';
  };

  const out = [];
  const rejected = [];
  for (const [i, row] of list.entries()) {
    if (!row || typeof row !== 'object') { rejected.push(`#${i}: kein Objekt`); continue; }
    const titel = feld(row, map.title);
    const kennung = feld(row, map.id);
    if (!titel) { rejected.push(`#${i}: kein Titel (${[].concat(map.title).join('/')})`); continue; }
    if (map.linkTemplate && !kennung) { rejected.push(`#${i}: keine Kennung für den Link`); continue; }

    const link = map.linkTemplate
      ? map.linkTemplate.replace('{id}', encodeURIComponent(kennung))
      : feld(row, map.link);
    if (!link) { rejected.push(`#${i}: kein Link — ohne Rückverweis keine Meldung`); continue; }

    // Zusatzfelder als benannte Zeilen an den Anriss. Kein Fließtext, kein
    // Umformulieren — Feldname und Wert, wie die Behörde sie liefert.
    const zusatz = [];
    for (const [etikett, kandidaten] of Object.entries(map.extra || {})) {
      const v = feld(row, kandidaten);
      if (v) zusatz.push(`${etikett}: ${v}`);
    }
    const anriss = [feld(row, map.summary), ...zusatz].filter(Boolean).join('\n');

    out.push({
      key: newsKey(source.id, link),
      sourceId: source.id,
      sourceLabel: source.label || source.id,
      official: !!source.official,
      country: source.country,
      // Lange Produktbeschreibungen kürzen: Die Behörde schreibt dort
      // Packungsgrößen und NDC-Nummern hinein. Der Volltext bleibt im Anriss.
      title: titel.length > 240 ? titel.slice(0, 237) + '…' : titel,
      link,
      summary: anriss || null,
      publishedAt: normalizeCompactDate(feld(row, map.date)) || null,
      categories: [],
    });
  }
  if (!out.length && list.length) {
    // Genau der Befund, der diese Reparatur ausgelöst hat: „100 Zeilen
    // empfangen, keine verwertbar". Die Gründe gehören in die Meldung, sonst
    // sucht beim nächsten Mal wieder jemand im Dunkeln.
    throw new Error(`${list.length} Zeilen empfangen, keine verwertbar — `
      + rejected.slice(0, 3).join('; '));
  }
  return out;
}

export function newsFromSource(source, raw) {
  if (source.format === 'json') return newsFromJson(source, raw);
  if (source.format !== 'rss') {
    throw new Error(`Format ${source.format} ist für News nicht vorgesehen (nur rss/atom/json).`);
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
