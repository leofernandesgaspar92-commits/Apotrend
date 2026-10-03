// Digital Asset Links (http/assetlinks.js) — der Beweis, dass App und Website
// zusammengehören.
//
// Warum das so genau geprüft wird: Ist die Datei falsch oder fehlt sie, zeigt
// die Android-App eine Browser-Adressleiste. Sie funktioniert, sieht aber aus
// wie ein Browser-Fenster mit Logo — und es gibt keine Fehlermeldung, die das
// erklärt. Ein stiller Fehler, der erst nach der Veröffentlichung auffällt.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSETLINKS_ENV, parseFingerprints, istPaketname,
  assetlinksDokument, assetlinksStatus,
} from '../src/http/assetlinks.js';

const FP_A = 'A1'.repeat(32);
const FP_B = 'B2'.repeat(32);
const mitDoppelpunkten = (f) => f.match(/.{2}/g).join(':');

const env = (paket, fp) => ({
  [ASSETLINKS_ENV.paket]: paket,
  [ASSETLINKS_ENV.fingerabdruecke]: fp,
});

// ── Eingabeformen, die Menschen tatsächlich einfügen ────────────────────────

test('Fingerabdruck wird aus jeder üblichen Schreibweise erkannt', () => {
  const erwartet = [mitDoppelpunkten(FP_A)];
  // Aus der Play Console kopiert (mit Doppelpunkten, Großbuchstaben)
  assert.deepEqual(parseFingerprints(mitDoppelpunkten(FP_A)), erwartet);
  // Aus keytool kopiert (ohne Doppelpunkte, klein)
  assert.deepEqual(parseFingerprints(FP_A.toLowerCase()), erwartet);
  // Mit Leerraum und Zeilenumbruch drumherum
  assert.deepEqual(parseFingerprints(`\n  ${mitDoppelpunkten(FP_A)}  \n`), erwartet);
});

test('mehrere Fingerabdrücke, egal womit getrennt', () => {
  const beide = [mitDoppelpunkten(FP_A), mitDoppelpunkten(FP_B)];
  for (const trenner of [',', '; ', ' ', '\n']) {
    assert.deepEqual(parseFingerprints(FP_A + trenner + FP_B), beide, `Trenner: ${JSON.stringify(trenner)}`);
  }
});

test('ein doppelt eingetragener Schlüssel erscheint nur einmal', () => {
  // Kommt vor, wenn jemand seinen eigenen Schlüssel hochgeladen hat: Upload-
  // und App-Signing-Fingerabdruck sind dann identisch.
  assert.deepEqual(parseFingerprints(`${FP_A},${mitDoppelpunkten(FP_A)}`), [mitDoppelpunkten(FP_A)]);
});

test('Unvollständiges wird VERWORFEN, nicht durchgereicht', () => {
  // Ein halb abgetippter Fingerabdruck in der Datei sieht aus wie eine
  // Konfiguration und ist keine. Dann lieber gar kein Eintrag.
  assert.deepEqual(parseFingerprints('AB:CD:EF'), []);                 // zu kurz
  assert.deepEqual(parseFingerprints('Z'.repeat(64)), []);             // kein Hex
  assert.deepEqual(parseFingerprints(''), []);
  assert.deepEqual(parseFingerprints(null), []);
  // Gültiges neben Ungültigem: Nur das Gültige bleibt.
  assert.deepEqual(parseFingerprints(`kaputt, ${FP_A}`), [mitDoppelpunkten(FP_A)]);
});

test('Paketnamen werden geprüft', () => {
  assert.equal(istPaketname('com.apopulse.app'), true);
  assert.equal(istPaketname('at.apopulse.feed'), true);
  assert.equal(istPaketname('apopulse'), false);        // kein Punkt
  assert.equal(istPaketname('com..app'), false);        // leeres Segment
  assert.equal(istPaketname('1com.app'), false);        // beginnt mit Ziffer
  assert.equal(istPaketname(''), false);
});

// ── Das Dokument selbst ─────────────────────────────────────────────────────

test('das Dokument hat genau die Form, die Android erwartet', () => {
  const doc = assetlinksDokument(env('com.apopulse.app', `${FP_A},${FP_B}`));
  assert.equal(Array.isArray(doc), true, 'Android erwartet ein ARRAY auf oberster Ebene');
  assert.deepEqual(doc[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(doc[0].target.namespace, 'android_app');
  assert.equal(doc[0].target.package_name, 'com.apopulse.app');
  assert.deepEqual(doc[0].target.sha256_cert_fingerprints,
    [mitDoppelpunkten(FP_A), mitDoppelpunkten(FP_B)]);
});

test('ohne gültige Konfiguration gibt es KEIN Dokument', () => {
  // null heißt für den Server: 404. Ausdrücklich nicht „leeres Dokument" —
  // eine leere, aber gültige Datei sähe für Android wie eine bewusste
  // Verweigerung aus und wäre schwerer zu diagnostizieren als nichts.
  assert.equal(assetlinksDokument(env('', FP_A)), null);
  assert.equal(assetlinksDokument(env('com.apopulse.app', '')), null);
  assert.equal(assetlinksDokument(env('keinpaketname', FP_A)), null);
  assert.equal(assetlinksDokument({}), null);
});

// ── Die Meldung beim Start ──────────────────────────────────────────────────

test('wer keine App will, bekommt keine Meldung', () => {
  assert.equal(assetlinksStatus({}), null);
});

test('eine halbe Konfiguration wird benannt, nicht verschwiegen', () => {
  assert.match(assetlinksStatus(env('com.apopulse.app', 'kaputt')), /keinen gültigen/);
  assert.match(assetlinksStatus(env('kein-paket', FP_A)), /kein Paketname/);
  // Beide Male muss die FOLGE dastehen, nicht nur der Mangel: Ohne „die App
  // zeigt eine Adressleiste" weiß niemand, warum ihn das kümmern sollte.
  assert.match(assetlinksStatus(env('com.apopulse.app', 'kaputt')), /Adressleiste/);
});

test('EIN Fingerabdruck wird als wahrscheinlicher Fehler gemeldet', () => {
  // Der haeufigste Fehler ueberhaupt: Play App Signing signiert die App NEU.
  // Auf dem Geraet landet ein anderer Fingerabdruck als der eigene. Mit nur
  // einem Eintrag laeuft der Selbsttest und der Store-Download zeigt eine
  // Adressleiste.
  const m = assetlinksStatus(env('com.apopulse.app', FP_A));
  assert.match(m, /EINEM Fingerabdruck/);
  assert.match(m, /Play App Signing/);
});

test('zwei Fingerabdrücke gelten als in Ordnung', () => {
  const m = assetlinksStatus(env('com.apopulse.app', `${FP_A},${FP_B}`));
  assert.match(m, /aktiv/);
  assert.doesNotMatch(m, /Adressleiste/);
});
