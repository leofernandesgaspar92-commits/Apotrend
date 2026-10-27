# ApoPulse Feed-App — live schalten (Deployment)

Diese App (grüne, personenzentrierte Feed-Plattform: Feed, Engpässe, Preise,
Rabatte, News, Profile, Suche) ist ein **Node-Server** — sie kann **nicht** auf
GitHub Pages laufen (Pages liefert nur statische Dateien aus). Sie braucht einen
**Node-fähigen Host**. Unten die einfachste Variante plus Alternativen.

## 🚀 Schnellster Weg: 1-Klick auf Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leofernandesgaspar92-commits/ApoPulse/tree/feed-first)

Auf den Button klicken → bei Render mit GitHub anmelden → Render liest die
`render.yaml` und richtet den Dienst ein → **Apply**. Nach ~1–2 Minuten bekommst
du eine Live-URL wie `https://apopulse-feed.onrender.com`.
(Beim Deploy fragt Render nach `APOPULSE_ADMIN_PASSWORD` — ein Passwort deiner
Wahl für den Redaktions-/Moderations-Login setzen.)

> **Wo liegt die App?** Branch `feed-first`, Unterordner `server/`.
> Start: `npm start` (= `node src/http/server.js`), Port über `process.env.PORT`.
> Keine externen npm-Pakete, keine Datenbank nötig — nur Node 22+.

---

## Option A — Render.com (empfohlen, kostenloser Tarif)

Am einfachsten, weil im Repo bereits eine `render.yaml` (Blueprint) liegt.

1. Konto auf **https://render.com** anlegen (mit GitHub anmelden).
2. Oben rechts **New +** → **Blueprint**.
3. Das Repo **`leofernandesgaspar92-commits/ApoPulse`** auswählen.
4. Render liest `render.yaml` automatisch (Branch `feed-first`, Ordner `server/`,
   `npm start`). **Apply** klicken.
5. Nach 1–2 Minuten bekommst du eine URL wie
   `https://apopulse-feed.onrender.com` — **das ist die neue App**.

Health-Check läuft gegen `/api/health`. PORT setzt Render selbst.

> Kostenloser Tarif: Der Dienst „schläft" nach Inaktivität ein und braucht beim
> ersten Aufruf ~30 s zum Aufwachen — normal, kein Fehler.

