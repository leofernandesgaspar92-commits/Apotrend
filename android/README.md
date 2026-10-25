# ApoPulse als Android-App im Google Play Store

Diese Anleitung führt vom heutigen Stand bis zur veröffentlichten App.
Sie ist für jemanden geschrieben, der noch nie eine App veröffentlicht hat.

---

## Auf einen Blick — Ihre Schritte

| # | Schritt | Dauer | Kosten |
|---|---|---|---|
| 0 | Domain `apopulse.com` sichern und auf Render zeigen lassen | 1 Stunde | ca. 10–15 USD/Jahr |
| 1 | Google-Play-Entwicklerkonto anlegen | 1 Tag (Prüfung durch Google) | 25 USD einmalig |
| 2 | Signaturschlüssel erzeugen und doppelt sichern | 10 Minuten | — |
| 3 | App bauen (Bubblewrap) | 30 Minuten | — |
| 4 | Fingerabdrücke in Render eintragen | 10 Minuten | — |
| 5 | Store-Eintrag ausfüllen (Texte und Bilder liegen bereit) | 1–2 Stunden | — |
| 6 | Geschlossener Test mit 12 Personen, 14 Tage | 2–3 Wochen | — |
| 7 | Produktion beantragen | wenige Tage | — |

**Realistisch: drei bis sechs Wochen** bis zur Veröffentlichung — wegen Schritt 6.

---

## Was hier vorbereitet ist

| Was | Wo |
|---|---|
| App-Konfiguration (Paket `com.apopulse.app`) | `android/twa-manifest.json` |
| Verifikationsdatei (Server liefert sie aus) | `server/src/http/assetlinks.js` |
| PWA-Manifest auf Play-Niveau | `server/public/manifest.webmanifest` |
| App-Symbol 512 × 512 | `server/public/icon-512.png` |
| Feature-Grafik 1024 × 500 | `server/public/store/feature-graphic-1024x500.png` |
| **Screenshots je Sprache** 1080 × 1920 (EN, FR, PT, AR) | `android/store-screenshots/<sprache>/` |
| Screenshots Deutsch (Österreich) | `server/public/store/screen-*.png` |
| **Store-Texte EN · FR · PT · AR · DE** | `android/store-listing.md` |
| Datenschutzerklärung (Entwurf) | `server/public/datenschutz.html` |
| Kauf in der App ausgeblendet (Google-Regel, siehe unten) | `server/public/app.js` → `istPlayApp` |

Die Screenshots erzeugt `node tools/store-screens-afrika.mjs` (im Ordner `server`) aus der
echten App neu — z. B. nach einer Design-Änderung. Sie zeigen Beispiel-Meldungen und tragen
deshalb oben das Band „Example data" / „Données d'exemple".

---

## ⚠️ Bezahlen: Website ja, Play-App nein

Google erlaubt in Play-Apps für digitale Abos **nur Google Play Billing** (Google behält
15 % ein). Krypto-Zahlung, Rechnung und Kartenzahlung sind **in der Play-App verboten** —
ebenso ein Hinweis wie „kaufen Sie auf unserer Website". Verstöße führen zur Sperre der App.

**So ist es gelöst:**

