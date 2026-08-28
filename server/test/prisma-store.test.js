// ============================================================================
//  PostgreSQL-Spiegel — Abbildung und Ausfallverhalten
// ============================================================================
//  Zwei Dinge werden hier geprüft, und beide sind der eigentliche Punkt des
//  Moduls:
//
//  1. Die Abbildung stimmt: deutsche Statuswerte werden zu den Enum-Werten des
//     Schemas, Geldbeträge/Daten werden nicht erfunden, `upsert` läuft auf den
//     fachlichen Schlüssel (Duplikatsprüfung).
//  2. Eine kaputte Datenbank reißt nichts mit. Das ist die Eigenschaft, auf die
//     es im Betrieb ankommt — ein Apothekenteam darf nicht vor einer leeren
//     Seite sitzen, weil Postgres gerade nicht antwortet.
//
//  Es läuft KEINE echte Datenbank mit: `clientFactory` reicht einen
//  Doppelgänger herein, der die Aufrufe mitschreibt. Die echte Migration wurde
//  gegen ein laufendes PostgreSQL 16 geprüft (docs/DATENBANK.md).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrismaStore, toShortageStatus, toProvenance, toDate, withoutNulls } from '../src/repo/prismaStore.js';

const stumm = { log() {}, warn() {}, error() {} };

/** Doppelgänger des Prisma-Clients: schreibt jeden Aufruf mit. */
function fakeClient({ failOn = null, error = new Error('boom') } = {}) {
  const calls = { newsPost: [], shortage: [] };
  const table = (name) => ({
    upsert: async (args) => {
      if (failOn === name) throw error;
      calls[name].push(args);
      return { id: `${name}-${calls[name].length}` };
    },
    count: async () => calls[name].length,
  });
  return { calls, newsPost: table('newsPost'), shortage: table('shortage'), $connect: async () => {}, $disconnect: async () => {} };
}

// ── Reine Abbildungsfunktionen ──────────────────────────────────────────────

test('Statuswerte der Anwendung werden auf die Enum-Werte abgebildet', () => {
  assert.equal(toShortageStatus('kritisch'), 'CRITICAL');
  assert.equal(toShortageStatus('eingeschraenkt'), 'LIMITED');
  assert.equal(toShortageStatus('eingeschränkt'), 'LIMITED');
  assert.equal(toShortageStatus('verfuegbar'), 'AVAILABLE');
  assert.equal(toShortageStatus('VERFÜGBAR'), 'AVAILABLE');
  // Unbekanntes landet auf der vorsichtigen Mitte, nicht auf „kritisch":
  // ein erfundener Alarm ist schädlicher als eine zu zurückhaltende Angabe.
  assert.equal(toShortageStatus('irgendwas'), 'LIMITED');
  assert.equal(toShortageStatus(null), 'LIMITED');
});

test('Herkunft bleibt erhalten und wird nicht zu VERIFIED aufgewertet', () => {
  assert.equal(toProvenance('simulated'), 'SIMULATED');
  assert.equal(toProvenance('self_reported'), 'SELF_REPORTED');
  assert.equal(toProvenance('verified'), 'VERIFIED');
  // Der Rückfall ist REFERENCE, nicht VERIFIED. Eine Zeile unklarer Herkunft
  // darf nie als amtlich geprüft in der Datenbank stehen.
  assert.equal(toProvenance('quatsch'), 'REFERENCE');
});

test('unlesbare Daten werden zu null statt zu „jetzt"', () => {
  assert.equal(toDate(''), null);
  assert.equal(toDate('demnächst'), null);
  assert.equal(toDate(undefined), null);
  assert.equal(toDate('2026-06-14').toISOString(), '2026-06-14T00:00:00.000Z');
  assert.equal(toDate('2026-06-14T10:30:00Z').toISOString(), '2026-06-14T10:30:00.000Z');
});

// ── Store ohne Konfiguration ────────────────────────────────────────────────

test('ohne DATABASE_URL entsteht kein Store — die App läuft ohne Datenbank', () => {
  assert.equal(createPrismaStore({ databaseUrl: undefined }), null);
  assert.equal(createPrismaStore({ databaseUrl: '   ' }), null);
});

// ── Schreiben ───────────────────────────────────────────────────────────────

