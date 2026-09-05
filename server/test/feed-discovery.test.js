// Tests der Feed-Selbstfindung (services/feedDiscovery.js).
//
// Anlass ist ein echter Befund: Beim ersten Lauf auf Render antworteten 8 von
// 19 News-Quellen nicht. Diese Datei prüft den Ausweg — und vor allem seine
// Grenze: Eine gefundene Adresse darf NUR von der amtlichen Domain stammen.
// Fiele diese Prüfung weg, könnte eine manipulierte Behördenseite den Server
// auf einen fremden Feed lenken, dessen Meldungen dann mit „BfArM" beschriftet
// im Feed einer Apotheke stünden.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFeedLinks, parseAnchorFeedLinks, discoveryPages, discoverFeed, siehtWieFeedAus,
} from '../src/services/feedDiscovery.js';
import { fetchSource, __discoveryCache } from '../src/services/sources.js';
import { ingestNews, createNewsSeenStore } from '../src/services/newsIngest.js';

const FEED = '<?xml version="1.0"?><rss version="2.0"><channel><title>Amt</title></channel></rss>';

test('parseFeedLinks findet ausgezeichnete Feeds und macht sie absolut', () => {
  const html = `<html><head>
    <link rel="stylesheet" href="/x.css">
    <link rel="alternate" type="application/rss+xml" title="News" href="/rss/news.xml">
    <link href="https://www.amt.de/atom.xml" type="application/atom+xml" rel="alternate">
  </head></html>`;
  assert.deepEqual(parseFeedLinks(html, 'https://www.amt.de/seite'), [
    'https://www.amt.de/rss/news.xml',
    'https://www.amt.de/atom.xml',
  ]);
});

test('parseFeedLinks ignoriert Nicht-Feeds und gefährliche Schemata', () => {
  const html = `
    <link rel="alternate" type="text/html" href="/druck.html">
    <link rel="canonical" type="application/rss+xml" href="/nicht-alternate.xml">
    <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">`;
  assert.deepEqual(parseFeedLinks(html, 'https://www.amt.de/'), []);
});

test('parseFeedLinks löst &amp; im href auf', () => {
  const html = '<link rel="alternate" type="application/rss+xml" href="/f?a=1&amp;b=2">';
  assert.deepEqual(parseFeedLinks(html, 'https://www.amt.de/'), ['https://www.amt.de/f?a=1&b=2']);
});

test('parseAnchorFeedLinks nimmt nur Verweise, die nach Feed aussehen', () => {
  const html = `
    <a href="/news/uebersicht.html">Alle Meldungen</a>
    <a href="/feeds/article/news.xml">News (RSS)</a>
    <a href="/rss">Alle Feeds</a>`;
  assert.deepEqual(parseAnchorFeedLinks(html, 'https://www.amt.de/x/'), [
    'https://www.amt.de/feeds/article/news.xml',
    'https://www.amt.de/rss',
  ]);
});

test('base href wird beachtet — der echte PEI-Fall vom 05.09.2026', () => {
  // Die Newsroom-Seite des PEI verweist RELATIV auf ihre RSS-Seite. Ohne
  // <base> löst das gegen das Verzeichnis der Seite auf und ergibt
  // …/DE/newsroom/DE/footer-kopfleiste/… — genau diese doppelte Adresse stand
  // im Render-Protokoll und war eine 404.
  const html = '<head><base href="https://www.pei.de/">'
    + '<link rel="alternate" type="application/rss+xml" href="DE/footer-kopfleiste/rss/rss-node.html">'
    + '</head>';
  const seite = 'https://www.pei.de/DE/newsroom/newsroom-node.html';
  assert.deepEqual(parseFeedLinks(html, seite), [
    'https://www.pei.de/DE/footer-kopfleiste/rss/rss-node.html',
  ]);
  // Ohne <base> bliebe es bei der falschen, doppelten Auflösung — das belegt,
  // dass der Test wirklich am <base> hängt und nicht zufällig durchgeht.
  assert.deepEqual(parseFeedLinks(html.replace(/<base[^>]*>/, ''), seite), [
    'https://www.pei.de/DE/newsroom/DE/footer-kopfleiste/rss/rss-node.html',
  ]);
});

