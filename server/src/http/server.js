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
import { bilderAlsAdresse, bildHolen } from '../domain/bilder.js';
import { startseiteKopf, kopfSprache, manifestSprache, startseiteCsp } from './startseiteKopf.js';
import { schlankSicher } from './schlank.js';
import { kodierungWaehlen, kodierenSync, createKompressionsSpeicher, createVersionsKennung } from './komprimierung.js';
import { createSprachdateien } from './sprachdateien.js';
import { landVorschlag } from '../domain/landVorschlag.js';
import { faktorenAusUmgebung, preisCents } from '../domain/regionPreis.js';
import { createSocialService } from '../services/social.js';
import { createShortagesService } from '../services/shortages.js';
import { createPricesService } from '../services/prices.js';
import { createRabatteService } from '../services/rabatte.js';
import { createExchangeService } from '../services/exchange.js';
import { createSearchService } from '../services/search.js';
import { createRxNormService } from '../services/rxnorm.js';
import { createPresseDienst } from '../services/presse.js';
import { createLagebildDienst } from '../services/lagebild.js';
import { createLogistikRepo } from '../repo/logistikRepo.js';
import { createLogistikService } from '../services/logistik.js';
// AppError wird in drei Routen geworfen (Ausweich-Suche, Uebersetzungs-Bremse).
// Der Import fehlte: Die Routen antworteten mit „AppError is not defined" statt
// mit der gemeinten Meldung — bei der Ratenbremse ein Fehler, der erst unter
// Last aufgefallen waere.
import { AppError } from '../domain/errors.js';
import { HANDLE_RE, normalizeHandle, freierHandle } from '../domain/handle.js';
import { createSortiment } from '../services/sortiment.js';
import { vorratsRadar } from '../services/radar.js';
import { teilseite } from './teilseite.js';
import { createAnzeigen } from '../services/anzeigen.js';
import { regionLage } from '../services/regionLage.js';
import { warnTyp } from '../domain/warnung.js';
import { ersteSchritte } from '../services/ersteSchritte.js';
import { startklar } from '../services/startklar.js';
import { createOeffentlicheSeiten } from '../services/oeffentlicheSeiten.js';
import { createWebPush, pushNachricht, testNachricht, PUSH_TYPEN } from '../services/webPush.js';
import { createRechnungsnummern } from '../services/rechnungsnummern.js';
import { aktualitaet, zaehlendeApotheken, istBestaetigt, vertrauenEinstellen, ZAEHLT_AB_STUNDEN } from '../services/shortages.js';
import { createRechnungen } from '../services/rechnungen.js';
import { createEinladungen, CODE_RE as EINLADUNG_RE } from '../services/einladungen.js';
import { createKanaele, istVorschauAbruf } from '../services/kanaele.js';
import { createDatenApi, zugangPruefen, engpassZeile, fuerSchnittstelle, alsCsv } from '../services/datenApi.js';
import { werbeplaetzeAusUmgebung, ZIELGRUPPEN } from '../data/werbeplaetze.js';
import { createOverviewService } from '../services/overview.js';
import { createOAuthService, buildProvidersFromEnv } from '../services/oauth.js';
import { createPaymentsService, buildPaymentProvidersFromEnv } from '../services/payments.js';
import { createCryptoRates } from '../services/cryptoRates.js';
import { createFxRates } from '../services/fxRates.js';
import { cryptoWallets, paymentRoutes } from '../data/cryptoWallets.js';
import { listProducts, getProduct } from '../data/products.js';
import { createAmrService } from '../services/amr.js';
import { createPatientInfoService } from '../services/patientInfo.js';
import { COUNTRIES, DEFAULT_COUNTRY, isValidCountry, listCountries, normalizeCountry, normalizeLocale, SUPPORTED_LOCALES, istQuellRegion, regionVon, laenderInRegion } from '../data/countries.js';
import { countryConfig, featureStatus, isFeatureBlocked } from '../data/countryFeatures.js';
import {
  availablePurposes, calculateFee, checkoutFieldsFor, complianceProfile,
  feeModel, paymentMethodsFor, PURPOSES, PURPOSE_LABELS,
} from '../domain/compliance.js';
import { plansForCountry, priceFor } from '../data/plans.js';
import { isLive, isPriceLive, isRabatteLive, liveSources, livePriceSources, liveRabatteSources, refreshShortages, refreshPrices, refreshRabatte, fetchJsonDefault } from '../services/liveData.js';
import { createScheduler, INTERVALS } from '../services/scheduler.js';
import { createNewsSeenStore, ingestNews } from '../services/newsIngest.js';
import { activeSources, sourcesByKind, shortagesFromCsv, shortagesFromJson, dedupeShortages, fetchTextDefault, fetchSourceAlleSeiten, newsKey } from '../services/sources.js';
import { createDealsService, seedDemoDealsIfNoneRunning } from '../services/deals.js';
import { createPrismaStore } from '../repo/prismaStore.js';
import { listAccountTypes, normalizeAccountType } from '../data/accountTypes.js';
import { issueToken, tokenDetails, sitzungGueltig, issueZweckToken, verifyZweckToken } from './token.js';
import { createMailer } from '../services/mailer.js';
import { createPasswortLink } from '../services/passwortLink.js';
import { createSms } from '../services/sms.js';
import { createTelefonLogin, telefonAdresse } from '../services/telefonLogin.js';
import { VORWAHL, normalisiereTelefon } from '../domain/telefon.js';
import { hashPassword, hashPasswordAsync } from '../domain/password.js';
import { generateRecoveryCodesAsync } from '../domain/recoveryCodes.js';
import { createWochenbericht } from '../services/wochenbericht.js';
import { createEigeneQuellen } from '../services/eigeneQuellen.js';
import { betriebsZahlen } from '../services/betrieb.js';
import { createRateLimiter } from '../domain/rateLimiter.js';
import { dienstKennung } from './serviceIdentity.js';
import { assetlinksDokument, assetlinksStatus } from './assetlinks.js';
import { featureListe, ruhenderBereichFuer } from '../data/features.js';
import { createCoverageStore, landStatus, abrufStand } from '../services/coverage.js';
import { suchProtokoll } from '../services/feedDiscovery.js';
import { createSignalStore, baueSignal } from '../services/signals.js';
import { benachrichtigeZuSignal } from '../services/signalAlerts.js';
import { extractSignal, aiKonfiguration, KATEGORIEN as SIGNAL_KATEGORIEN } from '../services/aiExtract.js';
import { createTranslateService, MAX_ZEICHEN as TRANSLATE_MAX, ZIELSPRACHEN as TRANSLATE_SPRACHEN } from '../services/aiTranslate.js';
import { rxErlaubt, verificationStatusFor } from '../domain/jurisdiction.js';
import { erfundeneStartmeldungenEntfernen } from '../services/startbereinigung.js';
import { createChronik, chronikFuerBetrachter } from '../services/chronik.js';
import { createFruehwarnung } from '../services/fruehwarnung.js';
import { gleicherWirkstoff, wirkstoffSchluessel } from '../domain/inn.js';

// Login-Brute-Force-Schutz: max. 5 Fehlversuche je (IP+E-Mail) in 15 Minuten.
const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
// Passwort-Reset: eng begrenzt, damit Wiederherstellungscodes nicht erraten werden.
const resetLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
// Zusätzlich JE E-MAIL, unabhängig von der Adresse: Die IP stammt aus dem
// ersten Eintrag von X-Forwarded-For — den setzt der Client selbst. Mit
// wechselnden Angaben dort war die Bremse oben umgehbar (Passwort- bzw.
// Wiederherstellungscode-Raten ohne Grenze, bis 10/2026). Großzügiger als
// je Adresse, weil sich so auch ein fremdes Konto kurz sperren lässt.
const loginJeKonto = createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
const resetJeKonto = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
// GETEILTE ADRESSEN: In Afrika teilen sich oft Hunderte Handy-Kund:innen eines Netzes
// eine öffentliche IP (Carrier-NAT). Bremsen nur je IP sperren dort am Start-Tag echte
// Apotheker:innen aus („Zu viele Versuche", obwohl sie es zum ersten Mal versuchen).
// Darum: Der eigentliche Schutz hängt an Konto bzw. Nummer; je IP gilt nur eine weite Grenze.
// Passwort-Links: jede Anfrage verschickt eine Mail — je Konto eng (3/h), damit niemand
// fremde Postfächer flutet; je IP 30 / 15 min.
const linkLimiter = createRateLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
const linkJeKonto = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
// Link einlösen: Der Link ist ein langes Zufallsgeheimnis (nicht erratbar) — Fehlversuche je IP
// zählen nur gegen Durchprobieren. Eigene Bremse, damit Tippfehler beim neuen Passwort von
// Nachbarn im selben Netz nicht den Wiederherstellungscode-Schutz oben auslösen.
const linkEinloesen = createRateLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
// SMS-Codes kosten je Stück Geld: je Nummer 3 pro Stunde, je IP 30 (geteilte Netze, s. o.),
// alle zusammen APOPULSE_SMS_MAX_STUNDE. Code-Prüfung: 20 Fehlversuche / 15 min je IP UND Nummer
// (zusätzlich verbrennt der Code nach 5 Fehlversuchen, services/telefonLogin.js — bei 3 Codes
// pro Stunde sind das höchstens 15 Rateversuche je Nummer und Stunde bei 1 000 000 Möglichkeiten).
const telCodeJeNummer = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const telCodeJeGeraet = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });
const telPruefJeGeraet = createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
// Obergrenze für ALLE SMS zusammen: Die Geräte-Bremse hängt an X-Forwarded-For, das der Client selbst
// setzt — mit wechselnden Nummern und Angaben dort wäre sie umgehbar. Die Summe nicht.
const telCodeGesamt = createRateLimiter({ max: Math.max(1, Number(process.env.APOPULSE_SMS_MAX_STUNDE) || 100), windowMs: 60 * 60 * 1000 });
// Uebersetzungen: 60 Anbieter-Aufrufe je Stunde und Konto. Das ist kein
// Missbrauchsschutz im engeren Sinn, sondern eine KOSTENBREMSE — jeder Aufruf
// geht gegen die Abrechnung des Owners. Antworten aus dem Zwischenspeicher
// zaehlen bewusst nicht mit: Sie kosten nichts.
const translateLimiter = createRateLimiter({ max: 60, windowMs: 60 * 60 * 1000 });
// Lagebild: jeder neue Belegstand ist ein Anbieter-Aufruf. Zwischengespeicherte
// Antworten zaehlen nicht (siehe Route).
const lagebildLimiter = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

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
  // Engpass-Meldungen zusätzlich als Push aufs Handy (services/webPush.js).
  nachBenachrichtigung: (n) => { if (PUSH_TYPEN.has(n.type)) pushAn(n.userId, n); },
});
// ── Web-Push (Engpass-Alarm aufs Handy) ─────────────────────────────────────
//  Schlüssel fest aus der Umgebung (empfohlen) — sonst einmal erzeugt und mit
//  der Sicherung gespeichert. Wechselt der Schlüssel, sind alle Abos wertlos.
const vapidAusUmgebung = !!(process.env.APOPULSE_VAPID_PUBLIC_KEY && process.env.APOPULSE_VAPID_PRIVATE_KEY);
const webPush = createWebPush({
  ...(vapidAusUmgebung ? { schluessel: { publicKey: process.env.APOPULSE_VAPID_PUBLIC_KEY.trim(), privateKey: process.env.APOPULSE_VAPID_PRIVATE_KEY.trim() } } : {}),
  ausUmgebung: vapidAusUmgebung,
  subject: String(process.env.APOPULSE_PUBLIC_URL || 'https://www.apopulse.com').replace(/\/+$/, ''),
  // Nur für Tests: lokaler nachgestellter Push-Dienst.
  lokalErlaubt: process.env.APOPULSE_PUSH_LOKAL_ERLAUBT === '1',
});
function pushSprache(userId) {
  const p = social.getProfile(userId);
  const cc = String((p && p.country) || '').toUpperCase();
  return (COUNTRIES[cc] && COUNTRIES[cc].locale_default) || 'de';
}
function pushAn(userId, n) {
  if (!webPush.geraete(userId)) return;
  const sprache = pushSprache(userId);
  const landName = (c) => { try { return new Intl.DisplayNames([sprache], { type: 'region' }).of(c) || c; } catch { return c; } };
  const msg = pushNachricht(n, { sprache, landName });
  if (msg) webPush.senden(userId, msg).then(() => saveSoon()).catch(() => {});
}
// ── Referenzdaten: standardmaessig AUS ──────────────────────────────────────
//  Owner-Entscheidung vom 04.10.2026: „Keine Beispieldaten." Die kuratierten
//  Referenzdaten (Engpaesse, Preise, Rabatte) erscheinen deshalb nicht mehr im
//  Betrieb. Was kommt, kommt aus echten Quellen — oder es kommt nichts, und
//  die Ansicht sagt das (services/coverage.js, UI „Live-Verbindung aktiv").
//
//  WAS DAS KOSTET, offen gesagt: Preisvergleich und Rabatte haben KEINE
//  Live-Quelle. Sie sind damit bis zu einer echten Grosshandels-Anbindung
//  leer. Das ist der Preis fuer die Zusage, dass jede angezeigte Zahl echt
//  ist — und er ist bewusst bezahlt.
//
//  Zurueckschaltbar ohne Deploy: APOPULSE_REFERENCE_DATA=an. Die Daten sind
//  nicht geloescht, sondern abgeschaltet — dieselbe Linie wie bei den
//  geparkten Bereichen (data/features.js): Wer loescht, kann sich nicht
//  korrigieren.
const referenzDaten = /^(an|on|true)$/i.test(String(process.env.APOPULSE_REFERENCE_DATA || '').trim());
const seedMarkt = referenzDaten && !restoring;
const shortagesRepo = createShortagesRepo({ seed: seedMarkt });
const shortages = createShortagesService(shortagesRepo, social, {
  hasPremium: (userId) => payments.hasFeature(userId, 'premium'),
  // Moderation bei auffälligen Apotheken-Meldungen benachrichtigen (services/shortages.js, pruefungMelden).
  moderatoren: () => socialRepo.listProfiles().filter((p) => social.isModerator(p.user_id)).map((p) => p.user_id),
  vonWem: (uid) => einladungen.vonWem(uid), // einladungen wird weiter unten angelegt; Aufruf erst zur Laufzeit
});
// „Bestätigt" zählt nur Konten ab ZAEHLT_AB_STUNDEN Alter (services/shortages.js) — gegen Schein-Apotheken.
// APOPULSE_BESTAETIGUNG_AB_STUNDEN: nur für Tests (0), im Betrieb nicht setzen.
vertrauenEinstellen({
  kontoSeit: (uid) => { const u = repo.getUserById(uid); return u ? u.created_at : null; },
  abStunden: /^\d+$/.test(process.env.APOPULSE_BESTAETIGUNG_AB_STUNDEN || '') ? Number(process.env.APOPULSE_BESTAETIGUNG_AB_STUNDEN) : ZAEHLT_AB_STUNDEN,
});
const pricesRepo = createPricesRepo({ seed: seedMarkt });
const rabatteRepo = createRabatteRepo({ seed: seedMarkt });
// Rabatte in den Preisvergleich einblenden: eine laufende Aktion kann günstiger
// sein als der beste AEP — das soll der Einkauf an einer Stelle sehen.
const prices = createPricesService(pricesRepo, social, rabatteRepo);
const rabatte = createRabatteService(rabatteRepo, social);
const exchangeRepo = createExchangeRepo();
// Muss VOR applySnapshot() stehen: Das Wiederherstellen lädt auch diesen
// Bestand. Stand er weiter unten (wie bis 10/2026), brach jeder Start mit
// gespeicherter Datei ab — „Cannot access 'logistikRepo' before
// initialization". Ein Frischstart ohne Datei merkte davon nichts.
const logistikRepo = createLogistikRepo();
// Engpass-Chronik: ebenfalls vor applySnapshot() — sie wird mit wiederhergestellt.
const chronik = createChronik();
const fruehwarnung = createFruehwarnung({
  chronik, shortagesRepo, social,
  istPremium: (uid) => payments.hasFeature(uid, 'premium'),
  heimatVon: (uid) => { const p = social.getProfile(uid); return p && p.country; },
});
// Anzeigen für Unternehmen der Branche (services/anzeigen.js, docs/WERBUNG.md).
// Rechnungssteller: ohne vollständige Angaben gibt es keine Zahlung per Rechnung.
const betreiber = {
  firma: process.env.APOPULSE_FIRMA_NAME || '', anschrift: process.env.APOPULSE_FIRMA_ANSCHRIFT || '',
  ust_id: process.env.APOPULSE_FIRMA_UST_ID || '', iban: process.env.APOPULSE_BANK_IBAN || '',
  bic: process.env.APOPULSE_BANK_BIC || '', inhaber: process.env.APOPULSE_BANK_INHABER || '',
  ust_satz: Number(process.env.APOPULSE_UST_SATZ) || 0,
  // Empfänger außerhalb der EU: keine EU-Umsatzsteuer (domain/umsatzsteuer.js). „mit" = altes Verhalten.
  ust_drittland: String(process.env.APOPULSE_UST_DRITTLAND || '').trim().toLowerCase(),
};
const datenApi = createDatenApi();
const einladungen = createEinladungen();
// Herkunft (?k=tiktok): nur Summen je Tag und Kanal, nie je Konto (services/kanaele.js).
const kanaele = createKanaele();
// Eine Rechnungsnummern-Reihe für Anzeigen UND Tarife (lückenlos, eindeutig).
const rechnungsnummern = createRechnungsnummern();
const anzeigen = createAnzeigen({
  nummern: rechnungsnummern,
  plaetze: werbeplaetzeAusUmgebung(process.env),
  profilVon: (uid) => social.getProfile(uid),
  rxErlaubtFuer: (uid) => rxErlaubt(rxBetrachter(uid)),
  istModerator: (uid) => social.isModerator(uid),
  moderatoren: () => socialRepo.listProfiles().filter((p) => social.isModerator(p.user_id)).map((p) => p.user_id),
  benachrichtige: (n) => social.pushNotification(n),
  betreiber,
  // Klick-Zeichen: HMAC mit eigenem Zweck — taugt nie als Anmeldung.
  klickZeichen: {
    ausstellen: (uid, id, tag) => issueZweckToken('anzeige_klick', `${uid}|${id}|${tag}`),
    pruefen: (z, id) => { const v = verifyZweckToken('anzeige_klick', z); if (!v) return null; const [uid, kid, tag] = v.split('|'); return kid === id ? { uid, tag } : null; },
  },
});
// Sortiments-Check: eigene Liste gegen die Behördenlisten (services/sortiment.js).
const sortiment = createSortiment({ chronik, shortagesRepo, istPremium: (uid) => payments.hasFeature(uid, 'premium') });
// Wochenbericht per E-Mail (Premium). Ebenfalls VOR applySnapshot(): Wer ihn
// diese Woche schon bekam und wer ihn abbestellt hat, wird mit gesichert.
const mailer = createMailer();
const wochenbericht = createWochenbericht({
  repo, social, chronik, fruehwarnung, shortagesRepo, mailer, laender: COUNTRIES,
  istPremium: (uid) => payments.hasFeature(uid, 'premium'),
  appUrl: String(process.env.APOPULSE_PUBLIC_URL || 'https://www.apopulse.com').replace(/\/+$/, ''),
  zweckToken: (uid) => issueZweckToken('wb_abmelden', uid),
});
// Passwort vergessen → Link per E-Mail (services/passwortLink.js). Nur aktiv,
// wenn der E-Mail-Versand eingerichtet ist; sonst bleibt der Wiederherstellungscode.
const passwortLink = createPasswortLink({
  repo, mailer, hashPassword,
  ausstellen: (inhalt) => issueZweckToken('pw_reset', inhalt),
  pruefen: (t) => verifyZweckToken('pw_reset', t),
  basis: String(process.env.APOPULSE_PUBLIC_URL || 'https://www.apopulse.com').replace(/\/+$/, ''),
});
// Anmelden per Telefonnummer + SMS-Code (services/telefonLogin.js). Nur mit SMS-Anbieter aktiv.
const sms = createSms();
const telefonLogin = createTelefonLogin({
  sms, repo,
  ausstellen: (inhalt) => issueZweckToken('tel_reg', inhalt),
  pruefen: (t) => verifyZweckToken('tel_reg', t),
});
// Eigene Engpass-Quellen der Redaktion (services/eigeneQuellen.js) — auch sie
// werden mit gesichert, also VOR applySnapshot() anlegen.
const eigeneQuellen = createEigeneQuellen({ istLand: (cc) => !!COUNTRIES[cc], lokalErlaubt: process.env.APOPULSE_QUELLEN_LOKAL_ERLAUBT === '1' });
// Alle Engpass-Quellen: eingebaute + Umgebung + von der Redaktion eingetragene.
const engpassQuellen = () => [...sourcesByKind('shortages', process.env), ...eigeneQuellen.liste()];

