import * as React from 'react'
import { cn } from '@/lib/cn'
import { Badge } from './Badge'
import { AddToCartForm } from './AddToCartForm'
import { Button } from './Button'
import { PflichttextBlock } from './PflichttextBlock'
import {
  type Product,
  type ShoppableProduct,
  type RxProduct,
  isRx,
  isArzneimittel,
  assertTaggable,
} from '@/lib/product'

/**
 * ShoppableTag — die rechtlich kritischste Komponente des Systems.
 *
 * Sie entscheidet NICHT selbst, ob etwas kaufbar ist: das steht bereits im Typ.
 * Sie rendert lediglich das, was die Produktklasse zulässt:
 *
 *   kaufbar (OTC/Medizinprodukt/NEM/Kosmetik) -> Kauf-Aktion + ggf. Pflichttext
 *   verschreibungspflichtig                   -> Informations-Hinweis, KEIN Kauf
 *
 * Der Kauf-Zweig kann ein `RxProduct` nicht annehmen (Typ), und `assertTaggable`
 * fängt zusätzlich Daten ab, die zur Laufzeit aus einer fremden Quelle kommen.
 */

const CTA_BY_CLASS: Record<ShoppableProduct['productClass'], string> = {
  otc_arzneimittel: 'Rezeptfrei bestellen',
  medizinprodukt: 'Bestellen',
  nahrungsergaenzung: 'Bestellen',
  kosmetik: 'Bestellen',
  sonstiges: 'Bestellen',
}

function formatPrice(cents: number, currency: 'EUR' | 'CHF'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)
}

interface ShoppableTagProps {
  product: Product
  className?: string
}

export function ShoppableTag({ product, className }: ShoppableTagProps) {
  if (isRx(product)) return <RxInfoTag product={product} className={className} />
  return <BuyableTag product={product} className={className} />
}

// --- Kaufbarer Zweig --------------------------------------------------------

function BuyableTag({
  product,
  className,
}: {
  product: ShoppableProduct
  className?: string
}) {
  // Laufzeit-Netz für Daten aus API/DB: wirft bei Rx und bei fehlendem
  // Pflichttext, statt etwas Unzulässiges zu rendern.
  assertTaggable(product)

  return (
    <div
      data-product-class={product.productClass}
      className={cn(
        'rounded-lg border border-border bg-surface p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.imageAlt}
            className="h-16 w-16 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-content">{product.name}</p>
          {product.manufacturer && (
            <p className="truncate text-xs text-content-muted">{product.manufacturer}</p>
          )}
          <p className="mt-1 text-lg font-bold tabular-nums text-content">
            {formatPrice(product.priceCents, product.currency)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AddToCartForm
          productId={product.id}
          label={CTA_BY_CLASS[product.productClass]}
          inStock={product.inStock}
        />
        {isArzneimittel(product.productClass) && <Badge tone="neutral">Apothekenpflichtig</Badge>}
      </div>

      {/* § 4 HWG: Pflichtangaben stehen im Sichtbereich der Kauf-Aktion,
          nicht hinter einem Aufklapper. */}
      {product.pflichttext && <PflichttextBlock text={product.pflichttext} />}
    </div>
  )
}

// --- Verschreibungspflichtiger Zweig ---------------------------------------

/**
 * Kein Preis, kein Warenkorb, keine Empfehlung, keine Bewertung.
 * Reine Information plus Weg zur Einlösung (§ 10 HWG).
 */
function RxInfoTag({ product, className }: { product: RxProduct; className?: string }) {
  return (
    <div
      data-product-class="rx"
      className={cn(
        'rounded-lg border border-rx-border bg-rx-subtle p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{product.name}</p>
          {product.manufacturer && (
            <p className="truncate text-xs text-content-muted">{product.manufacturer}</p>
          )}
        </div>
        <Badge tone="rx">Rezeptpflichtig</Badge>
      </div>

      <p className="mt-2 text-sm text-content-muted">
        Dieses Arzneimittel ist verschreibungspflichtig und kann nicht online gekauft
        werden. Mit einem gültigen Rezept lösen Sie es in Ihrer Apotheke ein.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Link statt Button: ein <a> in einem <button> wäre ungültiges Markup
            und für Screenreader mehrdeutig. Optik über dieselben Tokens. */}
        <a
          href={product.infoUrl}
          className={cn(
            'inline-flex min-h-touch items-center justify-center rounded px-3',
            'border border-border-strong bg-surface text-sm font-semibold text-content',
            'no-underline hover:bg-surface-sunken',
            'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
          )}
        >
          Fachinformation
        </a>
        <Button variant="care" size="sm">
          {product.prescriptionFlow === 'erezept' ? 'E-Rezept einlösen' : 'Rezept einreichen'}
        </Button>
      </div>
    </div>
  )
}
