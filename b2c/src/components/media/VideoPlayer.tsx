'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { formatDuration, type VideoMedia } from '@/lib/media'

/**
 * VideoPlayer — Kurzvideo im Reels-Format, aber ohne Reels-Unarten.
 *
 * Bewusst gesetzte Entscheidungen:
 *  · KEIN Autoplay. Ein von selbst startendes Video ist für die Kernzielgruppe
 *    eine Störung, verbraucht Mobilfunkvolumen und ist bei Tonspur ein
 *    WCAG-1.4.2-Verstoß.
 *  · `preload="none"`: vor dem Start wird nur das Poster geladen.
 *  · Native `controls`. Eine nachgebaute Leiste müsste Tastatur, Screenreader
 *    und Untertitel-Menü vollständig neu implementieren — das gelingt selten
 *    besser als dem Browser.
 *  · Untertitel-Spur wird als `default` eingebunden: sie ist AN, nicht
 *    versteckt hinter einem Menü.
 *  · Das Transkript steht als aufklappbarer Text daneben — es ist zugleich der
 *    Rückfall, wenn die Videodatei nicht abspielbar ist.
 *
 * Der Rückfall ist kein Notnagel für die Demo: eine nicht ladende Videodatei
 * kommt in Produktion vor (Format, Netz, Sperre). Dann bleibt der Inhalt über
 * Poster und Abschrift zugänglich, statt zu verschwinden.
 */
export function VideoPlayer({ item, className }: { item: VideoMedia; className?: string }) {
  const [failed, setFailed] = React.useState(false)
  const [showTranscript, setShowTranscript] = React.useState(false)
  const transcriptId = `transcript-${item.id}`

  const portrait = item.orientation === 'portrait'

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <div
        className={cn('relative bg-black', portrait && 'mx-auto max-w-[22rem]')}
        style={{ aspectRatio: portrait ? '9 / 16' : '16 / 9' }}
      >
        {failed ? (
          // Rückfall: Standbild bleibt sichtbar, der Inhalt bleibt über die
          // Abschrift erreichbar. Kein toter Player, keine leere Fläche.
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.posterUrl}
              alt={item.posterAlt}
              className="h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 grid place-items-center p-5 text-center">
              <p className="rounded-md bg-surface/95 p-4 text-sm font-semibold text-content">
                Das Video lässt sich hier nicht abspielen.
                {item.transcript && ' Die vollständige Abschrift steht darunter.'}
              </p>
            </div>
          </div>
        ) : (
          <video
            data-testid="video-player"
            className="h-full w-full"
            controls
            preload="none"
            playsInline
            poster={item.posterUrl}
            aria-label={item.posterAlt}
            onError={() => setFailed(true)}
          >
            <source src={item.url} type={item.mimeType} />
            {item.captionsUrl && (
              <track
                kind="captions"
                src={item.captionsUrl}
                srcLang="de"
                label="Deutsch"
                default
              />
            )}
          </video>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3">
        <span className="text-sm font-semibold tabular-nums text-content">
          {formatDuration(item.durationSec)}
        </span>
        {item.captionsUrl && (
          <span className="text-sm text-content-muted">Untertitel verfügbar</span>
        )}

        {item.transcript && (
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            aria-expanded={showTranscript}
            aria-controls={transcriptId}
            data-testid="transcript-toggle"
            className={cn(
              'ml-auto inline-flex min-h-touch items-center rounded px-3',
              'border border-border-strong bg-surface text-sm font-semibold text-content',
              'hover:bg-surface-sunken',
              'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
            )}
          >
            {showTranscript ? 'Abschrift ausblenden' : 'Abschrift lesen'}
          </button>
        )}
      </div>

      {item.transcript && (
        <div
          id={transcriptId}
          hidden={!showTranscript}
          data-testid="transcript"
          className="border-t border-border bg-surface-sunken px-4 py-4"
        >
          <h3 className="text-sm font-bold text-content">Abschrift des Videos</h3>
          <p className="mt-2 max-w-measure text-sm text-content">{item.transcript}</p>
        </div>
      )}
    </div>
  )
}
