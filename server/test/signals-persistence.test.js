// ============================================================================
//  VerifiedSignals in PostgreSQL — Dauerhaftigkeit und Deduplizierung
// ============================================================================
//  Vorher lagen die Signale AUSSCHLIESSLICH im Arbeitsspeicher: Nach jedem
//  Deploy war alles weg, und `__dump/__load` des Stores wurde nirgends
//  aufgerufen — der Snapshot kannte sie nicht einmal. Die KI-Anreicherung
//  laeuft je Meldung genau einmal; was verloren ging, kam nur gegen erneute
//  Kosten zurueck.
//
//  Zwei Zusicherungen stehen hier im Mittelpunkt:
//
//   1. DEDUPLIZIERUNG. Derselbe Behoerdenhinweis im naechsten Takt
//      aktualisiert die Zeile (`dedupeKey` = Quelle + Original-Adresse), statt
//      eine zweite anzulegen.
//   2. `verifiedAt` IST DER ERSTE FUND. Beim Aktualisieren darf er nicht
//      mitwandern — sonst stuende jede alte Meldung nach jedem Abruf wieder
//      oben im Feed, obwohl sich nichts geaendert hat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrismaStore } from '../src/repo/prismaStore.js';
import { createSignalStore, baueSignal } from '../src/services/signals.js';

const stumm = { log() {}, warn() {}, error() {} };

/** Doppelgaenger des Prisma-Clients fuer die Signal-Tabelle. */
function fakeClient({ failOn = null, rows = [] } = {}) {
  const calls = { upsert: [], findMany: [] };
  return {
    calls,
    verifiedSignal: {
      upsert: async (args) => {
        if (failOn === 'upsert') throw new Error('P1001 keine Verbindung');
        calls.upsert.push(args);
        return { id: 'sig-' + calls.upsert.length };
      },
      findMany: async (args) => {
        if (failOn === 'findMany') throw new Error('kaputt');
        calls.findMany.push(args);
        return rows;
      },
      count: async () => rows.length,
    },
    $connect: async () => {},
    $disconnect: async () => {},
  };
}

function signal(over = {}) {
  return baueSignal({
    meldung: { title: 'Lieferengpass Amoxicillin 1000 mg', summary: 'Produktionsausfall beim Hersteller.', raw: 'Volltext …' },
    herkunft: {
      originalUrl: 'https://www.bfarm.de/meldung/1',
      sourceName: 'BfArM', sourceId: 'bfarm_news', country: 'DE', kind: 'news',
    },
    extraktion: { wirkstoff: 'amoxicillin', schweregrad: 'kritisch', kategorie: 'SHORTAGE', confidence: 0.8, ...over },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Schreiben
// ─────────────────────────────────────────────────────────────────────────────

test('ein Signal wird per upsert auf dedupeKey geschrieben', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  const res = await store.saveSignal(signal());
  assert.equal(res.ok, true);
  assert.equal(client.calls.upsert.length, 1);
  const args = client.calls.upsert[0];
  assert.deepEqual(args.where, { dedupeKey: 'bfarm_news:https://www.bfarm.de/meldung/1' });
  assert.equal(args.create.originalUrl, 'https://www.bfarm.de/meldung/1');
  assert.equal(args.create.sourceName, 'BfArM');
  assert.equal(args.create.country, 'DE');
  assert.equal(args.create.wirkstoff, 'amoxicillin');
  assert.equal(args.create.category, 'SHORTAGE');
});

test('derselbe Hinweis zweimal ergibt EINEN Schluessel — keine zweite Zeile', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  await store.saveSignal(signal());
  await store.saveSignal(signal());
  assert.equal(client.calls.upsert.length, 2, 'zwei Aufrufe …');
  // … aber mit demselben Schluessel. Die Datenbank macht daraus eine Zeile.
  assert.equal(client.calls.upsert[0].where.dedupeKey, client.calls.upsert[1].where.dedupeKey);
});

test('beim Aktualisieren wandert verifiedAt NICHT mit', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  await store.saveSignal(signal());
  const args = client.calls.upsert[0];
  assert.ok(args.create.verifiedAt instanceof Date, 'beim Anlegen gesetzt');
  assert.equal('verifiedAt' in args.update, false,
    'verifiedAt im Update wuerde jede alte Meldung bei jedem Abruf nach oben schieben');
});

