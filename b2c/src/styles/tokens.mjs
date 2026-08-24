// ============================================================================
//  Design-Tokens — EINZIGE QUELLE DER WAHRHEIT
// ============================================================================
//  Aus dieser Datei werden erzeugt:
//    - tokens.css        (tools/build-tokens.mjs)
//    - Kontrast-Prüfung  (tools/check-contrast.mjs)
//
//  Wer eine Farbe ändert, ändert sie HIER. Weicht tokens.css davon ab, schlägt
//  `npm run check:tokens` fehl — Design-Drift kann nicht unbemerkt entstehen.
// ============================================================================

/** Primitive Paletten (Hex). Nie direkt in Komponenten verwenden. */
export const palette = {
  offizin: {
    50: '#ECF8F1', 100: '#D3EFE0', 200: '#A8DFC3', 300: '#74C9A0', 400: '#40AE7C',
    500: '#1B9260', 600: '#0E7C4A', 700: '#0A6139', 800: '#094E2F', 900: '#073F27',
    950: '#032317',
  },
  medizin: {
    50: '#EAF4FB', 100: '#CFE6F6', 200: '#A3CFEE', 300: '#6EB2E1', 400: '#3B92D1',
    500: '#1878BC', 600: '#0B6AA8', 700: '#085788', 800: '#08476E', 900: '#093B5B',
    950: '#04223A',
  },
  // Ausschließlich Verordnung. Diese Farbe darf nie an einer Kauf-Aktion stehen.
  rx: {
    50: '#EFEEFB', 100: '#DDDBF6', 200: '#BFBAEC', 300: '#9B93DE', 400: '#7A6ECE',
    500: '#6053BC', 600: '#4E42A6', 700: '#3F368A', 800: '#342D70', 900: '#2C265C',
    950: '#1A163A',
  },
  // Warm statt blaugrau: wirkt mit Grün nach „Offizin", nicht nach „Krankenhaus".
  sand: {
    0: '#FFFFFF', 50: '#FAF9F7', 100: '#F4F2EE', 200: '#E8E5DF', 300: '#D8D4CC',
    400: '#B4AFA5', 500: '#8B857A', 600: '#6B655B', 700: '#524D45', 800: '#3A3630',
    900: '#26231F', 950: '#1C1B19',
  },
  warm: { 900: '#141312' }, // Dark-Seitenhintergrund, bewusst kein reines Schwarz
  amber: { 400: '#E2AC44', 600: '#9A5B00' },
  red: { 400: '#F0857A', 600: '#B3261E' },
  blue: { focusLight: '#1A73E8', focusDark: '#8AB4F8' },
}

const p = palette

/**
 * Semantische Tokens je Theme. Diese Namen benutzen die Komponenten —
 * niemals die Primitive direkt.
 */
export const themes = {
  light: {
    'color-bg': p.sand[50],
    'color-surface': p.sand[0],
    'color-surface-raised': p.sand[0],
    'color-surface-sunken': p.sand[100],
    'color-border': p.sand[200],
    // sand-300 wäre optisch feiner, erreicht auf Weiß aber nur 1,48:1 —
    // SC 1.4.11 verlangt 3:1 für Ränder, die eine Komponente begrenzen.
    'color-border-strong': p.sand[500],
    'color-text': p.sand[950],
    'color-text-muted': p.sand[600],
    'color-text-inverted': p.sand[0],

    'color-action': p.offizin[600],
    'color-action-hover': p.offizin[700],
    'color-action-active': p.offizin[800],
    'color-action-fg': p.sand[0],
    'color-action-subtle': p.offizin[50],

    'color-care': p.medizin[600],
    'color-care-hover': p.medizin[700],
    'color-care-fg': p.sand[0],
    'color-care-subtle': p.medizin[50],

    'color-rx': p.rx[600],
    'color-rx-fg': p.sand[0],
    'color-rx-subtle': p.rx[50],
    'color-rx-border': p.rx[200],

    'color-success': p.offizin[600],
    'color-success-subtle': p.offizin[50],
    'color-success-border': p.offizin[200],
    'color-warning': p.amber[600],
    'color-warning-subtle': '#FFF4E6',
    'color-warning-border': '#F5CE93',
    'color-danger': p.red[600],
    'color-danger-subtle': '#FDECEA',
    'color-danger-border': '#F3BDB8',
    'color-info': p.medizin[600],
    'color-info-subtle': p.medizin[50],
    'color-info-border': p.medizin[200],

    'color-focus': p.blue.focusLight,
  },

  dark: {
    'color-bg': p.warm[900],
    'color-surface': p.sand[950],
    'color-surface-raised': '#262421',
    'color-surface-sunken': p.warm[900],
    'color-border': '#35322D',
    'color-border-strong': p.sand[500], // wie hell: sand-700 erreicht nur 2,05:1
    'color-text': '#EDEAE4',
    'color-text-muted': p.sand[400],
    'color-text-inverted': p.sand[950],

    // Im Dunkeln HELLER als hell: der Kontrast bezieht sich auf die dunkle
    // Fläche, nicht auf Weiß. Der Kontrast-Test erzwingt das.
    'color-action': p.offizin[400],
    'color-action-hover': p.offizin[300],
    'color-action-active': p.offizin[200],
    'color-action-fg': p.offizin[950],
    'color-action-subtle': p.offizin[800],

    'color-care': p.medizin[400],
    'color-care-hover': p.medizin[300],
    'color-care-fg': p.medizin[950],
    'color-care-subtle': p.medizin[800],

    'color-rx': p.rx[200],
    'color-rx-fg': p.rx[950],
    'color-rx-subtle': p.rx[800],
    'color-rx-border': p.rx[700],

    // Badge-Text auf getönter Fläche braucht im Dunkeln eine Stufe MEHR Helligkeit
    // als intuitiv erwartet — rx-300/offizin-400/medizin-300 verfehlten 4,5:1.
    'color-success': p.offizin[300],
    'color-success-subtle': p.offizin[800],
    'color-success-border': p.offizin[700],
    'color-warning': p.amber[400],
    'color-warning-subtle': '#33280F',
    'color-warning-border': '#5A4620',
    'color-danger': p.red[400],
    'color-danger-subtle': '#3A1C18',
    'color-danger-border': '#5E2B25',
    'color-info': p.medizin[200],
    'color-info-subtle': p.medizin[800],
    'color-info-border': p.medizin[700],

    'color-focus': p.blue.focusDark,
  },
}

