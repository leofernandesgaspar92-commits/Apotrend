# Start im englischsprachigen Afrika — drei Ebenen: Land / Afrika / Welt

## Länder

Neu seit 10/2026 (zusätzlich zu Nigeria, Kenia, Ghana, Südafrika):

| Land | Behörde | Währung | Quelle (Startwert, ungeprüft) |
|---|---|---|---|
| 🇺🇬 Uganda | NDA | UGX | `nda.or.ug/feed/` (Rückfall Gesundheitsministerium) |
| 🇹🇿 Tanzania | TMDA | TZS | `tmda.go.tz/feed/` |
| 🇿🇲 Zambia | ZAMRA | ZMW | `zamra.co.zm/feed/` |
| 🇿🇼 Zimbabwe | MCAZ | USD | `mcaz.co.zw/feed/` |
| 🇷🇼 Rwanda | Rwanda FDA | RWF | `rwandafda.gov.rw/feed/` |
| 🇧🇼 Botswana | BoMRA | BWP | `bomra.co.bw/feed/` |
| 🇳🇦 Namibia | NMRC | NAD | Gesundheitsministerium (`mhss.gov.na`) |
| 🇲🇼 Malawi | PMRA | MWK | `pmra.mw/feed/` |
| 🇪🇹 Ethiopia | EFDA | ETB | `efda.gov.et/feed/` |
| 🇸🇱 Sierra Leone | Pharmacy Board | SLE | `pharmacyboard.gov.sl/feed/` |
| 🇱🇷 Liberia | LMHRA | LRD | `lmhra.gov.lr/feed/` |
| 🇬🇲 The Gambia | MCA | GMD | `mca.gm/feed/` |

Alle auf Englisch, Region `AFRICA`. **Krypto-Zahlung ist überall verfügbar.**
Behörden-Links nur, wo die offizielle Domain sicher bekannt ist (sonst kein Link).

**Ehrlich:** Die Quell-Adressen konnten in der Bauumgebung nicht abgerufen werden (kein Netz).
Ob sie liefern, zeigt nach dem ersten Lauf die Datenquellen-Seite bzw. der Startklar-Check.
Liefert eine nicht, findet die Feed-Selbstfindung oft den echten Feed — oder die Redaktion trägt
die richtige Adresse unter „Datenquellen → Eigene Quelle" ein (ohne Code).

**Recht (kein Rechtsrat):** Für die zwölf neuen Länder gibt es noch keine geprüfte Rechtsanalyse.
Deshalb konservativ: nur Software-Lizenzen (Premium/Business/Anzeigen), keine
Marktplatz-Gebühren; Aktionen und Börse nur mit Hinweis — wie in NG/KE/GH. Freischalten erst nach
Prüfung (`server/src/domain/compliance.js`, `server/src/data/countryFeatures.js`).

## Drei Ebenen

Umschalter oben in **News** und **Engpässe**: `🇺🇬 Uganda | 🌍 Africa | 🌐 World` (für Europa:
`Österreich | Europa | Welt` usw. — die Region folgt dem Land).

| Ebene | News | Engpässe |
|---|---|---|
| Land | Behörde des Landes (wie bisher) | Liste des Landes |
| Afrika | alle afrikanischen Behörden + **Africa CDC** + **WHO Afrika**, jede Meldung mit Herkunft (Flagge + Land) | je Land: amtlich knapp / nicht lieferbar / Meldungen aus Apotheken (getrennt) — „keine amtliche Liste" ausdrücklich; **in mehreren Ländern zugleich knapp** (Frühwarnung) |
| Welt | **WHO**, **EMA**, Africa CDC und alle Behörden in der eigenen Sprache (für Englisch: FDA, MHRA, Health Canada, TGA, afrikanische Behörden) | alle Länder; Wirkstoffe, die in mehreren Ländern knapp sind |

Quellen ohne Land heißen **Quell-Regionen** (`EU`, `AFR`, `INT`, `data/countries.js`). Sie sind
nie Land eines Kontos, eines Engpasses oder einer Rechtsprüfung.

**Behobener Fehler dabei:** Meldungen der EMA (`EU`) wurden bisher auf das Standardland
umgebogen — jede EMA-Meldung erschien als österreichische Behördenmeldung. Jetzt stehen sie unter
„Europa" bzw. „Welt".

## Was das heute bedeutet (ehrlich)

In der Engpasslage Afrika steht derzeit **„0 von 18 Ländern liefern eine amtliche Engpassliste"**:
Afrikanische Behörden veröffentlichen ihre Engpässe meist nicht als strukturierte Liste. Die
Informationen kommen dort aus **Behördenmeldungen (News)**, **Meldungen aus Apotheken** (in der
App gekennzeichnet, bestätigbar durch weitere Apotheken) und den **kontinentalen/weltweiten
Quellen**. Wer eine strukturierte Liste einer afrikanischen Behörde kennt (CSV/JSON), kann sie als
eigene Quelle eintragen — dann füllen sich Liste, Alarme, Radar, Daten-Schnittstelle und
Google-Seiten automatisch.

## Meldungen aus Apotheken: Vertrauensstufen

Wo es keine amtliche Liste gibt, sind Meldungen aus Apotheken die schnellste Information. Damit
man ihnen richtig traut:

| Stufe | Anzeige | Bedeutung |
|---|---|---|
| einzeln | gelb: „1 Apotheke meldet — noch nicht bestätigt" / „2 Apotheken melden — ab 3 gilt es als bestätigt" | Hinweis |
| bestätigt | grün: „Von 3 Apotheken bestätigt (nicht amtlich)" | mehrere unabhängige Apotheken im Land |

- Sobald die dritte Apotheke bestätigt, bekommen alle, die den Wirkstoff **im selben Land**
  beobachten (und die Meldende), **einmalig** den Alarm „Bestätigt: Salbutamol — 3 Apotheken in
  Uganda melden Salbutamol als knapp (nicht amtlich)" — in der App und per Handy-Push.
- Zurücknehmen und erneut bestätigen löst keinen zweiten Alarm aus.
- Engpasslage Afrika zählt bestätigte Meldungen getrennt; die Daten-Schnittstelle liefert
  `bestaetigt_von` (Anzahl Apotheken) je Apotheken-Meldung.
- Amtlich wird eine Apotheken-Meldung dadurch nie — sie bleibt überall so gekennzeichnet.

## Teilen in Ländern ohne Behördenliste

Geteilte Links (WhatsApp-Vorschau) zeigen in solchen Ländern die Apotheken-Lage mit
Vertrauensstufe — nie als Behördenaussage:

