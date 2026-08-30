// ============================================================================
//  Automatische Datenaufnahme — Tests
// ============================================================================
//  Die Bauumgebung hat KEINEN Netzzugang; echte Behörden-Endpunkte lassen sich
//  hier nicht abrufen. Geprüft wird deshalb alles, was ohne Netz prüfbar ist —
//  und das ist der überwiegende Teil: Quellenauswahl, Umwandlung, Doppelt-
//  Erkennung, Fehlerverhalten, Taktung. Der Abruf selbst wird injiziert.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeSources, sourcesByKind, newsFromSource, shortagesFromCsv,
  dedupeShortages, normalizeStatus, sourceEnvKeys, SOURCE_KINDS,
} from '../src/services/sources.js';
import {
  createNewsSeenStore, composePost, isFreshEnough, ingestNews,
} from '../src/services/newsIngest.js';
import { createScheduler, INTERVALS } from '../src/services/scheduler.js';
import {
  validateDeal, createDealsService, generateDemoDeals, seedDemoDealsIfNoneRunning, DEAL_ACCOUNT_TYPES,
} from '../src/services/deals.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';

const FEED = (items) => `<rss version="2.0"><channel><title>Amt</title>${items}</channel></rss>`;
const ITEM = (n, extra = '') => `<item><title>Meldung ${n}</title><link>https://amt.example/${n}</link>`
  + `<description>Text ${n}</description><guid>id-${n}</guid>${extra}</item>`;

const caught = (fn) => { try { fn(); } catch (e) { return e; } throw new Error('kein Fehler geworfen'); };

/**
 * Umgebung mit ABGESCHALTETEN eingebauten Quellen.
 * Ohne das laufen BfArM, PEI, BASG und EMA mit — und ein Test, der zwei
 * Beiträge erwartet, bekommt acht. (Genau darüber bin ich gestolpert.)
 */
const onlyEnv = (extra = {}) => {
  const env = {};
  for (const s of sourcesByKind('news', {})) env[sourceEnvKeys(s.id).url] = '';
  return { ...env, ...extra };
};

// ============================================================================
//  Quellen
// ============================================================================

test('Eingebaute Quellen sind aktiv, ohne dass etwas konfiguriert wurde', () => {
  const s = activeSources({});
  assert.ok(s.length >= 4, `${s.length} Quellen`);
  assert.ok(s.every((x) => x.url.startsWith('https://')), 'nur HTTPS');
  // Früher stand hier „eingebaut sind zunächst News-Quellen". Das gilt nicht
  // mehr: Seit dem BASG-Export gibt es auch eine Engpass-Quelle. Geprüft wird
  // deshalb, was dauerhaft stimmen muss — jede Quelle hat eine BEKANNTE Art,
  // und beide Arten kommen vor.
  assert.ok(s.every((x) => SOURCE_KINDS.includes(x.kind)), 'unbekannte Quellenart');
  assert.ok(s.some((x) => x.kind === 'news'), 'keine News-Quelle');
  assert.ok(s.some((x) => x.kind === 'shortages'), 'keine Engpass-Quelle');
});

test('Eine Quelle lässt sich umbiegen und abschalten', () => {
  const keys = sourceEnvKeys('bfarm_news');

  const umgebogen = activeSources({ [keys.url]: 'https://eigen.example/feed.xml' })
    .find((s) => s.id === 'bfarm_news');
  assert.equal(umgebogen.url, 'https://eigen.example/feed.xml');

  // Leer heißt AUS — nicht „nimm den Standard".
  const aus = activeSources({ [keys.url]: '' }).find((s) => s.id === 'bfarm_news');
  assert.equal(aus, undefined);
});

test('Eigene Quellen lassen sich frei hinzufügen', () => {
  const s = activeSources({
    APOPULSE_SOURCE_APOKAMMER_URL: 'https://kammer.example/rss',
    APOPULSE_SOURCE_APOKAMMER_COUNTRY: 'AT',
    APOPULSE_SOURCE_APOKAMMER_LABEL: 'Apothekerkammer',
  });
  const eigen = s.find((x) => x.id === 'apokammer');
  assert.ok(eigen);
  assert.equal(eigen.country, 'AT');
  assert.equal(eigen.label, 'Apothekerkammer');
  assert.equal(eigen.official, false, 'nicht-amtliche Quellen sind als solche markiert');
});

