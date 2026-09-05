// ============================================================================
//  Feed-Selbstfindung — wenn die hinterlegte Adresse 404 sagt
// ============================================================================
//  WARUM ES DAS GIBT
//
//  Der erste echte Lauf auf Render hat den Befund geliefert, den die
//  Bauumgebung nie liefern konnte (dort gibt es keinen Netzzugang): von 19
//  News-Quellen antworteten 8 gar nicht, die meisten mit 404. Nicht weil die
//  Behörden keinen Feed hätten — BfArM, PEI, BASG, EMA, Swissmedic, FDA und
//  Health Canada veröffentlichen alle einen —, sondern weil der PFAD sich
//  geändert hat. Behörden bauen ihre Webauftritte um; die Feed-Adresse
//  wandert dabei mit.
//
//  Die naheliegende Reaktion wäre, neue URLs einzutragen. Genau das wäre
//  wieder geraten: Diese Umgebung kann keine einzige davon abrufen — weder
//  per HTTP noch über einen Seitenabruf; beides ist gesperrt. Eine geratene
//  URL sieht aber im Quelltext genauso aus wie eine geprüfte. So sind die
//  jetzigen 404 überhaupt entstanden.
//
//  Deshalb der andere Weg: Der Server sucht die Adresse dort, wo das Netz
//  tatsächlich funktioniert — im Betrieb. Feeds sind seit jeher in der
//  Startseite ausgezeichnet:
//
//     <link rel="alternate" type="application/rss+xml" href="/rss/news.xml">
//
//  Das ist keine Bastelei, sondern das dokumentierte Verfahren, mit dem jeder
//  Feedreader seit zwanzig Jahren arbeitet. Findet die Behörde ihren Feed
//  selbst neu aus, findet ihn der Server mit — ohne Deploy.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE SICHERHEITSREGEL, DIE HIER NICHT VERHANDELBAR IST
//  ──────────────────────────────────────────────────────────────────────────
//  Übernommen wird eine gefundene Adresse NUR, wenn sie auf derselben
//  amtlichen Domain liegt wie die Quelle. Ohne diese Regel wäre die
//  Selbstfindung ein Einfallstor: Wer die Startseite der Behörde verändern
//  oder eine Weiterleitung unterschieben kann, könnte den Server auf einen
//  fremden Feed lenken — und dessen Meldungen erschienen dann mit dem Siegel
//  „BfArM" im Feed einer Apotheke. Die Prüfung ist dieselbe wie bei den
//  sozialen Konten (socialSources.js): Host gleich oder echte Unterdomäne,
//  geprüft mit vorangestelltem Punkt. Ein schlichtes endsWith würde
//  `nicht-bfarm.de` als Unterdomäne von `bfarm.de` durchgehen lassen.
//
//  Und: Die gefundene Adresse wird NICHT stillschweigend zur neuen Wahrheit.
//  Sie wird gemeldet (Protokoll + /api/live/status), damit sie jemand als
//  Voreinstellung nachzieht. Selbstheilung ersetzt keine Korrektur, sie
//  verschafft ihr nur Zeit.
// ============================================================================

import { isSameOrSubdomain } from './socialSources.js';

/** Feed-Typen, die als Antwort in Frage kommen. */
const FEED_TYPES = ['application/rss+xml', 'application/atom+xml', 'application/rdf+xml', 'text/xml', 'application/xml'];

/** Höchstens so viele Fundstellen werden ausprobiert (die Startseite kann Dutzende auszeichnen). */
export const MAX_CANDIDATES = 3;

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };

/**
 * Die in einer HTML-Seite ausgezeichneten Feed-Adressen.
 *
 * Bewusst mit einem Muster statt mit einem HTML-Parser: Gebraucht wird ein
 * einziges Element, die Datei hat sonst keine Abhängigkeiten, und ein halber
 * Parser für den ganzen Rest wäre mehr Angriffsfläche als Nutzen.
 * Zurückgegeben werden absolute URLs in Fundreihenfolge, ohne Doppelte.
 */
