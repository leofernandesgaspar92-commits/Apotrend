# Apotrend B2C — Architektur & Design-System (Schritt 1/3)

> **Abgrenzung (wichtig):** Dieses Dokument beschreibt einen **Greenfield-Track**
> (Social-Commerce/Telemedizin für Endverbraucher, Next.js 14 + Prisma + Socket.io).
> Es beschreibt **nicht** die bestehende B2B-App in diesem Repo (Vanilla-JS-SPA,
> Built-ins-only-Node-Server, Zielgruppe Apotheken/Einkauf/Großhandel). Beide Tracks
> unterscheiden sich in Stack **und** Zielgruppe. Kein Code des bestehenden Produkts
> wird durch dieses Dokument verändert.

- **Stand:** Schritt 1 von 3 (Fundament) — Schritt 2 = Datenbank-Schema, Schritt 3 = Implementierung
- **Rechtsrahmen:** DSGVO (inkl. Art. 9), HWG, AMG, ApBetrO, EU-VO 1924/2006 (Health Claims)

---

## 1. UX-Synthese: Feed-Dynamik trifft pharmazeutische Seriosität

### Zielkonflikt
Social-Feeds optimieren auf **Verweildauer** (Dringlichkeit, FOMO, Endlos-Schleife).
Pharmazie optimiert auf **richtige Entscheidung** (Ruhe, Nachprüfbarkeit, Haftung).
Naiv gemischt ergibt das „TikTok-Shop mit Tabletten" — rechtlich angreifbar (HWG § 11)
und für die Kernzielgruppe 50+ abstoßend.

**Leitidee: „Ruhiger Sog" statt „Sucht-Schleife".** Engagement entsteht aus Relevanz und
Nutzen, nicht aus Manipulation.

### Sechs Konstruktionsprinzipien

#### 1. Drei-Ebenen-Trennung (Inhalt / Handel / Versorgung)
Rechtlich erzwungen, deshalb auch visuell erzwungen — jede Ebene hat eigene „Temperatur":

| Ebene | Inhalt | Visuelle Sprache | Erlaubte Muster |
|---|---|---|---|
| **1 — Inhalt** | Feed, Lives, Kurzformate, Wissen | warm, lebendig, Person im Vordergrund | Reaktionen, Folgen, Teilen |
| **2 — Handel** | OTC, Medizinprodukt, NEM, Kosmetik | klar, aktivierend, Grün | Shoppable Tag, Warenkorb, Preis |
| **3 — Versorgung** | Rx-Info, Rezept, Video-Sprechstunde | ruhig, sachlich, Indigo/Blau | Formular, Beleg, Termin — **keine** Werbesprache |

Ebene 3 sieht bewusst *nicht* nach Shop aus: kein Preis, kein Rabatt, kein Countdown.

#### 2. Person vor Produkt
Jeder Inhalt ist einer **verifizierten Person** zugeordnet (Name, Approbation, Apotheke).
Der Mensch ist der Vertrauensanker — das unterscheidet die Optik von anonymem
Affiliate-Content.

#### 3. Evidenz-Anker statt Behauptung
Jede gesundheitsbezogene Aussage trägt eine Quelle (`SourceChip`). Nicht nur Compliance,
sondern **strukturelle Reißerisch-Bremse**: Was nicht belegbar ist, kann im System nicht
als Gesundheitsaussage publiziert werden.

#### 4. Entschleunigungspunkte — gezielt, nicht überall
Reibung *nur* dort, wo sie schützt: vor Arzneimittel-Kauf (Wechselwirkungs-Hinweis), vor
Video-Sprechstunde (Einwilligung Art. 9 DSGVO), vor Rezept-Upload (Datenschutz-Hinweis).
Überall sonst: schnell und reibungslos.

