'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addToCartAction, type ActionResult } from '@/app/actions'
import { Button } from './Button'

/**
 * Kauf-Formular.
 *
 * Bewusst ein echtes <form> mit Server Action statt eines onClick-Handlers:
 *  - Der Compliance-Wächter läuft damit auf dem SERVER, nicht im Client, wo er
 *    über die Entwicklerkonsole umgangen werden könnte.
 *  - Ohne JavaScript funktioniert der Kauf trotzdem (Progressive Enhancement) —
 *    für eine Zielgruppe mit älteren Geräten kein akademischer Punkt.
 *  - Mit JavaScript zeigt das Formular zusätzlich die Begründung an.
 */
function SubmitButton({ label, disabled, disabledReason }: {
  label: string
  disabled?: boolean
  disabledReason?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="sm"
      loading={pending}
      disabled={disabled}
      disabledReason={disabledReason}
    >
      {label}
    </Button>
  )
}

export function AddToCartForm({
  productId,
  label,
  inStock,
}: {
  productId: string
  label: string
  inStock: boolean
}) {
  const [state, formAction] = useFormState<ActionResult, FormData>(addToCartAction, null)

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton
        label={inStock ? label : 'Nicht lieferbar'}
        disabled={!inStock}
        disabledReason={!inStock ? 'Derzeit nicht lieferbar' : undefined}
      />
      {state && !state.ok && (
        // role="alert" meldet die Begründung sofort an Screenreader.
        <p
          role="alert"
          className="mt-2 w-full rounded border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger"
        >
          {state.message}
        </p>
      )}
      {state && state.ok && (
        <p role="status" className="mt-2 w-full text-sm font-semibold text-success">
          ✓ In den Warenkorb gelegt
        </p>
      )}
    </form>
  )
}
