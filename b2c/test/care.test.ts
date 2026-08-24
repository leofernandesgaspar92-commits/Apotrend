// ============================================================================
//  Care-Strecke — Einwilligung, Verschlüsselung, Aufbewahrung
// ============================================================================
//  Der Bereich mit dem höchsten rechtlichen Risiko. Diese Tests prüfen genau
//  die Zusagen, die gegenüber Nutzer:innen und Aufsicht gemacht werden.
//
//  Aufruf:  node --experimental-strip-types --test test/care.test.ts
// ============================================================================

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { encrypt, decrypt, hashIp, currentKeyVersion } from '../src/lib/crypto.ts'
import {
  grantConsent,
  revokeConsent,
  hasValidConsent,
  requireConsent,
  consentHistory,
  ConsentRequiredError,
  CURRENT_VERSION,
  OPTIONAL_PURPOSES,
  __resetConsents,
} from '../src/lib/consent.ts'
import {
  submitPrescription,
  readDocument,
  markDispensed,
  purgeExpiredDocuments,
  getPrescription,
  PrescriptionError,
  DOCUMENT_RETENTION_DAYS,
  __resetPrescriptions,
} from '../src/lib/prescription.ts'

const USER = 'user-1'
const PHARMACY = 'pharm-1'

beforeEach(() => {
  __resetConsents()
  __resetPrescriptions()
})

function grantAllForPrescription(userId = USER) {
  grantConsent(userId, 'health_data_processing')
  grantConsent(userId, 'prescription_handling')
}

// --- Verschlüsselung --------------------------------------------------------

test('Verschlüsselung: Rundlauf stellt den Klartext wieder her', () => {
  const env = encrypt('Ramipril 5 mg, 1-0-0')
  assert.notEqual(env.cipher.toString('utf8'), 'Ramipril 5 mg, 1-0-0')
  assert.equal(decrypt(env), 'Ramipril 5 mg, 1-0-0')
  assert.equal(env.keyVersion, currentKeyVersion())
})

test('Verschlüsselung: manipulierter Ciphertext wird erkannt (GCM-Integrität)', () => {
  const env = encrypt('Vertrauliche Diagnose')
  env.cipher[0] = env.cipher[0]! ^ 0xff // ein Bit kippen
  assert.throws(() => decrypt(env))
})

test('Verschlüsselung: manipuliertes Auth-Tag wird erkannt', () => {
  const env = encrypt('Vertrauliche Diagnose')
  env.tag[0] = env.tag[0]! ^ 0xff
  assert.throws(() => decrypt(env))
})

test('Verschlüsselung: gleicher Klartext ergibt verschiedene Ciphertexte (Nonce)', () => {
  const a = encrypt('gleicher Text')
  const b = encrypt('gleicher Text')
  assert.notEqual(a.cipher.toString('hex'), b.cipher.toString('hex'))
})

test('IP wird nur gehasht gespeichert', () => {
  const hash = hashIp('192.0.2.42')
  assert.notEqual(hash, '192.0.2.42')
  assert.equal(hash, hashIp('192.0.2.42'), 'stabil für denselben Wert')
  assert.notEqual(hash, hashIp('192.0.2.43'), 'unterschiedlich für andere IP')
})

// --- Einwilligung -----------------------------------------------------------

test('Ohne Einwilligung gilt keine Verarbeitung als erlaubt', () => {
  assert.equal(hasValidConsent(USER, 'health_data_processing'), false)
  assert.throws(
    () => requireConsent(USER, 'health_data_processing'),
    (e: unknown) => e instanceof ConsentRequiredError && e.code === 'consent_required',
  )
})

test('Erteilte Einwilligung gilt — Widerruf beendet sie sofort', () => {
  grantConsent(USER, 'health_data_processing', '192.0.2.1')
  assert.equal(hasValidConsent(USER, 'health_data_processing'), true)

  revokeConsent(USER, 'health_data_processing')
  assert.equal(hasValidConsent(USER, 'health_data_processing'), false)
  assert.throws(() => requireConsent(USER, 'health_data_processing'), ConsentRequiredError)
})

test('Einwilligung zu einer ÜBERHOLTEN Textfassung gilt nicht mehr', () => {
  grantConsent(USER, 'health_data_processing')
  const history = consentHistory(USER, 'health_data_processing')
  assert.equal(history.length, 1)

  // Simuliert eine geänderte Datenschutzerklärung
  const original = CURRENT_VERSION.health_data_processing
  CURRENT_VERSION.health_data_processing = 'dse-2027-01-01'
  assert.equal(
    hasValidConsent(USER, 'health_data_processing'),
    false,
    'alte Fassung darf nicht stillschweigend weitergelten',
  )
  CURRENT_VERSION.health_data_processing = original
})

test('Einwilligungen sind granular — eine deckt nicht die andere', () => {
  grantConsent(USER, 'video_consultation')
  assert.equal(hasValidConsent(USER, 'video_consultation'), true)
  assert.equal(
    hasValidConsent(USER, 'video_recording'),
    false,
    'Aufzeichnung braucht eine eigene Einwilligung',
  )
})