#### 5. Keine Angst-Ökonomie — als fehlende Komponente, nicht als Policy
HWG § 11 verbietet Angstwerbung. Konsequenz fürs Design-System: Ein `UrgencyBadge`
(„nur noch 2 Stück", Countdown) **existiert für Arzneimittel nicht** — die Komponente
akzeptiert die Produktklasse nicht. Compliance über Nichtverfügbarkeit schlägt
Compliance über Disziplin.

#### 6. Generation 50+ ist Default, kein Sondermodus
Basis-Schriftgröße 17 px, Touch-Targets 48 px, Beschriftungen immer sichtbar (keine
Icon-only-Aktionen), keine versteckten Gesten, kein Autoplay mit Ton,
`prefers-reduced-motion` respektiert.

### Ausdrücklich ausgeschlossene Muster
Endlos-Autoplay · Streaks/Gamification von Gesundheit · „X Personen schauen gerade" als
Druckmittel · Vorher/Nachher-Bilder bei Arzneimitteln (HWG § 11 Abs. 1 Nr. 5) ·
Laien-Testimonials für Arzneimittel · Consent-Dark-Patterns · engagement-maximierendes
ML-Ranking für Gesundheitsinhalte.

### Feed-Ranking-Ethik
Ranking nach **Relevanz × Aktualität × Fachlichkeit**, nicht nach Interaktions-
maximierung. Fachlich verifizierte Inhalte erhalten festen Boost; kommerzielle Inhalte
einen Deckel (max. Anteil pro Sitzung) und unübersehbare `Anzeige`-Kennzeichnung.

---

## 2. Design-System

### 2.1 Token-Architektur

```
Primitive (Hex-Skalen)  →  Semantisch (CSS-Variablen)  →  Komponenten-Tokens
offizin-600             →  --color-action              →  Button/primary/bg
```

Dark-Mode ist dadurch ein reiner Variablen-Tausch — keine Duplizierung jeder Utility.

### 2.2 Farbsystem

**Offizin-Grün** (Marke, Handel, Erfolg)

| Stufe | Hex | Stufe | Hex |
|---|---|---|---|
| 50 | `#ECF8F1` | 500 | `#1B9260` |
| 100 | `#D3EFE0` | **600** | **`#0E7C4A`** ← Primär-Aktion (hell) |
| 200 | `#A8DFC3` | 700 | `#0A6139` |
| 300 | `#74C9A0` | 800 | `#094E2F` |
| 400 | `#40AE7C` | 900 | `#073F27` |
| | | 950 | `#032317` |

**Medizin-Blau** (Versorgung, Telemedizin, Information)

| Stufe | Hex | Stufe | Hex |
|---|---|---|---|
| 50 | `#EAF4FB` | 500 | `#1878BC` |
| 100 | `#CFE6F6` | **600** | **`#0B6AA8`** |
| 200 | `#A3CFEE` | 700 | `#085788` |
| 300 | `#6EB2E1` | 800 | `#08476E` |
| 400 | `#3B92D1` | 900 | `#093B5B` |
| | | 950 | `#04223A` |

**Rx-Indigo** — ausschließlich Verordnung. Diese Farbe darf **nie** an einer Kauf-Aktion
erscheinen.

`50 #EFEEFB` · `100 #DDDBF6` · `200 #BFBAEC` · `300 #9B93DE` · `400 #7A6ECE` ·
`500 #6053BC` · **`600 #4E42A6`** · `700 #3F368A` · `800 #342D70` · `900 #2C265C` ·
`950 #1A163A`

**Warm Neutral (Sand)** — bewusst warm statt blaugrau: wirkt mit Grün nach „Offizin",
nicht nach „Krankenhaus".

`0 #FFFFFF` · **`50 #FAF9F7` (Seiten-BG hell)** · `100 #F4F2EE` · `200 #E8E5DF` ·
`300 #D8D4CC` · `400 #B4AFA5` · `500 #8B857A` · `600 #6B655B` · `700 #524D45` ·
`800 #3A3630` · `900 #26231F` · **`950 #1C1B19` (Text hell)**

**Dark-Mode-Flächen** (kein reines Schwarz — reduziert Halation):
`bg #141312` · `surface #1C1B19` · `surface-2 #262421` · `border #35322D` ·
`text #EDEAE4` · `text-muted #B4AFA5`

**Semantisch**

| Rolle | Text/Icon (hell) | Fläche | Rand |
|---|---|---|---|
| Erfolg | `#0E7C4A` | `#ECF8F1` | `#A8DFC3` |
| Warnung | `#9A5B00` | `#FFF4E6` | `#F5CE93` |
| Gefahr | `#B3261E` | `#FDECEA` | `#F3BDB8` |
| Information | `#0B6AA8` | `#EAF4FB` | `#A3CFEE` |
| Verordnung (Rx) | `#4E42A6` | `#EFEEFB` | `#BFBAEC` |

**Verifizierte Kontraste** (WCAG 2.1 AA, durchgerechnet)

| Paarung | Ratio | Anforderung | Status |
|---|---|---|---|
| `#0E7C4A` Fläche / weißer Text | 5,25 : 1 | ≥ 4,5 | ✓ |
| `#0B6AA8` Fläche / weißer Text | 5,77 : 1 | ≥ 4,5 | ✓ |
| `#1C1B19` Text / `#FAF9F7` BG | 16,36 : 1 | ≥ 4,5 | ✓ |
| `#9A5B00` Warntext / weiß | 5,42 : 1 | ≥ 4,5 | ✓ |
| `#B3261E` Gefahrtext / weiß | 6,54 : 1 | ≥ 4,5 | ✓ |

> Das sind die manuell durchgerechneten Kernpaarungen. **Alle übrigen Kombinationen
> sichert der CI-Kontrasttest ab** (Abschnitt 3.8) — sie werden hier nicht ungeprüft
> behauptet.

### 2.3 Typografie

**Grundsatz:** `html` bekommt **keine** feste Pixel-Schriftgröße. Wer im Browser 20 px
eingestellt hat (bei 50+ häufig), bekommt 20 px. Skalierung nur über `rem` + `clamp()`.

- **UI:** `Inter Variable` (humanistisch, offene Punzen) → Fallback System-Stack
- **Editorial:** `Source Serif 4` für Ratgeber-Langtexte (signalisiert Fachlichkeit)
- **Zahlen:** `font-variant-numeric: tabular-nums` für Preise/Dosierungen — Pflicht

| Token | Größe | Zeilenhöhe | Einsatz |
|---|---|---|---|
| `2xs` | 0.75rem | 1.4 | Nur Icon-Beischriften, **nie** Fließtext |
| `xs` | 0.875rem | 1.45 | Metadaten, Zeitstempel |
| `sm` | 1rem | 1.55 | **Untergrenze für Fließtext** |
| `base` | 1.0625rem | 1.6 | Standard-Fließtext |
| `lg` | 1.1875rem | 1.55 | Einleitungen, wichtige Hinweise |
| `xl` | 1.375rem | 1.4 | H4 |
| `2xl` | 1.625rem | 1.3 | H3 |
| `3xl` | 2rem | 1.25 | H2 |
| `4xl` | 2.5rem | 1.2 | H1 |
| `5xl` | 3rem | 1.15 | Hero |

Gewichte ≥ 400 (keine Light/Thin) · Zeilenlänge max. 68 Zeichen · Fließtext nie unter
16 px · Versalien nur für Badges ≤ 3 Wörter.

### 2.4 Accessibility-Grid & Interaktion

| Aspekt | Festlegung |
|---|---|
| Raster | 4 px Basiseinheit, 8 px Rhythmus |
| Touch-Target | **min. 48 × 48 px**, Abstand ≥ 8 px |
| Fokus | 3 px Ring, 2 px Offset, `:focus-visible`, Kontrast ≥ 3:1 |
| Text-Kontrast | 4,5:1 (normal), 3:1 (≥ 24 px / ≥ 19 px bold) |
| UI-Kontrast | 3:1 für Ränder, Icons, Zustände (SC 1.4.11) |
| Zoom | Funktionsfähig bei 200 % (SC 1.4.4) und 320 px Reflow (SC 1.4.10) |
| Farbe allein | Nie alleiniger Informationsträger |
| Motion | `prefers-reduced-motion` → keine Transforms, kein Autoplay |
| Sprache | `lang="de"`, Fachbegriffe via `<abbr>` + Erklärung |

### 2.5 `globals.css` — Token-Definition

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light;

    /* ---- Primitive: Offizin-Grün ---- */
    --offizin-50: 236 248 241;
    --offizin-100: 211 239 224;
    --offizin-200: 168 223 195;
    --offizin-300: 116 201 160;
    --offizin-400: 64 174 124;
    --offizin-500: 27 146 96;
    --offizin-600: 14 124 74;
    --offizin-700: 10 97 57;
    --offizin-800: 9 78 47;
    --offizin-900: 7 63 39;
    --offizin-950: 3 35 23;

    /* ---- Primitive: Medizin-Blau ---- */
    --medizin-50: 234 244 251;
    --medizin-100: 207 230 246;
    --medizin-200: 163 207 238;
    --medizin-300: 110 178 225;
    --medizin-400: 59 146 209;
    --medizin-500: 24 120 188;
    --medizin-600: 11 106 168;
    --medizin-700: 8 87 136;
    --medizin-800: 8 71 110;
    --medizin-900: 9 59 91;
    --medizin-950: 4 34 58;

    /* ---- Primitive: Rx-Indigo (nur Verordnung) ---- */
    --rx-50: 239 238 251;
    --rx-100: 221 219 246;
    --rx-200: 191 186 236;
    --rx-300: 155 147 222;
    --rx-400: 122 110 206;
    --rx-500: 96 83 188;
    --rx-600: 78 66 166;
    --rx-700: 63 54 138;
    --rx-800: 52 45 112;
    --rx-900: 44 38 92;
    --rx-950: 26 22 58;

    /* ---- Primitive: Warm Neutral ---- */
    --sand-0: 255 255 255;
    --sand-50: 250 249 247;
    --sand-100: 244 242 238;
    --sand-200: 232 229 223;
    --sand-300: 216 212 204;
    --sand-400: 180 175 165;
    --sand-500: 139 133 122;
    --sand-600: 107 101 91;
    --sand-700: 82 77 69;
    --sand-800: 58 54 48;
    --sand-900: 38 35 31;
    --sand-950: 28 27 25;

    /* ---- Semantisch: Flächen & Text ---- */
    --color-bg: var(--sand-50);
    --color-surface: var(--sand-0);
    --color-surface-raised: var(--sand-0);
    --color-surface-sunken: var(--sand-100);
    --color-border: var(--sand-200);
    --color-border-strong: var(--sand-300);
    --color-text: var(--sand-950);
    --color-text-muted: var(--sand-600);
    --color-text-inverted: var(--sand-0);

    /* ---- Semantisch: Aktion ---- */
    --color-action: var(--offizin-600);
    --color-action-hover: var(--offizin-700);
    --color-action-active: var(--offizin-800);
    --color-action-fg: var(--sand-0);
    --color-action-subtle: var(--offizin-50);

    /* ---- Semantisch: Versorgung (Care) ---- */
    --color-care: var(--medizin-600);
    --color-care-hover: var(--medizin-700);
    --color-care-fg: var(--sand-0);
    --color-care-subtle: var(--medizin-50);

    /* ---- Semantisch: Verordnung (Rx) ---- */
    --color-rx: var(--rx-600);
    --color-rx-fg: var(--sand-0);
    --color-rx-subtle: var(--rx-50);
    --color-rx-border: var(--rx-200);

    /* ---- Semantisch: Status ---- */
    --color-success: 14 124 74;
    --color-success-subtle: 236 248 241;
    --color-success-border: 168 223 195;
    --color-warning: 154 91 0;
    --color-warning-subtle: 255 244 230;
    --color-warning-border: 245 206 147;
    --color-danger: 179 38 30;
    --color-danger-subtle: 253 236 234;
    --color-danger-border: 243 189 184;
    --color-info: 11 106 168;
    --color-info-subtle: 234 244 251;
    --color-info-border: 163 207 238;

    /* ---- Fokus ---- */
    --color-focus: 26 115 232;

    /* ---- Elevation ---- */
    --shadow-sm: 0 1px 2px rgb(28 27 25 / 0.06);
    --shadow-md: 0 1px 2px rgb(28 27 25 / 0.06), 0 4px 12px rgb(28 27 25 / 0.08);
    --shadow-lg: 0 2px 4px rgb(28 27 25 / 0.06), 0 12px 28px rgb(28 27 25 / 0.12);
  }

  [data-theme='dark'] {
    color-scheme: dark;

    --color-bg: 20 19 18;
    --color-surface: 28 27 25;
    --color-surface-raised: 38 36 33;
    --color-surface-sunken: 20 19 18;
    --color-border: 53 50 45;
    --color-border-strong: 82 77 69;
    --color-text: 237 234 228;
    --color-text-muted: 180 175 165;
    --color-text-inverted: 28 27 25;

    /* Aktionen im Dunkeln heller: Kontrast zur dunklen Fläche statt zu Weiß */
    --color-action: var(--offizin-500);
    --color-action-hover: var(--offizin-400);
    --color-action-active: var(--offizin-300);
    --color-action-fg: 3 35 23;
    --color-action-subtle: 9 78 47;

    --color-care: var(--medizin-400);
    --color-care-hover: var(--medizin-300);
    --color-care-fg: 4 34 58;
    --color-care-subtle: 8 71 110;

    --color-rx: var(--rx-300);
    --color-rx-fg: 26 22 58;
    --color-rx-subtle: 52 45 112;
    --color-rx-border: 63 54 138;

    --color-success: 64 174 124;
    --color-success-subtle: 9 78 47;
    --color-success-border: 10 97 57;
    --color-warning: 226 172 68;
    --color-warning-subtle: 51 40 15;
    --color-warning-border: 90 70 32;
    --color-danger: 240 133 122;
    --color-danger-subtle: 58 28 24;
    --color-danger-border: 94 43 37;
    --color-info: 110 178 225;
    --color-info-subtle: 8 71 110;
    --color-info-border: 8 87 136;

    --color-focus: 138 180 248;

    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
    --shadow-md: 0 1px 2px rgb(0 0 0 / 0.4), 0 4px 12px rgb(0 0 0 / 0.35);
    --shadow-lg: 0 2px 4px rgb(0 0 0 / 0.45), 0 12px 28px rgb(0 0 0 / 0.5);
  }

  html {
    /* KEINE feste font-size: respektiert die Browser-Einstellung der Nutzer:in */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    scroll-behavior: smooth;
  }

  body {
    background-color: rgb(var(--color-bg));
    color: rgb(var(--color-text));
    font-size: clamp(1.0625rem, 1rem + 0.25vw, 1.125rem);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  :focus-visible {
    outline: 3px solid rgb(var(--color-focus));
    outline-offset: 2px;
    border-radius: 4px;
  }

  .tnum, table, [data-numeric] {
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer components {
  .touch-target {
    min-height: 3rem;
    min-width: 3rem;
  }

  /* Pflichttext nach § 4 HWG — visuell ruhig, aber nie versteckt */
  .pflichttext {
    font-size: 0.875rem;
    line-height: 1.5;
    color: rgb(var(--color-text-muted));
    border-top: 1px solid rgb(var(--color-border));
    padding-top: 0.75rem;
    margin-top: 1rem;
  }
}
```

### 2.6 `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

const rgb = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],

  content: [
    './src/app/**/*.{ts,tsx,mdx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],

  theme: {
    extend: {
      colors: {
        bg: rgb('--color-bg'),
        surface: {
          DEFAULT: rgb('--color-surface'),
          raised: rgb('--color-surface-raised'),
          sunken: rgb('--color-surface-sunken'),
        },
        border: {
          DEFAULT: rgb('--color-border'),
          strong: rgb('--color-border-strong'),
        },
        content: {
          DEFAULT: rgb('--color-text'),
          muted: rgb('--color-text-muted'),
          inverted: rgb('--color-text-inverted'),
        },
        action: {
          DEFAULT: rgb('--color-action'),
          hover: rgb('--color-action-hover'),
          active: rgb('--color-action-active'),
          fg: rgb('--color-action-fg'),
          subtle: rgb('--color-action-subtle'),
        },
        care: {
          DEFAULT: rgb('--color-care'),
          hover: rgb('--color-care-hover'),
          fg: rgb('--color-care-fg'),
          subtle: rgb('--color-care-subtle'),
        },
        rx: {
          DEFAULT: rgb('--color-rx'),
          fg: rgb('--color-rx-fg'),
          subtle: rgb('--color-rx-subtle'),
          border: rgb('--color-rx-border'),
        },
        success: {
          DEFAULT: rgb('--color-success'),
          subtle: rgb('--color-success-subtle'),
          border: rgb('--color-success-border'),
        },
        warning: {
          DEFAULT: rgb('--color-warning'),
          subtle: rgb('--color-warning-subtle'),
          border: rgb('--color-warning-border'),
        },
        danger: {
          DEFAULT: rgb('--color-danger'),
          subtle: rgb('--color-danger-subtle'),
          border: rgb('--color-danger-border'),
        },
        info: {
          DEFAULT: rgb('--color-info'),
          subtle: rgb('--color-info-subtle'),
          border: rgb('--color-info-border'),
        },
        focus: rgb('--color-focus'),
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['var(--font-source-serif)', 'Georgia', 'Cambria', 'serif'],
      },

      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.4' }],
        xs: ['0.875rem', { lineHeight: '1.45' }],
        sm: ['1rem', { lineHeight: '1.55' }],
        base: ['1.0625rem', { lineHeight: '1.6' }],
        lg: ['1.1875rem', { lineHeight: '1.55' }],
        xl: ['1.375rem', { lineHeight: '1.4', letterSpacing: '-0.005em' }],
        '2xl': ['1.625rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        '3xl': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '4xl': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
      },

      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },

      spacing: {
        px: '1px',
        0: '0',
        0.5: '0.125rem',
        1: '0.25rem',
        1.5: '0.375rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        touch: '3rem',
        'touch-lg': '3.5rem',
      },

      minHeight: { touch: '3rem', 'touch-lg': '3.5rem' },
      minWidth: { touch: '3rem' },

      maxWidth: {
        measure: '68ch',
        feed: '40rem',
        shell: '80rem',
      },

      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        pill: '9999px',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        none: 'none',
      },

      ringWidth: { DEFAULT: '3px' },
      ringOffsetWidth: { DEFAULT: '2px' },

      screens: {
        sm: '40rem',
        md: '48rem',
        lg: '64rem',
        xl: '80rem',
        '2xl': '96rem',
      },

      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0, 0.2, 1)',
        emphasis: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: { DEFAULT: '160ms', slow: '240ms' },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(0.2, 0, 0.2, 1)',
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
      },

      typography: () => ({
        DEFAULT: {
          css: {
            maxWidth: '68ch',
            color: 'rgb(var(--color-text))',
            a: {
              color: 'rgb(var(--color-care))',
              textUnderlineOffset: '3px',
            },
            'h1, h2, h3, h4': {
              color: 'rgb(var(--color-text))',
              fontWeight: '700',
            },
          },
        },
      }),
    },
  },

  plugins: [
    forms({ strategy: 'class' }),
    typography,
    plugin(({ addUtilities, addVariant }) => {
      addVariant('hocus', ['&:hover', '&:focus-visible'])
      addVariant('rx', '[data-product-class="rx"] &')
      addUtilities({
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        '.text-balance': { textWrap: 'balance' },
      })
    }),
  ],
}

