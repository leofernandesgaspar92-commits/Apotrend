// ============================================================================
//  Medienmodell — Barrierefreiheit als TYP, nicht als Erinnerung
// ============================================================================
//  Dieselbe Bauart wie product.ts: Was rechtlich bzw. für die Zielgruppe
//  zwingend ist, wird nicht per Code-Review bewacht, sondern so modelliert,
//  dass der Fehler gar nicht erst formulierbar ist.
//
//  Konkret:
//   · `alt` ist bei Bild und GIF PFLICHTFELD (WCAG 1.1.1) — kein `alt?`.
//   · Video trägt `captionsUrl` und `transcript` als Feld; `assertPublishable`
//     verlangt mindestens eines davon (WCAG 1.2.2 / 1.2.3).
//   · Sprachnachrichten tragen `transcript` — in der Öffentlichkeit Pflicht,
//     in der Direktnachricht nachreichbar (WCAG 1.2.1, siehe unten).
//
//  Warum das hier und nicht im Formular: Medien kommen später aus Upload, API
//  und Fremdanbietern (Tenor/Giphy). Die Prüfung gehört an die Systemgrenze.
// ============================================================================

export const MEDIA_KINDS = ['image', 'video', 'gif', 'audio'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

interface MediaBase {
  id: string
  url: string
  /** Pixelmaße — verhindern Layout-Sprünge beim Nachladen (CLS). */
  width: number
  height: number
}

export interface ImageMedia extends MediaBase {
  kind: 'image'
  /** Pflicht. Ein leerer String ist zulässig für rein dekorative Bilder —
   *  aber es muss eine bewusste Entscheidung sein, kein Vergessen. */
  alt: string
  /** Optionale sichtbare Bildunterschrift (zusätzlich zum alt-Text). */
  caption?: string
}

export interface GifMedia extends MediaBase {
  kind: 'gif'
  alt: string
  /** Woher das GIF stammt — Anbieter-Nennung ist Lizenzbedingung bei Tenor/Giphy. */
  provider: 'tenor' | 'giphy' | 'eigene'
  /** Suchbegriff/Titel des Anbieters, dient auch als Grundlage des alt-Texts. */
  title: string
}

export interface VideoMedia extends MediaBase {
  kind: 'video'
  mimeType: 'video/mp4' | 'video/webm'
  /** Standbild vor dem Start. Ohne Poster nur eine schwarze Fläche. */
  posterUrl: string
  posterAlt: string
  durationSec: number
  /** WebVTT-Untertitel. `null` nur zulässig, wenn ein Transkript vorliegt. */
  captionsUrl: string | null
  transcript: string | null
  /** Reels-Format 9:16 oder klassisches Querformat — steuert das Layout. */
  orientation: 'portrait' | 'landscape'
}

export interface AudioMedia extends MediaBase {
  kind: 'audio'
  mimeType: 'audio/webm' | 'audio/mpeg' | 'audio/ogg'
  durationSec: number
  /** Normalisierte Ausschläge 0..1 für die Wellenform-Darstellung. */
  waveform: number[]
  transcript: string | null
}

export type MediaItem = ImageMedia | GifMedia | VideoMedia | AudioMedia

// --- Grenzwerte -------------------------------------------------------------
//  Bewusst zentral: Formular, Server Action und späterer Upload-Endpunkt
//  müssen dieselben Zahlen benutzen, sonst weicht die Anzeige von der Realität ab.

export const MEDIA_LIMITS = {
  /** Mehr als zehn Bilder liest im Feed niemand — und das Karussell wird unbedienbar. */
  imagesPerPost: 10,
  imagesPerComment: 4,
  /** Ein Video pro Beitrag. Zwei Player nebeneinander sind auf 390 px unbrauchbar. */
  videosPerPost: 1,
  /** Kurzvideo-Format („Reel"). */
  videoSeconds: 90,
  voiceNoteSeconds: 180,
  imageBytes: 12 * 1024 * 1024,
  videoBytes: 200 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
} as const

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

/** Wert für das `accept`-Attribut des Datei-Dialogs. */
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')

// --- Fehler -----------------------------------------------------------------

export class MediaError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MediaError'
    this.code = code
  }
}

// --- Prüfungen --------------------------------------------------------------

/**
 * Wo erscheint das Medium? Der Unterschied ist kein Detail:
 *
 *  `public`  — Feed, News, Kommentare. Öffentlich zugänglicher Inhalt, damit
 *              gilt die BFSG-/WCAG-Zusage vollständig: Video ohne Untertitel
 *              ODER Transkript wird abgewiesen, Sprachnachricht ohne Transkript
 *              ebenfalls.
 *  `direct`  — Direktnachricht zwischen zwei Personen. Eine spontane
 *              Sprachnachricht kann kein fertiges Transkript mitbringen; sie
 *              wird zugelassen, aber als „ohne Transkript" markiert, damit die
 *              Oberfläche eine Abschrift anbieten kann statt sie zu verschweigen.
 */
