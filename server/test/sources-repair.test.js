// ============================================================================
//  Reparatur der stummen Quellen — was WIRKLICH gegen welchen Fehler hilft
// ============================================================================
//  Diese Datei haelt die Zuordnung „Fehlerbild -> Gegenmittel" fest, weil
//  genau dort die teuren Verwechslungen passieren:
//
//   · 429 „Too Many Requests"  -> WENIGER Anfragen + Retry-After beachten.
//     NICHT: andere Kennung, nicht: schneller wiederholen. Wer eine
//     Begrenzung mit einer weiteren Anfrage beantwortet, ist Teil des Problems.
//   · 404                      -> ANDERE Adresse (Ausweichen/Selbstfindung).
//     Hundertmal wiederholen aendert nichts.
//   · Zeitueberschreitung      -> mehr Geduld, gleiche Adresse.
//   · `fetch failed`           -> UNTERHALB von HTTP. Kein Kopf und kein
//     Statuscode hat darauf Einfluss.
//
//  Und ein Parser-Befund: „100 Zeilen empfangen, keine verwertbar" heisst
//  nicht „Spaltennamen nachtragen". Bei den openFDA-Rueckrufen hiess es: Die
//  Quelle gehoert in einen anderen Weg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTextDefault, fetchWithRetry, retryAfterMs, hostAbstand, __hostGate,
  isPermanentError, newsFromSource, newsFromJson, normalizeCompactDate,
  activeSources, fetchSource, sourcesByKind,
} from '../src/services/sources.js';

const quelle = (id) => activeSources({}).find((s) => s.id === id);