export default config
```

### 2.7 No-Flash Darkmode

Drei Maßnahmen zusammen — einzeln reicht keine:

```tsx
// src/app/layout.tsx
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('apotrend-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-content font-sans antialiased">{children}</body>
    </html>
  )
}
```

1. **Blockierendes Inline-Skript** vor dem ersten Paint → kein weißes Aufblitzen.
2. **`color-scheme`** → Scrollbars, Formularelemente und Browser-Canvas kippen sofort mit.
3. **`suppressHydrationWarning`** → React beanstandet das vom Skript gesetzte Attribut nicht.

Zusätzlich: keine reinen `#000`/`#FFF` in beiden Modi; beim Umschalten kurzzeitig
`transition: none` auf `html`, damit keine Farbschlieren entstehen.

### 2.8 Atomare Komponenten-Matrix

#### Buttons

| Variante | Einsatz | Farbe | Höhen | Regel |
|---|---|---|---|---|
| `primary` | Kauf, Absenden, Hauptaktion | `action` / `action-fg` | sm 40 · md 48 · lg 56 | Max. 1 pro Sichtbereich |
| `secondary` | Nebenaktion | Rand `border-strong`, Text `content` | wie oben | — |
| `ghost` | Tertiär, in Listen | transparent, Text `content` | wie oben | — |
| `care` | Sprechstunde, Beratung | `care` / `care-fg` | wie oben | Nur Ebene 3 |
| `danger` | Löschen, Stornieren | `danger` | wie oben | Immer mit Bestätigung |
| `link` | Inline-Navigation | `care`, unterstrichen | — | — |

