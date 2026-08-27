'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { accessibleName, aspectRatio, type ImageMedia, type GifMedia } from '@/lib/media'

/**
 * MediaCarousel — Bildergalerie mit SICHTBARER Bedienung.
 *
 * Die Zielgruppen-Vorgabe „keine versteckten Gesten" schließt das übliche
 * Feed-Karussell aus, das nur auf Wischen reagiert. Deshalb:
 *
 *  · Vor/Zurück als beschriftete Schaltflächen mit 48 px Trefferfläche,
 *    dauerhaft sichtbar — nicht erst beim Überfahren mit der Maus
 *  · Zähler in Klartext („Bild 2 von 3"), nicht nur Punkte
 *  · Punkte sind zusätzlich ANSPRINGBAR, nicht bloß Anzeige
 *  · Wischen funktioniert trotzdem (scroll-snap), ist aber die Zugabe
 *  · Pfeiltasten links/rechts, sobald die Galerie den Fokus hat
 *
 * Umgesetzt über natives Scrollen statt Transform-Rechnerei: dadurch bleibt
 * die Tastatur- und Screenreader-Navigation die des Browsers, und bei
 * `prefers-reduced-motion` entfällt das Gleiten automatisch.
 */

type Picture = ImageMedia | GifMedia

export function MediaCarousel({
  items,
  className,
  label = 'Bildergalerie',
}: {
  items: Picture[]
  className?: string
  label?: string
}) {
  const trackRef = React.useRef<HTMLUListElement>(null)
  const [index, setIndex] = React.useState(0)

  const count = items.length
  const first = items[0]
  if (count === 0 || !first) return null

  // Einzelbild braucht keine Navigation — Bedienelemente ohne Funktion
  // sind für die Zielgruppe schlimmer als keine.
  if (count === 1) {
    return (
      <figure className={cn('overflow-hidden rounded-lg border border-border', className)}>
        <Picture item={first} />
        {'caption' in first && first.caption && (
          <figcaption className="bg-surface-sunken px-4 py-3 text-sm text-content-muted">
            {first.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next))
    setIndex(clamped)
    const track = trackRef.current
    const target = track?.children[clamped] as HTMLElement | undefined
    if (track && target) {
      track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' })
    }
  }

  // Beim Wischen die Anzeige nachführen, damit Zähler und Punkte stimmen.
  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const position = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
    setIndex(Math.max(0, Math.min(count - 1, position)))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(index - 1)
    }
  }

  const current = items[index]

  return (
    <section
      className={cn('rounded-lg border border-border bg-surface-sunken', className)}
      aria-roledescription="Bildergalerie"
      aria-label={label}
      data-testid="media-carousel"
      onKeyDown={onKeyDown}
    >
      <div className="relative">
        <ul
          ref={trackRef}
          onScroll={onScroll}
          tabIndex={0}
          className={cn(
            'flex snap-x snap-mandatory overflow-x-auto rounded-t-lg',
            'scrollbar-none focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
          )}
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item, i) => (
            <li
              key={item.id}
              className="w-full shrink-0 snap-center"
              // Nicht sichtbare Folien aus dem Screenreader nehmen: sonst liest
              // er alle Bilder hintereinander vor, als stünden sie untereinander.
              aria-hidden={i !== index || undefined}
            >
              <Picture item={item} />
            </li>
          ))}
        </ul>

        <CarouselButton
          direction="prev"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        />
        <CarouselButton
          direction="next"
          disabled={index === count - 1}
          onClick={() => goTo(index + 1)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-content" data-testid="carousel-counter">
          Bild {index + 1} von {count}
        </p>

        <ul className="flex items-center gap-1">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Bild ${i + 1} von ${count} anzeigen`}
                aria-current={i === index || undefined}
                // Trefferfläche 48 px, sichtbarer Punkt kleiner — die Fläche
                // zählt für die Bedienbarkeit, der Punkt für die Optik.
                className={cn(
                  'grid h-touch w-8 place-items-center',
                  'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-3 w-3 rounded-pill border transition-colors',
                    i === index
                      ? 'border-action bg-action'
                      : 'border-border-strong bg-surface',
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {current && 'caption' in current && current.caption && (
        <p className="border-t border-border px-4 py-3 text-sm text-content-muted">
          {current.caption}
        </p>
      )}

      {/* Wechsel dezent ansagen, ohne den Lesefluss zu unterbrechen. */}
      <p aria-live="polite" className="sr-only">
        {current ? `Bild ${index + 1} von ${count}: ${accessibleName(current)}` : ''}
      </p>
    </section>
  )
}

function CarouselButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? 'Vorheriges Bild' : 'Nächstes Bild'}
      data-testid={isPrev ? 'carousel-prev' : 'carousel-next'}
      className={cn(
        'absolute top-1/2 grid h-touch w-touch -translate-y-1/2 place-items-center',
        'rounded-pill border border-border-strong bg-surface text-content shadow',
        'hover:bg-surface-sunken disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        isPrev ? 'left-3' : 'right-3',
      )}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
        <path
          d={isPrev ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function Picture({ item }: { item: Picture }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={accessibleName(item)}
      width={item.width}
      height={item.height}
      // Höhe steht vor dem Laden fest — kein Springen des Layouts.
      style={{ aspectRatio: aspectRatio(item) }}
      className="w-full bg-surface-sunken object-cover"
      loading="lazy"
      decoding="async"
    />
  )
}
