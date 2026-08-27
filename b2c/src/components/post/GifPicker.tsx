'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { searchGifs } from '@/lib/social-data'
import type { GifMedia } from '@/lib/media'

/**
 * GifPicker — Auswahl aus der GIF-Bibliothek.
 *
 * Die Anbindung an Tenor/Giphy ist die eine Stelle, die hier bewusst noch nicht
 * verdrahtet ist: sie braucht einen API-Schlüssel und — wichtiger — einen
 * Auftragsverarbeitungsvertrag, weil bei jedem Aufruf die IP-Adresse der
 * Nutzer:in an den Anbieter geht. Das ist eine Vertragsfrage, keine Codefrage.
 *
 * Was hier steht, ist deshalb kein Attrappen-Knopf, sondern die vollständige
 * Oberfläche gegen eine lokale Bibliothek in DERSELBEN Datenform, die die
 * Anbieter liefern (id, title, Maße, Vorschau-URL). Der Wechsel ist später ein
 * Austausch von `searchGifs` — kein Umbau.
 *
 * Zugänglichkeit: Jedes GIF trägt einen echten alt-Text. Bewegte Bilder starten
 * hier automatisch (das ist ihr Wesen), laufen aber unter drei Sekunden und
 * lassen sich nicht als Blitzeffekt missbrauchen, weil die Bibliothek kuratiert
 * ist (WCAG 2.3.1).
 */
export function GifPicker({
  onSelect,
  className,
}: {
  onSelect: (gif: GifMedia) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
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

  const results = searchGifs(query)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="gif-trigger"
        className={cn(
          'inline-flex min-h-touch items-center gap-2 rounded px-4',
          'border border-border-strong bg-surface text-sm font-semibold text-content',
          'hover:bg-surface-sunken',
          'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        )}
      >
        <span aria-hidden="true" className="text-xs font-bold tracking-wider">
          GIF
        </span>
        Bewegtbild
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="GIF auswählen"
          data-testid="gif-panel"
          className={cn(
            'absolute bottom-full left-0 z-30 mb-2 w-[min(24rem,calc(100vw-2rem))]',
            'rounded-lg border border-border-strong bg-surface-raised p-3 shadow-lg animate-fade-in',
          )}
        >
          <label htmlFor="gif-search" className="block text-sm font-semibold text-content">
            GIF suchen
          </label>
          <input
            ref={inputRef}
            id="gif-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z. B. Danke"
            data-testid="gif-search"
            className={cn(
              'form-input mt-1 min-h-touch w-full rounded border-border-strong bg-surface',
              'text-base text-content placeholder:text-content-muted',
              'focus:border-action focus:ring focus:ring-focus',
            )}
          />

          {results.length === 0 ? (
            <p className="mt-3 text-sm text-content-muted">
              Kein GIF gefunden. Versuchen Sie einen anderen Suchbegriff.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {results.map((gif) => (
                <li key={gif.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(gif)
                      setOpen(false)
                    }}
                    data-testid={`gif-option-${gif.id}`}
                    className={cn(
                      'flex w-full min-h-touch flex-col items-center gap-1 rounded border p-2',
                      'border-border bg-surface hover:bg-surface-sunken',
                      'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.url}
                      alt={gif.alt}
                      width={gif.width}
                      height={gif.height}
                      className="h-20 w-20 rounded object-cover"
                    />
                    <span className="text-xs font-semibold text-content">{gif.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-2xs text-content-muted">
            Eigene Bibliothek. Eine Anbindung an Tenor oder Giphy überträgt die
            IP-Adresse an den Anbieter und ist erst nach Vertragsabschluss zulässig.
          </p>
        </div>
      )}
    </div>
  )
}