| | Website (Browser, auch „Zum Startbildschirm") | Play-App |
|---|---|---|
| Krypto (USDT, Bitcoin …) | ✅ **unverändert, vollständig** | ausgeblendet |
| Rechnung / Überweisung | ✅ | ausgeblendet |
| Premium-Vorteile ansehen | ✅ | ✅ |
| Premium nutzen, wenn schon gekauft | ✅ | ✅ (gleiches Konto) |
| Anzeigen buchen | ✅ | ausgeblendet |

Die App erkennt sich an der Startadresse `/?src=twa` (steht in `twa-manifest.json`) und
merkt sich das **nur für die laufende Sitzung**. Wer dieselbe Seite danach normal in Chrome
öffnet, sieht wieder alle Zahlwege — das prüft `npm run verify` bei jedem Durchlauf.

**Später (eigene Stufe):** Google Play Billing einbauen, sobald die App in der Play Console
existiert. Dann kann man Premium auch in der App kaufen; die Website bleibt bei Krypto.

**Store-Text:** Die Texte in `store-listing.md` erwähnen keine Preise und keine Bezahlwege —
mit Absicht.

---

## Schritt 0 — Domain

Empfehlung: **`apopulse.com`** — kurz, gleich wie der App-Name, international.
Falls vergeben: `apopulse.app` oder `apopulse.africa`.

1. Domain bei einem Anbieter kaufen (z. B. Namecheap, Cloudflare, Porkbun).
2. In Render: Dienst `apopulse-feed` → *Settings* → *Custom Domains* → `www.apopulse.com`
   und `apopulse.com` hinzufügen. Render zeigt an, welche DNS-Einträge Sie beim
   Domain-Anbieter setzen müssen; das HTTPS-Zertifikat kommt automatisch.
3. Prüfen: `https://www.apopulse.com` zeigt ApoPulse.

> **Nehmen Sie eine andere Domain**, muss sie in `android/twa-manifest.json` überall
> statt `www.apopulse.com` stehen (Felder `host`, `iconUrl`, `maskableIconUrl`,
> `webManifestUrl`, `fullScopeUrl`, `chosenIconUrl`) — **bevor** Sie in Schritt 3 bauen.
> Sagen Sie Bescheid, dann stelle ich es um.

---

## Schritt 1 — Entwicklerkonto anlegen

1. <https://play.google.com/console> öffnen, mit einem Google-Konto anmelden.
2. **Kontotyp wählen:**
   - *Privatperson*: sofort möglich, dafür **12 Testpersonen × 14 Tage** (siehe Schritt 6).
   - *Organisation (Firma)*: keine 12-Tester-Pflicht, braucht aber eine D-U-N-S-Nummer
     (kostenlos, dauert einige Tage).
3. 25 USD zahlen (einmalig, nicht jährlich). Google prüft danach Ihren Ausweis.

---

## Schritt 2 — Signaturschlüssel erzeugen

Dieser Schlüssel ist die Identität Ihrer App. **Geht er verloren, können Sie nie
wieder ein Update für dieselbe App veröffentlichen.** Es gibt keine Wiederherstellung.

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

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) baut aus der Website ein
Android-Paket. Es braucht Node.js und ein Java JDK.

```bash
npm install -g @bubblewrap/cli

cd android
# Nutzt die vorbereitete twa-manifest.json in diesem Ordner:
bubblewrap build
```

Heraus kommt `app-release-bundle.aab` — das ist die Datei für den Play Store.

> **Falls Bubblewrap nach Android SDK oder JDK fragt:** Beim ersten Start bietet es an,
> beides herunterzuladen. Das ist der einfachste Weg; bestätigen.
>
> **Ohne Kommandozeile:** <https://www.pwabuilder.com> → `https://www.apopulse.com`
> eingeben → *Package for stores* → *Android*. Dort **Package ID `com.apopulse.app`**
> und **Start URL `/?src=twa`** eintragen — ohne `?src=twa` zeigt die App die Zahlwege,
> und Google sperrt sie.

---

## Schritt 4 — Fingerabdrücke in Render eintragen

Ohne diesen Schritt zeigt die App eine **Browser-Adressleiste** über Ihrer Seite.

Android prüft beim Start, ob `https://www.apopulse.com/.well-known/assetlinks.json`
den Fingerabdruck Ihrer App nennt. Der Server liefert diese Datei bereits aus —
er braucht nur die Werte.

**In Render unter `apopulse-feed` → Environment eintragen:**

| Variable | Wert |
|---|---|
| `APOPULSE_ANDROID_PACKAGE` | `com.apopulse.app` |
| `APOPULSE_ANDROID_SHA256` | **zwei** Fingerabdrücke, mit Komma getrennt |

