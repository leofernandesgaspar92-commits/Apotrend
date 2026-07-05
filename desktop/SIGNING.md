# Code-Signing der Desktop-Installer

Aktuell werden die Installer **unsigniert** gebaut — funktionsfähig, aber
Windows/macOS zeigen beim ersten Start eine Sicherheitswarnung. Für die
Verteilung an Apotheken sollten sie **signiert** sein. Die CI ist bereits
vorbereitet: sobald die unten genannten GitHub-Secrets existieren, signiert
`electron-builder` automatisch. Ohne Secrets bleibt alles wie bisher.

> Kurz: **Du brauchst Zertifikate (kostenpflichtig) und legst sie als
> GitHub-Secrets ab. Code-Änderungen sind dann kaum noch nötig.**

---

## Windows (Authenticode)

1. **Zertifikat besorgen** — ein „Code Signing Certificate" (OV oder, für sofort
   fehlerfreies SmartScreen, EV) von einer CA (z. B. Sectigo, DigiCert,
   GlobalSign). Du bekommst eine `.pfx`-Datei (bzw. bei EV ein Hardware-Token/
   Cloud-HSM — dann ist der Weg etwas anders, frag mich dazu).
2. **Als Secrets hinterlegen** (Repo → Settings → Secrets and variables → Actions):
   - `WIN_CSC_LINK` = die `.pfx` **base64-kodiert**
     (`base64 -w0 cert.pfx` bzw. macOS `base64 -i cert.pfx`)
   - `WIN_CSC_KEY_PASSWORD` = das Passwort der `.pfx`
3. Fertig — der nächste Build signiert die `.exe` automatisch.

## macOS (Developer ID + Notarisierung)

1. **Apple Developer Program** (99 USD/Jahr). Dort ein Zertifikat
   **„Developer ID Application"** erstellen und als `.p12` exportieren.
2. **Secrets hinterlegen**:
   - `MAC_CSC_LINK` = die `.p12` **base64-kodiert**
   - `MAC_CSC_KEY_PASSWORD` = Passwort der `.p12`
   - `APPLE_ID` = deine Apple-ID (E-Mail)
   - `APPLE_APP_SPECIFIC_PASSWORD` = ein **app-spezifisches Passwort**
     (appleid.apple.com → Anmeldung & Sicherheit)
   - `APPLE_TEAM_ID` = deine Team-ID (Apple Developer → Membership)
3. **Notarisierung einschalten** — in `desktop/package.json` unter `build.mac`
   ergänzen:
   ```json
   "mac": { "target": ["dmg"], "icon": "build/icon.png",
            "category": "public.app-category.medical", "notarize": true }
   ```
   (Erst einschalten, wenn die vier Apple-Secrets gesetzt sind — sonst schlägt
   der Build fehl, weil die Notarisierung keine Zugangsdaten findet.)

---

## Was die CI schon kann
`.github/workflows/desktop-build.yml` übergibt `CSC_LINK`, `CSC_KEY_PASSWORD`
(je nach OS) sowie die `APPLE_*`-Variablen aus den Secrets an `electron-builder`.
Sind sie leer, wird unsigniert gebaut. Sind sie gesetzt, wird signiert — ohne
weitere Workflow-Änderung (außer dem einen `notarize: true` für macOS).

## Auto-Update (späterer Schritt)
Signierte Releases sind die Voraussetzung für automatische Updates
(`electron-updater` gegen GitHub-Releases). Sag Bescheid, wenn wir das nach dem
Signing angehen.
