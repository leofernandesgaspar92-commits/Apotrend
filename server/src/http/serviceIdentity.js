/**
 * Wie heißt dieser Dienst und unter welcher Adresse ist er erreichbar?
 *
 * WARUM DAS IN DIE WARNUNG GEHÖRT — ein echter Beinahe-Schaden vom 05.09.2026:
 * Es liefen zwei Render-Dienste vom selben Branch. Einer hatte die Datenbank,
 * der andere die Kundendomain. Beide Protokolle sahen für sich genommen
 * plausibel aus — der eine meldete „Datenhaltung sicher", der andere „KEINE
 * Datenbank angebunden". Erst das Nebeneinanderlegen zeigte, dass ausgerechnet
 * der Dienst OHNE Datenbank die echte Adresse beantwortete. Wer sich dort
 * registriert hätte, wäre die Konten beim nächsten Deploy wieder losgewesen —
 * exakt der Fehler, dessentwegen die Datenbank überhaupt angebunden wurde.
 *
 * Eine Warnung, die nicht sagt WER warnt, ist bei mehreren Diensten wertlos.
 * Render setzt beide Angaben von sich aus; hier werden sie nur weitergereicht.
 */
export function dienstKennung(env = process.env) {
  const name = env.RENDER_SERVICE_NAME || null;
  const url = env.RENDER_EXTERNAL_URL || null;
  if (!name && !url) return '';
  return ` [Dienst: ${name || 'unbenannt'}${url ? ` — ${url}` : ''}]`;
}