- „Salbutamol: 1 pharmacy in Uganda reports a shortage (not yet confirmed)"
- „Salbutamol: reported short by 3 pharmacies in Uganda" — Beschreibung „reported by pharmacies,
  not official"
- Lage des Landes: „2 substances reported short by pharmacies in Uganda · 1 of them confirmed by
  several pharmacies · not official"

Beispieldaten erscheinen auf Teilseiten nicht mehr.

## Aktualität von Apotheken-Meldungen

Eine Meldung von vor zwei Monaten darf nicht wie eine von heute aussehen:

| Tage ohne Bestätigung | Anzeige | Wirkung |
|---|---|---|
| < 14 | — | normal |
| ab 14 | „Last confirmed 16 days ago — still short?" + Knopf **Still short** | die Meldende bekommt einmal die Erinnerung „Is your report still current?" |
| ab 30 | grau „Outdated: not confirmed for 31 days — no longer counted" | zählt nicht mehr: nicht „bestätigt", nicht in Engpasslage, Daten-Schnittstelle, Teilseiten, Sortiments-Check |

- **Still short** (jede Fachperson im Land) frischt die Meldung auf und zählt als Bestätigung.
- **Available again** dürfen nur Meldende, Bestätigende oder die Redaktion — alle, die den Wirkstoff
  im Land beobachten, werden informiert.

## Fälschungs- und Rückrufwarnungen

Behördenmeldungen, die gefälschte/minderwertige Arzneimittel oder Rückrufe betreffen, tragen ein
Etikett — rot „Falsified medicine warning", gelb „Recall" — mit dem Zusatz „detected automatically
— details in the source". Oben in News: Schalter **„Warnings only: falsified medicines and
recalls"** (gilt für Land, Afrika und Welt).

Erkennung per Stichwort im Text der Behördenmeldung (`server/src/domain/warnung.js`, en/de/pt),
keine eigene Aussage; mehrdeutige Wörter wie „fake" zählen nur in fester Wendung („fake drugs"),
nicht in „fake news".

## Erste Schritte in Afrika

Neukunden in afrikanischen Ländern bekommen afrikatypische Vorschläge (Orientierung an der
WHO-Liste unentbehrlicher Arzneimittel): Artemether/Lumefantrin, Amoxicillin, Oxytocin, Orale
Rehydratationssalze, Zinksulfat, Paracetamol, Ceftriaxon, Metformin, Insulin, Salbutamol,
Magnesiumsulfat, Rifampicin, Tenofovir/Lamivudin/Dolutegravir, Gentamicin — ohne Status, solange
keine Quelle etwas als knapp meldet.

## Offline lesbar (schwaches Netz)

In vielen Zielmärkten fällt das Netz regelmäßig aus. Damit die App dann nicht leer ist, speichert
der Service Worker (`server/public/sw.js`) den **zuletzt geladenen Stand** einiger Lese-Ansichten:
Engpässe, Nachrichten, Beobachtungsliste, Übersicht, Lage je Ebene, Wirkstoff-Seite, Konto, Länder.

- **Netz zuerst:** Solange Netz da ist, kommt jede Antwort frisch vom Server. Der gespeicherte
  Stand wird nur bei Netzausfall gezeigt.
- **Sichtbar gekennzeichnet:** Oben steht „Offline — gespeicherter Stand von …" mit Uhrzeit. Ein
  alter Engpass-Stand darf nicht wie ein aktueller aussehen.
- **Je Konto getrennt:** Der Speicher-Schlüssel enthält einen SHA-256-Hash des Anmelde-Tokens (nie
  das Token selbst). Auf einem geteilten Apotheken-Rechner sieht ein anderes Konto nichts.
- **Abmelden und Konto löschen leeren den Speicher.**
- **Nie gespeichert:** Direktnachrichten, Benachrichtigungen, Rechnungen, Schnittstellen-Schlüssel,
  Datenexport, Schnittstellen-Antworten (`/api/v1`).
- **API-Antworten tragen `Cache-Control: no-store`.** Vorher hätte der Browser-HTTP-Cache
  Antworten eines Kontos auch nach dem Abmelden noch halten können.

Geprüft durch `server/test/offline.test.js` und den Browser-Audit-Block „Offline" (eigener
Prüfserver, der beendet wird — ein echter Netzausfall).

## Datensparsam: Bilder per Adresse

Mobile Daten sind in den Zielmärkten teuer. Bilder (Beiträge, Kommentare, Profilbilder, Angebote,
Anzeigen) standen bis 10/2026 als base64 **in jeder API-Antwort**, das Profilbild sogar in jedem
einzelnen Beitrag der Person. Zehn Beiträge einer Apotheke mit 60-KB-Profilfoto waren rund 660 KB
je Laden des Feeds, bei jedem Öffnen neu.

Jetzt (`server/src/domain/bilder.js`):

- Die JSON-Ausgabe ersetzt jedes Bild durch `/api/bild/<SHA-256 des Inhalts>`. Derselbe Feed ist
  unter 30 KB.
- `GET /api/bild/<hash>` liefert das Bild mit `Cache-Control: private, max-age=31536000, immutable`:
  Der Browser lädt jedes Bild **einmal** und behält es. `private` heißt: kein Zwischenspeichern in
  fremden Proxys. `nosniff` ist gesetzt, und erlaubt sind nur png/jpeg/webp/gif, kein SVG.
- Die Adresse braucht keine Anmeldung, weil `<img>` kein Token mitschickt. Sie ist 256 Bit lang
  und nur aus einer Antwort bekannt, die das Bild ohnehin zeigen durfte.
- Die Bilder in der App laden erst beim Hinscrollen (`loading="lazy"`).
- Beim Bearbeiten mit unverändertem Bild schickt die App die Adresse zurück. Der Server löst nur
  Adressen auf, die er selbst kennt.
- Der **Datenexport** enthält weiterhin die Bilder selbst, keine Verweise auf diesen Server.

Geprüft durch `server/test/bilder.test.js` und den Browser-Audit-Block „Bilder".

## Datumsformat

Datumsangaben folgen dem Land der Ansicht (`REGIONAL_TAGS` in `server/public/app.js`), z. B. `en-UG`,
`en-TZ`, `en-ZM`. **Äthiopien nutzt `en-GB`:** `en-ET` kennt die Datums-Bibliothek der Browser nicht,
sie fällt still auf US-Englisch zurück (Monat vor Tag). Allgemein gilt: Löst der Browser eine
Kennung nicht genau auf, nimmt die App das Standardformat der Sprache (en-GB, pt-PT, de-AT) statt
eines vertauschten Datums. Geprüft durch `server/test/datumsformat.test.js`: Jedes Land muss in
der Tabelle stehen, und außer den USA bekommt kein Land Monat vor Tag.

