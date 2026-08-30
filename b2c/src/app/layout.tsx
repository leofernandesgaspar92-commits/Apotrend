import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'ApoPulse — Beratung aus der Apotheke',
  description:
    'Fachbeiträge aus geprüften Apotheken, rezeptfreie Produkte und Videosprechstunde.',
}

/**
 * No-Flash-Darkmode: läuft VOR dem ersten Paint.
 * Setzt zusätzlich `color-scheme`, damit Scrollbars und native Formularelemente
 * sofort mitkippen — sonst blitzen sie hell auf.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('apopulse-theme');
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
      <body className="bg-bg font-sans text-content antialiased">
        {/* Sprungmarke: Tastaturnutzer:innen überspringen die Kopfzeile */}
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-3 focus:ring focus:ring-focus"
        >
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  )
}
