// Dünne HTTP-API + statisches Frontend für den Social-Feed (Priorität 1).
// Node-Built-ins only. Baut auf der getesteten Domänen-/Service-Schicht auf.
// In-Memory-Persistenz (Neustart = leer) — Postgres kommt hinter denselben
// Repository-Seam (Phase 6).
// ZUERST: alte Variablennamen (APOTREND_*) auf die neuen spiegeln. Muss vor
// allen anderen Importen stehen — manche Module lesen ihre Werte beim Laden
// (z. B. http/token.js). ESM wertet Importe in Quelltextreihenfolge aus.
import '../env-compat.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createMemoryRepo } from '../repo/memoryRepo.js';
import { createSocialRepo } from '../repo/socialRepo.js';
import { createShortagesRepo } from '../repo/shortagesRepo.js';
import { createPricesRepo } from '../repo/pricesRepo.js';
import { createRabatteRepo } from '../repo/rabatteRepo.js';
import { createExchangeRepo } from '../repo/exchangeRepo.js';
import { createPersistence } from '../repo/persistence.js';
import { createOrgAuthService, ForbiddenError } from '../services/orgAuth.js';
import { createCollabService } from '../services/collab.js';
import { can as roleCan } from '../domain/roles.js';
import { cleanSourceUrl } from '../domain/media.js';
import { createSocialService } from '../services/social.js';
import { createShortagesService } from '../services/shortages.js';
import { createPricesService } from '../services/prices.js';
import { createRabatteService } from '../services/rabatte.js';
import { createExchangeService } from '../services/exchange.js';
import { createSearchService } from '../services/search.js';
import { createRxNormService } from '../services/rxnorm.js';
import { createOverviewService } from '../services/overview.js';
import { createOAuthService, buildProvidersFromEnv } from '../services/oauth.js';
import { createPaymentsService, buildPaymentProvidersFromEnv } from '../services/payments.js';
import { createCryptoRates } from '../services/cryptoRates.js';
import { createFxRates } from '../services/fxRates.js';
import { cryptoWallets, paymentRoutes } from '../data/cryptoWallets.js';
import { listProducts, getProduct } from '../data/products.js';
import { createAmrService } from '../services/amr.js';
import { createPatientInfoService } from '../services/patientInfo.js';
import { COUNTRIES, DEFAULT_COUNTRY, isValidCountry, listCountries, normalizeCountry, normalizeLocale } from '../data/countries.js';
import { countryConfig, featureStatus, isFeatureBlocked } from '../data/countryFeatures.js';
import {
  availablePurposes, calculateFee, checkoutFieldsFor, complianceProfile,
  feeModel, paymentMethodsFor, PURPOSES, PURPOSE_LABELS,
} from '../domain/compliance.js';
import { plansForCountry, priceFor } from '../data/plans.js';
import { isLive, isPriceLive, isRabatteLive, liveSources, livePriceSources, liveRabatteSources, refreshShortages, refreshPrices, refreshRabatte, fetchJsonDefault } from '../services/liveData.js';
import { createScheduler, INTERVALS } from '../services/scheduler.js';
import { createNewsSeenStore, ingestNews } from '../services/newsIngest.js';
import { activeSources, sourcesByKind, shortagesFromCsv, shortagesFromJson, dedupeShortages, fetchTextDefault, fetchSource, newsKey } from '../services/sources.js';
import { createDealsService, seedDemoDealsIfNoneRunning } from '../services/deals.js';
import { createPrismaStore } from '../repo/prismaStore.js';
import { listAccountTypes, normalizeAccountType } from '../data/accountTypes.js';
import { issueToken, verifyToken } from './token.js';
import { createRateLimiter } from '../domain/rateLimiter.js';
import { dienstKennung } from './serviceIdentity.js';

// Login-Brute-Force-Schutz: max. 5 Fehlversuche je (IP+E-Mail) in 15 Minuten.
const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
// Passwort-Reset: eng begrenzt, damit Wiederherstellungscodes nicht erraten werden.
const resetLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PORT = process.env.PORT || 4000;

// ── Persistenz (optional, über APOPULSE_DATA_FILE). Ohne die Variable: In-Memory. ──
const persistence = createPersistence(process.env.APOPULSE_DATA_FILE || null);
const snapshot = persistence ? persistence.load() : null;
// Bereits verarbeitete Behörden-Meldungen. Muss den Neustart überleben, sonst
// legt der Server nach jedem Deploy dieselben News-Beiträge erneut an.
const newsSeen = createNewsSeenStore();
const restoring = !!snapshot;

// ── PostgreSQL-Spiegel (optional, über DATABASE_URL) ──────────────────────────
// Hält die automatisch geholten Live-Daten dauerhaft. Ohne die Variable ist das
// hier `null` und die App verhält sich exakt wie bisher — siehe repo/prismaStore.js
// und docs/DATENBANK.md. Auf dem kostenlosen Render-Tarif ist das Dateisystem
// flüchtig; ohne Datenbank ist alles Gesammelte nach jedem Deploy weg.
const db = createPrismaStore();

// ── Dienste (einmalig) ──
const repo = createMemoryRepo();
const orgAuth = createOrgAuthService(repo);
const collab = createCollabService(repo, orgAuth);
const socialRepo = createSocialRepo();
// Moderatoren = Redaktions-/Admin-Konten (Profil-Flag is_editorial).
const social = createSocialService(socialRepo, repo, {
  isModerator: (userId) => { const p = socialRepo.getProfileByUserId(userId); return !!(p && p.is_editorial); },
});
// Marktdaten nur beim Frischstart seeden; beim Wiederherstellen kommen sie aus dem Snapshot.
const shortagesRepo = createShortagesRepo({ seed: !restoring });
const shortages = createShortagesService(shortagesRepo, social, { hasPremium: (userId) => payments.hasFeature(userId, 'premium') });
const pricesRepo = createPricesRepo({ seed: !restoring });
const rabatteRepo = createRabatteRepo({ seed: !restoring });
// Rabatte in den Preisvergleich einblenden: eine laufende Aktion kann günstiger
// sein als der beste AEP — das soll der Einkauf an einer Stelle sehen.
const prices = createPricesService(pricesRepo, social, rabatteRepo);
const rabatte = createRabatteService(rabatteRepo, social);
const exchangeRepo = createExchangeRepo();
const exchange = createExchangeService(exchangeRepo, social, repo, shortagesRepo);
// RxNorm ergaenzt die Suche um Namensvarianten (Wirkstoff <-> Handelsname).
// Abschaltbar ueber APOPULSE_RXNORM=off — der Dienst geht ins Netz, und wer
// das nicht will, soll es nicht muessen. Ohne ihn sucht die Anwendung wie
// bisher; die Ergaenzung kann die Suche nur besser machen, nie schlechter.
const rxnorm = String(process.env.APOPULSE_RXNORM || '').toLowerCase() === 'off'
  ? null
  : createRxNormService();
const search = createSearchService({ social, shortagesRepo, pricesRepo, rabatteRepo, exchange, rxnorm });
const amr = createAmrService();
const overview = createOverviewService({ shortages, exchange, social, rabatte, prices, amr });
const patientInfo = createPatientInfoService();
// Social-Login: Provider nur aktiv, wenn Zugangsdaten als Umgebungsvariablen vorliegen.
const oauth = createOAuthService({ repo, social, providers: buildProvidersFromEnv() });
// Zahlungen: Anbieter (Stripe/Coinbase) nur aktiv, wenn eigene, verifizierte Schlüssel
// als ENV-Variablen vorliegen. onPaid = Haken für die Bestätigungs-Mail (Mailversand
// braucht einen eigenen Anbieter; hier bewusst nur ein Log statt eines Fake-Versands).
const cryptoRates = createCryptoRates();
const fxRates = createFxRates();
const payments = createPaymentsService({
  repo,
  providers: buildPaymentProvidersFromEnv(),
  wallets: cryptoWallets, // Direkt-in-Wallet: eigene, öffentliche Empfangsadressen (ENV-überschreibbar)
  rates: cryptoRates,
  fx: fxRates, // für die Näherung des Preises in der Landeswährung
  isModerator: (userId) => social.isModerator(userId),
  onPaid: ({ payment, product }) => { console.log(`✅ Zahlung ${payment.id} bezahlt → Feature „${product.feature}" für User ${payment.user_id} freigeschaltet.`); },
});

/** Einen Snapshot in alle Repos einspielen. Eine Stelle, zwei Quellen. */
function applySnapshot(snap) {
  repo.__load(snap.foundation);
  socialRepo.__load(snap.social);
  shortagesRepo.__load(snap.shortages);
  pricesRepo.__load(snap.prices);
  rabatteRepo.__load(snap.rabatte);
  exchangeRepo.__load(snap.exchange);
  newsSeen.__load(snap.newsSeen);
}

if (restoring) {
  applySnapshot(snapshot);
  console.log(`ApoPulse: Daten aus ${persistence.filePath} wiederhergestellt.`);
} else {
  // Redaktions-/Admin-Account (zugleich Moderation) + kuratierte News — nur beim
  // Frischstart. Zugangsdaten über ENV steuerbar; sonst zufälliges Passwort, das
  // beim Start einmalig geloggt wird, damit sich die Redaktion anmelden kann.
  const adminEmail = process.env.APOPULSE_ADMIN_EMAIL || 'redaktion@apopulse.at';
  const adminPassword = process.env.APOPULSE_ADMIN_PASSWORD || crypto.randomUUID();
  const red = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'ApoPulse' }, owner: { name: 'ApoPulse-Redaktion', email: adminEmail, password: adminPassword } });
  social.createProfile(red.user.id, { handle: 'apopulse', displayName: 'ApoPulse-Redaktion', isEditorial: true });
  if (!process.env.APOPULSE_ADMIN_PASSWORD) console.log(`ℹ️  Redaktions-/Moderations-Login: ${adminEmail} / ${adminPassword}`);
  [
    { body: 'Kammer-Mitteilung: Neue Regelung zur E-Medikation tritt am 01.08.2026 in Kraft.', sourceUrl: 'https://www.apothekerkammer.at/' },
    { body: 'BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika betroffen.', sourceUrl: 'https://www.basg.gv.at/' },
    { body: 'Gehaltskasse: Anpassung der Großhandelskonditionen zum Quartalswechsel.', sourceUrl: 'https://www.gehaltskasse.at/' },
  ].forEach(({ body, sourceUrl }) => social.createPost(red.user.id, { body, kind: 'news', sourceUrl }));
  // Starter-Beitrag fürs Stewardship-Fachforum (setzt Ton & Regeln, quellenbelegt).
  social.createPost(red.user.id, {
    body: 'Willkommen im Stewardship-Fachforum 🧫 — anonymisierte Fachdiskussion zum verantwortungsvollen Antibiotikaeinsatz. Bitte keine personenbezogenen Patientendaten posten, sicherheitsrelevante Aussagen nur mit Quelle. Grundlage zur österreichischen Resistenzlage: AURES. #stewardship',
    kind: 'post', sourceUrl: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen',
  });
  // Länder-Redaktionen (DE/BR) + je ein News-Beitrag im jeweiligen Land, damit der
  // Länder-Switch echte, getrennte Inhalte zeigt. Beiträge erben das Land des Autors.
  const seedCountryEditor = (country, handle, name, posts) => {
    const u = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: handle + '@apopulse.example', password: crypto.randomUUID() } });
    social.createProfile(u.user.id, { handle, displayName: name, isEditorial: true, country });
    posts.forEach(({ body, sourceUrl }) => social.createPost(u.user.id, { body, kind: 'news', sourceUrl }));
  };
  seedCountryEditor('DE', 'apopulse_de', 'ApoPulse-Redaktion DE', [
    { body: 'BfArM: Aktualisierte Liste von Lieferengpässen veröffentlicht — mehrere Wirkstoffe betroffen.', sourceUrl: 'https://www.bfarm.de/' },
    { body: 'E-Rezept: bundesweite Nutzung weiter verpflichtend — Hinweise für Apotheken aktualisiert.', sourceUrl: 'https://www.bfarm.de/' },
  ]);
  seedCountryEditor('BR', 'apopulse_br', 'ApoPulse-Redação BR', [
    { body: 'ANVISA: publicada atualização sobre desabastecimento de medicamentos.', sourceUrl: 'https://www.gov.br/anvisa/' },
  ]);
}

