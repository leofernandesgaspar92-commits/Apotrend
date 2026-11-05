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

## Läuft der neueste Stand? (30-Sekunden-Prüfung)

Render baut **nur den Branch `feed-first`** (siehe `render.yaml`). Ob der neueste Stand wirklich live ist:

1. Im Browser `https://<deine-adresse>/api/health` öffnen.
2. Dort steht z. B. `"version":{"commit":"8edf065","branch":"feed-first","gestartet":"…"}`.
3. Auf GitHub den neuesten Commit von `feed-first` ansehen — die ersten 7 Zeichen müssen gleich sein.
   Stimmt es nicht: in Render „Manual Deploy → Deploy latest commit".

Dasselbe steht im Betriebs-Cockpit (Menü → Moderation) unten: „Läuft: Version … vom Branch …".
`commit: null` heißt: nicht auf Render (z. B. lokal) — dort gibt es diese Angabe nicht.

## Startklar-Check (was fehlt noch?)

Im Redaktions-Dashboard ganz oben: **„Startklar: X von Y erledigt"** — Datenbank, Anmeldung,
Behördenlisten, Domain, E-Mail, Push-Schlüssel, Rechnungen, Überweisung, Umsatzsteuer,
Krypto (inkl. USDT über Tron für Afrika), Karte/PayPal. Je Punkt „Warum" und „So geht's".
Die Prüfung sieht nur, OB etwas gesetzt ist — sie zeigt nie einen Wert oder ein Geheimnis
(`server/src/services/startklar.js`).

## Datenbank (Pflicht auf Render) — Sprint 1, 11/2026

**Auf Render startet ApoPulse ohne `DATABASE_URL` nicht mehr.** Grund: Das Dateisystem dort ist
flüchtig — ohne Datenbank waren nach jedem Deploy alle Konten weg. Ein fehlgeschlagener Start lässt
die bisher laufende Version weiterlaufen; im Deploy-Protokoll steht dann „startet NICHT: DATABASE_URL
fehlt". Nur bewusst ohne Daten (reine Vorführung): `APOPULSE_OHNE_DATENBANK=ja`.

**Render-PostgreSQL:** „Internal Database URL" als `DATABASE_URL` beim Web-Service eintragen
(gleiche Region: Frankfurt).

**Supabase:** Von Render aus den **Connection Pooler** nehmen (Supabase → Connect → „Transaction
pooler", Port 6543, oder „Session pooler", Port 5432) und als `DATABASE_URL` eintragen. Mehr ist nicht
nötig: Beim Transaktions-Pooler hängt ApoPulse `pgbouncer=true` selbst an und spielt die Migrationen
über den Sitzungsmodus (Port 5432) ein (`src/repo/dbUrl.js`). Eigene direkte Adresse für Migrationen
optional als `DIRECT_URL`.

**Was der Server tut:**
- Beim Build: `npm run db:setup` spielt alle Migrationen ein (bricht bei Fehler ab — besser ein
  fehlgeschlagenes Deploy als eine Datenbank mit unklarem Stand).
- Beim Start: Zustand aus der Datenbank holen. Ist sie gerade nicht erreichbar, wird wiederholt
  (2 s … 60 s) — solange antworten Schreib-Anfragen mit „startet gerade neu, gleich erneut"
  (503). So landet kein Konto in einem leeren Stand, und **eine gute Sicherung wird nie mit einem
  leeren Stand überschrieben**.
- Im Betrieb: Sicherung spätestens **5 Sekunden** nach jeder Änderung und beim Herunterfahren.
  Bricht die Verbindung ab, verbindet der Server von selbst neu und holt die Sicherung nach.

**Prüfen:** `https://<adresse>/api/health` →
`"database":{"configured":true,"connected":true,"restored":true,"last_backup":"…"}` und
`"version":{"commit":"…"}`. `connected:false` mit `error` und `next_retry` heißt: Datenbank gerade
nicht erreichbar, der Server versucht es selbst weiter.

## Internationale Beschaffung, Cross-Check, neue Therapien, Ausbruchs-Radar (Sprint 5)

Vier Bereiche für Fachkreise (nicht für Privatkonten), auf der Startseite unter den Werkzeugen:

