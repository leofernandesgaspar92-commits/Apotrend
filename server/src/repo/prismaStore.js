// ============================================================================
//  PostgreSQL-Spiegel der Live-Daten
// ============================================================================
//  Der Owner will, dass die automatisch geholten Live-Daten in der
//  PostgreSQL-Datenbank landen. Genau das macht dieses Modul — und bewusst
//  nicht mehr.
//
//  EHRLICHE EINORDNUNG, damit niemand mehr erwartet als hier steht:
//  Die Anwendung rendert weiterhin aus den In-Memory-Repos. Diese Datei
//  SPIEGELT die aufgenommenen Meldungen und Engpaesse zusaetzlich nach
//  Postgres. Sie ist noch nicht die Lesequelle des Feeds.
//
//  Warum dieser Zuschnitt und nicht gleich alles umstellen:
//  Die Repos tragen den kompletten Funktionsumfang der Plattform (Beitraege,
//  Profile, Nachrichten, Bestellungen, Moderation). Die in einem Zug auf eine
//  Datenbank umzuhaengen, waere ein Umbau mit hohem Risiko fuer eine laufende
//  App — und der Nutzen fuer den Owner ist ein anderer: Auf dem kostenlosen
//  Render-Tarif ist das Dateisystem fluechtig, der JSON-Snapshot ueberlebt kein
//  Deploy. Alles, was die Automatik in Tagen sammelt, war nach jedem Deploy
//  weg. Der Spiegel haelt es dauerhaft.
//
//  DREI EIGENSCHAFTEN, DIE NICHT VERHANDELBAR SIND:
//
//  1. NIE DEN SERVER MITREISSEN. Ohne DATABASE_URL, ohne erzeugten Client, bei
//     Verbindungsabbruch: Der Store schaltet sich still ab und die App laeuft
//     unveraendert weiter. Eine nicht erreichbare Datenbank darf keinen
//     Apothekenbetrieb aufhalten.
//  2. DUPLIKATE PRUEFEN. Jeder Schreibvorgang ist ein `upsert` auf einen
//     fachlichen Schluessel (Link bzw. Praeparat+Land) — der Vier-Stunden-Takt
//     darf keine Kopien erzeugen.
//  3. HERKUNFT MITSCHREIBEN. `provenance` faehrt bei jeder Zeile mit. Eine
//     Demozeile darf in der Datenbank nicht aussehen wie eine Behoerdenmeldung.
// ============================================================================

import { gzipSync, gunzipSync } from 'node:zlib';
import { dbAddressWarning } from './dbAddress.js';

/** Statuswerte der Anwendung -> ShortageStatus im Schema. */
const STATUS = new Map([
  ['kritisch', 'CRITICAL'],
  ['critical', 'CRITICAL'],
  ['nicht lieferbar', 'CRITICAL'],
  ['eingeschraenkt', 'LIMITED'],
  ['eingeschränkt', 'LIMITED'],
  ['limited', 'LIMITED'],
  ['verfuegbar', 'AVAILABLE'],
  ['verfügbar', 'AVAILABLE'],
  ['available', 'AVAILABLE'],
  ['behoben', 'AVAILABLE'],
]);

const PROVENANCE = new Map([
  ['verified', 'VERIFIED'],
  ['reference', 'REFERENCE'],
  ['self_reported', 'SELF_REPORTED'],
  ['simulated', 'SIMULATED'],
]);

// ── Zahlungen: Anwendungswerte -> Enums im Schema ───────────────────────────
//  Die Anwendung fuehrt `method` als freien String ('card', 'apple_pay', …),
//  das Schema als Enum. Die Zuordnung steht hier und NICHT im Zahlungsdienst:
//  Welche Werte die Datenbank kennt, ist eine Eigenschaft des Spiegels.
//
//  Ein unbekannter Wert wird NICHT geraten. `toPaymentMethod` gibt dann null
//  zurueck und die Zeile wird uebersprungen — eine Zahlung unter falschem
//  Bezahlweg zu verbuchen waere schlimmer als eine fehlende Spiegelzeile, denn
//  die Anwendung laeuft ohnehin aus dem Repo.
const PAYMENT_METHOD = new Map([
  ['crypto_direct', 'CRYPTO_DIRECT'],
  ['crypto', 'CRYPTO_HOSTED'],
  ['card', 'CARD'],
  ['apple_pay', 'APPLE_PAY'],
  ['google_pay', 'GOOGLE_PAY'],
  ['paypal', 'PAYPAL'],
  ['klarna', 'KLARNA'],
  ['sepa', 'SEPA'],
  ['invoice', 'INVOICE'],
]);

