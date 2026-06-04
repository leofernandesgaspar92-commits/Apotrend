# ApoTrend – Apotheken-Marktintelligenz

Single-File-Web-App für Apotheken: Engpass-Monitor, Preis-Tracker, KI-Prognosen,
Chat zwischen Apothekern, Lieferanten-Verwaltung, News, Watchlist, Admin & API-Simulation.

## Design
Helles Standard-Design mit **weißem Hintergrund und grünen Akzenten**. Über den
🌙/☀️-Button lässt sich auf Dark-Mode umschalten (gespeichert in localStorage).

## Nutzung
`index.html` im Browser öffnen – keine Installation, kein Build. Externe
Abhängigkeiten nur per CDN (Chart.js, SheetJS, JSZip, FileSaver).

## Auf GitHub veröffentlichen
1. Neues, leeres Repository auf GitHub anlegen (z. B. `apotrend`).
2. Diesen Ordner committen und pushen:
   ```bash
   git init
   git add .
   git commit -m "ApoTrend initial"
   git branch -M main
   git remote add origin https://github.com/<dein-user>/apotrend.git
   git push -u origin main
   ```
3. In den Repo-Einstellungen **Pages** aktivieren (Branch main, Ordner /root).
   Die App ist dann unter https://<dein-user>.github.io/apotrend/ erreichbar,
   da index.html automatisch als Einstieg dient.

## Hinweise
- Alle E-Mail-, API-, 2FA- und Sync-Funktionen sind **Simulationen** (kein echter Server/SMTP).
- Demo-2FA-Code: `123456`.
