import { NewsFeedCard } from '@/components/feed/NewsFeedCard'
import { CommentSection } from '@/components/comments/CommentSection'
import { CreatePostModal } from '@/components/post/CreatePostModal'
import { MediaCarousel } from '@/components/media/MediaCarousel'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { AudioNote } from '@/components/media/AudioNote'
import { ReactionBar } from '@/components/feed/ReactionBar'
import { Badge } from '@/components/ui/Badge'
import { getComments, buildTree, countAll } from '@/lib/comments'
import { getNewsItems } from '@/lib/social-data'
import { reactionStore, demoViewer } from '@/lib/social-data'
import { summarize, type ReactionSummary } from '@/lib/reactions'
import { getUserPosts } from '@/lib/posts'
import { isImageLike, type AudioMedia, type GifMedia, type ImageMedia, type VideoMedia } from '@/lib/media'
import { createCommentAction, createPostAction, reactAction } from '@/app/social-actions'

export const dynamic = 'force-dynamic'

/**
 * Neuigkeiten — News-/Sponsoring-Feed, eigene Beiträge, Kommentare.
 *
 * Server Component: Reaktions-Zusammenfassungen und Kommentarbäume werden hier
 * berechnet und fertig übergeben. Nur die Teile, die wirklich interaktiv sind
 * (Reaktionsleiste, Editor, Antwort-Formulare), laufen im Browser.
 */
export default function NeuigkeitenPage() {
  const news = getNewsItems()
  const userPosts = getUserPosts()

  const summaryFor = (id: string): ReactionSummary =>
    summarize(reactionStore, id, demoViewer.id)

  return (
    <main id="inhalt" className="mx-auto w-full max-w-feed px-4 py-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-content">Neuigkeiten</h1>
        <p className="mt-2 max-w-measure text-content-muted">
          Fachlich geprüfte Meldungen, Beiträge aus der Community und gekennzeichnete
          Anzeigen — in einem Verlauf, aber immer unterscheidbar.
        </p>
        <div className="mt-4">
          <CreatePostModal action={createPostAction} />
        </div>
      </header>

      {/* --- Eigene Beiträge --- */}
      {userPosts.length > 0 && (
        <section aria-label="Ihre Beiträge" className="mb-6 grid gap-4">
          {userPosts.map((post) => {
            const pictures = post.media.filter(isImageLike) as (ImageMedia | GifMedia)[]
            const video = post.media.find((m) => m.kind === 'video') as VideoMedia | undefined
            const audio = post.media.find((m) => m.kind === 'audio') as AudioMedia | undefined
            return (
              <article
                key={post.id}
                data-testid={`userpost-${post.id}`}
                className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
              >
                <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                  <span className="font-semibold text-content">{post.authorName}</span>
                  <Badge tone="neutral">Ihr Beitrag</Badge>
                  <time
                    dateTime={post.createdAt.toISOString()}
                    className="ml-auto text-xs text-content-muted"
                  >
                    {new Intl.DateTimeFormat('de-DE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(post.createdAt)}
                  </time>
                </header>

                {video && <VideoPlayer item={video} className="rounded-none border-x-0 border-t-0" />}
                {!video && pictures.length > 0 && (
                  <MediaCarousel
                    items={pictures}
                    label="Bilder Ihres Beitrags"
                    className="rounded-none border-x-0 border-t-0"
                  />
                )}

                {post.body && (
                  <p className="max-w-measure px-5 py-4 text-content">{post.body}</p>
                )}
                {audio && (
                  <div className="px-5 pb-4">
                    <AudioNote item={audio} />
                  </div>
                )}

                <footer className="border-t border-border bg-surface-sunken px-5 py-3">
                  <ReactionBar
                    targetId={post.id}
                    summary={summaryFor(post.id)}
                    onReact={reactAction}
                  />
                </footer>
              </article>
            )
          })}
        </section>
      )}

      {/* --- News- und Sponsoring-Beiträge --- */}
      <div className="grid gap-8">
        {news.map((item) => {
          const comments = getComments(item.id)
          const summaries: Record<string, ReactionSummary> = {}
          for (const c of comments) summaries[c.id] = summaryFor(c.id)

          return (
            <div key={item.id} className="grid gap-3">
              <NewsFeedCard
                item={item}
                summary={summaryFor(item.id)}
                onReact={reactAction}
                commentCount={countAll(buildTree(comments))}
              />
              <CommentSection
                postId={item.id}
                comments={comments}
                summaries={summaries}
                onReact={reactAction}
                onComment={createCommentAction}
              />
            </div>
          )
        })}
      </div>
    </main>
  )
}
