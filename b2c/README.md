# ApoPulse B2C — Design-System, Compliance-Sperren und Rich Media

> **Abgrenzung:** Greenfield-Track (Endverbraucher, Next.js 14). **Nicht** die
> bestehende B2B-App im Wurzelverzeichnis dieses Repos (Vanilla-JS-SPA,
> Zielgruppe Apotheken/Einkauf). Beide Tracks sind unabhängig; dieser Ordner ist
> so geschnitten, dass er per `git subtree split --prefix=b2c` verlustfrei in ein
> eigenes Repository ausgelagert werden kann.

Grundlagen: [`design-system.md`](../docs/architecture/design-system.md) ·
[`prisma-schema-draft.prisma`](../docs/architecture/prisma-schema-draft.prisma) ·
[`compliance-constraints.sql`](../docs/architecture/compliance-constraints.sql)

Medien-Erweiterung: [`prisma-schema-media.prisma`](../docs/architecture/prisma-schema-media.prisma) ·
[`compliance-constraints-media.sql`](../docs/architecture/compliance-constraints-media.sql)

---

## Prüfen

```bash
npm run verify          # schnelle Gates: Tokens, Kontrast, Medien, 50 Tests, Typprüfung
npm run verify:all      # zusätzlich: Build + End-to-End im echten Browser
```

Die schnellen Gates brauchen **kein** `npm install` — sie sind bewusst
abhängigkeitsfrei gebaut und laufen mit purem Node 22:

```bash
npm run check:tokens    # Design-Drift: tokens.css == tokens.mjs ?
npm run check:contrast  # WCAG 2.1 AA über alle Token-Paarungen, beide Themes
npm run check:media     # sind die Demo-Medien vorhanden?
npm test                # Compliance-, Care- und Medien-Tests
npm run typecheck       # tsc --noEmit
```

`verify:all` ist die vollständige Kette. Sie ist absichtlich zweigeteilt: die
schnellen Gates scheitern in Sekunden, der Browser-Lauf dauert Minuten — wer
zuerst das Langsame startet, wartet unnötig auf einen Tippfehler.

### End-to-End: der Server verwaltet sich selbst

```bash
npm run check:e2e         # startet Server, prüft, räumt auf  (28 + 64 Prüfungen)
npm run check:e2e:manual  # nur der Commerce-/Care-Check gegen einen laufenden Server
```

Zwei Prüfdateien laufen nacheinander gegen denselben Server:
`tools/e2e-check.mjs` (Feed, Commerce, Care) und `tools/e2e-social-check.mjs`
(Rich Media, Reaktionen, Kommentare, Editor). Nacheinander, weil beide auf
denselben In-Memory-Speicher schreiben und sich sonst die Erwartungswerte
gegenseitig verschieben würden.

`tools/with-server.mjs` sucht einen freien Port, erzeugt einen frischen
Schlüssel (`next start` läuft mit `NODE_ENV=production`, und `crypto.ts`
verweigert dort den Entwicklungsschlüssel — siehe unten), wartet auf Bereitschaft
und beendet den Server danach zuverlässig.

> Zwei echte Fehler kamen erst beim Bauen dieses Skripts heraus:
> `server.kill()` beendete nur den `npx`-Wrapper, während der eigentliche
> `next-server` weiterlief und den Port belegt hielt — deshalb `detached: true`
> plus `process.kill(-pid)` auf die ganze Prozessgruppe, mit SIGKILL als
> Nachfassen. Und `e2e-check.mjs` lud Playwright über einen absoluten
> Sandbox-Pfad; in CI hätte das scheitern müssen. Jetzt wird regulär aus
> `node_modules` aufgelöst, global nur als Rückfallebene.

### CI

`.github/workflows/b2c.yml` fährt genau diese Kette bei jeder Änderung unter
`b2c/` — pfadgefiltert, damit die bestehende B2B-App nicht ausgebremst wird und
umgekehrt. Reihenfolge wie lokal: erst die schnellen Gates, dann Build, dann
Browser-Installation und e2e. Bei Fehlschlag wird die Server-Ausgabe angehängt.