test('base href gilt auch für gewöhnliche Verweise', () => {
  const html = '<base href="https://www.amt.de/"><a href="DE/rss/news.xml">RSS</a>';
  assert.deepEqual(
    parseAnchorFeedLinks(html, 'https://www.amt.de/tief/seite.html'),
    ['https://www.amt.de/DE/rss/news.xml'],
  );
});

test('ein relatives base href wird gegen die Seite aufgelöst', () => {
  const html = '<base href="/x/"><link rel="alternate" type="application/rss+xml" href="f.xml">';
  assert.deepEqual(parseFeedLinks(html, 'https://www.amt.de/a/b.html'), ['https://www.amt.de/x/f.xml']);
});

test('discoveryPages nimmt die hinterlegte Übersichtsseite und die Wurzel', () => {
  assert.deepEqual(
    discoveryPages({ url: 'https://www.amt.de/tief/alt.xml', homepage: 'https://www.amt.de/rss-seite' }),
    ['https://www.amt.de/rss-seite', 'https://www.amt.de/'],
  );
  // Ohne Hinweis bleibt die Wurzel — sie überlebt jeden Umbau.
  assert.deepEqual(discoveryPages({ url: 'https://www.amt.de/tief/alt.xml' }), ['https://www.amt.de/']);
});

test('siehtWieFeedAus erkennt RSS/Atom und verwirft HTML', () => {
  assert.equal(siehtWieFeedAus(FEED), true);
  assert.equal(siehtWieFeedAus('<feed xmlns="http://www.w3.org/2005/Atom">'), true);
  assert.equal(siehtWieFeedAus('<!doctype html><html><body>404</body></html>'), false);
});

test('discoverFeed findet den umgezogenen Feed über die Startseite', async () => {
  const seiten = {
    'https://www.amt.de/': '<link rel="alternate" type="application/rss+xml" href="/neu/news.xml">',
    'https://www.amt.de/neu/news.xml': FEED,
  };
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt/weg.xml', format: 'rss' },
    { fetchText: async (u) => { if (!(u in seiten)) throw new Error('HTTP 404'); return seiten[u]; } },
  );
  assert.equal(fund.url, 'https://www.amt.de/neu/news.xml');
  assert.equal(fund.page, 'https://www.amt.de/');
});

test('discoverFeed übernimmt KEINE fremde Domain', async () => {
  // Der Angriff: Die Behördenseite zeichnet einen Feed aus, der woanders liegt.
  const seiten = {
    'https://www.amt.de/': '<link rel="alternate" type="application/rss+xml" href="https://boese.example/feed.xml">',
    'https://boese.example/feed.xml': FEED,
  };
  const geholt = [];
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt.xml', format: 'rss' },
    { fetchText: async (u) => { geholt.push(u); if (!(u in seiten)) throw new Error('HTTP 404'); return seiten[u]; } },
  );
  assert.equal(fund, null);
  // Und zwar wurde sie gar nicht erst abgerufen.
  assert.equal(geholt.includes('https://boese.example/feed.xml'), false);
});

test('discoverFeed lässt sich nicht von „nicht-amt.de" täuschen', async () => {
  // Ein schlichtes endsWith würde diese Domain als Unterdomäne durchlassen.
  const seiten = {
    'https://amt.de/': '<link rel="alternate" type="application/rss+xml" href="https://nicht-amt.de/feed.xml">',
    'https://nicht-amt.de/feed.xml': FEED,
  };
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://amt.de/alt.xml', format: 'rss' },
    { fetchText: async (u) => { if (!(u in seiten)) throw new Error('HTTP 404'); return seiten[u]; } },
  );
  assert.equal(fund, null);
});

