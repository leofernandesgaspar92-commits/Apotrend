// ============================================================================
//  Kühlketten- und Transportmeldungen (B2B)
// ============================================================================
//  Zwei Zusicherungen stehen hier im Mittelpunkt:
//
//   1. LOGISTIK GEHÖRT DAZU, beim Rx-Einblick aber NICHT. Mit nur einer
//      Stufenprüfung wäre entweder die Spedition vom Kühlketten-Modul
//      ausgeschlossen (absurd — sie weiß es zuerst) oder sie hätte Zugriff auf
//      verschreibungspflichtige Angebote (falsch — sie befördert, sie erwirbt
//      nicht).
//   2. LEER IST EIN GÜLTIGER ZUSTAND, und „du darfst nicht" ist etwas anderes
//      als „es gibt nichts". Beides sieht sonst gleich aus, und das erste wäre
//      eine Falschaussage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createLogistikRepo } from '../src/repo/logistikRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createLogistikService, ARTEN, normalizeArt, normalizeDringlichkeit, istKalendertag } from '../src/services/logistik.js';
import {
  istVerifizierterBetrieb, istRxFachkreis, logistikErlaubt, rxErlaubt, VERIFIZIERTE_BETRIEBE,
} from '../src/domain/jurisdiction.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const logistikRepo = createLogistikRepo();
  const betrachterVon = (userId) => {
    if (!userId) return null;
    const prof = socialRepo.getProfileByUserId(userId);
    if (!prof) return { userId };
    const typ = prof.account_type;
    const stufe = !prof.verified ? 'UNVERIFIED'
      : typ === 'pharmacy' ? 'VERIFIED_PHARMACY'
        : typ === 'wholesale' ? 'VERIFIED_WHOLESALE'
          : typ === 'pharma' ? 'VERIFIED_MANUFACTURER'
            : typ === 'logistics' ? 'VERIFIED_LOGISTICS' : 'UNVERIFIED';
    return { userId, jurisdiction: String(prof.country || '').toUpperCase(), verificationStatus: stufe };
  };
  const logistik = createLogistikService({ repo: logistikRepo, social, betrachterVon });
  let n = 0;
  const mach = (handle, accountType = 'logistics', { verifiziert = true, land = 'AT' } = {}) => {
    n++;
    const r = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name: handle }, owner: { name: handle, email: `${handle}${n}@a.at`, password: 'geheim123' },
    });
    social.createProfile(r.user.id, { handle, displayName: handle, accountType, country: land });
    if (verifiziert) socialRepo.setProfileVerified(r.user.id, true);
    return r.user.id;
  };
  return { logistik, logistikRepo, social, socialRepo, mach };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Die zwei Stufenprüfungen
// ─────────────────────────────────────────────────────────────────────────────

test('Logistik ist ein verifizierter Betrieb — aber kein Rx-Fachkreis', () => {
  assert.equal(istVerifizierterBetrieb('VERIFIED_LOGISTICS'), true);
  assert.equal(istRxFachkreis('VERIFIED_LOGISTICS'), false);
  // Die anderen drei sind beides.
  for (const s of ['VERIFIED_PHARMACY', 'VERIFIED_WHOLESALE', 'VERIFIED_MANUFACTURER']) {
    assert.equal(istVerifizierterBetrieb(s), true, s);
    assert.equal(istRxFachkreis(s), true, s);
  }
  // Unbestätigtes ist keines von beidem.
  for (const s of ['UNVERIFIED', 'PENDING', '', null, 'VERIFIED_IRGENDWAS']) {
    assert.equal(istVerifizierterBetrieb(s), false, String(s));
    assert.equal(istRxFachkreis(s), false, String(s));
  }
  assert.equal(VERIFIZIERTE_BETRIEBE.length, 4);
});

test('eine Spedition darf melden, aber keine Rx-Angebote sehen', () => {
  const spedition = { userId: 'u', jurisdiction: 'AT', verificationStatus: 'VERIFIED_LOGISTICS' };
  assert.equal(logistikErlaubt(spedition), true);
  assert.equal(rxErlaubt(spedition), false);
});