Zustände durchgängig: `default · hover · active · focus-visible · disabled · loading`.
**Kein Icon-only** für Primäraktionen. `disabled` nie als einziges Feedback — immer
Begründungstext daneben.

#### Badges

| Variante | Farbe | Beispiel |
|---|---|---|
| `neutral` | `surface-sunken` | „Kategorie" |
| `info` | `info-subtle` / `info` | „Neu" |
| `success` | `success-subtle` | „Auf Lager" |
| `warning` | `warning-subtle` | „Lieferengpass" |
| `danger` | `danger-subtle` | „Rückruf" |
| `rx` | `rx-subtle` / `rx` | „Rezeptpflichtig" |
| `live` | `danger` + `animate-pulse-live` | „LIVE" (via `motion-reduce` abschaltbar) |
| `ad` | `border-strong`, Text `content-muted` | „Anzeige" — **Pflicht**, nie dekorativ |

#### `ShoppableTag` — die rechtlich kritische Komponente

| `productClass` | Darstellung | Kauf-CTA | Zusatzpflicht |
|---|---|---|---|
| `otc_arzneimittel` | Grün, „Rezeptfrei bestellen" | ✅ | **Pflichttext § 4 HWG** verpflichtend |
| `medizinprodukt` | Grün, „Bestellen" | ✅ | CE-Hinweis + Zweckbestimmung |
| `nem` | Grün, „Bestellen" | ✅ | Nur zugelassene Health Claims (VO 1924/2006) |
| `kosmetik` | Grün, „Bestellen" | ✅ | — |
| `rx` | **Indigo, „Rezeptpflichtig — Informationen"** | ❌ **nicht existent** | Kein Preis, keine Bewertung, keine Empfehlung |

