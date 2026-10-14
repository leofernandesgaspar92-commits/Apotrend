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
