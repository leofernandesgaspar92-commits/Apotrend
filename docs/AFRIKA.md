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