/**
 * Kontrast-Anforderungen — die Prüfliste des CI-Gates.
 *
 * `min` folgt WCAG 2.1 AA:
 *   4.5 = Fließtext            (SC 1.4.3)
 *   3.0 = große Schrift + UI-Komponenten/Ränder (SC 1.4.3 / 1.4.11)
 *
 * Jede Zeile ist eine Zusage. Wird sie gebrochen, schlägt der Build fehl —
 * nicht erst ein manueller Sichttest.
 */
export const contrastPairs = [
  // Fließtext auf Flächen
  { fg: 'color-text', bg: 'color-bg', min: 4.5, note: 'Fließtext auf Seitenhintergrund' },
  { fg: 'color-text', bg: 'color-surface', min: 4.5, note: 'Fließtext auf Karte' },
  { fg: 'color-text-muted', bg: 'color-bg', min: 4.5, note: 'Sekundärtext' },
  { fg: 'color-text-muted', bg: 'color-surface', min: 4.5, note: 'Sekundärtext auf Karte' },

  // Aktions-Flächen mit Beschriftung
  { fg: 'color-action-fg', bg: 'color-action', min: 4.5, note: 'Primär-Button' },
  { fg: 'color-action-fg', bg: 'color-action-hover', min: 4.5, note: 'Primär-Button (Hover)' },
  { fg: 'color-care-fg', bg: 'color-care', min: 4.5, note: 'Versorgungs-Button' },
  { fg: 'color-rx-fg', bg: 'color-rx', min: 4.5, note: 'Rx-Kennzeichnung' },

  // Status-Badges (Text auf getönter Fläche)
  { fg: 'color-success', bg: 'color-success-subtle', min: 4.5, note: 'Erfolgs-Badge' },
  { fg: 'color-warning', bg: 'color-warning-subtle', min: 4.5, note: 'Warn-Badge' },
  { fg: 'color-danger', bg: 'color-danger-subtle', min: 4.5, note: 'Gefahr-Badge' },
  { fg: 'color-info', bg: 'color-info-subtle', min: 4.5, note: 'Info-Badge' },
  { fg: 'color-rx', bg: 'color-rx-subtle', min: 4.5, note: 'Rx-Badge' },

  // UI-Komponenten & Ränder (SC 1.4.11)
  { fg: 'color-border-strong', bg: 'color-surface', min: 3.0, note: 'Rand Sekundär-Button' },
  { fg: 'color-focus', bg: 'color-bg', min: 3.0, note: 'Fokus-Ring auf Hintergrund' },
  { fg: 'color-focus', bg: 'color-surface', min: 3.0, note: 'Fokus-Ring auf Karte' },
  { fg: 'color-action', bg: 'color-surface', min: 3.0, note: 'Ghost-Button-Text/Icon' },
]
