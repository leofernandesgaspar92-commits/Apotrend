import { cn } from '@/lib/cn'

/**
 * SourceChip — Evidenz-Anker an gesundheitsbezogenen Aussagen.
 *
 * Zeigt die DOMAIN, nicht nur „Quelle": `bfarm.de` ist für die Zielgruppe
 * sofort von einem beliebigen Blog unterscheidbar — genau das ist der Zweck.
 * (Dieselbe Erkenntnis stammt aus der B2B-App, wo die bloße Beschriftung
 * „Quelle" den Unterschied zwischen amtlich und beliebig verdeckte.)
 */

/** Amtliche/berufsständische Quellen — erhalten eine deutlichere Kennzeichnung. */
const OFFICIAL_DOMAINS = [
  'bfarm.de',
  'pei.de',
  'rki.de',
  'gematik.de',
  'abda.de',
  'ages.at',
  'basg.gv.at',
  'swissmedic.ch',
  'who.int',
  'ema.europa.eu',
]

export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function isOfficialSource(url: string): boolean {
  const domain = sourceDomain(url)
  if (!domain) return false
  return OFFICIAL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))
}

export function SourceChip({ url, className }: { url: string; className?: string }) {
  const domain = sourceDomain(url)
  if (!domain) return null
  const official = isOfficialSource(url)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        // Eigenständiges Klick-Ziel (kein Inline-Link im Fließtext) — also gilt
        // das 48-px-Prinzip. Die Chips stehen in einer eigenen Zeile, deshalb
        // wirkt die volle Trefferhöhe hier nicht schwer.
        'inline-flex min-h-touch items-center gap-1.5 rounded-pill border px-4',
        'text-xs font-semibold no-underline',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        official
          ? 'border-info-border bg-info-subtle text-info'
          : 'border-border bg-surface-sunken text-content-muted',
        className,
      )}
    >
      <span aria-hidden="true">🔗</span>
      <span className="sr-only">Quelle{official ? ' (amtlich)' : ''}: </span>
      {domain}
    </a>
  )
}