test('Unbekannte Formate werden nicht aktiviert', () => {
  const s = activeSources({
    APOPULSE_SOURCE_KAPUTT_URL: 'https://x.example/f',
    APOPULSE_SOURCE_KAPUTT_FORMAT: 'xlsx',
  });
  assert.ok(!s.some((x) => x.id === 'kaputt'));
});

test('News-Meldungen tragen Quelle und Link', () => {
  const source = { id: 'amt', format: 'rss', country: 'DE', label: 'Amt', official: true };
  const news = newsFromSource(source, FEED(ITEM(1) + ITEM(2)));
  assert.equal(news.length, 2);
  // Die Kennung enthält Quelle UND Link. Bis zur Datenbank-Wiederherstellung
  // stand hier der guid ('amt:id-1'); der steht aber nicht in der Datenbank,
  // und ohne rekonstruierbare Kennung legte die erste Aufnahme nach einem
  // Deploy jede wiederhergestellte Meldung ein zweites Mal an.
  assert.equal(news[0].key, 'amt:https://amt.example/1', 'Kennung enthält Quelle und Link');
  assert.equal(news[0].link, 'https://amt.example/1');
  assert.equal(news[0].official, true);
});

test('Meldungen ohne Link werden nicht übernommen', () => {
  // Ohne Rückverweis wäre es eine Behauptung mit Amtsanstrich.
  const source = { id: 'amt', format: 'rss', country: 'DE' };
  const news = newsFromSource(source, FEED('<item><title>Ohne Link</title></item>' + ITEM(1)));
  assert.equal(news.length, 1);
  assert.equal(news[0].link, 'https://amt.example/1');
});

// ============================================================================
//  Engpässe aus CSV
// ============================================================================

test('CSV-Export wird in Engpass-Zeilen gewandelt', () => {
  const csv = 'Wirkstoff;Bezeichnung;Status;Grund\n'
    + 'Amoxicillin;Amoxicillin 1000 mg;kritisch;Erhöhte Nachfrage\n'
    + 'Metformin;Metformin 850 mg;eingeschränkt;Produktionsproblem\n';
  const { rows, rejected } = shortagesFromCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rejected.length, 0);
  assert.equal(rows[0].status, 'kritisch');
  assert.equal(rows[1].status, 'eingeschraenkt', 'Umlaut-Schreibweise wird normalisiert');
});

test('DER KERNFALL: unbekannter Status wird verworfen, nicht geraten', () => {
  const csv = 'Bezeichnung;Status\nAmoxicillin 1000 mg;irgendwas\nMetformin 850 mg;kritisch\n';
  const { rows, rejected } = shortagesFromCsv(csv);
  assert.equal(rows.length, 1, 'nur die eindeutige Zeile');
  assert.equal(rejected.length, 1);
  assert.match(rejected[0], /Status unbekannt/);
});

test('Fehlende Bezeichnung verwirft die Zeile', () => {
  const { rows, rejected } = shortagesFromCsv('Bezeichnung;Status\n;kritisch\n');
  assert.equal(rows.length, 0);
  assert.match(rejected[0], /Bezeichnung fehlt/);
});

test('Ohne Wirkstoffspalte wird nichts aus dem Produktnamen geschnitten', () => {
  const { rows } = shortagesFromCsv('Bezeichnung;Status\nAmoxicillin 1000 mg Filmtabletten;kritisch\n');
  // Lieber die vollständige Bezeichnung als ein geratener Wirkstoff.
  assert.equal(rows[0].wirkstoff, 'Amoxicillin 1000 mg Filmtabletten');
});

test('Spaltennamen lassen sich zuordnen', () => {
  const csv = 'Arzneispezialität;Vertriebsstatus\nRamipril 5 mg;nicht lieferbar\n';
  const { rows } = shortagesFromCsv(csv);
  assert.equal(rows.length, 1, 'die Standard-Kandidaten greifen bereits');
  assert.equal(rows[0].status, 'kritisch');
});