---

## Die Gates im Einzelnen

### 1. Kontrast-Gate (`tools/check-contrast.mjs`)

Prüft **34 Farbpaarungen** (17 Zusagen × 2 Themes) gegen WCAG 2.1 AA und bricht
bei Verletzung ab.

Warum eigenständig statt nur axe/Lighthouse: Diese prüfen, was auf einer
gerenderten Seite gerade *sichtbar* ist. Ein Gefahr-Badge, das nur im Fehlerfall
erscheint, wird dort nie erfasst. Hier wird die **Palette selbst** geprüft —
vollständig, in Millisekunden, ohne Browser.

> Beim ersten Lauf fand das Gate **5 echte Fehler im handentworfenen Farbschema**
> (u. a. Sekundär-Button-Rand mit 1,48:1 statt 3:1, drei Dark-Mode-Badges unter
> 4,5:1). Alle korrigiert — dokumentiert in den Kommentaren in `tokens.mjs`.

### 2. Drift-Wächter (`tools/build-tokens.mjs --check`)

`tokens.css` wird **erzeugt**, nicht gepflegt. Weicht sie von `tokens.mjs` ab,
schlägt der Build fehl. Ohne das könnte jemand eine Farbe direkt im CSS ändern —
und das Kontrast-Gate würde weiterhin die alte, geprüfte Fassung testen.

### 3. Compliance-Wächter (`test/*.test.ts`)

50 Tests auf der Laufzeit-Ebene. Die Typ-Ebene schützt den Code, den wir
schreiben; diese Tests schützen die **Systemgrenze** (API, DB, Formular), wo
Typen zur Laufzeit nicht mehr existieren.

| Datei | Umfang |
|---|---|
| `compliance.test.ts` | 8 Tests Rx-Sperre |
| `care.test.ts` | 18 Tests Art.-9-Daten, Einwilligung, Löschfristen |
| `media.test.ts` | 24 Tests Medien-Zugänglichkeit, Reaktionen, Threads |

### 4. Demo-Medien (`tools/make-demo-media.mjs --check`)

Fehlt eine erzeugte Datei, bricht der Lauf ab — statt dass der Feed erst im
Browser mit kaputten Bildern auffällt.

---

## Die Rx-Sperre in drei Ebenen

Verschreibungspflichtige Arzneimittel dürfen Laien gegenüber weder beworben
(§ 10 HWG) noch außerhalb der Verordnung abgegeben werden (§ 48 AMG).

| Ebene | Ort | Wirkung |
|---|---|---|
| **Typ** | `src/lib/product.ts` | `RxProduct` hat weder `priceCents` noch `addToCart` — ein Kauf-Pfad ist **nicht formulierbar** |
| **Laufzeit** | `assertShoppable()` / `assertTaggable()` | wirft `ComplianceError` bei Fremddaten |
| **Datenbank** | `compliance-constraints.sql` | `CHECK`-Constraints + Trigger — **nicht speicherbar** |

```ts
// Compile-Fehler, kein Laufzeit-Bug:
function buy(p: Product) {
  return p.priceCents        // ✗ existiert auf RxProduct nicht
}

// Korrekt: erst eingrenzen
function buy(p: Product) {
  assertShoppable(p)         // wirft bei Rx
  return p.priceCents        // ✓ hier ist p vom Typ ShoppableProduct
}
```

---

## Struktur

