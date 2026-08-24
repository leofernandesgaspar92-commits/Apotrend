// ============================================================================
//  Produktmodell — die rechtliche Kernregel als TYP
// ============================================================================
//  Verschreibungspflichtige Arzneimittel dürfen Laien gegenüber weder beworben
//  (§ 10 HWG) noch außerhalb der Verordnung abgegeben werden (§ 48 AMG).
//
//  Statt diese Regel per Code-Review zu bewachen, ist sie hier so modelliert,
//  dass ein Kauf-Pfad für Rx-Produkte GAR NICHT AUSDRÜCKBAR ist:
//  `RxProduct` besitzt weder Preis noch Warenkorb-Funktion. Ein Aufruf von
//  `product.priceCents` auf einem nicht eingegrenzten `Product` ist ein
//  Compile-Fehler — nicht ein Bug, der erst in Produktion auffällt.
//
//  Diese Ebene ist die erste von drei (siehe compliance-constraints.sql):
//    1. Typ-Ebene     — hier: nicht formulierbar
//    2. Service-Ebene — assertShoppable(): wirft bei Fremddaten
//    3. DB-Ebene      — CHECK-Constraints: nicht speicherbar
// ============================================================================

/** Produktklassen. Die Unterscheidung steuert Darstellung UND Verfügbarkeit. */
export const PRODUCT_CLASSES = [
  'otc_arzneimittel',
  'rx_arzneimittel',
  'medizinprodukt',
  'nahrungsergaenzung',
  'kosmetik',
  'sonstiges',
] as const

export type ProductClass = (typeof PRODUCT_CLASSES)[number]

/** Klassen, für die ein Kauf-Pfad überhaupt existieren darf. */
export type ShoppableClass = Exclude<ProductClass, 'rx_arzneimittel'>

interface ProductBase {
  id: string
  slug: string
  name: string
  manufacturer?: string
  imageUrl?: string
  imageAlt: string // Pflicht — Barrierefreiheit, kein optionales Nice-to-have
}

/**
 * Kaufbares Produkt. Nur diese Variante trägt Preis und Warenkorb-Aktion.
 */
export interface ShoppableProduct extends ProductBase {
  productClass: ShoppableClass
  priceCents: number
  currency: 'EUR' | 'CHF'
  /** Pflichtangaben nach § 4 HWG — bei Arzneimitteln zwingend belegt. */
  pflichttext: string | null
  inStock: boolean
}

/**
 * Verschreibungspflichtiges Arzneimittel. BEWUSST ohne `priceCents`,
 * ohne `currency`, ohne Bestand — nicht vergessen, sondern unmöglich gemacht.
 */
export interface RxProduct extends ProductBase {
  productClass: 'rx_arzneimittel'
  /** Reine Fachinformation, keine Bewerbung. */
  infoUrl: string
  /** Weg zur Einlösung — kein Kauf. */
  prescriptionFlow: 'upload' | 'erezept'
}

export type Product = ShoppableProduct | RxProduct

// --- Eingrenzung ------------------------------------------------------------

export function isRx(product: Product): product is RxProduct {
  return product.productClass === 'rx_arzneimittel'
}

export function isShoppable(product: Product): product is ShoppableProduct {
  return product.productClass !== 'rx_arzneimittel'
}

/** Arzneimittel — für diese Klassen ist der Pflichttext verpflichtend. */
export function isArzneimittel(productClass: ProductClass): boolean {
  return productClass === 'otc_arzneimittel' || productClass === 'rx_arzneimittel'
}

// --- Laufzeit-Absicherung ---------------------------------------------------
//  Typen verschwinden beim Kompilieren. Sobald Daten von außen kommen (API,
//  Datenbank, Formular), braucht es eine echte Prüfung — sonst wäre die
//  Typsicherheit an der Systemgrenze wertlos.

export class ComplianceError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ComplianceError'
    this.code = code
  }
}

/**
 * Torwächter vor jedem Kauf-Pfad (Warenkorb, Checkout, Shoppable Tag).
 * Wirft, statt stillschweigend etwas Unzulässiges durchzulassen.
 */
export function assertShoppable(product: Product): asserts product is ShoppableProduct {
  if (isRx(product)) {
    throw new ComplianceError(
      'rx_not_shoppable',
      `Verschreibungspflichtiges Arzneimittel "${product.name}" darf nicht ` +
        'zum Kauf angeboten werden (§ 48 AMG, § 10 HWG).',
    )
  }
  if (isArzneimittel(product.productClass) && !product.pflichttext) {
    throw new ComplianceError(
      'pflichttext_missing',
      `Arzneimittel "${product.name}" ohne Pflichtangaben nach § 4 HWG.`,
    )
  }
}

/**
 * Darf dieses Produkt in einem Beitrag als Shoppable Tag erscheinen?
 * Publikumswerbung für Rx ist unzulässig (§ 10 HWG) — deshalb dieselbe Sperre
 * wie beim Warenkorb, nicht nur eine schwächere Empfehlung.
 */
export function assertTaggable(product: Product): asserts product is ShoppableProduct {
  assertShoppable(product)
}
