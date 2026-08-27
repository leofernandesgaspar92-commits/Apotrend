// ============================================================================
//  Demo-Daten für News, Reaktionen, Kommentare und den GIF-Picker
// ============================================================================
//  Die Medien-URLs zeigen auf public/media — echte Dateien, erzeugt von
//  tools/make-demo-media.mjs. Nichts hier ist eine Attrappe: die Bilder laden,
//  die GIFs animieren, die Untertiteldatei ist gültiges WebVTT.
// ============================================================================

import type { GifMedia, MediaItem } from './media.ts'
import type { NewsItem } from './news.ts'
import { seedComments, type Comment } from './comments.ts'
import { createReactionStore, toggleReaction, type ReactionStore } from './reactions.ts'

// --- News- und Sponsoring-Beiträge ------------------------------------------

export const newsItems: NewsItem[] = [
  {
    id: 'news-1',
    source: {
      kind: 'fach_news',
      outlet: 'BfArM-Mitteilungen',
      outletUrl: 'https://www.bfarm.de/DE/Arzneimittel/_node.html',
    },
    headline: 'Ibuprofen: Höchstdosis in der Selbstmedikation bleibt bei 1.200 mg',
    teaser:
      'Das BfArM bestätigt die Obergrenze für die Anwendung ohne ärztliche Verordnung. ' +
      'Für Dauer und Abstand der Einnahme gelten unveränderte Empfehlungen.',
    body:
      'Für Erwachsene in der Selbstmedikation gilt weiterhin eine Tageshöchstdosis von ' +
      '1.200 mg, verteilt auf drei Einzelgaben mit mindestens sechs Stunden Abstand. Ohne ' +
      'ärztliche Rücksprache sollte die Anwendung bei Schmerzen vier Tage und bei Fieber ' +
      'drei Tage nicht überschreiten. Wer gerinnungshemmende Mittel, ACE-Hemmer oder ' +
      'Diuretika einnimmt, bespricht die Anwendung vorab in der Apotheke.',
    media: [
      {
        kind: 'image',
        id: 'm-blister',
        url: '/media/hero-blister.svg',
        width: 1200,
        height: 675,
        alt: 'Tablettenblister mit zehn einzeln verschweißten Tabletten',
        caption: 'Einzeldosen im Blister — der Abstand zwischen den Gaben zählt.',
      },
    ],
    productIds: ['prod-ibu'],
    sourceUrls: ['https://www.bfarm.de/DE/Arzneimittel/_node.html'],
    publishedAt: new Date('2026-08-26T08:15:00Z'),
    readMinutes: 2,
  },
  {
    id: 'news-2',
    source: {
      kind: 'sponsoring',
      advertiser: 'Nordsee Pharma GmbH',
      advertiserUrl: 'https://www.example-nordsee-pharma.de/',
    },
    headline: 'Nasenspray richtig anwenden — vier Schritte im Kurzvideo',
    teaser:
      'Die häufigsten Anwendungsfehler kosten Wirkung: zu kräftig hochziehen, ' +
      'falsche Kopfhaltung, ungereinigte Sprühöffnung.',
    body:
      'Vor der ersten Anwendung wird die Pumpe mehrfach betätigt, bis ein feiner Nebel ' +
      'entsteht. Der Kopf bleibt aufrecht, das Gegenstück wird leicht zugehalten, und beim ' +
      'Sprühen wird ruhig durch die Nase eingeatmet — nicht kräftig hochgezogen, weil die ' +
      'Lösung sonst am Wirkort vorbeiläuft. Nach Gebrauch wird die Sprühöffnung abgewischt.',
    media: [
      {
        kind: 'video',
        id: 'm-anwendung',
        url: '/media/anwendung.mp4',
        mimeType: 'video/mp4',
        width: 720,
        height: 1280,
        posterUrl: '/media/poster-anwendung.svg',
        posterAlt: 'Videovorschau: Anleitung zur Anwendung eines Nasensprays',
        durationSec: 18,
        captionsUrl: '/media/anwendung.vtt',
        transcript:
          'Vor der ersten Anwendung die Pumpe mehrmals betätigen, bis ein feiner Nebel ' +
          'entsteht. Den Kopf aufrecht halten und ein Nasenloch leicht zuhalten. Beim ' +
          'Sprühen langsam durch die Nase einatmen — nicht kräftig hochziehen. Nach ' +
          'Gebrauch die Sprühöffnung abwischen und die Schutzkappe aufsetzen.',
        orientation: 'portrait',
      },
    ],
    productIds: ['prod-nasen'],
    sourceUrls: ['https://www.rki.de/'],
    publishedAt: new Date('2026-08-25T15:40:00Z'),
    readMinutes: 1,
  },
  {
    id: 'news-3',
    source: {
      kind: 'fach_news',
      outlet: 'Deutsche Gesellschaft für Ernährung',
      outletUrl: 'https://www.dge.de/',
    },
    headline: 'Vitamin D im Winterhalbjahr: Blutwert schlägt Pauschaldosis',
    teaser:
      'Zwischen Oktober und März reicht die Sonneneinstrahlung in Deutschland für die ' +
      'körpereigene Bildung nicht aus. Ob ergänzt werden sollte, klärt der Laborwert.',
    body:
      'Der Körper bildet Vitamin D unter UV-B-Einstrahlung selbst. Zwischen Oktober und ' +
      'März steht die Sonne in unseren Breiten dafür zu tief. Ob eine Ergänzung sinnvoll ' +
      'ist, lässt sich über den 25-OH-Vitamin-D-Spiegel im Blut klären. Pauschale ' +
      'Hochdosierungen ohne Messung sind nicht empfehlenswert — eine dauerhafte ' +
      'Überversorgung kann den Kalziumhaushalt belasten.',
    media: [
      {
        kind: 'image',
        id: 'm-winter',
        url: '/media/hero-winter.svg',
        width: 1200,
        height: 675,
        alt: 'Tief stehende Wintersonne über einer Hügellandschaft',
      },
      {
        kind: 'image',
        id: 'm-spray-2',
        url: '/media/hero-spray.svg',
        width: 1200,
        height: 675,
        alt: 'Nasenspray-Flasche mit angedeutetem Sprühnebel',
        caption: 'Auch trockene Schleimhäute sind ein typisches Winterthema.',
      },
      {
        kind: 'image',
        id: 'm-blister-2',
        url: '/media/hero-blister.svg',
        width: 1200,
        height: 675,
        alt: 'Tablettenblister mit zehn einzeln verschweißten Tabletten',
      },
    ],
    productIds: ['prod-d3'],
    sourceUrls: ['https://www.dge.de/'],
    publishedAt: new Date('2026-08-24T09:00:00Z'),
    readMinutes: 3,
  },
  {
    id: 'news-4',
    source: {
      kind: 'fach_news',
      outlet: 'BfArM-Mitteilungen',
      outletUrl: 'https://www.bfarm.de/DE/Arzneimittel/_node.html',
    },
    headline: 'ACE-Hemmer: Regelmäßigkeit wiegt schwerer als die Uhrzeit',
    teaser:
      'Zur abendlichen gegenüber der morgendlichen Einnahme zeigen Studien kein ' +
      'einheitliches Bild. Entscheidend bleibt die gleichbleibende Einnahme.',
    body:
      'Blutdrucksenker aus der Gruppe der ACE-Hemmer werden häufig morgens eingenommen. ' +
      'Untersuchungen zur abendlichen Einnahme kommen zu unterschiedlichen Ergebnissen; ' +
      'ein belastbarer Vorteil einer bestimmten Tageszeit ist daraus nicht abzuleiten. ' +
      'Wichtiger ist, dass die Einnahme überhaupt regelmäßig und zur gleichen Zeit ' +
      'erfolgt. Änderungen der Verordnung nur nach ärztlicher Rücksprache.',
    media: [],
    // Der entscheidende Fall: Rx-Produkt in einem AUTOMATISCH eingespielten
    // Beitrag. Es darf im Feed erscheinen — aber niemals im Kauf-Overlay.
    productIds: ['prod-rami'],
    sourceUrls: ['https://www.bfarm.de/DE/Arzneimittel/_node.html'],
    publishedAt: new Date('2026-08-23T11:20:00Z'),
    readMinutes: 2,
  },
]