test('discoverFeed verwirft eine Fundstelle, die eine HTML-Seite liefert', async () => {
  const seiten = {
    'https://www.amt.de/': '<a href="/rss">Feeds</a><a href="/echt/news.xml">News</a>',
    'https://www.amt.de/rss': '<!doctype html><html>Feed-Übersicht</html>',
    'https://www.amt.de/echt/news.xml': FEED,
  };
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt.xml', format: 'rss' },
    { fetchText: async (u) => { if (!(u in seiten)) throw new Error('HTTP 404'); return seiten[u]; } },
  );
  assert.equal(fund.url, 'https://www.amt.de/echt/news.xml');
});

test('discoverFeed gibt null zurück, wenn die Startseite selbst nicht antwortet', async () => {
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt.xml', format: 'rss' },
    { fetchText: async () => { throw new Error('HTTP 500'); } },
  );
  assert.equal(fund, null);
});

// --- Zusammenspiel mit fetchSource ------------------------------------------

test('fetchSource sucht erst, wenn alle eingetragenen Adressen versagt haben', async () => {
  __discoveryCache.clear();
  const seiten = {
    'https://www.amt.de/': '<link rel="alternate" type="application/rss+xml" href="/neu.xml">',
    'https://www.amt.de/neu.xml': FEED,
  };
  const versucht = [];
  const res = await fetchSource(
    { id: 'amt2', format: 'rss', url: 'https://www.amt.de/alt.xml', fallbacks: ['https://www.amt.de/auch-alt.xml'] },
    { fetchText: async (u) => { versucht.push(u); if (!(u in seiten)) { const e = new Error('HTTP 404'); e.status = 404; throw e; } return seiten[u]; } },
  );
  assert.equal(res.url, 'https://www.amt.de/neu.xml');
  assert.equal(res.usedDiscovery, true);
  assert.equal(res.discoveredVia, 'https://www.amt.de/');
  // Reihenfolge: Voreinstellung, Ersatzadresse, dann erst die Suche.
  assert.deepEqual(versucht.slice(0, 2), ['https://www.amt.de/alt.xml', 'https://www.amt.de/auch-alt.xml']);
  __discoveryCache.clear();
});

test('fetchSource sucht NICHT, wenn die Voreinstellung antwortet', async () => {
  __discoveryCache.clear();
  let gesucht = false;
  const res = await fetchSource(
    { id: 'amt3', format: 'rss', url: 'https://www.amt.de/gut.xml' },
    { fetchText: async () => FEED, discover: async () => { gesucht = true; return null; } },
  );
  assert.equal(gesucht, false);
  assert.equal(res.usedDiscovery, false);
  assert.equal(res.usedFallback, false);
});

test('fetchSource merkt sich die gefundene Adresse, sucht aber nicht erneut', async () => {
  __discoveryCache.clear();
  const seiten = {
    'https://www.amt.de/': '<link rel="alternate" type="application/rss+xml" href="/neu.xml">',
    'https://www.amt.de/neu.xml': FEED,
  };
  const holen = async (u) => { if (!(u in seiten)) { const e = new Error('HTTP 404'); e.status = 404; throw e; } return seiten[u]; };
  const quelle = { id: 'amt4', format: 'rss', url: 'https://www.amt.de/alt.xml' };

  await fetchSource(quelle, { fetchText: holen });
  assert.equal(__discoveryCache.get('amt4'), 'https://www.amt.de/neu.xml');

  // Zweiter Durchlauf: die gemerkte Adresse wird mitprobiert, die Startseite
  // NICHT noch einmal geholt (der Takt sind fünf Minuten).
  const versucht = [];
  const res = await fetchSource(quelle, {
    fetchText: async (u) => { versucht.push(u); return holen(u); },
  });
  assert.equal(res.url, 'https://www.amt.de/neu.xml');
  assert.equal(versucht.includes('https://www.amt.de/'), false);
  __discoveryCache.clear();
});

test('discoveryPages nimmt mehrere hinterlegte Seiten in Reihenfolge', () => {
  assert.deepEqual(
    discoveryPages({ url: 'https://www.amt.de/alt.xml', homepage: ['https://www.amt.de/a', 'https://www.amt.de/b'] }),
    ['https://www.amt.de/a', 'https://www.amt.de/b', 'https://www.amt.de/'],
  );
});