/** Antwort-Doppelgaenger mit Kopfzeilen. */
function antwort({ ok = true, status = 200, body = 'ok', headers = {} } = {}) {
  return {
    ok, status, text: async () => body,
    headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  429: Retry-After
// ─────────────────────────────────────────────────────────────────────────────

test('Retry-After wird als Sekunden UND als Datum gelesen', () => {
  assert.equal(retryAfterMs('30'), 30_000);
  assert.equal(retryAfterMs(' 5 '), 5_000);
  assert.equal(retryAfterMs('0'), 0);
  // Obergrenze: Ein „komm in zwei Stunden wieder" darf den Durchlauf nicht
  // blockieren. Dann ist die Quelle fuer diesen Takt eben stumm.
  assert.equal(retryAfterMs('7200'), 60_000);
  assert.equal(retryAfterMs('7200', { maxMs: 10_000 }), 10_000);
  // HTTP-Datum
  const jetzt = Date.parse('2026-10-04T12:00:00Z');
  assert.equal(
    retryAfterMs('Sun, 04 Oct 2026 12:00:20 GMT', { now: () => jetzt }),
    20_000,
  );
  // Vergangenes Datum -> 0, nicht negativ.
  assert.equal(retryAfterMs('Sun, 04 Oct 2026 11:59:00 GMT', { now: () => jetzt }), 0);
  // Unbrauchbares
  for (const w of [null, '', 'bald', undefined, '-5']) assert.equal(retryAfterMs(w), null);
});

test('eine 429 gilt NICHT als dauerhaft — sie ist ein „spaeter nochmal"', () => {
  assert.equal(isPermanentError({ status: 429 }), false);
  assert.equal(isPermanentError({ status: 404 }), true);
  assert.equal(isPermanentError({ status: 403 }), true);
  assert.equal(isPermanentError({ status: 503 }), false);
  // `fetch failed` hat gar keinen Status: unterhalb von HTTP, also wiederholbar.
  assert.equal(isPermanentError(new Error('fetch failed')), false);
});

test('fetchTextDefault nimmt Retry-After aus der Antwort mit', async () => {
  const fetchImpl = async () => antwort({ ok: false, status: 429, headers: { 'retry-after': '12' } });
  await assert.rejects(
    () => fetchTextDefault('https://www.ema.europa.eu/en/rss.xml', { fetchImpl }),
    (e) => e.status === 429 && e.retryAfterMs === 12_000,
  );
});

test('bei 429 wird so lange gewartet, wie die Behoerde es verlangt', async () => {
  const pausen = [];
  let aufrufe = 0;
  const fetchText = async () => {
    aufrufe++;
    if (aufrufe === 1) {
      const e = new Error('HTTP 429'); e.status = 429; e.retryAfterMs = 20_000;
      throw e;
    }
    return '<rss/>';
  };
  const raw = await fetchWithRetry('https://www.ema.europa.eu/en/rss.xml', {
    fetchText, sleep: async (ms) => { pausen.push(ms); },
  });
  assert.equal(raw, '<rss/>');
  // DER Punkt dieser Datei: NICHT 500 ms. Vorher wurde nach einer halben
  // Sekunde erneut angefragt — also genau das Verhalten, das die Begrenzung
  // bestraft.
  assert.deepEqual(pausen, [20_000]);
});

test('ohne Retry-After gilt bei 429 eine laengere Pause als bei einer Stoerung', async () => {
  const messen = async (fehler) => {
    const pausen = [];
    let n = 0;
    const fetchText = async () => { n++; if (n === 1) throw fehler; return 'x'; };
    await fetchWithRetry('https://a.test/f', { fetchText, sleep: async (ms) => { pausen.push(ms); } });
    return pausen[0];
  };
  const bei429 = await messen(Object.assign(new Error('HTTP 429'), { status: 429 }));
  const beiStoerung = await messen(new Error('fetch failed'));
  assert.equal(bei429, 5_000);
  assert.equal(beiStoerung, 500);
  assert.ok(bei429 > beiStoerung, 'eine Begrenzung braucht mehr Geduld als ein Wackler');
});

test('die Wartezeit der Behoerde wird gedeckelt', async () => {
  const pausen = [];
  let n = 0;
  const fetchText = async () => {
    n++;
    if (n === 1) { const e = new Error('HTTP 429'); e.status = 429; e.retryAfterMs = 60_000; throw e; }
    return 'x';
  };
  await fetchWithRetry('https://a.test/f', {
    fetchText, sleep: async (ms) => { pausen.push(ms); }, maxRetryAfterMs: 9_000,
  });
  assert.deepEqual(pausen, [9_000]);
});

// ─────────────────────────────────────────────────────────────────────────────
//  429: weniger Anfragen an denselben Host
// ─────────────────────────────────────────────────────────────────────────────

test('Anfragen an denselben Host werden mit Mindestabstand serialisiert', async () => {
  __hostGate.reset();
  const pausen = [];
  const opts = { now: () => 1_000, sleep: async (ms) => { pausen.push(ms); } };
  // Erste Anfrage: kein Warten.
  assert.equal(await hostAbstand('https://www.ema.europa.eu/a', 2_000, opts), 0);
  // Zweite und dritte an DENSELBEN Host: 2 s und 4 s.
  assert.equal(await hostAbstand('https://www.ema.europa.eu/b', 2_000, opts), 2_000);
  assert.equal(await hostAbstand('https://www.ema.europa.eu/c', 2_000, opts), 4_000);
  assert.deepEqual(pausen, [2_000, 4_000]);
});

test('ein anderer Host wird NICHT mitgebremst', async () => {
  __hostGate.reset();
  const opts = { now: () => 1_000, sleep: async () => {} };
  await hostAbstand('https://www.ema.europa.eu/a', 2_000, opts);
  // Das BASG hat die EMA nicht um Geduld gebeten — es darf sofort dran.
  assert.equal(await hostAbstand('https://www.basg.gv.at/a', 2_000, opts), 0);
});

test('ohne Mindestabstand wird nie gewartet', async () => {
  __hostGate.reset();
  const opts = { now: () => 1_000, sleep: async () => { throw new Error('darf nicht warten'); } };
  for (const gap of [0, undefined, null]) {
    assert.equal(await hostAbstand('https://a.test/x', gap, opts), 0);
  }
  // Eine unbrauchbare Adresse bringt den Riegel nicht zum Absturz.
  assert.equal(await hostAbstand('keine-url', 2_000, opts), 0);
});

test('beide EMA-Quellen tragen den Abstand — sonst bremst nur eine von zweien', () => {
  for (const id of ['ema_news', 'ema_shortages']) {
    const s = quelle(id);
    assert.ok(s, `${id} fehlt`);
    assert.ok(s.minHostGapMs >= 2_000, `${id} ohne Mindestabstand`);
  }
  // Derselbe Host — genau deshalb muss der Abstand pro HOST gelten.
  assert.equal(new URL(quelle('ema_news').url).host, new URL(quelle('ema_shortages').url).host);
});

test('die Kennung bleibt die unseres Dienstes — keine Browser-Tarnung', async () => {
  let gesehen = null;
  await fetchTextDefault('https://a.test/f', {
    fetchImpl: async (u, o) => { gesehen = o.headers; return antwort(); },
  });
  const ua = gesehen['user-agent'];
  assert.match(ua, /ApoPulseBot/);
  // 429 ist eine ausdrueckliche Bitte, langsamer zu sein. Sie mit einer
  // Browser-Kennung zu umgehen hiesse, eine Schutzmassnahme einer Behoerde zu
  // unterlaufen — und die Behoerde koennte uns nicht mehr freischalten, weil
  // sie uns nicht erkennt. Die Kennung nennt deshalb Zweck und Kontakt.
  assert.doesNotMatch(ua, /Mozilla|Chrome|Safari|Gecko/);
  assert.match(ua, /https?:\/\//, 'ohne Kontaktadresse kann niemand freischalten');
});

// ─────────────────────────────────────────────────────────────────────────────
//  Eigene Kopfzeilen je Quelle
// ─────────────────────────────────────────────────────────────────────────────

test('eine Quelle darf die Kopfzeilen ueberschreiben', async () => {
  let gesehen = null;
  await fetchTextDefault('https://a.test/f', {
    headers: { accept: 'application/json' },
    fetchImpl: async (u, o) => { gesehen = o.headers; return antwort(); },
  });
  assert.equal(gesehen.accept, 'application/json');
  // Die uebrigen bleiben stehen.
  assert.match(gesehen['user-agent'], /ApoPulseBot/);
  assert.ok(gesehen['accept-language']);
});

test('die BASG-Schnittstelle fragt ausdruecklich nach JSON', async () => {
  const s = quelle('basg_shortages');
  assert.ok(s.headers, 'keine eigenen Kopfzeilen');
  assert.match(s.headers.accept, /application\/json/);
  // Aber KEIN Proxy im Pfad behoerdlicher Arzneimitteldaten: Die gesamte
  // Herkunfts-Zusicherung haengt daran, dass die Zeile unveraendert vom BASG
  // kommt. Ein Drittanbieter dazwischen koennte sie aendern, ohne dass es
  // auffaellt — und von hier aus liesse er sich nicht pruefen.
  assert.match(s.url, /^https:\/\/[^/]*basg\.gv\.at\//, 'die Adresse muss beim BASG liegen');
});

test('die Kopfzeilen einer Quelle kommen beim Abruf tatsaechlich an', async () => {
  const gesehen = [];
  await fetchSource(quelle('basg_shortages'), {
    fetchText: async (u, extra) => { gesehen.push(extra); return '[]'; },
  });
  assert.equal(gesehen.length, 1);
  // Der Weg durch fetchSource -> fetchWithRetry -> fetchText darf die
  // quellenspezifischen Angaben nicht verlieren. Genau das waere die stille
  // Variante des Fehlers: Der Kopf steht im Quelltext und kommt nie an.
  assert.match(gesehen[0].headers.accept, /application\/json/);
});

test('der Mindestabstand einer Quelle kommt ebenfalls an', async () => {
  const gesehen = [];
  await fetchSource(quelle('ema_news'), {
    fetchText: async (u, extra) => { gesehen.push(extra); return '<rss/>'; },
  });
  assert.equal(gesehen[0].minHostGapMs, 2_000);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Zeitueberschreitung: TGA
// ─────────────────────────────────────────────────────────────────────────────

test('die TGA bekommt MEHR Geduld, nicht weniger', () => {
  const s = quelle('tga_news');
  // Der Auftrag nannte 15 000 ms. Hier standen schon 30 000, und das
  // Protokoll vom 05.09.2026 belegt, dass selbst 30 s abliefen. 15 000 waere
  // eine Halbierung gewesen — eine „Reparatur", die den Abruf sicher zum
  // Scheitern bringt. Diese Untergrenze haelt die Richtung fest.
  assert.ok(s.timeoutMs >= 30_000, `TGA-Zeitlimit zu kurz: ${s.timeoutMs} ms`);
  // Und keine Ersatzadressen: Antwortet der HOST nicht, antwortet er auf
  // keinem seiner Pfade — drei Adressen × zwei Versuche waeren vergeblich.
  assert.deepEqual(s.fallbacks || [], []);
});

test('das Zeitlimit einer Quelle kommt beim Abruf an', async () => {
  const gesehen = [];
  await fetchSource(quelle('tga_news'), {
    fetchText: async (u, extra) => { gesehen.push(extra); return '<rss/>'; },
  });
  assert.ok(gesehen[0].timeoutMs >= 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
//  404: die Adressen von PEI und Swissmedic
// ─────────────────────────────────────────────────────────────────────────────

test('HTML-Uebersichtsseiten stehen in homepage, NIE in url', () => {
  // Der teure Fehler, der hier beinahe passiert ist: Die vom Owner genannten
  // Adressen enden auf .html — sie sind SEITEN, die auf Feeds verweisen, keine
  // Feeds. Als `url` eingetragen gelingt der Abruf (HTTP 200), der Feed-Parser
  // findet null Meldungen, und im Protokoll steht KEIN Fehler. Das ist
  // schlechter als die heutige 404, weil es nach Erfolg aussieht.
  for (const s of sourcesByKind('news', {})) {
    if (s.format !== 'rss') continue;
    assert.doesNotMatch(s.url, /\.html?$/i, `${s.id}: HTML-Seite als Feed-Adresse (${s.url})`);
  }
  // Die genannten Seiten sind als Fundstelle hinterlegt.
  const pei = quelle('pei_news');
  assert.ok([].concat(pei.homepage).some((u) => /rss-node\.html$/.test(u)),
    'die PEI-RSS-Uebersicht fehlt als Fundstelle');
  const sm = quelle('swissmedic_news');
  assert.ok([].concat(sm.homepage).some((u) => /news\/rss\.html$/.test(u)),
    'die Swissmedic-RSS-Seite fehlt als Fundstelle');
});

test('bei 404 wird ausgewichen, nicht wiederholt', async () => {
  const versuche = [];
  const fetchText = async (u) => {
    versuche.push(u);
    if (u.endsWith('/kaputt')) { const e = new Error('HTTP 404'); e.status = 404; throw e; }
    return '<rss/>';
  };
  const res = await fetchSource(
    { id: 'probe', format: 'rss', url: 'https://a.test/kaputt', fallbacks: ['https://a.test/gut'] },
    { fetchText, sleep: async () => {} },
  );
  assert.equal(res.url, 'https://a.test/gut');
  assert.equal(res.usedFallback, true);
  // Genau ZWEI Abrufe: die 404 wurde nicht wiederholt.
  assert.deepEqual(versuche, ['https://a.test/kaputt', 'https://a.test/gut']);
});

// ─────────────────────────────────────────────────────────────────────────────
//  openFDA-Rueckrufe: „100 Zeilen empfangen, keine verwertbar"
// ─────────────────────────────────────────────────────────────────────────────

const OPENFDA_ANTWORT = JSON.stringify({
  meta: { results: { total: 2 } },
  results: [
    {
      recall_number: 'D-1234-2026',
      product_description: 'Amoxicillin Capsules USP, 500 mg, 100 count bottle, NDC 0093-4155-01',
      reason_for_recall: 'Failed dissolution specifications.',
      recalling_firm: 'Beispiel Pharma Inc.',
      classification: 'Class II',
      status: 'Ongoing',
      recall_initiation_date: '20260915',
      openfda: { generic_name: ['AMOXICILLIN'], brand_name: ['AMOXIL'] },
    },
    { recall_number: 'D-9999-2026', product_description: '', reason_for_recall: 'ohne Beschreibung' },
  ],
});

test('der Rueckruf-Export wird zur MELDUNG, nicht zum Engpass-Datensatz', () => {
  const s = quelle('openfda_recalls');
  assert.equal(s.kind, 'news');
  assert.equal(s.format, 'json');
  // Die fachliche Begruendung in Testform: Ein Chargenrueckruf sagt NICHTS
  // ueber die Lieferfaehigkeit. Als Engpass gefuehrt stuende in der Apotheke
  // „kritisch — nicht lieferbar" unter einem Praeparat, das verfuegbar ist.
  // Dazu der Zusammenstoss im Schema: Shortage ist ueber [drugName, country]
  // eindeutig — Rueckruf und echter Engpass desselben Praeparats stritten sich
  // um EINE Zeile.
  assert.ok(!sourcesByKind('shortages', {}).some((x) => x.id === 'openfda_recalls'));
});

test('Rueckrufe werden vollstaendig in Meldungen gewandelt', () => {
  const items = newsFromSource(quelle('openfda_recalls'), OPENFDA_ANTWORT);
  assert.equal(items.length, 1, 'die Zeile ohne Produktbeschreibung wird verworfen, nicht geraten');
  const m = items[0];
  assert.match(m.title, /Amoxicillin Capsules USP/);
  assert.equal(m.country, 'US');
  assert.equal(m.publishedAt, '2026-09-15', 'YYYYMMDD wird zu ISO');
  // Der Link zeigt auf den DATENSATZ bei der Behoerde — belegbar, nicht geraten.
  assert.match(m.link, /^https:\/\/api\.fda\.gov\/drug\/enforcement\.json\?search=recall_number:%22D-1234-2026%22$/);
  // Die Betroffenheitsfelder des Auftrags, als benannte Zeilen:
  assert.match(m.summary, /Failed dissolution specifications/);
  assert.match(m.summary, /Wirkstoff: AMOXICILLIN/);
  assert.match(m.summary, /Firma: Beispiel Pharma Inc\./);
  assert.match(m.summary, /Einstufung: Class II/);
  assert.match(m.summary, /Verfahrensstand: Ongoing/);
  assert.match(m.summary, /Rueckrufnummer: D-1234-2026/);
});

test('der verschachtelte Wirkstoff wird aufgeloest', () => {
  // openfda.generic_name ist ein ARRAY in einem Unterobjekt. Diese
  // Verschachtelung war einer der zwei Gruende, warum vorher keine Zeile
  // verwertbar war.
  const items = newsFromJson(
    { id: 'p', country: 'US', jsonNews: { list: 'results', title: ['t'], id: ['i'], linkTemplate: 'https://a.test/{id}', extra: { Wirkstoff: ['openfda.generic_name'] } } },
    JSON.stringify({ results: [{ t: 'Titel', i: '1', openfda: { generic_name: ['METFORMIN', 'ZWEITER'] } }] }),
  );
  assert.match(items[0].summary, /Wirkstoff: METFORMIN/);
  assert.doesNotMatch(items[0].summary, /ZWEITER/, 'der erste Wert ist der aussagekraeftige');
});

test('eine Meldung ohne Rueckverweis entsteht NICHT', () => {
  const s = { id: 'p', country: 'US', jsonNews: { list: 'results', title: ['t'], id: ['i'], linkTemplate: 'https://a.test/{id}' } };
  // Ohne Kennung kein Link — und ohne Link keine Meldung. Serverseitig wird
  // ein VerifiedSignal ohne originalUrl ohnehin verworfen (services/signals.js);
  // hier faellt es schon vorher auf.
  assert.throws(() => newsFromJson(s, JSON.stringify({ results: [{ t: 'Titel' }] })), /keine verwertbar/);
});

test('„keine verwertbar" nennt die GRUENDE, nicht nur die Zahl', () => {
  // Genau der Befund, der diese Reparatur ausgeloest hat. Eine Meldung ohne
  // Gruende laesst beim naechsten Mal wieder jemanden im Dunkeln suchen.
  try {
    newsFromJson(
      { id: 'p', country: 'US', jsonNews: { list: 'results', title: ['product_description'], id: ['recall_number'], linkTemplate: 'https://a.test/{id}' } },
      JSON.stringify({ results: [{ x: 1 }, { x: 2 }, { x: 3 }] }),
    );
    assert.fail('haette werfen muessen');
  } catch (e) {
    assert.match(e.message, /3 Zeilen empfangen, keine verwertbar/);
    assert.match(e.message, /kein Titel/);
    assert.match(e.message, /product_description/, 'der erwartete Feldname gehoert in die Meldung');
  }
});

test('eine leere Liste ist kein Fehler — die Behoerde hatte nichts zu melden', () => {
  const items = newsFromSource(quelle('openfda_recalls'), JSON.stringify({ results: [] }));
  assert.deepEqual(items, []);
});

test('ohne jsonNews-Zuordnung wird gar nicht erst geparst', () => {
  assert.throws(
    () => newsFromJson({ id: 'p', format: 'json' }, '{"results":[]}'),
    /jsonNews/,
  );
});

test('ein nicht vorgesehenes Format wird abgewiesen', () => {
  assert.throws(() => newsFromSource({ id: 'p', format: 'xlsx' }, ''), /nicht vorgesehen/);
});

test('normalizeCompactDate laesst ISO unveraendert und erfindet nichts', () => {
  assert.equal(normalizeCompactDate('20261004'), '2026-10-04');
  assert.equal(normalizeCompactDate('2026-10-04'), '2026-10-04');
  assert.equal(normalizeCompactDate('2026-10-04T10:00:00Z'), '2026-10-04T10:00:00Z');
  // Kein Datum -> null, NICHT „heute". Ein erfundener Zeitstempel waere von
  // einem echten nicht zu unterscheiden.
  assert.equal(normalizeCompactDate(''), null);
  assert.equal(normalizeCompactDate(null), null);
});

test('die Quellenzahl bleibt bei 22 — die Umstellung hat keine verloren', () => {
  const alle = activeSources({});
  assert.equal(alle.length, 22);
  assert.equal(sourcesByKind('news', {}).length, 20);
  assert.equal(sourcesByKind('shortages', {}).length, 2);
});
