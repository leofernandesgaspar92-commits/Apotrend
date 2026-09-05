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
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WICHTIG ZUR ADRESSE — und eine Korrektur an mir selbst:
 *
 * `RENDER_EXTERNAL_URL` ist IMMER die von Render vergebene *.onrender.com-
 * Adresse, auch dann, wenn längst eine Kundendomain auf den Dienst zeigt.
 * Eigene Domains stehen in keiner Umgebungsvariable; von innen sind sie nicht
 * feststellbar.
 *
 * Ich hatte dem Owner geschrieben, im Protokoll müsse „[Dienst: apopulse-feed
 * — https://www.apopulse.com]" erscheinen. Das kann es nie. Wer darauf wartet,
 * schließt aus dem Ausbleiben, die Domain hänge noch am falschen Dienst — und
 * zieht damit genau die falsche Konsequenz aus einer Zeile, die den Irrtum
 * eigentlich verhindern soll.
 *
 * Deshalb ist die Adresse hier ausdrücklich als Render-Adresse beschriftet.
 * Welche Domains tatsächlich auf den Dienst zeigen, sagt Render selbst in der
 * Zeile „Available at your primary URL … + N more domains".
 */
export function dienstKennung(env = process.env) {
  const name = env.RENDER_SERVICE_NAME || null;
  const url = env.RENDER_EXTERNAL_URL || null;
  if (!name && !url) return '';
  return ` [Dienst: ${name || 'unbenannt'}${url ? ` — Render-Adresse: ${url}` : ''}]`;
}