// ── Snapshot sammeln + gedrosselt/atomar auf Platte schreiben ──
function collectSnapshot() {
  return {
    foundation: repo.__dump(), social: socialRepo.__dump(),
    shortages: shortagesRepo.__dump(), prices: pricesRepo.__dump(), rabatte: rabatteRepo.__dump(),
    exchange: exchangeRepo.__dump(), newsSeen: newsSeen.__dump(),
  };
}
let saveTimer = null;
function saveSoon() {
  saveToDbSoon(); // unabhaengig von der Datei: die Datenbank ist der Deploy-Schutz
  if (!persistence) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { persistence.save(collectSnapshot()); } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); } }, 400);
}
function saveNow() { if (persistence) { try { persistence.save(collectSnapshot()); } catch { /* egal */ } } }

// ── Zustandssicherung in der Datenbank ────────────────────────────────────
//  EIGENER, LANGSAMERER TAKT als die Datei. Die Datei wird alle 400 ms
//  geschrieben — das ist billig und lokal. Denselben Takt gegen Postgres zu
//  fahren hiesse, bei jeder Interaktion ein gepacktes Abbild des gesamten
//  Zustands ueber das Netz zu schicken. 20 Sekunden reichen: Diese Sicherung
//  soll einen DEPLOY ueberleben, nicht die letzte Sekunde vor einem Absturz.
//  Fuer Letzteres ist die Datei da.
const DB_SNAPSHOT_INTERVAL_MS = 20_000;
let dbSaveTimer = null;
let dbSavePending = false;

function saveToDbSoon() {
  if (!db || dbSaveTimer) return;
  dbSavePending = true;
  dbSaveTimer = setTimeout(async () => {
    dbSaveTimer = null;
    dbSavePending = false;
    await db.saveSnapshot(collectSnapshot()).catch(() => {}); // Store meldet selbst
  }, DB_SNAPSHOT_INTERVAL_MS);
  if (dbSaveTimer.unref) dbSaveTimer.unref();
}
if (persistence && !restoring) saveNow(); // Ausgangszustand (Seed) sofort sichern
// Sauber speichern beim Herunterfahren (z.B. Deploy/Neustart auf dem Host).
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  saveNow(); // Datei: synchron, sofort fertig
  // Datenbank: Render schickt beim Deploy SIGTERM und wartet nur kurz. Ohne
  // dieses Abwarten ginge genau der Stand verloren, den die Sicherung retten
  // soll — der letzte vor dem Deploy. Mit Deckel, damit eine haengende
  // Datenbank das Herunterfahren nicht blockiert.
  if (!db) return process.exit(0);
  let fertig = false;
  const raus = () => { if (!fertig) { fertig = true; process.exit(0); } };
  const notbremse = setTimeout(raus, 4000);
  if (notbremse.unref) notbremse.unref();
  db.saveSnapshot(collectSnapshot()).catch(() => {}).finally(() => { clearTimeout(notbremse); raus(); });
});

/**
 * Wie dauerhaft sind die Daten wirklich?
 *
 * Diese Einstufung gibt es, weil die frühere Meldung IRREFÜHREND war: Sie
 * sagte „Persistenz aktiv", sobald ein Dateipfad gesetzt war — auch dann, wenn
 * diese Datei auf flüchtigem Speicher lag. Auf dem kostenlosen Render-Tarif
 * ist genau das der Fall: Die Datei überlebt einen Prozess-Neustart, aber
 * KEIN Deploy. Der Owner hat den Verlust deshalb erst gemerkt, als er sich neu
 * registrieren musste. Eine Anwendung, die still Daten verliert, ist schlimmer
 * als eine, die es sagt.
 *
 * Absichtlich wird hier NICHT geraten, ob eine dauerhafte Platte gemountet
 * ist — das lässt sich von innen nicht zuverlässig feststellen. Stattdessen
 * wird benannt, was sicher gilt: Nur die Datenbank überlebt ein Deploy
 * garantiert.
 */
function durabilityReport() {
  const db_an = !!db;
  const datei = persistence ? persistence.filePath : null;
  const warnings = [];
  const wer = dienstKennung();
  let level, summary;

  if (db_an) {
    level = 'sicher';
    summary = 'Konten, Profile und Beiträge werden in PostgreSQL gesichert und überleben ein Deploy.';
  } else if (datei) {
    level = 'unvollständig';
    summary = `nur Datei (${datei}) — überlebt einen Neustart, aber NICHT zwingend ein Deploy.`;
    warnings.push('ApoPulse: KEINE Datenbank angebunden (DATABASE_URL fehlt). Die Snapshot-Datei '
      + 'liegt auf dem kostenlosen Render-Tarif auf flüchtigem Speicher: Nach dem nächsten '
      + 'Deploy sind ALLE Konten und Passwörter weg, und alle müssen sich neu registrieren. '
      + 'Abhilfe: In Render eine PostgreSQL-Instanz anlegen und ihre Internal Database URL '
      + 'als DATABASE_URL beim Web-Service eintragen (siehe docs/DATENBANK.md).'
      + wer);
  } else {
    level = 'flüchtig';
    summary = 'weder Datenbank noch Datei — alles geht schon beim Neustart verloren.';
    warnings.push('ApoPulse: WEDER DATABASE_URL NOCH APOPULSE_DATA_FILE gesetzt. Der Server '
      + 'hält alles nur im Arbeitsspeicher. Für den Produktivbetrieb ungeeignet.'
      + wer);
  }

  return {
    level,
    summary,
    database: db_an,
    snapshot_file: datei,
    survives_restart: db_an || !!datei,
    // Nur die Datenbank ist eine Zusage. Alles andere hängt daran, ob eine
    // dauerhafte Platte gemountet ist — und das ist von hier nicht prüfbar.
    survives_deploy: db_an,
    warnings,
  };
}

// Aktives Land für länder-gescopte Inhalte: expliziter Query-Parameter →
// Profil-Land der/des Nutzer:in → Fallback AT.
function activeCountry(userId, query) {
  const q = query && query.get && query.get('country');
  if (q) return normalizeCountry(q);
  const prof = userId ? social.getProfile(userId) : null;
  return normalizeCountry(prof && prof.country);
}

// Heimatland des Nutzers (Profil). Die Rechts-Zulässigkeit einer Funktion hängt an der
// EIGENEN Jurisdiktion — nicht am gerade „besuchten" Land. Deshalb ignoriert das Gate den
// ?country=-Query-Parameter (sonst ließe sich die Sperre durch Länder-Wechsel umgehen).
function userCountry(userId) {
  const prof = userId ? social.getProfile(userId) : null;
  return normalizeCountry(prof && prof.country);
}
// Anzeigename einer Nutzer-ID (für Team-Listen); null wenn unbekannt.
function userName(id) { const u = id ? repo.getUserById(id) : null; return u ? u.name : null; }
// Echtes Kalenderdatum (YYYY-MM-DD), das nicht überläuft (z.B. 2026-02-31 -> ungültig).
function isValidCalendarDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const MAX_TITLE = 120;
// Rechts-Gate: ist die Funktion im Heimatland des Nutzers hart gesperrt, mit HTTP 451
// ("Unavailable For Legal Reasons") abweisen. So kommen selbst bei direktem API-Aufruf
// keine Daten einer in diesem Land unzulässigen Funktion durch (UI blendet sie ohnehin aus).
function ensureFeatureAllowed(featureId, userId) {
  if (isFeatureBlocked(userCountry(userId), featureId)) {
    const e = new Error('Diese Funktion ist in deinem Land aus rechtlichen Gründen nicht verfügbar.');
    e.status = 451; e.code = 'feature_blocked_legal';
    throw e;
  }
}

// Feed-Beiträge, die ein Marktobjekt (Engpass/Preis/Rabatt) referenzieren, anreichern.
// Rechts-Gate (Heimatland): in Ländern mit gesperrten Modulen wird die betroffene
// Preis-/Rabatt-Vorschau NICHT angehängt — sonst würden Rabatt-/Preisdaten über
// referenzierende Beiträge in Feed/Suche an der Sperre vorbei sichtbar.
function enrichPosts(posts, userId) {
  const home = userCountry(userId);
  const dealsBlocked = isFeatureBlocked(home, 'deals');
  const priceBlocked = isFeatureBlocked(home, 'price_compare');
  return posts.map(p => {
    if (p.ref_type === 'shortage' && p.ref_id) {
      const s = shortagesRepo.get(p.ref_id);
      if (s) return { ...p, ref_summary: { kind: 'shortage', wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung, status: s.status } };
    }
    if (p.ref_type === 'price' && p.ref_id && !priceBlocked) {
      const pr = pricesRepo.get(p.ref_id);
      if (pr) return { ...p, ref_summary: { kind: 'price', bezeichnung: pr.bezeichnung, supplier: pr.supplier, aep: pr.aep, currency: pr.currency, trend_pct: pr.trend_pct } };
    }
    if (p.ref_type === 'rabatt' && p.ref_id && !dealsBlocked) {
      const r = rabatteRepo.get(p.ref_id);
      if (r) return { ...p, ref_summary: { kind: 'rabatt', bezeichnung: r.bezeichnung, supplier: r.supplier, aktionspreis: r.aktionspreis, listenpreis: r.listenpreis, currency: r.currency, rabatt_pct: r.rabatt_pct, gueltig_bis: r.gueltig_bis } };
    }
    return p;
  });
}

// ── kleine Helfer ──
const json = (req, res, code, obj) => {
  const payload = Buffer.from(JSON.stringify(obj));
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  // Größere JSON-Antworten (Feed, Preise) gzip-komprimieren, wenn der Client es kann —
  // spart Bandbreite bei jeder Navigation. Kleine Antworten lohnen die CPU nicht.
  if (payload.length > 512 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const gz = zlib.gzipSync(payload);
    res.writeHead(code, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    res.end(gz);
  } else {
    res.writeHead(code, headers);
    res.end(payload);
  }
};
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); // 2 MB (Bilder als data-URL)
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const userIdFrom = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
// Nutzerobjekt vor der Auslieferung von Geheimnissen befreien (Passwort-Hash,
// 2FA-Geheimnis, Wiederherstellungs-Hashes gehören nie in eine API-Antwort).
const safeUser = (u) => { if (!u) return u; const { password_hash, twofa_secret, recovery_hashes, ...rest } = u; return rest; };

// Route-Tabelle: [method, regex, authRequired, handler(ctx)]
// ============================================================================
//  Automatische Datenaufnahme — Aufgaben
// ============================================================================

const scheduler = createScheduler();

// Aktionen/Rabatte, die Fachbetriebe selbst eintragen.
const deals = createDealsService({
  rabatteRepo,
  social,
  accountTypeOf: (userId) => {
    const p = social.getProfile(userId);
    return (p && p.account_type) || 'private';
  },
});

// Rückfall: Solange weder ein Feed noch eine eigene Aktion vorliegt, wird ein
// Demobestand angelegt — sichtbar als „simuliert" gekennzeichnet. Sobald etwas
// Echtes da ist, passiert hier nichts mehr (die Prüfung steckt in der Funktion).
if (process.env.NODE_ENV !== 'test' && process.env.APOPULSE_DEMO_DEALS !== 'off') {
  seedDemoDealsIfNoneRunning({ rabatteRepo });
}

/**
 * News-Durchlauf: Behörden-Feeds abrufen, neue Meldungen als Beiträge anlegen.
 *
 * Verfasser ist das Redaktionskonto. Jeder Beitrag trägt den Quell-Link —
 * CLAUDE.md verlangt für sicherheitsrelevante Aussagen eine Quelle, und eine
 * automatisch übernommene Behördenmeldung ist genau das.
 */
/**
 * Beim Start: den GESAMTEN Zustand aus der Datenbank holen.
 *
 * Das ist der Schutz gegen den teuersten Verlust: Auf dem kostenlosen
 * Render-Tarif ist das Dateisystem flüchtig, und nach jedem Deploy waren nicht
 * nur die News weg, sondern JEDES KONTO — jede Apotheke hätte sich neu
 * registrieren müssen.
 *
 * Wird NUR angewandt, wenn kein Datei-Snapshot vorlag. Liegt einer vor (lokal,
 * oder Render mit dauerhafter Platte), ist er der frischere Stand: Die Datei
 * wird alle 400 ms geschrieben, die Datenbank alle 20 Sekunden. Den älteren
 * Stand über den neueren zu legen wäre Datenverlust mit Ansage.
 */
async function restoreStateFromDb() {
  if (restoring) {
    return { skipped: true, reason: 'Datei-Snapshot vorhanden und frischer' };
  }
  const gesichert = await db.loadSnapshot();
  if (!gesichert) return { skipped: true, reason: 'keine Sicherung in der Datenbank' };

  applySnapshot(gesichert.data);
  console.log(`ApoPulse: Zustand aus der Datenbank wiederhergestellt `
    + `(Stand ${new Date(gesichert.updatedAt).toISOString()}, ${gesichert.rawSize} Bytes roh). `
    + 'Konten, Profile und Beiträge haben den Neustart überlebt.');
  return { restored: true };
}