/**
 * Eine Engpass-Quelle abrufen und lesen — EIN Weg für den Abruf im Takt und
 * für den Probe-Abruf der Redaktion. Zwei Wege hätten auseinanderlaufen
 * können, und dann zeigte „Jetzt testen" etwas anderes als der echte Lauf.
 */
async function holeEngpassQuelle(source) {
  const { raw } = await fetchSourceAlleSeiten(source);
  // Spaltenzuordnung der Quelle (eigene Quellen) und aus der Umgebung.
  const columns = { ...(source.columns || {}), ...sourceColumns(source.id) };
  return source.format === 'json'
    ? shortagesFromJson(raw, { columns })
    : shortagesFromCsv(raw, { columns, standardStatus: source.standardStatus || null });
}
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
// Statische Dateien: ETag aus dem Inhalt (+ Sprache bei Startseite/Manifest), damit ein
// Deploy unveränderte Dateien nicht neu herunterladen lässt; zugleich Schlüssel des
// Kompressions-Speichers (http/komprimierung.js).
const statischerEtag = createVersionsKennung();
// Je Sprache eine Datei (/i18n/<sp>.js) statt aller Sprachen — http/sprachdateien.js.
const sprachdateien = createSprachdateien({ datei: path.join(PUBLIC_DIR, 'i18n.js'), sprachen: SUPPORTED_LOCALES });
// Skripte gehen ohne Kommentare/Einrückung hinaus (http/schlank.js; APOPULSE_SCHLANK=aus schaltet ab).
const kompression = createKompressionsSpeicher({
  umformen: (datei, b) => (datei.endsWith('.js') && process.env.APOPULSE_SCHLANK !== 'aus' ? schlankSicher(b, { name: path.basename(datei) }) : b),
});
// Regionale Premium-Preise (domain/regionPreis.js): Heimatland des Kontos, sonst das
// angefragte Land (Anzeige ohne Anmeldung). Ohne APOPULSE_PREISE_REGION: Listenpreis.
const preisFaktoren = faktorenAusUmgebung(process.env); // Standard AFRICA:30 (domain/regionPreis.js)
const preisLand = (uid, country) => (uid ? userCountry(uid) : (country ? normalizeCountry(country) : null));
const preisFuer = (uid, product, { country = null } = {}) => {
  const land = preisLand(uid, country);
  return preisCents(product, land ? regionVon(land) : null, preisFaktoren);
};
// Für die Anzeige: Region, deren Ermäßigung gilt (sonst null) — „Sonderpreis für Afrika".
const preisRegionFuer = (uid, country) => { const land = preisLand(uid, country); const r = land ? regionVon(land) : null; return r && preisFaktoren.has(r) ? r : null; };
const payments = createPaymentsService({
  preisFuer,
  // Krypto-Zahlung einer Anzeigen-Kampagne bestätigt -> Kampagne läuft.
  beiBezahlt: (p) => { if (String(p.product_id || '').startsWith('anzeige:')) anzeigen.bezahlt(p.product_id.slice(8), { methode: 'krypto', payment_id: p.id }); },
  repo,
  providers: buildPaymentProvidersFromEnv(),
  wallets: cryptoWallets, // Direkt-in-Wallet: eigene, öffentliche Empfangsadressen (ENV-überschreibbar)
  rates: cryptoRates,
  fx: fxRates, // für die Näherung des Preises in der Landeswährung
  isModerator: (userId) => social.isModerator(userId),
  // Manuelle Krypto-Prüfung: Meldung an die Moderation, Antwort an die Kundin.
  // Systemmeldungen (keine abschaltbare Kategorie): Eine Zahlungsbestätigung
  // darf nicht an einer Benachrichtigungs-Einstellung scheitern.
  benachrichtige: (o) => social.pushNotification(o),
  moderatoren: () => socialRepo.listProfiles().filter((p) => p.is_editorial).map((p) => p.user_id),
  // Buchungszeile nach PostgreSQL. `db` ist null ohne DATABASE_URL — dann
  // laufen Zahlungen wie bisher nur über Repo + Snapshot. Der Spiegel schaltet
  // NICHTS frei; er schreibt mit (siehe `spiegeln` in services/payments.js).
  mirror: db,
  onPaid: ({ payment, product }) => { console.log(`✅ Zahlung ${payment.id} bezahlt → Feature „${product.feature}" für User ${payment.user_id} freigeschaltet.`); },
});// Rechnungen für Tarife (services/rechnungen.js, docs/RECHNUNGEN.md).
const rechnungen = createRechnungen({
  betreiber, nummern: rechnungsnummern, payments, produkt: getProduct,
  istModerator: (uid) => social.isModerator(uid),
});


/** Einen Snapshot in alle Repos einspielen. Eine Stelle, zwei Quellen. */
function applySnapshot(snap) {
  repo.__load(snap.foundation);
  socialRepo.__load(snap.social);
  logistikRepo.__load(snap.logistik);
  shortagesRepo.__load(snap.shortages);
  pricesRepo.__load(snap.prices);
  rabatteRepo.__load(snap.rabatte);
  exchangeRepo.__load(snap.exchange);
  newsSeen.__load(snap.newsSeen);
  chronik.__load(snap.chronik);
  eigeneQuellen.__load(snap.eigeneQuellen);
  wochenbericht.__load(snap.wochenbericht);
  rechnungsnummern.__load(snap.rechnungsnummern);
  webPush.__load(snap.webPush);
  anzeigen.__load(snap.anzeigen);
  rechnungen.__load(snap.rechnungen);
  datenApi.__load(snap.datenApi);
  einladungen.__load(snap.einladungen);
  kanaele.__load(snap.kanaele);
  // Alte, unbefristete Premium-Freischaltungen aus bezahlten Monats-/Jahres-
  // käufen bekommen ihr Ablaufdatum (services/payments.js, laufzeitenUmstellen).
  const umgestellt = payments.laufzeitenUmstellen();
  if (umgestellt) console.log(`ApoPulse: ${umgestellt} Premium-Freischaltung(en) auf Laufzeit umgestellt.`);
  const weg = erfundeneStartmeldungenEntfernen(socialRepo);
  if (weg) console.log(`ApoPulse: ${weg} erfundene Startmeldung(en) aus dem gesicherten Bestand entfernt.`);
}

if (restoring) {
  applySnapshot(snapshot);
  console.log(`ApoPulse: Daten aus ${persistence.filePath} wiederhergestellt.`);
} else {
  // Redaktions-/Admin-Account (zugleich Moderation) — nur beim
  // Frischstart. Zugangsdaten über ENV steuerbar; sonst zufälliges Passwort, das
  // beim Start einmalig geloggt wird, damit sich die Redaktion anmelden kann.
  const adminEmail = process.env.APOPULSE_ADMIN_EMAIL || 'redaktion@apopulse.at';
  const adminPassword = process.env.APOPULSE_ADMIN_PASSWORD || crypto.randomUUID();
  const red = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'ApoPulse' }, owner: { name: 'ApoPulse-Redaktion', email: adminEmail, password: adminPassword } });
  social.createProfile(red.user.id, { handle: 'apopulse', displayName: 'ApoPulse-Redaktion', isEditorial: true });
  if (!process.env.APOPULSE_ADMIN_PASSWORD) console.log(`ℹ️  Redaktions-/Moderations-Login: ${adminEmail} / ${adminPassword}`);
  // Früher legte der Frischstart hier sechs „News"-Beiträge an (AT/DE/BR), z. B.
  // „BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika
  // betroffen" — mit der Startseite der Behörde als „Quelle". Keiner davon war
  // eine echte Meldung; im News-Livestream standen sie als „vor 9 Minuten" da,
  // nach JEDEM Neustart ohne Datenbank wieder. Erfundene Behördenmeldungen
  // sind genau das, was diese Plattform nicht sein darf (eiserne Regel: keine
  // Beispieldaten). Echte News kommen aus den Abrufen (liveData, presse) und
  // von Menschen; eine leere Ansicht erklärt sich selbst.
  // Starter-Beitrag fürs Stewardship-Fachforum (setzt Ton & Regeln, quellenbelegt).
  social.createPost(red.user.id, {
    body: 'Willkommen im Stewardship-Fachforum 🧫 — anonymisierte Fachdiskussion zum verantwortungsvollen Antibiotikaeinsatz. Bitte keine personenbezogenen Patientendaten posten, sicherheitsrelevante Aussagen nur mit Quelle. Grundlage zur österreichischen Resistenzlage: AURES. #stewardship',
    kind: 'post', sourceUrl: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen',
  });
}

