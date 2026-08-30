'use client'

import { useFormState } from 'react-dom'
import { ConsentGate } from '@/components/care/ConsentGate'
import { Button } from '@/components/ui/Button'
import {
  grantConsentsAction,
  submitPrescriptionAction,
  type CareResult,
} from '@/app/care-actions'

/**
 * Rezept-Strecke: Einwilligung zuerst, Upload danach.
 *
 * Die Reihenfolge ist keine Höflichkeit, sondern die Rechtslage — ohne
 * wirksame Einwilligung darf das Dokument nicht einmal entgegengenommen werden.
 * Deshalb blendet die Seite den Upload nicht nur aus, sondern der Server lehnt
 * ihn zusätzlich ab (siehe test/care.test.ts).
 */

const CONSENT_ITEMS = [
  {
    purpose: 'health_data_processing',
    title: 'Verarbeitung von Gesundheitsdaten',
    body:
      'Ich willige ein, dass ApoPulse meine Gesundheitsdaten zur Beratung verarbeitet. ' +
      'Die Daten werden verschlüsselt gespeichert und nach der gesetzlichen Frist gelöscht.',
    required: true,
  },
  {
    purpose: 'prescription_handling',
    title: 'Rezept-Einreichung',
    body:
      'Ich willige ein, dass mein Rezept zur Einlösung an die gewählte Apotheke ' +
      'übermittelt wird. Das Dokument wird nach der Einlösung gelöscht.',
    required: true,
  },
  {
    purpose: 'medication_list',
    title: 'Medikationsliste speichern',
    body:
      'Ich willige ein, dass meine Medikationsliste gespeichert wird, um auf mögliche ' +
      'Wechselwirkungen hinweisen zu können.',
    required: false,
  },
]

function Result({ state }: { state: CareResult }) {
  if (!state) return null
  return (
    <p
      role={state.ok ? 'status' : 'alert'}
      data-testid={state.ok ? 'care-ok' : 'care-error'}
      className={
        state.ok
          ? 'mt-4 rounded border border-success-border bg-success-subtle px-4 py-3 text-sm font-semibold text-success'
          : 'mt-4 rounded border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger'
      }
    >
      {state.message}
    </p>
  )
}

export function ConsentStep() {
  const [state, formAction] = useFormState<CareResult, FormData>(grantConsentsAction, null)

  return (
    <>
      <form action={formAction} id="consent-form">
        <ConsentGate
          items={CONSENT_ITEMS}
          onSubmit={(accepted) => {
            const fd = new FormData()
            for (const p of accepted) fd.append('purpose', p)
            formAction(fd)
          }}
        />
      </form>
      <Result state={state} />
    </>
  )
}

export function UploadStep() {
  const [state, formAction] = useFormState<CareResult, FormData>(submitPrescriptionAction, null)

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 id="upload-heading" className="text-2xl font-bold text-content">
        Rezept einreichen
      </h2>
      <p className="mt-2 max-w-measure text-content-muted">
        Papier- oder Privatrezept. Das eingereichte Dokument wird verschlüsselt
        gespeichert und nach der Einlösung <strong>sofort gelöscht</strong>, spätestens
        nach 30 Tagen.
      </p>

      <div className="mt-4 rounded border border-info-border bg-info-subtle px-4 py-3 text-sm text-info">
        <strong>E-Rezept (gesetzlich Versicherte):</strong> Die Einlösung des GKV-E-Rezepts
        erfordert eine gematik-Zulassung und ist hier noch nicht möglich. Bitte nutzen Sie
        vorerst ein Papier- oder Privatrezept.
      </div>

      <form action={formAction} className="mt-4 grid gap-3">
        <label htmlFor="document" className="font-semibold text-content">
          Rezept (Foto oder Scan)
        </label>
        {/* Im Demo-Stand ein Textfeld statt Datei-Upload: der Weg durch
            Einwilligung, Verschlüsselung und Löschfrist ist derselbe. */}
        <textarea
          id="document"
          name="document"
          rows={3}
          required
          placeholder="Demo: Inhalt des Rezepts eintragen"
          className="rounded border border-border-strong bg-surface p-3 text-content focus-visible:outline-none focus-visible:ring focus-visible:ring-focus"
        />
        <div>
          <Button type="submit" variant="care" data-testid="rx-submit">
            Verschlüsselt einreichen
          </Button>
        </div>
      </form>

      <Result state={state} />
    </section>
  )
}
