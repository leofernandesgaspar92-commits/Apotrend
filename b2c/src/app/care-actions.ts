'use server'

// ============================================================================
//  Server Actions der Care-Strecke
// ============================================================================
//  Auch hier gilt: Was aus dem Browser kommt, ist unvertrauenswürdig. Die
//  Einwilligungs- und Verschlüsselungslogik liegt deshalb im Service
//  (consent.ts / prescription.ts), nicht in der Komponente.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { grantConsent, hasValidConsent, revokeConsent, type ConsentPurpose } from '@/lib/consent'
import { submitPrescription, listForPatient, PrescriptionError } from '@/lib/prescription'
import { ConsentRequiredError } from '@/lib/consent'
import { sessionId } from '@/app/actions'

export type CareResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string }
  | null

export async function grantConsentsAction(
  _prev: CareResult,
  formData: FormData,
): Promise<CareResult> {
  const sid = await sessionId()
  const accepted = formData.getAll('purpose').map(String) as ConsentPurpose[]

  if (accepted.length === 0) {
    return {
      ok: false,
      code: 'consent_declined',
      message:
        'Ohne Einwilligung können wir die Rezept-Einreichung nicht anbieten. ' +
        'Alle anderen Bereiche bleiben nutzbar.',
    }
  }

  for (const purpose of accepted) grantConsent(sid, purpose)
  revalidatePath('/rezept')
  return { ok: true, message: 'Einwilligung erteilt.' }
}

export async function revokeConsentAction(formData: FormData): Promise<void> {
  const sid = await sessionId()
  const purpose = String(formData.get('purpose') ?? '') as ConsentPurpose
  revokeConsent(sid, purpose)
  revalidatePath('/rezept')
}

export async function submitPrescriptionAction(
  _prev: CareResult,
  formData: FormData,
): Promise<CareResult> {
  const sid = await sessionId()
  const content = String(formData.get('document') ?? '')

  try {
    const rx = submitPrescription({
      patientUserId: sid,
      pharmacyId: 'pharm-1',
      source: 'paper_upload',
      documentContent: content,
    })
    revalidatePath('/rezept')
    return {
      ok: true,
      message: `Rezept eingereicht (${rx.id}). Das Dokument wird nach der Einlösung gelöscht.`,
    }
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return { ok: false, code: error.code, message: error.message }
    }
    if (error instanceof PrescriptionError) {
      return { ok: false, code: error.code, message: error.message }
    }
    throw error
  }
}

export async function careState() {
  const sid = await sessionId()
  return {
    hasCore: hasValidConsent(sid, 'health_data_processing'),
    hasRx: hasValidConsent(sid, 'prescription_handling'),
    prescriptions: listForPatient(sid).map((p) => ({
      id: p.id,
      status: p.status,
      submittedAt: p.submittedAt,
      purgeAt: p.documentPurgeAt,
      documentPresent: p.document !== null,
    })),
  }
}