test('Historie wird angehängt, nicht überschrieben (Nachweispflicht)', () => {
  grantConsent(USER, 'medication_list')
  revokeConsent(USER, 'medication_list')
  grantConsent(USER, 'medication_list')
  const history = consentHistory(USER, 'medication_list')
  assert.equal(history.length, 2)
  assert.ok(history[0]!.revokedAt instanceof Date, 'erster Eintrag bleibt mit Widerruf erhalten')
  assert.equal(history[1]!.revokedAt, null)
})

test('Aufzeichnung ist als freiwillig deklariert (Koppelungsverbot)', () => {
  assert.ok(OPTIONAL_PURPOSES.includes('video_recording'))
})

// --- Rezept-Einreichung -----------------------------------------------------

test('Rezept ohne Einwilligung wird abgelehnt — Dokument wird nicht angefasst', () => {
  assert.throws(
    () =>
      submitPrescription({
        patientUserId: USER,
        pharmacyId: PHARMACY,
        source: 'paper_upload',
        documentContent: 'BILDDATEN',
      }),
    ConsentRequiredError,
  )
})

test('Rezept mit Einwilligung wird verschlüsselt abgelegt', () => {
  grantAllForPrescription()
  const rx = submitPrescription({
    patientUserId: USER,
    pharmacyId: PHARMACY,
    source: 'paper_upload',
    documentContent: 'BILDDATEN-REZEPT',
  })
  assert.equal(rx.status, 'submitted')
  assert.ok(rx.document, 'Dokument vorhanden')
  assert.notEqual(rx.document!.cipher.toString('utf8'), 'BILDDATEN-REZEPT')
  assert.equal(readDocument(rx.id, USER).content, 'BILDDATEN-REZEPT')
})

test('E-Rezept ist ohne gematik-Zulassung gesperrt', () => {
  grantAllForPrescription()
  assert.throws(
    () =>
      submitPrescription({
        patientUserId: USER,
        pharmacyId: PHARMACY,
        source: 'erezept_token',
        documentContent: 'TOKEN',
      }),
    (e: unknown) => e instanceof PrescriptionError && e.code === 'source_not_enabled',
  )
})

test('Fremde dürfen das Dokument nicht lesen', () => {
  grantAllForPrescription()
  const rx = submitPrescription({
    patientUserId: USER,
    pharmacyId: PHARMACY,
    source: 'paper_upload',
    documentContent: 'BILDDATEN',
  })
  assert.throws(
    () => readDocument(rx.id, 'anderer-user'),
    (e: unknown) => e instanceof PrescriptionError && e.code === 'forbidden',
  )
  // Die Ziel-Apotheke darf
  assert.doesNotThrow(() => readDocument(rx.id, 'apotheker-1', PHARMACY))
  // Eine andere Apotheke nicht
  assert.throws(() => readDocument(rx.id, 'apotheker-2', 'pharm-999'), PrescriptionError)
})

test('Nach Einlösung ist das Dokument sofort weg — der Vorgang bleibt', () => {
  grantAllForPrescription()
  const rx = submitPrescription({
    patientUserId: USER,
    pharmacyId: PHARMACY,
    source: 'paper_upload',
    documentContent: 'BILDDATEN',
  })
  markDispensed(rx.id)

  const after = getPrescription(rx.id)!
  assert.equal(after.status, 'dispensed', 'Nachweis bleibt erhalten')
  assert.equal(after.document, null, 'Dokument gelöscht')
  assert.ok(after.documentPurgedAt instanceof Date)
  assert.throws(
    () => readDocument(rx.id, USER),
    (e: unknown) => e instanceof PrescriptionError && e.code === 'document_purged',
  )
})

test('Aufräum-Job löscht abgelaufene Dokumente — und nur die', () => {
  grantAllForPrescription()
  const start = new Date('2026-03-01T10:00:00Z')

  const alt = submitPrescription({
    patientUserId: USER, pharmacyId: PHARMACY, source: 'paper_upload',
    documentContent: 'ALT', now: start,
  })
  const neu = submitPrescription({
    patientUserId: USER, pharmacyId: PHARMACY, source: 'paper_upload',
    documentContent: 'NEU', now: new Date('2026-03-25T10:00:00Z'),
  })

  // Einen Tag nach Ablauf der Frist des ersten Rezepts
  const later = new Date(start.getTime() + (DOCUMENT_RETENTION_DAYS + 1) * 86_400_000)
  const purged = purgeExpiredDocuments(later)

  assert.equal(purged, 1, 'nur das abgelaufene')
  assert.equal(getPrescription(alt.id)!.document, null)
  assert.ok(getPrescription(neu.id)!.document, 'noch innerhalb der Frist')
})

test('Aufbewahrungsfrist wird beim Einreichen gesetzt, nicht später berechnet', () => {
  grantAllForPrescription()
  const now = new Date('2026-05-10T08:00:00Z')
  const rx = submitPrescription({
    patientUserId: USER, pharmacyId: PHARMACY, source: 'paper_upload',
    documentContent: 'X', now,
  })
  const expected = new Date(now.getTime() + DOCUMENT_RETENTION_DAYS * 86_400_000)
  assert.equal(rx.documentPurgeAt.getTime(), expected.getTime())
})