test('News werden per upsert auf den Link geschrieben (keine Duplikate)', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });

  const item = {
    title: 'Rückruf Charge X',
    link: 'https://basg.gv.at/meldung/1',
    summary: 'Betroffen sind Chargen …',
    source: 'BASG',
    sourceId: 'basg_news',
    country: 'at',
    publishedAt: '2026-08-20T09:00:00Z',
  };
  assert.equal((await store.saveNews(item)).ok, true);
  assert.equal((await store.saveNews(item)).ok, true);

  assert.equal(client.calls.newsPost.length, 2);
  const [first] = client.calls.newsPost;
  assert.deepEqual(first.where, { link: 'https://basg.gv.at/meldung/1' });
  assert.equal(first.create.country, 'AT');           // normalisiert
  assert.equal(first.create.sourceId, 'basg_news');
  assert.equal(first.create.publishedAt.toISOString(), '2026-08-20T09:00:00.000Z');

  // Beim Wiedersehen wird der Inhalt aufgefrischt, aber NICHT fetchedAt —
  // sonst sähe eine drei Wochen alte Meldung nach jedem Takt taufrisch aus.
  assert.ok(!('fetchedAt' in first.update), 'fetchedAt darf beim Update nicht mitlaufen');
  assert.ok(!('createdAt' in first.update));
});

test('News ohne Link oder Titel werden übersprungen statt halb gespeichert', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  assert.equal((await store.saveNews({ title: 'ohne Link' })).skipped, true);
  assert.equal((await store.saveNews({ link: 'https://x/1' })).skipped, true);
  assert.equal(client.calls.newsPost.length, 0);
});

test('Engpässe laufen auf den Schlüssel Präparat+Land — das ist die Duplikatsprüfung', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });

  const r = await store.saveShortages([
    { bezeichnung: 'Amoxicillin 1000 mg', wirkstoff: 'Amoxicillin', status: 'kritisch',
      grund: 'Erhöhte Nachfrage', gemeldet_am: '2026-06-14', provenance: 'verified', quelle: 'BASG' },
    // Fehlt die Handelsbezeichnung, tritt der Wirkstoff an ihre Stelle. Ein
    // Engpass von „Amoxicillin" ohne konkrete Packungsangabe ist eine echte
    // Information — sie wegzuwerfen wäre schlechter als sie unter dem
    // Wirkstoffnamen zu führen.
    { wirkstoff: 'Nur Wirkstoff', status: 'kritisch' },
    // Ohne jeden Namen bleibt nichts übrig, was man anzeigen könnte.
    { status: 'kritisch', grund: 'namenlos' },
  ], { country: 'DE' });

  assert.equal(r.written, 2);
  assert.equal(r.received, 3);
  assert.equal(client.calls.shortage.length, 2);
  assert.equal(client.calls.shortage[1].where.drugName_country.drugName, 'Nur Wirkstoff');

  const call = client.calls.shortage[0];
  assert.deepEqual(call.where, { drugName_country: { drugName: 'Amoxicillin 1000 mg', country: 'DE' } });
  assert.equal(call.create.status, 'CRITICAL');
  assert.equal(call.create.provenance, 'VERIFIED');
  assert.equal(call.create.source, 'BASG');
  assert.equal(call.create.reportedAt.toISOString(), '2026-06-14T00:00:00.000Z');
  assert.equal(call.create.expectedEnd, null);
});

test('ein späterer Lauf ohne Meldedatum löscht das bekannte Meldedatum nicht', async () => {
  // Der Fehler, den dieser Test festhält, ist beim Durchlauf gegen eine echte
  // Datenbank aufgefallen: Der zweite Aufruf brachte kein `gemeldet_am` mit,
  // und das Update schrieb reportedAt auf null — das ursprüngliche Meldedatum
  // war weg, ohne Fehlermeldung. Genau so verliert man Daten unbemerkt.
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });

  await store.saveShortages([{ bezeichnung: 'Amoxicillin', status: 'eingeschraenkt', gemeldet_am: '2026-06-14' }]);
  await store.saveShortages([{ bezeichnung: 'Amoxicillin', status: 'kritisch' }]);

  const zweites = client.calls.shortage[1];
  assert.equal(zweites.update.status, 'CRITICAL', 'der neue Status muss ankommen');
  assert.ok(!('reportedAt' in zweites.update), 'reportedAt darf nicht mit null überschrieben werden');
  assert.ok(!('reason' in zweites.update));
  // Beim ANLEGEN bleibt null dagegen richtig — dort gibt es nichts zu verlieren.
  assert.equal(client.calls.shortage[0].create.expectedEnd, null);
});

