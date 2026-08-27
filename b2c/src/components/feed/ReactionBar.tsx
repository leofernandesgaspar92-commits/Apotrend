'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import {
  REACTIONS,
  reactionDefinition,
  summaryText,
  type ReactionSummary,
  type ReactionType,
} from '@/lib/reactions'

/**
 * ReactionBar — die Auswahlleiste aus sozialen Netzwerken, an drei Stellen
 * bewusst anders gebaut:
 *
 *  1. ÖFFNEN PER KLICK, nicht per Überfahren. Das Hover-Popup von Facebook ist
 *     auf Touch-Geräten gar nicht bedienbar und für Menschen mit unruhiger Hand
 *     eine Zufallsauswahl. `hover` öffnet hier nichts.
 *  2. JEDE REAKTION TRÄGT IHREN NAMEN. Ein reines Emoji ist für Screenreader
 *     und für einen Teil der Zielgruppe bedeutungsfrei — „💡" heißt nicht für
 *     jede:n „informativ".
 *  3. DIE HÄUFIGSTE ZUERST, in Klartext: „7× Informativ" statt gestapelter
 *     Mini-Icons, die man auseinanderhalten muss.
 *
 * Zustand wird optimistisch gesetzt und beim Fehlschlag zurückgenommen — die
 * Wahrheit liegt beim Server, nicht in der Leiste.
 */

export interface ReactionBarProps {
  targetId: string
  summary: ReactionSummary
  /** Server Action. Gibt die neue eigene Reaktion zurück (`null` = zurückgenommen). */
  onReact: (targetId: string, type: ReactionType) => Promise<ReactionType | null>
  /** Kompakte Fassung für Kommentare. */
  size?: 'md' | 'sm'
  className?: string
}

export function ReactionBar({
  targetId,
  summary,
  onReact,
  size = 'md',
  className,
}: ReactionBarProps) {
  const [open, setOpen] = React.useState(false)
  const [local, setLocal] = React.useState<ReactionSummary>(summary)
  const [pending, startTransition] = React.useTransition()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  // Server bleibt die Quelle der Wahrheit: neue Daten überschreiben die
  // optimistische Anzeige.
  React.useEffect(() => setLocal(summary), [summary])

  // Schließen bei Klick daneben und bei Escape — beides erwartet man von einem
  // Popup, und ohne beides ist es eine Falle.
  React.useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const react = (type: ReactionType) => {
    setOpen(false)
    const before = local
    setLocal(optimistic(local, type))
    startTransition(async () => {
      try {
        await onReact(targetId, type)
      } catch {
        setLocal(before) // Fehlschlag: Anzeige zurücknehmen, nichts vortäuschen
      }
    })
  }

  const own = local.own ? reactionDefinition(local.own) : null
  const compact = size === 'sm'

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      data-testid={`reactions-${targetId}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-busy={pending || undefined}
          data-testid={`react-trigger-${targetId}`}
          className={cn(
            'inline-flex min-h-touch items-center gap-2 rounded border px-4',
            'text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
            own
              ? 'border-action bg-action-subtle text-content'
              : 'border-border-strong bg-surface text-content hover:bg-surface-sunken',
          )}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {own ? own.emoji : '👍'}
          </span>
          {own ? own.label : 'Reagieren'}
        </button>

        {local.total > 0 && (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {local.counts.map((c) => (
              <li
                key={c.type}
                className={cn(
                  'inline-flex items-center gap-1.5 text-content-muted',
                  compact ? 'text-xs' : 'text-sm',
                )}
              >
                <span aria-hidden="true">{c.emoji}</span>
                <span className="tabular-nums">
                  {c.count}× {c.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Eine Zeile Klartext für Screenreader statt vier verstreuter Zahlen. */}
      <p className="sr-only" aria-live="polite">
        {summaryText(local)}
      </p>

      {open && (
        <div
          role="group"
          aria-label="Reaktion auswählen"
          data-testid={`react-popup-${targetId}`}
          className={cn(
            'absolute bottom-full left-0 z-20 mb-2 flex flex-wrap gap-1 rounded-lg',
            'border border-border-strong bg-surface-raised p-2 shadow-lg',
            'animate-fade-in',
          )}
        >
          {REACTIONS.map((r) => {
            const active = local.own === r.type
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => react(r.type)}
                title={r.description}
                aria-pressed={active}
                data-testid={`react-${r.type}`}
                className={cn(
                  'inline-flex min-h-touch flex-col items-center justify-center gap-0.5',
                  'rounded px-3 py-1 text-2xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                  active
                    ? 'bg-action-subtle text-content ring-1 ring-action'
                    : 'text-content hover:bg-surface-sunken',
                )}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {r.emoji}
                </span>
                {/* Name steht DA, nicht nur im Tooltip. */}
                {r.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Vorwegnahme des Server-Ergebnisses nach derselben Regel wie
 * `toggleReaction`: gleiche Reaktion = zurücknehmen, andere = ersetzen.
 */
function optimistic(current: ReactionSummary, type: ReactionType): ReactionSummary {
  const counts = new Map(current.counts.map((c) => [c.type, c.count]))

  if (current.own) counts.set(current.own, Math.max(0, (counts.get(current.own) ?? 1) - 1))

  const own = current.own === type ? null : type
  if (own) counts.set(own, (counts.get(own) ?? 0) + 1)

  const next = REACTIONS.filter((r) => (counts.get(r.type) ?? 0) > 0)
    .map((r) => ({
      type: r.type,
      emoji: r.emoji,
      label: r.label,
      count: counts.get(r.type) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

  return {
    total: next.reduce((sum, c) => sum + c.count, 0),
    counts: next,
    own,
  }
}