// ── Snapshot sammeln + gedrosselt/atomar auf Platte schreiben ──
function collectSnapshot() {
  return {
    foundation: repo.__dump(), social: socialRepo.__dump(),
    shortages: shortagesRepo.__dump(), prices: pricesRepo.__dump(), rabatte: rabatteRepo.__dump(),
    exchange: exchangeRepo.__dump(), newsSeen: newsSeen.__dump(),
    // MUSS hier stehen. Bei den VerifiedSignals fehlte genau diese Zeile, und
    // deshalb war der gesammelte Bestand nach jedem Deploy weg — gefunden erst
    // Wochen spaeter. Ein neuer Speicher ohne Snapshot-Eintrag ist kein
    // Speicher, sondern ein Zwischenpuffer mit laengerer Lebensdauer.
    logistik: logistikRepo.__dump(),
    chronik: chronik.__dump(),
    eigeneQuellen: eigeneQuellen.__dump(),
    wochenbericht: wochenbericht.__dump(),
    anzeigen: anzeigen.__dump(),
    rechnungsnummern: rechnungsnummern.__dump(),
    webPush: webPush.__dump(),
    rechnungen: rechnungen.__dump(),
    datenApi: datenApi.__dump(),
    einladungen: einladungen.__dump(),
    kanaele: kanaele.__dump(),
  };
}
let saveTimer = null;
// Spätestens 400 ms nach der ERSTEN ungespeicherten Änderung schreiben. Bis 10/2026 schob
// jede neue Änderung den Termin wieder hinaus — bei Dauerbetrieb (alle paar hundert ms
// etwas Neues, z. B. am Start-Tag) wurde die Datei NIE geschrieben; ein Absturz hätte
// alles seit der letzten ruhigen Sekunde gelöscht.
function saveSoon() {
  saveToDbSoon(); // unabhaengig von der Datei: die Datenbank ist der Deploy-Schutz
  if (!persistence || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { persistence.save(collectSnapshot()); } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); }
  }, 400);
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
// ── Fehler außerhalb von Anfragen ──────────────────────────────────────────
//  Ein vergessenes catch in einem Hintergrund-Ablauf (Abruf, Mail, Push) beendete
//  bisher den ganzen Server (Node-Standard). Abgelehnte Zusagen werden jetzt
//  protokolliert und gezählt — der Server läuft weiter. Bei einem echten Programm-
//  fehler (uncaughtException) ist der Zustand unsicher: dann ERST sichern (Datei
//  sofort, Datenbank mit Deckel), DANN beenden — Render startet neu.
const betriebsFehler = { anfragen: 0, hintergrund: 0, zuletzt: null };
process.on('unhandledRejection', (e) => {
  betriebsFehler.hintergrund++; betriebsFehler.zuletzt = new Date().toISOString();
  console.error('Hintergrund-Fehler (Server läuft weiter):', (e && e.stack) || e);
});
process.on('uncaughtException', (e) => {
  console.error('Programmfehler — sichere und starte neu:', (e && e.stack) || e);
  saveNow();
  if (!db) process.exit(1);
  const notbremse = setTimeout(() => process.exit(1), 4000);
  if (notbremse.unref) notbremse.unref();
  db.saveSnapshot(collectSnapshot()).catch(() => {}).finally(() => process.exit(1));
});
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
// Feed seitenweise: Bis 10/2026 kamen ALLE Beiträge eines Landes auf einmal — bei 250
// Beiträgen 200 KB, und es wächst jeden Tag. Am Handy mit schwachem Netz zu viel.
// ?ab=<Anzahl schon geladen>&limit=<höchstens 100>; Standard 30. `weiter` ist das
// nächste `ab`, `mehr` sagt, ob es ältere gibt.
const FEED_SEITE = 30;
function feedSeite(alle, query, userId) {
  const limit = Math.min(100, Math.max(1, parseInt(query.get('limit'), 10) || FEED_SEITE));
  const ab = Math.max(0, parseInt(query.get('ab'), 10) || 0);
  return { posts: enrichPosts(alle.slice(ab, ab + limit), userId), mehr: alle.length > ab + limit, weiter: ab + limit };
}
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
// Bilder gehen als Adresse hinaus (domain/bilder.js) — außer im Datenexport:
// Der soll die eigenen Bilder selbst enthalten, nicht Verweise auf diesen Server.
const json = (req, res, code, obj, { bilderEinbetten = false } = {}) => {
  const payload = Buffer.from(bilderEinbetten ? JSON.stringify(obj) : JSON.stringify(obj, bilderAlsAdresse));
  // no-store: API-Antworten sind persönlich (Konto, Beobachtungsliste, Zahlungen).
  // Ohne diese Angabe durfte der Browser sie zwischenspeichern — auf einem
  // geteilten Gerät sah ein zweites Konto offline die Antwort des ersten.
  // Der gewollte Offline-Stand liegt getrennt je Konto im Service Worker (sw.js).
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  // Größere JSON-Antworten (Feed, Preise) komprimieren (Brotli, sonst gzip), wenn der
  // Client es kann — spart Bandbreite bei jeder Navigation. Kleine lohnen die CPU nicht.
  const kodierung = payload.length > 512 ? kodierungWaehlen(req.headers['accept-encoding']) : null;
  if (kodierung) {
    res.writeHead(code, { ...headers, 'Content-Encoding': kodierung, Vary: 'Accept-Encoding' });
    res.end(kodierenSync(payload, kodierung));
  } else {
    res.writeHead(code, headers);
    res.end(payload);
  }
};
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); // 2 MB (Bilder als data-URL)
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const sitzungAus = (req) => tokenDetails((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
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

// ── Demo-Aktionen: standardmaessig AUS ──────────────────────────────────────
//  Hier stand ein Rueckfall, der Rabattaktionen ERFAND, sobald keine echten
//  vorlagen — korrekt als „simuliert" gekennzeichnet, mit „Demo-Grosshandel A"
//  statt echter Firmennamen. Fuer eine Vorfuehrung war das richtig gedacht.
//
//  Seit dem 04.10.2026 gilt „keine Beispieldaten": Was angezeigt wird, ist
//  echt, oder es wird nichts angezeigt. Ein zweiter Erzeuger neben den
//  Repo-Seeds haette die Zusage still ausgehoehlt — er lief bisher unabhaengig
//  davon und war beim Abschalten der Referenzdaten uebersehen worden. Ein Test
//  (test/reference-data.test.js) prueft jetzt die ANTWORT der Schnittstelle
//  statt nur die Repo-Einstellung; genau so ist er aufgefallen.
//
//  Beide Schalter muessen an sein, damit erfundene Aktionen erscheinen.
if (referenzDaten && process.env.NODE_ENV !== 'test' && process.env.APOPULSE_DEMO_DEALS !== 'off') {
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

/**
 * Beim Start: Live-Signale aus der Datenbank in den Speicher zurückholen.
 *
 * Derselbe Grund wie bei den Meldungen oben, nur schlimmer: Die Signale lagen
 * AUSSCHLIESSLICH im Arbeitsspeicher und waren nach jedem Deploy weg — der
 * Snapshot kannte sie nicht einmal. Die KI-Anreicherung läuft je Meldung
 * genau einmal; was verloren ging, kam nicht wieder, ohne erneut zu zahlen.
 *
 * Bewusst über `uebernehmen` statt `upsert`: Die Zeilen kommen gerade aus der
 * Datenbank. Jede einzeln zurückzuschreiben wären hunderte sinnlose
 * Schreibvorgänge bei jedem Start.
 */
async function restoreSignalsFromDb({ limit = 500 } = {}) {
  const { ok, rows, error } = await db.listSignals({ limit });
  if (!ok) return { skipped: true, reason: error || 'Datenbank nicht lesbar' };
  if (!rows.length) return { restored: 0, reason: 'noch keine Signale gespeichert' };
  const restored = signalStore.uebernehmen(rows);
  if (restored > 0) {
    console.log(`ApoPulse: ${restored} Live-Signal(e) aus der Datenbank geholt `
      + `(${rows.length} gelesen). Die KI-Anreicherung muss nicht erneut laufen.`);
  }
  return { restored, read: rows.length };
}

// Was tatsaechlich ankommt, je Land (services/coverage.js). Wird nach jedem
// News-Durchlauf gefuellt und speist die ehrliche Ansage in leeren Laendern.
const coverage = createCoverageStore();

// Live-Signale: das universelle Modell fuer alle eingehenden Behoerdenmeldungen
// (services/signals.js). Laeuft NEBEN NewsPost/Shortage, nicht statt ihnen —
// die bestehenden Ansichten bleiben unberuehrt, waehrend der Signal-Weg
// waechst.
// `mirror: db` macht aus dem Speicher eine ZWEISCHICHTIGE Ablage: Lesen aus
// dem Arbeitsspeicher, dauerhaft in PostgreSQL (Deduplizierung ueber
// dedupeKey). Ohne DATABASE_URL ist `db` null und es bleibt beim Speicher.
// Begruendung ausfuehrlich in services/signals.js bei createSignalStore.
const signalStore = createSignalStore({ mirror: db });

// Uebersetzen auf Zuruf (services/aiTranslate.js). Ohne KI-Schluessel meldet
// `verfuegbar()` false und die Oberflaeche zeigt den Knopf gar nicht — besser
// als ein Knopf, der eine Fehlermeldung produziert.
const translate = createTranslateService();
// Presse je Land und das KI-Lagebild darauf (services/presse.js, lagebild.js).
// Presse bleibt GETRENNT von Behörden-Feed und VerifiedSignal-Speicher.
const presseDienst = createPresseDienst();
const lagebildDienst = createLagebildDienst({
  presse: presseDienst,
  // Behördenmeldungen des Landes; EU-Meldungen zieht belegeSammeln() selbst
  // für EU-Länder hinzu.
  signale: (land) => [...signalStore.list({ country: land, limit: 40 }), ...signalStore.list({ country: 'EU', limit: 20 })],
});

/**
 * Betrachter fuer die Fachkreis-Pruefung am HTTP-Rand.
 *
 * Dieselbe Ableitung wie in services/exchange.js — bewusst NICHT dort
 * importiert, weil der Zahlungs- und Boersen-Dienst seine eigene Sicht auf den
 * Betrachter hat. Zwei kurze Ableitungen aus denselben Profilfeldern sind
 * leichter zu lesen als eine geteilte Abstraktion, die beide Aufrufer
 * verbiegt.
 */

// Öffentliche Lage eines Landes (Startseite, Teilseite): nur Zahlen und Quelle.
function lageDaten(cc) {
  const b = chronik.wochenbilanz(cc);
  // Apotheken-Meldungen (nicht amtlich) zählen getrennt — in Ländern ohne
  // Behördenliste sind sie die einzige Aussage, die eine Teilseite machen kann.
  const apo = new Map();
  for (const z of shortagesRepo.list({ country: cc })) {
    if (z.provenance !== 'community' || !['kritisch', 'eingeschraenkt'].includes(z.status) || !z.wirkstoff || String(z.country || '').toUpperCase() !== cc) continue;
    if (aktualitaet(z, new Date().toISOString().slice(0, 10)).stufe === 'veraltet') continue; // 30+ Tage ohne Bestätigung
    const k = z.wirkstoff.trim().toLowerCase();
    apo.set(k, (apo.get(k) || false) || istBestaetigt(z, new Date().toISOString().slice(0, 10)));
  }
  const apotheken = apo.size;
  const apotheken_bestaetigt = [...apo.values()].filter(Boolean).length;
  if (!b) return { land: cc, daten: false, apotheken, apotheken_bestaetigt };
  const quellen = [...new Set(shortagesRepo.list({ country: cc })
    .filter((z) => z.provenance === 'verified' && !z.reporter_user_id && String(z.country || '').toUpperCase() === cc)
    .map((z) => z.quelle).filter(Boolean))].slice(0, 3);
  const job = scheduler.status().find((j) => j.name === 'shortages') || null;
  return { land: cc, daten: true, offen: b.offen, neu: b.neu.length, beendet: b.beendet.length, aufzeichnung_seit: b.aufzeichnung_seit, quellen, stand: (job && job.lastRunAt) || null, apotheken, apotheken_bestaetigt };
}
// Ein Wirkstoff in einem Land für die Teilseite: knapp ja/nein, seit wann, laut wem.
// Dieselbe Quelle wie die Engpass-Liste der App (inkl. Herkunft), nichts Erfundenes.
function wirkstoffLage(cc, name) {
  const AKTIV = ['kritisch', 'eingeschraenkt'];
  const treffer = shortagesRepo.list({ country: cc }).filter((z) => AKTIV.includes(z.status) && z.wirkstoff && gleicherWirkstoff(z.wirkstoff, name));
  // Amtlich und Apotheken getrennt: Ein einzelner Apotheken-Hinweis darf auf
  // einer geteilten Vorschau nicht wie „knapp laut Behörde" aussehen. Beispiel-
  // daten (reference) gehören gar nicht auf eine öffentliche Seite.
  const amtlich = treffer.filter((z) => z.provenance === 'verified' && !z.reporter_user_id)
    .sort((a, b) => (a.status === 'kritisch' ? -1 : 0) - (b.status === 'kritisch' ? -1 : 0));
  const apo = treffer.filter((z) => z.provenance === 'community' && aktualitaet(z, new Date().toISOString().slice(0, 10)).stufe !== 'veraltet').sort((a, b) => zaehlendeApotheken(b) - zaehlendeApotheken(a) || (b.confirmations || []).length - (a.confirmations || []).length);
  const m = amtlich[0]; const c = apo[0];
  const wirkstoff = m ? m.wirkstoff : c ? c.wirkstoff : name;
  const kurz = chronik.kurz(wirkstoff, cc);
  const job = scheduler.status().find((j) => j.name === 'shortages') || null;
  return {
    wirkstoff, knapp: !!m, beobachtet_land: !!chronik.aufzeichnungSeit(cc),
    seit_tagen: kurz && kurz.offen_seit_tagen != null ? kurz.offen_seit_tagen : null,
    herkunft: m ? m.provenance : null, quelle: m ? m.quelle : null,
    apotheken: c ? 1 + (c.confirmations || []).length : 0,
    bestaetigt: c ? istBestaetigt(c, new Date().toISOString().slice(0, 10)) : false,
    stand: job && job.lastRunAt ? String(job.lastRunAt).slice(0, 10) : null,
  };
}
// Öffentliche Engpass-Seiten für Suchmaschinen (services/oeffentlicheSeiten.js).
const oeffentlich = createOeffentlicheSeiten({
  chronik, shortagesRepo, laender: COUNTRIES,
  ohneQuelle: (cc) => !engpassQuellen().some((q) => String(q.country || '').toUpperCase() === cc),
  stand: () => { const job = scheduler.status().find((j) => j.name === 'shortages'); return (job && job.lastRunAt) || null; },
});
const seitenAufrufe = new Map(); // 'YYYY-MM-DD' -> Aufrufe der öffentlichen Seiten
/** Öffentliche Basis-Adresse: fest eingestellt, sonst Host/Protokoll aus der Anfrage (nur harmlose Form). */
function oeffentlicheBasis(req) {
  if (process.env.APOPULSE_PUBLIC_URL) return process.env.APOPULSE_PUBLIC_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim() === 'https' ? 'https' : 'http';
  const host = /^[A-Za-z0-9.-]{1,253}(:\d{1,5})?$/.test(String(req.headers.host || '')) ? req.headers.host : 'localhost';
  return `${proto}://${host}`;
}
// Aufrufe der Teilseiten je Tag — zeigt dem Owner, ob Teilen Leute bringt.
const teilAufrufe = new Map(); // 'YYYY-MM-DD' -> Anzahl
function teilAufrufeLetzte(tage = 7) {
  const grenze = new Date(Date.now() - tage * 86400000).toISOString().slice(0, 10);
  let n = 0; for (const [tag, z] of teilAufrufe) if (tag > grenze) n += z;
  return n;
}

function rxBetrachter(userId) {
  if (!userId) return null;
  const prof = social.getProfile(userId);
  if (!prof) return { userId };
  return {
    userId,
    jurisdiction: String(prof.country || '').toUpperCase(),
    verificationStatus: verificationStatusFor({ accountType: prof.account_type, verified: !!prof.verified }),
    isRxAllowed: prof.is_rx_allowed,
  };
}

// Kuehlketten- und Transportmeldungen (services/logistik.js). Der Bereich ist
// am Anfang LEER — es gibt keine Behoerdenschnittstelle fuer Kuehlketten-
// Brueche, die Information entsteht bei den Beteiligten. Eine ehrliche
// Leermeldung plus Meldeweg ist deshalb der richtige Startzustand.
const logistik = createLogistikService({ repo: logistikRepo, social, betrachterVon: rxBetrachter });

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

      // ── Live-Signal ──
      // Bewusst in EIGENEM try: Die KI-Anreicherung ist eine Verbesserung der
      // Darstellung, nicht die Grundlage der Aussage. Faellt sie aus, steht
      // der Beitrag trotzdem im Feed — mit Titel, Datum und Quelle, also mit
      // allem, was fachlich zaehlt.
      try {
        const extraktion = await extractSignal(
          { title: item.title, summary: item.summary, raw: item.summary },
          { log: (m) => console.warn(m) },
        );
        const signal = baueSignal({
          meldung: { ...item, raw: item.summary },
          // Die Herkunft kommt AUSSCHLIESSLICH von hier — mechanisch aus dem
          // Abruf, nie aus der KI (services/signals.js, Dateikopf).
          herkunft: {
            originalUrl: item.link,
            sourceName: item.sourceLabel || regulatorOf(item.country) || item.sourceId,
            sourceId: item.sourceId,
            country: item.country,
            kind: 'news',
          },
          extraktion,
        });
        const neu = signalStore.upsert(signal);

        // ── Wirkstoff-Alarm ────────────────────────────────────────────────
        //  Nur bei einem NEUEN Signal. Beim erneuten Sehen derselben Meldung
        //  (jeder Fuenf-Minuten-Takt) darf nicht erneut benachrichtigt werden;
        //  `upsert` sagt, ob es neu war. Der Schluessel-Dedup im Alarm selbst
        //  ist der zweite Riegel — aber sich auf ihn allein zu verlassen
        //  hiesse, bei jedem Takt die ganze Beobachterliste durchzugehen.
        if (neu) {
          benachrichtigeZuSignal(signal, {
            beobachter: shortagesRepo.listWatchers().map((b) => ({
              ...b,
              // Heimatland, nicht das gerade „besuchte": Ein Alarm folgt der
              // eigenen Versorgungslage, nicht einer Durchsicht fremder Laender.
              country: userCountry(b.userId),
            })),
            schonGemeldet: (uid, key) => shortagesRepo.wasDealAlerted(uid, key),
            merkeGemeldet: (uid, key) => shortagesRepo.markDealAlerted(uid, key),
            notify: ({ userId, label, refId }) => social.pushNotification({
              userId, type: 'signal_alert', refType: 'signal', refId, label,
            }),
            log: (m) => console.warn(m),
          });
        }
      } catch (e) {
        console.warn(`ApoPulse Signal: ${item.sourceId} nicht uebernommen — ${e && e.message}`);
      }
    },
  });
  // Gemessenen Zustand je Land festhalten — VOR dem Speichern, damit auch ein
  // Durchlauf ohne neue Beitraege den Zustand aktualisiert. Genau der Fall
  // zaehlt: „keine neuen Meldungen" ist etwas anderes als „Quelle stumm".
  coverage.ausNewsReport(report, sourcesByKind('news'));
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
  if (istQuellRegion(raw) || isValidCountry(raw)) return raw;
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
  // einmal ersetzen: `replaceFeed` löscht den Nicht-Community-Bestand der
  // betroffenen Länder.
  // Bei zwei Quellen nacheinander aufgerufen, würde die zweite die Zeilen der
  // ersten wieder wegräumen — und der Bestand hinge davon ab, wer zuletzt
  // geantwortet hat.
  const gesammelt = [];
  const quellen = [];
  // Länder, deren Behörde in DIESEM Lauf Zeilen lieferte. Nur deren Bestand wird
  // ersetzt, und nur dort darf die Chronik Episoden schließen.
  const gelieferteLaender = new Set(summary.countries.filter((c) => c.ok && c.count > 0).map((c) => c.country));
  for (const source of engpassQuellen()) {
    if (source.format !== 'csv' && source.format !== 'json') continue;
    try {
      // Wie bei den News: wiederholen bei vorübergehenden Störungen,
      // ausweichen bei dauerhaften.
      const { rows, rejected } = await holeEngpassQuelle(source);
      // Jede Zeile traegt das Land ihrer QUELLE: Eine BASG-Zeile gilt fuer
      // Oesterreich, eine openFDA-Zeile fuer die USA. Ohne diese Zuordnung
      // landeten beide in jedem Land — genau der Fehler, den die
      // Referenzdaten hatten.
      gesammelt.push(...rows.map((r) => ({ ...r, country: r.country || source.country, quelle: source.label || source.id })));
      if (rows.length) { quellen.push(source.label || source.id); if (source.country) gelieferteLaender.add(String(source.country).toUpperCase()); }
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

  // Chronik fortschreiben (services/chronik.js) — nur für Länder mit Lieferung.
  try {
    summary.chronik = chronik.beobachte({ zeilen: shortagesRepo.list(), laender: [...gelieferteLaender] });
    summary.fruehwarnung = { gesendet: fruehwarnung.melde(summary.chronik.neue), heimat: fruehwarnung.meldeHeimat(summary.chronik.neue, summary.chronik.beendete) };
    if (summary.chronik.neu || summary.chronik.geschlossen) saveSoon();
  } catch (e) {
    summary.chronik = { error: (e && e.message) || String(e) };
  }

  // Gemessenen Engpass-Zustand je Land festhalten — wie bei den Nachrichten,
  // aber getrennt: Es sind andere Server, die unabhaengig ausfallen.
  coverage.ausShortageSummary(summary, engpassQuellen());

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
  // Zum Land: Jede Zeile trägt ihr eigenes Land (seit 09/2026), und
  // saveShortages nimmt es. `country` unten ist nur der Rückfall für Zeilen
  // ohne Land. Ist genau ein Engpass-Feed angeschlossen, ist dessen Land das
  // richtige; sonst bleibt es beim Standardland — die Annahme steht im Bericht.
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

// Konto anlegen — gemeinsamer Weg für E-Mail- und Telefon-Registrierung (Handle,
// Profil, Einladung, Wiederherstellungscodes). `intern` erlaubt die Platzhalter-
// Adressen (@telefon.local, @oauth.local), die von außen nie gewählt werden dürfen.
// Anmelde-Kennung: E-Mail — oder die Handynummer eines Telefon-Kontos (dessen interne
// Platzhalter-Adresse kennt niemand). So kommen Telefon-Konten mit Passwort bzw.
// Wiederherstellungscode hinein, wenn die SIM-Karte weg ist.
function kontoKennung(eingabe, land) {
  const s = String(eingabe || '').trim();
  if (s.includes('@')) return s.toLowerCase();
  const nummer = normalisiereTelefon(s, land);
  return nummer ? telefonAdresse(nummer) : s.toLowerCase();
}

async function kontoAnlegen(body, { intern = false } = {}) {
  const { email, password, displayName, pharmacyName } = body;
  const name = String(body.name || '').trim();
  // ERST alles prüfen, DANN anlegen. Bis 10/2026 entstanden Organisation und
  // Konto vor der Handle-Prüfung: Ein zu kurzer oder vergebener Handle ließ
  // ein Konto ohne Profil zurück, und die E-Mail war für immer „vergeben".
  const wunsch = normalizeHandle(body.handle);
  const pruefen = () => {
    if (!name && !displayName) throw new AppError('display_name_required', 'Anzeigename erforderlich.');
    if (wunsch && !HANDLE_RE.test(wunsch)) throw new AppError('profile_handle_format', 'Handle: 3–30 Zeichen, nur a–z 0–9 _.');
    if (wunsch && social.getProfile(wunsch)) throw new AppError('handle_taken', 'Handle ist bereits vergeben.');
    if (!intern && /@(telefon|oauth)\.local$/i.test(String(email || '').trim())) throw new AppError('email_reserviert', 'Diese Adresse ist reserviert.');
    if (repo.getUserByEmail(String(email || '').trim())) throw new AppError('email_taken', 'E-Mail ist bereits vergeben.');
    if (String(password || '').length < 8) throw new AppError('pw_too_short', 'Passwort muss mindestens 8 Zeichen haben.');
  };
  pruefen();
  // Hashes im Hintergrund-Thread rechnen (Start-Ansturm: synchron hielt jede
  // Registrierung den ganzen Server ~0,5 s an). Während des Wartens kann eine
  // zweite Anfrage dieselbe Adresse/denselben Handle belegt haben — darum danach
  // noch einmal prüfen; ab hier läuft alles ohne Unterbrechung.
  const [passwordHash, recovery] = await Promise.all([hashPasswordAsync(password), generateRecoveryCodesAsync()]);
  pruefen();
  // Ohne Wunsch: Handle aus dem Namen („Jürgen Müller" -> juergen_mueller).
  const handle = wunsch || freierHandle(displayName || name, (h) => !!social.getProfile(h));
  const reg = orgAuth.registerPharmacyWithOwner({
    // Name der Organisation: angegeben, sonst der Name der Person. Bis 10/2026 hieß jede
    // „<Name> Apotheke" — auch Kliniken, Großhändler und Konten in Ghana (deutsches Wort im Team-Kopf).
    pharmacy: { name: String(pharmacyName || '').trim() || name || displayName || 'ApoPulse' },
    owner: { name, email, password },
    vorab: { passwordHash, recovery },
  });
  // Land + UI-Sprache bei der Registrierung (Länderauswahl); Fallback AT/de.
  const country = normalizeCountry(body.country);
  const locale = normalizeLocale(body.locale, country);
  // Kontotyp bei der Registrierung (Apotheke/Pharma/Behörde/Privat); Fallback Apotheke.
  const accountType = normalizeAccountType(body.accountType);
  const profile = social.createProfile(reg.user.id, { handle, displayName: displayName || name, pharmacyOrgId: reg.organization.id, country, locale, accountType });
  // Über einen Einladungs-Link gekommen (services/einladungen.js): zuordnen, einladende Person benachrichtigen.
  const eingeladenVon = einladungen.zuordnen(reg.user.id, body.einladung);
  if (eingeladenVon) social.einladungAngenommen(eingeladenVon, reg.user.id);
  // Herkunft nur als Summe zählen — das Konto selbst bekommt keinen Kanal.
  kanaele.zaehle(body.kanal, 'konten');
  // recoveryCodes einmalig mitschicken, damit das Frontend sie zum Sichern anzeigen kann.
  return { token: issueToken(reg.user.id), user: reg.user, profile, recovery_codes: reg.recoveryCodes };
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
  // Welche Bereiche laufen? Oeffentlich und ohne Anmeldung, weil die
  // Oberflaeche schon VOR dem Login entscheiden muss, was sie ueberhaupt
  // anbietet. Ein Reiter, der beim Klick 404 liefert, ist schlimmer als kein
  // Reiter: Er sieht aus wie ein Fehler der Plattform.
  ['GET', /^\/api\/features$/, false, async () => ({ features: featureListe() })],

  // ── Live-Signale ──────────────────────────────────────────────────────────
  //  Die eine Abfrage, die das Frontend braucht: „Was gibt es fuer MEIN Land,
  //  in DIESER Kategorie, zu DIESEM Wirkstoff." Genau die drei Spalten, auf
  //  die der Index in VerifiedSignal gelegt ist.
  //
  //  Jede Zeile traegt ihre Herkunft mit: originalUrl und sourceName sind
  //  Pflichtfelder, ohne sie entsteht gar kein Signal. Das Frontend zeigt sie
  //  als Abzeichen mit Link — Punkt 4 des Auftrags.
  ['GET', /^\/api\/signals$/, true, async ({ userId, query }) => {
    const land = activeCountry(userId, query);
    const kategorie = String(query.get('category') || '').toUpperCase() || null;
    const signale = signalStore.list({
      country: land,
      category: SIGNAL_KATEGORIEN.includes(kategorie) ? kategorie : null,
      wirkstoff: query.get('wirkstoff') || null,
      limit: Number(query.get('limit')) || 100,
    });
    // Der Stand gehoert mit in dieselbe Antwort: Das Frontend muss „verbunden,
    // gerade nichts Neues" von „noch nie etwas bekommen" unterscheiden koennen,
    // ohne eine zweite Abfrage zu stellen.
    return {
      signale,
      stand: signalStore.landStand(land),
      ki: aiKonfiguration() ? 'aktiv' : 'aus',
    };
  }],

  // Liefert dieses Land gerade Daten? Oeffentlich, weil die Ansicht die Antwort
  // BEVOR dem Login braucht — und weil eine leere Liste ohne Erklaerung das
  // teuerste Signal ist, das die Plattform senden kann: Sie sieht aus wie ein
  // Defekt, und die Nutzerin sucht den Fehler bei sich.
  //
  // `?art=shortages` fragt die ENGPASS-Quellen ab, sonst die Nachrichten.
  // Das ist keine Feinheit: Oesterreich bezieht Nachrichten vom BASG-Newsfeed
  // und Engpaesse aus einer anderen BASG-Schnittstelle. Ohne die Trennung
  // erklaerte sich die leere Engpass-Liste mit der Gesundheit des Newsfeeds —
  // also womoeglich mit „laeuft alles", waehrend nichts ankommt.
  // Öffentliche Lage je Land für die Startseite (ohne Anmeldung): NUR
  // Zahlen — wie viele Wirkstoffe auf der Behördenliste stehen, wie viele
  // in 7 Tagen dazukamen, welche Behörde, wie frisch. Die Namen und der
  // Verlauf sind das, wofür man sich anmeldet. Ohne Behördendaten: `daten:
  // false` — die Startseite zeigt dann nichts statt einer erfundenen Zahl.
  ['GET', /^\/api\/lage\/([A-Za-z]{2})$/, false, async ({ params }) => {
    const cc = params[0].toUpperCase();
    if (!COUNTRIES[cc]) { const e = Object.assign(new Error('Unbekanntes Land.'), { code: 'unknown_country' }); e.status = 404; throw e; }
    return lageDaten(cc);
  }],
  // Funktionsvorschau (öffentlich): je Bereich die drei neuesten ECHTEN Einträge,
  // damit Menü und Startseite zeigen, was ApoPulse wirklich enthält — statt
  // erfundener Beispiele. Gleiche Linie wie die öffentlichen Engpass-Seiten
  // (services/oeffentlicheSeiten.js): Engpässe nur amtlich, jede Zeile mit
  // Quelle; keine Apotheken-Meldungen, keine Therapie- oder Austauschempfehlung.
  ['GET', /^\/api\/vorschau\/([A-Za-z]{2})$/, false, async ({ params }) => {
    const cc = params[0].toUpperCase();
    if (!COUNTRIES[cc]) { const e = Object.assign(new Error('Unbekanntes Land.'), { code: 'unknown_country' }); e.status = 404; throw e; }
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
    const engpaesse = oeffentlich.eintraege(cc).slice(0, 3)
      .map((e) => ({ wirkstoff: e.wirkstoff, status: e.status, quelle: e.quelle }));
    const signale = signalStore.list({ country: cc, limit: 3 })
      .map((x) => ({ titel: x.title, kategorie: x.category, quelle: x.sourceName || host(x.originalUrl), datum: x.publishedAt || x.verifiedAt || null }));
    const news = socialRepo.listAllPosts()
      .filter((p) => p.kind === 'news' && p.visibility === 'public' && (p.country || 'AT') === cc)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 3)
      .map((p) => ({ titel: String(p.body || '').split('\n')[0].slice(0, 200), quelle: host(p.source_url || p.sourceUrl), datum: p.created_at || null }));
    return { land: cc, engpaesse, signale, news };
  }],
  // Datenabdeckung für Kundschaft (öffentlich): Aus welchen Ländern kommen
  // wirklich Behördendaten? Wer zahlen soll, muss wissen, wofür — und wo
  // (noch) nichts ankommt. Nur Zustände und Zahlen, keine Wirkstoffnamen.
  ['GET', /^\/api\/abdeckung$/, false, async () => {
    const quellen = engpassQuellen();
    const job = scheduler.status().find((j) => j.name === 'shortages') || null;
    const laender = Object.values(COUNTRIES).map((c) => {
      const st = landStatus(c.code, { store: coverage, quellen, art: 'shortages' });
      const b = chronik.wochenbilanz(c.code);
      return {
        land: c.code, behoerde: c.regulator || null,
        // keine = keine Behördenquelle angebunden · unbekannt = angebunden, noch kein Abruf
        // liefert = letzter Abruf erfolgreich · stumm = letzter Abruf gescheitert
        zustand: st.zustand,
        quellen: quellen.filter((q) => q.country === c.code).map((q) => q.label || q.id),
        offen: b ? b.offen : null,
        aufzeichnung_seit: b ? b.aufzeichnung_seit : null,
      };
    });
    return { laender, stand: (job && job.lastRunAt) || null, mail: !!mailer.aktiv };
  }],
  ['GET', /^\/api\/coverage\/([A-Za-z]{2})$/, false, async ({ params, query }) => {
    // `query` ist URLSearchParams, kein Objekt — query.art waere immer
    // undefined und die Auskunft stillschweigend immer „news".
    const art = query && query.get('art') === 'shortages' ? 'shortages' : 'news';
    // `abruf`: Wann lief die Automatik zuletzt, und ist das noch aktuell?
    // „Aktuell" heisst: innerhalb von drei Takten. Auf dem kostenlosen
    // Render-Tarif schlaeft der Dienst ohne Besucher ein — dann laeuft kein
    // Abruf, und die Daten werden still alt. Das muss die Oberflaeche sagen
    // koennen, statt alte Meldungen wie frische zu zeigen.
    const job = scheduler.status().find((j) => j.name === art) || null;
    return {
      ...landStatus(params[0], { store: coverage, quellen: art === 'shortages' ? engpassQuellen() : sourcesByKind(art), art }),
      abruf: abrufStand(job, { intervallMs: art === 'shortages' ? INTERVALS.shortages : INTERVALS.news }),
    };
  }],

  ['GET', /^\/api\/health$/, false, async () => ({
    ok: true, service: 'apopulse', ts: new Date().toISOString(),
    durability: durabilityReport().level,
  })],

  // Eigener Einladungs-Link (services/einladungen.js). __sichern: Der erste Abruf legt den Code an.
  ['GET', /^\/api\/einladung$/, true, async ({ userId }) => ({ code: einladungen.code(userId), beigetreten: einladungen.anzahl(userId), __sichern: true })],
  ['POST', /^\/api\/register$/, false, async ({ body }) => kontoAnlegen(body)],

  // Passwort per Wiederherstellungscode zurücksetzen (kein E-Mail-Dienst nötig). Rate-limitiert.
  ['POST', /^\/api\/password\/reset$/, false, async ({ body, ip }) => {
    const konto = kontoKennung(body.email, body.land);
    const key = (ip || 'unknown') + '|' + konto;
    const st0 = resetLimiter.check(key); const st1 = resetJeKonto.check(konto);
    const st = st0.blocked ? st0 : st1;
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    try {
      const r = orgAuth.resetPassword({ email: konto, code: body.code, newPassword: body.newPassword });
      resetLimiter.reset(key); resetJeKonto.reset(konto); // Erfolg hebt die Bremse auf
      return r;
    } catch (e) { resetLimiter.fail(key); resetJeKonto.fail(konto); throw e; } // Fehlversuch zählt gegen das Limit
  }],

  // Passwort-Link per E-Mail anfordern: antwortet immer gleich (keine Konto-Aufzählung).
  ['POST', /^\/api\/password\/reset-link$/, false, async ({ body, ip }) => {
    const konto = String(body.email || '').trim().toLowerCase();
    const st0 = linkLimiter.check(ip || 'unknown'); const st1 = linkJeKonto.check(konto);
    const st = st0.blocked ? st0 : st1;
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    linkLimiter.fail(ip || 'unknown'); linkJeKonto.fail(konto); // jede Anfrage zählt — sie verschickt eine Mail
    return passwortLink.anfordern({ email: konto, sprache: SUPPORTED_LOCALES.includes(body.sprache) ? body.sprache : 'en' });
  }],
  // Link einlösen: neues Passwort setzen und gleich angemeldet sein.
  ['POST', /^\/api\/password\/reset-mit-link$/, false, async ({ body, ip }) => {
    const key = ip || 'unknown';
    const st = linkEinloesen.check(key);
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    let r;
    try { r = passwortLink.einloesen({ t: body.t, newPassword: body.newPassword }); } catch (e) { linkEinloesen.fail(key); throw e; }
    return { token: issueToken(r.userId), user: safeUser(repo.getUserById(r.userId)), profile: social.getProfile(r.userId) };
  }],

  // ── Anmelden mit Telefonnummer ────────────────────────────────────────────
  // 1) Code per SMS. Jede Anfrage zählt gegen die Bremsen — sie kostet eine SMS.
  ['POST', /^\/api\/telefon\/code$/, false, async ({ body, ip }) => {
    const nummer = telefonLogin.nummer(body.telefon, body.land);
    const st0 = telCodeJeGeraet.check(ip || 'unknown'); const st1 = telCodeJeNummer.check(nummer); const st2 = telCodeGesamt.check('alle');
    const st = st0.blocked ? st0 : st1.blocked ? st1 : st2;
    // Gesamtgrenze erreicht: nicht „Sie haben zu oft versucht" — die Person hat nichts falsch gemacht.
    // Ehrlich sagen, dass SMS gerade ausgelastet ist, und auf E-Mail/Google verweisen.
    if (st.blocked && st === st2) { const e = new Error('SMS-Anmeldung ist gerade ausgelastet. Bitte in einigen Minuten erneut — oder mit E-Mail anmelden.'); e.status = 429; e.code = 'sms_ausgelastet'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    telCodeJeGeraet.fail(ip || 'unknown'); telCodeJeNummer.fail(nummer); telCodeGesamt.fail('alle');
    return telefonLogin.anfordern({ telefon: nummer, sprache: SUPPORTED_LOCALES.includes(body.sprache) ? body.sprache : 'en' });
  }],
  // 2) Code prüfen → angemeldet, oder Ticket für ein neues Konto.
  ['POST', /^\/api\/telefon\/pruefen$/, false, async ({ body, ip }) => {
    // Schlüssel IP + Nummer (einheitlich geschrieben: „077…" und „+221 77…" sind dieselbe), damit
    // Nachbarn im selben Handynetz sich nicht gegenseitig sperren. Ungültige Nummer: nur die IP.
    let nr = ''; try { nr = telefonLogin.nummer(body.telefon, body.land); } catch { /* pruefen meldet den Fehler */ }
    const key = (ip || 'unknown') + '|' + nr;
    const st = telPruefJeGeraet.check(key);
    if (st.blocked) { const e = new Error('Zu viele Versuche. Bitte später erneut.'); e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000); throw e; }
    let r;
    try { r = telefonLogin.pruefen({ telefon: body.telefon, land: body.land, code: body.code }); }
    catch (e) { telPruefJeGeraet.fail(key); throw e; }
    if (r.neu) return { neu: true, ticket: r.ticket };
    return { token: issueToken(r.userId), user: safeUser(repo.getUserById(r.userId)), profile: social.getProfile(r.userId) };
  }],
  // 3) Neues Konto zur bestätigten Nummer (Name + Kontotyp). Doppelt abgeschickt: einfach anmelden.
  ['POST', /^\/api\/telefon\/konto$/, false, async ({ body }) => {
    const nummer = telefonLogin.ticketNummer(body.ticket);
    const da = repo.getUserByEmail(telefonAdresse(nummer));
    if (da) return { token: issueToken(da.id), user: safeUser(da), profile: social.getProfile(da.id) };
    try { return await kontoAnlegen({ ...body, handle: undefined, email: telefonAdresse(nummer), password: crypto.randomBytes(24).toString('hex') }, { intern: true }); }
    catch (e) {
      // Doppelt abgeschickt, während die erste Anfrage noch rechnete: dann gibt es das Konto jetzt.
      const jetzt = e && e.code === 'email_taken' && repo.getUserByEmail(telefonAdresse(nummer));
      if (jetzt) return { token: issueToken(jetzt.id), user: safeUser(jetzt), profile: social.getProfile(jetzt.id) };
      throw e;
    }
  }],

  // Verbleibende Wiederherstellungscodes (eingeloggt) + Neu-Erzeugung.
  ['GET', /^\/api\/recovery-codes$/, true, async ({ userId }) => ({ remaining: orgAuth.remainingRecoveryCodes(userId) })],
  ['POST', /^\/api\/recovery-codes\/regenerate$/, true, async ({ userId }) => orgAuth.regenerateRecoveryCodes(userId)],

  // ── Automatik: Stand und Handsteuerung ────────────────────────────────────
  // Ohne diese Ansicht weiß niemand, ob die Automatik überhaupt läuft — und
  // eine Automatik, deren Zustand man nicht sehen kann, ist keine.
  ['GET', /^\/api\/live\/status$/, false, async () => ({
    jobs: scheduler.status(),
    // E-Mail-Versand: an oder aus, und warum — nie der Schlüssel.
    mail: { aktiv: mailer.aktiv, anbieter: mailer.anbieter, grund: mailer.grund },
    sources: [...activeSources(), ...eigeneQuellen.liste()].map(({ id, kind, country, format, url, official, configured, label, fallbacks, verified, eigen }) =>
      // Die URL gehört dazu: Nur so lässt sich prüfen, ob die Voreinstellung
      // noch stimmt oder eine Behörde ihren Feed verschoben hat.
      // `verified: false` heißt: in der Bauumgebung nicht abrufbar gewesen.
      ({ id, kind, country, format, url, official, configured, label, verified, eigen: !!eigen, fallbacks: (fallbacks || []).length })),
    // Länderabdeckung auf einen Blick: Für welches der 16 Länder gibt es
    // überhaupt eine Quelle? Ohne diese Zeile fällt ein Land, das durchs
    // Raster gefallen ist, erst auf, wenn jemand dort eine leere Ansicht sieht.
    coverage: (() => {
      const proLand = {};
      for (const s of [...activeSources(), ...eigeneQuellen.liste()]) (proLand[s.country] ||= []).push(s.id);
      const laender = listCountries().map((c) => c.code);
      return {
        countries: laender.length,
        withSource: laender.filter((cc) => proLand[cc]).length,
        missing: laender.filter((cc) => !proLand[cc]),
        bySource: proLand,
        // `withSource` zaehlt EINGETRAGENE Quellen. Das ist etwas anderes als
        // geliefert — der Unterschied war lange unsichtbar und hat leere
        // Laenderansichten wie einen Defekt aussehen lassen.
        gemessen: coverage.alle(),
      };
    })(),
    // Woran die Selbstfindung scheitert, wenn sie scheitert. Lag bisher nur im
    // Render-Protokoll — und die entscheidenden Zeilen lagen zweimal knapp
    // ausserhalb des Ausschnitts, den jemand schicken konnte. Eine Diagnose,
    // an die man nur ueber einen Screenshot kommt, ist im Zweifel keine.
    discovery: suchProtokoll(),
    shortage_feeds: Object.keys(liveSources()),
    news_seen: newsSeen.size(),
    // Live-Signale: wie viele im Speicher, je Land, und laeuft die KI?
    //
    // Gehoert in dieselbe Ansicht wie die Quellen, weil genau hier die Frage
    // auftaucht: „22 Quellen eingetragen — und wo sind die Signale?" Ohne
    // diese Zeile liesse sich „Quelle liefert nicht" nicht von „Signal wird
    // nicht gebaut" unterscheiden. Die DAUERHAFTE Zahl steht unter
    // `database.signalRows`; weicht sie stark von `im_speicher` ab, hat der
    // Spiegel ein Problem.
    signals: {
      im_speicher: signalStore.size(),
      ki: aiKonfiguration() ? 'aktiv' : 'aus',
      je_land: signalStore.jeLand(),
    },
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
  ['POST', /^\/api\/live\/run\/(news|shortages|wochenbericht)$/, true, async ({ userId, params }) => {
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
  // amount_cents = zu zahlender Preis (ggf. regional ermäßigt); list_cents = Listenpreis und
  // preis_region nur, wenn wirklich ermäßigt — die Premium-Seite schreibt dann „Sonderpreis für Afrika".
  ['GET', /^\/api\/payments\/products$/, false, async ({ userId, query }) => {
    const country = query.get('country');
    const region = preisRegionFuer(userId, country);
    return { products: listProducts().map((p) => {
      const cents = preisFuer(userId, p, { country });
      return cents < p.amount_cents ? { ...p, amount_cents: cents, list_cents: p.amount_cents, preis_region: region } : { ...p };
    }) };
  }],
  // Welche FIAT-Wege stehen hier und jetzt wirklich zur Verfügung?
  //
  // Zwei Bedingungen müssen BEIDE erfüllt sein, und sie kommen aus zwei
  // verschiedenen Ecken: Beim Anbieter konfiguriert (ENV-Schlüssel vorhanden)
  // UND im Land zulässig (domain/compliance.js). Nur eine von beiden zu prüfen
  // ergibt in beide Richtungen einen kaputten Checkout: einen Knopf ohne
  // Anbieter dahinter, oder einen Bezahlweg, den das Land nicht erlaubt.
  //
  // Die Krypto-Schiene ist hier NICHT betroffen und kann durch diesen Filter
  // auch nicht verschwinden: Sie hängt an /api/payments/crypto und an den
  // hinterlegten Wallets, nicht an `providers`. Ein Test prüft genau das — die
  // Owner-Vorgabe „Krypto bleibt zu 100 %" darf nicht an einem Länderfilter
  // für Kartenzahlung hängen.
  ['GET', /^\/api\/payments\/methods$/, false, async ({ query }) => {
    const konfiguriert = payments.configuredMethods();
    const cc = String(query.get('country') || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return { methods: konfiguriert };
    let erlaubt;
    try {
      erlaubt = paymentMethodsFor(cc, 'saas_license');
    } catch {
      // Unbekannter Zweck/Land: lieber die ungefilterte Liste als keine.
      return { methods: konfiguriert };
    }
    const beschriftung = new Map(erlaubt.map((m) => [m.id, m.label]));
    return {
      country: cc,
      methods: konfiguriert
        .filter((m) => beschriftung.has(m.method))
        .map((m) => ({ ...m, label: beschriftung.get(m.method) })),
      // Wege, die das Land zuließe, für die aber kein Anbieter hinterlegt ist.
      // Offen zu benennen statt zu verschweigen: Nur so sieht der Betreiber im
      // Status, was ein Schlüssel freischalten würde.
      pending_setup: erlaubt
        .filter((m) => m.rail === 'fiat' && !konfiguriert.some((k) => k.method === m.id))
        .map((m) => m.id),
    };
  }],
  ['POST', /^\/api\/payments\/checkout$/, true, async ({ userId, body }) =>
    payments.createCheckout(userId, { productId: body.productId, method: body.method, successUrl: body.successUrl, cancelUrl: body.cancelUrl })],
  ['GET', /^\/api\/me\/premium$/, true, async ({ userId }) => ({ premium: payments.hasFeature(userId, 'premium'), features: payments.myEntitlements(userId), bis: payments.featureBis(userId, 'premium') })],
  // Direkt-in-Wallet Krypto: Anzeige (Adresse + „in Wallet öffnen"-URI + Live-Betrag),
  // Start (pending), Tx-ID einreichen (pending_review), Moderation bestätigt manuell.
  // `country` steuert nur die ANZEIGE-Währung (Näherung). Abgerechnet wird in
  // der Produktwährung — deshalb ist der Parameter unkritisch und optional.
  ['GET', /^\/api\/payments\/crypto$/, false, async ({ query, userId }) => {
    const country = query.get('country');
    const currency = country ? COUNTRIES[normalizeCountry(country)].currency : null;
    return payments.cryptoOptions(query.get('product') || 'premium_monthly', { currency, userId, country });
  }],
  ['POST', /^\/api\/payments\/crypto\/start$/, true, async ({ userId, body }) => payments.startCryptoPayment(userId, body.productId, body.walletId ?? body.coin)],
  ['POST', /^\/api\/payments\/crypto\/([^/]+)\/claim$/, true, async ({ userId, params, body }) => payments.claimCryptoPayment(userId, params[0], body.txRef)],
  ['GET', /^\/api\/payments\/pending$/, true, async ({ userId }) => ({
    payments: payments.listPendingReview(userId, {
      // Wer gezahlt hat — Name, Handle, Land. Keine E-Mail: Rückfragen laufen
      // über die Plattform, nicht über eine Adresse in der Prüfliste.
      kunde: (uid) => { const pr = social.getProfile(uid); return pr ? { handle: pr.handle, display_name: pr.display_name, country: pr.country || null } : null; },
    }),
  })],
  ['POST', /^\/api\/payments\/([^/]+)\/confirm$/, true, async ({ userId, params }) => payments.confirmPayment(userId, params[0])],
  ['POST', /^\/api\/payments\/([^/]+)\/reject$/, true, async ({ userId, params, body }) => payments.rejectPayment(userId, params[0], body.grund)],
  ['GET', /^\/api\/payments\/mine$/, true, async ({ userId }) => ({ payments: payments.myPayments(userId) })],
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
    return { providers, passwort_link: passwortLink.aktiv, telefon: telefonLogin.aktiv, ...(telefonLogin.aktiv ? { vorwahlen: VORWAHL } : {}) };
  }],
  ['POST', /^\/api\/auth\/oauth\/([a-z0-9_]+)$/, false, async ({ params, body }) => {
    const { userId, created } = await oauth.loginOrRegister(params[0], body.code, body.redirectUri, { country: normalizeCountry(body.country), locale: body.locale });
    if (created) kanaele.zaehle(body.kanal, 'konten');
    return { token: issueToken(userId), user: safeUser(repo.getUserById(userId)), profile: social.getProfile(userId) };
  }],
  ['GET', /^\/api\/auth\/identities$/, true, async ({ userId }) => ({ identities: oauth.linkedIdentities(userId) })],
  ['POST', /^\/api\/auth\/identities\/([a-z0-9_]+)\/unlink$/, true, async ({ userId, params }) => oauth.unlink(userId, params[0])],

  ['POST', /^\/api\/login$/, false, async ({ body, ip }) => {
    const konto = kontoKennung(body.email, body.land);
    const key = (ip || 'unknown') + '|' + konto;
    const st0 = loginLimiter.check(key); const st1 = loginJeKonto.check(konto);
    const st = st0.blocked ? st0 : st1;
    if (st.blocked) {
      const e = new Error('Zu viele Fehlversuche. Bitte später erneut versuchen.');
      e.status = 429; e.code = 'too_many_attempts'; e.retryAfterS = Math.ceil(st.retryAfterMs / 1000);
      throw e;
    }
    const r = await orgAuth.loginAsync({ email: konto, password: body.password });
    if (!r.ok) { loginLimiter.fail(key); loginJeKonto.fail(konto); const e = new Error(r.error); e.status = 401; e.code = 'login_failed'; throw e; }
    loginLimiter.reset(key); loginJeKonto.reset(konto); // erfolgreiche Anmeldung setzt die Zähler zurück
    return { token: issueToken(r.user.id), user: r.user, profile: social.getProfile(r.user.id) };
  }],

  // Konten ohne Profil reparieren — entstanden bis 10/2026, wenn die
  // Registrierung am Handle scheiterte (siehe /api/register). Ohne Profil
  // war die Anwendung für sie nicht benutzbar. Idempotent.
  ['POST', /^\/api\/profil\/nachholen$/, true, async ({ userId, body }) => {
    const da = social.getProfile(userId);
    if (da) return { profile: da, angelegt: false };
    const user = repo.getUserById(userId);
    const country = normalizeCountry(body.country);
    const handle = freierHandle(user && user.name, (h) => !!social.getProfile(h));
    const org = repo.getMembershipsForUser(userId)[0];
    const profile = social.createProfile(userId, { handle, displayName: (user && user.name) || handle, pharmacyOrgId: org ? org.organization_id : null, country, locale: normalizeLocale(body.locale, country) });
    return { profile, angelegt: true };
  }],
  ['GET', /^\/api\/me$/, true, async ({ userId }) => ({ user: safeUser(repo.getUserById(userId)), profile: social.getProfile(userId), is_moderator: social.isModerator(userId) })],
  ['GET', /^\/api\/overview$/, true, async ({ userId, query }) => {
    const home = userCountry(userId);
    const dealsBlocked = isFeatureBlocked(home, 'deals');
    // Anzeige: angesehenes Land. Rabatt-Alarme: Heimatland (domain/land.js).
    const ov = overview.forUser(userId, { dealsBlocked, country: activeCountry(userId, query), home });
    // Rechts-Gate (Heimatland): gesperrte Module aus der Übersicht nehmen.
    if (dealsBlocked) { ov.top_rabatt = null; ov.rabatte_expiring = { count: 0, soonest: null }; ov.watch_deals = []; }
    if (isFeatureBlocked(home, 'stock_exchange')) { ov.exchange = { biete: 0, suche: 0, recent: [] }; ov.my_seeks = { open: 0, with_matches: 0, items: [] }; ov.watch_offers = []; ov.expiring_offers = { count: 0, items: [] }; }
    if (isFeatureBlocked(home, 'price_compare')) { ov.savings = null; }
    return { ...ov, premium: payments.hasFeature(userId, 'premium'), data_live: isLive(activeCountry(userId, query)),
      // Beobachtete Wirkstoffe, die im Ausland knapp sind, hier aber nicht.
      fruehwarnung: fruehwarnung.fuerBeobachtungsliste(userId, activeCountry(userId, query)) };
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
  ['GET', /^\/api\/wirkstoff\/([^/]+)$/, true, async ({ userId, params, query }) => {
    const name = decodeURIComponent(params[0]).trim();
    const low = name.toLowerCase();
    const eq = (v) => String(v || '').trim().toLowerCase() === low;
    const home = userCountry(userId);
    // Rechts-Gate (Heimatland): gesperrte Module (Rabatte/Austausch/Preise) im Hub leer lassen.
    const dealsBlocked = isFeatureBlocked(home, 'deals');
    const exBlocked = isFeatureBlocked(home, 'stock_exchange');
    const priceBlocked = isFeatureBlocked(home, 'price_compare');
    // `.eintraege`: Die Liste ist seit der Fachkreis-Schranke ein Objekt mit
    // Zaehler. Nur `.eintraege` zu nehmen und den Zaehler zu verwerfen ist hier
    // richtig — die Wirkstoff-Seite zeigt eine Zusammenfassung, der Hinweis auf
    // verborgene Angebote steht im Austausch-Reiter.
    // Angesehenes Land — wie die Listen-Reiter. Vorher ohne Land, also „alle":
    // Amoxicillin in Portugal zeigte den Wiener Engpass und die Wiener Aktion.
    const land = activeCountry(userId, query);
    const ex = exBlocked ? [] : exchange.list(userId, { q: name, country: land }).eintraege;
    return {
      wirkstoff: name,
      amr: amr.forWirkstoff(name, { land }), // Quellen passend zum angesehenen Land
      watched: shortagesRepo.isWatched(userId, name),
      alert_pct: shortagesRepo.getWatchAlert(userId, name),
      premium: payments.hasFeature(userId, 'premium'),
      note: shortagesRepo.getWatchNote(userId, name),
      also_watching: shortagesRepo.usersWatching(name).filter(id => id !== userId).length,
      country: land,
      // Engpässe über den Wirkstoff-Schlüssel (domain/inn.js): Die BfArM-Zeile
      // „Amoxicillin-Trihydrat" gehört auf die Seite „Amoxicillin".
      shortages: shortages.listWithCounts(userId, { country: land }).filter(s => eq(s.wirkstoff) || gleicherWirkstoff(s.wirkstoff, name)),
      // Verlauf dieses Wirkstoffs im angesehenen Land (null: Land nie beobachtet).
      chronik: chronikFuerBetrachter(chronik.fuer(name, land), { premium: payments.hasFeature(userId, 'premium') }),
      // Wo ist dieser Wirkstoff gerade knapp, außer im angesehenen Land?
      ausland: fruehwarnung.imAusland(name, land),
      prices: priceBlocked ? [] : prices.comparisons(userId, { country: land }).filter(g => eq(g.wirkstoff)),
      rabatte: dealsBlocked ? [] : rabatte.top10(userId, { country: land }).filter(r => eq(r.wirkstoff)),
      exchange: { biete: ex.filter(e => e.kind === 'biete'), suche: ex.filter(e => e.kind === 'suche') },
      posts: enrichPosts(social.searchPosts(userId, name).slice(0, 10), userId),
    };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)\/(followers|following)$/, true, async ({ userId, params }) => {
    const d = social.followList(userId, decodeURIComponent(params[0]), params[1]);
    if (!d) { const e = Object.assign(new Error('Profil nicht gefunden'), { code: 'profile_not_found' }); e.status = 404; throw e; }
    return d;
  }],
  ['GET', /^\/api\/suggestions\/follow$/, true, async ({ userId }) => ({ suggestions: social.suggestFollows(userId) })],
  ['GET', /^\/api\/colleagues\/nearby$/, true, async ({ userId }) => social.colleaguesInBundesland(userId)],
  ['GET', /^\/api\/discover\/open-to$/, true, async ({ userId }) => social.openToCounts(userId)],
  ['GET', /^\/api\/discover\/open-to\/([^/]+)$/, true, async ({ userId, params }) => social.discoverByOpenTo(userId, decodeURIComponent(params[0]))],
  ['GET', /^\/api\/handles$/, true, async ({ query }) => ({ handles: social.searchHandles(query.get('q') || '') })],
  ['GET', /^\/api\/me\/export$/, true, async ({ userId }) => ({ ...social.exportData(userId), exchange_entries: exchange.mine(userId) })],
  // Passwort ändern beendet alle Sitzungen — dieses Gerät bekommt gleich ein neues Token.
  ['POST', /^\/api\/me\/password$/, true, async ({ userId, body }) => ({ ...orgAuth.changePassword(userId, { oldPassword: body.oldPassword, newPassword: body.newPassword }), token: issueToken(userId) })],
  // „Auf allen anderen Geräten abmelden" (verlorenes Handy, Gerät in der Offizin geteilt).
  ['POST', /^\/api\/me\/sitzungen\/beenden$/, true, async ({ userId }) => { repo.beendeSitzungen(userId); return { ok: true, token: issueToken(userId) }; }],
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
    if (!mem) { const e = Object.assign(new Error('Keine Organisation.'), { code: 'org_none' }); e.status = 403; throw e; }
    const title = String(body.title || '').trim();
    if (title.length < 2) { const e = Object.assign(new Error('Aufgabe braucht einen Titel.'), { code: 'task_title' }); e.status = 400; throw e; }
    if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
    const dueDate = body.dueDate ? String(body.dueDate).trim() : null;
    if (dueDate && !isValidCalendarDay(dueDate)) { const e = Object.assign(new Error('Ungültiges Fälligkeitsdatum.'), { code: 'due_date_invalid' }); e.status = 400; throw e; }
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
      if (title.length < 2) { const e = Object.assign(new Error('Aufgabe braucht einen Titel.'), { code: 'task_title' }); e.status = 400; throw e; }
      if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
      fields.title = title;
    }
    if (body.description !== undefined) fields.description = body.description ? String(body.description).slice(0, 1000) : null;
    if (body.dueDate !== undefined) {
      const dueDate = body.dueDate ? String(body.dueDate).trim() : null;
      if (dueDate && !isValidCalendarDay(dueDate)) { const e = Object.assign(new Error('Ungültiges Fälligkeitsdatum.'), { code: 'due_date_invalid' }); e.status = 400; throw e; }
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
    if (!mem) { const e = Object.assign(new Error('Keine Organisation.'), { code: 'org_none' }); e.status = 403; throw e; }
    const title = String(body.title || '').trim();
    if (title.length < 2) { const e = Object.assign(new Error('Notiz braucht einen Titel.'), { code: 'note_title' }); e.status = 400; throw e; }
    if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
    let docUrl = null;
    if (body.docUrl && String(body.docUrl).trim()) {
      try { docUrl = cleanSourceUrl(body.docUrl); } catch { const e = Object.assign(new Error('Link muss ein http(s)-Link sein.'), { code: 'url_invalid' }); e.status = 400; throw e; }
    }
    return { note: collab.createNote(userId, mem.organization_id, { title, body: body.body ? String(body.body).slice(0, 2000) : null, docUrl }) };
  }],
  ['POST', /^\/api\/notes\/([^/]+)$/, true, async ({ userId, params, body }) => {
    const fields = {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (title.length < 2) { const e = Object.assign(new Error('Notiz braucht einen Titel.'), { code: 'note_title' }); e.status = 400; throw e; }
      if (title.length > MAX_TITLE) { const e = new Error(`Titel zu lang (max ${MAX_TITLE}).`); e.status = 400; throw e; }
      fields.title = title;
    }
    if (body.body !== undefined) fields.body = body.body ? String(body.body).slice(0, 2000) : null;
    if (body.docUrl !== undefined) {
      let docUrl = null;
      if (body.docUrl && String(body.docUrl).trim()) {
        try { docUrl = cleanSourceUrl(body.docUrl); } catch { const e = Object.assign(new Error('Link muss ein http(s)-Link sein.'), { code: 'url_invalid' }); e.status = 400; throw e; }
      }
      fields.docUrl = docUrl;
    }
    return { note: collab.updateNote(userId, params[0], fields) };
  }],
  ['POST', /^\/api\/notes\/([^/]+)\/pin$/, true, async ({ userId, params, body }) => ({ note: collab.setNotePinned(userId, params[0], !!body.pinned) })],
  ['POST', /^\/api\/notes\/([^/]+)\/delete$/, true, async ({ userId, params }) => collab.deleteNote(userId, params[0])],
  ['POST', /^\/api\/me\/delete$/, true, async ({ userId, body }) => {
    if (!orgAuth.verifyUserPassword(userId, body.password)) { const e = Object.assign(new Error('Passwort ist falsch.'), { code: 'password_wrong' }); e.status = 401; throw e; }
    socialRepo.purgeUser(userId);
    exchangeRepo.purgeUser(userId);
    shortagesRepo.purgeUser(userId);
    // DSGVO-Loeschung: Auch die eigenen Logistikmeldungen gehen mit. Ein neuer
    // Speicher, der hier fehlt, laesst personenbezogene Daten zurueck, obwohl
    // die Loeschung „ok" meldet — die teuerste Art von halber Arbeit.
    logistikRepo.purgeUser(userId);
    datenApi.nutzerEntfernen(userId); // Schnittstellen-Schlüssel gelten sonst weiter
    einladungen.nutzerEntfernen(userId);
    webPush.nutzerEntfernen(userId); // keine Alarme mehr an Geräte eines gelöschten Kontos
    rechnungen.nutzerEntfernen(userId); // Angaben weg; ausgestellte Rechnungen bleiben (Aufbewahrungspflicht)
    repo.deleteUser(userId);
    return { ok: true };
  }],

  // Engpasslage je Region / weltweit (services/regionLage.js).
  ['GET', /^\/api\/lage\/ebene$/, true, async ({ userId, query }) => {
    const land = activeCountry(userId, query);
    const ebene = query.get('ebene') === 'welt' ? 'welt' : 'region';
    const region = regionVon(land);
    const codes = ebene === 'welt' ? Object.keys(COUNTRIES) : laenderInRegion(region);
    const job = scheduler.status().find((j) => j.name === 'shortages');
    return { ebene, region, land, stand: (job && job.lastRunAt) || null, ...regionLage({ shortagesRepo, chronik, laender: COUNTRIES, codes }) };
  }],
  // Erste Schritte (services/ersteSchritte.js): Wirkstoffe zum Antippen.
  ['GET', /^\/api\/erste-schritte$/, true, async ({ userId, query }) => {
    const land = activeCountry(userId, query);
    return ersteSchritte({ shortagesRepo, land, sprache: (COUNTRIES[land] && COUNTRIES[land].locale_default) || 'de', region: regionVon(land), beobachtet: shortagesRepo.listWatch(userId) });
  }],
  // ── Web-Push (services/webPush.js) ──
  ['GET', /^\/api\/push$/, true, async ({ userId }) => ({ schluessel: webPush.oeffentlicherSchluessel(), geraete: webPush.geraete(userId) })],
  ['POST', /^\/api\/push\/abo$/, true, async ({ userId, body }) => webPush.abonnieren(userId, body.abo)],
  ['POST', /^\/api\/push\/abbestellen$/, true, async ({ userId, body }) => webPush.abbestellen(userId, body.endpoint)],
  ['POST', /^\/api\/push\/test$/, true, async ({ userId }) => {
    if (!webPush.geraete(userId)) throw new AppError('push_kein_geraet', 'Auf diesem Konto ist noch kein Gerät für Benachrichtigungen eingerichtet.', 409);
    return { ...(await webPush.senden(userId, testNachricht(pushSprache(userId)))), geraete: webPush.geraete(userId), __sichern: true };
  }],

  // ── Rechnungen für Tarife (services/rechnungen.js) ──
  ['GET', /^\/api\/rechnungen$/, true, async ({ userId }) => ({
    moeglich: rechnungen.rechnungMoeglich(), ueberweisung: rechnungen.ueberweisungMoeglich(),
    angaben: rechnungen.angaben(userId), ...rechnungen.meine(userId),
  })],
  ['POST', /^\/api\/rechnungen\/angaben$/, true, async ({ userId, body }) => ({ angaben: rechnungen.angabenSetzen(userId, body) })],
  ['POST', /^\/api\/rechnungen\/ueberweisung$/, true, async ({ userId, body }) => ({ rechnung: rechnungen.perRechnungBestellen(userId, body.productId) })],
  ['POST', /^\/api\/rechnungen\/zahlung\/([^/]+)$/, true, async ({ userId, params }) => ({ rechnung: rechnungen.fuerZahlung(userId, params[0]) })],
  ['GET', /^\/api\/rechnungen\/(AP-\d{4}-\d{4,})$/, true, async ({ userId, params }) => ({ rechnung: rechnungen.rechnung(userId, params[0]) })],

  // ── Daten-Schnittstelle (Business): Schlüssel verwalten ──
  ['GET', /^\/api\/daten-api\/schluessel$/, true, async ({ userId }) => ({
    berechtigt: payments.hasFeature(userId, 'api'), bis: payments.featureBis(userId, 'api'),
    schluessel: datenApi.liste(userId),
  })],
  ['POST', /^\/api\/daten-api\/schluessel$/, true, async ({ userId, body }) => {
    if (!payments.hasFeature(userId, 'api')) throw new AppError('api_tarif', 'Die Daten-Schnittstelle gehört zum Business-Tarif.', 402);
    return { schluessel: datenApi.anlegen(userId, body.name) };
  }],
  ['DELETE', /^\/api\/daten-api\/schluessel\/([a-f0-9]{1,24})$/, true, async ({ userId, params }) => datenApi.widerrufen(userId, params[0])],

  // ── Moderation (nur Redaktions-/Admin-Konten) ──
  // Prüfliste der Apotheken-Meldungen (services/shortages.js, pruefliste): neue Konten,
  // von der Meldenden eingeladene Bestätigende, kurz nacheinander angelegte Konten.
  ['GET', /^\/api\/mod\/meldungen$/, true, async ({ userId }) => ({ meldungen: shortages.pruefliste(userId) })],
  // Wie viel wartet auf die Redaktion? Nur Zahlen — für den Hinweis auf der Startseite
  // (vorher sah man offene Krypto-Zahlungen und Anzeigen erst, wenn man selbst nachsah).
  ['GET', /^\/api\/mod\/aufgaben$/, true, async ({ userId }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    const n = { krypto: payments.listPendingReview(userId, {}).length, anzeigen: anzeigen.zurPruefung(userId).length,
      meldungen: shortages.pruefliste(userId).length, berichte: social.moderationQueue(userId).length, verifizierungen: social.verificationQueue(userId).length };
    return { ...n, gesamt: Object.values(n).reduce((a, b) => a + b, 0) };
  }],
  ['POST', /^\/api\/mod\/meldungen\/([^/]+)\/bestaetigung-entfernen$/, true, async ({ userId, params, body }) => shortages.modBestaetigungEntfernen(userId, params[0], body.handle)],
  ['POST', /^\/api\/mod\/meldungen\/([^/]+)\/entfernen$/, true, async ({ userId, params }) => shortages.modEntfernen(userId, params[0])],
  ['GET', /^\/api\/reports$/, true, async ({ userId }) => ({ reports: social.moderationQueue(userId) })],
  ['POST', /^\/api\/reports\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveReport(userId, params[0], { remove: !!body.remove })],

  // ── Verifizierung (Apotheken-Nachweis) ──
  ['GET', /^\/api\/verify\/me$/, true, async ({ userId }) => social.myVerification(userId)],
  ['POST', /^\/api\/verify\/request$/, true, async ({ userId, body }) =>
    social.requestVerification(userId, { note: body.note, licenseNumber: body.licenseNumber })],
  ['GET', /^\/api\/verify\/requests$/, true, async ({ userId }) => ({ requests: social.verificationQueue(userId) })],
  ['POST', /^\/api\/verify\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveVerification(userId, params[0], !!body.approve)],
  // Rx-Einblick entziehen/zurueckgeben, OHNE die Verifizierung anzutasten.
  // Der Hebel fuer eine erloschene Betriebserlaubnis (domain/jurisdiction.js).
  ['POST', /^\/api\/verify\/([^/]+)\/rx$/, true, async ({ userId, params, body }) =>
    social.setRxAllowed(userId, params[0], body.allowed !== false)],

  // ── Kühlketten- und Transportmeldungen (B2B) ──────────────────────────────
  //  Keine Behörde meldet eine unterbrochene Kühlkette. Diese Information
  //  entsteht bei Spedition, Großhandel und Apotheke — und sonst nirgends.
  //  Deshalb ein MELDEWEG mit ehrlicher Leermeldung, keine Anzeige mit
  //  erfundenen Zeilen: Bei einer Kühlkette entscheidet daran, ob eine Charge
  //  vernichtet wird.
  //
  //  `logistikErlaubt` und NICHT `rxErlaubt`: Logistik ist hier die wichtigste
  //  Gruppe, beim Rx-Einblick ist sie ausgeschlossen.
  ['GET', /^\/api\/logistik$/, true, async ({ userId, query }) => logistik.list(userId, {
    art: query.get('art') || null,
    country: activeCountry(userId, query),
    offen: query.get('offen') !== '0',
  })],
  ['GET', /^\/api\/logistik\/mine$/, true, async ({ userId }) => ({ meldungen: logistik.mine(userId) })],
  ['POST', /^\/api\/logistik$/, true, async ({ userId, body }) => logistik.create(userId, {
    art: body.art, titel: body.titel, beschreibung: body.beschreibung,
    region: body.region, betroffen: body.betroffen,
    dringlichkeit: body.dringlichkeit, gueltigBis: body.gueltigBis,
  })],
  ['POST', /^\/api\/logistik\/([^/]+)\/behoben$/, true, async ({ userId, params }) => logistik.behoben(userId, params[0])],
  ['POST', /^\/api\/logistik\/([^/]+)\/delete$/, true, async ({ userId, params }) => logistik.remove(userId, params[0])],

  // ── Sicherheitsmeldungen (Rote-Hand-Briefe, Rückrufe) ─────────────────────
  //  Gespeist AUSSCHLIESSLICH aus den bereits angebundenen Behörden-Feeds
  //  (BfArM, PEI, EMA, FDA, …) über den Signal-Bestand. Keine neue Quelle,
  //  keine neuen Daten, kein Platzhalter — ein FILTER auf das, was ohnehin
  //  hereinkommt, für die Gruppe, die ihn am dringendsten braucht.
  //
  //  NICHT HINTER DER FACHKREIS-SCHRANKE, und das ist eine Entscheidung:
  //  Ein Rote-Hand-Brief des BfArM steht öffentlich auf bfarm.de. Ihn hier
  //  hinter eine Verifizierung zu legen, würde öffentliche Sicherheits-
  //  information verstecken — und eine Sperre, die nichts schützt, ist
  //  Theater. Die Schranke gilt für Rx-ANGEBOTE (Werbung/Handel, HWG § 10),
  //  nicht für amtliche Warnungen.
  //
  //  Was SEHR WOHL die Schranke bräuchte: von Herstellern selbst eingestellte
  //  Produkt-Updates. Die gibt es hier noch nicht, und solange es sie nicht
  //  gibt, wird auch kein leerer Bereich dafür angelegt.
  ['GET', /^\/api\/sicherheitsmeldungen$/, true, async ({ userId, query }) => {
    const land = activeCountry(userId, query);
    // RECALL ist der Kern (Rückruf, Chargensperre, Sicherheitswarnung).
    // REGULATORY kommt dazu, weil Rote-Hand-Briefe je nach Einstufung der KI
    // dort landen — und ein Brief, der wegen einer Kategorie-Entscheidung
    // unsichtbar bleibt, ist schlimmer als einer zu viel in der Liste.
    const kategorien = ['RECALL', 'REGULATORY'];
    const signale = kategorien
      .flatMap((k) => signalStore.list({ country: land, category: k, limit: 100 }))
      .sort((a, b) => String(b.verifiedAt).localeCompare(String(a.verifiedAt)))
      .slice(0, 100);
    return {
      signale,
      stand: signalStore.landStand(land),
      ki: aiKonfiguration() ? 'aktiv' : 'aus',
      // Ohne KI gibt es keine Kategorie — dann landet alles als NEWS und diese
      // Ansicht bleibt leer, obwohl Meldungen da sind. Das muss die Oberfläche
      // sagen können, sonst sieht es wie ein Defekt aus.
      kategorien,
    };
  }],

  // ── Ausweich-Suche bei Lieferabriss ───────────────────────────────────────
  //  Die Frage, mit der eine Apotheke bei einem Engpass dasteht: „Was kann ich
  //  stattdessen bestellen?" RxNorm liefert dazu den WIRKSTOFF (international
  //  brauchbar) und Praeparate mit demselben Wirkstoff (US-Bestand, als
  //  Referenz).
  //
  //  NUR FUER DEN FACHKREIS, und zwar nicht aus Rechtsgruenden, sondern weil
  //  die Antwort fachliche Einordnung braucht: „gleicher Wirkstoff" ist keine
  //  Austauschbarkeit. Wer das ohne Fachkunde liest, zieht den falschen
  //  Schluss — und genau diesen Schluss verbietet der Dienst ausdruecklich
  //  (SUBSTITUTIONS_HINWEIS, der in jeder Antwort mitfaehrt).
  //
  //  Ohne RxNorm (APOPULSE_RXNORM=off) antwortet der Endpunkt mit
  //  `available: false` statt zu schweigen.
  ['GET', /^\/api\/alternativen$/, true, async ({ userId, query }) => {
    const nutzer = rxBetrachter(userId);
    if (!rxErlaubt(nutzer)) {
      throw new AppError('alt_fachkreis',
        'Die Ausweich-Suche ist verifizierten Fachkreisen vorbehalten: „Gleicher Wirkstoff" ist keine '
        + 'Aussage über Austauschbarkeit, und diese Einordnung braucht Fachkunde.', 403);
    }
    const begriff = String(query.get('q') || '').trim();
    if (!begriff) throw new AppError('alt_q_missing', 'Bitte ein Präparat oder einen Wirkstoff angeben.', 400);
    if (!rxnorm) return { available: false, begriff, wirkstoffe: [], praeparate: [], grund: 'abgeschaltet' };
    const r = await rxnorm.alternativen(begriff);
    // Was in UNSEREN Daten zu den gefundenen Wirkstoffen liegt — das ist der
    // Teil, mit dem eine Apotheke etwas anfangen kann. Ein US-Produkt kann sie
    // nicht bestellen, einen Engpass im eigenen Land sehr wohl.
    const inn = (r.wirkstoffe || []).map((w) => w.name);
    const eigene = inn.length
      ? shortages.list().filter((sh) => inn.some((n) => String(sh.wirkstoff || '').toLowerCase().includes(n.toLowerCase())))
      : [];
    return { available: true, ...r, eigene_engpaesse: eigene.slice(0, 10) };
  }],

  // ── Uebersetzen auf Zuruf ─────────────────────────────────────────────────
  //  NUR TEXT geht hinein. Keine Adresse, kein Behoerdenname, keine Kennung —
  //  die Herkunft kann hier also nicht veraendert werden, weil sie nie
  //  hereinkommt. Das ist strukturell geloest und nicht per Bitte im Prompt;
  //  ein Prompt laesst sich umgehen, eine fehlende Eingabe nicht.
  //
  //  Angemeldet und ratenbegrenzt, weil jeder Aufruf beim Anbieter Geld
  //  kostet. Der Dienst hat zusaetzlich einen Zwischenspeicher, damit derselbe
  //  Text nicht zweimal bezahlt wird.
  ['GET', /^\/api\/translate\/status$/, true, async () => ({
    available: translate.verfuegbar(), languages: TRANSLATE_SPRACHEN, max_chars: TRANSLATE_MAX,
  })],
  ['POST', /^\/api\/translate$/, true, async ({ userId, body }) => {
    const key = 'tr:' + userId;
    if (translateLimiter.check(key).blocked) {
      throw new AppError('translate_rate', 'Zu viele Uebersetzungen in kurzer Zeit. Bitte kurz warten.', 429);
    }
    const r = await translate.uebersetze(body.text, body.to);
    // Nur bei einem echten Anbieter-Aufruf zaehlt es gegen das Limit; eine
    // Antwort aus dem Zwischenspeicher kostet nichts und soll nicht bremsen.
    if (!r.cached) translateLimiter.fail(key);
    return r;
  }],

  // ── Presse je Land ───────────────────────────────────────────────────────
  //  Was Medien DES angesehenen Landes über Arzneimittel berichten. Getrennt
  //  vom Behörden-Feed; jeder Artikel trägt `herkunft: 'presse'`.
  ['GET', /^\/api\/presse$/, true, async ({ userId, query }) => presseDienst.fuerLand(activeCountry(userId, query))],

  // ── Lagebild je Land (KI) ────────────────────────────────────────────────
  //  Zusammenfassung aus Behördenmeldungen und Presse; jeder Punkt mit
  //  Belegen, unbelegte Punkte verwirft der Server (services/lagebild.js).
  ['GET', /^\/api\/lagebild$/, true, async ({ userId, query }) => {
    const key = 'lb:' + userId;
    if (lagebildLimiter.check(key).blocked) {
      throw new AppError('lagebild_rate', 'Zu viele Lagebild-Abfragen in kurzer Zeit. Bitte kurz warten.', 429);
    }
    const sprache = String(query.get('lang') || '').toLowerCase();
    const r = await lagebildDienst.fuerLand(activeCountry(userId, query), { sprache });
    // Nur ein echter Anbieter-Aufruf zaehlt gegen das Limit.
    const gefragt = !r.zwischengespeichert && !['ki_aus', 'zu_wenig_quellen'].includes(r.grund);
    if (gefragt) lagebildLimiter.fail(key);
    return r;
  }],

  ['GET', /^\/api\/feed\/home$/, true, async ({ userId, query }) => feedSeite(social.homeFeed(userId), query, userId)],
  ['GET', /^\/api\/feed\/public$/, true, async ({ userId, query }) => ({ country: activeCountry(userId, query), ...feedSeite(social.publicFeed(userId, { sort: query.get('sort') || 'neu', filter: query.get('filter') || 'all', country: activeCountry(userId, query) }), query, userId) })],

  ['POST', /^\/api\/posts$/, true, async ({ userId, body }) => social.createPost(userId, { body: body.body, visibility: body.visibility, kind: body.kind, image: body.image, sourceUrl: body.sourceUrl, pollOptions: body.pollOptions })],
  // Drei Ebenen (docs/AFRIKA.md): `ebene=land` (Standard) | `region` | `welt`.
  //  region: alle Länder der Region des angesehenen Landes + die Regionsquelle
  //          (Afrika: Africa CDC, WHO Afrika; Europa: EMA).
  //  welt:   WHO + EMA + Africa CDC/WHO Afrika + alle Länder, deren Behörden in der Sprache der Person
  //          schreiben (`sprache`) — eine englischsprachige Apotheke in Kampala
  //          braucht FDA, MHRA, TGA und WHO, keine BfArM-Meldungen auf Deutsch.
  ['GET', /^\/api\/news$/, true, async ({ userId, query }) => {
    const land = activeCountry(userId, query);
    const ebene = ['region', 'welt'].includes(query.get('ebene')) ? query.get('ebene') : 'land';
    let herkunft = null;
    const region = regionVon(land);
    if (ebene === 'region') herkunft = [...laenderInRegion(region), ...Object.entries({ AFR: 'AFRICA', EU: 'EUROPE' }).filter(([, r]) => r === region).map(([k]) => k)];
    if (ebene === 'welt') {
      const sp = SUPPORTED_LOCALES.includes(query.get('sprache')) ? query.get('sprache') : ((COUNTRIES[land] && COUNTRIES[land].locale_default) || 'en');
      herkunft = ['INT', 'EU', 'AFR', ...Object.values(COUNTRIES).filter((c) => c.locales.includes(sp)).map((c) => c.code)];
    }
    // Warnungen (Fälschung/Rückruf) per Stichwort in der Behördenmeldung — `nur=warnungen` filtert.
    let posts = enrichPosts(social.newsFeed(userId, { country: land, herkunft }), userId).map((p) => ({ ...p, warnung: warnTyp(p.body) }));
    if (query.get('nur') === 'warnungen') posts = posts.filter((p) => p.warnung);
    return { country: land, ebene, region, posts };
  }],
  ['GET', /^\/api\/hashtag\/([^/]+)$/, true, async ({ userId, params }) => ({ tag: decodeURIComponent(params[0]), posts: enrichPosts(social.postsByHashtag(userId, decodeURIComponent(params[0])), userId) })],
  ['GET', /^\/api\/trending\/hashtags$/, true, async ({ userId }) => ({ hashtags: social.trendingHashtags(userId) })],
  // Mehrsprachige Patienten-Infokarten (Antibiotika) — für Aufklärung bei der Abgabe.
  // Quelle und Entsorgungs-Karte passend zum angesehenen Land (Österreich: AGES, sonst WHO).
  ['GET', /^\/api\/patient-info$/, true, async ({ userId, query }) => patientInfo.cards(query.get('lang') || 'de', { land: activeCountry(userId, query) })],
  // Länder-Register (öffentlich): für Länderauswahl bei Registrierung + Umschalter.
  // `preise`: Gibt es für das Land überhaupt Preisvergleiche? Die Startseite verspricht
  // „Preise vergleichen" nur dort, wo es etwas zu vergleichen gibt (bis 10/2026 auch in Uganda).
  // Land automatisch (domain/landVorschlag.js): nur Zeitzone und Sprach-Region des
  // Browsers — keine IP-Auswertung, kein Dienst Dritter, nichts wird gespeichert.
  ['GET', /^\/api\/land-vorschlag$/, false, async ({ query }) => landVorschlag({
    zeitzone: String(query.get('tz') || '').slice(0, 64),
    sprachen: String(query.get('sprachen') || '').split(',').slice(0, 10).map((s) => s.slice(0, 20)),
    laender: COUNTRIES,
  })],
  ['GET', /^\/api\/countries$/, false, async () => {
    const mitAngebot = new Set(rabatteRepo.listFlat().map((r) => String(r.country || '').toUpperCase()));
    return { countries: listCountries().map((c) => ({ ...c, preise: mitAngebot.has(c.code) || pricesRepo.listComparisons({ country: c.code }).length > 0 })) };
  }],
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
    if (!p) { const e = Object.assign(new Error('Beitrag nicht gefunden'), { code: 'post_not_found' }); e.status = 404; throw e; }
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
    if (exp && !isValidCalendarDay(exp)) { const e = Object.assign(new Error('Ungültiges Datum.'), { code: 'date_invalid' }); e.status = 400; throw e; }
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
    if (!d) { const e = Object.assign(new Error('Profil nicht gefunden'), { code: 'profile_not_found' }); e.status = 404; throw e; }
    // Offene Biete/Suche der Apotheke — Rechts-Gate am Heimatland des Betrachters (wie die
    // Austausch-Reiter): wo der Bestandsaustausch gesperrt ist, keine Einträge zeigen.
    const exBlocked = isFeatureBlocked(userCountry(userId), 'stock_exchange');
    // `viewerUserId` ist hier PFLICHT: Ohne ihn zeigte das Profil einer
    // Apotheke ihre Rx-Angebote jeder angemeldeten Person — die Hintertuer
    // neben der geschuetzten Liste (siehe exchange.byAuthor).
    const ex = exBlocked
      ? { eintraege: [], verborgen: 0, grund: null }
      : exchange.byAuthor(d.profile.user_id, { status: 'offen', viewerUserId: userId });
    return {
      ...d, posts: enrichPosts(d.posts, userId),
      exchange_entries: ex.eintraege,
      exchange_rx_hidden: ex.verborgen, exchange_rx_reason: ex.grund,
    };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)$/, true, async ({ params }) => ({ profile: social.getProfile(params[0]) })],
  ['POST', /^\/api\/profiles\/([^/]+)\/endorse$/, true, async ({ userId, params, body }) => social.endorseSkill(userId, params[0], body.skill)],
  ['POST', /^\/api\/profiles\/([^/]+)\/recommend$/, true, async ({ userId, params, body }) => ({ recommendation: social.writeRecommendation(userId, params[0], body.body) })],
  ['POST', /^\/api\/recommendations\/([^/]+)\/remove$/, true, async ({ userId, params }) => social.removeRecommendation(userId, params[0])],
  ['POST', /^\/api\/profile$/, true, async ({ userId, body }) => ({ profile: social.updateProfile(userId, body) })],
  ['POST', /^\/api\/follow$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (!target) { const e = Object.assign(new Error('Profil nicht gefunden'), { code: 'profile_not_found' }); e.status = 404; throw e; }
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
    if (!target) { const e = Object.assign(new Error('Profil nicht gefunden'), { code: 'profile_not_found' }); e.status = 404; throw e; }
    return { thread: social.startDm(userId, target.user_id) };
  }],
  ['GET', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params }) => social.dmConversation(userId, params[0])],
  ['POST', /^\/api\/dm\/([^/]+)\/hide$/, true, async ({ userId, params, body }) => social.setDmConversationHidden(userId, params[0], body.hidden !== false)],
  ['POST', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params, body }) => social.sendDm(userId, params[0], body.body)],

  // ── Lieferengpässe (Priorität 2) ──
  // is_antibiotic: markiert Antibiotika-Engpässe, damit das Frontend auf die
  // quellenbelegte AMR-Wissensecke verweisen kann (keine Substitutionsempfehlung).
  ['GET', /^\/api\/shortages$/, true, async ({ userId, query }) => {
    // Nur das eigene Land. Bis zum 06.09.2026 sah eine Apotheke in Nairobi
    // oesterreichische Referenzdaten als ihre Engpaesse — korrekt als
    // Referenzdaten gekennzeichnet und trotzdem im falschen Land. Auf
    // Engpassangaben hin wird umbestellt; das ist die eine Stelle, an der
    // eine plausible Falschanzeige teuer wird.
    //
    // `?country=` folgt demselben Muster wie /api/news: Der Laender-Umschalter
    // ist eine BESUCHS-Ansicht — wer nach Kenia schaut, will kenianische
    // Engpaesse sehen, nicht die des eigenen Betriebs. Ohne diesen Parameter
    // filterte die Ansicht stumm nach dem HEIMATLAND, und der Umschalter
    // aenderte an der Liste nichts. Genau das hat die Browser-Pruefung
    // gemeldet: Kenia zeigte weiter oesterreichische Zeilen.
    //
    // Ein unbekannter Wert faellt auf das Heimatland zurueck statt eine leere
    // Liste zu liefern — ein Tippfehler in der Adresse soll nicht wie ein
    // Ausfall aussehen.
    const gewuenscht = String((query && query.get('country')) || '').toUpperCase();
    const land = (gewuenscht && COUNTRIES[gewuenscht]) ? gewuenscht : userCountry(userId);
    // Verfügbare Alternativen (gleicher Wirkstoff, anderes Präparat im Preisvergleich) —
    // faktische Angabe (keine Substitutionsempfehlung). In price_compare-gesperrten Ländern: 0.
    const priceBlocked = isFeatureBlocked(userCountry(userId), 'price_compare');
    const byWk = new Map(); // wirkstoff (lower) -> Set von Präparat-Bezeichnungen
    if (!priceBlocked) {
      // Leichtgewichtig aus dem Repo (nur Wirkstoff/Bezeichnung) — ohne die teure
      // Ersparnis-/Aktions-/Feed-Aufbereitung von prices.comparisons().
      // Im selben Land wie die Engpassliste: Ein „es gibt 3 Alternativen"
      // aus einem fremden Markt waere eine Falschauskunft an genau der
      // Stelle, an der jemand ueber eine Umbestellung entscheidet.
      for (const g of pricesRepo.listComparisons({ country: land })) {
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
    // `chronik`: Wie oft war dieser Wirkstoff in diesem Land schon knapp —
    // seit Aufzeichnungsbeginn, nur aus Behördendaten (services/chronik.js).
    return {
      chronik_seit: chronik.aufzeichnungSeit(land),
      shortages: shortages.listWithCounts(userId, { country: land }).map(s => ({ ...s, is_antibiotic: amr.isAntibiotic(s.wirkstoff), price_alternatives: altCount(s), chronik: chronik.kurz(s.wirkstoff, s.country || land) })),
    };
  }],
  // Betriebs-Cockpit (services/betrieb.js): nur Summen, nur Moderation.
  ['GET', /^\/api\/betrieb$/, true, async ({ userId }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    const job = scheduler.status().find((j) => j.name === 'shortages') || null;
    return {
      ...betriebsZahlen({
        konten: repo.listUsers(), grants: repo.listEntitlementGrants('premium'),
        aktiv: (uid) => payments.hasFeature(uid, 'premium'), zahlungen: repo.listAllPayments(),
        quellen: engpassQuellen(), gemessen: coverage.alle(),
      }),
      abruf: { zuletzt: (job && job.lastRunAt) || null, ok: job ? job.lastOk ?? null : null },
      mail: { aktiv: mailer.aktiv, grund: mailer.grund },
      ki: aiKonfiguration() ? 'aktiv' : 'aus',
      // Wachstum und Werbung auf einen Blick: Aufrufe geteilter Links, Anzeigen.
      teilen: { aufrufe_7: teilAufrufeLetzte(7) },
      push: webPush.stand(),
      seiten: { aufrufe_7: [...seitenAufrufe].filter(([t]) => t > new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).reduce((n, [, z]) => n + z, 0) },
      anzeigen: { laufend: anzeigen.alleLaufenden(userId).filter((k) => k.zustand === 'laeuft').length, zur_pruefung: anzeigen.zurPruefung(userId).length },
      kanaele: kanaele.bericht(30),
      // Abgefangene Fehler seit dem letzten Start (Details im Render-Protokoll).
      fehler: { ...betriebsFehler },
    };
  }],
  // Startklar-Check (services/startklar.js): was der Betreiber noch einrichten muss.
  //  Nur OB etwas gesetzt ist — nie ein Wert, nie ein Geheimnis.
  ['GET', /^\/api\/startklar$/, true, async ({ userId }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    return startklar({
      env: process.env, dauerhaft: durabilityReport(),
      quellen: betriebsZahlen({ quellen: engpassQuellen(), gemessen: coverage.alle() }).quellen,
      mail: { aktiv: mailer.aktiv }, vapidFest: vapidAusUmgebung,
      wallets: cryptoWallets().map(({ id }) => ({ id })),
      zahlwege: Object.keys(buildPaymentProvidersFromEnv()).filter((k) => k !== 'coinbase'),
    });
  }],
  // ── Quellen testen und eintragen (Moderation) ─────────────────────────────
  //  Probe-Abruf: derselbe Weg wie der echte Lauf (holeEngpassQuelle), aber
  //  ohne den Bestand zu verändern. Zeigt die ersten erkannten Zeilen und die
  //  Gründe für verworfene — so sieht die Redaktion in Sekunden, ob eine
  //  Behörde wirklich liefert, ohne auf den nächsten 4-Stunden-Takt zu warten.
  ['POST', /^\/api\/quellen\/probe$/, true, async ({ userId, body }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    const q = body && body.id
      ? engpassQuellen().find((x) => x.id === body.id)
      : eigeneQuellen.entwurf(body || {});
    if (!q) { const e = Object.assign(new Error('Quelle nicht gefunden.'), { code: 'source_not_found' }); e.status = 404; throw e; }
    const start = Date.now();
    try {
      const { rows, rejected, spalten } = await holeEngpassQuelle(q);
      return {
        ok: rows.length > 0, id: q.id, land: q.country, ms: Date.now() - start, spalten: (spalten || []).slice(0, 40),
        zeilen: rows.length, verworfen: rejected.length, gruende: rejected.slice(0, 5),
        beispiele: rows.slice(0, 5).map((r) => ({ wirkstoff: r.wirkstoff, bezeichnung: r.bezeichnung, status: r.status, gemeldet_am: r.gemeldet_am })),
      };
    } catch (err) {
      return { ok: false, id: q.id, land: q.country, ms: Date.now() - start, fehler: (err && err.message) || String(err) };
    }
  }],
  ['POST', /^\/api\/quellen$/, true, async ({ userId, body }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    const q = eigeneQuellen.hinzufuegen(body || {});
    saveSoon();
    return { quelle: q };
  }],
  ['DELETE', /^\/api\/quellen\/([a-z0-9_]+)$/, true, async ({ userId, params }) => {
    if (!social.isModerator(userId)) { const e = new Error('Nur Moderation.'); e.status = 403; e.code = 'forbidden'; throw e; }
    const weg = eigeneQuellen.entfernen(params[0]);
    if (weg) saveSoon();
    return { entfernt: weg };
  }],
  // Wochenbericht: Vorschau (jede:r sieht den eigenen), Ein/Aus, Abmelden
  // per Link aus der Mail (Zweck-Token, ohne Anmeldung).
  ['GET', /^\/api\/wochenbericht\/vorschau$/, true, async ({ userId }) => ({ ...wochenbericht.vorschau(userId), premium: payments.hasFeature(userId, 'premium') })],
  ['POST', /^\/api\/wochenbericht\/einstellung$/, true, async ({ userId, body }) => {
    if (body && body.an === false) wochenbericht.abbestellen(userId); else wochenbericht.bestellen(userId);
    saveSoon();
    return { abbestellt: wochenbericht.istAbbestellt(userId) };
  }],
  ['POST', /^\/api\/wochenbericht\/abmelden$/, false, async ({ body }) => {
    const uid = verifyZweckToken('wb_abmelden', body && body.t);
    if (!uid || !repo.getUserById(uid)) { const e = new Error('Der Abmelde-Link ist ungültig.'); e.status = 400; e.code = 'link_invalid'; throw e; }
    wochenbericht.abbestellen(uid);
    saveSoon();
    return { abbestellt: true };
  }],
  // Chronik-Export (Premium): alle Episoden des angesehenen Landes. Die
  // Zusammenfassung je Wirkstoff ist frei (/api/shortages, /api/wirkstoff);
  // die vollständige Liste ist das Analysewerkzeug.
  ['GET', /^\/api\/chronik$/, true, async ({ userId, query }) => {
    if (!payments.hasFeature(userId, 'premium')) {
      const e = new Error('Der vollständige Engpass-Verlauf ist eine Premium-Funktion.'); e.code = 'premium_required'; e.status = 403; throw e;
    }
    const land = activeCountry(userId, query);
    return { land, aufzeichnung_seit: chronik.aufzeichnungSeit(land), episoden: chronik.alle(land) };
  }],
  ['GET', /^\/api\/shortages\/([^/]+)$/, true, async ({ userId, params }) => {
    const d = shortages.withActivity(userId, params[0]);
    if (!d) { const e = Object.assign(new Error('Engpass nicht gefunden'), { code: 'shortage_not_found' }); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/shortages\/([^/]+)\/post$/, true, async ({ userId, params, body }) => shortages.postAbout(userId, params[0], { body: body.body, visibility: body.visibility })],
  ['POST', /^\/api\/shortages\/([^/]+)\/status$/, true, async ({ userId, params, body }) => shortages.updateStatus(userId, params[0], { status: body.status, sourceUrl: body.sourceUrl })],
  ['POST', /^\/api\/shortages\/report$/, true, async ({ userId, body }) => shortages.reportShortage(userId, { wirkstoff: body.wirkstoff, bezeichnung: body.bezeichnung, grund: body.grund, status: body.status, voraussichtlichBis: body.voraussichtlichBis,
    // Land des eigenen Betriebs, nicht frei waehlbar: Sonst liesse sich die
    // Laenderregulierung durch eine falsche Angabe umgehen.
    country: userCountry(userId) })],
  ['POST', /^\/api\/shortages\/([^/]+)\/confirm$/, true, async ({ userId, params }) => shortages.confirmShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/unconfirm$/, true, async ({ userId, params }) => shortages.unconfirmShortage(userId, params[0])],
  // Aktualität von Apotheken-Meldungen: „Still short" / „Wieder lieferbar".
  ['POST', /^\/api\/shortages\/([^/]+)\/noch-aktuell$/, true, async ({ userId, params }) => shortages.nochAktuell(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/wieder-lieferbar$/, true, async ({ userId, params }) => shortages.wiederLieferbar(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/resolve$/, true, async ({ userId, params }) => shortages.resolveShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/expected$/, true, async ({ userId, params, body }) => shortages.updateExpectedDate(userId, params[0], body.voraussichtlichBis)],
  ['POST', /^\/api\/shortages\/([^/]+)\/report-update$/, true, async ({ userId, params, body }) => shortages.updateShortageReport(userId, params[0], { status: body.status, grund: body.grund })],

  // ── Beobachtungsliste (Wirkstoffe im Blick behalten) ──
  // ── Anzeigen für Unternehmen (services/anzeigen.js, docs/WERBUNG.md) ──────
  // Mediadaten (öffentlich): Plätze, Preise und ECHTE Reichweite — registrierte
  // Konten je Land und Berufsgruppe. Kleine Zahlen (1–9) werden nicht genannt,
  // damit sich niemand einzelnen Betrieben zuordnen lässt.
  ['GET', /^\/api\/werbung\/mediadaten$/, false, async () => {
    const zahl = (n) => (n >= 10 ? { anzahl: n } : { anzahl: null, unter_10: n > 0 });
    const profile = socialRepo.listProfiles().filter((p) => !p.is_editorial);
    const laender = Object.values(COUNTRIES).map((c) => {
      const hier = profile.filter((p) => String(p.country || '').toUpperCase() === c.code);
      return {
        land: c.code, konten: zahl(hier.length),
        verifiziert: zahl(hier.filter((p) => p.verified).length),
        je_gruppe: Object.fromEntries(ZIELGRUPPEN.map((g) => [g, zahl(hier.filter((p) => p.account_type === g).length)])),
      };
    });
    return {
      plaetze: anzeigen.plaetze(), laender,
      gesamt: zahl(profile.length), verifiziert: zahl(profile.filter((p) => p.verified).length),
      // Welche Münzen tatsächlich eingerichtet sind (vorher fest „BTC, ETH, SOL" im Text — USDT,
      // in Afrika am verbreitetsten, fehlte auch dann, wenn es eingerichtet war).
      zahlung: { krypto: cryptoWallets().length > 0, krypto_muenzen: [...new Set(cryptoWallets().map((w) => w.symbol))], rechnung: anzeigen.ueberweisungMoeglich() },
    };
  }],
  ['GET', /^\/api\/werbung\/firma$/, true, async ({ userId }) => ({ firma: anzeigen.firma(userId) })],
  ['POST', /^\/api\/werbung\/firma$/, true, async ({ userId, body }) => ({ firma: anzeigen.firmaSetzen(userId, body) })],
  ['GET', /^\/api\/werbung\/kampagnen$/, true, async ({ userId }) => ({ kampagnen: anzeigen.meine(userId), rechnung_moeglich: anzeigen.ueberweisungMoeglich() })],
  ['POST', /^\/api\/werbung\/kampagnen$/, true, async ({ userId, body }) => ({ kampagne: anzeigen.anlegen(userId, body) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)$/, true, async ({ userId, params, body }) => ({ kampagne: anzeigen.bearbeiten(userId, params[0], body) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/einreichen$/, true, async ({ userId, params }) => ({ kampagne: anzeigen.einreichen(userId, params[0]) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/pause$/, true, async ({ userId, params, body }) => ({ kampagne: anzeigen.pausieren(userId, params[0], body.an !== false) })],
  ['GET', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/statistik$/, true, async ({ userId, params }) => anzeigen.statistik(userId, params[0])],
  ['GET', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/krypto$/, true, async ({ userId, params }) => {
    const z = anzeigen.kampagneFuerZahlung(userId, params[0]);
    return payments.cryptoOptionsBetrag({ amountCents: z.betrag_cents, currency: z.waehrung, name: z.name });
  }],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/krypto\/start$/, true, async ({ userId, params, body }) => {
    const z = anzeigen.kampagneFuerZahlung(userId, params[0]);
    return payments.startCryptoPaymentBetrag(userId, { ref: 'anzeige:' + z.id, amountCents: z.betrag_cents, currency: z.waehrung, walletId: body.walletId, name: z.name });
  }],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/rechnung$/, true, async ({ userId, params }) => anzeigen.rechnungAusstellen(userId, params[0])],
  ['GET', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/rechnung$/, true, async ({ userId, params }) => ({ rechnung: anzeigen.rechnung(userId, params[0]) })],
  // Redaktion: prüfen, freigeben, ablehnen, Überweisung verbuchen, Notbremse.
  ['GET', /^\/api\/werbung\/pruefung$/, true, async ({ userId }) => ({ offen: anzeigen.zurPruefung(userId), aktiv: anzeigen.alleLaufenden(userId) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/freigeben$/, true, async ({ userId, params }) => ({ kampagne: anzeigen.freigeben(userId, params[0]) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/ablehnen$/, true, async ({ userId, params, body }) => ({ kampagne: anzeigen.ablehnen(userId, params[0], body.grund) })],
  ['POST', /^\/api\/werbung\/kampagnen\/([a-z0-9]+)\/ueberweisung-verbucht$/, true, async ({ userId, params }) => ({ kampagne: anzeigen.ueberweisungVerbuchen(userId, params[0]) })],
  // Auslieferung (zählt die Einblendung) und Klick (zählt mit Zeichen, leitet weiter).
  ['GET', /^\/api\/anzeigen\/platz\/(start|feed|seite)$/, true, async ({ userId, params }) => ({ anzeige: anzeigen.ausliefern(userId, params[0]), __sichern: true })],
  ['GET', /^\/api\/anzeigen\/([a-z0-9]+)\/klick$/, false, async ({ params, query }) => {
    const ziel = anzeigen.klick(params[0], query.get('z'));
    if (!ziel) { const e = Object.assign(new Error('Anzeige nicht gefunden.'), { code: 'ad_not_found' }); e.status = 404; throw e; }
    return { __weiterleitung: ziel };
  }],
  ['POST', /^\/api\/anzeigen\/([a-z0-9]+)\/ausblenden$/, true, async ({ userId, params }) => anzeigen.ausblenden(userId, params[0])],
  ['POST', /^\/api\/anzeigen\/([a-z0-9]+)\/melden$/, true, async ({ userId, params, body }) => anzeigen.melden(userId, params[0], body.grund)],
  // Vorrats-Radar: im Ausland amtlich knapp, hier nicht (services/radar.js).
  // Premium-Schnitt auf dem Server: gratis die ersten Einträge und die Zahl.
  ['GET', /^\/api\/radar$/, true, async ({ userId, query }) => vorratsRadar({
    chronik, land: activeCountry(userId, query), premium: payments.hasFeature(userId, 'premium'),
    beobachtet: shortagesRepo.listWatch(userId),
  })],
  // Sortiments-Check (Premium-Grenze im Dienst: gratis die ersten 15 Zeilen).
  ['POST', /^\/api\/sortiment\/pruefen$/, true, async ({ userId, body, query }) => {
    if (!String(body.text || '').trim()) throw new AppError('sortiment_leer', 'Bitte eine Liste einfügen (ein Wirkstoff oder Präparat je Zeile).');
    return sortiment.pruefen(userId, body.text, body.country ? normalizeCountry(body.country) : activeCountry(userId, query));
  }],
  ['GET', /^\/api\/watchlist$/, true, async ({ userId, query }) => ({ items: shortages.myWatchlist(userId, { country: activeCountry(userId, query) }) })],
  ['POST', /^\/api\/watchlist$/, true, async ({ userId, body }) => ({ items: shortages.watch(userId, body.wirkstoff) })],
  ['POST', /^\/api\/watchlist\/bulk$/, true, async ({ userId, body }) => ({ items: shortages.watchMany(userId, body.wirkstoffe) })],
  ['POST', /^\/api\/watchlist\/alert-all$/, true, async ({ userId, body }) => shortages.setWatchAlertAll(userId, body.pct)],
  ['DELETE', /^\/api\/watchlist\/([^/]+)$/, true, async ({ userId, params }) => ({ items: shortages.unwatch(userId, decodeURIComponent(params[0])) })],
  ['POST', /^\/api\/watchlist\/([^/]+)\/note$/, true, async ({ userId, params, body }) => ({ items: shortages.setWatchNote(userId, decodeURIComponent(params[0]), body.note) })],
  ['POST', /^\/api\/watchlist\/([^/]+)\/alert$/, true, async ({ userId, params, body }) => ({ items: shortages.setWatchAlert(userId, decodeURIComponent(params[0]), body.pct) })],

  // ── Preise (Priorität 3) ──
  // Wie Engpaesse und Rabatte: das ANGESEHENE Land (Laender-Umschalter),
  // nicht pauschal alles. Preise sind dabei der unmittelbarste Fall — an
  // ihnen haengt eine Zahl, die jemand einer Verhandlung zugrunde legt.
  ['GET', /^\/api\/prices$/, true, async ({ userId, query }) => { ensureFeatureAllowed('price_compare', userId); return { comparisons: prices.comparisons(userId, { country: activeCountry(userId, query) }), savings: prices.savingsSummary({ country: activeCountry(userId, query) }) }; }],
  ['GET', /^\/api\/prices\/([^/]+)$/, true, async ({ userId, params }) => {
    ensureFeatureAllowed('price_compare', userId);
    const d = prices.withActivity(userId, params[0]);
    if (!d) { const e = Object.assign(new Error('Preis nicht gefunden'), { code: 'price_not_found' }); e.status = 404; throw e; }
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
    if (!d) { const e = Object.assign(new Error('Rabatt-Aktion nicht gefunden'), { code: 'deal_not_found' }); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/rabatte\/([^/]+)\/post$/, true, async ({ userId, params, body, query }) => { ensureFeatureAllowed('deals', userId); return rabatte.postAbout(userId, params[0], { body: body.body, visibility: body.visibility }); }],

  // ── Bestandsaustausch (Biete/Suche) — in Ländern ohne zulässige P2P-Abgabe gesperrt ──
  ['GET', /^\/api\/exchange$/, true, async ({ userId, query }) => { ensureFeatureAllowed('stock_exchange', userId); const r = exchange.list(userId, { kind: query.get('kind') || null, status: query.get('status') || 'offen', q: query.get('q') || null, bundesland: query.get('bundesland') || null, sort: query.get('sort') || null,
      // Rechtsraum: Eine Wiener Apotheke soll keine brasilianischen Angebote
      // sehen — Arzneimittelhandel ueber Grenzen hinweg ist genehmigungs-
      // pflichtig (AMG Paragraf 48, Einfuhrlizenzen je Land).
      country: activeCountry(userId, query) }); return {
        entries: r.eintraege,
        // Offen benennen, was verborgen ist UND warum. Eine kuerzere Liste
        // ohne Hinweis sieht aus wie „hier ist nichts" — dabei ist etwas da,
        // nur nicht fuer diese Person (domain/jurisdiction.js).
        rx_hidden: r.verborgen, rx_reason: r.grund,
      }; }],
  ['POST', /^\/api\/exchange$/, true, async ({ userId, body, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.create(userId, { kind: body.kind, bezeichnung: body.bezeichnung, menge: body.menge, ort: body.ort, bundesland: body.bundesland, note: body.note, image: body.image, ablauf: body.ablauf, rx: body.rx }); }],
  ['GET', /^\/api\/exchange\/mine$/, true, async ({ userId, query }) => { ensureFeatureAllowed('stock_exchange', userId); return { entries: exchange.mine(userId, { status: query.get('status') || null }) }; }],
  ['POST', /^\/api\/exchange\/([^/]+)\/resolve$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.markResolved(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/reopen$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.reopen(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/reserve$/, true, async ({ userId, params, body }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.setReserved(userId, params[0], body.reserved !== false); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/renew$/, true, async ({ userId, params }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.renew(userId, params[0]); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/update$/, true, async ({ userId, params, body }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.update(userId, params[0], { bezeichnung: body.bezeichnung, menge: body.menge, ort: body.ort, bundesland: body.bundesland, note: body.note, ablauf: body.ablauf }); }],
  ['POST', /^\/api\/exchange\/([^/]+)\/delete$/, true, async ({ userId, params, query }) => { ensureFeatureAllowed('stock_exchange', userId); return exchange.remove(userId, params[0]); }],

  // ── Übergreifende Suche (Priorität 7) ── gesperrte Module aus den Treffern nehmen.
  ['GET', /^\/api\/search$/, true, async ({ userId, query }) => {
    const r = await search.search(userId, query.get('q') || '', { country: activeCountry(userId, query) });
    const home = userCountry(userId);
    const rabatteHits = isFeatureBlocked(home, 'deals') ? [] : r.rabatte;
    const exchangeHits = isFeatureBlocked(home, 'stock_exchange') ? [] : r.exchange;
    const priceHits = isFeatureBlocked(home, 'price_compare') ? [] : r.prices;
    const total = r.total - (r.rabatte.length - rabatteHits.length) - (r.exchange.length - exchangeHits.length) - (r.prices.length - priceHits.length);
    // Engpässe wie in der Engpass-Liste aufbereiten: Bis 10/2026 kamen hier die rohen Zeilen —
    // mit den Benutzer-IDs der bestätigenden Apotheken und ohne Vertrauensstufe
    // („, pharmacies signalent" statt „1 pharmacie signale").
    return { ...r, shortages: r.shortages.map((s) => shortages.fuerAnzeige(userId, s)), rabatte: rabatteHits, exchange: exchangeHits, prices: priceHits, total, posts: enrichPosts(r.posts, userId) };
  }],
];

// ── Daten-Schnittstelle: Abfragen mit Schlüssel ─────────────────────────────
const V1_ENGPASS_SPALTEN = ['wirkstoff', 'wirkstoff_schluessel', 'bezeichnung', 'land', 'status', 'grund', 'gemeldet_am', 'voraussichtlich_bis', 'herkunft', 'quelle', 'bestaetigt_von'];
const V1_PRUEF_SPALTEN = ['eingabe', 'wirkstoff', 'einstufung', 'status', 'voraussichtlich_bis', 'seit_tagen', 'herkunft', 'quelle', 'ausland'];
function v1Stand() {
  const job = scheduler.status().find((j) => j.name === 'shortages') || null;
  return (job && job.lastRunAt) || null;
}
function v1Laender(q) {
  const roh = String(q || '').toUpperCase().split(/[,;\s]+/).filter(Boolean);
  for (const c of roh) if (!COUNTRIES[c]) throw new AppError('api_land', `Unbekanntes Land: ${c.slice(0, 5)}`);
  return roh;
}
async function datenSchnittstelle(req, res, url) {
  const antwort = (code, obj, extra = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(JSON.stringify(obj));
  };
  const csv = (text, name) => {
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename="${name}"` });
    res.end(text);
  };
  try {
    if (ruhenderBereichFuer(url.pathname)) return antwort(404, { error: 'Nicht gefunden', code: 'not_found' });
    const auth = String(req.headers.authorization || '');
    // `?key=` nur für GET: Excel („Daten aus dem Web") kann keine Kopfzeilen setzen.
    const roh = (auth.match(/^Bearer\s+(apk_\S+)$/) || [])[1] || req.headers['x-api-key'] || (req.method === 'GET' ? url.searchParams.get('key') : null);
    const userId = zugangPruefen(roh, { api: datenApi, hatTarif: (uid) => payments.hasFeature(uid, 'api'), tarifBis: (uid) => payments.featureBis(uid, 'api') });
    const q = url.searchParams;
    const format = q.get('format') === 'csv' ? 'csv' : 'json';
    const stand = v1Stand();
    const hinweis = 'Herkunft je Zeile: behoerde = amtliche Liste, apotheken_meldung = gemeldet aus Apotheken (nicht amtlich). Keine Therapie- oder Austauschempfehlung.';

    if (req.method === 'GET' && url.pathname === '/api/v1/status') {
      return antwort(200, { ok: true, tarif_bis: payments.featureBis(userId, 'api'), stand, laender_mit_behoerdenliste: chronik.beobachteteLaender(), hinweis });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/engpaesse') {
      const laender = v1Laender(q.get('land'));
      const nurBehoerde = q.get('herkunft') === 'behoerde';
      const status = q.get('status');
      const zeilen = shortagesRepo.list()
        .filter(fuerSchnittstelle)
        .filter((z) => z.status === 'kritisch' || z.status === 'eingeschraenkt')
        .filter((z) => !laender.length || laender.includes(String(z.country || '').toUpperCase()))
        .filter((z) => !nurBehoerde || z.provenance === 'verified')
        .filter((z) => !status || z.status === status)
        .map((z) => engpassZeile(z, wirkstoffSchluessel));
      if (format === 'csv') return csv(alsCsv(zeilen, V1_ENGPASS_SPALTEN), 'apopulse-engpaesse.csv');
      return antwort(200, { stand, anzahl: zeilen.length, engpaesse: zeilen, hinweis });
    }
    if (url.pathname === '/api/v1/pruefen' && (req.method === 'GET' || req.method === 'POST')) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const land = v1Laender(body.land || q.get('land'))[0];
      if (!land) throw new AppError('api_land', 'Bitte ein Land angeben (land=AT).');
      const liste = Array.isArray(body.wirkstoffe) ? body.wirkstoffe.map(String).join('\n')
        : body.text ? String(body.text) : String(q.get('wirkstoffe') || '').split(/[;|]/).join('\n');
      if (!liste.trim()) throw new AppError('api_leer', 'Bitte Wirkstoffe angeben: wirkstoffe=Amoxicillin;Ibuprofen (GET) oder {"wirkstoffe": [...]} (POST).');
      const r = sortiment.pruefen(userId, liste, land, { zeilenFilter: fuerSchnittstelle });
      const ergebnisse = r.ergebnisse.map((e) => ({
        eingabe: e.eingabe, wirkstoff: e.wirkstoff || null, einstufung: e.einstufung, status: e.status || null,
        voraussichtlich_bis: e.voraussichtlich_bis || null, seit_tagen: e.seit_tagen ?? null,
        herkunft: e.herkunft === 'verified' ? 'behoerde' : e.herkunft === 'community' ? 'apotheken_meldung' : null,
        quelle: e.quelle || null,
        ausland: (e.ausland || []).map((a) => a.land),
      }));
      if (format === 'csv') return csv(alsCsv(ergebnisse, V1_PRUEF_SPALTEN), 'apopulse-pruefung.csv');
      return antwort(200, { land, stand, geprueft: r.geprueft, nicht_geprueft: r.gesperrt, zusammenfassung: r.zusammenfassung, ergebnisse, laender_mit_behoerdenliste: r.laender, hinweis });
    }
    return antwort(404, { error: 'Unbekannter Endpunkt. Verfügbar: /api/v1/status, /api/v1/engpaesse, /api/v1/pruefen' });
  } catch (e) {
    const code = e.status || 400;
    return antwort(code, e.code ? { error: e.message, code: e.code } : { error: e.message }, e.retryAfterS != null ? { 'Retry-After': String(e.retryAfterS) } : {});
  }
}

// ── Absturz-Schutz ────────────────────────────────────────────────────────
//  Bis 10/2026 baute die Verarbeitung als Erstes `new URL(req.url, 'http://' + Host)`
//  außerhalb jedes try — EINE Anfrage mit kaputter Host-Angabe („a b", „[") warf dort,
//  die Ablehnung fing niemand, und Node beendete den ganzen Server. Auf Render folgt
//  ein Neustart; ohne Datenbank wären damit alle Konten weg gewesen.
//  Jetzt: Adresse gegen einen festen Platzhalter lesen (Host wird hier nicht gebraucht —
//  öffentliche Adressen baut oeffentlicheBasis), und alles, was in einer Anfrage schief-
//  geht, endet als Antwort 500 statt als Absturz.
const server = http.createServer((req, res) => {
  anfrage(req, res).catch((e) => {
    betriebsFehler.anfragen++;
    console.error('Anfrage fehlgeschlagen:', req.method, String(req.url || '').slice(0, 200), (e && e.stack) || e);
    try {
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.', code: 'unbekannt' })); }
      else res.end();
    } catch { /* Verbindung schon weg */ }
  });
});
async function anfrage(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bad Request'); }
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

  // ── Daten-Schnittstelle /api/v1 (services/datenApi.js) ──
  //  Eigener Weg vor dem Router: Angemeldet wird mit einem Schnittstellen-
  //  Schlüssel, nicht mit dem Sitzungs-Token der App.
  if (pathname.startsWith('/api/v1/')) return datenSchnittstelle(req, res, url);

  // ── Bilder (domain/bilder.js): einmal laden, dann im Browser behalten ──
  //  Ohne Anmeldung, weil <img> kein Token mitschickt; die Adresse selbst
  //  (SHA-256 des Inhalts) ist nur aus einer berechtigten Antwort bekannt.
  //  private: kein Zwischenspeichern in fremden Proxys. immutable: Der Inhalt
  //  zur Adresse ändert sich nie.
  const mBild = req.method === 'GET' && pathname.match(/^\/api\/bild\/([0-9a-f]{64})$/);
  if (mBild) {
    const b = bildHolen(mBild[1]);
    if (!b) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('Bild nicht gefunden'); }
    const kopf = { 'Content-Type': b.typ, 'Cache-Control': 'private, max-age=31536000, immutable', ETag: `"${mBild[1]}"`, 'X-Content-Type-Options': 'nosniff' };
    if ((req.headers['if-none-match'] || '') === kopf.ETag) { res.writeHead(304, kopf); return res.end(); }
    res.writeHead(200, { ...kopf, 'Content-Length': b.daten.length });
    return res.end(b.daten);
  }

  // ── API ──
  if (pathname.startsWith('/api/')) {
    // Ruhende Bereiche (data/features.js) antworten, als gaebe es sie nicht.
    // Bewusst 404 statt 403: Ein geparkter Bereich soll nichts ueber sich
    // verraten, auch nicht seine Existenz. Die Pruefung steht VOR dem
    // Nachschlagen der Route, damit auch eine vorhandene Route stumm bleibt.
    const ruht = ruhenderBereichFuer(pathname);
    if (ruht) return json(req, res, 404, { error: 'Nicht gefunden', code: 'not_found' });
    const route = routes.find(([m, rx]) => m === req.method && rx.test(pathname));
    if (!route) return json(req, res, 404, { error: 'Nicht gefunden', code: 'not_found' });
    const [, rx, authRequired, handler] = route;
    const sitzung = sitzungAus(req);
    let userId = sitzung ? sitzung.userId : null;
    // Token gültig signiert, aber Nutzer existiert nicht mehr (Konto gelöscht) oder die
    // Sitzung wurde beendet (Passwort geändert, „überall abmelden") -> wie nicht angemeldet
    // behandeln, damit ein sauberes 401 statt eines Folgefehlers (400) kommt.
    if (userId && !sitzungGueltig(sitzung, repo.getUserById(userId))) userId = null;
    // Eigener Code, damit das Frontend eine ABGELAUFENE/UNGÜLTIGE Sitzung von anderen
    // 401 (falscher Login, falsches Passwort) unterscheiden und sauber zum Login führen kann.
    if (authRequired && !userId) return json(req, res, 401, { error: 'Nicht angemeldet', code: 'not_authenticated' });
    try {
      const body = (req.method === 'POST') ? await readBody(req) : {};
      const params = (pathname.match(rx) || []).slice(1);
      // Client-IP (hinter dem Render-Proxy steht die echte IP in x-forwarded-for).
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
      const result = await handler({ userId, body, params, query: url.searchParams, ip });
      // Weiterleitung (Anzeigen-Klick): gezählt ist schon, jetzt zum Ziel.
      if (result && result.__weiterleitung) {
        saveSoon();
        res.writeHead(302, { Location: result.__weiterleitung, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        return res.end();
      }
      if (req.method !== 'GET' || (result && result.__sichern)) saveSoon(); // Zustand nach jeder erfolgreichen Schreiboperation sichern (POST/DELETE)
      if (result && result.__sichern) delete result.__sichern;
      return json(req, res, 200, result ?? { ok: true }, { bilderEinbetten: pathname === '/api/me/export' });
    } catch (e) {
      const code = e instanceof ForbiddenError ? 403 : (e.status || 400);
      // e.code (falls gesetzt) erlaubt dem Frontend, die Meldung zu übersetzen.
      const payload = e.code ? { error: e.message, code: e.code } : { error: e.message };
      // Werte für Platzhalter der übersetzten Meldung (z. B. erwartetes Format der Transaktions-ID).
      if (e.code && e.params && typeof e.params === 'object') payload.params = e.params;
      if (e.retryAfterS != null) payload.retry_after_s = e.retryAfterS; // 429: Wartezeit fürs Frontend
      return json(req, res, code, payload);
    }
  }

  // ── Digital Asset Links (Android-App) ──
  //  MUSS vor dem SPA-Rueckfall stehen: Unbekannte Pfade liefern sonst
  //  index.html mit Status 200. Android bekaeme HTML statt JSON, die Pruefung
  //  schluege STILL fehl — kein Fehler im Protokoll, nur eine Adressleiste in
  //  der App, die niemand erklaeren kann. Siehe http/assetlinks.js.
  if (pathname === '/.well-known/assetlinks.json') {
    const doc = assetlinksDokument();
    if (!doc) return json(req, res, 404, { error: 'Nicht konfiguriert' });
    // Kein no-cache: Android holt die Datei beim ersten Start. Eine Stunde ist
    // kurz genug, um einen falschen Fingerabdruck schnell zu korrigieren.
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(JSON.stringify(doc, null, 2));
  }

  // ── Teilseiten mit Vorschau (teilseite.js) ──
  //  Vor dem SPA-Rückfall: Messenger brauchen fertiges HTML mit Open Graph.
  {
    const mL = pathname.match(/^\/teilen\/lage\/([A-Za-z]{2})$/);
    const mW = pathname.match(/^\/teilen\/w\/([A-Za-z]{2})\/([^/]{1,120})$/);
    if ((mL || mW) && req.method === 'GET') {
      const cc = (mL || mW)[1].toUpperCase();
      if (!COUNTRIES[cc]) return json(req, res, 404, { error: 'Unbekanntes Land.' });
      let name = '';
      if (mW) { try { name = decodeURIComponent(mW[2]).trim().slice(0, 80); } catch { return json(req, res, 400, { error: 'Ungültiger Name.' }); } }
      const sprache = (COUNTRIES[cc].locale_default) || 'de';
      const d = mL ? { art: 'lage', ...lageDaten(cc) } : { art: 'wirkstoff', ...wirkstoffLage(cc, name) };
      // Öffentliche Basis-Adresse: fest eingestellt, sonst aus der Anfrage.
      const basis = oeffentlicheBasis(req); // Seite wird 5 Minuten zwischengespeichert
      const tag = new Date().toISOString().slice(0, 10);
      teilAufrufe.set(tag, (teilAufrufe.get(tag) || 0) + 1);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      // Einladungs-Code am Link (?e=…) wandert in den Knopf — nur ein bekannter.
      const e = url.searchParams.get('e');
      const einladung = e && EINLADUNG_RE.test(e) && einladungen.aufloesen(e) ? e : null;
      return res.end(teilseite({ ...d, land: cc, sprache, pfad: pathname, einladung }, { basis }));
    }
  }

  // ── Öffentliche Engpass-Seiten, robots.txt, sitemap.xml ──
  //  Vor dem SPA-Rückfall: Suchmaschinen brauchen fertiges HTML — und eine
  //  unbekannte Adresse muss 404 sein, nicht die App-Hülle mit Status 200.
  if (req.method === 'GET' && (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/engpaesse' || pathname.startsWith('/engpaesse/'))) {
    const basis = oeffentlicheBasis(req);
    const sende = (code, typ, text, max = 900) => { res.writeHead(code, { 'Content-Type': `${typ}; charset=utf-8`, 'Cache-Control': code === 200 ? `public, max-age=${max}` : 'no-store' }); res.end(text); };
    if (pathname === '/robots.txt') return sende(200, 'text/plain', oeffentlich.robots({ basis }), 3600);
    if (pathname === '/sitemap.xml') return sende(200, 'application/xml', oeffentlich.sitemap({ basis }), 3600);
    const m = pathname.match(/^\/engpaesse(?:\/([a-zA-Z]{2})(?:\/([a-z0-9-]{1,80}))?)?\/?$/);
    let html = null;
    // Sprache für Übersicht und 404 (gehören keinem Land): aus Accept-Language.
    const sp = (String(req.headers['accept-language'] || '').toLowerCase().match(/\b(de|en|pt|fr|ar)\b/) || [null, 'en'])[1];
    if (m && !m[1]) { res.setHeader('Vary', 'Accept-Language'); html = oeffentlich.index({ basis, sp }); }
    else if (m && !m[2]) html = oeffentlich.land(m[1].toUpperCase(), { basis });
    else if (m) html = oeffentlich.wirkstoff(m[1].toUpperCase(), m[2], { basis });
    if (!html) { res.setHeader('Vary', 'Accept-Language'); return sende(404, 'text/html', oeffentlich.nichtGefunden({ sp })); }
    const tag = new Date().toISOString().slice(0, 10);
    seitenAufrufe.set(tag, (seitenAufrufe.get(tag) || 0) + 1);
    return sende(200, 'text/html', html);
  }

  // ── Sprachtexte: nur die eine Sprache, die gebraucht wird ──
  const sprachdatei = req.method === 'GET' && pathname.match(/^\/i18n\/([a-z]{2})\.js$/);
  if (sprachdatei) {
    const kodierung = kodierungWaehlen(req.headers['accept-encoding']);
    let d = null;
    try { d = sprachdateien.holen(sprachdatei[1], kodierung); } catch (e) { console.warn('ApoPulse: Sprachdatei — ' + ((e && e.message) || e)); }
    if (!d) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Unbekannte Sprache'); }
    const kopf = { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', ETag: d.etag, Vary: 'Accept-Encoding' };
    if ((req.headers['if-none-match'] || '') === d.etag) { res.writeHead(304, kopf); return res.end(); }
    res.writeHead(200, { ...kopf, ...(kodierung ? { 'Content-Encoding': kodierung } : {}), 'Content-Length': d.body.length });
    return res.end(d.body);
  }

  // ── Statisches Frontend ──
  let file = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    file = '/index.html'; // SPA-Fallback
  }
  const serve = path.join(PUBLIC_DIR, file);
  // Besuch über einen Kanal-Link (?k=tiktok) oder aus der Play-App (?src=twa) — nur die
  // Startseite, keine Vorschau-Abrufer von Messengern (services/kanaele.js).
  if (file === '/index.html' && req.method === 'GET') {
    const k = url.searchParams.get('k') || (url.searchParams.get('src') === 'twa' ? 'play' : null);
    if (k && !istVorschauAbruf(req.headers['user-agent']) && kanaele.zaehle(k, 'besuche')) saveSoon();
  }
  const ext = path.extname(serve);
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain',
  };
  const type = MIME[ext] || 'application/octet-stream';
  const isText = /^text\/|application\/(json|manifest\+json|javascript)/.test(type);
  // ETag aus dem Inhalt (statischerEtag oben): unverändert -> 304, spart Bandbreite — auch nach einem Deploy.
  // Cache-Control no-cache = immer revalidieren, damit Nutzer:innen nie eine veraltete
  // Version bekommen (die Assets sind nicht content-gehasht). Wichtig für langsame Leitungen.
  const stat = fs.statSync(serve);
  // Startseite: Kopf (Titel, Vorschau für WhatsApp & Co.) in der Sprache des Browsers
  // (http/startseiteKopf.js). Darum eigener ETag je Sprache und Vary.
  const istStart = serve === path.join(PUBLIC_DIR, 'index.html');
  const istManifest = serve === path.join(PUBLIC_DIR, 'manifest.webmanifest');
  const sp = istStart || istManifest ? kopfSprache(req.headers['accept-language']) : null;
  const etag = statischerEtag(serve, stat, sp);
  const headers = { 'Content-Type': type + (isText ? '; charset=utf-8' : ''), 'Cache-Control': 'no-cache', ETag: etag };
  if (isText) headers.Vary = 'Accept-Encoding';
  if (istStart || istManifest) headers.Vary = 'Accept-Language, Accept-Encoding';
  const kodierung = isText ? kodierungWaehlen(req.headers['accept-encoding']) : null;
  if ((req.headers['if-none-match'] || '') === etag) { res.writeHead(304, headers); return res.end(); }
  if (istStart || istManifest) {
    const roh = fs.readFileSync(serve, 'utf8');
    const html = Buffer.from(istStart ? startseiteKopf(roh, { sp, basis: oeffentlicheBasis(req) }) : manifestSprache(roh, sp));
    if (istStart) { headers['Content-Security-Policy'] = startseiteCsp(roh); headers['X-Content-Type-Options'] = 'nosniff'; headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'; }
    if (kodierung) { res.writeHead(200, { ...headers, 'Content-Encoding': kodierung }); return res.end(kodierenSync(html, kodierung)); }
    res.writeHead(200, headers); return res.end(html);
  }
  // Textassets (JS/CSS) komprimiert aus dem Speicher (http/komprimierung.js): Brotli
  // höchster Stufe, je Version nur einmal gerechnet — spürbar auf mobilen Leitungen.
  //  Unkomprimiert ebenfalls aus dem Speicher (gleiche, ggf. schlanke Fassung); Bilder direkt.
  if (isText) {
    kompression.holen(serve, etag, kodierung || 'roh').then((buf) => {
      res.writeHead(200, { ...headers, ...(kodierung ? { 'Content-Encoding': kodierung } : {}), 'Content-Length': buf.length });
      res.end(buf);
    }, () => { res.writeHead(200, headers); fs.createReadStream(serve).pipe(res); });
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(serve).pipe(res);
  }
}

server.listen(PORT, () => {
  // Tatsaechlicher Port: Bei PORT=0 (Tests) vergibt ihn das Betriebssystem.
  console.log(`ApoPulse Feed-Server läuft auf http://localhost:${server.address().port}`);
  // Große Dateien gleich nach dem Start komprimieren (im Hintergrund), damit die erste
  // Besucherin nach einem Deploy nicht auf die Brotli-Rechnung wartet. Nicht in Tests:
  // dort starten Dutzende Server, und jeder würde sonst Sekunden Rechenzeit verbrauchen.
  if (process.env.NODE_ENV === 'production') {
    for (const name of ['app.js', 'i18n.js', 'app.css', 'sw.js']) {
      try {
        const datei = path.join(PUBLIC_DIR, name);
        const etag = statischerEtag(datei, fs.statSync(datei));
        for (const k of ['br', 'gzip']) kompression.holen(datei, etag, k).catch(() => {});
      } catch { /* Datei fehlt: beim ersten Abruf ohnehin 404/Rückfall */ }
    }
  }
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
    // Android-App: nur eine Zeile, und nur wenn jemand sie konfiguriert hat.
    const android = assetlinksStatus();
    if (android) console.log(android);
    // KI-Anreicherung: eine Zeile, damit niemand raetselt, warum Signale
    // ohne Wirkstoff ankommen. Ohne Anbieter laeuft alles weiter — nur eben
    // unangereichert (services/aiExtract.js).
    console.log(referenzDaten
      ? 'ApoPulse: Referenzdaten AKTIV (APOPULSE_REFERENCE_DATA) — Engpaesse, Preise und '
        + 'Rabatte zeigen kuratierte Beispieldaten, erkennbar an „Referenzdaten".'
      : 'ApoPulse: Referenzdaten aus — es erscheinen nur echte Quellen. Preisvergleich und '
        + 'Rabatte bleiben leer, solange kein Grosshandel angebunden ist.');
    const ki = aiKonfiguration();
    console.log(ki
      ? `ApoPulse KI: Anreicherung aktiv (${ki.anbieter}, ${ki.modell}).`
      : 'ApoPulse KI: keine Anreicherung konfiguriert — Meldungen erscheinen mit Titel, '
        + 'Datum und Quelle, aber ohne Wirkstoff/Schweregrad. Siehe APOPULSE_AI_PROVIDER.');
    for (const zeile of d.warnings) console.warn('⚠️  ' + zeile);
  }
  // ── Zustand und Feed aus der Datenbank holen ────────────────────────────
  // Reihenfolge zählt: ERST der Gesamtzustand (Konten, Profile, Beiträge),
  // DANN die News-Nachlese. Andersherum legte die Nachlese Beiträge an, die der
  // Zustand gleich darauf überschreibt.
  if (process.env.NODE_ENV !== 'test' && db) {
    restoreStateFromDb()
      .then(() => restoreNewsFromDb())
      .then(() => restoreSignalsFromDb())
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
    // Wochenbericht: stündlich nachsehen, ob für diese Woche noch etwas fehlt
    // (montags ab 05:00 UTC; fiel der Montag aus, holt der nächste Lauf nach).
    // Premium-Ablauf: 3 Tage vorher erinnern (einmal je Ablaufdatum).
    scheduler.add('premium', {
      run: async () => { const n = payments.ablaufErinnern(); if (n) saveSoon(); return { erinnert: n }; },
      intervalMs: 6 * 3_600_000,
      startDelayMs: 120_000,
    });
    scheduler.add('wochenbericht', {
      run: async () => { const r = await wochenbericht.lauf(); if (r.gesendet) saveSoon(); return r; },
      intervalMs: 3_600_000,
      startDelayMs: 90_000,
    });
    // Apotheken-Meldungen: Meldende erinnern, wenn „noch aktuell?" fällig ist.
    scheduler.add('aktualitaet', {
      // Immer sichern: erinnern() meldet auch nachträglich erreichte „bestätigt"-Schwellen.
      run: async () => { const n = shortages.erinnern(); saveSoon(); return { erinnert: n }; },
      intervalMs: 6 * 3_600_000,
      startDelayMs: 150_000,
    });
    scheduler.add('shortages', {
      run: runShortageIngest,
      intervalMs: INTERVALS.shortages,
      startDelayMs: 25_000,
    });

    const newsCount = sourcesByKind('news', process.env).length;
    const shortageCount = Object.keys(liveSources()).length + Object.keys(livePriceSources()).length
      + Object.keys(liveRabatteSources()).length + engpassQuellen().length;
    console.log(
      `ApoPulse: Automatik aktiv — News alle ${INTERVALS.news / 60000} min aus ${newsCount} Quelle(n), ` +
      `Engpässe alle ${INTERVALS.shortages / 3600000} h aus ${shortageCount} Quelle(n). ` +
      'Stand jederzeit unter GET /api/live/status.',
    );
  }
});

// Für Integrationstests: erlaubt server.close(), damit der Prozess sauber endet.
export { server as httpServer };