test('withoutNulls entfernt nur null/undefined, nicht 0 oder leere Zeichenketten', () => {
  // Ein naives `if (!v)` hätte hier den Preis 0 und den leeren Grund
  // stillschweigend mit verschluckt.
  assert.deepEqual(withoutNulls({ a: 0, b: '', c: false, d: null, e: undefined }),
    { a: 0, b: '', c: false });
});

test('die Herkunft der einzelnen Zeile schlägt die Vorgabe des Aufrufs', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  // Der Aufruf sagt „verified", die Zeile ist aber eine Demozeile. Gewinnt die
  // Vorgabe, stünde eine erfundene Zeile als amtlich geprüft in der Datenbank.
  await store.saveShortages([{ bezeichnung: 'Demo', status: 'kritisch', provenance: 'simulated' }],
    { provenance: 'verified' });
  assert.equal(client.calls.shortage[0].create.provenance, 'SIMULATED');
});

// ── Ausfallverhalten ────────────────────────────────────────────────────────

test('ein Datenbankfehler wirft nicht — der Aufrufer läuft weiter', async () => {
  const client = fakeClient({ failOn: 'newsPost' });
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  const res = await store.saveNews({ title: 'T', link: 'https://x/1' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'boom');
  assert.equal(store.state, 'ready', 'ein einzelner Schreibfehler darf den Spiegel nicht abschalten');
});

test('ein Verbindungsabbruch schaltet den Spiegel ab, statt jede Zeile hineinlaufen zu lassen', async () => {
  const client = fakeClient({ failOn: 'shortage', error: new Error('P1001: Can\'t reach database server') });
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });

  const rows = Array.from({ length: 50 }, (_, i) => ({ bezeichnung: `Präparat ${i}`, status: 'kritisch' }));
  const r = await store.saveShortages(rows);

  assert.equal(store.state, 'disabled');
  assert.equal(r.written, 0);
  assert.equal(r.ok, false);
  // Genau EIN Versuch, nicht fünfzig: nach dem Abbruch hat der Rest keinen Zweck.
  assert.equal(client.calls.shortage.length, 0);
  assert.match(store.reason, /Verbindung verloren/);
});

test('fehlender Prisma-Client schaltet ab, statt den Serverstart zu verhindern', async () => {
  const store = createPrismaStore({
    clientFactory: () => { throw new Error("Cannot find module '.prisma/client/default'"); },
    log: stumm,
  });
  assert.equal(await store.connect(), false);
  assert.equal(store.state, 'disabled');
  assert.match(store.reason, /nicht erzeugt/);
  // Und danach schluckt jeder Schreibversuch still — kein Fehler nach oben.
  assert.equal((await store.saveNews({ title: 'T', link: 'https://x/1' })).skipped, true);
});

test('stats() meldet den Zustand, auch wenn der Spiegel abgeschaltet ist', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  await store.saveNews({ title: 'T', link: 'https://x/1' });
  const s = await store.stats();
  assert.equal(s.state, 'ready');
  assert.equal(s.newsUpserts, 1);
  assert.equal(s.newsRows, 1);
});

test('stats() verbindet bei Bedarf — sonst steht nach dem Deploy nur „idle" da', async () => {
  // Direkt nach einem Deploy hat noch kein Hintergrundlauf stattgefunden. Genau
  // dann schaut jemand nach, ob die neu angehängte Datenbank funktioniert.
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  assert.equal(store.state, 'idle', 'ohne Zutun wird nicht verbunden');

  const s = await store.stats();
  assert.equal(s.state, 'ready');
  assert.equal(s.newsRows, 0);
});

test('stats() meldet eine unerreichbare Datenbank als abgeschaltet mit Begründung', async () => {
  const store = createPrismaStore({
    clientFactory: () => { throw new Error("Can't reach database server at `localhost:59999`"); },
    log: stumm,
  });
  const s = await store.stats();
  assert.equal(s.state, 'disabled');
  assert.match(s.reason, /Can't reach database server/);
  // Und keine erfundenen Zeilenzahlen: Was nicht gelesen werden konnte, wird
  // auch nicht als 0 gemeldet — 0 hieße „nachgesehen, nichts da".
  assert.ok(!('newsRows' in s));
});
