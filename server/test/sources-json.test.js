// ============================================================================
//  JSON-Engpass-Adapter und die neuen Länderquellen
// ============================================================================
//  Der Kern dieser Datei ist eine einzige Frage: Was passiert mit einem
//  Statuswert, den wir nicht kennen?
//
//  Die naheliegende Schreibweise `status: item.status || 'LIMITED'` beantwortet
//  sie falsch. Sie schreibt den Rohwert der Behörde ungeprüft weiter — ein
//  „nicht lieferbar" käme dann als „eingeschränkt lieferbar" in der Apotheke an,
//  oder ein unbekannter Wert flöge beim Schreiben in die Datenbank auf die Nase.
//  An dieser Stelle entscheidet jemand, ob umbestellt wird.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { shortagesFromJson, activeSources, sourcesByKind, regulatorOf,
  fetchWithRetry, fetchSource, isPermanentError, newsFromSource, newsKey } from '../src/services/sources.js';
import { listCountries } from '../src/data/countries.js';

/** Nur die eingebauten Quellen, ohne die Umgebung der Testmaschine. */
const nurBuiltin = () => activeSources({});

// ── Adapter ─────────────────────────────────────────────────────────────────

test('nacktes Array wird gelesen', () => {
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', status: 'kritisch', grund: 'Erhöhte Nachfrage' },
  ]));
  assert.equal(rejected.length, 0);
  assert.deepEqual(rows[0], {
    wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'kritisch',
    grund: 'Erhöhte Nachfrage', gemeldet_am: null, voraussichtlich_bis: null,
  });
});

test('Liste in einer Hülle wird auch gefunden', () => {
  // Die genaue Antwortform der BASG-Schnittstelle war hier nicht abrufbar.
  // Deshalb werden die üblichen Hüllen mitgeprüft, statt ein nacktes Array
  // vorauszusetzen und bei allem anderen mit null umzufallen.
  for (const key of ['items', 'data', 'results', 'shortages', 'content']) {
    const { rows } = shortagesFromJson(JSON.stringify({ [key]: [{ bezeichnung: 'X', status: 'kritisch' }] }));
    assert.equal(rows.length, 1, `Hülle "${key}" wurde nicht erkannt`);
  }
});

test('unbekannter Status verwirft die Zeile — er wird NICHT zu LIMITED gemacht', () => {
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { bezeichnung: 'Gut', status: 'kritisch' },
    { bezeichnung: 'Unklar', status: 'teilweise eventuell' },
    { bezeichnung: 'Leer', status: '' },
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Gut');
  assert.equal(rejected.length, 2);
  assert.match(rejected[0], /Status unbekannt \(teilweise eventuell\)/);
});

test('englische und deutsche Statuswerte werden beide erkannt', () => {
  const { rows } = shortagesFromJson(JSON.stringify([
    { product: 'A', availability: 'critical' },
    { product: 'B', availability: 'limited' },
    { product: 'C', availability: 'available' },
    { product: 'D', availability: 'nicht lieferbar' },
  ]));
  assert.deepEqual(rows.map((r) => r.status),
    ['kritisch', 'eingeschraenkt', 'verfuegbar', 'kritisch']);
});