### Welche zwei Fingerabdrücke — die häufigste Fehlerquelle

Sie laden die App mit **Ihrem** Schlüssel hoch. Google signiert sie danach **neu** mit
einem eigenen (Play App Signing, bei neuen Apps Pflicht). Auf dem Telefon landet also
ein **anderer** Fingerabdruck als Ihrer.

1. **Googles Fingerabdruck:** Play Console → *Test und Veröffentlichung* →
   *App-Integrität* → *App-Signaturschlüssel* → SHA-256 kopieren.
2. **Ihr eigener:**
   ```bash
   keytool -list -v -keystore apopulse-upload.keystore -alias apopulse
   ```
   Die Zeile `SHA256:` kopieren.

Beide, durch Komma getrennt, in `APOPULSE_ANDROID_SHA256`. Groß-/Kleinschreibung und
Doppelpunkte sind egal — der Server normalisiert das.

**Kontrolle nach dem Deploy:** Im Render-Log muss stehen

```
ApoPulse Android: assetlinks.json aktiv für com.apopulse.app (2 Fingerabdrücke).
```

Steht dort „mit EINEM Fingerabdruck", fehlt einer — und die Adressleiste kommt.

---

## Schritt 5 — Store-Eintrag ausfüllen

**Standardsprache: Englisch** (Zielmarkt Afrika). In der Play Console unter
*Store-Eintrag* → *Übersetzungen verwalten* Französisch, Portugiesisch, Arabisch und
Deutsch hinzufügen.

| Feld | Woher |
|---|---|
| Titel, Kurz- und Vollbeschreibung | `android/store-listing.md` — je Sprache ein Abschnitt |
| App-Symbol | `server/public/icon-512.png` |
| Feature-Grafik | `server/public/store/feature-graphic-1024x500.png` |
| Screenshots Englisch | `android/store-screenshots/en/` (4 Stück) |
| Screenshots Französisch / Portugiesisch / Arabisch | `…/fr/`, `…/pt/`, `…/ar/` |
| Screenshots Deutsch | `server/public/store/screen-*.png` |
| Datenschutz-URL | `https://www.apopulse.com/datenschutz.html` |

> **Vor dem Absenden:** Französisch und Arabisch von je einer Muttersprachlerin bzw.
> einem Muttersprachler lesen lassen — am besten aus einer Apotheke.
> Und in `datenschutz.html` die rot markierten Lücken füllen (Name, Anschrift,
> SMS-Anbieter) und rechtlich prüfen lassen.

### Pflichtangaben, die Google zusätzlich abfragt

| Abschnitt | Was einzutragen ist |
|---|---|
| **Datensicherheit** | Siehe Tabelle unten — muss zur Datenschutzerklärung passen |
| **Inhaltsfreigabe** | Fragebogen; die App enthält nutzergenerierte Inhalte (Beiträge, Engpass-Meldungen) |
| **Zielgruppe** | Nicht für Kinder. Berufliche Nutzung, 18+ |
| **Kategorie** | *Medizin* (alternativ *Wirtschaft*) |
| **Gesundheits-Apps** | ApoPulse ist ein **Informationsdienst für Fachkreise**, kein Medizinprodukt, keine Therapieempfehlung — genau so formulieren |
| **Werbung** | „Enthält Werbung": **Nein**, solange keine Anzeige läuft. Sobald die erste gekennzeichnete Anzeige einer Fachfirma live ist (gebucht über die Website), auf **Ja** ändern |
| **In-App-Käufe** | Nein (bis Google Play Billing eingebaut ist) |

### Datensicherheits-Formular (passend zum Code)

