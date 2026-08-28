// ============================================================================
//  Feed-Parser: RSS 2.0, Atom, CSV — ohne Abhängigkeiten
// ============================================================================
//  Behörden veröffentlichen ihre Meldungen in genau diesen Formaten. Der Parser
//  ist bewusst hier und nicht als npm-Paket: Das Backend läuft ausschließlich
//  auf Node-Built-ins, und ein XML-Parser als Abhängigkeit in einer Anwendung,
//  die Sicherheitsmeldungen verarbeitet, will man auditierbar haben.
//
//  KEIN HTML-SCRAPER. Eine Behörden-Seite per Regex auszulesen bricht beim
//  ersten Redesign — und zwar STILL, was bei Engpass- und Rückrufmeldungen die
//  gefährlichste Fehlerart ist. Verarbeitet werden deshalb nur strukturierte
//  Formate, die die Behörden ausdrücklich zum Weiterverarbeiten anbieten.
//
//  Robustheit ist hier kein Luxus: Diese Funktionen bekommen fremde Bytes aus
//  dem Netz. Sie dürfen nie werfen, nie hängen und nie halbe Daten liefern.
// ============================================================================

// --- Zeichenentitäten --------------------------------------------------------

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ntilde: 'ñ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', sbquo: '‚', lsquo: '‘', rsquo: '’',
  euro: '€', deg: '°', middot: '·', bull: '•', reg: '®', copy: '©', trade: '™',
};

export function decodeEntities(text) {
  if (typeof text !== 'string' || text.indexOf('&') === -1) return text || '';
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // Ungültige oder gefährliche Codepunkte unverändert lassen statt zu raten.
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
      ? NAMED_ENTITIES[body]
      : whole; // unbekannte Entität bleibt sichtbar, statt Text zu verschlucken
  });
}

// Ein ECHTES Tag: „<" gefolgt von optionalem „/" und einem Buchstaben.
// Das naheliegende /<[^>]*>/ ist zu gierig — es verschluckt in „Preis < 5 €
// und > 3" den halben Satz. Solche Zeichen kommen in Behördentexten vor.
const TAG = /<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^<>]*?)?\/?>/g;

function removeTags(s) {
  return s
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, ' ')
    .replace(TAG, '');
}

/**
 * Markup entfernen und Text glätten.
 *
 * Die Reihenfolge ist der Knackpunkt: In CDATA stehen echte Tags, in Atom mit
 * `type="html"` sind sie ENTITY-KODIERT (`&lt;p&gt;`). Deshalb wird zweimal
 * entfernt, aber nur EINMAL dekodiert — ein zweites Decode würde aus
 * `&amp;lt;script&amp;gt;` wieder ein echtes Skript-Tag machen.
 */
export function stripMarkup(html) {
  if (typeof html !== 'string') return '';
  let text = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = removeTags(text);          // echte Tags (CDATA, normales HTML)
  text = decodeEntities(text);      // kodiertes Markup wird jetzt sichtbar …
  text = removeTags(text);          // … und einmal entfernt. KEIN zweites Decode.
  return text.replace(/\s+/g, ' ').trim();
}

// --- XML-Zugriff -------------------------------------------------------------
//  Kein vollständiger XML-Parser, aber auch kein naives `/<title>(.*)<\/title>/`:
//  Namensräume (`<dc:date>`), Attribute am Start-Tag, CDATA und Selbstschluss-
//  Tags werden berücksichtigt. Genau daran scheitern die üblichen Ein-Zeilen-
//  Lösungen an echten Behörden-Feeds.

/** Alle Blöcke `<tag …>…</tag>` (ohne die Tags selbst). */
export function extractBlocks(xml, tag) {
  const out = [];
  const open = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${tag}(\\s[^>]*)?>`, 'gi');
  const closeTag = new RegExp(`</(?:[A-Za-z0-9_-]+:)?${tag}\\s*>`, 'i');
  let m;
  while ((m = open.exec(xml)) !== null) {
    const start = m.index + m[0].length;
    const rest = xml.slice(start);
    const close = rest.match(closeTag);
    if (!close) break; // unvollständiges Dokument -> abbrechen statt raten
    out.push(rest.slice(0, close.index));
    open.lastIndex = start + close.index + close[0].length;
  }
  return out;
}

/** Textinhalt des ERSTEN Kindelements `tag`; '' wenn nicht vorhanden. */
export function firstText(xml, tag) {
  const blocks = extractBlocks(xml, tag);
  if (!blocks.length) return '';
  return stripMarkup(blocks[0]);
}

/** Wert eines Attributs am ersten `tag`-Element (z. B. Atom `<link href="…">`). */
export function firstAttr(xml, tag, attr, { where = null } = {}) {
  const re = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${tag}(\\s[^>]*)?/?>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] || '';
    if (where) {
      const cond = new RegExp(`${where.attr}\\s*=\\s*["']${where.value}["']`, 'i');
      if (!cond.test(attrs)) continue;
    }
    const hit = attrs.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
    if (hit) return decodeEntities(hit[1]);
  }
  return '';
}

