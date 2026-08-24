// ============================================================================
//  Warenkorb — Service-Ebene der Rx-Sperre
// ============================================================================
//  Ebene 2 von 3 (Typ / Service / Datenbank). Hier landet jede Anfrage von
//  außen: Formular, Server Action, künftig auch die API. Deshalb wird hier
//  geprüft — nicht in der Komponente, die man umgehen kann.
// ============================================================================

import { assertShoppable, ComplianceError, type ShoppableProduct } from './product'
import { getProduct } from './data'

export interface CartLine {
  productId: string
  name: string
  productClass: ShoppableProduct['productClass']
  unitPriceCents: number
  currency: 'EUR' | 'CHF'
  quantity: number
  /** Snapshot: welcher Pflichttext galt beim Hinzufügen (Nachweispflicht) */
  pflichttextSnapshot: string | null
}

/** Steht stellvertretend für die Cart-Tabelle. Schlüssel = Sitzungs-ID. */
const carts = new Map<string, CartLine[]>()

export function getCart(sessionId: string): CartLine[] {
  return carts.get(sessionId) ?? []
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

/**
 * Legt ein Produkt in den Warenkorb.
 *
 * Wirft `ComplianceError`, wenn das Produkt verschreibungspflichtig ist oder
 * einem Arzneimittel die Pflichtangaben fehlen. Das ist kein Sonderfall,
 * sondern der Normalpfad für ungültige Eingaben — die Oberfläche zeigt die
 * Meldung an, statt sie zu verschlucken.
 */
export function addToCart(sessionId: string, productId: string, quantity = 1): CartLine[] {
  const product = getProduct(productId)
  if (!product) {
    throw new ComplianceError('product_unknown', 'Produkt nicht gefunden.')
  }

  // Der eigentliche Wächter. Nach diesem Aufruf ist `product` typseitig
  // ShoppableProduct — ein Rx-Produkt hat die Zeile bereits verlassen.
  assertShoppable(product)

  if (!product.inStock) {
    throw new ComplianceError('out_of_stock', `"${product.name}" ist derzeit nicht lieferbar.`)
  }

  const lines = [...getCart(sessionId)]
  const existing = lines.find((l) => l.productId === product.id)

  if (existing) {
    existing.quantity += quantity
  } else {
    lines.push({
      productId: product.id,
      name: product.name,
      productClass: product.productClass,
      unitPriceCents: product.priceCents,
      currency: product.currency,
      quantity,
      pflichttextSnapshot: product.pflichttext,
    })
  }

  carts.set(sessionId, lines)
  return lines
}

export function removeFromCart(sessionId: string, productId: string): CartLine[] {
  const lines = getCart(sessionId).filter((l) => l.productId !== productId)
  carts.set(sessionId, lines)
  return lines
}

export function clearCart(sessionId: string): void {
  carts.delete(sessionId)
}