## Kolleg:innen einladen und um Bestätigung bitten

Ohne Behördenliste entsteht die Lage aus Meldungen von Apotheken. „Bestätigt" ist eine Meldung
erst ab 3 Apotheken. Eine einzelne Apotheke bleibt sonst allein mit ihrer Meldung.

- **An der eigenen, noch nicht bestätigten Meldung:** Knopf „Ask colleagues to confirm". Er teilt
  (meist per WhatsApp) die Teilseite der Meldung mit dem persönlichen Einladungs-Code (`?e=…`).
- **Die Teilseite** bittet in dem Fall ausdrücklich um Bestätigung („Short at your pharmacy too?
  Confirm … in ApoPulse"). Nach der Registrierung landet die Kollegin direkt bei der Meldung mit
  „Bestätigen". Ist die Meldung schon bestätigt, entfällt die Bitte.
- **Menü → „Invite colleagues":** persönlicher Link zur Lage im eigenen Land, mit Zähler, wie viele
  darüber dazugekommen sind. Die Einladende wird benachrichtigt (Kategorie „Folgen").
- **Bewusst ohne Belohnung:** Sonst lohnten sich Schein-Apotheken, und die könnten Meldungen
  „bestätigen". Eine Einladung zählt nicht in der Vertrauensstufe.
- **Speicherung:** Codes sind zufällig (8 Zeichen), gespeichert und überstehen Neustarts. Sie werden
  nicht aus dem Token-Geheimnis abgeleitet, damit geteilte Links auch nach einem Schlüsselwechsel
  gelten. Die Teilseite übernimmt nur einen Code, den der Server kennt. Beim Löschen eines Kontos
  werden Code und Zuordnungen entfernt.

Geprüft durch `server/test/einladungen.test.js` und den Browser-Audit-Block „Einladen".

## Schutz vor Schein-Konten

„Bestätigt" (ab 3 Apotheken) ist in Ländern ohne Behördenliste die stärkste Aussage der Plattform.
Bisher reichten zwei frisch angelegte Schein-Apotheken, um jede Meldung so erscheinen zu lassen.

- **Konten zählen für „bestätigt" erst ab 24 Stunden Alter** (`ZAEHLT_AB_STUNDEN` in
  `server/src/services/shortages.js`, eine Stelle für Liste, Teilseite, Landes- und Afrika-Lage).
  Angezeigt wird weiterhin, wie viele Apotheken melden, etwa „3 pharmacies report — confirmations
  from new accounts count after 24 hours". Echte Kolleg:innen zählen ab dem nächsten Tag von selbst.
  Der Alarm „bestätigt" kommt dann über den Zeitplan (alle 6 Stunden), genau einmal.
- **Login und Passwort-Zurücksetzen** haben zusätzlich eine Grenze **je Konto** (20 bzw. 10
  Fehlversuche in 15 Minuten). Die Grenze je Adresse ließ sich umgehen, weil die Adresse aus dem
  ersten Eintrag von `X-Forwarded-For` kommt, und den setzt der Client selbst.
- Bewusst **keine** Grenze für Registrierungen je IP-Adresse: Mobilfunk in Afrika bündelt viele
  Menschen hinter einer Adresse, und welcher Eintrag hinter Render die echte Adresse ist, ist von
  hier nicht sicher prüfbar.
- `APOPULSE_BESTAETIGUNG_AB_STUNDEN` gibt es **nur für Tests** (0). Im Betrieb nicht setzen.
- **Moderation → „Apotheken-Meldungen prüfen":** Hier stehen die Meldungen mit Auffälligkeiten:
  Konten jünger als 24 Stunden, Bestätigende, die die Meldende selbst eingeladen hat, und Konten,
  die binnen einer Stunde nacheinander angelegt wurden. Das sind Signale, keine Urteile, denn
  Kolleg:innen laden sich oft gegenseitig ein. Die Moderation kann einzelne Bestätigungen entfernen
  oder die Meldung **als falsch entfernen**. Dann erfährt es die Meldende, und Beobachter:innen
  bekommen *kein* „wieder verfügbar". Das alte „Auflösen" hätte genau das fälschlich gemeldet.
  Erreicht eine auffällige Meldung 3 beteiligte Apotheken, bekommt die Moderation **von selbst**
  eine Benachrichtigung („Check a conspicuous pharmacy report"), einmal je Meldung.
- **Startklar** meldet „fehlt", falls `APOPULSE_BESTAETIGUNG_AB_STUNDEN` im Betrieb gesetzt ist.
  Geprüft durch `server/test/meldungs-pruefung.test.js` und den Browser-Audit-Block „Meldungsprüfung".

Geprüft durch `server/test/schein-konten.test.js` (mit Uhr).

## Erster Eindruck

- **Länderwahl in der Sprache des Browsers:** Englisch, Deutsch oder Portugiesisch, bei anderen
  Sprachen (z. B. Suaheli) Englisch. Die App-Sprache folgt danach wie bisher dem gewählten Land.
- **Vorschlag oben:** Er kommt aus der **Zeitzone** des Geräts (z. B. Africa/Kampala → Uganda) und
  ersatzweise aus der Browser-Sprache. Die Zeitzone hat Vorrang, weil Browser in Afrika oft auf
  US-Englisch stehen.
- **Liste nach Regionen,** die Region des Vorschlags zuerst, darin alphabetisch.
- **Keine leeren Versprechen:** „Preise vergleichen" auf der Startseite und Rabatt-Alarme an der
  Beobachtungsliste erscheinen nur in Ländern mit Preisvergleichen oder Angeboten (`/api/countries`
  → `preise`). Ohne Beispieldaten ist das im Live-Betrieb derzeit nirgends der Fall.
- **Leere Engpassliste ohne Filter:** Statt „Filter zurücksetzen" steht dort „No shortage has been
  reported for … yet. Is something short at your pharmacy? Report it", mit Knopf zum Formular.
- **Wiederherstellungscodes** brechen nicht mehr um und stehen auf dem Handy einspaltig.
- **Quelle antwortet nicht:** Das Banner ist **gelb**, nicht rot, denn Rot heißt in ApoPulse
  „kritischer Engpass". Es nennt die Quelle mit Namen („National Drug Authority Uganda — News"
  statt `nda_ug_news`) und verspricht keinen „letzten Stand", wenn es keinen gibt.
- **Premium-Seite:** Produktnamen in der Sprache der Oberfläche („ApoPulse Premium (1 month)" statt
  „(Monat)"). Ohne Kurs heißt es in Klartext „Exchange rate not available right now — please send
  the equivalent of €9.99 at the current rate". Am Krypto-Zahlweg selbst ändert sich nichts.
- **Afrika-Lage:** Länder ohne Behördenliste und ohne Apotheken-Meldung stehen in **einer** Gruppe
  mit antippbaren Länder-Knöpfen, statt 18 gleicher Zeilen „No official shortage list available".

Geprüft durch den Browser-Audit-Block „Erster Eindruck" (Liberia, Zeitzone Africa/Monrovia, US-
Englisch, plus Gegenprobe Österreich) und `server/test/laenderwahl.test.js`.

## Öffentliche Seiten (Google) für Afrika

`/engpaesse/<land>` zeigte für Länder ohne Behördenliste „Seite nicht gefunden" (auf Deutsch).
Wer „medicine shortage Uganda" sucht, fand ApoPulse nicht. Jetzt:

- **Länder ohne eingetragene Engpass-Quelle** (Uganda, Kenia, …) bekommen eine ehrliche
  Landing-Seite: „ApoPulse does not (yet) receive an official shortage list for Uganda … pharmacies
  report shortages themselves", mit Knopf in die App. Bewusst **ohne Daten**, auch ohne
  Apotheken-Meldungen, denn eine Suchmaschine zeigt Auszüge ohne die Kennzeichnung „nicht amtlich".
  Die Formulierung sagt, was ApoPulse erhält, nicht ob die Behörde eine Liste hat.
- **Länder mit Quelle, die noch nicht geliefert hat,** bleiben bei 404.
- **Übersicht `/engpaesse` und 404-Seite** folgen der Sprache des Browsers (`Accept-Language`,
  `Vary`). Die Übersicht hat einen eigenen Abschnitt für Länder ohne amtliche Liste. Die
  Landing-Seiten stehen in der Sitemap.

## Premium-Preis für Afrika (eine Einstellung)

9,99 €/Monat sind in Uganda rund 40 000 UGX, für eine kleine Apotheke eine andere Hürde als in
Wien. Den Preis legt der Betreiber fest; die Technik steht:

- **Beschlossen am 22.10.2026 (Owner: „entscheid du"): 30 %** — Monat 3,00 €, Jahr 29,70 € (≈ 12 000
  statt 42 000 UGX im Monat). Gilt als Standard ohne Render-Einstellung. Ändern mit
  `APOPULSE_PREISE_REGION` (z. B. `AFRICA:40`), abschalten mit `aus`.
- **Nur Premium.** Business (Großhandel, Ketten, Daten-Schnittstelle) und Anzeigen bleiben beim
  Listenpreis.
- **Heimatland entscheidet.** Wer in Wien die Ansicht auf Uganda stellt, zahlt weiter den
  österreichischen Preis. Ohne Anmeldung zeigt die Premium-Seite den Preis des gewählten Landes;
  bezahlt wird immer angemeldet.
- **Ein Betrag überall:** Anzeige, Krypto-Zahlung (gespeicherter Betrag und Coin-Menge),
  Überweisung mit Rechnung und Kartenzahlung nutzen denselben Preis. Das Krypto-Bezahlsystem
  bleibt vollständig erhalten. Abgerechnet wird weiter in Euro.
- Tests: `server/test/region-preis.test.js` (Gegenproben: Ansichtsland statt Heimatland,
  Krypto-Start mit Listenpreis, Rechnung mit Listenpreis machen den Test rot).

## Weniger mobile Daten beim Laden (Brotli)

Beim ersten Öffnen lud ein Handy rund 320 KB (gzip), bei jedem App-Update erneut. Jetzt liefert der
Server Brotli aus, sobald der Browser es ankündigt (alle heutigen Browser), sonst weiter gzip:

| Datei | gzip vorher | Brotli jetzt |
|---|---|---|
| app.js | 189 KB | 144 KB |
| i18n.js | 116 KB | 87 KB |
| app.css | 13 KB | 12 KB |

Zusammen rund **24 % weniger** Download, ohne die App zu ändern. Die höchste Brotli-Stufe kostet
für app.js gut eine Sekunde Rechenzeit. Darum rechnet der Server jede Datei nur einmal je Version,
im Hintergrund und gleich nach dem Start (`NODE_ENV=production`), und liefert sie danach aus dem
Speicher. Vorher wurde app.js bei jeder Anfrage neu gezippt. JSON-Antworten und die Startseite
gehen ebenfalls als Brotli hinaus (schnelle Stufe). Tests: `server/test/komprimierung.test.js`
(entpackt byte-genau gleich der Datei, `br;q=0` wird respektiert, neue Version ersetzt die alte).

**Nach einem Deploy nur Geändertes neu laden.** Die Versionskennung (ETag) einer Datei war Größe +
Änderungszeit. Render baut jedes Deploy aus einem frischen Git-Klon, also bekam jede Datei eine neue
Zeit, und **jedes Handy lud nach jedem Deploy die ganze App neu** (~245 KB), auch unveränderte
Dateien. Jetzt ist die Kennung eine Prüfsumme des Inhalts: Unverändertes bleibt beim kurzen
„304 unverändert" (wenige hundert Byte). Test: `komprimierung.test.js` (neue Änderungszeit bei
gleichem Inhalt → 304).