test('der Rx-Entzug sperrt NICHT das Melden', () => {
  // `isRxAllowed: false` betrifft die Erwerbsberechtigung fuer Rx — nicht die
  // Frage, ob jemand eine unterbrochene Kuehlkette melden darf.
  const gh = { userId: 'u', jurisdiction: 'AT', verificationStatus: 'VERIFIED_WHOLESALE', isRxAllowed: false };
  assert.equal(rxErlaubt(gh), false);
  assert.equal(logistikErlaubt(gh), true);
});

test('ohne Land kein Zugang — die Jurisdiktion ist Pflicht', () => {
  assert.equal(logistikErlaubt({ userId: 'u', jurisdiction: '', verificationStatus: 'VERIFIED_LOGISTICS' }), false);
  assert.equal(logistikErlaubt(null), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Leer ist nicht dasselbe wie gesperrt
// ─────────────────────────────────────────────────────────────────────────────

test('ein verifizierter Betrieb sieht eine LEERE Liste — und darf melden', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  const r = logistik.list(l);
  // Der Startzustand. Es gibt keine Behoerdenschnittstelle fuer
  // Kuehlketten-Brueche; wer hier Beispieldaten einsetzt, erzeugt Zeilen, die
  // aussehen wie geprueft und keine sind.
  assert.deepEqual(r.meldungen, []);
  assert.equal(r.erlaubt, true);
  assert.equal(r.grund, null);
});

test('ein unverifizierter Betrieb bekommt „gesperrt", nicht „leer"', () => {
  const { logistik, mach } = setup();
  const l = mach('neu', 'logistics', { verifiziert: false });
  const r = logistik.list(l);
  assert.deepEqual(r.meldungen, []);
  // DER UNTERSCHIED: Ohne dieses Feld sieht eine Sperre aus wie ein leerer
  // Bereich, und die Oberflaeche sagt „hier ist nichts" — eine Falschaussage.
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'unverifiziert');
});

test('eine Privatnutzerin kann nicht melden', () => {
  const { logistik, mach } = setup();
  const p = mach('paul', 'private');
  assert.equal(logistik.list(p).erlaubt, false);
  assert.throws(() => logistik.create(p, { art: 'kuehlkette', titel: 'X' }),
    (e) => e.code === 'logistik_fachkreis');
});

test('ein unverifizierter Grosshaendler kann nicht melden', () => {
  const { logistik, mach } = setup();
  const g = mach('gerd', 'wholesale', { verifiziert: false });
  assert.throws(() => logistik.create(g, { art: 'zoll', titel: 'X' }),
    (e) => e.code === 'logistik_fachkreis' && /anonyme Behauptung/.test(e.message));
});

// ─────────────────────────────────────────────────────────────────────────────
//  Melden
// ─────────────────────────────────────────────────────────────────────────────

test('eine Meldung traegt Herkunft und melnden Betrieb', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  const m = logistik.create(l, {
    art: 'kuehlkette', titel: 'Kühlkette auf Route Wien–Luanda unterbrochen',
    beschreibung: 'Container 4 Stunden ohne Kühlung, Charge betroffen.',
    region: 'Hafen Luanda', betroffen: 'Insulin glargin', dringlichkeit: 'kritisch',
  });
  assert.equal(m.art, 'kuehlkette');
  assert.equal(m.dringlichkeit, 'kritisch');
  assert.equal(m.region, 'Hafen Luanda');
  assert.equal(m.betroffen, 'Insulin glargin');
  // Eine Eigenangabe ist etwas anderes als eine Behoerdenmeldung. Wer das
  // verwechselt, haelt eine Vermutung fuer einen Befund.
  assert.equal(m.provenance, 'self_reported');
  assert.equal(m.melder.handle, 'spedi');
  assert.equal(m.melder.account_type, 'logistics');
  assert.equal(m.melder.verified, true);
  assert.equal(m.country, 'AT');
});