export function getNewsItems(): NewsItem[] {
  return [...newsItems].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

export function getNewsItem(id: string): NewsItem | undefined {
  return newsItems.find((n) => n.id === id)
}

// --- GIF-Bibliothek ---------------------------------------------------------
//  Steht stellvertretend für die Tenor-/Giphy-Antwort. Bewusst dieselbe FORM
//  wie deren API-Ergebnis (id, Titel, Maße, Vorschau-URL), damit der Austausch
//  gegen den echten Anbieter ein Datenquellen-Wechsel ist und kein Umbau der
//  Oberfläche. Die Dateien sind selbst erzeugt — keine fremden Lizenzen.

export const gifLibrary: GifMedia[] = [
  {
    kind: 'gif',
    id: 'gif-danke',
    url: '/media/gif-danke.gif',
    width: 96,
    height: 96,
    alt: 'Winkende Hand als Dank',
    provider: 'eigene',
    title: 'Danke',
  },
  {
    kind: 'gif',
    id: 'gif-informativ',
    url: '/media/gif-informativ.gif',
    width: 96,
    height: 96,
    alt: 'Aufleuchtende Glühbirne',
    provider: 'eigene',
    title: 'Verstanden',
  },
  {
    kind: 'gif',
    id: 'gif-hilfreich',
    url: '/media/gif-hilfreich.gif',
    width: 96,
    height: 96,
    alt: 'Pulsierendes Herz',
    provider: 'eigene',
    title: 'Hilfreich',
  },
  {
    kind: 'gif',
    id: 'gif-erinnerung',
    url: '/media/gif-erinnerung.gif',
    width: 96,
    height: 96,
    alt: 'Wecker mit umlaufendem Zeiger',
    provider: 'eigene',
    title: 'Erinnerung',
  },
]

export function searchGifs(query: string): GifMedia[] {
  const q = query.trim().toLowerCase()
  if (!q) return gifLibrary
  return gifLibrary.filter(
    (g) => g.title.toLowerCase().includes(q) || g.alt.toLowerCase().includes(q),
  )
}

export function getGif(id: string): GifMedia | undefined {
  return gifLibrary.find((g) => g.id === id)
}

// --- Emoji-Auswahl ----------------------------------------------------------
//  Kuratiert statt vollständig: eine komplette Unicode-Tabelle ist für die
//  Zielgruppe unbedienbar. Gruppen mit Klartext-Überschriften, keine Reiter
//  ohne Beschriftung.

export const emojiGroups: { label: string; emojis: { char: string; name: string }[] }[] = [
  {
    label: 'Zustimmung und Dank',
    emojis: [
      { char: '👍', name: 'Daumen hoch' },
      { char: '🙏', name: 'Danke' },
      { char: '👏', name: 'Applaus' },
      { char: '❤️', name: 'Herz' },
      { char: '😊', name: 'Lächeln' },
      { char: '🎉', name: 'Feiern' },
    ],
  },
  {
    label: 'Verstehen und Nachfragen',
    emojis: [
      { char: '💡', name: 'Glühbirne' },
      { char: '❓', name: 'Fragezeichen' },
      { char: '🤔', name: 'Nachdenklich' },
      { char: '📌', name: 'Merken' },
      { char: '✅', name: 'Erledigt' },
      { char: '⚠️', name: 'Achtung' },
    ],
  },
  {
    label: 'Gesundheit und Alltag',
    emojis: [
      { char: '💊', name: 'Tablette' },
      { char: '🩺', name: 'Stethoskop' },
      { char: '🌡️', name: 'Fieberthermometer' },
      { char: '💧', name: 'Tropfen' },
      { char: '😴', name: 'Schlaf' },
      { char: '🚶', name: 'Bewegung' },
    ],
  },
]

// --- Reaktions- und Kommentar-Startbestand -----------------------------------
//  Ein leerer Feed zeigt nicht, ob die Zusammenfassung stimmt. Der Bestand ist
//  deterministisch aufgebaut, damit Tests und e2e feste Zahlen erwarten können.

export const reactionStore: ReactionStore = createReactionStore()

const SEED: [targetId: string, userId: string, type: 'like' | 'informative' | 'helpful' | 'thanks'][] =
  [
    ['news-1', 'u-01', 'informative'],
    ['news-1', 'u-02', 'informative'],
    ['news-1', 'u-03', 'informative'],
    ['news-1', 'u-04', 'helpful'],
    ['news-1', 'u-05', 'thanks'],
    ['news-2', 'u-01', 'like'],
    ['news-2', 'u-06', 'helpful'],
    ['news-3', 'u-02', 'informative'],
    ['news-3', 'u-07', 'thanks'],
    ['news-3', 'u-08', 'thanks'],
    ['news-4', 'u-03', 'informative'],
  ]

for (const [target, user, type] of SEED) toggleReaction(reactionStore, target, user, type)

const demoMediaForComment: MediaItem[] = [
  {
    kind: 'gif',
    id: 'gif-danke-c',
    url: '/media/gif-danke.gif',
    width: 96,
    height: 96,
    alt: 'Winkende Hand als Dank',
    provider: 'eigene',
    title: 'Danke',
  },
]

const t = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000)

