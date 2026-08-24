// ============================================================================
//  Demo-Datenquelle
// ============================================================================
//  Steht stellvertretend für Prisma/PostgreSQL (siehe
//  docs/architecture/prisma-schema-draft.prisma). Bewusst dieselbe FORM wie das
//  echte Schema, damit der Austausch später ein Repository-Wechsel ist und kein
//  Umbau der Oberfläche.
// ============================================================================

import type { Product } from './product.ts'

export interface Author {
  handle: string
  displayName: string
  credential: 'pharmacist' | 'pharmacy' | 'pta' | 'physician'
  verifiedAt: Date
  validUntil: Date
  authority: string
}

export interface FeedPost {
  id: string
  author: Author
  kind: 'article' | 'short' | 'question'
  title?: string
  body: string
  /** Evidenz-Anker — ohne Quelle keine Gesundheitsaussage */
  sourceUrls: string[]
  /** Verknüpfte Produkte. Rx-Produkte werden als Information gerendert, nie als Kauf. */
  productIds: string[]
  isSponsored: boolean
  publishedAt: Date
}

const authors: Record<string, Author> = {
  weber: {
    handle: 'dr_weber',
    displayName: 'Dr. Anna Weber',
    credential: 'pharmacist',
    verifiedAt: new Date('2026-01-15'),
    validUntil: new Date('2027-01-15'),
    authority: 'Apothekerkammer Nordrhein',
  },
  linden: {
    handle: 'linden_apotheke',
    displayName: 'Linden-Apotheke Köln',
    credential: 'pharmacy',
    verifiedAt: new Date('2025-11-02'),
    validUntil: new Date('2026-11-02'),
    authority: 'Bezirksregierung Köln',
  },
  hoff: {
    handle: 'm_hoffmann',
    displayName: 'Marek Hoffmann',
    credential: 'pta',
    verifiedAt: new Date('2026-03-10'),
    validUntil: new Date('2027-03-10'),
    authority: 'IHK Köln',
  },
}

const PFLICHTTEXT =
  'Zu Risiken und Nebenwirkungen lesen Sie die Packungsbeilage und fragen Sie ' +
  'Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke.'

export const products: Product[] = [
  {
    id: 'prod-ibu',
    slug: 'ibuprofen-400-20st',
    name: 'Ibuprofen 400 mg, 20 Tabletten',
    manufacturer: 'Generika GmbH',
    imageAlt: 'Faltschachtel Ibuprofen 400 mg mit 20 Tabletten',
    productClass: 'otc_arzneimittel',
    priceCents: 599,
    currency: 'EUR',
    pflichttext: PFLICHTTEXT,
    inStock: true,
  },
  {
    id: 'prod-nasen',
    slug: 'meersalz-nasenspray',
    name: 'Meersalz-Nasenspray 20 ml',
    manufacturer: 'Nordsee Pharma',
    imageAlt: 'Sprühflasche Meersalz-Nasenspray 20 ml',
    productClass: 'medizinprodukt',
    priceCents: 449,
    currency: 'EUR',
    pflichttext: null,
    inStock: true,
  },
  {
    id: 'prod-d3',
    slug: 'vitamin-d3-1000',
    name: 'Vitamin D3 1000 I.E., 90 Tabletten',
    manufacturer: 'Vitalis',
    imageAlt: 'Dose Vitamin D3 1000 I.E. mit 90 Tabletten',
    productClass: 'nahrungsergaenzung',
    priceCents: 899,
    currency: 'EUR',
    pflichttext: null,
    inStock: true,
  },
  {
    id: 'prod-creme',
    slug: 'handcreme-sensitiv',
    name: 'Handcreme sensitiv 75 ml',
    manufacturer: 'Derma Care',
    imageAlt: 'Tube Handcreme sensitiv 75 ml',
    productClass: 'kosmetik',
    priceCents: 349,
    currency: 'EUR',
    pflichttext: null,
    inStock: false,
  },
  {
    // Der entscheidende Fall: taucht im Feed auf, ist aber NICHT kaufbar.
    id: 'prod-rami',
    slug: 'ramipril-5mg',
    name: 'Ramipril 5 mg, 100 Tabletten',
    manufacturer: 'Kardio Pharma',
    imageAlt: 'Faltschachtel Ramipril 5 mg',
    productClass: 'rx_arzneimittel',
    infoUrl: 'https://www.bfarm.de/DE/Arzneimittel/_node.html',
    prescriptionFlow: 'upload',
  },
]

export const posts: FeedPost[] = [
  {
    id: 'post-1',
    author: authors.weber!,
    kind: 'article',
    title: 'Schmerzmittel richtig dosieren — worauf es wirklich ankommt',
    body:
      'Bei Ibuprofen gilt für Erwachsene in der Selbstmedikation eine Tageshöchstdosis ' +
      'von 1.200 mg. Wichtig ist der Abstand von mindestens sechs Stunden zwischen den ' +
      'Einzeldosen. Wer regelmäßig blutverdünnende Mittel einnimmt, sollte die Einnahme ' +
      'vorher in der Apotheke besprechen.',
    sourceUrls: ['https://www.bfarm.de/DE/Arzneimittel/_node.html'],
    productIds: ['prod-ibu'],
    isSponsored: false,
    publishedAt: new Date('2026-08-18T09:00:00Z'),
  },
  {
    id: 'post-2',
    author: authors.linden!,
    kind: 'short',
    body:
      'Trockene Heizungsluft? Eine Nasenspülung mit isotonischer Kochsalzlösung befeuchtet ' +
      'die Schleimhaut und kann ohne Gewöhnungseffekt täglich angewendet werden — anders als ' +
      'abschwellende Sprays, die nach spätestens sieben Tagen abgesetzt werden sollten.',
    sourceUrls: ['https://www.rki.de/'],
    productIds: ['prod-nasen'],
    isSponsored: false,
    publishedAt: new Date('2026-08-18T07:30:00Z'),
  },
  {
    id: 'post-3',
    author: authors.weber!,
    kind: 'article',
    title: 'Blutdrucksenker: Warum die Einnahmezeit zählt',
    body:
      'ACE-Hemmer wie Ramipril werden häufig morgens eingenommen. Studien zur abendlichen ' +
      'Einnahme zeigen kein einheitliches Bild — entscheidend ist vor allem die regelmäßige, ' +
      'gleichbleibende Einnahme. Änderungen bitte nur nach ärztlicher Rücksprache.',
    // Rx-Produkt im Feed: Das System MUSS daraus Information machen, keinen Kauf.
    sourceUrls: ['https://www.bfarm.de/DE/Arzneimittel/_node.html'],
    productIds: ['prod-rami'],
    isSponsored: false,
    publishedAt: new Date('2026-08-17T16:00:00Z'),
  },
  {
    id: 'post-4',
    author: authors.hoff!,
    kind: 'short',
    body:
      'Im Winter deckt die Sonneneinstrahlung in unseren Breiten die Vitamin-D-Bildung nicht ' +
      'ab. Ob eine Ergänzung sinnvoll ist, lässt sich über den Blutwert klären — pauschale ' +
      'Hochdosierungen sind nicht empfehlenswert.',
    sourceUrls: ['https://www.dge.de/'],
    productIds: ['prod-d3'],
    isSponsored: true,
    publishedAt: new Date('2026-08-17T11:00:00Z'),
  },
]

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

export function getPosts(): FeedPost[] {
  return [...posts].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