> ✅ **Stand 12.10.2026:** Der Dienst läuft auf einem bezahlten Tarif (0.5c-512mb, in
> `render.yaml` als `plan: starter`) und schläft nicht mehr ein. Der folgende Hinweis gilt,
> falls er je wieder auf „free" gestellt wird.
>
> ⚠️ **Wichtig für aktuelle Daten:** Solange der Dienst schläft (ca. 15 Min. ohne
> Besucher), laufen **keine Abrufe** — weder News (alle 5 Min.) noch Engpässe (alle
> 4 Std.). Die Daten werden dann still alt. Die App sagt das ehrlich („Letzter Abruf
> vor 3 Std."), aber wer Informationen verkaufen will, braucht einen Dienst, der
> durchläuft. Zwei Wege:
> 1. **Render „Starter"** (bezahlt, schläft nie) — in Render unter *Settings → Instance
>    Type*. Der saubere Weg.
> 2. **Uptime-Ping** (kostenlos, Notlösung): ein Dienst wie UptimeRobot ruft alle
>    5–10 Min. `https://<deine-url>/api/health` auf und hält den Dienst wach. Das
>    Kontingent des kostenlosen Tarifs reicht für einen Dienst rund um die Uhr knapp.
>
> Ob die Abrufe laufen, zeigt das Redaktions-Dashboard unter **📡 Datenquellen**
> (Bericht kopierbar).

---

## Option B — Railway.app (auch sehr einfach)

1. Konto auf **https://railway.app** (mit GitHub).
2. **New Project** → **Deploy from GitHub repo** → dieses Repo.
3. In den Service-Settings setzen:
   - **Root Directory:** `server`
   - **Branch:** `feed-first`
   - **Start Command:** `npm start`
4. Railway vergibt automatisch eine öffentliche URL.

---

## Option C — beliebiger Docker-Host (Fly.io, VPS, …)

Im Ordner `server/` liegt ein fertiges **`Dockerfile`**.

```bash
cd server
docker build -t apopulse-feed .
docker run -p 4000:4000 apopulse-feed
# → http://localhost:4000
```

Für Fly.io: `fly launch` im Ordner `server/` (nutzt das Dockerfile), dann `fly deploy`.

---

## Wochenbericht per E-Mail (Premium)

Jeden Montag früh bekommen Premium-Kund:innen einen Bericht: beobachtete Wirkstoffe,
Frühwarnungen aus dem Ausland, neue Engpässe im Heimatland — mit Quelle. Höchstens einmal pro
Woche (auch über Neustarts), abbestellbar per Link und Schalter. Ohne Einrichtung ist der
Versand **aus**; die Vorschau auf der Premium-Seite funktioniert trotzdem.

Einrichtung (einmalig, ca. 15 Minuten):
1. Konto bei **Resend** (resend.com) oder **Postmark** (postmarkapp.com) anlegen.
2. Dort die Absender-Domain (z. B. `apopulse.com`) hinzufügen und die angezeigten DNS-Einträge
   beim Domain-Anbieter eintragen. Erst nach der Bestätigung kommen Mails an.
3. In Render → Environment eintragen:
   - `APOPULSE_MAIL_PROVIDER` = `resend` oder `postmark`
   - `APOPULSE_MAIL_API_KEY` = der API-Schlüssel des Anbieters
   - `APOPULSE_MAIL_FROM` = z. B. `ApoPulse <bericht@apopulse.com>`
4. Speichern (Render startet neu). Ob der Versand an ist, zeigt `GET /api/live/status` → `mail`.
   Sofort testen: Redaktions-Konto, `POST /api/live/run/wochenbericht`.

## Anmelden mit Telefonnummer (SMS-Code)

Für Afrika oft die einfachste Anmeldung: Nummer eingeben, 6-stelliger Code per SMS, fertig —
ohne E-Mail, ohne Passwort. Ohne Einrichtung ist die Funktion **aus** (kein Knopf, keine Kosten).
Jede SMS kostet beim Anbieter ein paar Cent; Bremsen: je Nummer 3, je Internet-Adresse 30 Codes pro Stunde
(in Afrika teilen sich oft viele Handys eines Netzes eine Adresse — darum nicht enger), insgesamt
höchstens 100 SMS pro Stunde (`APOPULSE_SMS_MAX_STUNDE` ändert das), nur an Nummern aus den Ländern des Registers.
Ist die Gesamtgrenze erreicht, lesen Nutzer:innen „SMS-Anmeldung gerade ausgelastet — oder mit E-Mail anmelden".
**Start-Tag / Werbeaktion:** Wenn viele gleichzeitig kommen sollen (z. B. TikTok-Kampagne), die Grenze für
diese Tage anheben (etwa `APOPULSE_SMS_MAX_STUNDE` = 300) und das Guthaben beim Anbieter prüfen.

Einrichtung mit **Africa's Talking** (Afrika-Anbieter, günstig in KE/UG/TZ/NG/RW/MW/ZM …):
1. Konto auf africastalking.com anlegen, eine App erstellen, Guthaben aufladen.
2. Unter „Settings → API Key" einen Schlüssel erzeugen.
3. Optional eine Absender-ID („ApoPulse") beantragen — je Land unterschiedlich, dauert Tage.
4. In Render → Environment eintragen:
   - `APOPULSE_SMS_PROVIDER` = `africastalking`
   - `APOPULSE_SMS_USERNAME` = der App-Benutzername (zum Testen `sandbox`)
   - `APOPULSE_SMS_API_KEY` = der API-Schlüssel
   - optional `APOPULSE_SMS_FROM` = die genehmigte Absender-ID

Alternativ **Twilio** (weltweit): `APOPULSE_SMS_PROVIDER` = `twilio`, `APOPULSE_SMS_USERNAME` =
Account SID (`AC…`), `APOPULSE_SMS_API_KEY` = Auth Token, `APOPULSE_SMS_FROM` = Twilio-Nummer (Pflicht).

Danach erscheint auf der Anmeldeseite groß „Mit Telefonnummer anmelden". Ob der Versand an ist,
zeigt `GET /api/auth/providers` → `telefon: true`.

## Anzeigen für Unternehmen (Einnahmen)

Pharma, Großhandel und Logistik buchen Anzeigen selbst („Menü → Werben auf ApoPulse"). Damit
sie **per Rechnung** zahlen können, in Render → Environment setzen:
`APOPULSE_FIRMA_NAME`, `APOPULSE_FIRMA_ANSCHRIFT`, `APOPULSE_BANK_IBAN` (Pflicht),
optional `APOPULSE_FIRMA_UST_ID`, `APOPULSE_BANK_BIC`, `APOPULSE_UST_SATZ` (mit der Steuerberatung
klären) und `APOPULSE_WERBEPREISE` (z. B. `start:490,feed:290,seite:190`). Ohne diese Angaben
geht nur Krypto. Regeln und Rechtsrahmen: `docs/WERBUNG.md`.

## Business-Tarif mit Daten-Schnittstelle (Einnahmen)

Großhandel, Ketten und Einkauf holen Engpassdaten per Schlüssel direkt in Warenwirtschaft oder
Excel („Menü → Daten-Schnittstelle"). Nichts einzurichten: Der Tarif nutzt die Zahlungswege von
Premium (Krypto bleibt). Preise optional über `APOPULSE_PREISE_BUSINESS` (z. B.
`monat:99,jahr:990`). Endpunkte, Felder und Regeln: `docs/DATEN_API.md`.

## Rechnungen für Premium und Business

Mit `APOPULSE_FIRMA_NAME` und `APOPULSE_FIRMA_ANSCHRIFT` (dieselben Angaben wie für Anzeigen)
bekommen Kund:innen nach jeder Zahlung — auch Krypto — eine Rechnung. Mit zusätzlich
`APOPULSE_BANK_IBAN` können Firmen **per Rechnung (Überweisung)** zahlen; die Redaktion
verbucht den Eingang in der Prüfliste. Umsatzsteuer über `APOPULSE_UST_SATZ` (mit der
Steuerberatung festlegen); Empfänger außerhalb der EU bekommen keine Umsatzsteuer, sondern einen
Hinweis auf den Leistungsort (`APOPULSE_UST_DRITTLAND=mit` = altes Verhalten). Einzelheiten:
`docs/RECHNUNGEN.md`.

## Regionale Premium-Preise (Kaufkraft)

**Standard seit 22.10.2026: `AFRICA:30`** — Premium für Konten mit Heimatland in Afrika kostet
30 % des Listenpreises (3,00 € statt 9,99 €/Monat). Beschlossen mit Owner-Freigabe („entscheid
du"); Begründung in `src/domain/regionPreis.js`. Ändern über `APOPULSE_PREISE_REGION`, z. B.
`AFRICA:40` oder `AFRICA:30,AMERICAS:80` (erlaubt 1–100, also nur Ermäßigungen); `aus` (oder leer
gesetzt) = überall Listenpreis. Business und Anzeigen bleiben immer
beim Listenpreis. Krypto, Überweisung, Karte und Rechnung rechnen mit demselben Betrag. Es zählt
das Heimatland des Kontos, nicht das gerade angesehene Land.

## Sofort-Alarm aufs Handy (Web-Push)

Funktioniert ohne Einrichtung. **Empfohlen:** einmal feste Schlüssel erzeugen
(`npm run vapid-schluessel`) und `APOPULSE_VAPID_PUBLIC_KEY` / `APOPULSE_VAPID_PRIVATE_KEY`
in Render setzen (privater Schlüssel = wie ein Passwort). Ohne feste Schlüssel erzeugt der
Server selbst welche und sichert sie mit dem Datenstand — gehen die Daten verloren, müssen alle
Geräte den Alarm neu einschalten. iPhone: nur als App vom Home-Bildschirm (iOS 16.4+).
Einzelheiten: `docs/PUSH.md`.

## Bei Google gefunden werden

Öffentliche Engpass-Seiten (`/engpaesse/...`), `robots.txt` und `sitemap.xml` laufen ohne
Einrichtung. Wichtig: `APOPULSE_PUBLIC_URL` auf die echte Domain setzen und die Sitemap in der
Google Search Console einreichen. Einzelheiten: `docs/OEFFENTLICHE_SEITEN.md`.

## Startklar-Check (was fehlt noch?)

Im Redaktions-Dashboard ganz oben: **„Startklar: X von Y erledigt"** — Datenbank, Anmeldung,
Behördenlisten, Domain, E-Mail, Push-Schlüssel, Rechnungen, Überweisung, Umsatzsteuer,
Krypto (inkl. USDT über Tron für Afrika), Karte/PayPal. Je Punkt „Warum" und „So geht's".
Die Prüfung sieht nur, OB etwas gesetzt ist — sie zeigt nie einen Wert oder ein Geheimnis
(`server/src/services/startklar.js`).

## Datenspeicherung (Persistenz)

Der Server kann seinen kompletten Zustand als **JSON-Snapshot** auf die Platte
schreiben und beim Start zurückladen — Beiträge, Profile, Follows, Nachrichten
usw. überleben dann einen Neustart.

Aktiviert wird das über eine Umgebungsvariable:

```bash
APOPULSE_DATA_FILE=/pfad/zu/apopulse.json npm start
```

- **Ohne** die Variable läuft alles rein **In-Memory** (Neustart = leer). Gut für Tests.
- **Mit** der Variable wird nach jeder Schreiboperation (gedrosselt, atomar) und
  beim sauberen Herunterfahren gespeichert.

**Wichtig je nach Host:**
- **Render (kostenlos):** Das Dateisystem ist *flüchtig*. Daten überleben einen
  Prozess-Neustart innerhalb derselben Instanz, aber **nicht ein neues Deploy**.
  Für dauerhafte Speicherung eine **Render-Disk** anlegen (Bezahltarif) und den
  Mountpfad als `APOPULSE_DATA_FILE` verwenden (in `render.yaml` vorbereitet).
- **Railway / Fly.io / eigener Server:** ein persistentes Volume mounten und
  `APOPULSE_DATA_FILE` daraufsetzen.

**Ehrlicher Ausblick:** Der JSON-Snapshot ist ideal für Einzelinstanz + Ausprobieren.
Für **echten Mehr-Instanz-Betrieb in der EU** kommt später **Postgres** hinter
denselben Repository-Seam (die `db/*.sql`-Schemata liegen bereit). Der Umstieg
berührt nur die Repo-Schicht, nicht die Services/UI.

---

## Redaktions-/Moderations-Login

Ein Konto mit dem Profil-Flag `is_editorial` ist zugleich **Moderation** (sieht
die 🛡️-Queue gemeldeter Beiträge). Zugangsdaten über Umgebungsvariablen:

```bash
APOPULSE_ADMIN_EMAIL=redaktion@apopulse.at
APOPULSE_ADMIN_PASSWORD=<sicheres-passwort>
```

Ohne gesetztes Passwort erzeugt der Server beim Frischstart ein zufälliges und
**loggt es einmalig** in die Server-Konsole (`ℹ️ Redaktions-/Moderations-Login: …`).
Für den echten Betrieb immer `APOPULSE_ADMIN_PASSWORD` setzen.

## Lokal testen (ohne Host)

```bash
cd server
npm start
# → http://localhost:4000  (registrieren, posten, Tabs durchklicken)
npm test   # 60 automatisierte Tests
```