seedComments([
  {
    id: 'c-seed-1',
    postId: 'news-1',
    parentId: null,
    authorHandle: 'linden_apotheke',
    authorName: 'Linden-Apotheke Köln',
    credential: 'pharmacy',
    body:
      'Ergänzend aus der Praxis: Wer Ibuprofen wegen Rückenschmerzen über mehrere Tage ' +
      'nimmt, sollte den Magenschutz mitbedenken. Sprechen Sie uns an, bevor Sie auf ' +
      'eigene Faust kombinieren.',
    media: [],
    createdAt: t(180),
    depth: 0,
    replyToHandle: null,
  },
  {
    id: 'c-seed-2',
    postId: 'news-1',
    parentId: 'c-seed-1',
    authorHandle: 'k_berger',
    authorName: 'Katrin Berger',
    credential: null,
    body: 'Danke, das wusste ich nicht — gilt das auch bei nur zwei Tagen Einnahme?',
    media: [],
    createdAt: t(150),
    depth: 1,
    replyToHandle: 'linden_apotheke',
  },
  {
    id: 'c-seed-3',
    postId: 'news-1',
    parentId: 'c-seed-2',
    authorHandle: 'linden_apotheke',
    authorName: 'Linden-Apotheke Köln',
    credential: 'pharmacy',
    body:
      'Bei zwei Tagen und ohne Vorerkrankung in aller Regel nicht. Kritischer wird es ' +
      'ab etwa einer Woche oder wenn zusätzlich Kortison oder Gerinnungshemmer im Spiel sind.',
    media: [],
    createdAt: t(140),
    depth: 2,
    replyToHandle: 'k_berger',
  },
  {
    id: 'c-seed-4',
    postId: 'news-1',
    parentId: 'c-seed-3',
    authorHandle: 'k_berger',
    authorName: 'Katrin Berger',
    credential: null,
    body: 'Super, danke für die schnelle Antwort!',
    media: demoMediaForComment,
    createdAt: t(130),
    depth: 3,
    replyToHandle: 'linden_apotheke',
  },
  {
    id: 'c-seed-5',
    postId: 'news-1',
    parentId: null,
    authorHandle: 'm_hoffmann',
    authorName: 'Marek Hoffmann',
    credential: 'pta',
    body:
      'Kleiner Hinweis zur Darreichungsform: Brausetabletten enthalten oft nennenswert ' +
      'Natrium. Bei Bluthochdruck lohnt der Blick auf die Packungsbeilage.',
    media: [],
    createdAt: t(90),
    depth: 0,
    replyToHandle: null,
  },
  {
    id: 'c-seed-6',
    postId: 'news-2',
    parentId: null,
    authorHandle: 'k_berger',
    authorName: 'Katrin Berger',
    credential: null,
    body: 'Das mit dem Hochziehen mache ich seit Jahren falsch. Video hat wirklich geholfen.',
    media: [],
    createdAt: t(60),
    depth: 0,
    replyToHandle: null,
  },
])

// Reaktionen auf Kommentare — dieselbe Leiste, dasselbe Modell.
toggleReaction(reactionStore, 'c-seed-1', 'u-02', 'helpful')
toggleReaction(reactionStore, 'c-seed-1', 'u-05', 'helpful')
toggleReaction(reactionStore, 'c-seed-1', 'u-09', 'thanks')
toggleReaction(reactionStore, 'c-seed-5', 'u-04', 'informative')

/** Die angemeldete Person der Demo. Steht für die echte Auth-Session. */
export const demoViewer = {
  id: 'u-viewer',
  handle: 'sie',
  displayName: 'Ihr Konto',
  credential: null as Comment['credential'],
}
