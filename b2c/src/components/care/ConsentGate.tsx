'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * ConsentGate — Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.
 *
 * Bewusste Gestaltung gegen die üblichen Dark Patterns:
 *  - Kästchen sind VORAB LEER. Vorangekreuzt wäre keine Einwilligung (EuGH, Planet49).
 *  - Freiwillige Zwecke sind sichtbar als solche markiert und blockieren nicht.
 *  - Die Ablehnung ist genauso erreichbar wie die Zustimmung — kein versteckter
 *    grauer Link neben einem großen grünen Knopf.
 *  - Der volle Text steht da, nicht hinter „Details anzeigen".
 */

export interface ConsentItem {
  purpose: string
  title: string
  body: string
  required: boolean
}

export function ConsentGate({
  items,
  onSubmit,
  submitLabel = 'Einwilligen und fortfahren',
  pending = false,
}: {
  items: ConsentItem[]
  onSubmit: (accepted: string[]) => void
  submitLabel?: string
  pending?: boolean
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const requiredPurposes = items.filter((i) => i.required).map((i) => i.purpose)
  const allRequiredChecked = requiredPurposes.every((p) => checked[p])
  const missing = requiredPurposes.filter((p) => !checked[p]).length

  return (
    <section
      aria-labelledby="consent-heading"
      className="rounded-lg border border-care-subtle bg-surface p-5"
    >
      <h2 id="consent-heading" className="text-2xl font-bold text-content">
        Ihre Einwilligung
      </h2>
      <p className="mt-2 max-w-measure text-content-muted">
        Für diesen Schritt verarbeiten wir Gesundheitsdaten. Das dürfen wir nur mit
        Ihrer ausdrücklichen Einwilligung. Sie können sie jederzeit widerrufen.
      </p>

      <ul className="mt-5 grid gap-4">
        {items.map((item) => {
          const id = `consent-${item.purpose}`
          return (
            <li key={item.purpose}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-4',
                  checked[item.purpose]
                    ? 'border-care bg-care-subtle'
                    : 'border-border bg-surface',
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  // NICHT vorangekreuzt — eine vorangekreuzte Box ist keine Einwilligung.
                  checked={checked[item.purpose] ?? false}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.purpose]: e.target.checked }))
                  }
                  className="mt-1 h-6 w-6 shrink-0 rounded border-border-strong text-action focus-visible:ring focus-visible:ring-focus"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-content">
                    {item.title}
                    {!item.required && (
                      <span className="rounded-pill border border-border bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-content-muted">
                        freiwillig
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-content-muted">{item.body}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => onSubmit(Object.keys(checked).filter((k) => checked[k]))}
          disabled={!allRequiredChecked}
          loading={pending}
          disabledReason={
            !allRequiredChecked
              ? `Noch ${missing} erforderliche Einwilligung(en) offen`
              : undefined
          }
          data-testid="consent-submit"
        >
          {submitLabel}
        </Button>
        {/* Ablehnung gleichwertig erreichbar — kein Dark Pattern */}
        <Button variant="secondary" onClick={() => onSubmit([])}>
          Nicht einwilligen
        </Button>
      </div>

      {!allRequiredChecked && (
        <p className="mt-3 text-sm text-content-muted" role="status">
          Ohne die erforderliche Einwilligung können wir diesen Dienst nicht erbringen.
          Alle anderen Bereiche von Apotrend bleiben nutzbar.
        </p>
      )}
    </section>
  )
}