**1. Internationale Beschaffung — `https://<adresse>/sourcing`**
- Einstandskosten-Rechner: Warenwert, Fracht, Versicherung, Zollsatz, Einfuhrumsatzsteuer,
  Gebühren, Menge. **Fracht und Zollsatz trägt die Fachperson ein** (laut Spediteur bzw. Zoll) —
  ApoPulse schätzt sie nicht, weil es keine verlässliche freie Quelle gibt und ein Pauschalwert
  wie ein Angebot aussähe. Gerechnet wird richtig: Zoll auf **CIF** (die meisten Länder) bzw.
  **FOB** (USA, Kanada, Australien, Neuseeland), Einfuhrumsatzsteuer auf Zollwert + Zoll.
  Umrechnung über die vorhandenen Kurse (EZB/Frankfurter vor open.er-api), Quelle wird genannt.
  Fehlt ein Kurs, sagt der Rechner das.
- Ankunft = heute + Transitzeit laut Spediteur. Für Kenia/Uganda (Mombasa), Ghana (Tema),
  Nigeria (Lagos), Senegal (Dakar), Côte d'Ivoire (Abidjan), Südafrika (Durban) u. a. kommen echte Wetterwarnungen (Open-Meteo) und
  wartende Schiffe (AISStream, mit Schlüssel) als **Hinweis** dazu.