export function parseFeedLinks(html, baseUrl) {
  const out = [];
  const gesehen = new Set();
  const text = String(html || '');
  // Alle <link …> einsammeln; Reihenfolge der Attribute ist im HTML frei.
  for (const m of text.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = m[1];
    const rel = (attrs.match(/\brel\s*=\s*["']?([^"'>]*)/i) || [])[1] || '';
    // rel kann mehrere Werte tragen ("alternate home").
    if (!/\balternate\b/i.test(rel)) continue;
    const typ = ((attrs.match(/\btype\s*=\s*["']?([^"'>\s]*)/i) || [])[1] || '').toLowerCase();
    if (!FEED_TYPES.includes(typ)) continue;
    const href = (attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)
      || attrs.match(/\bhref\s*=\s*([^\s"'>]+)/i) || [])[1];
    if (!href) continue;
    let absolut;
    try { absolut = new URL(decodeAmp(href), baseUrl).toString(); } catch { continue; }
    // Nur http(s): ein `javascript:`- oder `data:`-href hat hier nichts zu suchen.
    if (!/^https?:$/.test(new URL(absolut).protocol)) continue;
    if (gesehen.has(absolut)) continue;
    gesehen.add(absolut);
    out.push(absolut);
  }
  return out;
}

/**
 * Zweite Stufe: Verweise auf einer „RSS-Feeds"-Übersichtsseite.
 *
 * Viele Behörden zeichnen ihren Feed NICHT im Seitenkopf aus, sondern führen
 * ihn auf einer eigenen Seite als gewöhnlichen Link auf („RSS feeds",
 * „Newsdienste"). Die erste Stufe findet dort nichts, obwohl die Adresse
 * sichtbar auf der Seite steht.
 *
 * Das ist naturgemäß unschärfer als eine Auszeichnung — deshalb greifen hier
 * ZWEI Filter: die Adresse muss nach Feed aussehen (.xml/.rss//rss//feed),
 * und der Abruf muss anschließend tatsächlich einen Feed liefern
 * (siehtWieFeedAus). Ein Link, der nur „RSS" heißt, reicht nicht.
 */
export function parseAnchorFeedLinks(html, baseUrl) {
  const out = [];
  const gesehen = new Set();
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeAmp(m[1]);
    if (!/(\.xml|\.rss)(\?|#|$)|\/rss\b|\/feeds?\b/i.test(href)) continue;
    let absolut;
    try { absolut = new URL(href, baseUrl); } catch { continue; }
    if (!/^https?:$/.test(absolut.protocol)) continue;
    const s = absolut.toString();
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    out.push(s);
  }
  return out;
}

// Im Attributwert steht &amp; für &. Mehr Entity-Auflösung braucht es in einer
// URL nicht — und mehr zu tun hieße, fremden Text zu interpretieren.
const decodeAmp = (s) => String(s).replace(/&amp;/gi, '&');

/**
 * Seiten, auf denen nach der Auszeichnung gesucht wird.
 *
 * Die Wurzel der Quell-Domain ist der verlässlichste Ort: Sie überlebt jeden
 * Umbau, während `/DE/Service/Presse/…` genau das ist, was sich verschiebt.
 * Eine ausdrücklich hinterlegte `homepage` geht vor.
 */
export function discoveryPages(source) {
  const seiten = [];
  // `homepage` darf eine Adresse oder mehrere sein: Manche Behörden führen
  // ihre Feeds auf einer eigenen Seite, andere nur auf der Nachrichtenseite.
  const hinweise = Array.isArray(source.homepage) ? source.homepage
    : (source.homepage ? [source.homepage] : []);
  seiten.push(...hinweise.filter(Boolean));
  try { seiten.push(new URL('/', source.url).toString()); } catch { /* unbrauchbare URL */ }
  return [...new Set(seiten)];
}

/**
 * Nach dem Feed einer Quelle suchen.
 *
 * Gibt `{ url, page }` zurück oder `null`. Wirft NICHT: Die Selbstfindung ist
 * der letzte Versuch nach ohnehin gescheiterten Abrufen — schlägt auch sie
 * fehl, ist die Quelle eben nicht erreichbar, und der ursprüngliche Fehler
 * ist die aussagekräftigere Meldung.
 */
export async function discoverFeed(source, { fetchText, log = null, maxCandidates = MAX_CANDIDATES } = {}) {
  const amtlich = hostOf(source.url);
  if (!amtlich) return null;

  for (const seite of discoveryPages(source)) {
    let html;
    try {
      html = await fetchText(seite);
    } catch (e) {
      log?.(`ApoPulse Quellen: ${source.id} — Startseite ${seite} nicht lesbar (${e && e.message})`);
      continue;
    }

    // Ausgezeichnete Feeds zuerst — sie sind die verlässliche Angabe. Erst
    // wenn es keine gibt, die unschärferen Verweise von der Übersichtsseite.
    const alle = [...parseFeedLinks(html, seite), ...parseAnchorFeedLinks(html, seite)]
      .filter((u, i, a) => a.indexOf(u) === i);
    const kandidaten = alle
      // DIE Regel: nur die amtliche Domain. Siehe Dateikopf.
      .filter((u) => isSameOrSubdomain(hostOf(u), amtlich))
      .slice(0, maxCandidates);

    // Der Unterschied zwischen „Seite nicht lesbar", „Seite gelesen, kein Feed
    // ausgezeichnet" und „Feed ausgezeichnet, aber auf fremder Domain" ist der
    // ganze Diagnosewert dieser Funktion. Ohne diese Meldung sieht der
    // Betreiber nur „nicht erreichbar" und weiß nicht, wo er ansetzen soll.
    if (!kandidaten.length) {
      log?.(`ApoPulse Quellen: ${source.id} — ${seite} gelesen (${html.length} Zeichen), `
        + (alle.length
          ? `${alle.length} Feed-Verweis(e) gefunden, aber keiner auf ${amtlich}: ${alle.slice(0, 3).join(', ')}`
          : 'kein Feed ausgezeichnet und kein feedartiger Verweis gefunden'));
      continue;
    }

    for (const kandidat of kandidaten) {
      try {
        const raw = await fetchText(kandidat);
        // Auszeichnung allein genügt nicht — es muss auch ein Feed herauskommen.
        // Sonst übernähme man eine Adresse, die eine HTML-Seite zurückgibt, und
        // der Fehler zeigte sich erst als „Quelle liefert 0 Meldungen".
        if (!siehtWieFeedAus(raw)) continue;
        return { url: kandidat, page: seite, raw };
      } catch (e) {
        log?.(`ApoPulse Quellen: ${source.id} — Fundstelle ${kandidat} antwortet nicht (${e && e.message})`);
      }
    }
  }
  return null;
}

/** Grobprüfung: Beginnt die Antwort wie ein Feed? */
export function siehtWieFeedAus(raw) {
  const kopf = String(raw || '').slice(0, 2000).toLowerCase();
  return kopf.includes('<rss') || kopf.includes('<feed') || kopf.includes('<rdf:rdf');
}