```
b2c/
├─ src/
│  ├─ app/                   ← Next.js App Router
│  │  ├─ layout.tsx          ← Themes ohne Aufblitzen, Sprungmarke
│  │  ├─ feed/page.tsx       ← Feed mit Shoppable Tags
│  │  ├─ warenkorb/page.tsx
│  │  ├─ rezept/             ← Care-Strecke (Einwilligung + Upload)
│  │  ├─ actions.ts          ← Server Actions Commerce
│  │  └─ care-actions.ts     ← Server Actions Gesundheitsdaten
│  ├─ styles/
│  │  ├─ tokens.mjs          ← EINZIGE QUELLE DER WAHRHEIT für Farben
│  │  ├─ tokens.css          ← erzeugt, nicht bearbeiten
│  │  └─ globals.css
│  ├─ lib/
│  │  ├─ product.ts          ← typsichere Rx-Sperre
│  │  ├─ media.ts            ← alt/Untertitel/Abschrift als Pflichtfelder
│  │  ├─ reactions.ts        ← geschlossener Reaktionssatz (§ 11 HWG)
│  │  ├─ comments.ts         ← Verschachtelung mit Deckel
│  │  ├─ news.ts             ← Kennzeichnung als Typ, nicht als Boolean
│  │  ├─ posts.ts            ← UGC + Prüfung eingehender Anlagen
│  │  ├─ cart.ts             ← prüft assertShoppable an der Systemgrenze
│  │  ├─ consent.ts          ← granular, versioniert, widerrufbar
│  │  ├─ crypto.ts           ← AES-256-GCM mit keyVersion
│  │  ├─ prescription.ts     ← Löschfristen, E-Rezept gesperrt
│  │  ├─ data.ts
│  │  └─ cn.ts
│  └─ components/
│     ├─ feed/
│     │  ├─ PostCard.tsx
│     │  ├─ NewsFeedCard.tsx ← News/Anzeige, Rich Media, Shoppable Overlay
│     │  └─ ReactionBar.tsx  ← Klick statt Hover, Namen statt nur Emoji
│     ├─ media/
│     │  ├─ MediaCarousel.tsx ← sichtbare Bedienung, keine Wischgeste allein
│     │  ├─ VideoPlayer.tsx   ← kein Autoplay, Untertitel an, Abschrift daneben
│     │  └─ AudioNote.tsx     ← Wellenform als Anzeige, Regler als Bedienung
│     ├─ post/
│     │  ├─ CreatePostModal.tsx ← erzwingt Bildbeschreibungen
│     │  ├─ EmojiPicker.tsx     ← kuratiert, jedes Zeichen benannt
│     │  └─ GifPicker.tsx       ← eigene Bibliothek, Tenor/Giphy vorbereitet
│     ├─ comments/
│     │  ├─ CommentSection.tsx  ← Thread mit Deckel bei Ebene 3
│     │  ├─ CommentComposer.tsx
│     │  └─ ReplyToggle.tsx
│     ├─ care/ConsentGate.tsx  ← nichts vorangekreuzt (EuGH Planet49)
│     └─ ui/
│        ├─ Button.tsx       ← 48px Touch-Target auch in „sm"
│        ├─ Badge.tsx        ← ohne „urgency"-Variante (§ 11 HWG)
│        ├─ ShoppableTag.tsx ← Kauf ODER Rx-Info, nie beides
│        ├─ VerifiedBadge.tsx ← verfällt automatisch
│        ├─ AddToCartForm.tsx
│        ├─ PflichttextBlock.tsx
│        └─ SourceChip.tsx   ← zeigt die Domain, nicht nur „Quelle"
├─ public/media/             ← erzeugt von tools/make-demo-media.mjs
├─ test/
│  ├─ compliance.test.ts     ← 8 Tests Rx-Sperre
│  ├─ care.test.ts           ← 18 Tests Art.-9-Daten
│  └─ media.test.ts          ← 24 Tests Medien, Reaktionen, Threads
└─ tools/
   ├─ build-tokens.mjs       ← erzeugt tokens.css, --check als Drift-Wächter
   ├─ check-contrast.mjs     ← WCAG-Rechner, abhängigkeitsfrei
   ├─ make-demo-media.mjs    ← SVGs + echte animierte GIFs (eigener LZW-Encoder)
   ├─ with-server.mjs        ← Server-Lebenszyklus für e2e
   ├─ e2e-check.mjs          ← 28 Prüfungen: Commerce + Care
   └─ e2e-social-check.mjs   ← 64 Prüfungen: Rich Media
```

---

## Bewusste Entwurfsentscheidungen

- **Kein `UrgencyBadge`.** Angstwerbung ist nach § 11 HWG unzulässig. Was das
  System nicht anbietet, kann auch nicht versehentlich an einem Arzneimittel
  landen — Compliance über Nichtverfügbarkeit statt über Disziplin.