/**
 * Beim Start: Beiträge aus der Datenbank in den Speicher zurückholen.
 *
 * Der Grund steht in docs/DATENBANK.md: Auf dem kostenlosen Render-Tarif ist
 * das Dateisystem flüchtig. Nach jedem Deploy war der News-Feed leer, während
 * PostgreSQL die Meldungen der letzten Wochen hielt — gesammelt, gespeichert
 * und für niemanden sichtbar.
 *
 * Zwei Dinge, auf die es dabei ankommt:
 *
 * 1. NICHTS DOPPELT. Bereits vorhandene Beiträge werden über ihren Quell-Link
 *    erkannt (Snapshot hat überlebt -> hier gibt es nichts zu tun). Und der
 *    Gesehen-Stand wird mit aufgefüllt, sonst legte der nächste Abruf in fünf
 *    Minuten jede wiederhergestellte Meldung ein zweites Mal an.
 * 2. NICHTS ERFINDEN. Übernommen wird, was in der Datenbank steht — Titel,
 *    Anriss, Link, Land, Quelle. Kein Datum wird ergänzt, keine Meldung
 *    umformuliert.
 */
async function restoreNewsFromDb({ limit = 200 } = {}) {
  const editor = social.getProfile('apopulse') || social.getProfile('apotrend');
  if (!editor) return { skipped: true, reason: 'Redaktionskonto fehlt' };

  const { ok, rows, error } = await db.listNews({ limit });
  if (!ok) return { skipped: true, reason: error || 'Datenbank nicht lesbar' };
  if (!rows.length) return { restored: 0, reason: 'Datenbank leer' };

  // Was schon im Speicher liegt, einmal einsammeln statt je Zeile zu suchen.
  const vorhanden = new Set(
    socialRepo.listPostsByAuthor(editor.user_id)
      .filter((p) => p.kind === 'news' && p.source_url)
      .map((p) => p.source_url),
  );

  let restored = 0;
  // Älteste zuerst anlegen, damit die Reihenfolge im Feed stimmt.
  for (const n of [...rows].reverse()) {
    if (!n.link || vorhanden.has(n.link)) continue;
    try {
      const body = n.summary && n.summary !== n.title ? `${n.title}\n\n${n.summary}` : n.title;
      social.createPost(editor.user_id, {
        body, kind: 'news', sourceUrl: n.link, visibility: 'public',
        sourceCountry: n.country,
      });
      // Als gesehen merken — sonst legt der nächste Abruf sie erneut an.
      if (n.sourceId) newsSeen.add(newsKey(n.sourceId, n.link));
      restored++;
    } catch (e) {
      // Eine unbrauchbare Zeile darf die übrigen nicht aufhalten.
      console.warn(`ApoPulse: Meldung aus der Datenbank übersprungen — ${(e && e.message) || e}`);
    }
  }

  if (restored) {
    saveSoon();
    console.log(`ApoPulse: ${restored} Meldung(en) aus der Datenbank in den Feed geholt `
      + `(${rows.length} gelesen, ${rows.length - restored} waren bereits vorhanden).`);
  }
  return { restored, read: rows.length };
}

async function runNewsIngest() {
  const editor = social.getProfile('apopulse');
  if (!editor) return { skipped: true, reason: 'Redaktionskonto fehlt' };

  const report = await ingestNews({
    seenStore: newsSeen,
    createPost: async (item) => {
      social.createPost(editor.user_id, {
        body: item.body,
        kind: 'news',
        sourceUrl: item.sourceUrl,
        visibility: 'public',
        // Land der QUELLE, nicht des Redaktionskontos.
        //
        // Vorher erbte jede Meldung das Land des Kontos, das sie anlegt — also
        // AT fuer alle. Damit landeten BfArM-, FDA- und ANVISA-Meldungen
        // saemtlich im oesterreichischen Feed, waehrend der deutsche und der
        // US-Feed leer blieben. Die neunzehn Laenderquellen aus der
        // Quellen-Runde waren damit fuer die Nutzer:innen unsichtbar.
        sourceCountry: item.country,
      });
      // Zusätzlich dauerhaft ablegen. Bewusst NACH dem Beitrag und in einem
      // eigenen try: Der Feed ist das, was die Nutzer:innen sehen — eine
      // klemmende Datenbank darf ihn nicht verhindern. Der Store fängt selbst
      // ab, das hier ist der zweite Riegel.
      if (db) { try { await db.saveNews(item); } catch { /* Store meldet selbst */ } }
    },
  });
  if (report.created > 0) saveSoon(); // neue Beiträge + Gesehen-Stand sichern
  return report;
}

/**
 * Engpass-Durchlauf.
 *
 * Zwei Wege, bewusst getrennt:
 *  · JSON-Vertrag je Land (APOPULSE_LIVE_SHORTAGES_<CC>) — der bestehende Weg
 *  · CSV-Export eines Registers (APOPULSE_SOURCE_<ID>_URL mit FORMAT=csv)
 *
 * Aus News-Schlagzeilen entstehen KEINE Engpass-Datensätze (siehe sources.js).
 */
/**
 * Feldzuordnung einer Quelle aus der Umgebung lesen.
 *
 *   APOPULSE_SOURCE_BASG_SHORTAGES_COLUMNS='{"bezeichnung":"nameDesArzneimittels"}'
 *
 * Der Grund ist praktisch: Benennt eine Behörde ein Feld um, muss dafür kein
 * Deploy stattfinden — die Zuordnung ist eine Umgebungsvariable. Ungültiges
 * JSON wird gemeldet und ignoriert, statt den ganzen Lauf zu kippen.
 */
/**
 * Länderfilter aus der Abfrage.
 *
 * `country.toUpperCase()` ungeprüft in die Abfrage zu reichen, wäre hier zwar
 * kein Einfallstor (Prisma parametrisiert), aber schlechte Auskunft: `?country=xx`
 * lieferte kommentarlos eine leere Liste, und die Nutzerin hielte das für „keine
 * Meldungen" statt für „Tippfehler". Unbekannte Codes werden deshalb abgewiesen.
 * `EU` ist zusätzlich erlaubt — die EMA ist keinem Land zugeordnet.
 */
function countryFilter(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null; // kein Filter = alle Länder
  if (raw === 'EU' || isValidCountry(raw)) return raw;
  const e = new Error(`Unbekannter Ländercode: ${raw}`);
  e.status = 400; e.code = 'unknown_country';
  throw e;
}

function dbNichtKonfiguriert() {
  const e = new Error('Für diese Ansicht ist keine Datenbank angebunden (DATABASE_URL fehlt).');
  e.status = 503; e.code = 'db_not_configured';
  return e;
}

function dbNichtErreichbar(detail) {
  // 503 statt 500: Das ist ein vorübergehender Zustand einer optionalen
  // Komponente, kein Programmfehler. Das Frontend soll erneut anfragen dürfen.
  const e = new Error('Die Datenbank ist gerade nicht erreichbar.' + (detail ? ` (${detail})` : ''));
  e.status = 503; e.code = 'db_unavailable';
  return e;
}

function sourceColumns(id) {
  const raw = process.env[`APOPULSE_SOURCE_${String(id).toUpperCase()}_COLUMNS`];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    console.warn(`ApoPulse Quellen: COLUMNS für ${id} ist kein gültiges JSON — ignoriert.`);
    return {};
  }
}

async function runShortageIngest() {
  const summary = { countries: [], prices: [], rabatte: [], csv: [], rejected: 0 };

  for (const cc of Object.keys(liveSources())) {
    const r = await refreshShortages(cc, { fetchJson: fetchJsonDefault, shortagesRepo });
    summary.countries.push({ country: cc, ok: !!r.ok, count: r.count ?? 0, error: r.error || null });
  }

  // Preise und Rabatte hängen an derselben Taktung. Sie liefen bisher über
  // startLiveRefresh mit; beim Umbau auf den Planer wären sie beinahe
  // liegengeblieben — ein stiller Ausfall, den niemand bemerkt hätte.
  for (const cc of Object.keys(livePriceSources())) {
    const r = await refreshPrices(cc, { fetchJson: fetchJsonDefault, pricesRepo });
    summary.prices.push({ country: cc, ok: !!r.ok, count: r.count ?? 0, error: r.error || null });
  }
  for (const cc of Object.keys(liveRabatteSources())) {
    const r = await refreshRabatte(cc, { fetchJson: fetchJsonDefault, rabatteRepo });
    summary.rabatte.push({ country: cc, ok: !!r.ok, count: r.count ?? 0, error: r.error || null });
  }

  // Strukturierte Engpass-Exporte (CSV und JSON). ERST alle einsammeln, DANN
  // einmal ersetzen: `replaceFeed` löscht den gesamten Nicht-Community-Bestand.
  // Bei zwei Quellen nacheinander aufgerufen, würde die zweite die Zeilen der
  // ersten wieder wegräumen — und der Bestand hinge davon ab, wer zuletzt
  // geantwortet hat.
  const gesammelt = [];
  const quellen = [];
  for (const source of sourcesByKind('shortages', process.env)) {
    if (source.format !== 'csv' && source.format !== 'json') continue;
    try {
      // Wie bei den News: wiederholen bei vorübergehenden Störungen,
      // ausweichen bei dauerhaften.
      const { raw } = await fetchSource(source);
      const columns = sourceColumns(source.id);
      const { rows, rejected } = source.format === 'json'
        ? shortagesFromJson(raw, { columns })
        : shortagesFromCsv(raw, { columns });
      gesammelt.push(...rows);
      if (rows.length) quellen.push(source.label || source.id);
      summary.csv.push({ id: source.id, format: source.format, count: rows.length, rejected: rejected.length });
      summary.rejected += rejected.length;
      // Verworfene Zeilen sichtbar machen: Ändert eine Behörde ihre Feldnamen,
      // liefert die Quelle weiter brav 200 OK und NULL brauchbare Zeilen. Ohne
      // diese Meldung fiele das erst auf, wenn jemand die leere Liste bemerkt.
      if (rejected.length && !rows.length) {
        console.warn(`ApoPulse Engpässe: ${source.id} lieferte ${rejected.length} Zeilen, `
          + `keine davon verwertbar. Erste Gründe: ${rejected.slice(0, 3).join('; ')}`);
      }
    } catch (e) {
      summary.csv.push({ id: source.id, format: source.format, error: (e && e.message) || String(e) });
    }
  }
  if (gesammelt.length) {
    const clean = dedupeShortages(gesammelt);
    shortagesRepo.replaceFeed(clean, { provenance: 'verified', quelle: quellen.join(', ') });
    summary.structured = { sources: quellen.length, rows: clean.length };
  }

  const änderungen = [...summary.countries, ...summary.prices, ...summary.rabatte].some((c) => c.ok)
    || summary.csv.some((c) => c.count);
  if (änderungen) saveSoon();

  // Engpässe dauerhaft ablegen. Bewusst der Endstand des Repos statt der
  // einzelnen Abrufe: `refreshShortages` schreibt direkt ins Repo und gibt die
  // Zeilen nicht zurück — den Endstand zu spiegeln erfasst dagegen ALLE Wege
  // (Länder-Feed, CSV, Community-Meldung) und kann keinen übersehen.
  // Der @@unique-Schlüssel (Präparat + Land) macht daraus ein Update statt
  // einer Kopie, deshalb ist das wiederholbar.
  //
  // Zum Land: Der In-Memory-Bestand führt KEIN Länderfeld — `replaceFeed`
  // ersetzt bei jedem Lauf den gesamten Nicht-Community-Bestand, der Speicher
  // ist also faktisch einländrig. Ist genau ein Engpass-Feed angeschlossen,
  // ist dessen Land das richtige; sonst bleibt es beim Standardland. Geraten
  // wird hier nichts — bei mehreren Feeds steht die Annahme im Bericht.
  if (db) {
    try {
      const feeds = Object.keys(liveSources());
      const country = feeds.length === 1 ? feeds[0] : DEFAULT_COUNTRY;
      const rows = shortagesRepo.list();
      const r = await db.saveShortages(rows, { source: 'ApoPulse-Automatik', country });
      summary.db = { written: r.written, received: r.received, country, assumed: feeds.length !== 1 };
    } catch (e) {
      summary.db = { error: (e && e.message) || String(e) };
    }
  }
  return summary;
}