export type MediaContext = 'public' | 'direct'

export function isImageLike(item: MediaItem): item is ImageMedia | GifMedia {
  return item.kind === 'image' || item.kind === 'gif'
}

/** Barrierefreier Name eines Mediums — für alt/aria-label, nie leer erfunden. */
export function accessibleName(item: MediaItem): string {
  switch (item.kind) {
    case 'image':
      return item.alt
    case 'gif':
      return item.alt || `GIF: ${item.title}`
    case 'video':
      return item.posterAlt
    case 'audio':
      return `Sprachnachricht, ${formatDuration(item.durationSec)}`
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const min = Math.floor(s / 60)
  const rest = s % 60
  return `${min}:${String(rest).padStart(2, '0')}`
}

/** Seitenverhältnis als CSS-Wert — hält den Platz frei, bevor das Bild da ist. */
export function aspectRatio(item: MediaItem): string {
  if (item.kind === 'audio') return 'auto'
  if (item.kind === 'video') return item.orientation === 'portrait' ? '9 / 16' : '16 / 9'
  return `${item.width} / ${item.height}`
}

/**
 * Torwächter vor jeder Veröffentlichung eines einzelnen Mediums.
 * Wirft `MediaError`, statt etwas Unzugängliches durchzulassen.
 */
export function assertPublishable(item: MediaItem, context: MediaContext = 'public'): void {
  if (!item.url) {
    throw new MediaError('media_url_missing', 'Medium ohne Quelle.')
  }

  if (item.kind === 'video') {
    if (item.durationSec > MEDIA_LIMITS.videoSeconds) {
      throw new MediaError(
        'video_too_long',
        `Videos dürfen höchstens ${MEDIA_LIMITS.videoSeconds} Sekunden lang sein ` +
          `(dieses: ${Math.round(item.durationSec)} s).`,
      )
    }
    if (!item.posterAlt) {
      throw new MediaError('poster_alt_missing', 'Videovorschau ohne Bildbeschreibung.')
    }
    // WCAG 1.2.2: Untertitel für aufgezeichnetes Video sind AA-Pflicht.
    // Ein vollständiges Transkript wird als gleichwertige Alternative akzeptiert.
    if (context === 'public' && !item.captionsUrl && !item.transcript) {
      throw new MediaError(
        'captions_missing',
        'Video ohne Untertitel und ohne Transkript kann nicht veröffentlicht werden ' +
          '(WCAG 1.2.2). Untertitel-Datei hinterlegen oder Abschrift eintragen.',
      )
    }
  }

  if (item.kind === 'audio') {
    if (item.durationSec > MEDIA_LIMITS.voiceNoteSeconds) {
      throw new MediaError(
        'audio_too_long',
        `Sprachnachrichten dürfen höchstens ${MEDIA_LIMITS.voiceNoteSeconds} Sekunden lang sein.`,
      )
    }
    // In der Öffentlichkeit ist die Abschrift Pflicht (WCAG 1.2.1); in der
    // Direktnachricht wird sie nachgereicht, nicht erzwungen.
    if (context === 'public' && !item.transcript) {
      throw new MediaError(
        'transcript_missing',
        'Öffentliche Sprachnachricht ohne Abschrift ist nicht zugänglich (WCAG 1.2.1).',
      )
    }
  }
}

/**
 * Prüft eine ganze Anlage — Anzahl, Mischung, Zugänglichkeit.
 * `surface` steuert die Obergrenzen (Beitrag großzügiger als Kommentar).
 */
export function assertMediaSetValid(
  items: readonly MediaItem[],
  surface: 'post' | 'comment' | 'message',
): void {
  const videos = items.filter((i) => i.kind === 'video')
  const pictures = items.filter(isImageLike)
  const context: MediaContext = surface === 'message' ? 'direct' : 'public'

  if (videos.length > MEDIA_LIMITS.videosPerPost) {
    throw new MediaError(
      'too_many_videos',
      `Höchstens ${MEDIA_LIMITS.videosPerPost} Video pro Beitrag.`,
    )
  }

  const pictureLimit =
    surface === 'post' ? MEDIA_LIMITS.imagesPerPost : MEDIA_LIMITS.imagesPerComment
  if (pictures.length > pictureLimit) {
    throw new MediaError(
      'too_many_images',
      `Höchstens ${pictureLimit} Bilder ${surface === 'post' ? 'pro Beitrag' : 'pro Kommentar'} ` +
        `(ausgewählt: ${pictures.length}).`,
    )
  }

  // Video und Bildergalerie zusammen ergeben zwei konkurrierende Blickfänge.
  if (videos.length > 0 && pictures.length > 0) {
    throw new MediaError(
      'mixed_media',
      'Entweder ein Video oder eine Bildergalerie — beides zusammen ist unübersichtlich.',
    )
  }

  for (const item of items) assertPublishable(item, context)
}
