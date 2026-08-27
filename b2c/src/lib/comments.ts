// ============================================================================
//  Kommentare — verschachtelt, aber gedeckelt
// ============================================================================
//  Reddit-artige Threads sind auf 390 px Breite ab der vierten Ebene unlesbar:
//  jede Einrückung frisst Zeilenbreite, der Text wird zur Spalte aus zwei
//  Wörtern. Deshalb ist die Tiefe hart auf MAX_DEPTH begrenzt — Antworten auf
//  Antworten der dritten Ebene hängen sich an die dritte Ebene an, statt weiter
//  einzurücken. Der Bezug bleibt über „Antwort an @handle" erhalten.
//
//  Das ist keine technische Grenze, sondern die Lesbarkeits-Entscheidung für
//  die Kernzielgruppe.
// ============================================================================

import { assertMediaSetValid, type MediaItem } from './media.ts'

export const MAX_DEPTH = 3
export const MAX_LENGTH = 2000

export interface Comment {
  id: string
  postId: string
  parentId: string | null
  authorHandle: string
  authorName: string
  /** Prüfsiegel-Art; `null` für Laien-Konten. */
  credential: 'pharmacist' | 'pharmacy' | 'pta' | 'physician' | null
  body: string
  media: MediaItem[]
  createdAt: Date
  /** 0 = oberste Ebene. Wird beim Anlegen berechnet, nicht vom Client geliefert. */
  depth: number
  /** Bei gedeckelter Tiefe: an wen die Antwort inhaltlich gerichtet ist. */
  replyToHandle: string | null
}

export interface CommentNode extends Comment {
  replies: CommentNode[]
}

export class CommentError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'CommentError'
    this.code = code
  }
}

// --- Speicher ---------------------------------------------------------------

const store = new Map<string, Comment[]>()

export function getComments(postId: string): Comment[] {
  return store.get(postId) ?? []
}

export function resetComments(postId?: string): void {
  if (postId) store.delete(postId)
  else store.clear()
}

export function seedComments(comments: Comment[]): void {
  for (const c of comments) {
    const list = store.get(c.postId) ?? []
    list.push(c)
    store.set(c.postId, list)
  }
}

// --- Anlegen ----------------------------------------------------------------

export interface NewComment {
  postId: string
  parentId: string | null
  authorHandle: string
  authorName: string
  credential: Comment['credential']
  body: string
  media?: MediaItem[]
}

let counter = 0

/**
 * Legt einen Kommentar an. Prüft an der Systemgrenze:
 *  · Inhalt vorhanden (Text ODER Anhang — ein leerer Kommentar ist keiner)
 *  · Länge
 *  · Anhänge zugänglich und in zulässiger Zahl (media.ts)
 *  · Tiefe: wird BERECHNET, nie vom Aufrufer übernommen
 */
export function addComment(input: NewComment): Comment {
  const body = input.body.trim()
  const media = input.media ?? []

  if (!body && media.length === 0) {
    throw new CommentError('empty', 'Bitte schreiben Sie etwas oder hängen Sie ein Bild an.')
  }
  if (body.length > MAX_LENGTH) {
    throw new CommentError(
      'too_long',
      `Kommentare dürfen höchstens ${MAX_LENGTH} Zeichen haben (aktuell ${body.length}).`,
    )
  }

  // Wirft bei Video ohne Untertitel, zu vielen Bildern usw.
  assertMediaSetValid(media, 'comment')

  const siblings = getComments(input.postId)
  let depth = 0
  let parentId = input.parentId
  let replyToHandle: string | null = null

  if (parentId) {
    const parent = siblings.find((c) => c.id === parentId)
    if (!parent) {
      throw new CommentError('parent_unknown', 'Der Kommentar, auf den geantwortet wird, fehlt.')
    }
    replyToHandle = parent.authorHandle
    if (parent.depth + 1 > MAX_DEPTH) {
      // Deckel: an den Elternkommentar hängen statt tiefer einzurücken.
      depth = parent.depth
      parentId = parent.parentId
    } else {
      depth = parent.depth + 1
    }
  }

  const comment: Comment = {
    id: `c-${++counter}-${Date.now().toString(36)}`,
    postId: input.postId,
    parentId,
    authorHandle: input.authorHandle,
    authorName: input.authorName,
    credential: input.credential,
    body,
    media,
    createdAt: new Date(),
    depth,
    replyToHandle,
  }

  store.set(input.postId, [...siblings, comment])
  return comment
}

// --- Baum -------------------------------------------------------------------

/**
 * Baut aus der flachen Liste den Anzeige-Baum.
 * Sortierung: älteste zuerst — bei fachlichen Antworten ist die Reihenfolge
 * der Argumentation wichtiger als Aktualität.
 */
export function buildTree(comments: readonly Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  for (const c of comments) nodes.set(c.id, { ...c, replies: [] })

  const roots: CommentNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }

  const byAge = (a: CommentNode, b: CommentNode) => a.createdAt.getTime() - b.createdAt.getTime()
  const sortDeep = (list: CommentNode[]) => {
    list.sort(byAge)
    for (const n of list) sortDeep(n.replies)
  }
  sortDeep(roots)

  return roots
}

/** Gesamtzahl inklusive aller Antworten — für „12 Kommentare". */
export function countAll(nodes: readonly CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAll(n.replies), 0)
}
