'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { CommentComposer } from './CommentComposer'
import type { CommentActionResult } from '@/app/social-actions'

/**
 * ReplyToggle — klappt das Antwort-Formular auf.
 *
 * Eingeklappt, weil unter jedem Kommentar dauerhaft ein Textfeld zu stehen den
 * Thread verdoppelt und auf dem Telefon unlesbar macht. Aufgeklappt bekommt das
 * Feld sofort den Fokus — wer „Antworten" drückt, will tippen, nicht suchen.
 *
 * Bei erreichter Verschachtelungsgrenze wird das offen gesagt („Antwort landet
 * auf dieser Ebene"), statt es stillschweigend anders zu machen als erwartet.
 */
export function ReplyToggle({
  postId,
  parentId,
  replyTo,
  action,
  atCap,
}: {
  postId: string
  parentId: string
  replyTo: string
  action: (prev: CommentActionResult, formData: FormData) => Promise<CommentActionResult>
  atCap: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const field = containerRef.current?.querySelector('textarea')
    field?.focus()
  }, [open])

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`reply-${parentId}`}
        data-testid={`reply-toggle-${parentId}`}
        className={cn(
          'inline-flex min-h-touch items-center rounded px-4',
          'border border-border-strong bg-surface text-sm font-semibold text-content',
          'hover:bg-surface-sunken',
          'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        )}
      >
        {open ? 'Antwort abbrechen' : 'Antworten'}
      </button>

      <div id={`reply-${parentId}`} ref={containerRef} hidden={!open} className="mt-3">
        {open && (
          <>
            {atCap && (
              <p className="mb-2 text-xs text-content-muted" data-testid={`reply-cap-${parentId}`}>
                Diese Unterhaltung ist bereits tief verschachtelt. Ihre Antwort erscheint auf
                dieser Ebene und nennt {replyTo} im Text.
              </p>
            )}
            <CommentComposer
              postId={postId}
              parentId={parentId}
              replyTo={replyTo}
              action={action}
              compact
              onDone={() => setOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