test('Doppelmeldungen werden zusammengeführt — kritischer Status gewinnt', () => {
  const rows = dedupeShortages([
    { bezeichnung: 'Amoxi 1000', wirkstoff: 'Amoxicillin', status: 'eingeschraenkt' },
    { bezeichnung: 'amoxi 1000', wirkstoff: 'amoxicillin', status: 'kritisch' },
    { bezeichnung: 'Metformin', wirkstoff: 'Metformin', status: 'verfuegbar' },
  ]);
  assert.equal(rows.length, 2);
  // Bei widersprüchlichen Meldungen ist die vorsichtigere Aussage die richtige.
  assert.equal(rows.find((r) => /amoxi/i.test(r.bezeichnung)).status, 'kritisch');
});

test('normalizeStatus kennt nur definierte Werte', () => {
  assert.equal(normalizeStatus('KRITISCH'), 'kritisch');
  assert.equal(normalizeStatus('behoben'), 'verfuegbar');
  assert.equal(normalizeStatus('vielleicht'), null);
  assert.equal(normalizeStatus(null), null);
});

// ============================================================================
//  News-Aufnahme
// ============================================================================

test('Beiträge werden angelegt und beim zweiten Lauf NICHT wiederholt', async () => {
  const created = [];
  const seenStore = createNewsSeenStore();
  const env = onlyEnv({ APOPULSE_SOURCE_AMT_URL: 'https://amt.example/rss' });
  const fetchText = async () => FEED(ITEM(1) + ITEM(2));
  const opts = { env, fetchText, seenStore, createPost: async (p) => { created.push(p); } };

  const first = await ingestNews(opts);
  assert.equal(first.created, 2);
  assert.equal(created.length, 2);
  assert.ok(created[0].sourceUrl.startsWith('https://amt.example/'));

  // Zweiter Durchlauf, gleiche Quelle: nichts Neues.
  const second = await ingestNews(opts);
  assert.equal(second.created, 0, 'derselbe Beitrag darf nicht erneut entstehen');
  assert.equal(created.length, 2);
});

test('Nur die eingebaute Quelle wird abgeschaltet, andere laufen weiter', async () => {
  const env = onlyEnv({ APOPULSE_SOURCE_NUR_EINE_URL: 'https://eine.example/rss' });

  const created = [];
  const r = await ingestNews({
    env, fetchText: async () => FEED(ITEM(9)),
    seenStore: createNewsSeenStore(), createPost: async (p) => created.push(p),
  });
  assert.equal(r.sources, 1);
  assert.equal(created.length, 1);
});

test('Eine unerreichbare Quelle stoppt die anderen nicht', async () => {
  const env = onlyEnv({
    APOPULSE_SOURCE_A_URL: 'https://kaputt.example/rss',
    APOPULSE_SOURCE_B_URL: 'https://heil.example/rss',
  });

  const created = [];
  const r = await ingestNews({
    env,
    fetchText: async (url) => {
      if (url.includes('kaputt')) throw new Error('HTTP 503');
      return FEED(ITEM(1));
    },
    seenStore: createNewsSeenStore(),
    createPost: async (p) => created.push(p),
    log: { warn() {} },
  });
  assert.equal(created.length, 1, 'die heile Quelle liefert trotzdem');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0].error, /503/);
});

test('Scheitert das Anlegen, gilt die Meldung NICHT als gesehen', async () => {
  const env = onlyEnv({ APOPULSE_SOURCE_X_URL: 'https://x.example/rss' });

  const seenStore = createNewsSeenStore();
  let fail = true;
  const attempts = [];
  const run = () => ingestNews({
    env, fetchText: async () => FEED(ITEM(1)), seenStore,
    createPost: async (p) => { attempts.push(p); if (fail) throw new Error('DB weg'); },
    log: { warn() {} },
  });

  await run();
  assert.equal(seenStore.size(), 0, 'nicht als gesehen markiert');

  fail = false;
  const second = await run();
  assert.equal(second.created, 1, 'beim nächsten Lauf wird nachgeholt');
  assert.equal(attempts.length, 2);
});