**Skripte ohne Kommentare ausliefern.** app.js ist bewusst ausführlich kommentiert; das Handy braucht
das nicht. Der Server liefert Skripte jetzt ohne Kommentare, Einrückung und Leerzeilen aus
(`server/src/http/schlank.js`, ohne Build-Werkzeug): app.js **144 → 105 KB** (Brotli), sw.js 2,5 → 1,3 KB.
Die Datei im Repo bleibt unverändert. Absicherung: (1) Probe-Übersetzung vor dem Ausliefern, sonst
geht das Original hinaus; (2) Test vergleicht app.js, i18n.js und sw.js **Token für Token und
Zeilenumbruch für Zeilenumbruch** mit einem echten JavaScript-Parser. Die Probe-Übersetzung allein
reicht nicht: Eine Gegenprobe ohne Zeilenumbrüche ließ sich übersetzen, weil app.js überall Semikolons
setzt; (3) der Browser-Audit läuft komplett auf der schlanken Fassung. Abschalten:
`APOPULSE_SCHLANK=aus`.

Erstes Öffnen insgesamt (Brotli): vorher ~320 KB (gzip) → jetzt ~205 KB.

## Günstige Handys (320–360 px)

In Afrika verbreitete Android-Handys (Tecno, itel, Infinix) sind oft nur 320–360 px breit. Dort ragte
der **Menü-Knopf halb aus dem Bild** und die ganze Seite ließ sich seitlich verschieben, auf jedem
Reiter. Bei 360 px mit großer Schrift ebenso. Grund: Logo-Schriftzug + Länderwahl + „Alerts" +
„Menu" brauchten ~370 px. Jetzt steht bis 380 px Breite nur das grüne Logo-Symbol; „Alerts" und
„Menu" behalten ihr Wort. Außerdem hatte „Unlock" (Premium-Hinweis an der Beobachtungsliste) nur
11 px Schrift; kleine Knöpfe haben jetzt mindestens 13 px. Der Browser-Audit prüft alle Reiter bei
320 px und 360 px mit großer Schrift (Konto in Uganda, Englisch).