| Frage | Antwort |
|---|---|
| Werden Daten erhoben? | Ja |
| E-Mail-Adresse | Erhoben, für Kontoverwaltung, **nicht geteilt** |
| Name | Erhoben, für Kontoverwaltung, **nicht geteilt** |
| **Telefonnummer** | Erhoben, **optional** (nur bei Anmeldung per SMS-Code), für Kontoverwaltung, **nicht geteilt** — der SMS-Dienstleister stellt nur zu und zählt bei Google als „Dienstleister", nicht als Weitergabe |
| Nutzergenerierte Inhalte | Erhoben (Beiträge, Meldungen), **nicht geteilt** |
| Standort | **Nein** — das Land wird aus der Zeitzone geschätzt, nie per GPS |
| Finanzdaten | **Nein** — in der Play-App wird nichts bezahlt |
| Gesundheitsdaten | **Nein** — keine Patientendaten |
| Verschlüsselt übertragen? | Ja (HTTPS durchgehend) |
| Löschung möglich? | Ja, in der App unter *Profil → Konto löschen* |

---

## Schritt 6 — Geschlossener Test (12 Personen, 14 Tage)

Bei einem **privaten** Entwicklerkonto schaltet Google „In Produktion veröffentlichen" erst
frei, wenn **12 Testpersonen 14 Tage ununterbrochen** dabei waren. Fällt die Zahl
zwischendurch unter 12, beginnt die Frist von vorn — laden Sie deshalb 15–20 ein.

1. Play Console → *Test und Veröffentlichung* → **Geschlossener Test** → neuer Track.
2. `app-release-bundle.aab` hochladen.
3. Testpersonen per E-Mail-Liste (Gmail-Adressen) einladen. Ideal: Apotheker:innen aus
   Ghana, Nigeria, Senegal — genau die Rückmeldung, die das Produkt braucht.
4. **Auf einem echten Telefon prüfen:**
   - Erscheint oben eine Adressleiste? Dann stimmt Schritt 4 nicht.
   - Premium öffnen: Es darf **kein** Kaufknopf und keine Krypto-Adresse erscheinen.
5. Nach 14 lückenlosen Tagen: Produktionszugang beantragen (Google stellt dazu ein paar
   Fragen zum Test).

---

## Was die App technisch ist

Eine **Trusted Web Activity**: ein dünner Android-Rahmen, der `https://www.apopulse.com`
im Vollbild zeigt. Es gibt keinen zweiten Code und keine zweite Oberfläche.

- ✅ Jede Änderung an der Website ist sofort in der App — kein neues Update nötig.
- ✅ Keine getrennte Codebasis, keine doppelten Fehler.
- ⚠️ Ist die Website unerreichbar, ist auch die App leer. Der Service Worker fängt das
  teilweise ab (Offline-Hülle), aber Daten kommen keine.
- ⚠️ Google verlangt, dass die App **mehr ist als eine Verpackung einer Website**.
  ApoPulse erfüllt das über die PWA-Eigenschaften: Offline-Hülle,
  Startbildschirm-Verknüpfungen, Benachrichtigungen. Trotzdem ist dies der Punkt, an dem
  eine Ablehnung am ehesten passiert.

---

## Wenn etwas schiefgeht

| Symptom | Ursache | Lösung |
|---|---|---|
| Adressleiste über der App | assetlinks.json stimmt nicht | Schritt 4, meist fehlt der zweite Fingerabdruck |
| App zeigt Krypto/Kaufknopf | Start-Adresse ohne `?src=twa` gebaut | `startUrl` in `twa-manifest.json` prüfen, neu bauen |
| Ablehnung „Zahlungsrichtlinie" | Kauf oder Verweis auf Kauf sichtbar | Melden — die Stelle wird in `istPlayApp` ergänzt |
| „App muss Android 16 (API 36) targeten" | `targetSdkVersion` zu niedrig | Steht in `twa-manifest.json` auf 36; Bubblewrap aktualisieren |
| Ablehnung „nur eine Website" | Zu wenig App-Charakter | Verknüpfungen, Offline-Verhalten, Benachrichtigungen im Formular ausdrücklich nennen |
| Ablehnung wegen Datenschutz | URL fehlt oder Formular widerspricht der Erklärung | Beides muss übereinstimmen |
