import Link from 'next/link'
import { getCart, cartTotalCents } from '@/lib/cart'
import { sessionId, removeFromCartAction } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { PflichttextBlock } from '@/components/ui/PflichttextBlock'

export const dynamic = 'force-dynamic'

const eur = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export default async function CartPage() {
  const sid = await sessionId()
  const lines = getCart(sid)
  const total = cartTotalCents(lines)

  // Pflichtangaben aller enthaltenen Arzneimittel — Snapshot vom Zeitpunkt des
  // Hinzufügens, nicht der heutige Katalogstand.
  const pflichttexte = [...new Set(lines.map((l) => l.pflichttextSnapshot).filter(Boolean))]

  return (
    <div className="mx-auto max-w-feed px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-content">Warenkorb</h1>
        <Link
          href="/feed"
          className="ml-auto min-h-touch items-center inline-flex rounded px-3 text-sm font-semibold text-care underline underline-offset-4 focus-visible:outline-none focus-visible:ring focus-visible:ring-focus"
        >
          Zurück zum Feed
        </Link>
      </header>

      <main id="inhalt">
        {lines.length === 0 ? (
          <p data-testid="cart-empty" className="rounded-lg border border-border bg-surface p-6 text-content-muted">
            Ihr Warenkorb ist leer. Im Feed finden Sie rezeptfreie Produkte mit
            Fachbeitrag.
          </p>
        ) : (
          <>
            <ul className="grid gap-3" data-testid="cart-lines">
              {lines.map((line) => (
                <li
                  key={line.productId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-content">{line.name}</p>
                    <p className="text-sm text-content-muted tabular-nums">
                      {line.quantity} &times; {eur(line.unitPriceCents)}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-content">
                    {eur(line.unitPriceCents * line.quantity)}
                  </span>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="productId" value={line.productId} />
                    <Button type="submit" variant="secondary" size="sm">
                      Entfernen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
              <span className="text-lg font-bold text-content">Summe</span>
              <span
                data-testid="cart-total"
                className="ml-auto text-2xl font-extrabold tabular-nums text-content"
              >
                {eur(total)}
              </span>
            </div>

            {pflichttexte.map((text) => (
              <PflichttextBlock key={text} text={text!} />
            ))}
          </>
        )}
      </main>
    </div>
  )
}
