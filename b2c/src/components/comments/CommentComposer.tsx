'use client'

import * as React from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { EmojiPicker } from '@/components/post/EmojiPicker'
import { GifPicker } from '@/components/post/GifPicker'
import { ACCEPTED_IMAGE_TYPES, MEDIA_LIMITS, type GifMedia, type MediaItem } from '@/lib/media'
import type { CommentActionResult } from '@/app/social-actions'

/**
 * CommentComposer — Kommentar schreiben, mit Emoji, GIF und Bildanhang.
 *
 * Dieselbe Regel wie im Beitrags-Editor: Ein Bild ohne Beschreibung geht nicht
 * raus. Bewusst KEIN Video hier — ein Kommentarbereich mit fünf startenden
 * Videoplayern ist auf einem Telefon unbenutzbar, und die Untertitelpflicht
 * wäre für einen Zweizeiler eine Hürde, die niemand nimmt. Wer ein Video hat,
 * schreibt einen Beitrag.
 *
 * Wird an zwei Stellen verwendet: als Haupt-Eingabe unter dem Beitrag und
 * eingeklappt als Antwort an einem einzelnen Kommentar (`parentId`).
 */
export function CommentComposer({
  postId,
  parentId = null,
  action,
  compact = false,
  replyTo,
  onDone,
}: {
  postId: string
  parentId?: string | null
  action: (prev: CommentActionResult, formData: FormData) => Promise<CommentActionResult>
  compact?: boolean
  replyTo?: string
  onDone?: () => void
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = React.useState('')
  const [drafts, setDrafts] = React.useState<{ key: string; item: MediaItem; needsAlt: boolean }[]>([])
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [state, formAction] = useFormState(action, null)

  React.useEffect(() => {
    if (state?.ok) {
      setBody('')
      setDrafts([])
      setLocalError(null)
      onDone?.()
    }
  }, [state, onDone])

  const addFiles = async (files: FileList) => {
    setLocalError(null)
    const pictures = drafts.length
    for (const file of Array.from(files)) {
      if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        setLocalError(`„${file.name}" ist kein Bild. Erlaubt sind JPEG, PNG, WebP und AVIF.`)
        continue
      }
      if (pictures + 1 > MEDIA_LIMITS.imagesPerComment) {
        setLocalError(`Höchstens ${MEDIA_LIMITS.imagesPerComment} Bilder pro Kommentar.`)
        break
      }
      if (file.size > 2 * 1024 * 1024) {
        setLocalError(`„${file.name}" ist größer als 2 MB.`)
        continue
      }
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('unlesbar'))
        reader.readAsDataURL(file)
      })
      const size = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({ width: 1, height: 1 })
        img.src = url
      })
      setDrafts((current) => [
        ...current,
        {
          key: `${file.name}-${Math.random().toString(36).slice(2)}`,
          needsAlt: true,
          item: {
            kind: 'image',
            id: `ci-${Math.random().toString(36).slice(2)}`,
            url,
            width: size.width,
            height: size.height,
            alt: '',
          },
        },
      ])
    }
  }

  const addGif = (gif: GifMedia) => {
    setDrafts((current) => [
      ...current,
      { key: `${gif.id}-${Math.random().toString(36).slice(2)}`, item: gif, needsAlt: false },
    ])
  }

  const missingAlt = drafts.filter((d) => d.item.kind === 'image' && !d.item.alt.trim()).length
  const hasContent = body.trim().length > 0 || drafts.length > 0
  const blocked = !hasContent || missingAlt > 0
  const fieldId = `comment-body-${postId}-${parentId ?? 'root'}`

  return (
    <form
      action={formAction}
      data-testid={parentId ? `reply-form-${parentId}` : `comment-form-${postId}`}
      className={cn(
        'rounded-lg border border-border bg-surface p-4',
        compact && 'bg-surface-sunken',
      )}
    >
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentId" value={parentId ?? ''} />
      <input type="hidden" name="media" value={JSON.stringify(drafts.map((d) => d.item))} />

      <label htmlFor={fieldId} className="block text-sm font-semibold text-content">
        {replyTo ? `Antwort an ${replyTo}` : 'Ihr Kommentar'}
      </label>
      <textarea
        ref={textareaRef}
        id={fieldId}
        name="body"
        rows={compact ? 2 : 3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={replyTo ? 'Antwort schreiben …' : 'Frage stellen oder etwas ergänzen …'}
        data-testid={parentId ? `reply-body-${parentId}` : `comment-body-${postId}`}
        className={cn(
          'form-textarea mt-1 w-full rounded border-border-strong bg-surface',
          'text-base text-content placeholder:text-content-muted',
          'focus:border-action focus:ring focus:ring-focus',
        )}
      />

      {drafts.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {drafts.map((draft, index) => (
            <li
              key={draft.key}
              className="flex items-start gap-3 rounded border border-border bg-surface p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.item.url}
                alt=""
                className="h-16 w-16 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                {draft.item.kind === 'image' ? (
                  <>
                    <label
                      htmlFor={`c-alt-${draft.key}`}
                      className="block text-xs font-semibold text-content"
                    >
                      Bildbeschreibung (Pflicht)
                    </label>
                    <input
                      id={`c-alt-${draft.key}`}
                      type="text"
                      value={draft.item.alt}
                      aria-invalid={!draft.item.alt.trim() || undefined}
                      onChange={(e) =>
                        setDrafts((current) =>
                          current.map((d) =>
                            d.key === draft.key
                              ? { ...d, item: { ...d.item, alt: e.target.value } as MediaItem }
                              : d,
                          ),
                        )
                      }
                      data-testid={`comment-alt-${index}`}
                      className={cn(
                        'form-input mt-1 min-h-touch w-full rounded bg-surface text-sm',
                        !draft.item.alt.trim() ? 'border-warning' : 'border-border-strong',
                        'focus:border-action focus:ring focus:ring-focus',
                      )}
                    />
                  </>
                ) : (
                  <p className="text-xs text-content-muted">
                    GIF „{'title' in draft.item ? draft.item.title : ''}" —
                    Beschreibung bereits hinterlegt.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrafts((c) => c.filter((d) => d.key !== draft.key))}
                aria-label={`Anhang ${index + 1} entfernen`}
                className={cn(
                  'grid h-touch w-touch shrink-0 place-items-center rounded',
                  'border border-border-strong bg-surface hover:bg-surface-sunken',
                  'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus',
                )}
              >
                <span aria-hidden="true">🗑</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EmojiPicker targetRef={textareaRef} onInsert={setBody} />
        <GifPicker onSelect={addGif} />

        <label
          className={cn(
            'inline-flex min-h-touch cursor-pointer items-center gap-2 rounded px-4',
            'border border-border-strong bg-surface text-sm font-semibold text-content',
            'hover:bg-surface-sunken focus-within:ring focus-within:ring-focus',
          )}
        >
          <span aria-hidden="true">📷</span>
          Bild
          <input
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            data-testid={parentId ? `reply-file-${parentId}` : `comment-file-${postId}`}
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files)
              e.target.value = ''
            }}
            className="sr-only"
          />
        </label>

        <SubmitButton
          blocked={blocked}
          reason={
            !hasContent
              ? 'Der Kommentar ist noch leer.'
              : missingAlt > 0
                ? `Es fehlen noch ${missingAlt} Bildbeschreibungen.`
                : undefined
          }
          testId={parentId ? `reply-submit-${parentId}` : `comment-submit-${postId}`}
        />
      </div>

      {localError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {localError}
        </p>
      )}
      {missingAlt > 0 && (
        <p className="mt-3 text-sm font-semibold text-warning" data-testid="comment-missing-alt">
          Noch nicht absendbar: {missingAlt}{' '}
          {missingAlt === 1 ? 'Bild braucht' : 'Bilder brauchen'} eine Beschreibung.
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" data-testid="comment-error" className="mt-3 text-sm font-semibold text-danger">
          {state.message}
        </p>
      )}
    </form>
  )
}

function SubmitButton({
  blocked,
  reason,
  testId,
}: {
  blocked: boolean
  reason?: string
  testId: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="ml-auto"
      loading={pending}
      disabled={blocked}
      disabledReason={reason}
      data-testid={testId}
    >
      Senden
    </Button>
  )
}