// --- Datum -------------------------------------------------------------------

/**
 * Datum aus einem Feed robust lesen.
 * RSS liefert RFC-822 („Tue, 26 Aug 2026 09:15:00 +0200"), Atom ISO-8601.
 * `Date.parse` versteht beide; alles Unlesbare wird `null`, nicht „jetzt" —
 * ein erfundener Zeitstempel wäre schlimmer als gar keiner.
 */
export function parseFeedDate(value) {
  if (!value || typeof value !== 'string') return null;
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) return null;
  // Offensichtlicher Unsinn (Jahr < 2000 oder > +2 Jahre) deutet auf einen
  // Parser-Fehltreffer hin, nicht auf eine echte Meldung.
  const year = new Date(ms).getUTCFullYear();
  const maxYear = new Date().getUTCFullYear() + 2;
  if (year < 2000 || year > maxYear) return null;
  return new Date(ms).toISOString();
}

// --- RSS / Atom --------------------------------------------------------------

/**
 * Normalisiert RSS 2.0 UND Atom auf dieselbe Form.
 *
 * @returns {{ feedTitle: string, items: Array<{
 *   id: string, title: string, link: string, summary: string,
 *   publishedAt: string|null, categories: string[]
 * }> }}
 */
export function parseFeed(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return { feedTitle: '', items: [] };

  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = isAtom ? extractBlocks(xml, 'entry') : extractBlocks(xml, 'item');

  // Kanaltitel: bei RSS im <channel>, bei Atom direkt im <feed>. In beiden
  // Fällen darf NICHT der Titel des ersten Beitrags erwischt werden.
  const head = isAtom
    ? xml.split(/<entry[\s>]/i)[0]
    : (extractBlocks(xml, 'channel')[0] || xml).split(/<item[\s>]/i)[0];
  const feedTitle = firstText(head, 'title');

  const items = blocks.map((block) => {
    const title = firstText(block, 'title');

    // Atom: <link rel="alternate" href="…"> bzw. das erste <link href="…">.
    // RSS: Textinhalt von <link>. Manche Feeds liefern beides.
    let link = isAtom
      ? (firstAttr(block, 'link', 'href', { where: { attr: 'rel', value: 'alternate' } })
        || firstAttr(block, 'link', 'href'))
      : firstText(block, 'link');
    if (!link) link = firstAttr(block, 'link', 'href');

    const summary = firstText(block, 'description')
      || firstText(block, 'summary')
      || firstText(block, 'content');

    const publishedAt = parseFeedDate(
      firstText(block, 'pubDate') || firstText(block, 'published')
      || firstText(block, 'updated') || firstText(block, 'date'),
    );

    // Kategorien: RSS als Textinhalt, Atom als term-Attribut.
    const categories = [
      ...extractBlocks(block, 'category').map((c) => stripMarkup(c)),
      ...(block.match(/<category[^>]*\bterm\s*=\s*["']([^"']+)["']/gi) || [])
        .map((t) => decodeEntities((t.match(/term\s*=\s*["']([^"']+)["']/i) || [])[1] || '')),
    ].map((c) => c.trim()).filter(Boolean);

    // Stabile Kennung für die Doppelt-Erkennung: bevorzugt die vom Feed
    // vergebene (guid/id), sonst der Link, sonst der Titel. Ohne stabile
    // Kennung entstünde bei jedem Abruf derselbe Beitrag neu.
    const id = firstText(block, 'guid') || firstText(block, 'id') || link || title;

    return { id: id.trim(), title, link: link.trim(), summary, publishedAt, categories: [...new Set(categories)] };
  }).filter((it) => it.title || it.link); // titel- UND linklose Einträge sind wertlos

  return { feedTitle, items };
}

// --- CSV ---------------------------------------------------------------------
//  Manche Register bieten CSV statt XML. Der Parser beherrscht Anführungszeichen,
//  eingebettete Trennzeichen, Zeilenumbrüche im Feld und doppelte Quotes.

export function parseCsv(text, { delimiter = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) return { header: [], rows: [] };

  const clean = text.replace(/^﻿/, ''); // Byte Order Mark
  // Trennzeichen aus der Kopfzeile erraten: deutsche Behörden liefern oft
  // Semikolon, weil das Komma als Dezimaltrennzeichen belegt ist.
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const sep = delimiter || ((firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',');

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } // verdoppeltes Quote
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === sep) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { header: [], rows: [] };

  const header = nonEmpty[0].map((h) => h.trim());
  const objects = nonEmpty.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
  return { header, rows: objects };
}
