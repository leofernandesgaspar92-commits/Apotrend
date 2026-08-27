// ============================================================================
//  Nutzer-Beiträge (User Generated Content)
// ============================================================================
//  Getrennt von news.ts, weil die Regeln andere sind: ein Nutzer-Beitrag hat
//  keinen Auftraggeber und keine Redaktion, dafür aber eine Verfasser:in, die
//  für den Inhalt einsteht.
//
//  Die Medien-Prüfung ist dieselbe (media.ts) — Barrierefreiheit hängt nicht
//  davon ab, wer etwas hochlädt.
// ============================================================================

import { assertMediaSetValid, type MediaItem } from './media.ts'

export const MAX_POST_LENGTH = 5000

export interface UserPost {
  id: string
  authorHandle: string
  authorName: string
  credential: 'pharmacist' | 'pharmacy' | 'pta' | 'physician' | null
  body: string
  media: MediaItem[]
  createdAt: Date
}

export class PostError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'PostError'
    this.code = code
  }
}

const store: UserPost[] = []
let counter = 0

export function getUserPosts(): UserPost[] {
  return [...store].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function resetUserPosts(): void {
  store.length = 0
}

export interface NewUserPost {
  authorHandle: string
  authorName: string
  credential: UserPost['credential']
  body: string
  media?: MediaItem[]
}

/**
 * Legt einen Nutzer-Beitrag an.
 *
 * Prüft an der Systemgrenze — nicht im Formular, das sich im Browser umgehen
 * lässt: Inhalt vorhanden, Länge, und über `assertMediaSetValid` die
 * Zugänglichkeit jedes Anhangs (alt-Text, Untertitel, Anzahl, keine Mischung
 * aus Video und Galerie).
 */
export function createUserPost(input: NewUserPost): UserPost {
  const body = input.body.trim()
  const media = input.media ?? []

  if (!body && media.length === 0) {
    throw new PostError('empty', 'Bitte schreiben Sie etwas oder fügen Sie ein Medium hinzu.')
  }
  if (body.length > MAX_POST_LENGTH) {
    throw new PostError(
      'too_long',
      `Beiträge dürfen höchstens ${MAX_POST_LENGTH} Zeichen haben (aktuell ${body.length}).`,
    )
  }

  assertMediaSetValid(media, 'post')

  const post: UserPost = {
    id: `p-${++counter}-${Date.now().toString(36)}`,
    authorHandle: input.authorHandle,
    authorName: input.authorName,
    credential: input.credential,
    body,
    media,
    createdAt: new Date(),
  }

  store.unshift(post)
  return post
}

// --- Eingehende Medien aus dem Formular -------------------------------------

/**
 * Wandelt die JSON-Anlage des Formulars in geprüfte `MediaItem`s.
 *
 * Das ist die eigentliche Systemgrenze für Medien: Was hier ankommt, hat den
 * Browser passiert und kann beliebig manipuliert sein. Unbekannte Typen werden
 * verworfen, Pflichtfelder erzwungen — `assertMediaSetValid` im Anschluss prüft
 * dann noch Zugänglichkeit und Mengen.
 */
export function parseMediaPayload(raw: unknown): MediaItem[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new PostError('media_invalid', 'Die Anlage konnte nicht gelesen werden.')
  }
  if (!Array.isArray(parsed)) return []

  return parsed.map((entry, index): MediaItem => {
    if (typeof entry !== 'object' || entry === null) {
      throw new PostError('media_invalid', `Anlage ${index + 1} ist unlesbar.`)
    }
    const item = entry as Record<string, unknown>
    const str = (key: string): string => (typeof item[key] === 'string' ? (item[key] as string) : '')
    const num = (key: string, fallback: number): number =>
      typeof item[key] === 'number' && Number.isFinite(item[key]) ? (item[key] as number) : fallback

    const base = { id: str('id') || `m-${index}`, url: str('url') }

    switch (item.kind) {
      case 'image':
        return {
          ...base,
          kind: 'image',
          width: num('width', 1),
          height: num('height', 1),
          alt: str('alt'),
        }
      case 'gif':
        return {
          ...base,
          kind: 'gif',
          width: num('width', 1),
          height: num('height', 1),
          alt: str('alt'),
          title: str('title'),
          provider: item.provider === 'tenor' || item.provider === 'giphy' ? item.provider : 'eigene',
        }
      case 'video':
        return {
          ...base,
          kind: 'video',
          width: num('width', 1),
          height: num('height', 1),
          mimeType: item.mimeType === 'video/webm' ? 'video/webm' : 'video/mp4',
          posterUrl: str('posterUrl'),
          posterAlt: str('posterAlt'),
          durationSec: num('durationSec', 0),
          captionsUrl: str('captionsUrl') || null,
          transcript: str('transcript') || null,
          orientation: item.orientation === 'landscape' ? 'landscape' : 'portrait',
        }
      case 'audio':
        return {
          ...base,
          kind: 'audio',
          width: 0,
          height: 0,
          mimeType:
            item.mimeType === 'audio/mpeg' || item.mimeType === 'audio/ogg'
              ? item.mimeType
              : 'audio/webm',
          durationSec: num('durationSec', 0),
          waveform: Array.isArray(item.waveform)
            ? (item.waveform as unknown[]).filter((n): n is number => typeof n === 'number')
            : [],
          transcript: str('transcript') || null,
        }
      default:
        throw new PostError('media_kind_unknown', `Anlage ${index + 1} hat einen unbekannten Typ.`)
    }
  })
}
