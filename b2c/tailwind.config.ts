import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

/**
 * Farben kommen ausschließlich aus den CSS-Variablen (src/styles/tokens.css),
 * die aus tokens.mjs erzeugt werden. Dadurch prüft das Kontrast-Gate exakt die
 * Werte, die auch im Browser landen — und Dark-Mode bleibt ein Variablentausch.
 */
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
        touch: '3rem', // 48px — Mindest-Touch-Target
        'touch-lg': '3.5rem', // 56px — primäre Aktionen
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
            a: { color: 'rgb(var(--color-care))', textUnderlineOffset: '3px' },
            'h1, h2, h3, h4': { color: 'rgb(var(--color-text))', fontWeight: '700' },
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
      // Erlaubt gezieltes Styling im Rx-Kontext, ohne Kauf-Utilities zu öffnen
      addVariant('rx-context', '[data-product-class="rx"] &')
      addUtilities({
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        '.text-balance': { textWrap: 'balance' },
      })
    }),
  ],
}

export default config
