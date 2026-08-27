'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { formatDuration, type AudioMedia } from '@/lib/media'

/**
 * AudioNote — Sprachnachricht mit Wellenform.
 *
 * Die Wellenform ist hier NICHT die Bedienung, sondern die Anzeige. Wer eine
 * Sprachnachricht durch Ziehen auf einer 4 px hohen Kurve verschieben soll,
 * scheitert daran mit unruhiger Hand oder auf einem kleinen Gerät. Deshalb:
 *
 *  · Abspielen/Pause ist eine 48-px-Schaltfläche mit Klartext-Label
 *  · Springen erfolgt über einen echten `<input type="range">` — bedienbar
 *    mit Maus, Finger UND Pfeiltasten, mit Prozentwert für Screenreader
 *  · Die Balken zeigen den Fortschritt farblich mit, sind aber `aria-hidden`
 *  · Fehlt die Abschrift, wird das gesagt statt verschwiegen (§ WCAG 1.2.1)
 */
export function AudioNote({ item, className }: { item: AudioMedia; className?: string }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const [position, setPosition] = React.useState(0)
  const [failed, setFailed] = React.useState(false)

  const duration = item.durationSec || 1
  const progress = Math.min(1, position / duration)

  const toggle = async () => {
    const el = audioRef.current
    if (!el) return
    try {
      if (el.paused) {
        await el.play()
        setPlaying(true)
      } else {
        el.pause()
        setPlaying(false)
      }
    } catch {
      setFailed(true)
      setPlaying(false)
    }
  }

  const seek = (seconds: number) => {
    const el = audioRef.current
    setPosition(seconds)
    if (el) el.currentTime = seconds
  }

  return (
    <div
      data-testid="audio-note"
      className={cn('rounded-lg border border-border bg-surface p-3', className)}
    >
      <audio
        ref={audioRef}
        src={item.url}
        preload="none"
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onError={() => setFailed(true)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={failed}
          aria-label={playing ? 'Sprachnachricht anhalten' : 'Sprachnachricht abspielen'}
          data-testid="audio-toggle"
          className={cn(
            'grid h-touch w-touch shrink-0 place-items-center rounded-pill',
            'bg-action text-action-fg hover:bg-action-hover disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
          )}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
            {playing ? (
              <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
            ) : (
              <path d="M8 5l12 7-12 7z" />
            )}
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          {/* Balken: reine Anzeige. Die Bedienung sitzt im Schieberegler darunter. */}
          <div aria-hidden="true" className="flex h-10 items-center gap-[3px]">
            {item.waveform.map((amplitude, i) => {
              const reached = i / item.waveform.length <= progress
              return (
                <span
                  key={i}
                  className={cn(
                    'w-full rounded-pill transition-colors',
                    reached ? 'bg-action' : 'bg-border-strong',
                  )}
                  style={{ height: `${Math.max(12, Math.round(amplitude * 100))}%` }}
                />
              )
            })}
          </div>

          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={position}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position in der Sprachnachricht"
            aria-valuetext={`${formatDuration(position)} von ${formatDuration(duration)}`}
            data-testid="audio-seek"
            className="mt-1 h-touch w-full cursor-pointer accent-action focus-visible:outline-none focus-visible:ring focus-visible:ring-focus"
          />
        </div>

        <span className="shrink-0 text-sm font-semibold tabular-nums text-content">
          {formatDuration(playing || position > 0 ? position : duration)}
        </span>
      </div>

      {failed && (
        <p role="status" className="mt-2 text-sm font-semibold text-danger">
          Die Sprachnachricht lässt sich nicht abspielen.
        </p>
      )}

      {item.transcript ? (
        <details className="mt-2">
          <summary
            className={cn(
              'inline-flex min-h-touch cursor-pointer items-center text-sm font-semibold',
              'text-content underline underline-offset-4',
              'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
            )}
          >
            Abschrift lesen
          </summary>
          <p className="mt-2 max-w-measure text-sm text-content">{item.transcript}</p>
        </details>
      ) : (
        // Verschweigen wäre schlimmer: wer nicht hören kann, muss erfahren,
        // dass hier Inhalt liegt, den er gerade nicht erreicht.
        <p className="mt-2 text-sm text-content-muted">
          Für diese Sprachnachricht liegt noch keine Abschrift vor.
        </p>
      )}
    </div>
  )
}
