'use client'

import * as React from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { EmojiPicker } from './EmojiPicker'
import { GifPicker } from './GifPicker'
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MEDIA_LIMITS,
  formatDuration,
  type GifMedia,
  type MediaItem,
} from '@/lib/media'
import { MAX_POST_LENGTH } from '@/lib/posts'
import type { PostActionResult } from '@/app/social-actions'

/**
 * CreatePostModal — der Beitrags-Editor.
 *
 * Die zentrale Entscheidung dieser Komponente: **Ein Anhang ohne Beschreibung
 * lässt sich nicht abschicken.** `ImageMedia.alt` ist im Modell ein Pflichtfeld
 * (media.ts). Ein Editor, der Bilder ohne Beschreibung durchreicht, würde diese
 * Zusage zur Fiktion machen — deshalb blockiert das Formular hier sichtbar und
 * benennt genau, was fehlt. Das ist kein Gängeln: für blinde Nutzer:innen ist
 * ein unbeschriebenes Bild schlicht nicht vorhanden.
 *
 * Weitere feste Vorgaben:
 *  · Natives `<dialog>` statt nachgebautem Overlay — Fokusfalle, Escape und
 *    die Inertisierung des Hintergrunds kommen vom Browser und funktionieren.
 *  · Drag-and-Drop ist die ZUGABE; die Schaltfläche „Dateien auswählen" ist
 *    immer da. Ziehen ist für viele in der Zielgruppe keine Option.
 *  · Video wird beim Auswählen auf Länge geprüft, bevor irgendetwas hochgeht.
 *
 * Zur Übertragung: Die Demo schickt Bilder als Data-URL im Formular mit. Das
 * ist bewusst NICHT die Produktionslösung — dort gehen Dateien per signierter
 * URL direkt in den Objektspeicher, samt Virenprüfung. Die Grenze unten
 * (DEMO_INLINE_BYTES) hat deshalb nichts mit MEDIA_LIMITS zu tun: sie schützt
 * nur den Server-Action-Body dieser Demo.
 */

const DEMO_INLINE_BYTES = 2 * 1024 * 1024

interface Draft {
  key: string
  item: MediaItem
  /** Vorschau-URL; bei GIFs identisch mit der Quelle. */
  preview: string
  /** Wird die Beschreibung noch gebraucht? Steuert die Sperre des Absendens. */
  needsAlt: boolean
}

