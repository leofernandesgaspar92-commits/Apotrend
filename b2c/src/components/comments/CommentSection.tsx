import { cn } from '@/lib/cn'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { ReactionBar } from '@/components/feed/ReactionBar'
import { CommentComposer } from './CommentComposer'
import { ReplyToggle } from './ReplyToggle'
import { MAX_DEPTH, buildTree, countAll, type CommentNode } from '@/lib/comments'
import { accessibleName, type MediaItem } from '@/lib/media'
import type { ReactionSummary, ReactionType } from '@/lib/reactions'

/**
 * CommentSection — verschachtelter Thread mit Anhängen und Reaktionen.
 *
 * Die Einrückung endet bei MAX_DEPTH (comments.ts). Ab dort hängen Antworten
 * auf derselben Ebene und tragen stattdessen „Antwort an @handle" — auf 390 px
 * Breite ist das der Unterschied zwischen lesbar und einer Textspalte aus zwei
 * Wörtern. Der Bezug geht dabei nicht verloren, nur die Optik gibt nach.
 *
 * Fachliche Beiträge werden hervorgehoben: wer ein Prüfsiegel hat, bekommt es
 * neben den Namen. In einem Gesundheitsforum ist die Frage „wer sagt das?"
 * nicht Beiwerk, sondern die halbe Information.
 */
export function CommentSection({
  postId,
  comments,
  summaries,
  onReact,
  onComment,
}: {
  postId: string
  comments: import('@/lib/comments').Comment[]
  /** Reaktions-Zusammenfassung je Kommentar-ID. */
  summaries: Record<string, ReactionSummary>
  onReact: (targetId: string, type: ReactionType) => Promise<ReactionType | null>
  onComment: (
    prev: import('@/app/social-actions').CommentActionResult,
    formData: FormData,
  ) => Promise<import('@/app/social-actions').CommentActionResult>
}) {
  const tree = buildTree(comments)
  const total = countAll(tree)

  return (
    <section
      id={`kommentare-${postId}`}
      aria-labelledby={`kommentare-${postId}-titel`}
      data-testid={`comments-${postId}`}
      className="scroll-mt-4 rounded-lg border border-border bg-surface-sunken p-4"
    >
      <h2
        id={`kommentare-${postId}-titel`}
        className="text-lg font-bold text-content"
        data-testid={`comment-count-${postId}`}
      >
        {total === 0 ? 'Noch keine Kommentare' : `${total} ${total === 1 ? 'Kommentar' : 'Kommentare'}`}
      </h2>

      <div className="mt-3">
        <CommentComposer postId={postId} action={onComment} />
      </div>

      {tree.length > 0 && (
        <ul className="mt-4 grid gap-3" data-testid={`comment-list-${postId}`}>
          {tree.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              postId={postId}
              summaries={summaries}
              onReact={onReact}
              onComment={onComment}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CommentItem({
  node,
  postId,
  summaries,
  onReact,
  onComment,
}: {
  node: CommentNode
  postId: string
  summaries: Record<string, ReactionSummary>
  onReact: (targetId: string, type: ReactionType) => Promise<ReactionType | null>
  onComment: (
    prev: import('@/app/social-actions').CommentActionResult,
    formData: FormData,
  ) => Promise<import('@/app/social-actions').CommentActionResult>
}) {
  const timeFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  const summary = summaries[node.id] ?? { total: 0, counts: [], own: null }
  const atCap = node.depth >= MAX_DEPTH

  return (
    <li data-testid={`comment-${node.id}`} data-depth={node.depth}>
      <article
        className={cn(
          'rounded-lg border border-border bg-surface p-4',
          // Fachliche Antworten heben sich ab — Herkunft ist hier Information.
          node.credential && 'border-l-4 border-l-care',
        )}
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-content">{node.authorName}</span>
          {node.credential && (
            <VerifiedBadge
              kind={node.credential}
              verifiedAt={new Date('2026-01-01')}
              validUntil={new Date('2027-01-01')}
              authority="Apothekerkammer"
            />
          )}
          <time
            dateTime={node.createdAt.toISOString()}
            className="ml-auto text-xs text-content-muted"
          >
            {timeFmt.format(node.createdAt)}
          </time>
        </header>

        {/* Bei gedeckelter Tiefe bleibt der Bezug im Text erhalten. */}
        {node.replyToHandle && node.depth >= MAX_DEPTH && (
          <p className="mt-1 text-xs font-semibold text-content-muted">
            Antwort an @{node.replyToHandle}
          </p>
        )}

        {node.body && <p className="mt-2 max-w-measure text-content">{node.body}</p>}

        {node.media.length > 0 && <CommentMedia items={node.media} />}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ReactionBar targetId={node.id} summary={summary} onReact={onReact} size="sm" />
          <ReplyToggle
            postId={postId}
            parentId={node.id}
            replyTo={node.authorName}
            action={onComment}
            atCap={atCap}
          />
        </div>
      </article>

      {node.replies.length > 0 && (
        <ul
          className={cn(
            'mt-3 grid gap-3',
            // Einrückung nur bis zur Deckelung — danach würde der Text zerfallen.
            'border-l-2 border-border pl-3 sm:pl-5',
          )}
        >
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              node={reply}
              postId={postId}
              summaries={summaries}
              onReact={onReact}
              onComment={onComment}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Anhänge eines Kommentars. Bewusst als Raster mit voller Beschriftung statt
 * als Karussell: bei bis zu vier Bildern ist Scrollen unnötig, und jedes Bild
 * bleibt gleichzeitig sichtbar.
 */
function CommentMedia({ items }: { items: MediaItem[] }) {
  return (
    <ul
      data-testid="comment-media"
      className={cn('mt-3 grid gap-2', items.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}
    >
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={accessibleName(item)}
            width={'width' in item ? item.width : undefined}
            height={'height' in item ? item.height : undefined}
            loading="lazy"
            className={cn(
              'w-full bg-surface-sunken object-cover',
              items.length > 1 ? 'max-h-40' : 'max-h-64',
            )}
          />
        </li>
      ))}
    </ul>
  )
}
