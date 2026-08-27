// ============================================================================
//  News- und Sponsoring-Beiträge
// ============================================================================
//  Die Kennzeichnung „Anzeige" ist hier KEIN boolesches Feld, das man vergessen
//  kann, sondern die Fallunterscheidung des Typs selbst:
//
//    { kind: 'fach_news',  outlet, outletUrl }
//    { kind: 'sponsoring', advertiser, advertiserUrl, ... }
//
//  Ein bezahlter Beitrag OHNE benannten Auftraggeber ist damit nicht
//  konstruierbar. Das Trennungsgebot (§ 6 Abs. 1 Nr. 1 TMG, § 22 MStV) verlangt
//  genau das: Werbung muss als solche erkennbar und der Auftraggeber
//  identifizierbar sein. Ein `isSponsored: boolean` hätte dieselbe Regel zu
//  einer Bitte an die Entwickler:in gemacht.
// ============================================================================

import { assertMediaSetValid, type MediaItem } from './media.ts'
import { assertTaggable, ComplianceError, type Product } from './product.ts'

export type NewsSource =
  | {
      kind: 'fach_news'
      /** Redaktion/Quelle, aus deren Feed der Beitrag automatisch stammt. */
      outlet: string
      outletUrl: string
    }
  | {
      kind: 'sponsoring'
      /** Auftraggeber im Klartext — Pflicht, nicht optional. */
      advertiser: string
      advertiserUrl: string
    }

export interface NewsItem {
  id: string
  source: NewsSource
  headline: string
  teaser: string
  body: string
  /** Hero-Bild(er) oder Video. Leere Liste ist zulässig, aber die Ausnahme. */
  media: MediaItem[]
  /** Produkte für das Shoppable Overlay. Rx wird hier abgewiesen. */
  productIds: string[]
  /** Belege für Gesundheitsaussagen. */
  sourceUrls: string[]
  publishedAt: Date
  /** Geschätzte Lesezeit in Minuten — hilft beim Einordnen vor dem Klick. */
  readMinutes: number
}

/** Beschriftung des Kennzeichnungs-Badges. Klartext, keine Abkürzung. */
export function disclosureLabel(source: NewsSource): string {
  return source.kind === 'sponsoring' ? 'Anzeige' : 'Fach-News'
}

/** Zeile unter der Kennzeichnung: wer steckt dahinter? */
export function disclosureDetail(source: NewsSource): string {
  return source.kind === 'sponsoring'
    ? `Bezahlter Beitrag von ${source.advertiser}`
    : `Automatisch übernommen von ${source.outlet}`
}

export function attributionUrl(source: NewsSource): string {
  return source.kind === 'sponsoring' ? source.advertiserUrl : source.outletUrl
}

/**
 * Torwächter vor der Anzeige eines News-Beitrags.
 *
 * Prüft beides, was hier schiefgehen kann:
 *  1. Medien zugänglich (alt-Texte, Untertitel) — media.ts
 *  2. Kein verschreibungspflichtiges Produkt im Shoppable Overlay — product.ts
 *
 * Der zweite Punkt ist der kritische: ein automatisch eingespielter Feed kann
 * jederzeit ein Rx-Produkt mitliefern. Ohne diese Prüfung entstünde
 * Publikumswerbung für ein Rx-Arzneimittel (§ 10 HWG) — vollautomatisch.
 */
export function assertNewsPublishable(
  item: NewsItem,
  resolveProduct: (id: string) => Product | undefined,
): void {
  assertMediaSetValid(item.media, 'post')

  for (const id of item.productIds) {
    const product = resolveProduct(id)
    if (!product) {
      throw new ComplianceError(
        'product_unknown',
        `Beitrag "${item.headline}" verweist auf unbekanntes Produkt ${id}.`,
      )
    }
    // Wirft bei Rx und bei Arzneimitteln ohne Pflichtangaben.
    assertTaggable(product)
  }
}

/**
 * Trennt die Produkte eines Beitrags in „darf ins Kauf-Overlay" und
 * „darf nur als Information erscheinen".
 *
 * Anders als `assertNewsPublishable` wirft diese Funktion NICHT: sie wird beim
 * Rendern benutzt, wo ein Rx-Produkt im Beitrag ein zulässiger, normaler Fall
 * ist — es wandert dann in den Informations-Zweig statt in das Overlay.
 */
export function splitTaggableProducts(
  productIds: readonly string[],
  resolveProduct: (id: string) => Product | undefined,
): { shoppable: Product[]; informational: Product[] } {
  const shoppable: Product[] = []
  const informational: Product[] = []

  for (const id of productIds) {
    const product = resolveProduct(id)
    if (!product) continue
    try {
      assertTaggable(product)
      shoppable.push(product)
    } catch {
      informational.push(product)
    }
  }

  return { shoppable, informational }
}
