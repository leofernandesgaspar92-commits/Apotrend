# ApoPulse als Android-App im Google Play Store

Diese Anleitung führt vom fertigen Zustand (jetzt) bis zur veröffentlichten App.
Sie ist für jemanden geschrieben, der noch nie eine App veröffentlicht hat.

---

## Was hier vorbereitet ist — und was nicht

**Fertig und im Repository:**

| Was | Wo |
|---|---|
| TWA-Konfiguration | `android/twa-manifest.json` |
| Verifikationsdatei (Server liefert sie aus) | `server/src/http/assetlinks.js` |
| PWA-Manifest auf Play-Niveau | `server/public/manifest.webmanifest` |
| App-Symbol 512 × 512 | `server/public/icon-512.png` |
| Feature-Grafik 1024 × 500 | `server/public/store/feature-graphic-1024x500.png` |
| 4 echte Screenshots 1080 × 1920 | `server/public/store/screen-*.png` |
| Store-Texte (DE/EN/PT) | `android/store-listing.md` |
| Datenschutzerklärung (Entwurf) | `server/public/datenschutz.html` |

**Was nur Sie können** — dafür braucht es Ihre Identität, Ihr Geld oder Ihren Rechner:

1. Google-Play-Entwicklerkonto (**25 USD einmalig**)
2. Signaturschlüssel erzeugen (gehört auf Ihren Rechner, nicht ins Repository)
3. Die App bauen und hochladen
4. Datenschutzerklärung rechtlich prüfen lassen und die Lücken ausfüllen

---

## ⚠️ Das Wichtigste zuerst: Sie können nicht sofort veröffentlichen

Wenn Sie das Entwicklerkonto als **Privatperson** anlegen, verlangt Google seit
November 2023:

> **12 Testpersonen, die 14 Tage ununterbrochen angemeldet sind**, bevor der
> Knopf „In Produktion veröffentlichen" überhaupt freigeschaltet wird.

Die 14 Tage müssen **lückenlos** sein. Fällt die Zahl zwischendurch unter 12,
beginnt die Frist von vorn.

**Als Organisation (Firma) entfällt diese Regel.** Dafür braucht Google eine
D-U-N-S-Nummer — die ist kostenlos, dauert aber selbst einige Tage.

**Praktische Folge:** Zwischen „heute angefangen" und „im Store" liegen
realistisch **drei bis sechs Wochen**, nicht drei Tage. Planen Sie die 12
Testpersonen früh — Kolleg:innen aus Apotheken sind ohnehin genau die
Rückmeldung, die dem Produkt fehlt.

---

## Schritt 1 — Entwicklerkonto anlegen

1. <https://play.google.com/console> öffnen, mit einem Google-Konto anmelden.
2. **Kontotyp wählen** — hier fällt die Entscheidung von oben:
   - *Organisation*: braucht D-U-N-S-Nummer, dafür keine 12-Tester-Pflicht.
   - *Privatperson*: sofort möglich, dafür 12 Tester × 14 Tage.
3. 25 USD zahlen (einmalig, nicht jährlich).

---

## Schritt 2 — Signaturschlüssel erzeugen

Dieser Schlüssel ist die Identität Ihrer App. **Geht er verloren, können Sie nie
wieder ein Update für dieselbe App veröffentlichen.** Es gibt keine
Wiederherstellung.

```bash
keytool -genkeypair -v \
  -keystore apopulse-upload.keystore \
  -alias apopulse \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Danach sofort:**
- Datei an zwei getrennten Orten sichern (nicht nur auf dem Arbeitsrechner).
- Passwort in einen Passwortmanager.
- **Niemals ins Repository legen** — `.gitignore` deckt `*.keystore` bereits ab.

---

## Schritt 3 — App bauen

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) baut aus der
Website ein Android-Paket. Es braucht Node.js und ein Java JDK.

```bash
npm install -g @bubblewrap/cli

cd android
# Nutzt die vorbereitete twa-manifest.json in diesem Ordner:
bubblewrap build
```

Heraus kommt `app-release-bundle.aab` — das ist die Datei für den Play Store.

> **Falls Bubblewrap nach Android SDK oder JDK fragt:** Beim ersten Start bietet
> es an, beides herunterzuladen. Das ist der einfachste Weg; bestätigen.

---

## Schritt 4 — Die Verifikation scharf schalten

Ohne diesen Schritt zeigt die App eine **Browser-Adressleiste** über Ihrer Seite.
Sie funktioniert, sieht aber aus wie ein Browserfenster mit Logo.

Android prüft beim Start, ob `https://www.apopulse.com/.well-known/assetlinks.json`
den Fingerabdruck Ihrer App nennt. Der Server liefert diese Datei bereits aus —
er braucht nur die Werte.

**In Render unter `apopulse-feed` → Environment eintragen:**

| Variable | Wert |
|---|---|
| `APOPULSE_ANDROID_PACKAGE` | `com.apopulse.app` |
| `APOPULSE_ANDROID_SHA256` | **zwei** Fingerabdrücke, mit Komma getrennt |

### Welche zwei Fingerabdrücke — das ist die häufigste Fehlerquelle

Sie laden die App mit **Ihrem** Schlüssel hoch. Google signiert sie danach
**neu** mit einem eigenen (Play App Signing, bei neuen Apps Pflicht). Auf dem
Telefon landet also ein **anderer** Fingerabdruck als Ihrer.

