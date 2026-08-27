// ============================================================================
//  Medien- und Reaktions-Wächter
// ============================================================================
//  Die Typ-Ebene schützt den Code, den wir selbst schreiben. Diese Tests
//  schützen die Systemgrenze: Formular, Server Action, künftige API — überall
//  dort, wo Typen zur Laufzeit nicht mehr existieren.
// ============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MEDIA_LIMITS,
  MediaError,
  accessibleName,
  aspectRatio,
  assertMediaSetValid,
  assertPublishable,
  formatDuration,
  type AudioMedia,
  type ImageMedia,
  type MediaItem,
  type VideoMedia,
} from '../src/lib/media.ts'
import {
  REACTIONS,
  createReactionStore,
  isReactionType,
  summarize,
  summaryText,
  toggleReaction,
} from '../src/lib/reactions.ts'
import {
  addComment,
  buildTree,
  countAll,
  getComments,
  MAX_DEPTH,
  resetComments,
} from '../src/lib/comments.ts'
import { assertNewsPublishable, splitTaggableProducts, disclosureLabel } from '../src/lib/news.ts'
import { getProduct } from '../src/lib/data.ts'
import { parseMediaPayload, createUserPost, resetUserPosts, PostError } from '../src/lib/posts.ts'

/**
 * `assert.throws` gibt den Fehler nicht zurück — für Prüfungen auf den
 * Fehlercode braucht es ihn aber. Deshalb dieser Fänger.
 */
function caught(fn: () => unknown): { code: string; message: string } {
  try {
    fn()
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { code: e.code ?? '', message: e.message ?? '' }
  }
  throw new Error('Es wurde kein Fehler geworfen, obwohl einer erwartet war.')
}

// --- Bausteine --------------------------------------------------------------

const image = (over: Partial<ImageMedia> = {}): ImageMedia => ({
  kind: 'image',
  id: 'i1',
  url: '/media/hero-blister.svg',
  width: 1200,
  height: 675,
  alt: 'Ein Blister mit Tabletten',
  ...over,
})

const video = (over: Partial<VideoMedia> = {}): VideoMedia => ({
  kind: 'video',
  id: 'v1',
  url: '/media/anwendung.mp4',
  mimeType: 'video/mp4',
  width: 720,
  height: 1280,
  posterUrl: '/media/poster-anwendung.svg',
  posterAlt: 'Vorschau auf die Anleitung',
  durationSec: 18,
  captionsUrl: '/media/anwendung.vtt',
  transcript: null,
  orientation: 'portrait',
  ...over,
})

const audio = (over: Partial<AudioMedia> = {}): AudioMedia => ({
  kind: 'audio',
  id: 'a1',
  url: '/media/note.webm',
  mimeType: 'audio/webm',
  width: 0,
  height: 0,
  durationSec: 24,
  waveform: [0.2, 0.6, 0.9, 0.4],
  transcript: 'Kurze Rückfrage zur Dosierung.',
  ...over,
})

// --- Medien -----------------------------------------------------------------

test('Video ohne Untertitel UND ohne Abschrift ist nicht veröffentlichbar', () => {
  assert.equal(
    caught(() => assertPublishable(video({ captionsUrl: null, transcript: null }), 'public')).code,
    'captions_missing',
  )
})

test('Video mit Abschrift statt Untertiteln wird akzeptiert', () => {
  assert.doesNotThrow(() =>
    assertPublishable(video({ captionsUrl: null, transcript: 'Vollständige Abschrift.' }), 'public'),
  )
})

test('Zu langes Video wird abgewiesen', () => {
  assert.equal(
    caught(() => assertPublishable(video({ durationSec: MEDIA_LIMITS.videoSeconds + 1 }))).code,
    'video_too_long',
  )
})

test('Sprachnachricht ohne Abschrift: öffentlich gesperrt, in der Direktnachricht erlaubt', () => {
  const ohne = audio({ transcript: null })
  assert.throws(() => assertPublishable(ohne, 'public'), MediaError)
  // Eine spontan aufgenommene Nachricht kann keine fertige Abschrift haben.
  assert.doesNotThrow(() => assertPublishable(ohne, 'direct'))
})

test('Video und Bildergalerie zusammen werden abgewiesen', () => {
  assert.equal(caught(() => assertMediaSetValid([video(), image()], 'post')).code, 'mixed_media')
})

test('Bilder-Obergrenze gilt und ist für Kommentare strenger', () => {
  const many = (n: number): MediaItem[] =>
    Array.from({ length: n }, (_, i) => image({ id: `i${i}` }))

  assert.doesNotThrow(() => assertMediaSetValid(many(MEDIA_LIMITS.imagesPerPost), 'post'))
  assert.throws(() => assertMediaSetValid(many(MEDIA_LIMITS.imagesPerPost + 1), 'post'), MediaError)
  assert.throws(
    () => assertMediaSetValid(many(MEDIA_LIMITS.imagesPerComment + 1), 'comment'),
    MediaError,
  )
})

