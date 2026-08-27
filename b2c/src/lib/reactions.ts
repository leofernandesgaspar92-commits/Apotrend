// ============================================================================
//  Reaktionen — bewusst ein GESCHLOSSENER Satz
// ============================================================================
//  Eine offene Emoji-Auswahl („reagiere mit beliebigem Emoji") wäre technisch
//  einfacher. Sie ist hier aber ausgeschlossen, und zwar aus einem sachlichen
//  Grund, nicht aus Geschmack:
//
//  § 11 Abs. 1 Nr. 11 HWG untersagt in der Publikumswerbung für Arzneimittel
//  Äußerungen Dritter, die einer Empfehlung gleichkommen (Laien-Testimonials).
//  Eine freie Reaktionsleiste unter einem Arzneimittel-Beitrag würde genau das
//  erzeugen — massenhaft, unmoderierbar und mit Werbewirkung.
//
//  Die vier zugelassenen Reaktionen bewerten deshalb den BEITRAG (informativ,
//  hilfreich, Dank), nicht die WIRKUNG eines Präparats. Kein „heilt mich",
//  kein Daumen hoch auf ein Medikament als Produktbewertung.
//
//  Zweiter Grundsatz: eine Reaktion pro Person und Ziel. Facebook-Verhalten —
//  eine neue Reaktion ersetzt die alte, dieselbe noch einmal nimmt sie zurück.
// ============================================================================

export const REACTION_TYPES = ['like', 'informative', 'helpful', 'thanks'] as const
export type ReactionType = (typeof REACTION_TYPES)[number]

export interface ReactionDefinition {
  type: ReactionType
  emoji: string
  /** Klartext-Beschriftung. Das Emoji ist NIE alleiniger Informationsträger. */
  label: string
  /** Was die Reaktion aussagt — als Titel/Tooltip und für Screenreader. */
  description: string
}

export const REACTIONS: readonly ReactionDefinition[] = [
  {
    type: 'like',
    emoji: '👍',
    label: 'Gefällt mir',
    description: 'Zustimmung zum Beitrag',
  },
  {
    type: 'informative',
    emoji: '💡',
    label: 'Informativ',
    description: 'Der Beitrag hat etwas erklärt',
  },
  {
    type: 'helpful',
    emoji: '❤️',
    label: 'Hilfreich',
    description: 'Der Beitrag hat konkret weitergeholfen',
  },
  {
    type: 'thanks',
    emoji: '👏',
    label: 'Danke',
    description: 'Dank an die Verfasser:in',
  },
] as const

const BY_TYPE = new Map(REACTIONS.map((r) => [r.type, r]))

export function reactionDefinition(type: ReactionType): ReactionDefinition {
  const found = BY_TYPE.get(type)
  if (!found) throw new Error(`Unbekannte Reaktion: ${type}`)
  return found
}

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && BY_TYPE.has(value as ReactionType)
}

// --- Speicher ---------------------------------------------------------------
//  Steht stellvertretend für die Tabelle `Reaction` (siehe Prisma-Entwurf).
//  Struktur bewusst identisch: (targetId, userId) ist der eindeutige Schlüssel —
//  deshalb Map<targetId, Map<userId, ReactionType>> und keine Liste.

export type ReactionStore = Map<string, Map<string, ReactionType>>

export function createReactionStore(): ReactionStore {
  return new Map()
}

export interface ReactionCount {
  type: ReactionType
  emoji: string
  label: string
  count: number
}

export interface ReactionSummary {
  total: number
  /** Nur Reaktionen mit count > 0, absteigend sortiert. */
  counts: ReactionCount[]
  /** Die eigene Reaktion — steuert den Aktiv-Zustand der Leiste. */
  own: ReactionType | null
}

/**
 * Setzt, wechselt oder entfernt die Reaktion einer Person.
 * Rückgabe ist die neue eigene Reaktion (`null` = zurückgenommen).
 */
export function toggleReaction(
  store: ReactionStore,
  targetId: string,
  userId: string,
  type: ReactionType,
): ReactionType | null {
  if (!isReactionType(type)) {
    throw new Error(`Unzulässige Reaktion: ${String(type)}`)
  }
  const forTarget = store.get(targetId) ?? new Map<string, ReactionType>()
  const previous = forTarget.get(userId)

  if (previous === type) {
    forTarget.delete(userId) // dieselbe noch einmal = zurücknehmen
  } else {
    forTarget.set(userId, type) // neue ersetzt die alte
  }

  store.set(targetId, forTarget)
  return forTarget.get(userId) ?? null
}

export function summarize(
  store: ReactionStore,
  targetId: string,
  userId: string | null,
): ReactionSummary {
  const forTarget = store.get(targetId)
  if (!forTarget || forTarget.size === 0) {
    return { total: 0, counts: [], own: null }
  }

  const tally = new Map<ReactionType, number>()
  for (const type of forTarget.values()) {
    tally.set(type, (tally.get(type) ?? 0) + 1)
  }

  const counts: ReactionCount[] = REACTIONS.filter((r) => (tally.get(r.type) ?? 0) > 0)
    .map((r) => ({
      type: r.type,
      emoji: r.emoji,
      label: r.label,
      count: tally.get(r.type) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

  return {
    total: forTarget.size,
    counts,
    own: (userId && forTarget.get(userId)) || null,
  }
}

/**
 * Klartext-Zusammenfassung für Screenreader und schmale Ansichten.
 * Beispiel: „12 Reaktionen: 7× Informativ, 5× Danke. Ihre Reaktion: Danke."
 */
export function summaryText(summary: ReactionSummary): string {
  if (summary.total === 0) return 'Noch keine Reaktionen'
  const parts = summary.counts.map((c) => `${c.count}× ${c.label}`).join(', ')
  const own = summary.own ? ` Ihre Reaktion: ${reactionDefinition(summary.own).label}.` : ''
  const word = summary.total === 1 ? 'Reaktion' : 'Reaktionen'
  return `${summary.total} ${word}: ${parts}.${own}`
}