Tragen Sie nur Ihren eigenen ein, funktioniert die App beim Selbsttest — und
zeigt nach der Installation aus dem Store eine Adressleiste.

1. **Googles Fingerabdruck:** Play Console → *Test und Veröffentlichung* →
   *App-Integrität* → *App-Signaturschlüssel* → SHA-256 kopieren.
2. **Ihr eigener:**
   ```bash
   keytool -list -v -keystore apopulse-upload.keystore -alias apopulse
   ```
   Die Zeile `SHA256:` kopieren.

Beide, durch Komma getrennt, in `APOPULSE_ANDROID_SHA256`. Groß-/Kleinschreibung
und Doppelpunkte sind egal — der Server normalisiert das.

**Kontrolle nach dem Deploy:** Im Render-Log muss stehen

```
ApoPulse Android: assetlinks.json aktiv für com.apopulse.app (2 Fingerabdrücke).
```

Steht dort „mit EINEM Fingerabdruck", fehlt einer — und die Adressleiste kommt.

---

## Schritt 5 — Store-Eintrag ausfüllen

Texte und Bilder liegen bereit:

- **Texte:** `android/store-listing.md` (Titel, Kurz- und Vollbeschreibung, DE/EN/PT)
- **App-Symbol:** `server/public/icon-512.png`
- **Feature-Grafik:** `server/public/store/feature-graphic-1024x500.png`
- **Screenshots:** `server/public/store/screen-*.png` (vier Stück, echte App)
- **Datenschutz-URL:** `https://www.apopulse.com/datenschutz.html`

### Pflichtangaben, die Google zusätzlich abfragt

| Abschnitt | Was einzutragen ist |
|---|---|
| **Datensicherheit** | Siehe Tabelle unten — muss zur Datenschutzerklärung passen |
| **Inhaltsfreigabe** | Fragebogen; die App enthält nutzergenerierte Inhalte (Beiträge, Engpass-Meldungen) |
| **Zielgruppe** | Nicht für Kinder. Berufliche Nutzung, 18+ |
| **Kategorie** | *Medizin* (alternativ *Wirtschaft*) |
| **Gesundheits-Apps** | Google fragt bei Medizin-Kategorie nach. ApoPulse ist ein **Informationsdienst für Fachkreise**, kein Medizinprodukt, keine Therapieempfehlung — genau so formulieren |

### Datensicherheits-Formular (passend zum Code)

| Frage | Antwort |
|---|---|
| Werden Daten erhoben? | Ja |
| E-Mail-Adresse | Erhoben, für Kontoverwaltung, **nicht geteilt** |
| Name | Erhoben, für Kontoverwaltung, **nicht geteilt** |
| Nutzergenerierte Inhalte | Erhoben (Beiträge, Meldungen), **nicht geteilt** |
| Standort | **Nein** — die App fragt keinen Standort ab |
| Finanzdaten | **Nein** — Zahlungen laufen vollständig beim Dienstleister |
| Gesundheitsdaten | **Nein** — keine Patientendaten |
| Verschlüsselt übertragen? | Ja (HTTPS durchgehend) |
| Löschung möglich? | Ja, in der App unter *Profil → Konto löschen* |

---

## Schritt 6 — Hochladen und testen

1. Play Console → *Produktion* ist anfangs gesperrt (siehe oben). Beginnen Sie
   mit **Geschlossener Test**.
2. `app-release-bundle.aab` hochladen.
3. Testpersonen per E-Mail-Liste einladen (12 Stück, siehe oben).
4. **Prüfen Sie auf einem echten Telefon:** Erscheint oben eine Adressleiste?
   Dann stimmt Schritt 4 nicht.
5. Nach 14 lückenlosen Tagen: Produktionszugang beantragen.

---

## Was die App technisch ist

Eine **Trusted Web Activity**: ein dünner Android-Rahmen, der
`https://www.apopulse.com` im Vollbild zeigt. Es gibt keinen zweiten Code und
keine zweite Oberfläche.

**Das hat Folgen, die man kennen sollte:**

- ✅ Jede Änderung an der Website ist sofort in der App — kein neues Update nötig.
- ✅ Keine getrennte Codebasis, keine doppelten Fehler.
- ⚠️ Ist die Website unerreichbar, ist auch die App leer. Der Service Worker
  fängt das teilweise ab (Offline-Hülle), aber Daten kommen keine.
- ⚠️ Google verlangt, dass die App **mehr ist als eine Verpackung einer
  Website**. ApoPulse erfüllt das über die PWA-Eigenschaften: Offline-Hülle,
  Startbildschirm-Verknüpfungen, Installation, Benachrichtigungs-Fähigkeit.
  Trotzdem ist dies der Punkt, an dem eine Ablehnung am ehesten passiert.

---

## Wenn etwas schiefgeht

| Symptom | Ursache | Lösung |
|---|---|---|
| Adressleiste über der App | assetlinks.json stimmt nicht | Schritt 4, meist fehlt der zweite Fingerabdruck |
| „App muss Android 16 (API 36) targeten" | `targetSdkVersion` zu niedrig | Steht in `twa-manifest.json` auf 36; Bubblewrap aktualisieren |
| Ablehnung „nur eine Website" | Zu wenig App-Charakter | Verknüpfungen und Offline-Verhalten im Formular ausdrücklich nennen |
| Ablehnung wegen Datenschutz | URL fehlt oder Formular widerspricht der Erklärung | Beides muss übereinstimmen |