const PAYMENT_PROVIDER = new Map([
  ['direct', 'DIRECT'],
  ['coinbase', 'COINBASE'],
  ['stripe', 'STRIPE'],
  ['paypal', 'PAYPAL'],
]);

const PAYMENT_STATUS = new Map([
  ['pending', 'PENDING'],
  ['pending_review', 'PENDING_REVIEW'],
  ['paid', 'PAID'],
  ['failed', 'FAILED'],
  ['refunded', 'REFUNDED'],
]);

const schluessel = (v) => String(v || '').trim().toLowerCase();

export function toPaymentMethod(value) { return PAYMENT_METHOD.get(schluessel(value)) || null; }
export function toPaymentProvider(value) { return PAYMENT_PROVIDER.get(schluessel(value)) || null; }
export function toPaymentStatus(value) { return PAYMENT_STATUS.get(schluessel(value)) || null; }

export function toShortageStatus(value) {
  return STATUS.get(String(value || '').trim().toLowerCase()) || 'LIMITED';
}

export function toProvenance(value) {
  return PROVENANCE.get(String(value || '').trim().toLowerCase()) || 'REFERENCE';
}

/**
 * Datum fuer die Datenbank.
 *
 * Gibt `null` zurueck, wenn nichts Lesbares dasteht — NICHT `new Date()`.
 * Ein erfundener Zeitstempel waere in der Datenbank von einem echten nicht mehr
 * zu unterscheiden, und die Meldung rutschte in jeder Sortierung nach oben.
 * Deshalb ist `publishedAt` im Schema nullbar.
 */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const ms = Date.parse(String(value).length === 10 ? `${value}T00:00:00Z` : String(value));
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * Obergrenze einer Liste bestimmen.
 *
 * Unsinnige Eingaben (negativ, null, keine Zahl) fallen auf den Standard
 * zurueck statt sich auf 1 herunterklemmen zu lassen: `?limit=-5` mit genau
 * einer Zeile zu beantworten sieht aus wie ein Datenproblem, ist aber ein
 * Tippfehler. Zu grosse Werte werden gedeckelt.
 */
export function clampLimit(value, { fallback, max }) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * Felder mit `null` aussortieren — für Updates.
 *
 * Der Unterschied zwischen „ich weiß es nicht" und „es ist leer" geht in
 * diesen Datensätzen sonst verloren: Ein Behörden-Feed, der beim zweiten Lauf
 * das Meldedatum weglässt, würde das beim ersten Lauf gelesene Datum löschen.
 * Beim Anlegen (`create`) bleibt null dagegen richtig — dort gibt es keinen
 * älteren Wert, der überschrieben werden könnte.
 */