test('ein spaeterer Lauf ohne KI loescht den bekannten Wirkstoff nicht', async () => {
  // Der Fall: Erster Lauf mit KI (Wirkstoff erkannt), zweiter ohne Schluessel.
  // Ein naives Update setzte wirkstoff auf null — der erkannte Wirkstoff waere
  // weg, und niemand haette es gemerkt.
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  await store.saveSignal(signal({ wirkstoff: null, schweregrad: null, ursache: null, confidence: 0 }));
  const args = client.calls.upsert[0];
  assert.equal('wirkstoff' in args.update, false, 'null darf im Update nicht vorkommen');
  assert.equal('schweregrad' in args.update, false);
  // Beim ANLEGEN ist null richtig — dort gibt es keinen aelteren Wert.
  assert.equal(args.create.wirkstoff, null);
});

test('ohne Herkunft wird nichts geschrieben', async () => {
  const client = fakeClient();
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  for (const kaputt of [
    null,
    { dedupeKey: 'x', title: 'T' },                                  // keine Adresse
    { dedupeKey: 'x', title: 'T', originalUrl: 'https://a.test/1' }, // kein Quellenname
  ]) {
    const res = await store.saveSignal(kaputt);
    assert.equal(res.ok, false);
    assert.equal(res.skipped, true);
  }
  assert.equal(client.calls.upsert.length, 0);
});