test('accessibleName liefert nie einen leeren Namen für GIF und Video', () => {
  assert.equal(accessibleName(image({ alt: 'Blister' })), 'Blister')
  assert.equal(accessibleName(video({ posterAlt: 'Anleitung' })), 'Anleitung')
  assert.match(accessibleName(audio({ durationSec: 65 })), /1:05/)
})

test('aspectRatio hält für Hochkant-Video das Reels-Format', () => {
  assert.equal(aspectRatio(video({ orientation: 'portrait' })), '9 / 16')
  assert.equal(aspectRatio(video({ orientation: 'landscape' })), '16 / 9')
  assert.equal(aspectRatio(image({ width: 4, height: 3 })), '4 / 3')
})

test('formatDuration rundet und füllt Sekunden auf', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(9.4), '0:09')
  assert.equal(formatDuration(125), '2:05')
})

// --- Reaktionen -------------------------------------------------------------

test('Die Reaktionsauswahl ist geschlossen — nichts Fremdes kommt hinein', () => {
  assert.equal(REACTIONS.length, 4)
  assert.ok(isReactionType('helpful'))
  // Genau der Fall, den § 11 HWG verhindern soll: eine erfundene Produkt-Wertung.
  assert.equal(isReactionType('gekauft'), false)
  assert.equal(isReactionType('🔥'), false)
})

test('Zweimal dieselbe Reaktion nimmt sie zurück, eine andere ersetzt sie', () => {
  const store = createReactionStore()
  assert.equal(toggleReaction(store, 'p1', 'u1', 'like'), 'like')
  assert.equal(toggleReaction(store, 'p1', 'u1', 'like'), null)
  assert.equal(toggleReaction(store, 'p1', 'u1', 'helpful'), 'helpful')
  assert.equal(toggleReaction(store, 'p1', 'u1', 'thanks'), 'thanks')
  // Eine Person, eine Reaktion — keine Stimmenhäufung.
  assert.equal(summarize(store, 'p1', 'u1').total, 1)
})

test('Zusammenfassung zählt richtig, sortiert absteigend und kennt die eigene', () => {
  const store = createReactionStore()
  toggleReaction(store, 'p1', 'u1', 'informative')
  toggleReaction(store, 'p1', 'u2', 'informative')
  toggleReaction(store, 'p1', 'u3', 'thanks')

  const summary = summarize(store, 'p1', 'u3')
  assert.equal(summary.total, 3)
  assert.equal(summary.counts[0]?.type, 'informative')
  assert.equal(summary.counts[0]?.count, 2)
  assert.equal(summary.own, 'thanks')
  assert.match(summaryText(summary), /2× Informativ/)
  assert.match(summaryText(summary), /Ihre Reaktion: Danke/)
})

test('Ohne Reaktionen gibt es keine erfundene Null-Zeile', () => {
  const store = createReactionStore()
  const summary = summarize(store, 'leer', 'u1')
  assert.deepEqual(summary, { total: 0, counts: [], own: null })
  assert.equal(summaryText(summary), 'Noch keine Reaktionen')
})

// --- Kommentare -------------------------------------------------------------

test('Verschachtelung wird gedeckelt statt endlos einzurücken', () => {
  resetComments()
  const base = {
    postId: 'post-x',
    authorHandle: 'a',
    authorName: 'A',
    credential: null,
    body: 'Text',
  }

  let parentId: string | null = null
  const depths: number[] = []
  for (let i = 0; i < MAX_DEPTH + 3; i++) {
    const c = addComment({ ...base, parentId })
    depths.push(c.depth)
    parentId = c.id
  }

  assert.equal(Math.max(...depths), MAX_DEPTH, 'Tiefe überschreitet MAX_DEPTH nicht')
  // Ab der Grenze bleibt der Bezug erhalten, auch ohne weitere Einrückung.
  const last = addComment({ ...base, parentId })
  assert.equal(last.depth, MAX_DEPTH)
  assert.equal(last.replyToHandle, 'a')
})

test('Leerer Kommentar wird abgewiesen, Kommentar mit nur einem Bild nicht', () => {
  resetComments()
  const base = {
    postId: 'post-y',
    parentId: null,
    authorHandle: 'a',
    authorName: 'A',
    credential: null,
  }
  assert.throws(() => addComment({ ...base, body: '   ' }))
  assert.doesNotThrow(() => addComment({ ...base, body: '', media: [image()] }))
})

