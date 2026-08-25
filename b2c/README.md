# Apotrend B2C — Design-System (Schritt 3, Teil 1)

> **Abgrenzung:** Greenfield-Track (Endverbraucher, Next.js 14). **Nicht** die
> bestehende B2B-App im Wurzelverzeichnis dieses Repos (Vanilla-JS-SPA,
> Zielgruppe Apotheken/Einkauf). Beide Tracks sind unabhängig; dieser Ordner ist
> so geschnitten, dass er per `git subtree split --prefix=b2c` verlustfrei in ein
> eigenes Repository ausgelagert werden kann.

Grundlagen: [`../docs/architecture/design-system.md`](../docs/architecture/design-system.md) ·
[`../docs/architecture/prisma-schema-draft.prisma`](../docs/architecture/prisma-schema-draft.prisma) ·
[`../docs/architecture/compliance-constraints.sql`](../docs/architecture/compliance-constraints.sql)

---

## Prüfen

```bash
npm run verify          # schnelle Gates: Tokens, Kontrast, 26 Tests, Typprüfung
npm run verify:all      # zusätzlich: Build + End-to-End im echten Browser
```

Die schnellen Gates brauchen **kein** `npm install` — sie sind bewusst
abhängigkeitsfrei gebaut und laufen mit purem Node 22:

```bash
npm run check:tokens    # Design-Drift: tokens.css == tokens.mjs ?
npm run check:contrast  # WCAG 2.1 AA über alle Token-Paarungen, beide Themes
npm test                # Compliance- und Care-Tests (--experimental-strip-types)
npm run typecheck       # tsc --noEmit
```

`verify:all` ist die vollständige Kette. Sie ist absichtlich zweigeteilt: die
schnellen Gates scheitern in Sekunden, der Browser-Lauf dauert Minuten — wer
zuerst das Langsame startet, wartet unnötig auf einen Tippfehler.

### End-to-End: der Server verwaltet sich selbst

```bash
npm run check:e2e         # startet Server, prüft, räumt auf  (28 Prüfungen)
npm run check:e2e:manual  # nur der Check gegen einen laufenden Server
```

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

## Die drei Gates

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

### 3. Compliance-Wächter (`test/compliance.test.ts`)

Acht Tests auf der Laufzeit-Ebene der Rx-Sperre. Die Typ-Ebene schützt den Code,
den wir schreiben; diese Tests schützen die **Systemgrenze** (API, DB, Formular),
wo Typen zur Laufzeit nicht mehr existieren.

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
│  │  ├─ cart.ts             ← prüft assertShoppable an der Systemgrenze
│  │  ├─ consent.ts          ← granular, versioniert, widerrufbar
│  │  ├─ crypto.ts           ← AES-256-GCM mit keyVersion
│  │  ├─ prescription.ts     ← Löschfristen, E-Rezept gesperrt
│  │  ├─ data.ts
│  │  └─ cn.ts
│  └─ components/
│     ├─ feed/PostCard.tsx
│     ├─ care/ConsentGate.tsx  ← nichts vorangekreuzt (EuGH Planet49)
│     └─ ui/
│        ├─ Button.tsx       ← 48px Touch-Target auch in „sm"
│        ├─ Badge.tsx        ← ohne „urgency"-Variante (§ 11 HWG)
│        ├─ ShoppableTag.tsx ← Kauf ODER Rx-Info, nie beides
│        ├─ VerifiedBadge.tsx ← verfällt automatisch
│        ├─ AddToCartForm.tsx
│        ├─ PflichttextBlock.tsx
│        └─ SourceChip.tsx   ← zeigt die Domain, nicht nur „Quelle"
├─ test/
│  ├─ compliance.test.ts     ← 8 Tests Rx-Sperre
│  └─ care.test.ts           ← 18 Tests Art.-9-Daten
└─ tools/
   ├─ build-tokens.mjs       ← erzeugt tokens.css, --check als Drift-Wächter
   ├─ check-contrast.mjs     ← WCAG-Rechner, abhängigkeitsfrei
   ├─ with-server.mjs        ← Server-Lebenszyklus für e2e
   └─ e2e-check.mjs          ← 28 Browser-Prüfungen
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
# -> APOTREND_HEALTH_KEY_V1 setzen (siehe .env.example)
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
