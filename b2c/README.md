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

## Was hier schon läuft — ohne `npm install`

Die Qualitäts-Gates sind bewusst abhängigkeitsfrei gebaut. Sie laufen mit purem
Node 22 und sind damit **jetzt** ausführbar, nicht erst nach dem Aufsetzen von
Next.js:

```bash
npm run verify          # alle drei Gates nacheinander
npm run check:tokens    # Design-Drift: tokens.css == tokens.mjs ?
npm run check:contrast  # WCAG 2.1 AA über alle Token-Paarungen, beide Themes
npm test                # Compliance-Wächter (node --experimental-strip-types)
```

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
│  ├─ styles/
│  │  ├─ tokens.mjs          ← EINZIGE QUELLE DER WAHRHEIT für Farben
│  │  ├─ tokens.css          ← erzeugt, nicht bearbeiten
│  │  └─ globals.css
│  ├─ lib/
│  │  ├─ product.ts          ← typsichere Rx-Sperre
│  │  └─ cn.ts
│  └─ components/ui/
│     ├─ Button.tsx          ← 48px Touch-Target auch in „sm"
│     ├─ Badge.tsx           ← ohne „urgency"-Variante (§ 11 HWG)
│     ├─ ShoppableTag.tsx    ← Kauf ODER Rx-Info, nie beides
│     ├─ VerifiedBadge.tsx   ← verfällt automatisch
│     ├─ PflichttextBlock.tsx
│     └─ SourceChip.tsx      ← zeigt die Domain, nicht nur „Quelle"
├─ test/compliance.test.ts
└─ tools/
   ├─ build-tokens.mjs
   └─ check-contrast.mjs
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

## Noch offen

Das Next.js-Gerüst (App Router, Layout, Routen) ist **noch nicht** aufgesetzt —
`package.json` deklariert die Abhängigkeiten, aber es wurde bewusst kein
`npm install` ausgeführt und keine Seite gebaut. Erst wenn entschieden ist, ob
dieser Track ein eigenes Repository bekommt, lohnt sich das Gerüst; die hier
gebauten Gates und Komponenten sind davon unabhängig und wandern unverändert mit.