## Antibiotika-Hinweis: Sprache, Quelle und Erkennung passend zum Land

Ein Sprach-Scan aller Reiter, Menüs und Unterseiten für ein Konto in Uganda (Englisch) fand genau
eine Stelle mit Deutsch: den **Antibiotika-Hinweis auf der Wirkstoff-Seite** (z. B. Amoxicillin). Dort
standen ein deutscher Text und als einzige Quelle der **österreichische Resistenzbericht** (AURES).
Für eine Apotheke in Kampala sind das falsche Sprache und eine fürs Land falsche Quelle. Zudem kannte
die Erkennung nur deutsche Schreibweisen; „Co-trimoxazole" oder „Amoxicilina" lösten nichts aus.

- Hinweis und Sicherheitssatz („keine patientenindividuelle Therapieempfehlung") stehen jetzt in
  `i18n.js` in Deutsch, Englisch und Portugiesisch.
- Quellen je angesehenem Land: **Österreich** behält AGES/AURES; **alle anderen Länder** bekommen die
  weltweit gültigen WHO-Quellen: das [WHO-AWaRe-Antibiotikabuch](https://www.who.int/publications/i/item/9789240062382)
  (Access/Watch/Reserve, abgestimmt auf die WHO-Liste unentbehrlicher Arzneimittel; Adresse per
  Recherche bestätigt) und das WHO-Faktenblatt zu Antibiotikaresistenz. Beschriftung in der Landessprache.
- Erkennung über den sprachübergreifenden Wirkstoff-Schlüssel (`domain/inn.js`) plus in Afrika gängige
  Antibiotika der WHO-Liste (Chloramphenicol, Benzathin-Benzylpenicillin, Cefixim, Amikacin …).
  Penicillamin (kein Antibiotikum) wird ausdrücklich nicht erkannt.
- Der Browser-Audit sucht jetzt bei jedem Lauf deutsche Reste in der englischen Oberfläche.

## Keine Sackgassen; Patienten-Infokarten für Afrika vorbereitet

**Sackgassen behoben (betraf alle Länder):** Auf der Startübersicht „Für dich" stand für jedes
Konto die Karte „Antibiotika-Fachforum", im Antibiotika-Kasten der Wirkstoff-Seite die Knöpfe
„Fachdiskussion" und „Patienten-Infokarten". Die Bereiche dahinter ruhen (`data/features.js`:
`social`, `patienteninfo`), jeder Klick endete auf „Nicht gefunden" (dazu auf Deutsch, weil die
Antwort keinen Code trug). Jetzt erscheinen die Einstiege nur, wenn der Bereich läuft; ruhende
Bereiche antworten mit Code `not_found` (übersetzt). Der Browser-Audit tippt jede anklickbare Karte
der Übersicht und jeden Knopf im Antibiotika-Kasten an und meldet „Nicht gefunden".

**Patienten-Infokarten und Einnahmeplan** (ruhen weiter; einschalten mit
`APOPULSE_FEATURE_PATIENTENINFO=an`, Entscheidung des Betreibers) sind für Afrika vorbereitet:
- **Portugiesisch** zusätzlich zu Deutsch, Englisch, Türkisch (Karten, Hinweis, Druckblatt, Einnahmeplan).
- Standardsprache = Sprache der Oberfläche (vorher immer Deutsch).
- Quelle je angesehenem Land: Österreich AGES, sonst WHO-Faktenblatt Antibiotikaresistenz (Adresse
  über Kopien bestätigt, who.int ist aus dieser Umgebung gesperrt).
- Karte „Reste entsorgen": außerhalb Österreichs **ohne** das Versprechen „Reste in die Apotheke
  bringen". Ob Apotheken zurücknehmen, ist nicht überall geregelt; stattdessen „Fragen Sie in Ihrer
  Apotheke, wie Reste sicher entsorgt werden" und „nicht weitergeben, nicht später selbst einnehmen".
- Nicht gemacht: Swahili, Hausa, Amharisch u. a. Patiententexte zu Antibiotika brauchen eine
  muttersprachliche Fachprüfung; ohne die keine Übersetzung.

**Zweiter Durchgang: alle Knöpfe, alle Reiter, Profile (2026-10-22).** Ein Browser-Rundgang tippte
für ein Konto in Uganda und eines in Österreich jeden sichtbaren Knopf an: alle Reiter, Menü,
Wirkstoff-Seite, eine gemeldete Engpass-Karte, eigenes und fremdes Profil. Gefunden und behoben,
jeweils Bereich ruht → Knopf erscheint nur noch, wenn der Bereich läuft:

| Wo | Knopf | Ruhender Bereich |
|---|---|---|
| Jede Engpass-Karte | „Sources", „I need this" | Tauschbörse |
| Wirkstoff-Seite | „Post an offer", „I need this", „As task" | Tauschbörse, Zusammenarbeit |
| Beiträge | „Folgen", Hashtag-Links (#stewardship) | Social |
| Eigenes Profil | „Meine Videosprechstunden", Karte „Team" | Termine, Zusammenarbeit |
| Fremdes Profil | „Nachricht", „Folgen", „Stummschalten", „Videosprechstunde buchen" | Direktnachrichten, Social, Termine |

Die Engpass-Karten-Knöpfe standen im Live-Betrieb in Österreich und Deutschland auf **jeder** Karte.
Der Browser-Audit tippt jetzt auch Wirkstoff-Seite, Engpass-Karte und beide Profile durch und meldet
zusätzlich jede Server-Antwort „ruhender Bereich", auch wenn sie nicht sichtbar wird.

## Entscheidungen vom 22.10.2026 (Owner: „entscheid du")

- **Afrika-Preis 30 %** des Listenpreises als Standard (siehe oben). Warum 30 %: Kaufkraft in Uganda,
  Kenia oder Nigeria ist ein Bruchteil Österreichs; große Abo-Dienste liegen in vergleichbaren Märkten
  bei rund einem Viertel bis zwei Fünfteln des EU-Preises. 3 € sind für eine kleine Apotheke eine
  realistische Hürde, und der Preis bleibt über einer Schwelle, ab der eine Zahlung ernst genommen wird.
  Business und Anzeigen bleiben beim Listenpreis (Großhandel, Ketten, Industrie).
- **Patienten-Infokarten eingeschaltet** (`patienteninfo` aktiv). Erreichbar über den
  Antibiotika-Kasten der Wirkstoff-Seite; Englisch/Portugiesisch, WHO-Quelle, druckbar, mit
  Einnahmeplan. Die Compliance-Schnittstelle, die bisher am selben Schalter hing, hat einen eigenen
  Schalter (`compliance_api`) und ruht weiter. Fachforum bleibt aus (hängt an den Social-Funktionen).
- **Nicht entschieden, weil von hier nicht machbar:** „Quellen testen" für die afrikanischen
  Behörden-Listen — die Behörden-Seiten sind aus dieser Umgebung gesperrt.
- **Sonderpreis sichtbar gemacht:** Die Premium-Seite schreibt bei ermäßigtem Preis „Special price for
  pharmacies in Africa — regular price €9.99" (de/en/pt). Sonst wirkt „3,00 €" wie ein Fehler oder ein
  Lockangebot. `/api/payments/products` liefert dafür `list_cents` und `preis_region` — nur, wenn
  wirklich ermäßigt (Österreich und Business: keine Felder, kein Hinweis).
- **Krypto bei kleinen Beträgen:** Bei 3,00 € können die schwankenden Netzwerkgebühren von Bitcoin
  und Ethereum ein spürbarer Teil des Betrags sein. Unter 20 € stehen deshalb die Solana-Wallets
  zuerst, markiert „Lowest fee" (Grundgebühr Bruchteile eines Cents), mit einem kurzen Hinweis. Es
  wird nur sortiert, nie gefiltert — alle Krypto-Wege bleiben (Owner-Vorgabe). Tron/USDT bewusst
  nicht als günstig markiert: Ohne eigene „Energie" kostet eine TRC-20-Überweisung oft rund einen
  Dollar.
- **Keine österreichische Umsatzsteuer auf Rechnungen nach Afrika:** Mit `APOPULSE_UST_SATZ=20` wies
  jede Rechnung 20 % aus, auch für eine Apotheke in Uganda; eine Firma in Nairobi zahlte für eine
  Anzeige 20 % mehr. Für Empfänger außerhalb der EU steht jetzt keine Steuer, sondern der Hinweis auf
  den Leistungsort (Art. 44/59 MwSt-Systemrichtlinie). Steuern im Land des Empfängers (digitale
  Leistungen in Kenia, Nigeria …) sind damit nicht geklärt — Steuerberatung (docs/RECHNUNGEN.md).
- **Rechnungsangaben für Afrika tauglich:** Land als Auswahl mit Namen („Uganda") statt Kürzel-Feld;
  Postleitzahl nicht mehr Pflicht (Uganda und Ruanda haben keine — vorher musste man eine erfinden).

## Melden: gleicher Engpass, eine Meldung

In Afrika sind Meldungen aus Apotheken oft die einzige Quelle. Bisher legte jede Apotheke, die
denselben Engpass meldete, eine **eigene** Meldung an („Amoxicillin", „Amoxicilina", „amoxycilin") —
keine erreichte die Schwelle „von 3 Apotheken bestätigt". Jetzt:

- **Zweite Meldung = Bestätigung:** Hat eine andere Apotheke im selben Land den Wirkstoff schon offen
  gemeldet, zählt die neue Meldung als „Auch bei uns" (über den sprachübergreifenden
  Wirkstoff-Schlüssel, also auch „Amoxicilina" = „Amoxicillin"). Die Apotheke sieht: „Another pharmacy
  had already reported Amoxicillin. Your report counts as a confirmation". Über Ländergrenzen wird
  nichts zusammengeführt. Die 24-Stunden-Regel für neue Konten gilt weiter.
- **Vorschläge beim Tippen:** im Land gemeldete Wirkstoffe plus die häufigen (in Afrika an der
  WHO-Liste unentbehrlicher Arzneimittel orientiert) — gleiche Schreibweise von Anfang an.

## Alle afrikanischen Länder (Stand 22.10.2026)

Owner: „Konzentriere dich auf alle afrikanischen Länder" — Uganda war nur das Testbeispiel. Seit
dieser Runde prüft `server/test/afrika-alle-laender.test.js` **jedes** Land der Region AFRICA einzeln:
Ländercode, Sprache, Währung, Zeitzone, Behörde, Rechts-/Zahlprofil mit Krypto, vorsichtige
Rechtsstufe der Tauschbörse, Presse-Suche, Datums- und Euro-Format, Afrika-Preis 3,00 €, keine
EU-Umsatzsteuer, afrikatypische Vorschläge. Ein neues Land, dem eine Stelle fehlt, macht den Test rot.

**27 von 54 Ländern** (zweite Welle +9):

| Sprache der App | Länder |
|---|---|
| Englisch (22) | Nigeria, Kenia, Ghana, Südafrika, Uganda, Tansania, Sambia, Simbabwe, Ruanda, Botswana, Namibia, Malawi, Äthiopien, Sierra Leone, Liberia, Gambia, **Lesotho, Eswatini, Mauritius, Seychellen, Südsudan, Eritrea** |
| Portugiesisch (5) | Angola, Mosambik, **Kap Verde, Guinea-Bissau, São Tomé und Príncipe** |

Behörden der zweiten Welle (recherchiert, nichts erfunden): Lesotho und Eswatini — Behörde gesetzlich
vorgesehen, noch im Aufbau, bis dahin Gesundheitsministerium; Mauritius — Pharmacy Board (Pharmacy Act
1983); Seychellen — Gesundheitsministerium (Pharmacy Act); Südsudan — DFCA (Act 2012); Eritrea — NMFA;
Kap Verde — ERIS (Portaria 50/2021); Guinea-Bissau, São Tomé — Gesundheitsministerium (keine belastbare
Quelle für eine eigene Behörde). Nachrichtenquellen: 7 neue Feeds (nicht live geprüft — bitte
„Quellen testen"); **Guinea-Bissau und São Tomé ohne eigene Quelle**, weil keine offizielle Seite
belegbar war — dort Afrika-/Welt-Nachrichten, Presse-Suche und Apotheken-Meldungen.

Gefunden beim Durchspielen: Kap Verde zeigte „3$00 €" (regionales Format nimmt das Escudo-Zeichen als
Dezimaltrenner) → Portugiesisch-Standardformat; der Test prüft jetzt das Euro-Format je Land.

**Noch nicht abgedeckt — 27 Länder, weil die Sprache fehlt:**
- **Französisch (≈ 21):** Senegal, Côte d'Ivoire, Kamerun, DR Kongo, Kongo, Gabun, Burkina Faso, Mali,
  Niger, Tschad, Zentralafrika, Benin, Togo, Guinea, Madagaskar, Burundi, Dschibuti, Komoren,
  Mauretanien (auch Arabisch); Marokko, Algerien, Tunesien (Arabisch/Französisch). → Französisch ist
  seit 22.10.2026 die vierte Sprache der App (siehe unten); die Länder folgen.
- **Arabisch:** Ägypten, Libyen, Sudan (u. a.) — braucht Rechts-nach-links-Darstellung.
- **Spanisch:** Äquatorialguinea. **Somali/Arabisch:** Somalia.


## Französisch — vierte Sprache der App (Stand 22.10.2026)

Voraussetzung für das frankophone Afrika (gut 20 Länder). Die Länder selbst folgen im nächsten Schritt;
die Sprache ist jetzt vollständig da:

- **Oberfläche:** alle 2 303 Texte auf Französisch (Sie-Form, « » nur wo nötig, Platzhalter und
  Symbole wie im Englischen). Geprüft: gleiche Schlüssel wie Deutsch, gleiche Platzhalter wie Englisch,
  kein Text wortgleich englisch geblieben.
- **Server-Texte:** Wochenbericht, Push-Nachrichten, Vorschau beim Teilen (WhatsApp), öffentliche
  Engpass-Seiten (Google), Startseiten-Kopf und App-Name auf dem Handy, Lagebild-Hinweis, Übersetzen auf
  Zuruf (Zielsprache fr), Antibiotika-Quellen.
- **Patienten-Infokarten und Begleitzettel** auf Französisch (5 Karten, Hinweis, Quelle OMS/AGES;
  Entsorgung außerhalb Österreichs ohne Rücknahme-Versprechen — wie in den anderen Sprachen).
- **Erste Schritte (Afrika):** die 14 Vorschläge auf Französisch (Artéméther/Luméfantrine, Ocytocine,
  Sels de réhydratation orale …).
- **Presse-Suche:** französische Suchwörter; Mauritius und Seychellen suchen jetzt englisch **und**
  französisch (dort schreibt die Presse überwiegend bzw. teils französisch), Schweiz und Kanada ebenso.

**Grammatik der Ländernamen.** „en {Land}" ist für die halbe Region falsch: richtig ist „au Sénégal",
„au Cameroun", aber „en Côte d'Ivoire", „aux Comores", „à Madagascar". Für Apothekerinnen in Dakar liest
sich der Fehler wie Maschinenübersetzung — und dann traut man auch den Engpass-Angaben weniger.
`server/src/domain/franzLand.js` setzt die Präposition nach festen Regeln (Inselstaat, Plural, Vokal,
„République …", Geschlecht, Ausnahmen wie Mozambique/Zimbabwe; bei Bindestrich zählt der erste Teil:
„au Congo-Brazzaville"). Die Oberfläche trägt eine Kopie in `ti()`; ein Test hält beide gleich.

**Wirkstoffe über Sprachen.** Französische (und portugiesische) Namen fielen teils nicht auf denselben
Schlüssel wie die englischen — „Ocytocine"/„Ocitocina" ≠ „Oxytocin", „Sulfate de zinc" ≠ „Zinc
sulfate". Dann hätte die Frühwarnung einen Engpass in Kenia für eine Apotheke in Dakar nicht erkannt.
Jetzt: Füllwörter (de, du, da …) fallen weg, bei „Salz de Metall" steht das Metall vorn, INN-Sprach-
fassung Ocytocine/Ocitocina, Orale Rehydratationssalze in fr/pt. Gegenrichtung bleibt geprüft:
Zink- ≠ Magnesiumsulfat, Kaliumchlorid ≠ Kaliumcitrat, Prednison ≠ Prednisolon.

**Bewusst nicht gemacht:** Behördenmeldungen werden weiterhin beim Eingang in de/en/pt
zusammengefasst und gespeichert. Französisch kommt über „Übersetzen" auf Zuruf — keine neue
Datenbankspalte und keine Mehrkosten pro Meldung. Wer auf Französisch liest, sieht bis dahin die
englische Zusammenfassung bzw. das Original (so ist klar, welche Sprache es ist).

**Nebenbei behoben (alle Sprachen):** Wer die Anmeldeseite direkt neu lud, sah Kopfzeile („Menü") und
Sprunglink auf Deutsch — auch auf Englisch und Portugiesisch. Jetzt beschriftet die Anmeldeseite den
Kopf selbst.

## Dritte Welle: frankophones Afrika (Stand 22.10.2026)

**49 von 54 Ländern** sind jetzt im Register (vorher 27). Neu, alle mit Französisch als App-Sprache:

| Länder | Währung | Behörde (Recherche) |
|---|---|---|
| Senegal | XOF | ARP — Agence sénégalaise de Réglementation pharmaceutique (Décret 2022-824) |
| Côte d'Ivoire | XOF | AIRP (Loi 2017-541) — airp.ci |
| Kamerun (fr/en) | XAF | DPML, Gesundheitsministerium |
| DR Kongo | CDF | ACOREP (seit 2020) |
| Kongo | XAF | Direction de la Pharmacie et du Médicament (Name wechselnd belegt) |
| Gabun | XAF | ANMAPS (2023) |
| Burkina Faso | XOF | ANRP (2018) |
| Mali | XOF | DPM (Décret 2011-753) |
| Niger | XOF | Gesundheitsministerium — eigene Agentur beschlossen, Name nicht belegt |
| Tschad | XAF | DGPML |
| Zentralafrika | XAF | Gesundheitsministerium — keine Behörde belegbar |
| Benin | XOF | ABMed — abmed.bj |
| Togo | XOF | Gesundheitsministerium — neue Agentur 2025 beschlossen, Name nicht belegt |
| Guinea | GNF | DNPM (Loi L/2018/024/AN) |
| Madagaskar | MGA | Agence du Médicament de Madagascar |
| Burundi | BIF | ABREMA (Décret 100/039, 2021) |
| Dschibuti | DJF | DMPL (Arrêté 166/2015) |
| Komoren | KMF | ANAMEV |
| Mauretanien | MRU | Gesundheitsministerium — keine Behörde belegbar |
| Marokko | MAD | AMMPS — ammps.gov.ma |
| Algerien | DZD | ANPP |
| Tunesien | TND | ANMPS (Loi 2023-2) |

Je Land: Rechts-/Zahlprofil mit **Krypto**, Afrika-Preis 3,00 €, keine EU-Umsatzsteuer, Datums- und
Zahlformat (fr-SN, fr-CM …), Presse-Suche auf Französisch (Kamerun auch Englisch), Vorschläge auf
Französisch. Rechtsstufe vorsichtig wie bei Angola/Mosambik: Aktionen und Preisvergleich nur mit
Hinweis (Preise dort meist staatlich festgesetzt), Tauschbörse gesperrt — ohne eigene Rechtsanalyse.

**Quellen.** Nur 5 neue Nachrichten-Feeds (Côte d'Ivoire, Benin, Marokko, Burkina Faso, Algerien) —
nur Domains, die eine amtliche Stelle selbst nennt; Pfad nicht live geprüft (bitte „Quellen testen";
bei 404 sucht die Selbstfindung auf der Startseite). **17 Länder ohne eigene Quelle**, weil keine
belegbare Adresse gefunden wurde — dort Afrika-/Welt-Nachrichten, Presse und Apotheken-Meldungen.
Lieber keine Quelle als eine erfundene.

**Presse-Suche (GDELT).** Ländernamen nach GDELT-Liste; bei DR Kongo („democraticrepublicofthecongo"),
Kongo („republicofthecongo") und Côte d'Ivoire („ivorycoast") ist der Name nicht live geprüft — bleibt
die Presse leer, `APOPULSE_PRESSE_QUERY_<LAND>` setzen.

**Gefunden beim Durchspielen (Senegal, 360 px):** Der große Hauptknopf „Veuillez choisir au moins une
substance" durfte nicht umbrechen und schob die Seite 11 px über den Rand. Große Hauptknöpfe brechen
jetzt um (alle Sprachen); der Browser-Audit prüft Senegal auf Französisch bei 360 px. Außerdem:
Beträge in Währungen ohne Untereinheit (CFA-Franc, Uganda-Schilling …) erscheinen ohne „,00".

**Noch offen — 5 Länder:** Ägypten, Libyen, Sudan (Arabisch), Somalia (Somali/Arabisch),
Äquatorialguinea (Spanisch) → seit 22.10.2026 erledigt, siehe „Arabisch und die letzten Länder".

## Arabisch und die letzten Länder — alle 54 (Stand 22.10.2026)

**Alle 54 Länder Afrikas sind im Register.** Arabisch ist die fünfte Sprache der App, von rechts nach
links.

**Arabisch in der App**
- Alle 2 303 Texte (gleiche Schlüssel und Platzhalter, westliche Ziffern wie auf Packungen:
  04/03/2026, 3.00 €). Zurück-Pfeile zeigen nach rechts („→ رجوع").
- **Von rechts nach links:** `dir="rtl"` am Dokument; alle Abstände, Rahmen und Ausrichtungen sind
  jetzt *logisch* geschrieben (Anfang/Ende statt links/rechts) — sie drehen sich von selbst, in den
  übrigen vier Sprachen sieht alles aus wie vorher. Was mit links/rechts *positioniert* ist (Abzeichen,
  Menü, Suchsymbol, Spalten am Desktop), hat ein eigenes Gegenstück. Ein Test verbietet neue
  physische left/right-Abstände.
- Server: Wochenbericht, Push, Vorschau beim Teilen, öffentliche Engpass-Seiten, Startseite und App-Name
  — jede gebaute Seite mit `dir="rtl"`. Patienten-Infokarten und Begleitzettel auf Arabisch; eine
  arabische Karte steht auch in einer deutschen Oberfläche richtig herum.
- @-Namen (lateinisch) bleiben im arabischen Satz lesbar („@mitglied", nicht „mitglied@").

**Wirkstoffnamen bleiben lateinisch.** In Ägypten und im Maghreb schreiben Behörden, Großhandel und
Apotheken Wirkstoffe mit lateinischen Buchstaben (INN, englisch). Ein Wirkstoff in arabischer Schrift
träfe keine Behördenliste — die Frühwarnung bliebe stumm. Deshalb: Vorschläge, Beispiele und
Hinweise in der arabischen Oberfläche lateinisch („مثلًا Amoxicillin").

**Sprachwahl in mehrsprachigen Ländern.** Bisher folgte die Sprache allein dem Land. Neu: ein Knopf im
Menü und auf der Anmeldeseite, beschriftet mit dem Namen der anderen Sprache in ihrer eigenen Schrift
(„العربية", „Français", „English") — so findet ihn auch, wer die gerade angezeigte Sprache nicht liest.
Die Wahl bleibt gespeichert. Betrifft: Kamerun (fr/en), Marokko, Algerien, Tunesien, Mauretanien (fr/ar),
Ägypten, Libyen, Sudan (ar/en), Somalia (en/ar).

**Die letzten fünf Länder**

| Land | App-Sprache | Währung | Behörde (Recherche) |
|---|---|---|---|
| Ägypten | Arabisch (+ Englisch) | EGP | EDA — Egyptian Drug Authority (Gesetz 151/2019), edaegypt.gov.eg |
| Libyen | Arabisch (+ Englisch) | LYD | NCFDC; Registrierung beim Gesundheitsministerium |
| Sudan | Arabisch (+ Englisch) | SDG | NMPB — National Medicines and Poisons Board (Adresse laut WHO-Afrika-Liste) |
| Somalia | Englisch (+ Arabisch) | SOS | Gesundheitsministerium — Behördengesetz am 3.1.2026 beschlossen, Behörde noch im Aufbau |
| Äquatorialguinea | Französisch (Amtssprache) | XAF | Gesundheitsministerium (Ley 3/2003 de Medicamentos) |

Somali und Spanisch gibt es in der App nicht; Somalia startet deshalb auf Englisch (Sprache der
Ausbildung) mit Arabisch, Äquatorialguinea auf Französisch. Je Land wie bisher: Krypto-Zahlung,
Afrika-Preis 3,00 €, keine EU-Umsatzsteuer, vorsichtige Rechtsstufe (Tauschbörse gesperrt, Aktionen und
Preisvergleich mit Hinweis — in Ägypten sind Arzneimittelpreise staatlich festgesetzt). Quellen: EDA und
NMPB (Feed-Pfad nicht live geprüft, bitte „Quellen testen"); Libyen, Somalia, Äquatorialguinea ohne
eigene Quelle (keine belegbare Adresse). Presse-Suche auf Arabisch für Ägypten, Libyen, Sudan, Maghreb.

**Geprüft im Browser (360 px):** Ägypten auf Arabisch (Vorschlag per Zeitzone, Anmeldung, erste Schritte
mit lateinischen Wirkstoffen, Menü öffnet links, Premium 3.00 € mit Solana/Bitcoin/Ethereum, kein
Querscrollen), Desktop gespiegelt (Navigation rechts, Zusatzspalte links), Marokko Französisch ⇄
Arabisch über den Sprachknopf, bleibt nach Neuladen. Beide Abläufe prüft der Browser-Audit jetzt bei
jedem `npm run verify`.
