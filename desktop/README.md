# ApoTrend Desktop (Electron)

Installierbares Desktop-Programm (Windows / macOS / Linux) aus **demselben
Web-Kern** wie die Mobile-/PWA-Version. Es wird **kein** App-Code dupliziert oder
neu entwickelt: Electron lädt `../frontend/index.html` — dieselbe Datei, die auch
die PWA ist.

> **Die Mobile-/PWA-Version wird dadurch nicht verändert.** `frontend/index.html`
> bleibt unangetastet; der Desktop-Rahmen lädt sie nur (Entwicklung) bzw. bekommt
> beim Bauen eine Kopie (`extraResources`).

## Voraussetzungen (lokal)
- Node.js ≥ 18 und npm
- Zum Erzeugen der Installer baut man **pro Zielsystem auf diesem System**:
  Windows-Installer auf Windows, macOS-`.dmg` auf macOS, Linux auf Linux.
  (electron-builder cross-compiliert nur eingeschränkt.)

## Befehle
Aus dem Repo-Wurzelverzeichnis (bequem):
```bash
npm run start:desktop        # App im Fenster starten (Entwicklung)
npm run build:desktop        # Installer für das aktuelle Betriebssystem bauen
npm run build:desktop:win    # nur Windows (auf Windows ausführen)
npm run build:desktop:mac    # nur macOS  (auf macOS ausführen)
npm run build:desktop:linux  # nur Linux  (auf Linux ausführen)
```
Oder direkt in diesem Ordner:
```bash
cd desktop
npm install
npm start                    # Fenster starten
npm run dist                 # Installer bauen -> desktop/dist/
```

Die fertigen Installer/Pakete landen in `desktop/dist/`
(Windows: NSIS-`.exe`, macOS: `.dmg`, Linux: `AppImage` + `.deb`).

## Wie es funktioniert
- `main.js` — Electron-Hauptprozess. Öffnet ein Fenster und lädt
  `frontend/index.html` (Dev: `../frontend`, gebaut: `resources/frontend`).
  Externe Links öffnen im System-Browser. Keine eigene App-Logik.
- `preload.js` — bewusst leer (Sicherheit: `contextIsolation`).
- `package.json` → Feld `build` — electron-builder-Konfiguration (Targets, Icon,
  `extraResources` = Kopie von `../frontend`).

## Offene Punkte (spätere Schritte, jetzt nicht erzwungen)
- **Icon**: `build/icon.png` (512×512) — grünes Feld mit weißem Apotheken-Kreuz.
  Bei Bedarf durch ein finales Marken-Icon ersetzen (512×512 PNG genügt;
  electron-builder leitet `.ico`/`.icns` daraus ab).
- **Code-Signing**: Die CI ist bereits signatur-*bereit* (unsigniert, bis
  Zertifikate hinterlegt sind). Anleitung, welche Zertifikate/Secrets nötig sind:
  [`SIGNING.md`](SIGNING.md). Ohne Signatur zeigen die Betriebssysteme Warnungen.
- **Auto-Update**: electron-builder unterstützt `electron-updater` (z. B. über
  GitHub Releases). Noch nicht eingerichtet.
- **Offline**: Die App lädt einige Bibliotheken per CDN (Chart.js u. a.). Im
  Desktop-Fenster funktioniert das mit Internet wie im Browser. Für echten
  Offline-Betrieb müssten diese später lokal gebündelt werden.