test('Alte Meldungen werden beim ersten Lauf nicht nachgeholt', () => {
  const alt = { publishedAt: new Date(Date.now() - 60 * 86400000).toISOString() };
  const neu = { publishedAt: new Date(Date.now() - 2 * 86400000).toISOString() };
  assert.equal(isFreshEnough(alt), false);
  assert.equal(isFreshEnough(neu), true);
  // Ohne Datum durchlassen: manche Feeds liefern keins.
  assert.equal(isFreshEnough({ publishedAt: null }), true);
});

test('Der Beitragstext übernimmt, ohne umzuformulieren', () => {
  const body = composePost({ title: 'Lieferengpass X', summary: 'Erhöhte Nachfrage.' });
  assert.match(body, /^Lieferengpass X/);
  assert.match(body, /Erhöhte Nachfrage\./);
});

test('Ein sehr langer Anriss wird an einer Satzgrenze gekürzt', () => {
  const summary = 'Erster Satz. ' + 'Füllung '.repeat(80) + 'Ende.';
  const body = composePost({ title: 'T', summary });
  assert.ok(body.length < summary.length);
  assert.ok(/\.$|…$/.test(body.trim()), 'endet sauber: ' + body.slice(-30));
});

test('Der Gesehen-Speicher wächst nicht unbegrenzt', () => {
  const store = createNewsSeenStore({ max: 3 });
  for (const k of ['a', 'b', 'c', 'd']) store.add(k);
  assert.equal(store.size(), 3);
  assert.equal(store.has('a'), false, 'ältestes vergessen');
  assert.equal(store.has('d'), true);
});

test('Der Gesehen-Speicher überlebt einen Neustart', () => {
  const a = createNewsSeenStore();
  a.add('quelle:1');
  const b = createNewsSeenStore();
  b.__load(a.__dump());
  assert.ok(b.has('quelle:1'), 'sonst entstehen nach jedem Deploy dieselben Beiträge erneut');
});

// ============================================================================
//  Planer
// ============================================================================

test('Die Takte entsprechen der Vorgabe', () => {
  assert.equal(INTERVALS.news, 5 * 60 * 1000);
  assert.equal(INTERVALS.shortages, 4 * 60 * 60 * 1000);
});

test('Eine Aufgabe läuft beim Start und meldet ihr Ergebnis', async () => {
  const s = createScheduler({ log: { warn() {} } });
  let runs = 0;
  s.add('test', { run: async () => { runs++; return { n: runs }; }, intervalMs: 60_000 });

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(runs, 1, 'sofort beim Anmelden');

  const [status] = s.status();
  assert.equal(status.lastOk, true);
  assert.deepEqual(status.lastResult, { n: 1 });
  assert.ok(status.nextRunAt, 'nächster Lauf ist eingeplant');
  s.stop();
});

test('Ein Fehler reißt den Planer nicht mit', async () => {
  const s = createScheduler({ log: { warn() {} } });
  s.add('kaputt', { run: async () => { throw new Error('Netz weg'); }, intervalMs: 60_000 });
  await new Promise((r) => setTimeout(r, 20));

  const [status] = s.status();
  assert.equal(status.lastOk, false);
  assert.equal(status.lastError, 'Netz weg');
  assert.equal(status.failures, 1);
  s.stop();
});

test('Läuft eine Aufgabe noch, wird der nächste Takt übersprungen', async () => {
  const s = createScheduler({ log: { warn() {} } });
  let started = 0;
  s.add('lang', {
    run: async () => { started++; await new Promise((r) => setTimeout(r, 80)); },
    intervalMs: 60_000,
  });
  await new Promise((r) => setTimeout(r, 10));

  // Während der erste Lauf noch läuft, von Hand anstoßen.
  const second = await s.runNow('lang');
  assert.equal(second.skipped, true, 'kein paralleler Zweitlauf');
  assert.equal(started, 1);
  s.stop();
});

test('runNow führt sofort aus und zählt getrennt mit', async () => {
  const s = createScheduler({ log: { warn() {} } });
  let runs = 0;
  s.add('manuell', { run: async () => { runs++; }, intervalMs: 60_000, startDelayMs: 60_000 });
  assert.equal(runs, 0, 'wegen startDelay noch nicht gelaufen');

  const r = await s.runNow('manuell');
  assert.equal(r.ok, true);
  assert.equal(runs, 1);
  assert.equal(s.status()[0].manualRuns, 1);
  s.stop();
});