test('das Land kommt aus dem PROFIL, nicht aus der Anfrage', () => {
  // Dieselbe Regel wie bei den Boersen-Eintraegen: Der Rechtsraum ist keine
  // Anzeigeoption.
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics', { land: 'DE' });
  const m = logistik.create(l, { art: 'zoll', titel: 'X', country: 'BR' });
  assert.equal(m.country, 'DE');
});

test('Pflichtangaben werden geprueft, nicht geraten', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  assert.throws(() => logistik.create(l, { art: 'quatsch', titel: 'X' }), (e) => e.code === 'logistik_art');
  assert.throws(() => logistik.create(l, { art: 'zoll', titel: '  ' }), (e) => e.code === 'logistik_titel');
  assert.throws(() => logistik.create(l, { art: 'zoll', titel: 'x'.repeat(201) }), (e) => e.code === 'logistik_titel_lang');
  assert.throws(() => logistik.create(l, { art: 'zoll', titel: 'X', gueltigBis: '2026-02-31' }), (e) => e.code === 'logistik_datum');
});

test('eine unbekannte Dringlichkeit wird zum Hinweis, nicht zu „kritisch"', () => {
  // Hochzustufen waere der schaedlichere Fehler: ein erfundener Alarm.
  assert.equal(normalizeDringlichkeit('quatsch'), 'hinweis');
  assert.equal(normalizeDringlichkeit(''), 'hinweis');
  assert.equal(normalizeDringlichkeit('kritisch'), 'kritisch');
  assert.equal(normalizeDringlichkeit('behoben'), 'behoben');
});

test('normalizeArt verwirft Unbekanntes statt zu raten', () => {
  for (const a of ARTEN) assert.equal(normalizeArt(a), a);
  assert.equal(normalizeArt('KUEHLKETTE'), 'kuehlkette');
  assert.equal(normalizeArt('kuehlung'), null);
  assert.equal(normalizeArt(''), null);
});