**Architektur-Kernentscheidung:** Die Regel wird nicht per Code-Review durchgesetzt,
sondern über den **Typ**:

```ts
type ShoppableProduct = {
  class: 'otc_arzneimittel' | 'medizinprodukt' | 'nem' | 'kosmetik'
  priceCents: number
  addToCart: (id: string) => Promise<void>
  pflichttextRequired: boolean
}

type RxProduct = {
  class: 'rx'
  // Bewusst KEIN priceCents, KEIN addToCart — nicht vergessen, sondern unmöglich.
  infoUrl: string
  prescriptionFlow: 'upload' | 'erezept'
}

type Product = ShoppableProduct | RxProduct
```

Ein Kauf-Button für ein Rx-Produkt lässt sich damit **nicht kompilieren**. Ergänzt um
DB-Constraint und Service-Guard = Defense in Depth über drei Ebenen.

#### `VerifiedPharmacistBadge`

| Variante | Prüfgegenstand | Darstellung |
|---|---|---|
| `pharmacist` | Approbation | Blau, Schild-Icon, „Approbierte:r Apotheker:in" |
| `pharmacy` | Betriebserlaubnis + Versandhandelserlaubnis | Blau, Haus-Icon, Apothekenname |
| `pta` | PTA-Nachweis | Blau-hell, „PTA" |
| `physician` | Arztregister | Blau, „Ärztin/Arzt" |

