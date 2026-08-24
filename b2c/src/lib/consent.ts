// ============================================================================
//  Einwilligungen (Art. 9 Abs. 2 lit. a DSGVO)
// ============================================================================
//  Gesundheitsdaten dürfen nur mit AUSDRÜCKLICHER Einwilligung verarbeitet
//  werden. Diese Umsetzung folgt vier Regeln:
//
//   1. GRANULAR   — je Zweck eine eigene Einwilligung. „Alles akzeptieren"
//                   für Videoaufzeichnung wäre unwirksam.
//   2. VERSIONIERT— festgehalten wird, WELCHE Fassung akzeptiert wurde. Ändert
//                   sich der Text, ist die alte Einwilligung nicht mehr aktuell.
//   3. WIDERRUFBAR— Widerruf ist so einfach wie die Erteilung (Art. 7 Abs. 3).
//   4. NACHWEISBAR— Zeitpunkt + gehashte IP; die Beweislast liegt beim
//                   Verantwortlichen (Art. 7 Abs. 1).
// ============================================================================

import { hashIp } from './crypto.ts'

export const CONSENT_PURPOSES = [
  'health_data_processing',
  'video_consultation',
  'video_recording',
  'prescription_handling',
  'medication_list',
] as const

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

/**
 * Aktuelle Fassung je Zweck. Wird ein Text geändert, wird hier hochgezählt —
 * bestehende Einwilligungen gelten damit automatisch als überholt und werden
 * erneut eingeholt, statt stillschweigend weiterzugelten.
 */
export const CURRENT_VERSION: Record<ConsentPurpose, string> = {
  health_data_processing: 'dse-2026-03-01',
  video_consultation: 'video-2026-03-01',
  video_recording: 'rec-2026-03-01',
  prescription_handling: 'rx-2026-03-01',
  medication_list: 'med-2026-03-01',
}

export const CONSENT_TEXT: Record<ConsentPurpose, { title: string; body: string }> = {
  health_data_processing: {
    title: 'Verarbeitung von Gesundheitsdaten',
    body:
      'Ich willige ein, dass Apotrend meine Gesundheitsdaten (z. B. Anliegen, ' +
      'Medikation) zur Beratung verarbeitet. Die Daten werden verschlüsselt ' +
      'gespeichert und nach der gesetzlichen Frist gelöscht.',
  },
  video_consultation: {
    title: 'Videosprechstunde',
    body:
      'Ich willige in die Durchführung einer Videosprechstunde ein. Die Übertragung ' +
      'erfolgt verschlüsselt; es findet keine Aufzeichnung statt.',
  },
  video_recording: {
    title: 'Aufzeichnung der Sprechstunde',
    body:
      'Ich willige zusätzlich in die Aufzeichnung ein. Diese Einwilligung ist ' +
      'freiwillig — die Sprechstunde findet auch ohne Aufzeichnung statt.',
  },
  prescription_handling: {
    title: 'Rezept-Einreichung',
    body:
      'Ich willige ein, dass mein Rezept zur Einlösung an die gewählte Apotheke ' +
      'übermittelt wird. Das Dokument wird nach der Einlösung gelöscht.',
  },
  medication_list: {
    title: 'Medikationsliste',
    body:
      'Ich willige ein, dass meine Medikationsliste gespeichert wird, um auf ' +
      'mögliche Wechselwirkungen hinweisen zu können.',
  },
}

/** Zwecke, ohne die der Dienst gar nicht erbracht werden kann. */
export const REQUIRED_FOR_CARE: ConsentPurpose[] = ['health_data_processing']

/** Freiwillige Zwecke — dürfen NICHT Voraussetzung für die Leistung sein (Koppelungsverbot). */
export const OPTIONAL_PURPOSES: ConsentPurpose[] = ['video_recording', 'medication_list']

export interface ConsentRecord {
  userId: string
  purpose: ConsentPurpose
  documentVersion: string
  granted: boolean
  grantedAt: Date
  revokedAt: Date | null
  ipHash: string | null
}

/** Steht stellvertretend für die Consent-Tabelle im health-Schema. */
const store = new Map<string, ConsentRecord[]>()

const key = (userId: string, purpose: ConsentPurpose) => `${userId}|${purpose}`

export function grantConsent(
  userId: string,
  purpose: ConsentPurpose,
  ip?: string,
): ConsentRecord {
  const record: ConsentRecord = {
    userId,
    purpose,
    documentVersion: CURRENT_VERSION[purpose],
    granted: true,
    grantedAt: new Date(),
    revokedAt: null,
    ipHash: ip ? hashIp(ip) : null,
  }
  const history = store.get(key(userId, purpose)) ?? []
  // Historie wird ANGEHÄNGT, nie überschrieben: der Nachweis muss lückenlos sein.
  history.push(record)
  store.set(key(userId, purpose), history)
  return record
}

export function revokeConsent(userId: string, purpose: ConsentPurpose): void {
  const history = store.get(key(userId, purpose))
  if (!history) return
  for (const record of history) {
    if (record.granted && !record.revokedAt) record.revokedAt = new Date()
  }
}

export function consentHistory(userId: string, purpose: ConsentPurpose): ConsentRecord[] {
  return [...(store.get(key(userId, purpose)) ?? [])]
}

/**
 * Gilt eine WIRKSAME Einwilligung? Drei Bedingungen müssen zusammen erfüllt sein:
 *  - erteilt, - nicht widerrufen, - für die AKTUELLE Textfassung.
 */
export function hasValidConsent(userId: string, purpose: ConsentPurpose): boolean {
  const history = store.get(key(userId, purpose))
  if (!history) return false
  return history.some(
    (r) =>
      r.granted &&
      r.revokedAt === null &&
      r.documentVersion === CURRENT_VERSION[purpose],
  )
}

export class ConsentRequiredError extends Error {
  readonly purpose: ConsentPurpose
  readonly code = 'consent_required'
  constructor(purpose: ConsentPurpose) {
    super(`Einwilligung fehlt oder ist überholt: ${CONSENT_TEXT[purpose].title}`)
    this.name = 'ConsentRequiredError'
    this.purpose = purpose
  }
}

/**
 * Torwächter vor jeder Verarbeitung von Gesundheitsdaten.
 * Wird in prescription.ts und consultation.ts VOR dem ersten Datenzugriff
 * aufgerufen — nicht in der Oberfläche, die man umgehen kann.
 */
export function requireConsent(userId: string, purpose: ConsentPurpose): void {
  if (!hasValidConsent(userId, purpose)) throw new ConsentRequiredError(purpose)
}

/** Nur für Tests. */
export function __resetConsents(): void {
  store.clear()
}