test('istKalendertag faengt den 31. Februar', () => {
  assert.equal(istKalendertag('2026-10-04'), true);
  assert.equal(istKalendertag('2026-02-31'), false);
  assert.equal(istKalendertag('04.10.2026'), false);
  assert.equal(istKalendertag(''), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Lesen und Filtern
// ─────────────────────────────────────────────────────────────────────────────

test('Meldungen bleiben im eigenen Rechtsraum', () => {
  const { logistik, mach } = setup();
  const at = mach('wien', 'logistics', { land: 'AT' });
  const de = mach('berlin', 'logistics', { land: 'DE' });
  logistik.create(at, { art: 'zoll', titel: 'AT-Meldung' });
  logistik.create(de, { art: 'zoll', titel: 'DE-Meldung' });
  assert.deepEqual(logistik.list(at).meldungen.map((m) => m.titel), ['AT-Meldung']);
  assert.deepEqual(logistik.list(de).meldungen.map((m) => m.titel), ['DE-Meldung']);
});

test('nach Art filtern', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  logistik.create(l, { art: 'kuehlkette', titel: 'Kühlung' });
  logistik.create(l, { art: 'zoll', titel: 'Zoll' });
  assert.deepEqual(logistik.list(l, { art: 'zoll' }).meldungen.map((m) => m.titel), ['Zoll']);
  assert.equal(logistik.list(l, {}).meldungen.length, 2);
});

test('behobene und abgelaufene Meldungen verschwinden aus der offenen Liste', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  const offen = logistik.create(l, { art: 'zoll', titel: 'laeuft noch' });
  const alt = logistik.create(l, { art: 'zoll', titel: 'abgelaufen', gueltigBis: '2020-01-01' });
  const fertig = logistik.create(l, { art: 'zoll', titel: 'behoben' });
  logistik.behoben(l, fertig.id);

  const sichtbar = logistik.list(l).meldungen.map((m) => m.titel);
  // Eine Kuehlketten-Warnung von vor drei Monaten ist keine Warnung mehr,
  // sondern Rauschen.
  assert.deepEqual(sichtbar, ['laeuft noch']);
  // Erreichbar bleibt sie trotzdem — geloescht wird nichts stillschweigend.
  const alle = logistik.list(l, { offen: false }).meldungen.map((m) => m.titel);
  assert.equal(alle.length, 3);
  assert.ok(alle.includes(alt.titel) && alle.includes(fertig.titel) && alle.includes(offen.titel));
});

test('neueste zuerst — bei einer Stoerung zaehlt die Aktualitaet', () => {
  const { logistik, logistikRepo, mach } = setup();
  const l = mach('spedi', 'logistics');
  const a = logistik.create(l, { art: 'zoll', titel: 'erste' });
  logistikRepo.update(a.id, { created_at: '2020-01-01T00:00:00.000Z' });
  logistik.create(l, { art: 'zoll', titel: 'zweite' });
  assert.deepEqual(logistik.list(l).meldungen.map((m) => m.titel), ['zweite', 'erste']);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Ändern und Löschen
// ─────────────────────────────────────────────────────────────────────────────

test('nur der meldende Betrieb schliesst oder loescht seine Meldung', () => {
  const { logistik, mach } = setup();
  const a = mach('spedi_a', 'logistics');
  const b = mach('spedi_b', 'logistics');
  const m = logistik.create(a, { art: 'kuehlkette', titel: 'Meine Meldung' });
  assert.throws(() => logistik.behoben(b, m.id), (e) => e.code === 'logistik_not_owner');
  assert.throws(() => logistik.remove(b, m.id), (e) => e.code === 'logistik_not_owner');
  assert.equal(logistik.behoben(a, m.id).dringlichkeit, 'behoben');
  assert.equal(logistik.remove(a, m.id).ok, true);
  assert.equal(logistik.list(a, { offen: false }).meldungen.length, 0);
});

test('eine unbekannte Meldung ergibt 404, keinen Absturz', () => {
  const { logistik, mach } = setup();
  const l = mach('spedi', 'logistics');
  assert.throws(() => logistik.behoben(l, 'gibt-es-nicht'), (e) => e.code === 'logistik_not_found');
  assert.throws(() => logistik.remove(l, 'gibt-es-nicht'), (e) => e.code === 'logistik_not_found');
});

test('„Meine Meldungen" zeigt nur die eigenen', () => {
  const { logistik, mach } = setup();
  const a = mach('spedi_a', 'logistics');
  const b = mach('spedi_b', 'logistics');
  logistik.create(a, { art: 'zoll', titel: 'A' });
  logistik.create(b, { art: 'zoll', titel: 'B' });
  assert.deepEqual(logistik.mine(a).map((m) => m.titel), ['A']);
});

test('der Speicher uebersteht einen Neustart (Snapshot)', () => {
  // Bei den VerifiedSignals fehlte genau dieser Eintrag im Snapshot, und der
  // gesammelte Bestand war nach jedem Deploy weg.
  const { logistik, logistikRepo, mach } = setup();
  const l = mach('spedi', 'logistics');
  logistik.create(l, { art: 'kuehlkette', titel: 'Ueberlebt das Deploy' });
  const snap = logistikRepo.__dump();
  const neu = createLogistikRepo();
  neu.__load(snap);
  assert.equal(neu.list().length, 1);
  assert.equal(neu.list()[0].titel, 'Ueberlebt das Deploy');
});

test('purgeUser entfernt die Meldungen eines geloeschten Kontos', () => {
  const { logistik, logistikRepo, mach } = setup();
  const a = mach('spedi_a', 'logistics');
  const b = mach('spedi_b', 'logistics');
  logistik.create(a, { art: 'zoll', titel: 'A' });
  logistik.create(b, { art: 'zoll', titel: 'B' });
  logistikRepo.purgeUser(a);
  assert.deepEqual(logistikRepo.list().map((m) => m.titel), ['B']);
});