test('Zeile ohne jeden Namen wird verworfen statt leer gespeichert', () => {
  // Frühere Fassung dieses Tests erwartete, dass auch eine Zeile MIT Wirkstoff
  // und ohne Handelsnamen verworfen wird. Das war zu streng und fiel bei der
  // US-Quelle auf: Generika haben dort oft nur `generic_name`. Jetzt tritt der
  // Wirkstoff an die Stelle des Handelsnamens — verworfen wird nur, was
  // überhaupt keinen Namen trägt.
  const { rows, rejected } = shortagesFromJson(JSON.stringify([
    { wirkstoff: 'Nur Wirkstoff', status: 'kritisch' },
    { status: 'kritisch' },
    null,
    'kein Objekt',
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Nur Wirkstoff');
  assert.equal(rejected.length, 3);
});

test('eigene Feldzuordnung schlägt die Standardnamen', () => {
  // Der Weg für den Fall, dass eine Behörde ein Feld umbenennt: eine
  // Umgebungsvariable statt eines Deploys.
  const { rows } = shortagesFromJson(
    JSON.stringify([{ nameDesArzneimittels: 'Spezialität A', vertrieb: 'kritisch' }]),
    { columns: { bezeichnung: 'nameDesArzneimittels', status: 'vertrieb' } },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Spezialität A');
  assert.equal(rows[0].status, 'kritisch');
});

test('kaputtes JSON und fehlende Liste werfen mit lesbarer Begründung', () => {
  assert.throws(() => shortagesFromJson('{nicht json'), /kein gültiges JSON/);
  assert.throws(() => shortagesFromJson('{"meldungen":42}'), /Keine Liste gefunden/);
});

test('ein bereits geparstes Objekt wird ebenfalls angenommen', () => {
  const { rows } = shortagesFromJson([{ bezeichnung: 'A', status: 'kritisch' }]);
  assert.equal(rows.length, 1);
});

// ── Quellenregister ─────────────────────────────────────────────────────────

test('alle vom Owner benannten Länder haben eine News-Quelle', () => {
  const news = sourcesByKind('news', {});
  const laender = new Set(news.map((s) => s.country));
  for (const cc of ['AT', 'DE', 'CH', 'GB', 'US', 'CA', 'AU', 'ZA', 'EU']) {
    assert.ok(laender.has(cc), `Für ${cc} fehlt eine News-Quelle`);
  }
});

test('jede Länderquelle findet ihre Behörde im Länder-Register', () => {
  // Ohne diese Zuordnung stünde am Beitrag keine Quellenangabe — und
  // CLAUDE.md verlangt für sicherheitsrelevante Aussagen genau die.
  for (const s of sourcesByKind('news', {})) {
    if (s.country === 'EU') continue; // EMA ist keinem Land zugeordnet
    assert.ok(regulatorOf(s.country), `Kein Regulator für ${s.country} (${s.id})`);
  }
  assert.equal(regulatorOf('CH'), 'Swissmedic');
  assert.equal(regulatorOf('GB'), 'MHRA');
  assert.equal(regulatorOf('ZA'), 'SAHPRA');
});

test('die Engpass-Quelle ist als strukturierter Export angemeldet, nicht als News', () => {
  // Der Kern der Trennung: Aus Schlagzeilen entstehen keine Engpass-Datensätze.
  const engpaesse = sourcesByKind('shortages', {});
  // Inzwischen zwei: BASG (AT) und openFDA (US). Geprüft wird nicht mehr die
  // ANZAHL — die wächst hoffentlich weiter —, sondern was dauerhaft gelten
  // muss: strukturiertes Format, bekanntes Land, und die AT-Quelle ist dabei.
  assert.ok(engpaesse.length >= 1);
  assert.ok(engpaesse.every((s) => s.format === 'json' || s.format === 'csv'),
    'Engpässe kommen nur aus strukturierten Exporten, nie aus RSS');
  const at = engpaesse.find((s) => s.country === 'AT');
  assert.ok(at, 'keine AT-Engpassquelle');
  assert.equal(at.id, 'basg_shortages');
  // Und keine der News-Quellen darf versehentlich als Engpass-Quelle gelten.
  assert.ok(sourcesByKind('news', {}).every((s) => s.format === 'rss'));
});

test('jede neue Quelle lässt sich einzeln abschalten', () => {
  const aus = { APOPULSE_SOURCE_FDA_NEWS_URL: '', APOPULSE_SOURCE_SAHPRA_NEWS_URL: '' };
  const ids = activeSources(aus).map((s) => s.id);
  assert.ok(!ids.includes('fda_news'));
  assert.ok(!ids.includes('sahpra_news'));
  assert.ok(ids.includes('tga_news'), 'die übrigen bleiben unberührt');
});

test('alle eingebauten Quellen haben eindeutige Kennungen und https-URLs', () => {
  const alle = nurBuiltin();
  assert.equal(new Set(alle.map((s) => s.id)).size, alle.length, 'doppelte Kennung');
  for (const s of alle) {
    assert.match(s.url, /^https:\/\//, `${s.id} ist nicht https`);
    assert.ok(s.label, `${s.id} hat kein Etikett`);
  }
});

// ── Wiederholen und Ausweichen ──────────────────────────────────────────────
//  Zwei Mechanismen für zwei verschiedene Probleme. Sie zu vermischen wäre der
//  Fehler: Eine 404 hundertmal zu wiederholen ändert nichts, und bei einer
//  Zeitüberschreitung sofort die Ersatzadresse zu nehmen verdeckt, dass die
//  eigentliche Quelle in Ordnung ist.

test('vorübergehende Störung wird wiederholt', async () => {
  let versuche = 0;
  const raw = await fetchWithRetry('https://x/1', {
    fetchText: async () => { versuche++; if (versuche < 2) throw new Error('ETIMEDOUT'); return 'ok'; },
    sleep: async () => {}, // keine echte Wartezeit im Test
  });
  assert.equal(raw, 'ok');
  assert.equal(versuche, 2, 'ein Versuch plus eine Wiederholung');
});

test('nach der letzten Wiederholung wird der Fehler weitergereicht', async () => {
  let versuche = 0;
  await assert.rejects(
    () => fetchWithRetry('https://x/1', {
      fetchText: async () => { versuche++; throw new Error('ECONNREFUSED'); },
      sleep: async () => {},
    }),
    /ECONNREFUSED/,
  );
  assert.equal(versuche, 2, 'genau zwei Versuche, nicht endlos');
});

test('eine 404 wird NICHT wiederholt — die Antwort bliebe dieselbe', async () => {
  let versuche = 0;
  await assert.rejects(() => fetchWithRetry('https://x/1', {
    fetchText: async () => { versuche++; const e = new Error('HTTP 404'); e.status = 404; throw e; },
    sleep: async () => {},
  }));
  assert.equal(versuche, 1);
});

test('429 gilt als vorübergehend, obwohl es 4xx ist', () => {
  // „Zu viele Anfragen" heißt ausdrücklich „später nochmal" — das ist der
  // eine 4xx-Code, bei dem Wiederholen richtig ist.
  const mit = (status) => { const e = new Error('x'); e.status = status; return e; };
  assert.equal(isPermanentError(mit(404)), true);
  assert.equal(isPermanentError(mit(403)), true);
  assert.equal(isPermanentError(mit(429)), false);
  assert.equal(isPermanentError(mit(503)), false);
  assert.equal(isPermanentError(new Error('Netz weg')), false, 'ohne Status: vorübergehend annehmen');
});

test('fällt die Behörde aus, greift die Ersatzadresse', async () => {
  const quelle = { id: 'x', url: 'https://behoerde/feed', fallbacks: ['https://ministerium/feed'] };
  const res = await fetchSource(quelle, {
    fetchText: async (u) => {
      if (u === 'https://behoerde/feed') { const e = new Error('HTTP 404'); e.status = 404; throw e; }
      return '<rss/>';
    },
    sleep: async () => {},
  });
  assert.equal(res.raw, '<rss/>');
  assert.equal(res.url, 'https://ministerium/feed');
  assert.equal(res.usedFallback, true);
  // Der Fehler der Hauptadresse geht nicht verloren — sonst bliebe eine
  // dauerhaft kaputte Voreinstellung für immer stehen.
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0].error, /404/);
});

test('antwortet die Hauptadresse, wird die Ersatzadresse gar nicht erst versucht', async () => {
  const angefragt = [];
  const res = await fetchSource(
    { url: 'https://behoerde/feed', fallbacks: ['https://ministerium/feed'] },
    { fetchText: async (u) => { angefragt.push(u); return 'gut'; }, sleep: async () => {} },
  );
  assert.deepEqual(angefragt, ['https://behoerde/feed']);
  assert.equal(res.usedFallback, false);
});

test('fällt alles aus, nennt der Fehler jede versuchte Adresse', async () => {
  await assert.rejects(
    () => fetchSource({ url: 'https://a/1', fallbacks: ['https://b/2'] }, {
      fetchText: async () => { const e = new Error('HTTP 404'); e.status = 404; throw e; },
      sleep: async () => {},
    }),
    (e) => {
      assert.match(e.message, /https:\/\/a\/1/);
      assert.match(e.message, /https:\/\/b\/2/);
      assert.equal(e.attempts.length, 2);
      return true;
    },
  );
});

// ── Länderabdeckung ─────────────────────────────────────────────────────────

test('jedes der 16 Länder des Registers hat eine Quelle', () => {
  // Der eigentliche Auftrag dieser Runde. Ohne diese Prüfung fällt ein
  // vergessenes Land erst auf, wenn dort jemand eine leere Ansicht sieht.
  const proLand = new Set(activeSources({}).map((s) => s.country));
  const fehlend = listCountries().map((c) => c.code).filter((cc) => !proLand.has(cc));
  assert.deepEqual(fehlend, [], `Ohne Quelle: ${fehlend.join(', ')}`);
});

test('keine Quelle behauptet, geprüft zu sein', () => {
  // In der Bauumgebung gibt es kein Netz — keine dieser URLs konnte abgerufen
  // werden. `verified: true` wäre hier schlicht gelogen und dürfte erst nach
  // einem erfolgreichen Lauf auf Render gesetzt werden.
  for (const s of activeSources({})) {
    assert.equal(s.verified, false, `${s.id} behauptet, geprüft zu sein`);
  }
});

test('eine eigene Adresse schaltet die eingebauten Ersatzadressen ab', () => {
  // Sonst landete ein Tippfehler in der eigenen URL stillschweigend wieder
  // beim Voreinstellungs-Feed — und man hielte dessen Daten für die eigenen.
  const mit = activeSources({}).find((s) => s.id === 'basg_news');
  assert.ok(mit.fallbacks.length > 0);
  const eigen = activeSources({ APOPULSE_SOURCE_BASG_NEWS_URL: 'https://eigen.example/feed' })
    .find((s) => s.id === 'basg_news');
  assert.equal(eigen.url, 'https://eigen.example/feed');
  assert.deepEqual(eigen.fallbacks, []);
});

// ── Gesehen-Schlüssel: der Vertrag zwischen Aufnahme und Wiederherstellung ──
//  Die Aufnahme bildet den Schlüssel aus dem Feed-Eintrag, die
//  Wiederherstellung aus der Datenbankzeile. Laufen die beiden auseinander,
//  kommt der Fehler als doppelter Beitrag heraus — und zwar erst nach dem
//  nächsten Deploy, wenn niemand mehr an diese Stelle denkt.

test('der Schlüssel aus dem Feed ist derselbe wie der aus der Datenbankzeile', () => {
  const quelle = { id: 'bfarm_news', kind: 'news', country: 'DE', format: 'rss', label: 'BfArM' };
  const raw = `<?xml version="1.0"?><rss version="2.0"><channel><title>BfArM</title>
    <item><title>Rückruf</title><link>https://bfarm.example/1</link>
    <guid>urn:uuid:abc-123</guid><description>Text</description></item></channel></rss>`;

  const [item] = newsFromSource(quelle, raw);
  // Aus der Datenbank steht nur sourceId + link zur Verfügung — kein guid.
  const ausDb = newsKey('bfarm_news', 'https://bfarm.example/1');

  assert.equal(item.key, ausDb,
    'Feed- und Datenbank-Schlüssel müssen übereinstimmen, sonst entstehen Duplikate');
  assert.ok(!item.key.includes('urn:uuid'),
    'der guid darf nicht in den Schlüssel, er steht nicht in der Datenbank');
});

test('newsKey trennt gleiche Meldungen verschiedener Quellen', () => {
  // Dieselbe Pressemitteilung bei zwei Behörden bleibt zwei Beiträge — das war
  // schon vorher so und darf sich durch die Umstellung nicht ändern.
  assert.notEqual(newsKey('bfarm_news', 'https://x/1'), newsKey('pei_news', 'https://x/1'));
  assert.equal(newsKey('bfarm_news', 'https://x/1'), newsKey('bfarm_news', 'https://x/1'));
  // Führende/folgende Leerzeichen dürfen keinen neuen Schlüssel erzeugen.
  assert.equal(newsKey('a', ' https://x/1 '), newsKey('a', 'https://x/1'));
});

// ── openFDA (US) ────────────────────────────────────────────────────────────
//  Die einzige echte Engpass-SCHNITTSTELLE unter den 16 Ländern. Ihre
//  Statuswerte heißen anders als in jedem europäischen Register — und ein
//  unbekannter Status verwirft die Zeile. Ohne Vokabular käme also nichts an.

test('die Statuswerte der US-Behörde werden erkannt', () => {
  const { rows, rejected } = shortagesFromJson({ results: [
    { generic_name: 'Amoxicillin', proprietary_name: 'Amoxil', status: 'Currently in Shortage',
      reason_for_shortage: 'Demand increase', initial_posting_date: '2026-06-14' },
    { generic_name: 'Metformin', status: 'Resolved' },
    { generic_name: 'Insulin glargine', status: 'To Be Discontinued' },
  ] });
  assert.deepEqual(rows.map((r) => r.status), ['kritisch', 'verfuegbar', 'eingeschraenkt']);
  assert.equal(rejected.length, 0);
  assert.equal(rows[0].grund, 'Demand increase');
  assert.equal(rows[0].gemeldet_am, '2026-06-14');
});

test('ohne Handelsnamen tritt der Wirkstoff an seine Stelle', () => {
  // Der Fund, der diese Regel ausgelöst hat: Generika haben bei der US-Behörde
  // oft gar keinen Handelsnamen — dort steht nur `generic_name`. Ohne den
  // Rückfall verlor die Quelle den Großteil ihrer Zeilen. Dieselbe Regel gilt
  // beim Schreiben in die Datenbank; sie hier nicht zu haben hieß, dass
  // dieselbe Zeile je nach Weg einmal ankam und einmal nicht.
  const { rows } = shortagesFromJson({ results: [{ generic_name: 'Metformin', status: 'Resolved' }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bezeichnung, 'Metformin');
  assert.equal(rows[0].wirkstoff, 'Metformin');
});

test('ohne jeden Namen bleibt die Zeile draußen', () => {
  const { rows, rejected } = shortagesFromJson({ results: [{ status: 'Currently in Shortage' }] });
  assert.equal(rows.length, 0);
  assert.match(rejected[0], /weder Bezeichnung noch Wirkstoff/);
});

test('ein unbekannter Status wird auch bei der US-Quelle verworfen', () => {
  // Die Zusage gilt unverändert: lieber keine Zeile als eine geratene.
  const { rows, rejected } = shortagesFromJson({ results: [{ generic_name: 'X', status: 'Irgendwas Neues' }] });
  assert.equal(rows.length, 0);
  assert.match(rejected[0], /Status unbekannt \(Irgendwas Neues\)/);
});

test('für die USA gibt es jetzt strukturierte Daten, nicht nur Schlagzeilen', () => {
  const engpaesse = sourcesByKind('shortages', {});
  const us = engpaesse.find((s) => s.country === 'US');
  assert.ok(us, 'keine US-Engpassquelle');
  assert.equal(us.id, 'openfda_shortages');
  assert.equal(us.format, 'json');
  assert.equal(us.verified, false, 'hier nicht abrufbar — darf nichts anderes behaupten');
});