test('discoverFeed geht zur nächsten Seite, wenn die erste nichts hergibt', async () => {
  const seiten = {
    'https://www.amt.de/a': '<html>keine Feeds hier</html>',
    'https://www.amt.de/b': '<link rel="alternate" type="application/rss+xml" href="/echt.xml">',
    'https://www.amt.de/echt.xml': FEED,
  };
  const fund = await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt.xml', format: 'rss', homepage: ['https://www.amt.de/a', 'https://www.amt.de/b'] },
    { fetchText: async (u) => { if (!(u in seiten)) throw new Error('HTTP 404'); return seiten[u]; } },
  );
  assert.equal(fund.url, 'https://www.amt.de/echt.xml');
  assert.equal(fund.page, 'https://www.amt.de/b');
});

test('discoverFeed unterscheidet in der Meldung die drei Fehlerursachen', async () => {
  // Genau dieser Unterschied fehlte beim ersten Live-Lauf und kostete die
  // Diagnose: „nicht erreichbar" sagt nicht, wo man ansetzen muss.
  const meldungen = [];
  await discoverFeed(
    { id: 'amt', url: 'https://www.amt.de/alt.xml', format: 'rss', homepage: ['https://www.amt.de/tot', 'https://www.amt.de/leer', 'https://www.amt.de/fremd'] },
    {
      log: (m) => meldungen.push(m),
      fetchText: async (u) => {
        if (u === 'https://www.amt.de/leer') return '<html>nichts</html>';
        if (u === 'https://www.amt.de/fremd') return '<link rel="alternate" type="application/rss+xml" href="https://woanders.example/f.xml">';
        throw new Error('HTTP 404');
      },
    },
  );
  assert.match(meldungen[0], /nicht lesbar/);
  assert.match(meldungen[1], /kein Feed ausgezeichnet/);
  assert.match(meldungen[2], /keiner auf www\.amt\.de/);
});

test('fetchSource reicht das eigene Zeitlimit einer Quelle durch', async () => {
  __discoveryCache.clear();
  // Die TGA lief auf allen drei Adressen in die 15-s-Grenze — nicht in 404.
  const gesehen = [];
  await fetchSource(
    { id: 'langsam', format: 'rss', url: 'https://www.fern.au/f.xml', timeoutMs: 30_000 },
    { fetchText: async (u, o) => { gesehen.push(o); return FEED; } },
  );
  assert.deepEqual(gesehen[0], { timeoutMs: 30_000 });
});

test('ingestNews reicht das Protokoll bis in die Selbstfindung durch', async () => {
  // DIE Regression: Beim ersten Live-Lauf lief die Suche, fand nichts und
  // schwieg — weil `log` nicht durchgereicht wurde. Im Render-Protokoll stand
  // dann nur „nicht erreichbar", und die Ursache blieb unsichtbar.
  __discoveryCache.clear();
  const warnungen = [];
  await ingestNews({
    env: { APOPULSE_SOURCE_TESTAMT_URL: 'https://www.testamt.de/kaputt.xml' },
    seenStore: createNewsSeenStore(),
    createPost: async () => ({}),
    log: { warn: (m) => warnungen.push(m) },
    fetchText: async (u) => {
      if (u === 'https://www.testamt.de/') return '<html>keine Auszeichnung</html>';
      const e = new Error('HTTP 404'); e.status = 404; throw e;
    },
  });
  assert.ok(
    warnungen.some((m) => /kein Feed ausgezeichnet/.test(m)),
    'Die Diagnose der Selbstfindung muss im Protokoll ankommen. Warnungen: ' + JSON.stringify(warnungen),
  );
  __discoveryCache.clear();
});

test('fetchSource sucht nicht bei JSON-Quellen', async () => {
  __discoveryCache.clear();
  let gesucht = false;
  await assert.rejects(
    () => fetchSource(
      { id: 'json1', format: 'json', url: 'https://api.amt.de/x.json' },
      { fetchText: async () => { const e = new Error('HTTP 404'); e.status = 404; throw e; },
        discover: async () => { gesucht = true; return null; } },
    ),
    /Keine Adresse erreichbar/,
  );
  assert.equal(gesucht, false);
});