test('Kommentar-Anhang ohne Bildbeschreibung ist zulässig, mit Video ohne Untertitel nicht', () => {
  resetComments()
  const base = {
    postId: 'post-z',
    parentId: null,
    authorHandle: 'a',
    authorName: 'A',
    credential: null,
    body: 'Text',
  }
  // Ein leerer alt-Text ist eine ERLAUBTE Entscheidung (rein dekoratives Bild).
  assert.doesNotThrow(() => addComment({ ...base, media: [image({ alt: '' })] }))
  assert.throws(
    () => addComment({ ...base, media: [video({ captionsUrl: null, transcript: null })] }),
    MediaError,
  )
})

test('Der Baum sortiert nach Alter und zählt alle Ebenen', () => {
  resetComments()
  const base = {
    postId: 'post-t',
    authorHandle: 'a',
    authorName: 'A',
    credential: null,
    body: 'x',
  }
  const root = addComment({ ...base, parentId: null })
  addComment({ ...base, parentId: root.id })
  addComment({ ...base, parentId: root.id })
  addComment({ ...base, parentId: null })

  const tree = buildTree(getComments('post-t'))
  assert.equal(tree.length, 2)
  assert.equal(countAll(tree), 4)
  assert.equal(tree[0]?.replies.length, 2)
})

// --- News -------------------------------------------------------------------

test('Rx-Produkt landet nie im Kauf-Overlay eines News-Beitrags', () => {
  const { shoppable, informational } = splitTaggableProducts(
    ['prod-ibu', 'prod-rami'],
    getProduct,
  )
  assert.deepEqual(
    shoppable.map((p) => p.id),
    ['prod-ibu'],
  )
  assert.deepEqual(
    informational.map((p) => p.id),
    ['prod-rami'],
  )
})

test('Ein automatischer Feed mit Rx-Produkt scheitert an der Veröffentlichungsprüfung', () => {
  const item = {
    id: 'n-test',
    source: { kind: 'fach_news' as const, outlet: 'X', outletUrl: 'https://x.example/' },
    headline: 'Test',
    teaser: 't',
    body: 'b',
    media: [],
    productIds: ['prod-rami'],
    sourceUrls: [],
    publishedAt: new Date(),
    readMinutes: 1,
  }
  // Genau der gefährliche Fall: vollautomatische Publikumswerbung für Rx.
  assert.throws(() => assertNewsPublishable(item, getProduct), /rezept|verschreibung/i)
})

test('Die Kennzeichnung ergibt sich aus dem Typ, nicht aus einem Schalter', () => {
  assert.equal(
    disclosureLabel({ kind: 'sponsoring', advertiser: 'A', advertiserUrl: 'https://a.example/' }),
    'Anzeige',
  )
  assert.equal(
    disclosureLabel({ kind: 'fach_news', outlet: 'B', outletUrl: 'https://b.example/' }),
    'Fach-News',
  )
})

// --- Anlagen aus dem Formular ------------------------------------------------

test('parseMediaPayload verwirft unbekannte Medientypen', () => {
  assert.deepEqual(parseMediaPayload(''), [])
  assert.deepEqual(parseMediaPayload('[]'), [])
  assert.throws(
    () => parseMediaPayload(JSON.stringify([{ kind: 'exe', url: 'x' }])),
    PostError,
  )
})

test('parseMediaPayload erzwingt die Pflichtfelder statt sie zu erfinden', () => {
  const [item] = parseMediaPayload(
    JSON.stringify([{ kind: 'image', id: 'x', url: '/a.png', width: 10, height: 5 }]),
  )
  assert.equal(item?.kind, 'image')
  // alt fehlt in den Fremddaten -> leer, NICHT ausgedacht.
  assert.equal((item as ImageMedia).alt, '')
})

test('Ein manipuliertes Formular kann kein untertitelloses Video einschmuggeln', () => {
  resetUserPosts()
  const payload = JSON.stringify([
    {
      kind: 'video',
      id: 'v',
      url: '/x.mp4',
      width: 720,
      height: 1280,
      posterUrl: '/p.svg',
      posterAlt: 'Vorschau',
      durationSec: 10,
      orientation: 'portrait',
    },
  ])
  assert.throws(
    () =>
      createUserPost({
        authorHandle: 'a',
        authorName: 'A',
        credential: null,
        body: 'Text',
        media: parseMediaPayload(payload),
      }),
    MediaError,
  )
})

test('Ein gültiger Beitrag geht durch und liegt danach im Speicher', () => {
  resetUserPosts()
  const post = createUserPost({
    authorHandle: 'a',
    authorName: 'A',
    credential: null,
    body: 'Ein Hinweis mit Bild.',
    media: [image()],
  })
  assert.equal(post.media.length, 1)
  assert.match(post.id, /^p-/)
})