const routes = [
  // Health-Check für Hosting-Plattformen (kein Auth, keine Daten).
  // `durability` ist hier absichtlich ÖFFENTLICH und absichtlich NUR die Stufe.
  //
  // Öffentlich, weil die Person, die sich registriert, die einzige ist, die den
  // Schaden trägt — und bisher die einzige war, die ihn nicht sehen konnte. Am
  // 05.09.2026 beantwortete ein Dienst OHNE Datenbank die Kundendomain: Im
  // Protokoll stand die Warnung, auf dem Anmeldebildschirm stand nichts. Wer
  // sich dort ein Passwort angelegt hätte, wäre es beim nächsten Deploy wieder
  // los gewesen, ohne je eine Chance auf Vorwarnung gehabt zu haben.
  //
  // Nur die Stufe, weil der vollständige Bericht den Pfad der Snapshot-Datei
  // und Hinweise zur Datenbank enthält. Das ist Betriebswissen und geht die
  // Öffentlichkeit nichts an; für die Warnung genügt „sicher" oder eben nicht.
  ['GET', /^\/api\/health$/, false, async () => ({
    ok: true, service: 'apopulse', ts: new Date().toISOString(),
    durability: durabilityReport().level,
  })],

  ['POST', /^\/api\/register$/, false, async ({ body }) => {
    const { name, email, password, handle, displayName, pharmacyName } = body;
    const reg = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name: pharmacyName || `${name || 'Meine'} Apotheke` },
      owner: { name, email, password },
    });
    // Land + UI-Sprache bei der Registrierung (Länderauswahl); Fallback AT/de.
    const country = normalizeCountry(body.country);
    const locale = normalizeLocale(body.locale, country);
    // Kontotyp bei der Registrierung (Apotheke/Pharma/Behörde/Privat); Fallback Apotheke.
    const accountType = normalizeAccountType(body.accountType);
    const profile = social.createProfile(reg.user.id, { handle, displayName: displayName || name, pharmacyOrgId: reg.organization.id, country, locale, accountType });
    // recoveryCodes einmalig mitschicken, damit das Frontend sie zum Sichern anzeigen kann.
    return { token: issueToken(reg.user.id), user: reg.user, profile, recovery_codes: reg.recoveryCodes };
  }],

  // Passwort per Wiederherstellungscode zurücksetzen (kein E-Mail-Dienst nötig). Rate-limitiert.
  ['POST', /^\/api\/password\/reset$/, false, async ({ body, ip }) => {
    const key = (ip || 'unknown') + '|' + String(body.email || '').trim().toLowerCase();
    const st = resetLimiter.check(key);
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    try {
      const r = orgAuth.resetPassword({ email: body.email, code: body.code, newPassword: body.newPassword });
      resetLimiter.reset(key); // Erfolg hebt die Bremse auf
      return r;
    } catch (e) { resetLimiter.fail(key); throw e; } // Fehlversuch zählt gegen das Limit
  }],

  // Verbleibende Wiederherstellungscodes (eingeloggt) + Neu-Erzeugung.
  ['GET', /^\/api\/recovery-codes$/, true, async ({ userId }) => ({ remaining: orgAuth.remainingRecoveryCodes(userId) })],
  ['POST', /^\/api\/recovery-codes\/regenerate$/, true, async ({ userId }) => orgAuth.regenerateRecoveryCodes(userId)],

  // ── Automatik: Stand und Handsteuerung ────────────────────────────────────
  // Ohne diese Ansicht weiß niemand, ob die Automatik überhaupt läuft — und
  // eine Automatik, deren Zustand man nicht sehen kann, ist keine.
  ['GET', /^\/api\/live\/status$/, false, async () => ({
    jobs: scheduler.status(),
    sources: activeSources().map(({ id, kind, country, format, url, official, configured, label, fallbacks, verified }) =>
      // Die URL gehört dazu: Nur so lässt sich prüfen, ob die Voreinstellung
      // noch stimmt oder eine Behörde ihren Feed verschoben hat.
      // `verified: false` heißt: in der Bauumgebung nicht abrufbar gewesen.
      ({ id, kind, country, format, url, official, configured, label, verified, fallbacks: (fallbacks || []).length })),
    // Länderabdeckung auf einen Blick: Für welches der 16 Länder gibt es
    // überhaupt eine Quelle? Ohne diese Zeile fällt ein Land, das durchs
    // Raster gefallen ist, erst auf, wenn jemand dort eine leere Ansicht sieht.
    coverage: (() => {
      const proLand = {};
      for (const s of activeSources()) (proLand[s.country] ||= []).push(s.id);
      const laender = listCountries().map((c) => c.code);
      return {
        countries: laender.length,
        withSource: laender.filter((cc) => proLand[cc]).length,
        missing: laender.filter((cc) => !proLand[cc]),
        bySource: proLand,
      };
    })(),
    shortage_feeds: Object.keys(liveSources()),
    news_seen: newsSeen.size(),
    intervals: { news_ms: INTERVALS.news, shortages_ms: INTERVALS.shortages },
    // Datenbank-Spiegel: `null` heißt „keine DATABASE_URL gesetzt" — das ist ein
    // gültiger Betriebszustand, kein Fehler. Sonst steht hier, ob er verbunden
    // ist und wie viele Zeilen tatsächlich in Postgres liegen.
    database: db ? await db.stats() : null,
    // Die wichtigste Zeile dieser Ansicht: Überleben die Daten ein Deploy?
    durability: durabilityReport(),
  })],

  // ── Dauerhafter Bestand lesen (PostgreSQL) ────────────────────────────────
  //  Der Spiegel war bisher ein Endlager: Es wurde hineingeschrieben, aber nie
  //  daraus gelesen. Diese zwei Ansichten machen ihn nutzbar. Der Gewinn zeigt
  //  sich direkt nach einem Deploy — der Arbeitsspeicher ist dann leer, die
  //  Datenbank hält aber die Meldungen der letzten Wochen.
  //
  //  Angemeldet, nicht öffentlich: Die Behördenmeldungen selbst sind zwar
  //  öffentlich, die aufbereitete Sammlung über zehn Länder ist aber die
  //  Leistung der Plattform — wie /api/rabatte und /api/exchange auch.
  ['GET', /^\/api\/db\/news$/, true, async ({ query }) => {
    if (!db) throw dbNichtKonfiguriert();
    const { rows, ok, error } = await db.listNews({
      country: countryFilter(query.get('country')),
      limit: query.get('limit'),
    });
    if (!ok) throw dbNichtErreichbar(error);
    return {
      news: rows.map((n) => ({
        id: n.id, title: n.title, summary: n.summary, link: n.link,
        source: n.source, source_id: n.sourceId, country: n.country,
        published_at: n.publishedAt, fetched_at: n.fetchedAt,
      })),
    };
  }],

  ['GET', /^\/api\/db\/shortages$/, true, async ({ query }) => {
    if (!db) throw dbNichtKonfiguriert();
    const { rows, ok, error } = await db.listShortages({
      country: countryFilter(query.get('country')),
      limit: query.get('limit'),
    });
    if (!ok) throw dbNichtErreichbar(error);
    return {
      shortages: rows.map((s) => ({
        id: s.id, bezeichnung: s.drugName, wirkstoff: s.activeSubst,
        country: s.country, status: s.status, grund: s.reason,
        // Herkunft fährt mit — die Oberfläche unterscheidet geprüfte von
        // selbst gemeldeten Angaben, und ohne dieses Feld könnte sie das nicht.
        provenance: s.provenance, quelle: s.source,
        gemeldet_am: s.reportedAt, voraussichtlich_bis: s.expectedEnd,
        aktualisiert_am: s.updatedAt,
      })),
    };
  }],

  // Durchlauf von Hand anstoßen (Moderation) — für den Test nach dem Deploy,
  // ohne fünf Minuten auf den nächsten Takt zu warten.
  ['POST', /^\/api\/live\/run\/(news|shortages)$/, true, async ({ userId, params }) => {
    if (!social.isModerator(userId)) {
      const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e;
    }
    return scheduler.runNow(params[0]);
  }],

  // ── Aktionen/Rabatte selbst eintragen ─────────────────────────────────────
  ['GET', /^\/api\/deals\/mine$/, true, async ({ userId }) => ({
    may_create: deals.mayCreate(userId),
    deals: deals.mine(userId),
  })],
  ['POST', /^\/api\/deals$/, true, async ({ userId, body }) => deals.create(userId, body)],
  ['DELETE', /^\/api\/deals\/([^/]+)$/, true, async ({ userId, params }) => deals.remove(userId, params[0])],

  // Hinterlegte Krypto-Empfangswege. Öffentlich, weil Empfangsadressen kein
  // Geheimnis sind — und weil das Checkout-Modal sie zur Laufzeit zieht, statt
  // eine abgetippte Kopie mitzuschleppen. So wirken ENV-Änderungen sofort.
  ['GET', /^\/api\/payments\/wallets$/, false, async () => ({
    wallets: cryptoWallets().map(({ id, coin, symbol, address, network, label }) =>
      ({ id, coin, symbol, address, network, label })),
    routes: paymentRoutes(),
  })],

  // ── Dynamic Country Compliance ────────────────────────────────────────────
  // Liefert Handels-Modus, Gebührenmodell, zulässige Zahlwege und Pflichtfelder
  // für ein Land. Öffentlich, weil die Preis-/Rechtslage vor dem Login sichtbar
  // sein muss — und weil das Checkout-Modal sie beim Länderwechsel neu zieht.
  ['GET', /^\/api\/compliance\/([A-Za-z]{2})$/, false, async ({ params, query }) => {
    const country = params[0].toUpperCase();
    const purpose = PURPOSES.includes(query.get('purpose')) ? query.get('purpose') : 'saas_license';
    const profile = complianceProfile(country);
    const purposes = availablePurposes(country);
    // Zweck, den es hier nicht gibt, still auf den ersten möglichen korrigieren
    // — dieselbe Regel wie im Manager, damit API und UI nicht auseinanderlaufen.
    const effective = purposes.includes(purpose) ? purpose : purposes[0];

    return {
      country,
      profile,
      commerce_mode: profile.commerceMode,
      currency: profile.currency,
      transaction_fee_allowed: profile.transactionFeeAllowed,
      purpose: effective,
      purpose_corrected: effective !== purpose,
      available_purposes: purposes.map((id) => ({ id, label: PURPOSE_LABELS[id] })),
      methods: paymentMethodsFor(country, effective),
      fields: checkoutFieldsFor(country, effective),
      fees: feeModel(country, effective),
    };
  }],

  // Gebühren-Vorschau für einen konkreten Betrag (kleinste Währungseinheit).
  ['GET', /^\/api\/compliance\/([A-Za-z]{2})\/quote$/, false, async ({ params, query }) => {
    const country = params[0].toUpperCase();
    const purpose = PURPOSES.includes(query.get('purpose')) ? query.get('purpose') : 'saas_license';
    const amount = Number(query.get('amount') || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      const e = new Error('Betrag ungültig.'); e.status = 400; e.code = 'amount_invalid'; throw e;
    }
    return { country, purpose, ...calculateFee(amount, country, purpose) };
  }],

  // Abo-Pläne in der Landeswährung.
  ['GET', /^\/api\/plans$/, false, async ({ query }) => {
    const country = normalizeCountry(query.get('country'));
    const interval = query.get('interval') === 'yearly' ? 'yearly' : 'monthly';
    return { country, interval, currency: complianceProfile(country).currency, plans: plansForCountry(country, { interval }) };
  }],
  ['GET', /^\/api\/plans\/([a-z_]+)\/price$/, false, async ({ params, query }) => {
    const price = priceFor(params[0], normalizeCountry(query.get('country')), query.get('interval'));
    if (!price) { const e = new Error('Plan unbekannt.'); e.status = 404; e.code = 'plan_unknown'; throw e; }
    return price;
  }],

  // ── Zahlungen / Premium — inaktiv, solange kein Anbieter konfiguriert ist. ──
  ['GET', /^\/api\/payments\/products$/, false, async () => ({ products: listProducts() })],
  ['GET', /^\/api\/payments\/methods$/, false, async () => ({ methods: payments.configuredMethods() })],
  ['POST', /^\/api\/payments\/checkout$/, true, async ({ userId, body }) =>
    payments.createCheckout(userId, { productId: body.productId, method: body.method, successUrl: body.successUrl, cancelUrl: body.cancelUrl })],
  ['GET', /^\/api\/me\/premium$/, true, async ({ userId }) => ({ premium: payments.hasFeature(userId, 'premium'), features: payments.myEntitlements(userId) })],
  // Direkt-in-Wallet Krypto: Anzeige (Adresse + „in Wallet öffnen"-URI + Live-Betrag),
  // Start (pending), Tx-ID einreichen (pending_review), Moderation bestätigt manuell.
  // `country` steuert nur die ANZEIGE-Währung (Näherung). Abgerechnet wird in
  // der Produktwährung — deshalb ist der Parameter unkritisch und optional.
  ['GET', /^\/api\/payments\/crypto$/, false, async ({ query }) => {
    const country = query.get('country');
    const currency = country ? COUNTRIES[normalizeCountry(country)].currency : null;
    return payments.cryptoOptions(query.get('product') || 'premium_monthly', { currency });
  }],
  ['POST', /^\/api\/payments\/crypto\/start$/, true, async ({ userId, body }) => payments.startCryptoPayment(userId, body.productId, body.walletId ?? body.coin)],
  ['POST', /^\/api\/payments\/crypto\/([^/]+)\/claim$/, true, async ({ userId, params, body }) => payments.claimCryptoPayment(userId, params[0], body.txRef)],
  ['GET', /^\/api\/payments\/pending$/, true, async ({ userId }) => ({ payments: payments.listPendingReview(userId) })],
  ['POST', /^\/api\/payments\/([^/]+)\/confirm$/, true, async ({ userId, params }) => payments.confirmPayment(userId, params[0])],
  // Der Webhook (POST /api/payments/webhook/:provider) braucht den ROHEN Body für die
  // Signaturprüfung und wird deshalb VOR dem JSON-Router gesondert behandelt (siehe unten).

  // ── Social-Login (OAuth) — inaktiv, solange keine Provider konfiguriert sind. ──
  // Optionaler ?redirect_uri= liefert je Provider die fertige Authorize-URL fürs Frontend.
  ['GET', /^\/api\/auth\/providers$/, false, async ({ query }) => {
    const redirectUri = query.get('redirect_uri') || '';
    const providers = oauth.configuredProviders().map(name => {
      let authorize_url = null;
      // state = Providername: erlaubt dem Frontend, die Rückleitung dem Provider zuzuordnen.
      if (redirectUri) { try { authorize_url = oauth.authorizeUrl(name, redirectUri, name); } catch { /* Provider ohne Authorize-URL */ } }
      return { provider: name, authorize_url };
    });
    return { providers };
  }],
  ['POST', /^\/api\/auth\/oauth\/([a-z0-9_]+)$/, false, async ({ params, body }) => {
    const { userId } = await oauth.loginOrRegister(params[0], body.code, body.redirectUri, { country: normalizeCountry(body.country), locale: body.locale });
    return { token: issueToken(userId), user: safeUser(repo.getUserById(userId)), profile: social.getProfile(userId) };
  }],
  ['GET', /^\/api\/auth\/identities$/, true, async ({ userId }) => ({ identities: oauth.linkedIdentities(userId) })],
  ['POST', /^\/api\/auth\/identities\/([a-z0-9_]+)\/unlink$/, true, async ({ userId, params }) => oauth.unlink(userId, params[0])],

  ['POST', /^\/api\/login$/, false, async ({ body, ip }) => {
    const key = (ip || 'unknown') + '|' + String(body.email || '').trim().toLowerCase();
    const st = loginLimiter.check(key);
    if (st.blocked) {
      const e = new Error('Zu viele Fehlversuche. Bitte später erneut versuchen.');
      e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000);
      throw e;
    }
    const r = orgAuth.login({ email: body.email, password: body.password });
    if (!r.ok) { loginLimiter.fail(key); const e = new Error(r.error); e.status = 401; e.code = 'login_failed'; throw e; }
    loginLimiter.reset(key); // erfolgreiche Anmeldung setzt den Zähler zurück
    return { token: issueToken(r.user.id), user: r.user, profile: social.getProfile(r.user.id) };
  }],

  ['GET', /^\/api\/me$/, true, async ({ userId }) => ({ user: safeUser(repo.getUserById(userId)), profile: social.getProfile(userId), is_moderator: social.isModerator(userId) })],
  ['GET', /^\/api\/overview$/, true, async ({ userId, query }) => {
    const home = userCountry(userId);
    const dealsBlocked = isFeatureBlocked(home, 'deals');
    const ov = overview.forUser(userId, { dealsBlocked });
    // Rechts-Gate (Heimatland): gesperrte Module aus der Übersicht nehmen.
    if (dealsBlocked) { ov.top_rabatt = null; ov.rabatte_expiring = { count: 0, soonest: null }; ov.watch_deals = []; }
    if (isFeatureBlocked(home, 'stock_exchange')) { ov.exchange = { biete: 0, suche: 0, recent: [] }; ov.my_seeks = { open: 0, with_matches: 0, items: [] }; ov.watch_offers = []; ov.expiring_offers = { count: 0, items: [] }; }
    if (isFeatureBlocked(home, 'price_compare')) { ov.savings = null; }
    return { ...ov, premium: payments.hasFeature(userId, 'premium'), data_live: isLive(activeCountry(userId, query)) };
  }],
  // Meine Aktivität an einem Ort: eigene Fragen, Engpass-Meldungen, Austausch-Einträge.
  ['GET', /^\/api\/me\/activity$/, true, async ({ userId }) => {
    const page = social.profilePage(userId, userId);
    const posts = (page && page.posts) || [];
    const questions = posts.filter(p => p.is_question);
    const reports = shortages.listWithCounts(userId).filter(s => s.is_reporter);
    const mine = exchange.mine(userId);
    // Beitrag-Statistik: Kennzahlen des eigenen Engagements auf einen Blick.
    const stats = {
      posts: (page && page.post_count) || 0,
      questions: questions.length,
      questions_open: questions.filter(q => !q.answered).length,
      best_answers: (page && page.best_answers) || 0,
      reports: reports.length,
      confirms_received: reports.reduce((n, s) => n + (s.confirm_count || 0), 0),
      exchange: mine.length,
      followers: (page && page.follower_count) || 0,
      following: (page && page.following_count) || 0,
    };
    return { questions, reports, exchange: mine, stats };
  }],
  // Wirkstoff-Detailseite: alles zu einem Wirkstoff gebündelt (Engpass, Austausch,
  // Preise, Aktionen) — komponiert aus bereits getesteten Diensten.
  ['GET', /^\/api\/wirkstoff\/([^/]+)$/, true, async ({ userId, params }) => {
    const name = decodeURIComponent(params[0]).trim();
    const low = name.toLowerCase();
    const eq = (v) => String(v || '').trim().toLowerCase() === low;
    const home = userCountry(userId);
    // Rechts-Gate (Heimatland): gesperrte Module (Rabatte/Austausch/Preise) im Hub leer lassen.
    const dealsBlocked = isFeatureBlocked(home, 'deals');
    const exBlocked = isFeatureBlocked(home, 'stock_exchange');
    const priceBlocked = isFeatureBlocked(home, 'price_compare');
    const ex = exBlocked ? [] : exchange.list(userId, { q: name });
    return {
      wirkstoff: name,
      amr: amr.forWirkstoff(name),
      watched: shortagesRepo.isWatched(userId, name),
      alert_pct: shortagesRepo.getWatchAlert(userId, name),
      premium: payments.hasFeature(userId, 'premium'),
      note: shortagesRepo.getWatchNote(userId, name),
      also_watching: shortagesRepo.usersWatching(name).filter(id => id !== userId).length,
      shortages: shortages.listWithCounts(userId).filter(s => eq(s.wirkstoff)),
      prices: priceBlocked ? [] : prices.comparisons(userId).filter(g => eq(g.wirkstoff)),
      rabatte: dealsBlocked ? [] : rabatte.top10(userId).filter(r => eq(r.wirkstoff)),
      exchange: { biete: ex.filter(e => e.kind === 'biete'), suche: ex.filter(e => e.kind === 'suche') },
      posts: enrichPosts(social.searchPosts(userId, name).slice(0, 10), userId),
    };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)\/(followers|following)$/, true, async ({ userId, params }) => {
    const d = social.followList(userId, decodeURIComponent(params[0]), params[1]);
    if (!d) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['GET', /^\/api\/suggestions\/follow$/, true, async ({ userId }) => ({ suggestions: social.suggestFollows(userId) })],
  ['GET', /^\/api\/colleagues\/nearby$/, true, async ({ userId }) => social.colleaguesInBundesland(userId)],
  ['GET', /^\/api\/discover\/open-to$/, true, async ({ userId }) => social.openToCounts(userId)],
  ['GET', /^\/api\/discover\/open-to\/([^/]+)$/, true, async ({ userId, params }) => social.discoverByOpenTo(userId, decodeURIComponent(params[0]))],
  ['GET', /^\/api\/handles$/, true, async ({ query }) => ({ handles: social.searchHandles(query.get('q') || '') })],
  ['GET', /^\/api\/me\/export$/, true, async ({ userId }) => ({ ...social.exportData(userId), exchange_entries: exchange.mine(userId) })],
  ['POST', /^\/api\/me\/password$/, true, async ({ userId, body }) => orgAuth.changePassword(userId, { oldPassword: body.oldPassword, newPassword: body.newPassword })],
  // ── Team-Verwaltung (Mitglieder der eigenen Organisation) ──
  ['GET', /^\/api\/team$/, true, async ({ userId }) => ({ membership: orgAuth.myMembership(userId), members: orgAuth.myMembership(userId)?.can_manage_users ? orgAuth.teamMembers(userId) : [] })],
  ['POST', /^\/api\/team$/, true, async ({ userId, body }) => ({ member: orgAuth.addTeamMember(userId, { name: body.name, email: body.email, password: body.password, role: body.role }) })],
  ['POST', /^\/api\/team\/([^/]+)\/role$/, true, async ({ userId, params, body }) => orgAuth.setMemberRole(userId, params[0], body.role)],
  ['POST', /^\/api\/team\/([^/]+)\/remove$/, true, async ({ userId, params }) => orgAuth.removeTeamMember(userId, params[0])],
  // ── Team-Aufgaben (apothekenintern, zuweisbar) ──
  ['GET', /^\/api\/tasks$/, true, async ({ userId }) => {
    const mem = orgAuth.myMembership(userId);
    if (!mem) return { tasks: [], can_assign: false, members: [] };
    const order = { offen: 0, in_arbeit: 1, erledigt: 2 };
    const tasks = collab.listTasks(userId, mem.organization_id)
      .map(t => ({ ...t, assignee_name: userName(t.assignee_user_id), creator_name: userName(t.created_by), mine: t.assignee_user_id === userId }))
      .sort((a, b) => (order[a.status] - order[b.status]) || String(b.created_at).localeCompare(String(a.created_at)));
    const can_assign = roleCan(mem.role, 'assign_tasks');
    return { tasks, can_assign, members: orgAuth.orgMembers(userId).map(m => ({ user_id: m.user_id, name: m.name })) };
  }],
  ['POST', /^\/api\/tasks$/, true, async ({ userId, body }) => {
    const mem = orgAuth.myMembership(userId);
    if (!mem) { const e = new Error('Keine Organisation.'); e.status = 403; throw e; }
    const title = String(body.title || '').trim();
    if (title.length < 2) { const e = new Error('Aufgabe braucht einen Titel.'); e.status = 400; throw e; }
    if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
    const dueDate = body.dueDate ? String(body.dueDate).trim() : null;
    if (dueDate && !isValidCalendarDay(dueDate)) { const e = new Error('Ungültiges Fälligkeitsdatum.'); e.status = 400; throw e; }
    const task = collab.createTask(userId, mem.organization_id, { title, description: body.description ? String(body.description).slice(0, 1000) : null, assigneeUserId: body.assigneeUserId || null, dueDate });
    // Zugewiesene Person benachrichtigen (transaktional; nicht sich selbst). Best-effort:
    // ein Fehler beim Zustellen darf die schon angelegte Aufgabe nicht als 500 erscheinen lassen.
    if (task.assignee_user_id && task.assignee_user_id !== userId) {
      try { social.pushNotification({ userId: task.assignee_user_id, type: 'task_assigned', actorUserId: userId, refType: 'task', refId: task.id, label: task.title }); } catch { /* egal */ }
    }
    return { task };
  }],
  ['POST', /^\/api\/tasks\/([^/]+)\/status$/, true, async ({ userId, params, body }) => {
    const prevStatus = (repo.getTask(params[0]) || {}).status; // Vorher-Status für Übergangs-Prüfung
    // (updateTaskStatus erzwingt Isolation/Rechte; repo.getTask dient nur dem Status-Vergleich)
    const task = collab.updateTaskStatus(userId, params[0], body.status);
    // Ersteller:in NUR beim Übergang nach 'erledigt' benachrichtigen (kein Spam bei
    // wiederholtem/idempotentem Setzen oder Wieder-Öffnen+Erledigen).
    if (task.status === 'erledigt' && prevStatus !== 'erledigt' && task.created_by && task.created_by !== userId) {
      try { social.pushNotification({ userId: task.created_by, type: 'task_done', actorUserId: userId, refType: 'task', refId: task.id, label: task.title }); } catch { /* egal */ }
    }
    return { task };
  }],
  ['POST', /^\/api\/tasks\/([^/]+)\/assign$/, true, async ({ userId, params, body }) => {
    const prev = (repo.getTask(params[0]) || {}).assignee_user_id;
    const task = collab.reassignTask(userId, params[0], body.assigneeUserId || null);
    // Neu zugewiesene Person benachrichtigen (nicht sich selbst, nur bei echtem Wechsel). Best-effort.
    if (task.assignee_user_id && task.assignee_user_id !== prev && task.assignee_user_id !== userId) {
      try { social.pushNotification({ userId: task.assignee_user_id, type: 'task_assigned', actorUserId: userId, refType: 'task', refId: task.id, label: task.title }); } catch { /* egal */ }
    }
    return { task };
  }],
  ['POST', /^\/api\/tasks\/([^/]+)$/, true, async ({ userId, params, body }) => {
    const fields = {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (title.length < 2) { const e = new Error('Aufgabe braucht einen Titel.'); e.status = 400; throw e; }
      if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
      fields.title = title;
    }
    if (body.description !== undefined) fields.description = body.description ? String(body.description).slice(0, 1000) : null;
    if (body.dueDate !== undefined) {
      const dueDate = body.dueDate ? String(body.dueDate).trim() : null;
      if (dueDate && !isValidCalendarDay(dueDate)) { const e = new Error('Ungültiges Fälligkeitsdatum.'); e.status = 400; throw e; }
      fields.dueDate = dueDate;
    }
    return { task: collab.editTask(userId, params[0], fields) };
  }],
  // ── Team-Notizen (gemeinsame Wissensablage, apothekenintern) ──
  ['GET', /^\/api\/notes$/, true, async ({ userId }) => {
    const mem = orgAuth.myMembership(userId);
    if (!mem) return { notes: [], can_pin: false, can_delete_role: false, can_create: false };
    const notes = collab.listNotes(userId, mem.organization_id)
      .map(n => ({ ...n, creator_name: userName(n.created_by), mine: n.created_by === userId }))
      .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || String(b.created_at).localeCompare(String(a.created_at)));
    const canCollab = roleCan(mem.role, 'collab'); // Anheften + fremde Notizen löschen
    const canCreate = canCollab || roleCan(mem.role, 'collab_assigned'); // Teilnahme am collab
    return { notes, can_pin: canCollab, can_delete_role: canCollab, can_create: canCreate };
  }],
  ['POST', /^\/api\/notes$/, true, async ({ userId, body }) => {
    const mem = orgAuth.myMembership(userId);
    if (!mem) { const e = new Error('Keine Organisation.'); e.status = 403; throw e; }
    const title = String(body.title || '').trim();
    if (title.length < 2) { const e = new Error('Notiz braucht einen Titel.'); e.status = 400; throw e; }
    if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
    let docUrl = null;
    if (body.docUrl && String(body.docUrl).trim()) {
      try { docUrl = cleanSourceUrl(body.docUrl); } catch { const e = new Error('Link muss ein http(s)-Link sein.'); e.status = 400; throw e; }
    }
    return { note: collab.createNote(userId, mem.organization_id, { title, body: body.body ? String(body.body).slice(0, 2000) : null, docUrl }) };
  }],
  ['POST', /^\/api\/notes\/([^/]+)$/, true, async ({ userId, params, body }) => {
    const fields = {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (title.length < 2) { const e = new Error('Notiz braucht einen Titel.'); e.status = 400; throw e; }
      if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
      fields.title = title;
    }
    if (body.body !== undefined) fields.body = body.body ? String(body.body).slice(0, 2000) : null;
    if (body.docUrl !== undefined) {
      let docUrl = null;
      if (body.docUrl && String(body.docUrl).trim()) {
        try { docUrl = cleanSourceUrl(body.docUrl); } catch { const e = new Error('Link muss ein http(s)-Link sein.'); e.status = 400; throw e; }
      }
      fields.docUrl = docUrl;
    }
    return { note: collab.updateNote(userId, params[0], fields) };
  }],
  ['POST', /^\/api\/notes\/([^/]+)\/pin$/, true, async ({ userId, params, body }) => ({ note: collab.setNotePinned(userId, params[0], !!body.pinned) })],
  ['POST', /^\/api\/notes\/([^/]+)\/delete$/, true, async ({ userId, params }) => collab.deleteNote(userId, params[0])],
  ['POST', /^\/api\/me\/delete$/, true, async ({ userId, body }) => {
    if (!orgAuth.verifyUserPassword(userId, body.password)) { const e = new Error('Passwort ist falsch.'); e.status = 401; throw e; }
    socialRepo.purgeUser(userId);
    exchangeRepo.purgeUser(userId);
    shortagesRepo.purgeUser(userId);
    repo.deleteUser(userId);
    return { ok: true };
  }],

  // ── Moderation (nur Redaktions-/Admin-Konten) ──
  ['GET', /^\/api\/reports$/, true, async ({ userId }) => ({ reports: social.moderationQueue(userId) })],
  ['POST', /^\/api\/reports\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveReport(userId, params[0], { remove: !!body.remove })],

  // ── Verifizierung (Apotheken-Nachweis) ──
  ['GET', /^\/api\/verify\/me$/, true, async ({ userId }) => social.myVerification(userId)],
  ['POST', /^\/api\/verify\/request$/, true, async ({ userId, body }) => social.requestVerification(userId, { note: body.note })],
  ['GET', /^\/api\/verify\/requests$/, true, async ({ userId }) => ({ requests: social.verificationQueue(userId) })],
  ['POST', /^\/api\/verify\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveVerification(userId, params[0], !!body.approve)],

  ['GET', /^\/api\/feed\/home$/, true, async ({ userId }) => ({ posts: enrichPosts(social.homeFeed(userId), userId) })],
  ['GET', /^\/api\/feed\/public$/, true, async ({ userId, query }) => ({ country: activeCountry(userId, query), posts: enrichPosts(social.publicFeed(userId, { sort: query.get('sort') || 'neu', filter: query.get('filter') || 'all', country: activeCountry(userId, query) }), userId) })],

  ['POST', /^\/api\/posts$/, true, async ({ userId, body }) => social.createPost(userId, { body: body.body, visibility: body.visibility, kind: body.kind, image: body.image, sourceUrl: body.sourceUrl, pollOptions: body.pollOptions })],
  ['GET', /^\/api\/news$/, true, async ({ userId, query }) => ({ country: activeCountry(userId, query), posts: enrichPosts(social.newsFeed(userId, { country: activeCountry(userId, query) }), userId) })],
  ['GET', /^\/api\/hashtag\/([^/]+)$/, true, async ({ userId, params }) => ({ tag: decodeURIComponent(params[0]), posts: enrichPosts(social.postsByHashtag(userId, decodeURIComponent(params[0])), userId) })],
  ['GET', /^\/api\/trending\/hashtags$/, true, async ({ userId }) => ({ hashtags: social.trendingHashtags(userId) })],
  // Mehrsprachige Patienten-Infokarten (Antibiotika) — für Aufklärung bei der Abgabe.
  ['GET', /^\/api\/patient-info$/, true, async ({ query }) => patientInfo.cards(query.get('lang') || 'de')],
  // Länder-Register (öffentlich): für Länderauswahl bei Registrierung + Umschalter.
  ['GET', /^\/api\/countries$/, false, async () => ({ countries: listCountries() })],
  // Live-Daten-Status je Land: ist eine echte Quelle „angeschlossen"? (Bis dahin Referenzdaten.)
  ['GET', /^\/api\/data-status$/, true, async ({ userId, query }) => {
    const c = activeCountry(userId, query);
    return { country: c, shortages: { live: isLive(c), source_configured: isLive(c) }, prices: { live: isPriceLive(c), source_configured: isPriceLive(c) }, rabatte: { live: isRabatteLive(c), source_configured: isRabatteLive(c) } };
  }],
  // Landesspezifische Feature-Konfiguration (Framework „active_features"). Nur echte
  // Funktionen sind enabled=true; geplante Module (Echtheitsprüfung, Rückrufe …) enabled=false.
  ['GET', /^\/api\/country-config$/, true, async ({ userId, query }) => countryConfig(activeCountry(userId, query))],
  // Live-Wechselkurse (EUR-Basis) für den Umrechner. null-rates -> Frontend zeigt „nicht verfügbar".
  ['GET', /^\/api\/fx-rates$/, true, async () => {
    const d = await fxRates.rates();
    return d ? { base: d.base, rates: d.rates, updated_at: d.updated_at } : { base: 'EUR', rates: null, updated_at: null };
  }],
  // Kontotyp-Register (öffentlich): für die Kontotyp-Auswahl bei der Registrierung.
  ['GET', /^\/api\/account-types$/, false, async () => ({ account_types: listAccountTypes() })],
  ['GET', /^\/api\/posts\/([^/]+)$/, true, async ({ userId, params }) => {
    const p = social.getPost(userId, params[0]);
    if (!p) { const e = new Error('Beitrag nicht gefunden'); e.status = 404; throw e; }
    return { post: enrichPosts([p], userId)[0] };
  }],
  ['GET', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params }) => ({ comments: social.listComments(userId, params[0]) })],
  ['POST', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params, body }) => social.comment(userId, params[0], { body: body.body, parentCommentId: body.parentCommentId, image: body.image })],
  ['POST', /^\/api\/comments\/([^/]+)\/edit$/, true, async ({ userId, params, body }) => social.editComment(userId, params[0], body.body)],
  ['POST', /^\/api\/comments\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deleteComment(userId, params[0])],
  ['POST', /^\/api\/comments\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'comment', params[0], body.type)],
  ['POST', /^\/api\/comments\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'comment', params[0], body.reason)],
  ['POST', /^\/api\/posts\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'post', params[0], body.type)],
  ['POST', /^\/api\/posts\/([^/]+)\/edit$/, true, async ({ userId, params, body }) => social.editPost(userId, params[0], body.body)],
  ['POST', /^\/api\/posts\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deletePost(userId, params[0])],
  ['POST', /^\/api\/posts\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'post', params[0], body.reason)],
  ['POST', /^\/api\/posts\/([^/]+)\/bookmark$/, true, async ({ userId, params }) => social.toggleBookmark(userId, params[0])],
  ['POST', /^\/api\/posts\/([^/]+)\/repost$/, true, async ({ userId, params, body }) => social.repost(userId, params[0], { comment: body.comment, visibility: body.visibility })],
  ['POST', /^\/api\/posts\/([^/]+)\/accept$/, true, async ({ userId, params, body }) => social.acceptAnswer(userId, params[0], body.commentId)],
  ['POST', /^\/api\/polls\/([^/]+)\/vote$/, true, async ({ userId, params, body }) => social.votePoll(userId, params[0], body.optionId ?? null)],
  ['GET', /^\/api\/bookmarks$/, true, async ({ userId }) => ({ posts: enrichPosts(social.listBookmarks(userId), userId) })],
  ['GET', /^\/api\/bookmarks\/ids$/, true, async ({ userId }) => ({ ids: social.bookmarkIds(userId) })],
  // Einkaufsliste (Bestell-Merkzettel)
  ['GET', /^\/api\/cart$/, true, async ({ userId }) => social.cart(userId)],
  ['POST', /^\/api\/cart$/, true, async ({ userId, body }) => ({ item: social.addToCart(userId, body) })],
  ['POST', /^\/api\/cart\/clear$/, true, async ({ userId }) => social.clearCart(userId)],
  ['POST', /^\/api\/cart\/checkout$/, true, async ({ userId, body }) => ({ order: social.checkoutCart(userId, { reference: body && body.reference, supplier: body ? body.supplier : undefined }) })],
  // Bestell-Vorlagen: VOR den generischen /api/cart/:id-Routen, damit „templates" nicht als
  // Positions-ID interpretiert wird.
  ['GET', /^\/api\/cart\/templates$/, true, async ({ userId }) => ({ templates: social.listCartTemplates(userId) })],
  ['POST', /^\/api\/cart\/templates$/, true, async ({ userId, body }) => ({ template: social.saveCartAsTemplate(userId, body && body.name) })],
  ['POST', /^\/api\/cart\/templates\/([^/]+)\/apply$/, true, async ({ userId, params }) => social.applyCartTemplate(userId, params[0])],
  ['POST', /^\/api\/cart\/templates\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deleteCartTemplate(userId, params[0])],
  ['POST', /^\/api\/cart\/([^/]+)\/remove$/, true, async ({ userId, params }) => social.removeCartItem(userId, params[0])],
  ['POST', /^\/api\/cart\/([^/]+)$/, true, async ({ userId, params, body }) => ({ item: social.updateCartItem(userId, params[0], body) })],
  // ── Bestell-Historie (abgeschlossene Einkaufslisten) ──
  ['GET', /^\/api\/orders$/, true, async ({ userId }) => ({ orders: social.listOrders(userId) })],
  ['POST', /^\/api\/orders\/([^/]+)\/reorder$/, true, async ({ userId, params }) => social.reorder(userId, params[0])],
  ['POST', /^\/api\/orders\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deleteOrder(userId, params[0])],
  ['POST', /^\/api\/orders\/([^/]+)\/received$/, true, async ({ userId, params, body }) => ({ order: social.setOrderReceived(userId, params[0], !!(body && body.received)) })],
  ['POST', /^\/api\/orders\/([^/]+)\/expected$/, true, async ({ userId, params, body }) => {
    const exp = body && body.expected ? String(body.expected).trim() : null;
    if (exp && !isValidCalendarDay(exp)) { const e = new Error('Ungültiges Datum.'); e.status = 400; throw e; }
    return { order: social.setOrderExpected(userId, params[0], exp) };
  }],
  // ── Premium: Videosprechstunde (Terminbuchung) ──
  ['GET', /^\/api\/appointments$/, true, async ({ userId }) => ({ appointments: social.listVideoAppointments(userId), premium: payments.hasFeature(userId, 'premium') })],
  ['POST', /^\/api\/appointments$/, true, async ({ userId, body }) => ({ appointment: social.requestVideoAppointment(userId, body.providerHandle, { datum: body.datum, uhrzeit: body.uhrzeit, grund: body.grund }) })],
  ['POST', /^\/api\/appointments\/([^/]+)\/respond$/, true, async ({ userId, params, body }) => ({ appointment: social.respondVideoAppointment(userId, params[0], !!body.accept) })],
  ['POST', /^\/api\/appointments\/([^/]+)\/cancel$/, true, async ({ userId, params }) => ({ appointment: social.cancelVideoAppointment(userId, params[0]) })],
  // ── Premium-Werbung/Shop (beworbene Produkte/Angebote) ──
  ['GET', /^\/api\/promotions$/, true, async ({ userId, query }) => ({ promotions: social.listPromotions(userId, { kategorie: query.get('kategorie') || null, country: activeCountry(userId, query) }), premium: payments.hasFeature(userId, 'premium') })],
  ['GET', /^\/api\/promotions\/mine$/, true, async ({ userId, query }) => ({ promotions: social.listMyPromotions(userId, { kategorie: query.get('kategorie') || null }), premium: payments.hasFeature(userId, 'premium') })],
  ['POST', /^\/api\/promotions$/, true, async ({ userId, body }) => ({ promotion: social.createPromotion(userId, body) })],
  ['GET', /^\/api\/promotions\/([^/]+)$/, true, async ({ userId, params }) => ({ promotion: social.getPromotion(userId, params[0]) })],
  ['POST', /^\/api\/promotions\/([^/]+)\/update$/, true, async ({ userId, params, body }) => ({ promotion: social.updatePromotion(userId, params[0], body) })],
  ['POST', /^\/api\/promotions\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deletePromotion(userId, params[0])],
  ['POST', /^\/api\/promotions\/([^/]+)\/like$/, true, async ({ userId, params }) => social.likePromotion(userId, params[0])],
  ['POST', /^\/api\/promotions\/([^/]+)\/comment$/, true, async ({ userId, params, body }) => ({ comment: social.commentPromotion(userId, params[0], { body: body.body }) })],
  ['POST', /^\/api\/promotions\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'promotion', params[0], body.reason)],
  // ── Premium: Live-Sessions (geplante/laufende öffentliche Video-Runden) ──
  ['GET', /^\/api\/live$/, true, async ({ userId }) => ({ sessions: social.listLiveSessions(userId), premium: payments.hasFeature(userId, 'premium') })],
  ['GET', /^\/api\/live\/mine$/, true, async ({ userId }) => ({ sessions: social.listMyLiveSessions(userId), premium: payments.hasFeature(userId, 'premium') })],
  ['POST', /^\/api\/live$/, true, async ({ userId, body }) => ({ session: social.createLiveSession(userId, { titel: body.titel, thema: body.thema, geplant_am: body.geplant_am }) })],
  ['POST', /^\/api\/live\/([^/]+)\/start$/, true, async ({ userId, params }) => ({ session: social.startLiveSession(userId, params[0]) })],
  ['POST', /^\/api\/live\/([^/]+)\/end$/, true, async ({ userId, params }) => ({ session: social.endLiveSession(userId, params[0]) })],
  ['POST', /^\/api\/live\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deleteLiveSession(userId, params[0])],
  ['POST', /^\/api\/live\/([^/]+)\/interest$/, true, async ({ userId, params }) => social.toggleLiveInterest(userId, params[0])],
  ['POST', /^\/api\/live\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'live', params[0], body.reason)],

  // ── Partner-Verzeichnis (nach Kontotyp, im eigenen Land) ──
  ['GET', /^\/api\/directory$/, true, async ({ userId, query }) => social.directoryCounts(userId, { bundesland: query.get('bundesland') || null })],
  ['GET', /^\/api\/directory\/([^/]+)$/, true, async ({ userId, params, query }) => social.directory(userId, params[0], { q: query.get('q') || null, bundesland: query.get('bundesland') || null, verifiedOnly: query.get('verified') === '1' })],
  ['GET', /^\/api\/profiles\/([^/]+)\/page$/, true, async ({ userId, params }) => {
    const d = social.profilePage(userId, params[0]);
    if (!d) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    // Offene Biete/Suche der Apotheke — Rechts-Gate am Heimatland des Betrachters (wie die
    // Austausch-Reiter): wo der Bestandsaustausch gesperrt ist, keine Einträge zeigen.
    const exBlocked = isFeatureBlocked(userCountry(userId), 'stock_exchange');
    const exchange_entries = exBlocked ? [] : exchange.byAuthor(d.profile.user_id, { status: 'offen' });
    return { ...d, posts: enrichPosts(d.posts, userId), exchange_entries };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)$/, true, async ({ params }) => ({ profile: social.getProfile(params[0]) })],
  ['POST', /^\/api\/profiles\/([^/]+)\/endorse$/, true, async ({ userId, params, body }) => social.endorseSkill(userId, params[0], body.skill)],
  ['POST', /^\/api\/profiles\/([^/]+)\/recommend$/, true, async ({ userId, params, body }) => ({ recommendation: social.writeRecommendation(userId, params[0], body.body) })],
  ['POST', /^\/api\/recommendations\/([^/]+)\/remove$/, true, async ({ userId, params }) => social.removeRecommendation(userId, params[0])],
  ['POST', /^\/api\/profile$/, true, async ({ userId, body }) => ({ profile: social.updateProfile(userId, body) })],
  ['POST', /^\/api\/follow$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (!target) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return social.follow(userId, target.user_id);
  }],
  ['POST', /^\/api\/unfollow$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (target) social.unfollow(userId, target.user_id);
    return { ok: true };
  }],
  // Stummschalten (Beiträge einer Person aus den eigenen Feeds ausblenden)
  ['POST', /^\/api\/mute$/, true, async ({ userId, body }) => social.mute(userId, body.handle)],
  ['POST', /^\/api\/unmute$/, true, async ({ userId, body }) => social.unmute(userId, body.handle)],
  ['GET', /^\/api\/muted$/, true, async ({ userId }) => ({ muted: social.listMuted(userId) })],

  ['GET', /^\/api\/notification-prefs$/, true, async ({ userId }) => ({ settings: social.getNotifSettings(userId), categories: social.notifCategories() })],
  ['POST', /^\/api\/notification-prefs$/, true, async ({ userId, body }) => ({ settings: social.setNotifSetting(userId, body.category, body.enabled) })],
  ['GET', /^\/api\/notifications$/, true, async ({ userId }) => ({ notifications: social.notifications(userId), unread: social.unreadCount(userId) })],
  ['POST', /^\/api\/notifications\/read-all$/, true, async ({ userId }) => { social.markAllNotificationsRead(userId); return { ok: true }; }],
  ['POST', /^\/api\/notifications\/clear-read$/, true, async ({ userId }) => social.clearReadNotifications(userId)],
  ['POST', /^\/api\/notifications\/([^/]+)\/read$/, true, async ({ userId, params }) => { social.markNotificationRead(userId, params[0]); return { ok: true }; }],

  // ── Direktnachrichten (1:1, privat) ──
  ['GET', /^\/api\/dm$/, true, async ({ userId }) => ({ threads: social.dmInbox(userId), unread: social.dmUnreadTotal(userId), archived: social.dmArchived(userId) })],
  ['POST', /^\/api\/dm\/start$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (!target) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return { thread: social.startDm(userId, target.user_id) };
  }],
  ['GET', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params }) => social.dmConversation(userId, params[0])],
  ['POST', /^\/api\/dm\/([^/]+)\/hide$/, true, async ({ userId, params, body }) => social.setDmConversationHidden(userId, params[0], body.hidden !== false)],
  ['POST', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params, body }) => social.sendDm(userId, params[0], body.body)],

  // ── Lieferengpässe (Priorität 2) ──
  // is_antibiotic: markiert Antibiotika-Engpässe, damit das Frontend auf die
  // quellenbelegte AMR-Wissensecke verweisen kann (keine Substitutionsempfehlung).
  ['GET', /^\/api\/shortages$/, true, async ({ userId }) => {
    // Verfügbare Alternativen (gleicher Wirkstoff, anderes Präparat im Preisvergleich) —
    // faktische Angabe (keine Substitutionsempfehlung). In price_compare-gesperrten Ländern: 0.
    const priceBlocked = isFeatureBlocked(userCountry(userId), 'price_compare');
    const byWk = new Map(); // wirkstoff (lower) -> Set von Präparat-Bezeichnungen
    if (!priceBlocked) {
      // Leichtgewichtig aus dem Repo (nur Wirkstoff/Bezeichnung) — ohne die teure
      // Ersparnis-/Aktions-/Feed-Aufbereitung von prices.comparisons().
      for (const g of pricesRepo.listComparisons()) {
        const wk = String(g.wirkstoff || '').trim().toLowerCase();
        if (!wk) continue;
        if (!byWk.has(wk)) byWk.set(wk, new Set());
        byWk.get(wk).add(String(g.bezeichnung || '').trim().toLowerCase());
      }
    }
    const altCount = (s) => {
      const set = byWk.get(String(s.wirkstoff || '').trim().toLowerCase());
      if (!set) return 0;
      const self = String(s.bezeichnung || '').trim().toLowerCase();
      return [...set].filter(b => b && b !== self).length;
    };
    return { shortages: shortages.listWithCounts(userId).map(s => ({ ...s, is_antibiotic: amr.isAntibiotic(s.wirkstoff), price_alternatives: altCount(s) })) };
  }],
  ['GET', /^\/api\/shortages\/([^/]+)$/, true, async ({ userId, params }) => {
    const d = shortages.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Engpass nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/shortages\/([^/]+)\/post$/, true, async ({ userId, params, body }) => shortages.postAbout(userId, params[0], { body: body.body, visibility: body.visibility })],
  ['POST', /^\/api\/shortages\/([^/]+)\/status$/, true, async ({ userId, params, body }) => shortages.updateStatus(userId, params[0], { status: body.status, sourceUrl: body.sourceUrl })],
  ['POST', /^\/api\/shortages\/report$/, true, async ({ userId, body }) => shortages.reportShortage(userId, { wirkstoff: body.wirkstoff, bezeichnung: body.bezeichnung, grund: body.grund, status: body.status, voraussichtlichBis: body.voraussichtlichBis })],
  ['POST', /^\/api\/shortages\/([^/]+)\/confirm$/, true, async ({ userId, params }) => shortages.confirmShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/unconfirm$/, true, async ({ userId, params }) => shortages.unconfirmShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/resolve$/, true, async ({ userId, params }) => shortages.resolveShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/expected$/, true, async ({ userId, params, body }) => shortages.updateExpectedDate(userId, params[0], body.voraussichtlichBis)],
  ['POST', /^\/api\/shortages\/([^/]+)\/report-update$/, true, async ({ userId, params, body }) => shortages.updateShortageReport(userId, params[0], { status: body.status, grund: body.grund })],

  // ── Beobachtungsliste (Wirkstoffe im Blick behalten) ──
  ['GET', /^\/api\/watchlist$/, true, async ({ userId }) => ({ items: shortages.myWatchlist(userId) })],
  ['POST', /^\/api\/watchlist$/, true, async ({ userId, body }) => ({ items: shortages.watch(userId, body.wirkstoff) })],
  ['POST', /^\/api\/watchlist\/bulk$/, true, async ({ userId, body }) => ({ items: shortages.watchMany(userId, body.wirkstoffe) })],
  ['POST', /^\/api\/watchlist\/alert-all$/, true, async ({ userId, body }) => shortages.setWatchAlertAll(userId, body.pct)],
  ['DELETE', /^\/api\/watchlist\/([^/]+)$/, true, async ({ userId, params }) => ({ items: shortages.unwatch(userId, decodeURIComponent(params[0])) })],
  ['POST', /^\/api\/watchlist\/([^/]+)\/note$/, true, async ({ userId, params, body }) => ({ items: shortages.setWatchNote(userId, decodeURIComponent(params[0]), body.note) })],
  ['POST', /^\/api\/watchlist\/([^/]+)\/alert$/, true, async ({ userId, params, body }) => ({ items: shortages.setWatchAlert(userId, decodeURIComponent(params[0]), body.pct) })],

  // ── Preise (Priorität 3) ──
  ['GET', /^\/api\/prices$/, true, async ({ userId }) => { ensureFeatureAllowed('price_compare', userId); return { comparisons: prices.comparisons(userId), savings: prices.savingsSummary() }; }],
  ['GET', /^\/api\/prices\/([^/]+)$/, true, async ({ userId, params }) => {
    ensureFeatureAllowed('price_compare', userId);
    const d = prices.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Preis nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/prices\/([^/]+)\/post$/, true, async ({ userId, params, body }) => { ensureFeatureAllowed('price_compare', userId); return prices.postAbout(userId, params[0], { body: body.body, visibility: body.visibility }); }],

  // ── Top-10-Rabatte (Priorität 5) — in Ländern mit Rx-Rabatt-/Werbeverbot gesperrt ──
  // Land + Freitext: Aktionen sind rechtsraumgebunden, und die Suche nach
  // Wirkstoff (INN) oder Handelsname ist der Weg, auf dem Einkauf tatsaechlich
  // sucht — „habe ich fuer Pantoprazol gerade eine Aktion?".
  ['GET', /^\/api\/rabatte$/, true, async ({ userId, query }) => {
    ensureFeatureAllowed('deals', userId);
    return { rabatte: rabatte.top10(userId, {
      country: activeCountry(userId, query),
      q: query.get('q') || null,
    }) };
  }],
  ['GET', /^\/api\/rabatte\/([^/]+)$/, true, async ({ userId, params, query }) => {
    ensureFeatureAllowed('deals', userId);
    const d = rabatte.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Rabatt-Aktion nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/rabatte\/([^/]+)\/post$/, true, async ({ userId, params, body, query }) => { ensureFeatureAllowed('deals', userId); return rabatte.postAbout(userId, params[0], { body: body.body, visibility: body.visibility }); }],

  // ── Bestandsaustausch (Biete/Suche) — in Ländern ohne zulässige P2P-Abgabe gesperrt ──
  ['GET', /^\/api\/exchange$/, true, async ({ userId, query }) => { ensureFeatureAllowed('stock_exchange', userId); return { entries: exchange.list(userId, { kind: query.get('kind') || null, status: query.get('status') || 'offen', q: query.get('q') || null, bundesland: query.get('bundesland') || null, sort: query.get('sort') || null,
      // Rechtsraum: Eine Wiener Apotheke soll keine brasilianischen Angebote
      // sehen — Arzneimittelhandel ueber Grenzen hinweg ist genehmigungs-
      // pflichtig (AMG Paragraf 48, Einfuhrlizenzen je Land).
      country: activeCountry(userId, query) }) }; }],
  ['POST', /^\/api\/exchange$/, true, async ({ userId, body, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.create(userId, { kind: body.kind, bezeichnung: body.bezeichnung, menge: body.menge, ort: body.ort, bundesland: body.bundesland, note: body.note, image: body.image, ablauf: body.ablauf }); }],
  ['GET', /^\/api\/exchange\/mine$/, true, async ({ userId, query }) => { ensureFeatureAllowed('stock_exchange', userId); return { entries: exchange.mine(userId, { status: query.get('status') || null }) }; }],
  ['POST', /^\/api\/exchange\/([^/]+)\/resolve$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.markResolved(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/reopen$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.reopen(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/reserve$/, true, async ({ userId, params, body }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.setReserved(userId, params[0], body.reserved !== false); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/renew$/, true, async ({ userId, params }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.renew(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/update$/, true, async ({ userId, params, body }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.update(userId, params[0], { bezeichnung: body.bezeichnung, menge: body.menge, ort: body.ort, bundesland: body.bundesland, note: body.note, ablauf: body.ablauf }); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/delete$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.remove(userId, params[0]); }],

  // ── Übergreifende Suche (Priorität 7) ── gesperrte Module aus den Treffern nehmen.
  ['GET', /^\/api\/search$/, true, async ({ userId, query }) => {
    const r = await search.search(userId, query.get('q') || '');
    const home = userCountry(userId);
    const rabatteHits = isFeatureBlocked(home, 'deals') ? [] : r.rabatte;
    const exchangeHits = isFeatureBlocked(home, 'stock_exchange') ? [] : r.exchange;
    const priceHits = isFeatureBlocked(home, 'price_compare') ? [] : r.prices;
    const total = r.total - (r.rabatte.length - rabatteHits.length) - (r.exchange.length - exchangeHits.length) - (r.prices.length - priceHits.length);
    return { ...r, rabatte: rabatteHits, exchange: exchangeHits, prices: priceHits, total, posts: enrichPosts(r.posts, userId) };
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ── Zahlungs-Webhook (ROHER Body für die Signaturprüfung) — VOR dem JSON-Router. ──
  const wh = req.method === 'POST' && pathname.match(/^\/api\/payments\/webhook\/([a-z0-9_]+)$/);
  if (wh) {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const lowerHeaders = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
        const result = await payments.handleWebhook(wh[1], raw, lowerHeaders);
        saveSoon();
        return json(req, res, 200, result ?? { ok: true });
      } catch (e) {
        return json(req, res, e.status || 400, e.code ? { error: e.message, code: e.code } : { error: e.message });
      }
    });
    return;
  }

  // ── API ──
  if (pathname.startsWith('/api/')) {
    const route = routes.find(([m, rx]) => m === req.method && rx.test(pathname));
    if (!route) return json(req, res, 404, { error: 'Nicht gefunden' });
    const [, rx, authRequired, handler] = route;
    let userId = userIdFrom(req);
    // Token gültig signiert, aber Nutzer existiert nicht mehr (Konto gelöscht) -> wie nicht
    // angemeldet behandeln, damit ein sauberes 401 statt eines Folgefehlers (400) kommt.
    if (userId && !repo.getUserById(userId)) userId = null;
    // Eigener Code, damit das Frontend eine ABGELAUFENE/UNGÜLTIGE Sitzung von anderen
    // 401 (falscher Login, falsches Passwort) unterscheiden und sauber zum Login führen kann.
    if (authRequired && !userId) return json(req, res, 401, { error: 'Nicht angemeldet', code: 'not_authenticated' });
    try {
      const body = (req.method === 'POST') ? await readBody(req) : {};
      const params = (pathname.match(rx) || []).slice(1);
      // Client-IP (hinter dem Render-Proxy steht die echte IP in x-forwarded-for).
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
      const result = await handler({ userId, body, params, query: url.searchParams, ip });
      if (req.method !== 'GET') saveSoon(); // Zustand nach jeder erfolgreichen Schreiboperation sichern (POST/DELETE)
      return json(req, res, 200, result ?? { ok: true });
    } catch (e) {
      const code = e instanceof ForbiddenError ? 403 : (e.status || 400);
      // e.code (falls gesetzt) erlaubt dem Frontend, die Meldung zu übersetzen.
      const payload = e.code ? { error: e.message, code: e.code } : { error: e.message };
      if (e.retryAfterS != null) payload.retry_after_s = e.retryAfterS; // 429: Wartezeit fürs Frontend
      return json(req, res, code, payload);
    }
  }

  // ── Statisches Frontend ──
  let file = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    file = '/index.html'; // SPA-Fallback
  }
  const serve = path.join(PUBLIC_DIR, file);
  const ext = path.extname(serve);
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain',
  };
  const type = MIME[ext] || 'application/octet-stream';
  const isText = /^text\/|application\/(json|manifest\+json|javascript)/.test(type);
  // ETag aus Größe+mtime (billig, ohne Datei zu lesen): unverändert -> 304, spart Bandbreite.
  // Cache-Control no-cache = immer revalidieren, damit Nutzer:innen nie eine veraltete
  // Version bekommen (die Assets sind nicht content-gehasht). Wichtig für langsame Leitungen.
  const stat = fs.statSync(serve);
  const etag = 'W/"' + stat.size.toString(16) + '-' + Math.round(stat.mtimeMs).toString(16) + '"';
  const headers = { 'Content-Type': type + (isText ? '; charset=utf-8' : ''), 'Cache-Control': 'no-cache', ETag: etag };
  if ((req.headers['if-none-match'] || '') === etag) { res.writeHead(304, headers); return res.end(); }
  // Textassets (JS/CSS/HTML) gzip-komprimieren, wenn der Client es unterstützt — app.js
  // ist ~250 KB und schrumpft damit deutlich, spürbar auf mobilen Apotheken-Leitungen.
  if (isText && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
    res.writeHead(200, headers);
    fs.createReadStream(serve).pipe(zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(serve).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`ApoPulse Feed-Server läuft auf http://localhost:${PORT}`);
  // Persistenz-Status deutlich anzeigen: Ein Produktiv-Deploy OHNE APOPULSE_DATA_FILE
  // läuft rein im Speicher — bei jedem Neustart sind ALLE Daten weg. Das darf nicht
  // unbemerkt passieren, darum eine laute Warnung (nicht in der Testumgebung).
  if (process.env.NODE_ENV !== 'test') {
    const d = durabilityReport();
    // Die Kennung steht AUCH an der guten Meldung, nicht nur an der Warnung.
    // Sonst lassen sich zwei Protokolle nicht nebeneinanderlegen — und genau
    // das war nötig, um am 05.09.2026 zu sehen, dass der Dienst mit der
    // Datenbank ein anderer war als der mit der Kundendomain.
    console.log(`ApoPulse: Datenhaltung — ${d.level}: ${d.summary}${dienstKennung()}`);
    for (const zeile of d.warnings) console.warn('⚠️  ' + zeile);
  }
  // ── Zustand und Feed aus der Datenbank holen ────────────────────────────
  // Reihenfolge zählt: ERST der Gesamtzustand (Konten, Profile, Beiträge),
  // DANN die News-Nachlese. Andersherum legte die Nachlese Beiträge an, die der
  // Zustand gleich darauf überschreibt.
  if (process.env.NODE_ENV !== 'test' && db) {
    restoreStateFromDb()
      .then(() => restoreNewsFromDb())
      .catch((e) => {
      console.warn('ApoPulse: Wiederherstellung aus der Datenbank fehlgeschlagen — '
        + ((e && e.message) || e) + '. Die App läuft weiter; der Feed füllt sich '
        + 'dann über den nächsten Abruf.');
    });
  }

  // ── Automatische Datenaufnahme ──────────────────────────────────────────
  // Zwei Aufgaben mit eigenem Takt (Owner-Vorgabe): News alle 5 Minuten,
  // Engpässe alle 4 Stunden. Beide laufen versetzt an, damit der erste Request
  // nach einem Deploy nicht mit mehreren Netzabrufen um die CPU kämpft.
  // In Tests deaktiviert — sonst greift jeder Testlauf ins Netz.
  if (process.env.NODE_ENV !== 'test') {
    scheduler.add('news', {
      run: runNewsIngest,
      intervalMs: INTERVALS.news,
      startDelayMs: 8_000,   // erst antworten können, dann Daten holen
    });
    scheduler.add('shortages', {
      run: runShortageIngest,
      intervalMs: INTERVALS.shortages,
      startDelayMs: 25_000,
    });

    const newsCount = sourcesByKind('news', process.env).length;
    const shortageCount = Object.keys(liveSources()).length + Object.keys(livePriceSources()).length
      + Object.keys(liveRabatteSources()).length + sourcesByKind('shortages', process.env).length;
    console.log(
      `ApoPulse: Automatik aktiv — News alle ${INTERVALS.news / 60000} min aus ${newsCount} Quelle(n), ` +
      `Engpässe alle ${INTERVALS.shortages / 3600000} h aus ${shortageCount} Quelle(n). ` +
      'Stand jederzeit unter GET /api/live/status.',
    );
  }
});

// Für Integrationstests: erlaubt server.close(), damit der Prozess sauber endet.
export { server as httpServer };
