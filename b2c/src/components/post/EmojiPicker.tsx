'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { emojiGroups } from '@/lib/social-data'

/**
 * EmojiPicker — kuratiert statt vollständig.
 *
 * Eine komplette Unicode-Tafel mit 3.000 Zeichen hinter sechs unbeschrifteten
 * Reitern ist für die Kernzielgruppe unbenutzbar. Hier stehen drei Gruppen mit
 * Klartext-Überschriften und je sechs Zeichen — jedes mit Namen als
 * zugänglichem Label, damit ein Screenreader nicht „Emoji" vorliest.
 *
 * Eingefügt wird an der CURSORPOSITION, nicht am Ende: wer mitten im Satz ein
 * Emoji setzen will, soll nicht scrollen müssen.
 */
export function EmojiPicker({
  targetRef,
  onInsert,
  className,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement>
  onInsert: (nextValue: string) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const insert = (char: string) => {
    const el = targetRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + char + el.value.slice(end)
    onInsert(next)
    // Cursor hinter das eingefügte Zeichen setzen — sonst springt er ans Ende
    // und der nächste Tastendruck landet an der falschen Stelle.
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + char.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="emoji-trigger"
        className={cn(
          'inline-flex min-h-touch items-center gap-2 rounded px-4',
          'border border-border-strong bg-surface text-sm font-semibold text-content',
          'hover:bg-surface-sunken',
          'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        )}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          🙂
        </span>
        Emoji
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji auswählen"
          data-testid="emoji-panel"
          className={cn(
            'absolute bottom-full left-0 z-30 mb-2 w-[min(22rem,calc(100vw-2rem))]',
            'rounded-lg border border-border-strong bg-surface-raised p-3 shadow-lg',
            'max-h-[60vh] overflow-y-auto animate-fade-in',
          )}
        >
          {emojiGroups.map((group) => (
            <section key={group.label} className="mb-3 last:mb-0">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-content-muted">
                {group.label}
              </h3>
              <ul className="flex flex-wrap gap-1">
                {group.emojis.map((e) => (
                  <li key={e.char}>
                    <button
                      type="button"
                      onClick={() => insert(e.char)}
                      aria-label={e.name}
                      title={e.name}
                      data-testid={`emoji-${e.char}`}
                      className={cn(
                        'grid h-touch w-touch place-items-center rounded text-2xl',
                        'hover:bg-surface-sunken',
                        'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                      )}
                    >
                      <span aria-hidden="true">{e.char}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