test('Unbekannte Aufgabe meldet sich, statt still zu scheitern', async () => {
  const s = createScheduler();
  const r = await s.runNow('gibtsnicht');
  assert.equal(r.ok, false);
  assert.match(r.error, /unbekannt/);
  s.stop();
});

test('Doppelte Anmeldung wird abgelehnt', () => {
  const s = createScheduler();
  s.add('x', { run: async () => {}, intervalMs: 60_000, startDelayMs: 60_000 });
  assert.throws(() => s.add('x', { run: async () => {}, intervalMs: 60_000 }), /bereits angemeldet/);
  s.stop();
});

// ============================================================================
//  Aktionen / Rabatte
// ============================================================================

test('Private Konten dürfen keine Aktionen eintragen', () => {
  assert.ok(!DEAL_ACCOUNT_TYPES.includes('private'));
  const svc = createDealsService({
    rabatteRepo: createRabatteRepo({ seed: false }),
    social: {},
    accountTypeOf: () => 'private',
  });
  assert.equal(svc.mayCreate('u1'), false);
  assert.equal(caught(() => svc.create('u1', {})).code, 'deal_forbidden');
});

test('Fachbetriebe tragen ein — mit sichtbarer Herkunft', () => {
  const repo = createRabatteRepo({ seed: false });
  const svc = createDealsService({
    rabatteRepo: repo,
    social: { getProfile: () => ({ display_name: 'Linden-Apotheke' }) },
    accountTypeOf: () => 'pharmacy',
    today: '2026-08-28',
  });

  const row = svc.create('u1', {
    bezeichnung: 'Ibuprofen 400 mg', supplier: 'Linden-Apotheke',
    listenpreis: 2.35, aktionspreis: 1.65, gueltig_bis: '2026-09-30', min_menge: 50,
  });

  assert.equal(row.provenance, 'self_reported', 'sieht anders aus als geprüfte Feed-Daten');
  assert.equal(row.quelle, 'Linden-Apotheke');
  assert.equal(row.created_by, 'u1');
  assert.equal(row.rabatt_pct, 29.8);
});

test('Ein „Rabatt" ohne Ersparnis wird abgelehnt', () => {
  // Das wäre irreführende Werbung.
  assert.equal(caught(() => validateDeal({
    bezeichnung: 'X', supplier: 'Y', listenpreis: 5, aktionspreis: 5, gueltig_bis: '2099-01-01',
  }, { today: '2026-08-28' })).code, 'deal_no_discount');
});

test('Ungültige Zeiträume werden abgelehnt', () => {
  const base = { bezeichnung: 'X', supplier: 'Y', listenpreis: 5, aktionspreis: 4 };
  const today = '2026-08-28';
  assert.equal(caught(() => validateDeal({ ...base, gueltig_bis: '2026-01-01' }, { today })).code, 'deal_date_past');
  assert.equal(caught(() => validateDeal({ ...base, gueltig_bis: '28.09.2026' }, { today })).code, 'deal_date_invalid');
  // Eine „Aktion" über Jahre ist keine Aktion, sondern ein Preis.
  assert.equal(caught(() => validateDeal({ ...base, gueltig_bis: '2030-01-01' }, { today })).code, 'deal_term_long');
});

test('Nur eigene Aktionen lassen sich zurückziehen', () => {
  const repo = createRabatteRepo({ seed: false });
  const svc = createDealsService({
    rabatteRepo: repo, social: {}, accountTypeOf: () => 'pharma', today: '2026-08-28',
  });
  const row = svc.create('u1', {
    bezeichnung: 'X', supplier: 'Y', listenpreis: 5, aktionspreis: 4, gueltig_bis: '2026-10-01',
  });

  assert.equal(caught(() => svc.remove('u2', row.id)).code, 'deal_not_owner');
  assert.equal(svc.remove('u1', row.id).ok, true);
  assert.equal(repo.get(row.id), null);
});