export function CreatePostModal({
  action,
}: {
  action: (prev: PostActionResult, formData: FormData) => Promise<PostActionResult>
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = React.useState(false)
  const [body, setBody] = React.useState('')
  const [drafts, setDrafts] = React.useState<Draft[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [state, formAction] = useFormState(action, null)

  // Nach erfolgreichem Absenden aufräumen und schließen.
  React.useEffect(() => {
    if (state?.ok) {
      setBody('')
      setDrafts([])
      setLocalError(null)
      dialogRef.current?.close()
      setOpen(false)
    }
  }, [state])

  const openDialog = () => {
    dialogRef.current?.showModal()
    setOpen(true)
  }
  const closeDialog = () => {
    dialogRef.current?.close()
    setOpen(false)
  }

  // --- Dateien annehmen -----------------------------------------------------

  const acceptFiles = async (files: FileList | File[]) => {
    setLocalError(null)
    const incoming = Array.from(files)
    const next: Draft[] = []

    for (const file of incoming) {
      const isImage = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
      const isVideo = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type)

      if (!isImage && !isVideo) {
        setLocalError(
          `„${file.name}" ist kein unterstütztes Format. Erlaubt sind JPEG, PNG, WebP, AVIF, MP4 und WebM.`,
        )
        continue
      }
      if (file.size > DEMO_INLINE_BYTES) {
        setLocalError(
          `„${file.name}" ist ${formatBytes(file.size)} groß. In dieser Demo werden Dateien ` +
            `im Formular mitgeschickt; darum liegt die Grenze bei ${formatBytes(DEMO_INLINE_BYTES)}.`,
        )
        continue
      }

      const dataUrl = await readAsDataUrl(file)

      if (isImage) {
        const size = await imageSize(dataUrl)
        next.push({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          preview: dataUrl,
          needsAlt: true,
          item: {
            kind: 'image',
            id: `up-${Math.random().toString(36).slice(2)}`,
            url: dataUrl,
            width: size.width,
            height: size.height,
            alt: '',
          },
        })
      } else {
        const probe = await videoProbe(dataUrl)
        if (probe.duration > MEDIA_LIMITS.videoSeconds) {
          setLocalError(
            `„${file.name}" ist ${formatDuration(probe.duration)} lang. Erlaubt sind höchstens ` +
              `${formatDuration(MEDIA_LIMITS.videoSeconds)}.`,
          )
          continue
        }
        next.push({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          preview: dataUrl,
          needsAlt: true,
          item: {
            kind: 'video',
            id: `up-${Math.random().toString(36).slice(2)}`,
            url: dataUrl,
            mimeType: file.type === 'video/webm' ? 'video/webm' : 'video/mp4',
            width: probe.width,
            height: probe.height,
            posterUrl: '',
            posterAlt: '',
            durationSec: probe.duration,
            captionsUrl: null,
            transcript: '',
            orientation: probe.height >= probe.width ? 'portrait' : 'landscape',
          },
        })
      }
    }

    setDrafts((current) => [...current, ...next])
  }

  const addGif = (gif: GifMedia) => {
    setDrafts((current) => [
      ...current,
      // GIFs aus der Bibliothek bringen ihren alt-Text mit — nichts nachzutragen.
      { key: `${gif.id}-${Math.random().toString(36).slice(2)}`, item: gif, preview: gif.url, needsAlt: false },
    ])
  }

  const updateDraft = (key: string, patch: Partial<MediaItem>) => {
    setDrafts((current) =>
      current.map((d) => (d.key === key ? { ...d, item: { ...d.item, ...patch } as MediaItem } : d)),
    )
  }

  const removeDraft = (key: string) => {
    setDrafts((current) => current.filter((d) => d.key !== key))
  }

  // --- Absende-Sperre -------------------------------------------------------
  //  Nicht „irgendwas fehlt", sondern namentlich WAS fehlt.

  const missing: string[] = []
  drafts.forEach((d, i) => {
    if (d.item.kind === 'image' && !d.item.alt.trim()) {
      missing.push(`Bildbeschreibung für Anhang ${i + 1}`)
    }
    if (d.item.kind === 'video') {
      if (!d.item.posterAlt.trim()) missing.push(`Beschreibung für Video ${i + 1}`)
      if (!d.item.transcript?.trim()) missing.push(`Abschrift für Video ${i + 1}`)
    }
  })

  const hasContent = body.trim().length > 0 || drafts.length > 0
  const tooLong = body.length > MAX_POST_LENGTH
  const blocked = !hasContent || missing.length > 0 || tooLong

  const payload = JSON.stringify(drafts.map((d) => d.item))

  return (
    <>
      <Button type="button" onClick={openDialog} size="lg" data-testid="open-composer">
        Beitrag schreiben
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby="composer-title"
        data-testid="composer"
        className={cn(
          'w-[min(42rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-surface p-0',
          'text-content backdrop:bg-black/50',
          'open:animate-fade-in',
        )}
      >
        {open && (
          <form action={formAction}>
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 id="composer-title" className="text-xl font-bold">
                Beitrag schreiben
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Editor schließen"
                data-testid="composer-close"
                className={cn(
                  'grid h-touch w-touch place-items-center rounded',
                  'border border-border-strong bg-surface hover:bg-surface-sunken',
                  'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                )}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ✕
                </span>
              </button>
            </header>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <label htmlFor="composer-body" className="block text-sm font-semibold">
                Ihr Beitrag
              </label>
              <textarea
                ref={textareaRef}
                id="composer-body"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                data-testid="composer-body"
                placeholder="Was möchten Sie teilen?"
                className={cn(
                  'form-textarea mt-1 w-full rounded border-border-strong bg-surface',
                  'text-base text-content placeholder:text-content-muted',
                  'focus:border-action focus:ring focus:ring-focus',
                )}
              />
              <p
                className={cn(
                  'mt-1 text-xs tabular-nums',
                  tooLong ? 'font-semibold text-danger' : 'text-content-muted',
                )}
              >
                {body.length} von {MAX_POST_LENGTH} Zeichen
              </p>

              {/* --- Ablagefläche --- */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  void acceptFiles(e.dataTransfer.files)
                }}
                data-testid="dropzone"
                className={cn(
                  'mt-4 rounded-lg border-2 border-dashed p-4 text-center transition-colors',
                  dragging ? 'border-action bg-action-subtle' : 'border-border-strong bg-surface-sunken',
                )}
              >
                <p className="text-sm font-semibold text-content">
                  Bilder oder ein Video hierher ziehen
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  Bis zu {MEDIA_LIMITS.imagesPerPost} Bilder oder {MEDIA_LIMITS.videosPerPost} Video
                  (höchstens {formatDuration(MEDIA_LIMITS.videoSeconds)}). Beides zusammen geht nicht.
                </p>

                {/* Ziehen ist die Zugabe — dieser Weg ist immer da. */}
                <label
                  className={cn(
                    'mt-3 inline-flex min-h-touch cursor-pointer items-center rounded px-4',
                    'border border-border-strong bg-surface text-sm font-semibold text-content',
                    'hover:bg-surface-sunken focus-within:ring focus-within:ring-focus',
                  )}
                >
                  Dateien auswählen
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT_ATTRIBUTE}
                    data-testid="file-input"
                    onChange={(e) => {
                      if (e.target.files) void acceptFiles(e.target.files)
                      e.target.value = ''
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* --- Anhänge mit Pflichtangaben --- */}
              {drafts.length > 0 && (
                <ul className="mt-4 grid gap-3" data-testid="draft-list">
                  {drafts.map((draft, index) => (
                    <li
                      key={draft.key}
                      className="rounded-lg border border-border bg-surface-sunken p-3"
                    >
                      <div className="flex items-start gap-3">
                        {draft.item.kind === 'video' ? (
                          <video
                            src={draft.preview}
                            controls
                            preload="metadata"
                            className="h-24 w-24 shrink-0 rounded bg-black object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={draft.preview}
                            alt=""
                            className="h-24 w-24 shrink-0 rounded object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-content">
                            Anhang {index + 1} ·{' '}
                            {draft.item.kind === 'video'
                              ? `Video, ${formatDuration(draft.item.durationSec)}`
                              : draft.item.kind === 'gif'
                                ? 'GIF'
                                : 'Bild'}
                          </p>

                          {draft.item.kind === 'image' && (
                            <AltField
                              id={`alt-${draft.key}`}
                              label="Bildbeschreibung (Pflicht)"
                              hint="Was ist zu sehen? Ein Satz genügt."
                              value={draft.item.alt}
                              onChange={(v) => updateDraft(draft.key, { alt: v } as Partial<MediaItem>)}
                              testId={`draft-alt-${index}`}
                            />
                          )}

                          {draft.item.kind === 'gif' && (
                            <p className="mt-1 text-xs text-content-muted">
                              Beschreibung übernommen: „{draft.item.alt}"
                            </p>
                          )}

                          {draft.item.kind === 'video' && (
                            <>
                              <AltField
                                id={`poster-${draft.key}`}
                                label="Beschreibung des Videos (Pflicht)"
                                hint="Worum geht es im Video?"
                                value={draft.item.posterAlt}
                                onChange={(v) =>
                                  updateDraft(draft.key, { posterAlt: v } as Partial<MediaItem>)
                                }
                                testId={`draft-posteralt-${index}`}
                              />
                              <AltField
                                id={`transcript-${draft.key}`}
                                label="Abschrift des Gesagten (Pflicht)"
                                hint="Ohne Untertitel oder Abschrift ist das Video für Gehörlose leer (WCAG 1.2.2)."
                                value={draft.item.transcript ?? ''}
                                multiline
                                onChange={(v) =>
                                  updateDraft(draft.key, { transcript: v } as Partial<MediaItem>)
                                }
                                testId={`draft-transcript-${index}`}
                              />
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDraft(draft.key)}
                          aria-label={`Anhang ${index + 1} entfernen`}
                          data-testid={`draft-remove-${index}`}
                          className={cn(
                            'grid h-touch w-touch shrink-0 place-items-center rounded',
                            'border border-border-strong bg-surface hover:bg-surface-sunken',
                            'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                          )}
                        >
                          <span aria-hidden="true">🗑</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* --- Werkzeugleiste --- */}
              <div className="mt-4 flex flex-wrap gap-2">
                <EmojiPicker
                  targetRef={textareaRef}
                  onInsert={(next) => setBody(next)}
                />
                <GifPicker onSelect={addGif} />
              </div>

              {/* --- Rückmeldungen --- */}
              {localError && (
                <p
                  role="alert"
                  data-testid="composer-local-error"
                  className="mt-4 rounded border border-danger-border bg-danger-subtle p-3 text-sm font-semibold text-danger"
                >
                  {localError}
                </p>
              )}

              {missing.length > 0 && (
                <div
                  data-testid="composer-missing"
                  className="mt-4 rounded border border-warning-border bg-warning-subtle p-3"
                >
                  <p className="text-sm font-bold text-warning">
                    Noch nicht absendbar — das fehlt:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-content">
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {state && !state.ok && (
                <p
                  role="alert"
                  data-testid="composer-error"
                  className="mt-4 rounded border border-danger-border bg-danger-subtle p-3 text-sm font-semibold text-danger"
                >
                  {state.message}
                </p>
              )}
            </div>

            <input type="hidden" name="media" value={payload} />

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-4">
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Abbrechen
              </Button>
              <SubmitButton
                blocked={blocked}
                reason={
                  !hasContent
                    ? 'Der Beitrag ist noch leer.'
                    : tooLong
                      ? 'Der Text ist zu lang.'
                      : missing.length > 0
                        ? `Es fehlen noch ${missing.length} Pflichtangaben.`
                        : undefined
                }
              />
            </footer>
          </form>
        )}
      </dialog>
    </>
  )
}

function SubmitButton({ blocked, reason }: { blocked: boolean; reason?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      loading={pending}
      disabled={blocked}
      disabledReason={reason}
      data-testid="composer-submit"
    >
      Veröffentlichen
    </Button>
  )
}

function AltField({
  id,
  label,
  hint,
  value,
  onChange,
  multiline = false,
  testId,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  testId: string
}) {
  const missing = !value.trim()
  const hintId = `${id}-hint`
  const shared = cn(
    'mt-1 w-full rounded bg-surface text-sm text-content',
    'focus:border-action focus:ring focus:ring-focus',
    missing ? 'border-warning' : 'border-border-strong',
  )

  return (
    <div className="mt-2">
      <label htmlFor={id} className="block text-xs font-semibold text-content">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          aria-describedby={hintId}
          aria-invalid={missing || undefined}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className={cn('form-textarea', shared)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          aria-describedby={hintId}
          aria-invalid={missing || undefined}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className={cn('form-input min-h-touch', shared)}
        />
      )}
      <p id={hintId} className="mt-1 text-2xs text-content-muted">
        {hint}
      </p>
    </div>
  )
}

// --- Hilfsfunktionen --------------------------------------------------------

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = src
  })
}

function videoProbe(src: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || 1,
        height: video.videoHeight || 1,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      })
    video.onerror = () => resolve({ width: 1, height: 1, duration: 0 })
    video.src = src
  })
}