Regeln: **nie selbst vergebbar** (nur Admin nach Prüfung) · Klick erklärt *was* geprüft
wurde und *wann* · automatischer Verfall bei abgelaufener Prüfung · Prüfsiegel, kein
Werbesiegel — keine Gold-/Glanz-Effekte.

#### Weitere Kernkomponenten

| Komponente | Zweck | Besonderheit |
|---|---|---|
| `SourceChip` | Quellenangabe an Gesundheitsaussagen | Zeigt Domain (`bfarm.de`) — amtlich vs. beliebig unterscheidbar |
| `PflichttextBlock` | § 4 HWG Pflichtangaben | Nie versteckt-ausklappbar; im Sichtbereich der Kauf-Aktion |
| `ConsentGate` | Art. 9 DSGVO Einwilligung | Zwei getrennte Zustimmungen (Verarbeitung / Aufzeichnung), widerrufbar |
| `RxUploader` | Rezept-Einreichung | Verschlüsselt, lokale Vorschau, sichtbare Löschfrist |
| `VideoConsultCard` | Sprechstunde | Wartezimmer, Identitätsprüfung, „Keine Notfallversorgung"-Hinweis |
| `LiveRoom` | Live-Stream | Moderierter Chat, „Antwort anpinnen", kein Kauf-Overlay bei Arzneimitteln |
| `InteractionHint` | Wechselwirkungs-Hinweis | Vor dem Warenkorb-Abschluss, nicht danach |