- **`Button size="sm"` bleibt 48 px hoch.** „sm" reduziert nur die Innenabstände.
  Kleinere Trefferflächen sind für die Kernzielgruppe nicht vertretbar.
- **`IconButton.label` ist Pflicht**, nicht optional.
- **`imageAlt` ist Pflicht** im Produktmodell — Barrierefreiheit als Datenfeld,
  nicht als Erinnerung an die Entwickler:in.
- **`VerifiedBadge` rendert `null` nach Ablauf.** Ein stillschweigend
  weiterlaufendes Prüfsiegel wäre irreführend.
- **Keine feste `html { font-size }`.** Die Browser-Einstellung der Nutzer:in
  gewinnt — der wichtigste einzelne a11y-Hebel für die Zielgruppe 50+.

---

## Care-Strecke (Teil 3) — Art.-9-Daten

### Betriebsvoraussetzung: echter Schlüssel

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# -> APOPULSE_HEALTH_KEY_V1 setzen (siehe .env.example)
```

Ohne diesen Schlüssel **startet die Verarbeitung in Produktion nicht**. Das ist
Absicht: Ein Entwicklungsschlüssel, der unbemerkt in Produktion landet, ist
schlimmer als gar keine Verschlüsselung — er erzeugt ein falsches
Sicherheitsgefühl. Beim ersten e2e-Lauf hat genau diese Sperre ausgelöst
(`next start` läuft mit `NODE_ENV=production`) und den Upload mit 500
abgewiesen, bis ein Schlüssel gestellt wurde.

`keyVersion` liegt an jedem Datensatz — Schlüsselrotation ist damit möglich,
**ohne** bestehende Daten zu migrieren.

### Was die Tests zusichern (18 Tests in `test/care.test.ts`)

| Bereich | Zusage |
|---|---|
| Verschlüsselung | AES-256-GCM; manipulierter Ciphertext **und** manipuliertes Auth-Tag werden erkannt; gleicher Klartext ergibt verschiedene Ciphertexte |
| IP-Nachweis | wird nur gehasht gespeichert, nie im Klartext |
| Einwilligung | granular je Zweck · Widerruf wirkt sofort · **überholte Textfassung gilt nicht mehr** · Historie wird angehängt, nie überschrieben |
| Koppelungsverbot | Aufzeichnung ist als freiwillig deklariert und blockiert die Leistung nicht |
| Rezept | ohne Einwilligung wird das Dokument **nicht einmal gelesen** · Fremdzugriff abgewiesen · Ziel-Apotheke darf |
| Datenminimierung | nach Einlösung ist das Dokument sofort weg, der Vorgang bleibt · Aufräum-Job löscht nur Abgelaufenes |
| E-Rezept | ohne gematik-Zulassung gesperrt — nicht „halb gebaut" |

### Was die Oberfläche zusichert (e2e)

- Kästchen sind **nicht vorangekreuzt** (EuGH *Planet49*)
- Freiwillige Einwilligung allein schaltet **nicht** frei
- Ablehnen ist genauso erreichbar wie Zustimmen — kein Dark Pattern
- **Veralteter Tab nach Widerruf:** Der Server lehnt den Upload trotzdem ab —
  die Sperre hängt nicht an der Oberfläche

### Bewusst NICHT gebaut

- **Videosprechstunde.** Das Modell (`Consultation`, Wartezimmer, Aufzeichnungs-
  Einwilligung) steht im Prisma-Entwurf, die Umsetzung braucht aber einen
  Anbieter-Vertrag (Daily.co EU-Region + AVV) und eine Entscheidung zu P2P+E2EE
  vs. SFU. Eine Attrappe zu bauen, die aussieht wie eine sichere Sprechstunde,
  wäre hier das falsche Signal.
- **Datei-Upload.** Der Demo-Stand nimmt Text statt Bilddatei entgegen; der Weg
  durch Einwilligung, Verschlüsselung und Löschfrist ist derselbe. Echter Upload
  braucht Objektspeicher mit signierten URLs und Virenprüfung.

---

## Rich Media — Feed, Editor, Kommentare, Reaktionen

### Barrierefreiheit ist ein Typ, kein guter Vorsatz

`src/lib/media.ts` modelliert Medien wie `product.ts` die Rx-Sperre: Was
zwingend ist, wird zum Pflichtfeld statt zur Bitte.

| Regel | Ort | Wirkung |
|---|---|---|
| `alt` bei Bild und GIF | `ImageMedia.alt: string` | kein `alt?` — nicht weglassbar |
| Video ohne Untertitel **und** ohne Abschrift | `assertPublishable` | wird abgewiesen (WCAG 1.2.2) |
| Öffentliche Sprachnachricht ohne Abschrift | `assertPublishable` | wird abgewiesen (WCAG 1.2.1) |
| Sprachnachricht in der Direktnachricht | `context: 'direct'` | erlaubt, aber als „ohne Abschrift" markiert |
| Video **und** Bildergalerie zusammen | `assertMediaSetValid` | abgewiesen — zwei konkurrierende Blickfänge |
| Alles davon in der Datenbank | `compliance-constraints-media.sql` | CHECK-Constraints + Trigger |

Der Beitrags-Editor macht diese Zusage sichtbar: **Ein Bild ohne Beschreibung
lässt sich nicht absenden.** Der Knopf ist gesperrt, und daneben steht
namentlich, was fehlt („Bildbeschreibung für Anhang 1"). Ein Editor, der Bilder
ohne Beschreibung durchreicht, würde das Pflichtfeld zur Fiktion machen.

### Die Kennzeichnung von Werbung ist kein Boolean

```ts
export type NewsSource =
  | { kind: 'fach_news';  outlet: string;     outletUrl: string }
  | { kind: 'sponsoring'; advertiser: string; advertiserUrl: string }