- „Angebot / Proforma-Rechnung anfordern": Die Anfrage landet im **Redaktions-Cockpit**
  (Abschnitt „Proforma-Anfragen") mit Betrieb, Kontoart, Land, Verifizierung. Dort setzt das
  Handelsteam den Stand (in Bearbeitung / beantwortet / abgelehnt) mit Antwort; der Betrieb wird
  benachrichtigt. Optional zusätzlich per E-Mail: **`APOPULSE_HANDEL_EMAIL`** (braucht den
  Mailversand). Weitervermittlung an Großhändler macht das Handelsteam selbst.

**2. Zulassung & Alternativen prüfen** (auf derselben Seite): Lage des Wirkstoffs im Zielland
(Behördenliste/Meldungen aus Fachkreisen), Link zur zuständigen Behörde, und Wirkstoffe **derselben
ATC-Gruppe** (WHO-ATC über RxClass/NIH) mit ihrer Lage im Zielland. ApoPulse führt **keine
Zulassungsregister** — deshalb steht dort „Zulassung in {Land} bitte im amtlichen Register
prüfen" statt einer Behauptung „zugelassen". Gleiche ATC-Gruppe heißt nicht austauschbar.

**3. Neue Zulassungen & Studienergebnisse:** US-FDA-Erstzulassungen (openFDA drugsfda) und neu
veröffentlichte Studienergebnisse (ClinicalTrials.gov) der letzten 60 Tage, nach Fachgebiet
(Onkologie, Infektionen & Impfstoffe, Diabetes, Herz & Kreislauf). Jeder Eintrag ist gekennzeichnet als
„Neues Arzneimittel“ (NDA), „Neues Biologikum“ (BLA) oder „Generikum (neue Bezugsquelle)“ (ANDA); neue
Therapien stehen oben. Abo je Fachgebiet: Benachrichtigung nur bei neuen Therapien, nicht bei Generika
(täglicher Lauf). Die WHO hat für Studienergebnisse keine
offene Schnittstelle; WHO-Daten nutzt der Radar.

**4. Ausbruchs- & Nachfrage-Radar:** Signal = mindestens 3 neue Engpass-Einträge (Behördenlisten
+ Meldungen aus Fachkreisen) zum selben Wirkstoff in einer Region binnen 14 Tagen und mindestens doppelt
so viele wie in den 14 Tagen davor. Großhandel und Hersteller in **anderen** Regionen bekommen eine
Frühwarnung (je Wirkstoff und Region höchstens alle 14 Tage). Dazu die WHO Disease Outbreak News
und echte Lieferantenpreise im eigenen Land, falls vorhanden. **Keine Prozent-Empfehlung
(„+25 % Lager")** — ApoPulse hat weder Absatz- noch Preisdaten der Händler; die Warnung nennt, was
beobachtet wurde. Suchanfragen werden nicht ausgewertet (werden aus Datenschutzgründen nicht
gespeichert). Redaktion kann den Lauf sofort auslösen: `POST /api/b2b/lauf`.

Cockpit: Zeile „Internationale Beschaffung" (offene Anfragen, Signale); die neuen Quellen stehen in
„Externe Daten".

## Datenwahrheit: Vertrauensstufen, Widerspruch, keine erfundenen Werte (Sprint 4)

Jede Engpass-Zeile zeigt im Klartext, woher sie stammt und wie verlässlich sie ist (eine Stelle
für alle Ansichten: `src/domain/vertrauen.js`):

| Stufe | Wann |
|---|---|
| **Offiziell** | Behördenliste (BfArM, BASG, openFDA …), Quelle an der Zeile |
| **Redaktion (mit Quelle)** | von der Redaktion mit Quellen-Link gesetzt |
| **Hohe Zuverlässigkeit** | ein **verifizierter** Großhandel oder Hersteller meldet oder bestätigt |
| **Community-verifiziert** | mindestens 3 Apotheken (Konten ab 24 Stunden) |
| **Ungeprüfte Meldung** | einzelne Erst-Meldung, mit „Bitte im Zweifel selbst prüfen" |
| **Status unklar — Prüfung erforderlich** | 14 Tage von niemandem bestätigt (nach 30 Tagen zählt sie nicht mehr) |
| **Umstritten** | Redaktion zweifelt (Begründung Pflicht, wird angezeigt) oder mind. 2 Fachleute sagen „stimmt nicht" und es widersprechen mindestens so viele, wie bestätigen |

**Vertrauenswert 0–100** (klein neben der Stufe): Erst-Meldung 25 · je weitere Apotheke +20
(höchstens +50) · verifizierter Betrieb meldet +10 · verifizierter Großhandel/Hersteller mindestens
85 · je Widerspruch −25 · Redaktion zweifelt höchstens 10 · 14 Tage ohne Bestätigung −20, 30 Tage −40.

**„✋ Stimmt nicht"** (Fachkreise, nicht die Meldende): Grund wählen (bei uns lieferbar, falscher
Wirkstoff, doppelt, anderer Grund), optional begründen. Die Meldung bleibt sichtbar; Namen der
Widersprechenden werden nie angezeigt. Wer bestätigt, nimmt seinen Widerspruch zurück (und
umgekehrt). Löschen bleibt der Redaktion vorbehalten. Die Daten-Schnittstelle liefert
`vertrauensstufe` und `vertrauenswert` mit (auch im CSV).

**Keine erfundenen Werte:**
- Preise: Ohne Lieferantendaten zeigt die App „Keine Echtzeit-Lieferantenpreise für {Land}
  verfügbar" und bietet „Community-Richtwert anfragen" an (eine Frage im Feed — Antworten sind
  Erfahrungswerte, keine Lieferantenangebote). Es wird nie ein Preis geschätzt.
- Wechselkurse: EZB-Referenzkurse (Frankfurter) haben Vorrang; was die EZB nicht führt (NGN, GHS,
  KES, XOF …), kommt von open.er-api.com. Der Umrechner nennt die Quelle je Währung. Kurse und
  Krypto-Kurse (CoinGecko) wandern mit der Datenbank-Sicherung — nach einem Neustart ohne Netz gilt
  der letzte Stand, deutlich als „zuletzt gespeichert" gekennzeichnet. Ohne jeden Stand: „nicht
  verfügbar". (Der Währungsrechner selbst ist ein ruhender Bereich; einschalten mit
  `APOPULSE_FEATURE_WAEHRUNGSRECHNER=an`. Die Premium-Preise in Landeswährung nutzen die Kurse immer.)
- Demo-Aktionen (`simulated`) entstehen auf Render bzw. mit `NODE_ENV=production` **nie**, auch
  wenn jemand `APOPULSE_REFERENCE_DATA` einschaltet.

**Wirkstoff-Schreibweise:** Beim Melden prüft die App den Namen — zuerst gegen die bei ApoPulse
geführten Namen (gleicher Wirkstoff-Schlüssel), dann über die RxNorm-Rechtschreibhilfe (NIH).
Ein Treffer erscheint als „Meinten Sie: …" mit Quelle und wird **erst nach einem Tipp**
übernommen — ein still geänderter Wirkstoff wäre eine Aussage, die niemand gemacht hat.

## Externe Datenquellen (kostenlos, ohne Schlüssel — außer AIS)