---

## 3. System-Architektur

### 3.1 Topologie (ausschließlich EU-Hosting)

```
                    ┌─────────────────────────────┐
   Browser  ───────▶│  web — Next.js 14 (Node)    │
   (PWA)            │  RSC · Server Actions · ISR │
        │           └──────┬──────────────┬───────┘
        │                  │              │
        │            ┌─────▼─────┐  ┌─────▼──────────┐
        ├───WS──────▶│ realtime  │  │  jobs (BullMQ) │
        │            │ Socket.io │  │  Worker        │
        │            └─────┬─────┘  └─────┬──────────┘
        │                  │              │
        │            ┌─────▼──────────────▼──────┐
        │            │  Redis (PubSub · Queue)   │
        │            └───────────────────────────┘
        │                  │
        │            ┌─────▼──────────────────────┐
        │            │  PostgreSQL (EU)           │
        │            │  ├─ schema: core           │
        │            │  └─ schema: health (Art.9) │
        │            └────────────────────────────┘
        │
        ├──WebRTC──▶ Daily.co (EU-Region, SFU/P2P)
        └──HTTPS───▶ S3-kompatibel EU + CDN (signierte URLs)
```

### 3.2 App-Router-Struktur

```
src/app/
├─ layout.tsx                    # Theme-Script, Fonts, Shell
├─ (public)/                     # Öffentlich, SEO-relevant, statisch/ISR
│  ├─ page.tsx
│  ├─ ratgeber/[slug]/page.tsx
│  └─ apotheke/[slug]/page.tsx
├─ (feed)/                       # Social — RSC + Realtime-Islands
│  ├─ feed/page.tsx
│  ├─ beitrag/[id]/page.tsx
│  └─ live/[id]/page.tsx
├─ (shop)/                       # Handel — NUR nicht-verschreibungspflichtig
│  ├─ produkt/[slug]/page.tsx
│  ├─ warenkorb/page.tsx
│  └─ kasse/page.tsx
├─ (care)/                       # Versorgung — Auth-Pflicht, noindex
│  ├─ rezept/page.tsx
│  ├─ sprechstunde/[id]/page.tsx
│  └─ arzneimittel/[slug]/page.tsx   # Rx: reine Information
├─ (pharmacy)/                   # Fachpersonal-Dashboard
├─ (admin)/                      # Verifizierung, Moderation
└─ api/
   ├─ auth/[...nextauth]/route.ts
   ├─ webhooks/payment/route.ts
   └─ realtime-token/route.ts    # kurzlebiges JWT für Socket.io
```

**Rendering-Regeln:** RSC als Default · Client-Components nur als Inseln (Warenkorb,
Live-Chat, Video, Upload) · Server Actions + `zod` für Mutationen · `revalidateTag` für
Katalog/Redaktion · **Node-Runtime**, nicht Edge (Prisma, Krypto, Health-Daten) · Edge
nur für Middleware.

### 3.3 Realtime (Socket.io)

**Architekturentscheidung:** Socket.io läuft **nicht** in Next.js. Serverless-Funktionen
halten keine persistenten Verbindungen — der Realtime-Dienst ist ein eigener,
langlebiger Node-Container.

| Namespace | Ereignisse | Skalierung |
|---|---|---|
| `/feed` | `post:new`, `reaction`, `presence` | Redis-Adapter, Raum je Follower-Segment |
| `/live` | `chat:msg`, `viewer:count`, `answer:pinned`, `stream:state` | Raum je Live-ID, Rate-Limit 1 Msg/2 s |
| `/consult` | `waitingroom:state`, `consult:ready`, `consult:ended` | Raum je Termin-ID, nur 2 Teilnehmer |

Auth über kurzlebiges JWT (60 s) aus `/api/realtime-token`, serverseitig gegen die
Session geprüft · Sticky Sessions am Load Balancer · Redis-Adapter für horizontale
Skalierung · Live-Chat mit Moderations-Queue.

### 3.4 Video (WebRTC / Daily.co)

| Aspekt | Festlegung |
|---|---|
| Räume | **Nur serverseitig** erzeugt, kurzlebige Meeting-Tokens, Auto-Ablauf |
| Region | EU-Region gepinnt, AVV/DPA unterzeichnet |
| Modus | 1:1-Beratung → **P2P + E2EE** (Insertable Streams); Gruppen-Live → SFU |
| Aufzeichnung | **Standardmäßig aus.** Nur mit separater Einwilligung, EU-Storage, Löschfrist |
| Wartezimmer | Ja, mit Identitätsabgleich vor Freigabe |