export function withoutNulls(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

/**
 * Store anlegen.
 *
 * Ohne `databaseUrl` kommt `null` zurueck — der Aufrufer prueft schlicht auf
 * Wahrheitswert und braucht keinen zweiten Codepfad.
 *
 * `clientFactory` ist der Testeinstieg: Die Tests reichen einen Doppelgaenger
 * herein und pruefen die Abbildung, ohne eine Datenbank zu brauchen.
 */
export function createPrismaStore({
  databaseUrl = process.env.DATABASE_URL,
  clientFactory = null,
  log = console,
} = {}) {
  const url = (databaseUrl || '').trim();
  if (!url && !clientFactory) return null;

  let client = null;
  let state = 'idle'; // idle | ready | disabled
  let disabledReason = null;
  const counts = { newsUpserts: 0, shortageUpserts: 0, signalUpserts: 0, transactionUpserts: 0, snapshotSaves: 0, errors: 0 };

  function disable(reason) {
    state = 'disabled';
    disabledReason = reason;
    log.warn?.(`ApoPulse DB: Spiegel abgeschaltet — ${reason}. `
      + 'Die Anwendung laeuft unveraendert weiter (In-Memory + Snapshot).');
  }

  /**
   * Verbindung herstellen. Der Import ist ABSICHTLICH dynamisch: `@prisma/client`
   * wirft beim Laden, solange `prisma generate` nicht lief. Ein statischer Import
   * wuerde damit den Serverstart verhindern — auf einem Tarif ohne Datenbank
   * waere die ganze App wegen eines optionalen Zusatzes tot.
   */
  async function connect() {
    if (state === 'ready') return true;
    if (state === 'disabled') return false;
    try {
      if (clientFactory) {
        client = await clientFactory();
      } else {
        const mod = await import('@prisma/client');
        const PrismaClient = mod.PrismaClient || (mod.default && mod.default.PrismaClient);
        if (!PrismaClient) throw new Error('PrismaClient nicht im Modul gefunden');
        client = new PrismaClient({
          datasources: { db: { url } },
          log: ['warn', 'error'],
        });
        await client.$connect();
      }
      state = 'ready';
      log.log?.('ApoPulse DB: Spiegel aktiv (PostgreSQL).');
      // Erst NACH erfolgreicher Verbindung: Vorher waere die Warnung Laerm
      // neben einem echten Fehler. Sie nennt nur den Hostnamen, nie die
      // Zugangsdaten aus derselben URL.
      const adresse = dbAddressWarning(url);
      if (adresse) log.warn?.('\u26a0\ufe0f  ' + adresse);
      return true;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      disable(msg.includes('Cannot find module') || msg.includes('did not initialize')
        ? 'Prisma-Client nicht erzeugt (npm run db:setup)'
        : msg);
      return false;
    }
  }

  /**
   * Ein Schreibvorgang. Faengt ALLES ab: Ein Datenbankfehler darf den
   * Hintergrundlauf nicht abbrechen, sonst bliebe der Rest der Meldungen liegen.
   */
  async function guarded(what, fn) {
    if (state !== 'ready' && !(await connect())) return { ok: false, skipped: true };
    try {
      await fn(client);
      return { ok: true };
    } catch (e) {
      counts.errors++;
      const msg = (e && e.message) || String(e);
      log.warn?.(`ApoPulse DB: ${what} nicht gespeichert — ${msg}`);
      // Verbindungsfehler (Datenbank weg/Netz weg) schalten den Spiegel ab,
      // damit nicht jede einzelne Zeile in denselben Zeitablauf laeuft.
      if (/P10\d\d|ECONNREFUSED|ETIMEDOUT|terminating connection/i.test(msg)) {
        disable('Verbindung verloren: ' + msg);
      }
      return { ok: false, error: msg };
    }
  }

  return {
    get state() { return state; },
    get reason() { return disabledReason; },
    connect,

    /**
     * Eine Behoerdenmeldung ablegen. Schluessel ist der Link — dieselbe Meldung
     * im naechsten Fuenf-Minuten-Takt aktualisiert die Zeile, statt sie zu
     * verdoppeln.
     */
    async saveNews(item) {
      if (!item || !item.link || !item.title) return { ok: false, skipped: true };
      const data = {
        title: String(item.title).slice(0, 500),
        summary: item.summary ? String(item.summary).slice(0, 4000) : null,
        source: String(item.source || item.sourceId || 'unbekannt'),
        country: String(item.country || 'EU').toUpperCase().slice(0, 2),
        publishedAt: toDate(item.publishedAt),
        sourceId: item.sourceId ? String(item.sourceId) : null,
      };
      const res = await guarded(`News "${data.title.slice(0, 60)}"`, (c) => c.newsPost.upsert({
        where: { link: String(item.link) },
        // Beim erneuten Sehen wird der Inhalt aufgefrischt (Behoerden
        // korrigieren Meldungen), aber `fetchedAt` bleibt der ERSTE Fund —
        // sonst saehe jede alte Meldung nach jedem Takt taufrisch aus.
        update: withoutNulls({ title: data.title, summary: data.summary, publishedAt: data.publishedAt }),
        create: { ...data, link: String(item.link) },
      }));
      if (res.ok) counts.newsUpserts++;
      return res;
    },

    /**
     * Engpaesse ablegen. Schluessel ist Praeparat + Land (@@unique im Schema) —
     * das ist die Duplikatspruefung, die der Owner verlangt hat.
     */
    async saveShortages(rows, { source = 'unbekannt', country = 'AT', provenance = 'verified' } = {}) {
      const list = Array.isArray(rows) ? rows : [];
      let written = 0;
      for (const r of list) {
        const drugName = String(r.bezeichnung || r.drugName || r.wirkstoff || '').trim();
        if (!drugName) continue; // ohne Praeparatnamen ist die Zeile wertlos
        const cc = String(r.land || r.country || country || 'AT').toUpperCase().slice(0, 2);
        const data = {
          activeSubst: (r.wirkstoff || r.activeSubst) ? String(r.wirkstoff || r.activeSubst) : null,
          status: toShortageStatus(r.status),
          reason: (r.grund || r.reason) ? String(r.grund || r.reason).slice(0, 2000) : null,
          source: String(r.quelle || r.source || source),
          provenance: toProvenance(r.provenance || provenance),
          reportedAt: toDate(r.gemeldet_am || r.reportedAt),
          expectedEnd: toDate(r.voraussichtlich_bis || r.expectedEnd),
        };
        const res = await guarded(`Engpass "${drugName}"`, (c) => c.shortage.upsert({
          where: { drugName_country: { drugName, country: cc } },
          // Beim Update NICHTS mit null überschreiben. `null` heißt hier „nicht
          // geliefert", nicht „nachweislich leer": Die Parser geben für ein
          // unlesbares oder fehlendes Datum bewusst null zurück. Ohne diese
          // Regel löschte ein Feed-Lauf ohne Meldedatum das bereits bekannte
          // Meldedatum — und niemand hätte es bemerkt.
          update: withoutNulls(data),
          create: { ...data, drugName, country: cc },
        }));
        if (res.ok) { written++; counts.shortageUpserts++; }
        if (state === 'disabled') break; // Verbindung weg — Rest hat keinen Zweck
      }
      return { ok: state !== 'disabled', written, received: list.length };
    },

    // ── VerifiedSignal ───────────────────────────────────────────────────────
    //  Hier ist der Spiegel KEIN Zusatz, sondern die dauerhafte Ablage: Die
    //  Signale lagen bisher ausschliesslich im Arbeitsspeicher und waren nach
    //  jedem Deploy weg — anders als News und Engpaesse, die ihre Tabelle
    //  haben. Nach vier Stunden Sammeln ein leerer Signal-Feed.
    //
    //  Was weiterhin gilt: Faellt die Datenbank aus, laeuft der Dienst. Der
    //  Speicher bleibt die Lesequelle, die Datenbank haelt den Bestand und
    //  fuellt ihn beim Start zurueck (restoreSignalsFromDb in http/server.js).

    /**
     * Ein Signal ablegen. Schluessel ist `dedupeKey` (Quelle + Original-Adresse,
     * `@unique` im Schema) — genau die Deduplizierung, die der Auftrag verlangt:
     * derselbe Behoerdenhinweis im naechsten Fuenf-Minuten-Takt aktualisiert die
     * Zeile, statt eine zweite anzulegen.
     */
    async saveSignal(signal) {
      if (!signal || !signal.dedupeKey || !signal.originalUrl || !signal.sourceName) {
        return { ok: false, skipped: true, reason: 'Herkunft unvollstaendig' };
      }
      const data = {
        title: String(signal.title).slice(0, 500),
        summary: signal.summary ? String(signal.summary).slice(0, 2000) : null,

        // ── Herkunfts-Proof. Kommt mechanisch aus dem Abruf, NIE aus der KI. ──
        originalUrl: String(signal.originalUrl),
        sourceName: String(signal.sourceName),
        sourceId: signal.sourceId ? String(signal.sourceId) : null,

        country: String(signal.country || '').toUpperCase().slice(0, 2),
        language: String(signal.language || 'de').slice(0, 8),
        category: String(signal.category || 'NEWS').toUpperCase(),

        wirkstoff: signal.wirkstoff || null,
        handelsname: signal.handelsname || null,
        schweregrad: signal.schweregrad || null,
        ursache: signal.ursache || null,
        gueltigVon: toDate(signal.gueltigVon),
        gueltigBis: toDate(signal.gueltigBis),

        summaryDe: signal.summaryDe || null,
        summaryEn: signal.summaryEn || null,
        summaryPt: signal.summaryPt || null,
        rawPayload: signal.rawPayload || null,

        confidenceScore: Number(signal.confidenceScore) || 0,
        publishedAt: toDate(signal.publishedAt),
      };
      const res = await guarded(`Signal "${data.title.slice(0, 60)}"`, (c) => c.verifiedSignal.upsert({
        where: { dedupeKey: String(signal.dedupeKey) },
        // `verifiedAt` ist beim Update ABSICHTLICH nicht dabei: Es ist der
        // ERSTE Fund. Mitzuschreiben hiesse, dass jede alte Meldung bei jedem
        // Abruf wieder an die Spitze des Feeds wandert, obwohl sich nichts
        // geaendert hat. Dieselbe Regel wie im Speicher (services/signals.js).
        update: withoutNulls(data),
        create: {
          ...data,
          dedupeKey: String(signal.dedupeKey),
          verifiedAt: toDate(signal.verifiedAt) || new Date(),
        },
      }));
      if (res.ok) counts.signalUpserts = (counts.signalUpserts || 0) + 1;
      return res;
    },

    /**
     * Signale lesen — dieselben Filter wie der Speicher und wie die Indizes.
     *
     * `wirkstoff` sucht als Teilzeichenkette ueber Wirkstoff UND Handelsname,
     * damit „amoxi" sowohl „amoxicillin" als auch „Amoxi-saar" findet. Das
     * entspricht dem Verhalten von `createSignalStore().list()` — zwei
     * Lesequellen mit unterschiedlicher Trefferlogik waeren ein Fehler, den
     * niemand findet, weil beide „funktionieren".
     */
    async listSignals({ country = null, category = null, wirkstoff = null, limit = 200 } = {}) {
      const take = clampLimit(limit, { fallback: 200, max: 500 });
      const where = {};
      if (country) where.country = String(country).toUpperCase();
      if (category) where.category = String(category).toUpperCase();
      if (wirkstoff) {
        const q = String(wirkstoff).trim();
        where.OR = [
          { wirkstoff: { contains: q, mode: 'insensitive' } },
          { handelsname: { contains: q, mode: 'insensitive' } },
        ];
      }
      let rows = [];
      const res = await guarded('Signal-Liste', async (c) => {
        rows = await c.verifiedSignal.findMany({ where, orderBy: { verifiedAt: 'desc' }, take });
      });
      return res.ok ? { ok: true, rows } : { ok: false, rows: [], error: res.error || null, skipped: res.skipped };
    },

    /**
     * Eine Zahlung spiegeln.
     *
     * Schluessel ist die Zahlungs-ID der Anwendung — derselbe Vorgang in einem
     * spaeteren Zustand (pending -> paid) aktualisiert die Zeile.
     *
     * EHRLICHE EINORDNUNG, wie beim Rest dieses Moduls: Die Freischaltung
     * haengt NICHT an dieser Tabelle. Sie geschieht im Repo, und der Spiegel
     * laeuft danach. Faellt die Datenbank aus, bekommt die Apotheke ihr Premium
     * trotzdem — sie hat ja bezahlt. Was dann fehlt, ist die dauerhafte
     * Buchungszeile, nicht die Leistung.
     *
     * `counts.transactionUpserts` macht im Status sichtbar, ob hier etwas
     * ankommt. Ohne Zaehler waere „keine Zahlungen" von „Spiegel schreibt
     * nicht" nicht zu unterscheiden.
     */
    async saveTransaction(payment) {
      if (!payment || !payment.id || !payment.user_id) return { ok: false, skipped: true };
      const paymentMethod = toPaymentMethod(payment.method);
      const provider = toPaymentProvider(payment.provider);
      const status = toPaymentStatus(payment.status);
      if (!paymentMethod || !provider || !status) {
        // Lieber eine Luecke als eine falsche Buchung. Laut, damit ein neuer
        // Bezahlweg beim ersten Mal auffaellt und nicht in Monaten.
        log.warn?.('ApoPulse DB: Zahlung nicht gespiegelt — unbekannte Werte '
          + `(method=${payment.method}, provider=${payment.provider}, status=${payment.status}). `
          + 'Zuordnung in repo/prismaStore.js ergaenzen.');
        return { ok: false, skipped: true, reason: 'unbekannte Werte' };
      }

      const data = {
        userId: String(payment.user_id),
        productId: String(payment.product_id || 'unbekannt'),
        feature: payment.feature ? String(payment.feature) : null,
        amountMinor: Math.max(0, Math.round(Number(payment.amount_cents) || 0)),
        currency: String(payment.currency || 'EUR').toUpperCase().slice(0, 3),
        paymentMethod, provider, status,
        providerRef: payment.provider_ref ? String(payment.provider_ref) : null,
        paypalOrderId: provider === 'PAYPAL' && payment.provider_ref ? String(payment.provider_ref) : null,
        coin: payment.coin ? String(payment.coin) : null,
        walletId: payment.wallet_id ? String(payment.wallet_id) : null,
        txRef: payment.tx_ref ? String(payment.tx_ref) : null,
        paidAt: toDate(payment.paid_at),
      };
      const res = await guarded(`Zahlung ${payment.id}`, (c) => c.transaction.upsert({
        where: { id: String(payment.id) },
        // Beim Update NICHTS mit null ueberschreiben: Eine spaetere
        // Zustandsmeldung fuehrt nicht zwingend alle Felder mit, und ein
        // bereits bekannter Transaktionsbeleg darf dabei nicht verloren gehen.
        update: withoutNulls(data),
        create: { ...data, id: String(payment.id) },
      }));
      if (res.ok) counts.transactionUpserts = (counts.transactionUpserts || 0) + 1;
      return res;
    },

    // ── Lesen ────────────────────────────────────────────────────────────────
    //  Ab hier ist der Spiegel nicht mehr nur ein Endlager. Der Nutzen liegt
    //  genau nach einem Deploy: Der Arbeitsspeicher ist dann leer, die
    //  Datenbank haelt aber die Meldungen der letzten Wochen.

    /**
     * Behoerden-Meldungen lesen, optional nach Land.
     *
     * Zur Sortierung: `publishedAt` ist nullbar, und PostgreSQL stellt NULL bei
     * DESC standardmaessig NACH VORN. Ohne `nulls: 'last'` stuenden also
     * ausgerechnet die Meldungen ohne Datum ganz oben im Feed — dieselbe
     * erfundene Aktualitaet, die wir beim Schreiben vermeiden, waere beim Lesen
     * durch die Hintertuer wieder da.
     */
    async listNews({ country = null, limit = 50 } = {}) {
      const take = clampLimit(limit, { fallback: 50, max: 200 });
      const where = country ? { country } : {};
      let rows = [];
      const res = await guarded('News-Liste', async (c) => {
        rows = await c.newsPost.findMany({
          where,
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }],
          take,
        });
      });
      return res.ok ? { ok: true, rows } : { ok: false, rows: [], error: res.error || null, skipped: res.skipped };
    },

    /** Engpaesse lesen, optional nach Land. Kritische zuerst — das ist die Frage,
     *  mit der jemand diese Liste oeffnet. */
    async listShortages({ country = null, limit = 200 } = {}) {
      const take = clampLimit(limit, { fallback: 200, max: 500 });
      const where = country ? { country } : {};
      let rows = [];
      const res = await guarded('Engpass-Liste', async (c) => {
        rows = await c.shortage.findMany({ where, orderBy: { updatedAt: 'desc' }, take });
      });
      const rank = { CRITICAL: 0, LIMITED: 1, AVAILABLE: 2 };
      rows.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
        || new Date(b.updatedAt) - new Date(a.updatedAt));
      return res.ok ? { ok: true, rows } : { ok: false, rows: [], error: res.error || null, skipped: res.skipped };
    },

    // ── Gesamtzustand sichern ────────────────────────────────────────────────
    //  Der Grund steht im Schema bei `model AppSnapshot`: Auf dem kostenlosen
    //  Render-Tarif loeschte jeder Deploy nicht nur die News, sondern JEDES
    //  KONTO. Hier liegt der komplette Zustand als ein gepackter Blob —
    //  ausdruecklich ein Zwischenschritt, kein Ersatz fuer richtige Tabellen.

    /**
     * Zustand sichern. `obj` ist das Ergebnis von collectSnapshot().
     *
     * Gepackt, weil es rund 30 % der Rohgroesse sind und der Inhalt in der
     * Datenbank nie durchsucht wird.
     */
    async saveSnapshot(obj) {
      let payload;
      try {
        const roh = Buffer.from(JSON.stringify(obj), 'utf8');
        payload = { data: gzipSync(roh), rawSize: roh.length };
      } catch (e) {
        // Ein nicht serialisierbarer Zustand ist ein Programmfehler, kein
        // Datenbankproblem — er darf hier nicht als "Datenbank kaputt" enden.
        log.warn?.(`ApoPulse DB: Zustand nicht serialisierbar — ${(e && e.message) || e}`);
        return { ok: false, error: 'nicht serialisierbar' };
      }
      const res = await guarded('Zustandssicherung', (c) => c.appSnapshot.upsert({
        where: { id: 'main' },
        update: payload,
        create: { id: 'main', ...payload },
      }));
      if (res.ok) {
        counts.snapshotSaves++;
        counts.snapshotBytes = payload.data.length;
        counts.snapshotRawSize = payload.rawSize;
      }
      return res;
    },

    /** Zustand laden. `null`, wenn keiner da ist oder die Datenbank schweigt. */
    async loadSnapshot() {
      let row = null;
      const res = await guarded('Zustand lesen', async (c) => {
        row = await c.appSnapshot.findUnique({ where: { id: 'main' } });
      });
      if (!res.ok || !row) return null;
      try {
        const obj = JSON.parse(gunzipSync(Buffer.from(row.data)).toString('utf8'));
        return { data: obj, updatedAt: row.updatedAt, rawSize: row.rawSize };
      } catch (e) {
        // Kaputter Blob: NICHT werfen. Die App startet dann mit dem
        // Datei-Snapshot bzw. leer weiter — das ist immer noch besser, als
        // wegen einer unlesbaren Sicherung gar nicht hochzukommen.
        log.warn?.(`ApoPulse DB: Zustandssicherung unlesbar — ${(e && e.message) || e}. `
          + 'Start ohne sie.');
        return null;
      }
    },

    /**
     * Fuer GET /api/live/status — sonst weiss niemand, ob der Spiegel laeuft.
     *
     * Verbindet BEI BEDARF. Ohne das staende direkt nach einem Deploy „idle"
     * dort, bis der erste Hintergrundlauf kommt — und genau dann schaut jemand
     * nach, ob die neu angehaengte Datenbank funktioniert. Eine Statusansicht,
     * die auf „laeuft es?" mit „weiss ich noch nicht" antwortet, beantwortet
     * die Frage nicht. Der Versuch laeuft hoechstens einmal: danach steht der
     * Zustand auf `ready` oder `disabled`.
     */
    async stats() {
      if (state === 'idle') await connect();
      const base = { state, reason: disabledReason, ...counts };
      if (state !== 'ready') return base;
      const res = await guarded('Zaehlstand', async (c) => {
        base.newsRows = await c.newsPost.count();
        base.shortageRows = await c.shortage.count();
        base.signalRows = await c.verifiedSignal.count();
        base.transactionRows = await c.transaction.count();
      });
      if (!res.ok) base.countError = res.error || 'nicht lesbar';
      return base;
    },

    async disconnect() {
      if (client && client.$disconnect) { try { await client.$disconnect(); } catch { /* egal */ } }
      client = null;
      if (state === 'ready') state = 'idle';
    },
  };
}
