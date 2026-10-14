# Öffentliche Engpass-Seiten (Google & Co.)

## Warum

Apotheker:innen und Einkauf suchen „Amoxicillin Lieferengpass". ApoPulse war dafür unsichtbar:
Die App ist eine Single-Page-App — Suchmaschinen sahen eine leere Hülle, es gab weder
`robots.txt` noch `sitemap.xml`. Jetzt baut der Server lesbare Seiten (ohne JavaScript):

| Adresse | Inhalt |
|---|---|
| `/engpaesse` | Länder mit Behördenliste |
| `/engpaesse/at` | aktuelle Engpässe des Landes, je Wirkstoff (Status, seit wann) |
| `/engpaesse/at/amoxicillin` | ein Wirkstoff: Status, betroffene Präparate, voraussichtliches Ende, Verlauf, Quelle, Stand |
| `/robots.txt`, `/sitemap.xml` | für Suchmaschinen |

Jede Seite führt mit einem großen Knopf in die App — auf der Wirkstoff-Seite direkt in
„nach dem Konto-Anlegen beobachten" (derselbe Weg wie bei geteilten Links).

## Regeln (`server/src/services/oeffentlicheSeiten.js`)

- **Nur amtliche Daten.** Meldungen aus Apotheken und Beispieldaten erscheinen hier nicht:
  Suchmaschinen zeigen Ausschnitte ohne Kennzeichnung — „nicht amtlich" ginge verloren.
- Jede Aussage mit Behörde und Stand; Hinweis „keine Therapie- oder Austauschempfehlung".
- Nur Wirkstoffe, die in der Behördenliste des Landes stehen oder standen — unbekannte Adressen
  liefern **404** (nicht die App-Hülle mit 200), damit keine endlosen Leerseiten entstehen.
- Wieder lieferbar: Die Seite bleibt und sagt „derzeit kein Lieferengpass gemeldet, zuletzt
  knapp bis …" — genau das wird oft gesucht.
- Keine Anzeigen auf diesen Seiten.
- Aufrufe der letzten 7 Tage stehen im Betriebs-Cockpit.

## Was du tun solltest

1. `APOPULSE_PUBLIC_URL` in Render auf die echte Domain setzen (z. B. `https://www.apopulse.com`)
   — sonst zeigen die „canonical"-Angaben auf die Render-Adresse.
2. In der **Google Search Console** die Domain bestätigen und `https://<domain>/sitemap.xml`
   einreichen. Danach dauert es erfahrungsgemäß Tage bis Wochen, bis Seiten erscheinen.