Alle externen Abrufe laufen über einen gemeinsamen Baustein (`src/services/extern/abruf.js`):
**Zwischenspeicher** (nicht bei jedem Seitenaufruf neu), **Zeitlimit 8 s**, nach „Grenze erreicht"
(HTTP 429) 5 Minuten Pause, und **Rückfall auf den letzten guten Stand**. Dieser Stand wird mit der
Datenbank-Sicherung gespeichert und übersteht so auch Neustarts. Fällt eine Quelle aus, zeigt die App
den gespeicherten Stand mit „gespeicherter Stand" und Uhrzeit — oder ehrlich „gerade nicht
verfügbar". Erfunden wird nie etwas, und die Seite stürzt nie ab.

| Quelle | Wofür | Schlüssel | Zwischenspeicher |
|---|---|---|---|
| openFDA (`drug/shortages`, `drug/enforcement`) | US-Engpässe und Rückrufe | keiner | Quellen-Takt |
| RxNav / RxNorm (NIH) | Wirkstoff-Namen zuordnen | keiner | je Name |
| CoinGecko | Kurse für Krypto-Zahlung (BTC, ETH, SOL, **USDT** über Tron) | keiner | 5 min je Münze |
| open.er-api.com → **Frankfurter** (EZB) | Wechselkurse; Frankfurter springt ein, wenn die erste Quelle ausfällt (ohne afrikanische Währungen — die bleiben auf dem letzten Stand) | keiner | 1 h |
| World Bank Open Data (`LP.LPI.OVRL.XQ`) | Logistik-Index des eigenen Landes (1–5, mit Jahr) | keiner | 7 Tage |
| Open-Meteo | Starkregen-/Sturm-Hinweise an Häfen (Koper, Rotterdam, Tema, Lagos, Dakar, Abidjan, Mombasa, Durban) | keiner | 1 h je Hafen |
| AISStream.io | Schiffe im Hafengebiet, davon vor Anker (wartend) | **`AISSTREAM_API_KEY`** | live, 2 h Fenster |

**`AISSTREAM_API_KEY` (optional):** kostenlos auf <https://aisstream.io> (mit GitHub anmelden →
„API Keys" → neuen Schlüssel erzeugen) und in Render beim Web-Service als Umgebungsvariable
eintragen. Ohne Schlüssel fehlt nur die Schiffs-Zeile; alles andere läuft. Den Schlüssel nie in
einen Chat oder ins Repo kopieren.

**Wo sehe ich, ob die Quellen antworten?** Betriebs-Cockpit → Zeile „Externe Daten" (je Quelle
„antwortet", „Fehler" oder „aus (kein Schlüssel)"). Für die Redaktion zusätzlich
`GET /api/extern/status`.

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

## Impressum und Verantwortlicher (Pflicht vor dem Start)

`/impressum` (§ 5 ECG, § 25 MedienG) und der „Verantwortliche" in `/datenschutz.html` werden aus den
Einstellungen gefüllt — Gründer steht fest drin (Leo Fernandes Gaspar). In Render eintragen:
- `APOPULSE_FIRMA_ANSCHRIFT` — Anschrift (Pflicht; mehrere Zeilen mit Zeilenumbruch möglich)
- `APOPULSE_KONTAKT_EMAIL` — E-Mail für Kontakt und Datenschutzanfragen (Pflicht)
- optional `APOPULSE_FIRMA_NAME` (falls eine Firma gegründet ist; sonst steht der Gründer als Betreiber) und
  `APOPULSE_FIRMA_UST_ID`. Dieselben Werte nutzen die Rechnungen.
Fehlt etwas, steht es auf der Seite sichtbar als „[noch einzutragen]" und im Startklar-Check als „fehlt".

Die Datenschutzerklärung setzt außerdem selbst ein, was wirklich eingerichtet ist: den SMS-Anbieter
(Africa's Talking/Twilio oder „nicht eingeschaltet") und die Zahlwege (Stripe, PayPal, Krypto-Wallet,
Überweisung). Der Hinweis „Entwurf — noch nicht rechtlich geprüft" bleibt, bis eine Fachperson den Text
geprüft hat; danach `APOPULSE_DATENSCHUTZ_GEPRUEFT=ja` setzen.
