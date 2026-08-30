# ApoPulse – Apotheken-Marktintelligenz

Single-File-Web-App für Apotheken: Engpass-Monitor, Preis-Tracker, KI-Prognosen,
Chat zwischen Apothekern, Lieferanten-Verwaltung, News, Watchlist, Admin & API-Simulation.

## Design
Helles Standard-Design mit **weißem Hintergrund und grünen Akzenten**. Über den
🌙/☀️-Button lässt sich auf Dark-Mode umschalten (gespeichert in localStorage).

## Nutzung
`index.html` im Browser öffnen – keine Installation, kein Build. Externe
Abhängigkeiten nur per CDN (Chart.js, SheetJS, JSZip, FileSaver).

## Auf GitHub veröffentlichen
1. Neues, leeres Repository auf GitHub anlegen (z. B. `apopulse`).
2. Diesen Ordner committen und pushen:
   ```bash
   git init
   git add .
   git commit -m "ApoPulse initial"
   git branch -M main
   git remote add origin https://github.com/<dein-user>/apopulse.git
   git push -u origin main
   ```
3. In den Repo-Einstellungen **Pages** aktivieren (Branch main, Ordner /root).
   Die App ist dann unter https://<dein-user>.github.io/apopulse/ erreichbar,
   da index.html automatisch als Einstieg dient.

## Plattformen: Mobile (PWA) vs. Desktop

Derselbe Web-Kern (`frontend/index.html`) läuft auf zwei Wegen:

### 📱 Mobile / PWA — **kein Build nötig**
Die mobile Version ist `frontend/index.html` selbst: statisch ausgeliefert
(GitHub Pages) und im Browser **als App installierbar** (Manifest + Service Worker
werden zur Laufzeit erzeugt, „Zum Startbildschirm hinzufügen"). Nichts zu bauen.
```bash
npm run build:mobile   # gibt nur den Hinweis aus: kein Build nötig
```
Ansehen: `frontend/index.html` im Browser öffnen.

### 🖥️ Desktop — installierbares Programm (Windows/macOS/Linux)
Eine **additive** Electron-Hülle (`desktop/`) lädt **dieselbe** `frontend/index.html`
in ein Desktop-Fenster — ohne die Mobile-Version zu verändern.
```bash
npm run start:desktop        # App-Fenster starten (Entwicklung)
npm run build:desktop        # Installer für das aktuelle OS bauen -> desktop/dist/
npm run build:desktop:win    # nur Windows (auf Windows)
npm run build:desktop:mac    # nur macOS  (auf macOS)
npm run build:desktop:linux  # nur Linux  (auf Linux)
```
Details, Voraussetzungen und offene Punkte (Icon, Code-Signing, Auto-Update,
Offline): siehe [`desktop/README.md`](desktop/README.md).

> **Wichtig:** Mobile und Desktop teilen sich nur den Web-Kern. Der Desktop-Build
> lebt vollständig in `desktop/` und ändert `frontend/index.html` nicht.

## Hinweise
- Alle E-Mail-, API-, 2FA- und Sync-Funktionen sind **Simulationen** (kein echter Server/SMTP).
- Demo-2FA-Code: `123456`.