> **Präzisierung zu „Ende-zu-Ende":** Über einen SFU ist der Transport per DTLS-SRTP
> verschlüsselt, der Server kann Medien aber technisch entschlüsseln. Echte E2EE (Server
> kann *nicht* mitlesen) erfordert E2EE-Modus/Insertable Streams und schließt
> serverseitige Aufzeichnung/Transkription aus. Für die 1:1-Sprechstunde ist der
> Anspruch mit P2P + E2EE haltbar — für Gruppen-Lives nicht, und er sollte dort auch
> nicht in der Datenschutzerklärung behauptet werden.

### 3.5 Datenhaltung & DSGVO

**Kernentscheidung: Zwei getrennte Schemata in einer Postgres-Instanz.**

| Schema | Inhalt | Schutzniveau |
|---|---|---|
| `core` | Nutzer, Katalog, Bestellungen, Social, Content | Standard |
| `health` | Rezepte, Beratungsnotizen, Medikationslisten, Sprechstunden | **Art. 9 DSGVO** |

Für `health`: eigene DB-Rolle mit minimalen Rechten · Spalten-Verschlüsselung
(anwendungsseitig AES-256-GCM, Schlüssel im KMS/Vault) · **Audit-Log auf jeden
Lesezugriff** · harte Aufbewahrungsfristen mit automatischem Job · getrennte Backups.

Weiter: Prisma über PgBouncer · Datenminimierung (Rezeptbild nach Einlösung gelöscht,
nicht archiviert) · Auskunfts-/Löschbegehren als vorbereiteter Job · Consent-Historie
versioniert.

### 3.6 Auth & Rollen

Auth.js v5 mit Datenbank-Sessions (keine reinen JWTs bei Gesundheitsbezug). Rollen:
`consumer` · `pharmacist` · `pharmacy_admin` · `physician` · `moderator` · `admin`.
**2FA verpflichtend** für alle Fachrollen. Verifizierung nur durch Admin nach
Nachweisprüfung, mit Ablaufdatum.

### 3.7 Compliance-Gates im Code

Jede Regel an **drei** Stellen:

| Regel | Typ-Ebene | Service-Ebene | DB-Ebene |
|---|---|---|---|
| Rx nie im Warenkorb | Union ohne `addToCart` | Guard in `addToCart()` | `CHECK (product_class <> 'RX_ARZNEIMITTEL')` |
| Pflichttext bei Arzneimittel | `pflichttextRequired: true` | Render-Guard wirft bei Fehlen | `CHECK` auf `pflichttext_id` |
| Nur Apotheken mit Versanderlaubnis | — | Guard bei Bestellannahme | FK auf `pharmacy.mail_order_licence` |
| Badge nur nach Prüfung | — | Nur Admin-Mutation | `verified_by` + `verified_until` NOT NULL |

### 3.8 CI-Qualitätsschranken

`tsc --noEmit` · ESLint + `eslint-plugin-jsx-a11y` · **Kontrast-Test über alle
Token-Paarungen** (rechnet die WCAG-Ratio, schlägt unter 4,5:1 fehl) · axe-core in
Playwright über alle Kernrouten, hell **und** dunkel · Lighthouse a11y ≥ 95 als Gate ·
Unit-Tests für Compliance-Gates (`rx-never-in-cart`, `pflichttext-present`) · visuelle
Regression für die Komponenten-Matrix.

---

## 4. Offene Entscheidungen

1. **E-Rezept-Pfad** — Ein selbstgebauter Uploader deckt nur Privat-/Papierrezepte ab.
   GKV-E-Rezept erfordert einen gematik-zugelassenen Weg (CardLink oder Token aus der
   E-Rezept-App). Zulassungs- und Budgetfrage.
2. **Marktplatz oder Einzelapotheke?** Viele Apotheken (Multi-Tenant) oder eine
   Betreiber-Apotheke (schlanker)?
3. **Hosting-Modell** — Vercel EU + Managed-DB (schnell) vs. Self-Hosting
   (Hetzner/Scaleway; bei Art.-9-Daten leichter vertretbar).
4. **Länder-Scope** — Nur DE oder DACH? AT/CH mit abweichendem Arzneimittel- und
   Versandrecht.
5. **Ärztliche Telemedizin oder nur pharmazeutische Beratung?** Ärztlich zieht
   Berufsrecht, Dokumentationspflicht und ggf. Abrechnung nach sich.

---

## 5. Nächste Schritte

- **Schritt 2:** Datenbank-Schema (Prisma) — siehe `prisma-schema-draft.prisma`
- **Schritt 3:** Implementierung (Komponenten, Routen, Realtime, Video)
