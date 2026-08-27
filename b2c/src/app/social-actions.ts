'use server'

// ============================================================================
//  Server Actions für Feed, Reaktionen und Kommentare
// ============================================================================
//  Wie in actions.ts gilt: Alles, was hier ankommt, ist unvertrauenswürdig.
//  Reaktionstyp, Anhänge und Verschachtelungstiefe werden deshalb hier bzw. im
//  jeweiligen Service geprüft — nie in der Komponente, die sich im Browser
//  aushebeln lässt.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { addComment, CommentError } from '@/lib/comments'
import { MediaError } from '@/lib/media'
import { createUserPost, parseMediaPayload, PostError } from '@/lib/posts'
import { isReactionType, toggleReaction, type ReactionType } from '@/lib/reactions'
import { demoViewer, reactionStore } from '@/lib/social-data'

const FEED_PATH = '/neuigkeiten'

export type PostActionResult = { ok: true; id: string } | { ok: false; code: string; message: string } | null
export type CommentActionResult =
  | { ok: true; id: string }
  | { ok: false; code: string; message: string }
  | null

/**
 * Reaktion setzen, wechseln oder zurücknehmen.
 *
 * Der Typ wird geprüft, bevor er den Speicher erreicht: eine im Browser
 * eingeschmuggelte fünfte Reaktion („💰 gekauft") würde sonst die geschlossene
 * Auswahl unterlaufen, die es aus HWG-Gründen gerade gibt (siehe reactions.ts).
 */
export async function reactAction(
  targetId: string,
  type: ReactionType,
): Promise<ReactionType | null> {
  if (!targetId || !isReactionType(type)) {
    throw new Error('Unzulässige Reaktion.')
  }
  const own = toggleReaction(reactionStore, targetId, demoViewer.id, type)
  revalidatePath(FEED_PATH)
  return own
}

/** Beitrag veröffentlichen. Signatur passend zu `useFormState`. */
export async function createPostAction(
  _prev: PostActionResult,
  formData: FormData,
): Promise<PostActionResult> {
  try {
    const media = parseMediaPayload(formData.get('media'))
    const post = createUserPost({
      authorHandle: demoViewer.handle,
      authorName: demoViewer.displayName,
      credential: demoViewer.credential,
      body: String(formData.get('body') ?? ''),
      media,
    })
    revalidatePath(FEED_PATH)
    return { ok: true, id: post.id }
  } catch (error) {
    return toResult(error)
  }
}

/** Kommentar oder Antwort anlegen. */
export async function createCommentAction(
  _prev: CommentActionResult,
  formData: FormData,
): Promise<CommentActionResult> {
  try {
    const parentRaw = String(formData.get('parentId') ?? '')
    const comment = addComment({
      postId: String(formData.get('postId') ?? ''),
      parentId: parentRaw === '' ? null : parentRaw,
      authorHandle: demoViewer.handle,
      authorName: demoViewer.displayName,
      credential: demoViewer.credential,
      body: String(formData.get('body') ?? ''),
      media: parseMediaPayload(formData.get('media')),
    })
    revalidatePath(FEED_PATH)
    return { ok: true, id: comment.id }
  } catch (error) {
    return toResult(error)
  }
}

/**
 * Fehler in eine anzeigbare Antwort übersetzen.
 *
 * Bewusst mit der ECHTEN Begründung: „Bild ohne Beschreibung" ist eine
 * Information, mit der die Nutzer:in etwas anfangen kann. Ein generisches
 * „Fehler beim Speichern" wäre bequemer und wertlos.
 */
function toResult(error: unknown): { ok: false; code: string; message: string } {
  if (error instanceof MediaError || error instanceof PostError || error instanceof CommentError) {
    return { ok: false, code: error.code, message: error.message }
  }
  throw error
}