test('Ein Feed-Austausch löscht selbst eingetragene Aktionen NICHT', () => {
  const repo = createRabatteRepo({ seed: false });
  const svc = createDealsService({
    rabatteRepo: repo, social: {}, accountTypeOf: () => 'pharma', today: '2026-08-28',
  });
  svc.create('u1', {
    bezeichnung: 'Eigene Aktion', supplier: 'Y', listenpreis: 5, aktionspreis: 4, gueltig_bis: '2026-10-01',
  });

  repo.replaceFeed([
    { bezeichnung: 'Aus dem Feed', supplier: 'GH', listenpreis: 3, aktionspreis: 2, gueltig_bis: '2026-10-01' },
  ], { provenance: 'verified', quelle: 'Feed' });

  const all = repo.listFlat();
  assert.equal(all.length, 2);
  assert.ok(all.some((r) => r.bezeichnung === 'Eigene Aktion'), 'sonst verschwindet eine fremde Aktion unangekündigt');
  assert.ok(all.some((r) => r.bezeichnung === 'Aus dem Feed'));
});

// --- Rückfall-Generator ------------------------------------------------------

test('Demodaten sind deterministisch', () => {
  const a = generateDemoDeals({ today: '2026-08-28' });
  const b = generateDemoDeals({ today: '2026-08-28' });
  assert.deepEqual(a, b, 'sonst zeigt die Ansicht nach jedem Neustart andere Zahlen');
  assert.ok(a.length >= 8);
  assert.ok(a.every((d) => d.aktionspreis < d.listenpreis));
  assert.ok(a.every((d) => d.gueltig_bis > '2026-08-28'), 'alle laufend');
});

test('Demodaten nennen keine echten Firmen', () => {
  // Ein erfundener Preis darf nie einem echten Großhändler zugeschrieben werden.
  assert.ok(generateDemoDeals().every((d) => /^Demo-/.test(d.supplier)));
});

test('Demodaten entstehen NUR, wenn keine echte Aktion läuft', () => {
  const leer = createRabatteRepo({ seed: false });
  assert.equal(seedDemoDealsIfNoneRunning({ rabatteRepo: leer, today: '2026-08-28', log: {} }).seeded, true);
  assert.ok(leer.listFlat().every((r) => r.provenance === 'simulated'));

  const mitEchten = createRabatteRepo({ seed: false, today: '2026-08-28' });
  mitEchten.upsert({
    bezeichnung: 'Echt', supplier: 'GH', listenpreis: 5, aktionspreis: 4,
    gueltig_bis: '2026-10-01', provenance: 'verified',
  });
  const r = seedDemoDealsIfNoneRunning({ rabatteRepo: mitEchten, today: '2026-08-28', log: {} });
  assert.equal(r.seeded, false);
  assert.equal(mitEchten.listFlat().length, 1, 'nichts erfunden, nichts überschrieben');
});

test('DER KERNFALL: nur ABGELAUFENE Aktionen zählen als „nichts da"', () => {
  // Die kuratierten Referenzdaten haben feste Enddaten. Läuft die letzte ab,
  // steht die Ansicht still leer — die Zeilen sind ja noch in der Tabelle.
  // Eine Prüfung auf „gibt es Zeilen" hätte das nie bemerkt.
  const repo = createRabatteRepo({ seed: false, today: '2026-08-28' });
  repo.upsert({
    bezeichnung: 'Abgelaufen', supplier: 'GH', listenpreis: 5, aktionspreis: 4,
    gueltig_bis: '2026-01-01', provenance: 'reference',
  });
  assert.equal(repo.listFlat().length, 1, 'die Zeile steht noch da …');
  assert.equal(repo.listTop10().length, 0, '… läuft aber nicht mehr');

  const r = seedDemoDealsIfNoneRunning({ rabatteRepo: repo, today: '2026-08-28', log: {} });
  assert.equal(r.seeded, true, 'der Rückfall muss hier greifen');
  assert.ok(repo.listTop10().length > 0, 'die Ansicht ist wieder gefüllt');
});

test('Demodaten sind als simuliert gekennzeichnet', () => {
  const repo = createRabatteRepo({ seed: false });
  seedDemoDealsIfNoneRunning({ rabatteRepo: repo, today: '2026-08-28', log: {} });
  assert.ok(repo.listFlat().every((r) => r.provenance === 'simulated' && r.quelle === 'Demodaten'));
});
