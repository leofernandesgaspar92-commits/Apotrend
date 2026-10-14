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
