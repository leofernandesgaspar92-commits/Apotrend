import { Badge } from '@/components/ui/Badge'
import { SourceChip } from '@/components/ui/SourceChip'
import { ShoppableTag } from '@/components/ui/ShoppableTag'
import { MediaCarousel } from '@/components/media/MediaCarousel'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { ReactionBar } from '@/components/feed/ReactionBar'
import { cn } from '@/lib/cn'
import { getProduct } from '@/lib/data'
import {
  attributionUrl,
  disclosureDetail,
  disclosureLabel,
  splitTaggableProducts,
  type NewsItem,
} from '@/lib/news'
import { isImageLike, type GifMedia, type ImageMedia, type VideoMedia } from '@/lib/media'
import type { ReactionSummary, ReactionType } from '@/lib/reactions'

/**
 * NewsFeedCard — automatisch eingespielte Fach-News und bezahlte Beiträge.
 *
 * Die Karte hat drei Aufgaben, und die erste ist die rechtliche:
 *
 *  1. KENNZEICHNUNG. Ob „Anzeige" oder „Fach-News", steht im Typ der Quelle
 *     (news.ts) — die Karte kann es nicht vergessen und nicht verwechseln. Bei
 *     bezahlten Beiträgen wird zusätzlich der Auftraggeber genannt, direkt unter
 *     der Überschrift und nicht im Kleingedruckten (§ 6 TMG, § 22 MStV).
 *
 *  2. RICH MEDIA. Hero-Bild, Galerie oder Video-Header — statt Textwüste. Das
 *     Layout richtet sich nach dem, was tatsächlich anliegt.
 *
 *  3. SHOPPABLE OVERLAY, aber nur für das, was verkauft werden DARF.
 *     `splitTaggableProducts` trennt vorher: verschreibungspflichtige Produkte
 *     landen nie im Kauf-Overlay, sondern im Informations-Zweig darunter.
 *     Ein automatischer Feed, der ein Rx-Produkt mitliefert, erzeugt hier also
 *     keine unzulässige Publikumswerbung — auch ohne Redaktion.
 */
export function NewsFeedCard({
  item,
  summary,
  onReact,
  commentCount,
}: {
  item: NewsItem
  summary: ReactionSummary
  onReact: (targetId: string, type: ReactionType) => Promise<ReactionType | null>
  commentCount: number
}) {
  const { shoppable, informational } = splitTaggableProducts(item.productIds, getProduct)

  const pictures = item.media.filter(isImageLike) as (ImageMedia | GifMedia)[]
  const video = item.media.find((m) => m.kind === 'video') as VideoMedia | undefined
  const sponsored = item.source.kind === 'sponsoring'

  const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' })

  // Herkunfts-Link gehört zu den Belegen, ist aber oft mit einer Quelle
  // identisch (Fach-News aus derselben Redaktion). Zweimal dieselbe Domain
  // nebeneinander sieht nach einem Fehler aus — also entdoppeln.
  const sourceChips = [...new Set([...item.sourceUrls, attributionUrl(item.source)])]

  return (
    <article
      data-testid={`news-${item.id}`}
      data-sponsored={sponsored ? 'true' : 'false'}
      aria-labelledby={`${item.id}-headline`}
      className={cn(
        'overflow-hidden rounded-lg border bg-surface shadow-sm',
        // Bezahlte Beiträge bekommen einen eigenen Rahmen: die Kennzeichnung
        // wirkt zusätzlich optisch, nicht nur als Wort.
        sponsored ? 'border-border-strong' : 'border-border',
      )}
    >
      {/* --- Kennzeichnung ganz oben, vor allem anderen --- */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3',
          sponsored ? 'border-border-strong bg-surface-sunken' : 'border-border',
        )}
      >
        <Badge tone={sponsored ? 'ad' : 'info'} data-testid={`disclosure-${item.id}`}>
          {disclosureLabel(item.source)}
        </Badge>
        <span className="text-sm text-content-muted">{disclosureDetail(item.source)}</span>
        <time
          dateTime={item.publishedAt.toISOString()}
          className="ml-auto text-xs text-content-muted"
        >
          {dateFmt.format(item.publishedAt)}
        </time>
      </div>

      {/* --- Medien-Header: Video ODER Galerie, nie beides (media.ts) --- */}
      {video && <VideoPlayer item={video} className="rounded-none border-x-0 border-t-0" />}
      {!video && pictures.length > 0 && (
        <div className="relative">
          <MediaCarousel
            items={pictures}
            label={`Bilder zum Beitrag: ${item.headline}`}
            className="rounded-none border-x-0 border-t-0"
          />
        </div>
      )}

      <div className="p-5">
        <h2 id={`${item.id}-headline`} className="text-2xl font-bold text-balance text-content">
          {item.headline}
        </h2>
        <p className="mt-1 text-xs text-content-muted">
          Lesezeit etwa {item.readMinutes} {item.readMinutes === 1 ? 'Minute' : 'Minuten'}
        </p>

        <p className="mt-3 max-w-measure text-lg font-medium text-content">{item.teaser}</p>
        <p className="mt-3 max-w-measure text-content">{item.body}</p>

        {/* --- Shoppable Overlay: nur kaufbare Klassen --- */}
        {shoppable.length > 0 && (
          <section
            aria-label="Im Beitrag markierte Produkte"
            data-testid={`shoppable-${item.id}`}
            className="mt-5 rounded-lg border border-action/40 bg-action-subtle p-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-content">
              Im Beitrag markiert
            </h3>
            <div className="mt-3 grid gap-3">
              {shoppable.map((product) => (
                <ShoppableTag key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* --- Rx-Zweig: erscheint, wird aber nie zum Kauf angeboten --- */}
        {informational.length > 0 && (
          <section
            aria-label="Im Beitrag erwähnte verschreibungspflichtige Arzneimittel"
            data-testid={`informational-${item.id}`}
            className="mt-5 grid gap-3"
          >
            {informational.map((product) => (
              <ShoppableTag key={product.id} product={product} />
            ))}
          </section>
        )}

        {/* --- Belege --- */}
        {sourceChips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-content-muted">Quellen:</span>
            {sourceChips.map((url) => (
              <SourceChip key={url} url={url} />
            ))}
          </div>
        )}
      </div>

      {/* --- Interaktion --- */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-sunken px-5 py-3">
        <ReactionBar targetId={item.id} summary={summary} onReact={onReact} />
        <a
          href={`#kommentare-${item.id}`}
          data-testid={`comment-link-${item.id}`}
          className={cn(
            'inline-flex min-h-touch items-center rounded px-4',
            'border border-border-strong bg-surface text-sm font-semibold text-content no-underline',
            'hover:bg-surface-sunken',
            'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
          )}
        >
          {commentCount === 0
            ? 'Kommentieren'
            : `${commentCount} ${commentCount === 1 ? 'Kommentar' : 'Kommentare'}`}
        </a>
      </footer>
    </article>
  )
}
