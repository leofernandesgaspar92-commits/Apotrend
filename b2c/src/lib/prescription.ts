// ============================================================================
//  Rezept-Einreichung (Art. 9 DSGVO)
// ============================================================================
//  Kernprinzip Datenminimierung: Das Rezept-DOKUMENT wird nach der Einlösung
//  gelöscht — der Vorgang selbst bleibt als revisionssicherer Nachweis bestehen.
//  Ein Rezeptbild dauerhaft aufzubewahren wäre weder nötig noch zulässig.
//
//  Zum Start sind nur Papier-/Privatrezepte aktiv. Der GKV-E-Rezept-Weg ist
//  modelliert, aber gesperrt: er erfordert eine gematik-Zulassung (CardLink
//  oder Token aus der E-Rezept-App). Ihn ohne Zulassung „irgendwie" zu bauen
//  wäre nicht bloß unfertig, sondern unzulässig.
// ============================================================================

import { encrypt, decrypt, type Envelope } from './crypto.ts'
import { requireConsent } from './consent.ts'

export const PRESCRIPTION_SOURCES = [
  'paper_upload',
  'private_upload',
  'erezept_token',
  'erezept_cardlink',
] as const

export type PrescriptionSource = (typeof PRESCRIPTION_SOURCES)[number]

/** Wege, die ohne gematik-Zulassung betrieben werden dürfen. */
export const ENABLED_SOURCES: PrescriptionSource[] = ['paper_upload', 'private_upload']

export type PrescriptionStatus =
  | 'submitted'
  | 'in_review'
  | 'accepted'
  | 'rejected'
  | 'dispensed'
  | 'withdrawn'

/** Frist, nach der das Dokument spätestens verschwindet (Tage). */
export const DOCUMENT_RETENTION_DAYS = 30

export interface Prescription {
  id: string
  patientUserId: string
  pharmacyId: string
  source: PrescriptionSource
  status: PrescriptionStatus
  /** Verschlüsselter Dokumentinhalt — null, sobald gelöscht. */
  document: Envelope | null
  submittedAt: Date
  documentPurgeAt: Date
  documentPurgedAt: Date | null
}

const store = new Map<string, Prescription>()
let counter = 0

export class PrescriptionError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'PrescriptionError'
    this.code = code
  }
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000)
}

/**
 * Rezept einreichen.
 * Reihenfolge ist bewusst: ERST Einwilligung, DANN Weg-Prüfung, DANN Daten
 * anfassen. Ohne wirksame Einwilligung wird das Dokument nicht einmal gelesen.
 */
export function submitPrescription(opts: {
  patientUserId: string
  pharmacyId: string
  source: PrescriptionSource
  documentContent: string
  now?: Date
}): Prescription {
  const now = opts.now ?? new Date()

  requireConsent(opts.patientUserId, 'prescription_handling')
  requireConsent(opts.patientUserId, 'health_data_processing')

  if (!ENABLED_SOURCES.includes(opts.source)) {
    throw new PrescriptionError(
      'source_not_enabled',
      'Das E-Rezept kann derzeit nicht eingelöst werden — dafür ist eine ' +
        'gematik-Zulassung erforderlich. Bitte reichen Sie ein Papier- oder ' +
        'Privatrezept ein.',
    )
  }

  if (!opts.documentContent.trim()) {
    throw new PrescriptionError('document_missing', 'Kein Dokument übermittelt.')
  }

  const prescription: Prescription = {
    id: `rx-${++counter}`,
    patientUserId: opts.patientUserId,
    pharmacyId: opts.pharmacyId,
    source: opts.source,
    status: 'submitted',
    document: encrypt(opts.documentContent),
    submittedAt: now,
    documentPurgeAt: addDays(now, DOCUMENT_RETENTION_DAYS),
    documentPurgedAt: null,
  }
  store.set(prescription.id, prescription)
  return prescription
}

/**
 * Dokument lesen — nur die einreichende Person oder die Ziel-Apotheke.
 * Jeder Zugriff gehört protokolliert (HealthAccessLog); hier als Rückgabe-
 * Nebenwirkung modelliert, damit der Aufrufer ihn nicht vergessen kann.
 */
export function readDocument(
  id: string,
  actorUserId: string,
  actorPharmacyId?: string,
): { content: string; auditEntry: { actorUserId: string; resourceId: string; action: 'READ' } } {
  const p = store.get(id)
  if (!p) throw new PrescriptionError('not_found', 'Rezept nicht gefunden.')

  const isPatient = p.patientUserId === actorUserId
  const isPharmacy = actorPharmacyId !== undefined && p.pharmacyId === actorPharmacyId
  if (!isPatient && !isPharmacy) {
    throw new PrescriptionError('forbidden', 'Kein Zugriff auf dieses Rezept.')
  }

  if (!p.document) {
    throw new PrescriptionError(
      'document_purged',
      'Das Dokument wurde nach Ablauf der Aufbewahrungsfrist gelöscht.',
    )
  }

  return {
    content: decrypt(p.document),
    auditEntry: { actorUserId, resourceId: id, action: 'READ' },
  }
}

/** Als eingelöst markieren — das Dokument wird dabei SOFORT gelöscht. */
export function markDispensed(id: string, now = new Date()): Prescription {
  const p = store.get(id)
  if (!p) throw new PrescriptionError('not_found', 'Rezept nicht gefunden.')
  p.status = 'dispensed'
  // Datenminimierung: nach Einlösung besteht kein Zweck mehr für das Bild.
  p.document = null
  p.documentPurgedAt = now
  return p
}

/**
 * Aufräum-Job: löscht Dokumente, deren Frist abgelaufen ist.
 * Der Vorgang selbst bleibt bestehen — gelöscht wird nur der Inhalt.
 * Gibt die Anzahl gelöschter Dokumente zurück.
 */
export function purgeExpiredDocuments(now = new Date()): number {
  let purged = 0
  for (const p of store.values()) {
    if (p.document && p.documentPurgeAt.getTime() <= now.getTime()) {
      p.document = null
      p.documentPurgedAt = now
      purged++
    }
  }
  return purged
}

export function getPrescription(id: string): Prescription | undefined {
  return store.get(id)
}

export function listForPatient(userId: string): Prescription[] {
  return [...store.values()].filter((p) => p.patientUserId === userId)
}

/** Nur für Tests. */
export function __resetPrescriptions(): void {
  store.clear()
  counter = 0
}