test('ein Datenbankfehler wird gemeldet, nicht geworfen', async () => {
  const client = fakeClient({ failOn: 'upsert' });
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  const res = await store.saveSignal(signal());
  assert.equal(res.ok, false);
  assert.ok(res.error || res.skipped);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Lesen
// ─────────────────────────────────────────────────────────────────────────────

test('Signale werden neueste zuerst gelesen, Filter wandern in die Abfrage', async () => {
  const client = fakeClient({ rows: [] });
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  await store.listSignals({ country: 'de', category: 'shortage', wirkstoff: 'amoxi', limit: 50 });
  const args = client.calls.findMany[0];
  assert.deepEqual(args.orderBy, { verifiedAt: 'desc' });
  assert.equal(args.take, 50);
  assert.equal(args.where.country, 'DE');
  assert.equal(args.where.category, 'SHORTAGE');
  // Wirkstoff UND Handelsname — dieselbe Trefferlogik wie im Speicher. Zwei
  // Lesequellen mit unterschiedlichem Verhalten waere ein Fehler, den niemand
  // findet, weil beide „funktionieren".
  assert.equal(args.where.OR.length, 2);
  assert.ok(args.where.OR.some((o) => o.wirkstoff));
  assert.ok(args.where.OR.some((o) => o.handelsname));
});

test('eine unlesbare Datenbank gibt eine leere Liste mit Grund, nicht einen Absturz', async () => {
  const client = fakeClient({ failOn: 'findMany' });
  const store = createPrismaStore({ clientFactory: () => client, log: stumm });
  const r = await store.listSignals({});
  assert.equal(r.ok, false);
  assert.deepEqual(r.rows, []);
  assert.ok(r.error || r.skipped);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Speicher + Spiegel zusammen
// ─────────────────────────────────────────────────────────────────────────────

test('der Speicher schreibt jedes Signal in die Datenbank durch', async () => {
  const geschrieben = [];
  const store = createSignalStore({ mirror: { saveSignal: async (s) => { geschrieben.push(s); } } });
  store.upsert(signal());
  assert.equal(geschrieben.length, 1);
  assert.equal(geschrieben[0].sourceName, 'BfArM');
});

test('durchgeschrieben wird der GESPEICHERTE Stand, nicht der eingehende', async () => {
  // Beim zweiten Sehen traegt das eingehende Signal einen neuen Zeitpunkt. Den
  // durchzuschreiben hiesse: Die Datenbankzeile waere neuer als der Speicher,
  // und nach dem naechsten Deploy stuende die Meldung wieder oben.
  const geschrieben = [];
  const store = createSignalStore({ mirror: { saveSignal: async (s) => { geschrieben.push(s); } } });
  const erst = signal();
  store.upsert(erst);
  const spaeter = { ...signal(), verifiedAt: new Date(Date.now() + 3600_000).toISOString() };
  store.upsert(spaeter);
  assert.equal(geschrieben.length, 2);
  assert.equal(geschrieben[1].verifiedAt, erst.verifiedAt, 'der erste Fund gilt');
  assert.notEqual(geschrieben[1].verifiedAt, spaeter.verifiedAt);
});

test('ein ausgefallener Spiegel haelt den Abruf NICHT auf', () => {
  // Eine klemmende Datenbank darf keine Behoerdenmeldung verschlucken.
  for (const mirror of [
    { saveSignal: async () => { throw new Error('P1001'); } },
    { saveSignal: () => { throw new Error('synchron kaputt'); } },
    {},      // Spiegel ohne die Methode
    null,    // kein Spiegel
  ]) {
    const store = createSignalStore({ mirror });
    assert.equal(store.upsert(signal()), true);
    assert.equal(store.size(), 1);
  }
});

test('uebernehmen fuellt den Speicher, OHNE zurueckzuschreiben', () => {
  const geschrieben = [];
  const store = createSignalStore({ mirror: { saveSignal: async (s) => { geschrieben.push(s); } } });
  const zahl = store.uebernehmen([
    { dedupeKey: 'a:1', title: 'A', country: 'DE', category: 'NEWS', verifiedAt: new Date('2026-10-01T10:00:00Z'), publishedAt: null },
    { dedupeKey: 'b:2', title: 'B', country: 'AT', category: 'SHORTAGE', verifiedAt: new Date('2026-10-02T10:00:00Z'), publishedAt: null },
  ]);
  assert.equal(zahl, 2);
  assert.equal(store.size(), 2);
  // Der entscheidende Teil: Die Zeilen kommen GERADE aus der Datenbank. Sie
  // einzeln zurueckzuschreiben waeren hunderte sinnlose Schreibvorgaenge bei
  // jedem Start — und bei jedem die Gefahr, verifiedAt zu verschieben.
  assert.equal(geschrieben.length, 0);
  // Date -> ISO, damit Sortierung und Speicher dieselbe Form sehen.
  assert.equal(typeof store.get('a:1').verifiedAt, 'string');
  // Neueste zuerst.
  assert.deepEqual(store.list({}).map((s) => s.dedupeKey), ['b:2', 'a:1']);
});

test('uebernehmen ueberschreibt nichts, was schon im Speicher liegt', () => {
  const store = createSignalStore();
  store.upsert(signal());
  const key = 'bfarm_news:https://www.bfarm.de/meldung/1';
  const vorher = store.get(key).title;
  const zahl = store.uebernehmen([{ dedupeKey: key, title: 'ALTE FASSUNG', country: 'DE', category: 'NEWS', verifiedAt: new Date(0) }]);
  assert.equal(zahl, 0);
  assert.equal(store.get(key).title, vorher, 'der frischere Stand im Speicher gewinnt');
});

test('jeLand zaehlt je Land — und nennt ein Land ohne Signale gar nicht', () => {
  const store = createSignalStore();
  store.upsert(signal());
  store.upsert(baueSignal({
    meldung: { title: 'BASG-Meldung' },
    herkunft: { originalUrl: 'https://basg.gv.at/m/1', sourceName: 'BASG', sourceId: 'basg_news', country: 'AT' },
  }));
  store.upsert(baueSignal({
    meldung: { title: 'BASG-Meldung 2' },
    herkunft: { originalUrl: 'https://basg.gv.at/m/2', sourceName: 'BASG', sourceId: 'basg_news', country: 'AT' },
  }));
  assert.deepEqual(store.jeLand(), { DE: 1, AT: 2 });
  // Kein `KE: 0`: Ein Land, das hier fehlt, hat noch nie etwas geliefert —
  // das ist die Aussage, die in der Diagnose gebraucht wird.
  assert.equal('KE' in store.jeLand(), false);
});
