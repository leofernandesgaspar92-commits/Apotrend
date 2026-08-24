import Link from 'next/link'
import { PostCard } from '@/components/feed/PostCard'
import { getPosts } from '@/lib/data'
import { getCart, cartCount } from '@/lib/cart'
import { sessionId } from '@/app/actions'

// Der Feed enthält nutzerbezogene Daten (Warenkorb-Zähler) — kein statisches Caching.
export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const posts = getPosts()
  const sid = await sessionId()
  const count = cartCount(getCart(sid))

  return (
    <div className="mx-auto max-w-feed px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-content">Für Sie</h1>
        <Link
          href="/warenkorb"
          className="ml-auto inline-flex min-h-touch items-center gap-2 rounded border border-border-strong bg-surface px-4 text-sm font-semibold text-content no-underline hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          Warenkorb
          <span
            data-testid="cart-count"
            className="rounded-pill bg-action px-2 py-0.5 text-xs font-bold text-action-fg tabular-nums"
          >
            {count}
          </span>
        </Link>
      </header>

      <p className="mb-6 max-w-measure text-content-muted">
        Fachbeiträge aus geprüften Apotheken. Gesundheitsbezogene Aussagen sind mit
        Quelle belegt. Verschreibungspflichtige Arzneimittel werden hier nur
        informativ dargestellt.
      </p>

      <main id="inhalt" className="grid gap-5">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </main>
    </div>
  )
}
