// ============================================================================
//  Feed-Parser — Tests
// ============================================================================
//  Diese Funktionen bekommen fremde Bytes aus dem Netz. Geprüft wird deshalb
//  nicht nur der Gutfall, sondern vor allem: kaputtes XML, fehlende Felder,
//  Namensräume, CDATA, Umlaut-Entitäten — und dass nichts davon wirft.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeEntities, stripMarkup, extractBlocks, firstText, firstAttr,
  parseFeedDate, parseFeed, parseCsv,
} from '../src/services/feedParsers.js';

// Realistischer RSS-2.0-Feed einer Behörde: Namensraum, CDATA, Umlaut-Entitäten.
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>BfArM — Aktuelles</title>
    <link>https://www.bfarm.de/</link>
    <item>
      <title>Lieferengpass: Amoxicillin 1000 mg Filmtabletten</title>
      <link>https://www.bfarm.de/meldung/1</link>
      <description><![CDATA[<p>Erh&ouml;hte Nachfrage. Voraussichtlich bis <b>15.09.2026</b>.</p>]]></description>
      <pubDate>Tue, 26 Aug 2026 09:15:00 +0200</pubDate>
      <guid isPermaLink="false">bfarm-2026-0815</guid>
      <category>Lieferengpass</category>
      <dc:date>2026-08-26</dc:date>
    </item>
    <item>
      <title>R&uuml;ckruf: Charge XY zur&uuml;ckgerufen</title>
      <link>https://www.bfarm.de/meldung/2</link>
      <description>Ein einzelner Satz ohne Markup.</description>
      <pubDate>Mon, 25 Aug 2026 14:00:00 +0200</pubDate>
      <category>Rückruf</category>
      <category>Sicherheit</category>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>EMA news</title>
  <entry>
    <title>New safety information for medicine X</title>
    <link rel="self" href="https://www.ema.europa.eu/api/1"/>
    <link rel="alternate" href="https://www.ema.europa.eu/news/1"/>
    <id>urn:uuid:1234</id>
    <updated>2026-08-27T08:00:00Z</updated>
    <summary type="html">&lt;p&gt;Summary text&lt;/p&gt;</summary>
    <category term="Safety"/>
  </entry>
