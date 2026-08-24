import { Badge } from '@/components/ui/Badge'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { SourceChip } from '@/components/ui/SourceChip'
import { ShoppableTag } from '@/components/ui/ShoppableTag'
import { getProduct } from '@/lib/data'
import type { FeedPost } from '@/lib/data'

/**
 * PostCard — die Umsetzung der Drei-Ebenen-Trennung in einer Karte:
 *
 *   Ebene 1 (Inhalt)      Autor:in mit Prüfsiegel, Text, Quellen
 *   Ebene 2 (Handel)      ShoppableTag — nur für kaufbare Klassen
 *   Ebene 3 (Versorgung)  derselbe Tag rendert Rx als Information, nie als Kauf
 *
 * Die Karte trifft diese Entscheidung nicht selbst: sie übergibt das Produkt an
 * ShoppableTag, und dort entscheidet der TYP, was überhaupt darstellbar ist.
 */
export function PostCard({ post }: { post: FeedPost }) {
  const products = post.productIds.map(getProduct).filter((p) => p !== undefined)
  const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' })

  return (
    <article
      className="rounded-lg border border-border bg-surface p-5 shadow-sm"
      aria-labelledby={`post-${post.id}-title`}
    >
      {/* --- Ebene 1: Person vor Produkt --- */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold text-content">{post.author.displayName}</span>
        <VerifiedBadge
          kind={post.author.credential}
          verifiedAt={post.author.verifiedAt}
          validUntil={post.author.validUntil}
          authority={post.author.authority}
        />
        {/* Kommerzieller Inhalt wird gekennzeichnet — unübersehbar, nicht im Kleingedruckten */}
        {post.isSponsored && <Badge tone="ad">Anzeige</Badge>}
        <span className="ml-auto text-xs text-content-muted">
          <time dateTime={post.publishedAt.toISOString()}>
            {dateFmt.format(post.publishedAt)}
          </time>
        </span>
      </header>

      {post.title && (
        <h2 id={`post-${post.id}-title`} className="mt-3 text-2xl font-bold text-content">
          {post.title}
        </h2>
      )}
      {!post.title && <span id={`post-${post.id}-title`} className="sr-only">Beitrag</span>}

      <p className="mt-2 max-w-measure text-content">{post.body}</p>

      {/* --- Evidenz-Anker: ohne Quelle keine Gesundheitsaussage --- */}
      {post.sourceUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-content-muted">Quellen:</span>
          {post.sourceUrls.map((url) => (
            <SourceChip key={url} url={url} />
          ))}
        </div>
      )}

      {/* --- Ebene 2/3: kaufbar ODER Information, nie beides --- */}
      {products.length > 0 && (
        <div className="mt-4 grid gap-3">
          {products.map((product) => (
            <ShoppableTag key={product.id} product={product} />
          ))}
        </div>
      )}
    </article>
  )
}
