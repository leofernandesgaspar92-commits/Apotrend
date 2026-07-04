// Regressionstests für den News-Parser + Datums-Sortierung (backend/api/news.js).
// Ausführen: `node --test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRSS, sortKey } from '../api/news.js';

test('sortKey normalisiert DD.MM.YYYY nach sortierbarem YYYY-MM-DD', () => {
  assert.equal(sortKey('4.7.2026'), '2026-07-04');
  assert.equal(sortKey('15.12.2026'), '2026-12-15');
});

test('sortKey ordnet Dezember korrekt vor Juli (Regression: kein "2026-7" > "2026-12")', () => {
  const dates = ['4.7.2026', '1.12.2026', '15.3.2026'];
  dates.sort((a, b) => sortKey(b).localeCompare(sortKey(a))); // neueste zuerst
  assert.deepEqual(dates, ['1.12.2026', '4.7.2026', '15.3.2026']);
});

test('parseRSS extrahiert Titel/Beschreibung/Link aus RSS-Items', () => {
  const xml = `<rss><channel>
    <item>
      <title>Neuer Engpass gemeldet</title>
      <description>Ein &amp; Test <b>fett</b> Beschreibung.</description>
      <link>https://example.at/a</link>
      <pubDate>Mon, 01 Jun 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[CDATA-Titel funktioniert]]></title>
      <description><![CDATA[Beschreibung im CDATA-Block]]></description>
      <link>https://example.at/b</link>
    </item>
  </channel></rss>`;
  const items = parseRSS(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Neuer Engpass gemeldet');
  assert.ok(!items[0].desc.includes('<b>'), 'HTML-Tags werden entfernt');
  assert.equal(items[0].link, 'https://example.at/a');
  assert.equal(items[1].title, 'CDATA-Titel funktioniert');
});

test('parseRSS ignoriert Items mit zu kurzem Titel', () => {
  const xml = `<rss><item><title>ok</title></item></rss>`;
  assert.equal(parseRSS(xml).length, 0);
});