</feed>`;

// --- Entitäten und Markup ----------------------------------------------------

test('Entitäten werden aufgelöst, unbekannte bleiben sichtbar', () => {
  assert.equal(decodeEntities('Erh&ouml;hte &amp; mehr'), 'Erhöhte & mehr');
  assert.equal(decodeEntities('&#8364;100'), '€100');
  assert.equal(decodeEntities('&#x20AC;'), '€');
  // Verschlucken wäre schlimmer als stehenlassen — der Text bliebe sonst falsch.
  assert.equal(decodeEntities('&unbekannt;'), '&unbekannt;');
  assert.equal(decodeEntities('kein Ampersand'), 'kein Ampersand');
});

test('Ungültige Zeichen-Codes werden nicht geraten', () => {
  assert.equal(decodeEntities('&#0;'), '&#0;');
  assert.equal(decodeEntities('&#999999999;'), '&#999999999;');
});

test('Markup wird entfernt, Text bleibt lesbar', () => {
  assert.equal(stripMarkup('<p>Hallo <b>Welt</b></p>'), 'Hallo Welt');
  assert.equal(stripMarkup('<![CDATA[<p>Text</p>]]>'), 'Text');
  assert.equal(stripMarkup('a<br>b'), 'a b');
  // Skripte im Feed dürfen nicht als Text durchrutschen.
  assert.equal(stripMarkup('vor<script>alert(1)</script>nach'), 'vornach');
  assert.equal(stripMarkup(null), '');
});

test('Entity-kodiertes Markup (Atom type="html") wird ebenfalls entfernt', () => {
  assert.equal(stripMarkup('&lt;p&gt;Text&lt;/p&gt;'), 'Text');
});

test('Vergleichszeichen im Fließtext überleben', () => {
  // Der naheliegende Ausdruck /<[^>]*>/ hätte hier den halben Satz gefressen.
  assert.equal(stripMarkup('Preis < 5 € und > 3 €'), 'Preis < 5 € und > 3 €');
  assert.equal(stripMarkup('Menge &lt; 10 Packungen'), 'Menge < 10 Packungen');
});

test('Doppelt kodiertes Skript-Tag wird NICHT wiederbelebt', () => {
  // Zweimal zu dekodieren wäre bequem und würde aus dieser Eingabe ein echtes
  // <script> machen. Es bleibt sichtbarer Text.
  const out = stripMarkup('&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;');
  assert.ok(!/<script/i.test(out), out);
  assert.match(out, /&lt;script&gt;/);
});

// --- XML-Zugriff -------------------------------------------------------------

test('Blöcke werden auch mit Attributen und Namensraum gefunden', () => {
  assert.equal(extractBlocks(RSS, 'item').length, 2);
  assert.equal(extractBlocks('<dc:date>2026</dc:date>', 'date')[0], '2026');
  assert.equal(extractBlocks('<a x="1">A</a><a>B</a>', 'a').length, 2);
});

test('Unvollständiges XML bricht ab, statt zu erfinden', () => {
  assert.deepEqual(extractBlocks('<item>abgeschnitten', 'item'), []);
  assert.doesNotThrow(() => parseFeed('<rss><channel><item><title>x'));
});

test('firstText nimmt das erste Kind, nicht irgendeins', () => {
  assert.equal(firstText('<title>A</title><title>B</title>', 'title'), 'A');
  assert.equal(firstText('<x/>', 'title'), '');
});

test('firstAttr liest Attribute, auch bedingt', () => {
  const xml = '<link rel="self" href="/a"/><link rel="alternate" href="/b"/>';
  assert.equal(firstAttr(xml, 'link', 'href'), '/a');
  assert.equal(firstAttr(xml, 'link', 'href', { where: { attr: 'rel', value: 'alternate' } }), '/b');
});

// --- Datum -------------------------------------------------------------------

test('RSS- und Atom-Datumsformate werden verstanden', () => {
  assert.equal(parseFeedDate('Tue, 26 Aug 2026 09:15:00 +0200'), '2026-08-26T07:15:00.000Z');
  assert.equal(parseFeedDate('2026-08-27T08:00:00Z'), '2026-08-27T08:00:00.000Z');
});

test('Unlesbares Datum wird null, nicht „jetzt"', () => {
  // Ein erfundener Zeitstempel wäre schlimmer als gar keiner: Der Beitrag
  // rutschte im Feed nach oben, ohne dass es dafür einen Beleg gibt.
  assert.equal(parseFeedDate('irgendwann'), null);
  assert.equal(parseFeedDate(''), null);
  assert.equal(parseFeedDate(null), null);
  assert.equal(parseFeedDate('Mon, 01 Jan 1970 00:00:00 GMT'), null, 'Epoch = Parser-Fehltreffer');
});

// --- RSS ---------------------------------------------------------------------

test('RSS wird vollständig gelesen', () => {
  const { feedTitle, items } = parseFeed(RSS);
  assert.equal(feedTitle, 'BfArM — Aktuelles');
  assert.equal(items.length, 2);

  const [first, second] = items;
  assert.equal(first.title, 'Lieferengpass: Amoxicillin 1000 mg Filmtabletten');
  assert.equal(first.link, 'https://www.bfarm.de/meldung/1');
  assert.equal(first.id, 'bfarm-2026-0815', 'guid schlägt den Link als Kennung');
  assert.match(first.summary, /Erhöhte Nachfrage/);
  assert.ok(!/<[a-z]/i.test(first.summary), 'kein Markup im Text');
  assert.equal(first.publishedAt, '2026-08-26T07:15:00.000Z');
  assert.deepEqual(first.categories, ['Lieferengpass']);

  assert.equal(second.title, 'Rückruf: Charge XY zurückgerufen', 'Umlaut-Entitäten aufgelöst');
  assert.deepEqual(second.categories, ['Rückruf', 'Sicherheit']);
  assert.equal(second.id, 'https://www.bfarm.de/meldung/2', 'ohne guid dient der Link als Kennung');
});

test('Der Kanaltitel wird nicht mit dem ersten Beitrag verwechselt', () => {
  // Klassischer Fehler naiver Parser: `<title>` trifft zuerst den Kanal ODER
  // den ersten Beitrag — je nach Reihenfolge. Beides muss stimmen.
  const { feedTitle, items } = parseFeed(RSS);
  assert.notEqual(feedTitle, items[0].title);
});

// --- Atom --------------------------------------------------------------------

test('Atom wird auf dieselbe Form gebracht', () => {
  const { feedTitle, items } = parseFeed(ATOM);
  assert.equal(feedTitle, 'EMA news');
  assert.equal(items.length, 1);
  const [it] = items;
  assert.equal(it.title, 'New safety information for medicine X');
  // rel="alternate" ist der Leser-Link, rel="self" die API-Adresse.
  assert.equal(it.link, 'https://www.ema.europa.eu/news/1');
  assert.equal(it.id, 'urn:uuid:1234');
  assert.equal(it.summary, 'Summary text');
  assert.equal(it.publishedAt, '2026-08-27T08:00:00.000Z');
  assert.deepEqual(it.categories, ['Safety']);
});

// --- Robustheit --------------------------------------------------------------

test('Kaputte oder leere Eingaben werfen nie', () => {
  for (const input of ['', null, undefined, '<<<', '{"json":true}', '<rss>', 'nur Text']) {
    assert.doesNotThrow(() => parseFeed(input), String(input));
    const r = parseFeed(input);
    assert.ok(Array.isArray(r.items));
  }
});

test('Einträge ohne Titel UND ohne Link fallen raus', () => {
  const xml = '<rss><channel><item><description>nur Text</description></item>'
    + '<item><title>Behalten</title></item></channel></rss>';
  const { items } = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Behalten');
});

// --- CSV ---------------------------------------------------------------------

test('CSV mit Semikolon (deutsche Behörden) wird erkannt', () => {
  const { header, rows } = parseCsv('Name;Status;Grund\nAmoxicillin;kritisch;Nachfrage\n');
  assert.deepEqual(header, ['Name', 'Status', 'Grund']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Status, 'kritisch');
});

test('CSV mit Anführungszeichen, Trennzeichen und Umbruch im Feld', () => {
  const csv = 'a,b\n"eins, zwei","Zeile1\nZeile2"\n';
  const { rows } = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, 'eins, zwei');
  assert.equal(rows[0].b, 'Zeile1\nZeile2');
});

test('Verdoppelte Anführungszeichen werden zu einem', () => {
  const { rows } = parseCsv('a\n"er sagte ""hallo"""\n');
  assert.equal(rows[0].a, 'er sagte "hallo"');
});

test('Byte Order Mark stört die Kopfzeile nicht', () => {
  const { header } = parseCsv('﻿Name;Wert\nx;1\n');
  assert.deepEqual(header, ['Name', 'Wert']);
});

test('Leeres CSV liefert leere Listen statt eines Fehlers', () => {
  assert.deepEqual(parseCsv(''), { header: [], rows: [] });
  assert.deepEqual(parseCsv('\n\n'), { header: [], rows: [] });
  assert.doesNotThrow(() => parseCsv(null));
});
