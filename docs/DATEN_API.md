# Daten-Schnittstelle (Business-Tarif)

Großhandel, Apothekenketten und Klinik-Einkauf wollen nicht täglich eine Webseite öffnen.
Sie wollen, dass **ihre Warenwirtschaft oder Excel-Tabelle selbst fragt**: „Welche Wirkstoffe
meiner Bestellung sind gerade knapp — laut wem?" Dafür zahlen sie, und zwar mehr als für
Premium: Es spart täglich Arbeit und verhindert Fehlbestellungen.

## Tarif

| Produkt | Startpreis | enthält |
|---|---|---|
| `business_monthly` | 99 € / Monat | Daten-Schnittstelle + Premium |
| `business_yearly` | 990 € / Jahr | Daten-Schnittstelle + Premium |

Preise ohne Code ändern: `APOPULSE_PREISE_BUSINESS="monat:99,jahr:990"` (EUR).
Zahlung über dieselbe Strecke wie Premium — **Krypto bleibt vollständig erhalten**, dazu Karte/
PayPal, falls eingerichtet. Die Laufzeit verlängert sich ab dem bisherigen Ablauf; Premium läuft
mit (Produktfeld `zusatz`).

In der App: Menü → **Daten-Schnittstelle** (auch verlinkt auf der Premium-Seite). Dort:
Schlüssel anlegen (höchstens 5), Nutzung je Schlüssel sehen, löschen, Anleitung für Excel und IT.

## Für die IT

Anmeldung mit Schlüssel (`apk_…`) als Kopfzeile:

```
Authorization: Bearer apk_…
# oder
X-API-Key: apk_…
```

Nur bei `GET` darf der Schlüssel auch als `?key=` in der Adresse stehen — Excel („Daten → Aus
dem Web") kann keine Kopfzeilen setzen. Wer das nutzt, behandelt die Adresse wie ein Passwort.

### Endpunkte

| Aufruf | Zweck |
|---|---|
| `GET /api/v1/engpaesse?land=AT[,DE][&herkunft=behoerde][&status=kritisch][&format=csv]` | aktuelle Engpässe |
| `GET /api/v1/pruefen?land=AT&wirkstoffe=Amoxicillin;Ibuprofen[&format=csv]` | eigene Liste prüfen |
| `POST /api/v1/pruefen` mit `{"land":"AT","wirkstoffe":["Amoxicillin 1000 mg", …]}` | dasselbe, bis 500 Zeilen |
| `GET /api/v1/status` | Tarif-Ablauf, Stand des letzten Abrufs, Länder mit Behördenliste |

Felder einer Engpass-Zeile: `wirkstoff`, `wirkstoff_schluessel` (sprachübergreifend, z. B. für
„Cefuroxim-Axetil" = „Cefuroxime Axetil"), `bezeichnung`, `land`, `status` (`kritisch` |
`eingeschraenkt`), `grund`, `gemeldet_am`, `voraussichtlich_bis`, `herkunft`, `quelle`,
`bestaetigt_von` (nur Apotheken-Meldungen: wie viele Apotheken sie tragen; ab 3 gilt sie als bestätigt).

Prüf-Ergebnis je Zeile: `einstufung` = `knapp` (im Land gemeldet) | `ausland` (anderswo knapp,
hier nicht) | `wiederholt` (früher schon knapp) | `ruhig` | `unbekannt` (kein Treffer), dazu
Status, voraussichtliches Ende, Tage seit Beginn, Herkunft, Quelle, Länder im Ausland.

CSV: Semikolon, UTF-8 mit BOM (Umlaute in Excel), Zellen mit `= + - @` am Anfang werden mit `'`
entschärft (keine Formel-Ausführung in Excel).

### Regeln (im Code, `server/src/services/datenApi.js`)

- **Nur echte Herkunft:** `herkunft` = `behoerde` (amtliche Liste) oder `apotheken_meldung`
  (gemeldet aus Apotheken, nicht amtlich). **Referenz-/Beispieldaten sind nie enthalten** — eine
  Warenwirtschaft würde danach umbestellen.
- Keine Therapie- oder Austauschempfehlung; die Antwort sagt das im Feld `hinweis`.
- Schlüssel werden **nur einmal** im Klartext gezeigt; gespeichert ist der SHA-256-Hash.
- **Tarif abgelaufen → 402** mit Datum, nicht still eine leere Liste („keine Engpässe" wäre
  gefährlich falsch).
- Höchstens 120 Anfragen je Minute und Schlüssel (429 mit `Retry-After`).
- Konto gelöscht → alle Schlüssel ungültig.

### Fehlercodes

| Status | `code` | Bedeutung |
|---|---|---|
| 401 | `api_schluessel` | Schlüssel fehlt, falsch oder gelöscht |
| 402 | `api_tarif` | Business-Tarif fehlt oder abgelaufen |
| 400 | `api_land`, `api_leer` | unbekanntes Land / keine Wirkstoffe |
| 429 | `api_limit` | zu viele Anfragen |