```

Ein bezahlter Beitrag **ohne benannten Auftraggeber ist nicht konstruierbar**
(§ 6 Abs. 1 Nr. 1 TMG, § 22 MStV). In der Datenbank entspricht dem eine eigene
Tabelle `PostSponsorship`; `Post.isSponsored` wird daraus per Trigger abgeleitet
und lässt sich nicht von Hand setzen.

### Der gefährlichste Fall: Rx in einem automatischen Feed

Ein eingespielter News-Beitrag kann jederzeit ein verschreibungspflichtiges
Produkt mitliefern. Ohne Sperre entstünde daraus **vollautomatische
Publikumswerbung** für ein Rx-Arzneimittel (§ 10 HWG).

`splitTaggableProducts` trennt deshalb vor dem Rendern: kaufbare Produkte gehen
ins Shoppable Overlay, verschreibungspflichtige in den Informations-Zweig — kein
Preis, kein Warenkorb. Der e2e-Lauf prüft das am echten DOM (`news-4`).

### Reaktionen: bewusst ein geschlossener Satz

👍 Gefällt mir · 💡 Informativ · ❤️ Hilfreich · 👏 Danke

Keine freie Emoji-Auswahl. § 11 Abs. 1 Nr. 11 HWG untersagt in der
Publikumswerbung für Arzneimittel Äußerungen Dritter mit Empfehlungscharakter —
eine offene Reaktionsleiste unter einem Arzneimittel-Beitrag erzeugt genau das,
massenhaft und unmoderierbar. Die vier Reaktionen bewerten den **Beitrag**, nicht
die Wirkung eines Präparats.

Weitere Abweichungen vom Vorbild, alle absichtlich:

- **Öffnen per Klick, nicht per Überfahren.** Das Hover-Popup ist auf
  Touch-Geräten nicht bedienbar und bei unruhiger Hand eine Zufallsauswahl.
- **Jede Reaktion trägt ihren Namen.** „💡" heißt nicht für jede:n „informativ".
- **Klartext-Zähler** („7× Informativ") statt gestapelter Mini-Icons.

### Karussell ohne versteckte Gesten

Sichtbare Vor-/Zurück-Schaltflächen mit 48 px Trefferfläche, Zähler in Klartext
(„Bild 2 von 3"), anspringbare Punkte. Wischen funktioniert zusätzlich, ist aber
nie der einzige Weg.

### Verschachtelung mit Deckel

Antworten werden bis Ebene 3 eingerückt. Danach hängen sie auf derselben Ebene
und tragen „Antwort an @handle" — auf 390 px Breite ist das der Unterschied
zwischen lesbar und einer Spalte aus zwei Wörtern. Die Tiefe wird **berechnet**,
nie vom Client übernommen (auch im DB-Trigger).

### Demo-Medien: erzeugt, nicht geliehen

`npm run media` erzeugt alles unter `public/media` selbst — SVG-Grafiken, echte
animierte GIF89a-Dateien (eigener LZW-Encoder in `tools/make-demo-media.mjs`)
und eine gültige WebVTT-Untertiteldatei. Kein Fremdmaterial mit unklarer Lizenz
im Repo. Der e2e-Lauf ruft `img.decode()` auf jedem GIF auf — ein fehlerhafter
Encoder fiele dort auf.

> **Ehrliche Grenze:** Für `anwendung.mp4` gibt es **keine Videodatei**. Diese
> Umgebung hat keinen Encoder, und einen MP4-Bytestrom von Hand zu erfinden wäre
> unseriös. Der Player ist vollständig gebaut und wird über Poster, Untertitel-
> spur, Abschrift und Bedienelemente geprüft; beim Abspielversuch greift der
> Rückfall auf Standbild + Abschrift. Dieser Rückfall ist keine Notlösung für
> die Demo — eine nicht ladende Videodatei kommt in Produktion vor.

### Übertragung von Uploads

Die Demo schickt Bilder als Data-URL im Formular mit (`bodySizeLimit: 8mb` in
`next.config.mjs`, clientseitige Grenze 2 MB). Das ist **nicht** die
Produktionslösung: dort gehen Dateien per signierter URL direkt in den
Objektspeicher, mit Virenprüfung. `MEDIA_LIMITS` (12 MB pro Bild) bleibt davon
unberührt — die Demo-Grenze schützt nur den Server-Action-Body.

---

## Noch offen — Entscheidungen des Owners

Diese Punkte sind **nicht** vergessen, sondern bewusst nicht einseitig
entschieden, weil sie Verträge, Zulassungen oder Geld betreffen:

| Frage | Warum sie hier blockiert |
|---|---|
| **Eigenes Repository?** | `b2c/` ist so geschnitten, dass `git subtree split --prefix=b2c` verlustfrei geht. Solange beide Tracks hier liegen, brauchen sie getrennte CI-Pfade (ist eingerichtet). |
| **gematik-Zulassung E-Rezept** | Ohne sie bleibt `ENABLED_SOURCES` auf Papier-/Privatrezept. Der Code ist vorbereitet, aber gesperrt — nicht „halb gebaut". |
| **Marktplatz-Umfang** | Eine Bestellung über mehrere Apotheken = mehrere Kaufverträge. Das Datenmodell trennt `OrderGroup` und `Order` bereits; die Frage ist die kaufmännische, nicht die technische. |
| **Hosting / Auftragsverarbeitung** | Art.-9-Daten brauchen einen AVV und eine EU-Region. Der Schlüssel ist versioniert, Rotation also ohne Datenmigration möglich. |
| **Länder-Umfang** | Versandhandels-Erlaubnis ist national geregelt; der Trigger in `compliance-constraints.sql` erzwingt sie bereits pro Apotheke. |
| **Ärztliche Telemedizin** | Videosprechstunde ist bewusst nicht gebaut (siehe oben) — sie braucht Anbietervertrag und eine Entscheidung zu P2P+E2EE vs. SFU. |

Was **steht**: Design-System mit geprüften Kontrasten, die Rx-Sperre in drei
Ebenen, die Care-Strecke mit Einwilligung und Löschfristen, 26 Tests, 28
Browser-Prüfungen und eine CI, die alles davon bei jeder Änderung fährt.
