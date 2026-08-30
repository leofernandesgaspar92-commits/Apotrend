# Live-Daten anschließen (automatische Aufnahme)

> **Stand der Prüfung:** Die Bauumgebung dieses Projekts hat **keinen Netzzugang**.
> Die unten voreingestellten Behörden-URLs konnten hier **nicht abgerufen** werden —
> sie sind Startwerte, keine Zusage. Parser, Doppelt-Erkennung, Taktung und
> Fehlerverhalten sind vollständig getestet (79 Tests, injizierter Abruf); ob eine
> konkrete URL trägt, zeigt nach dem ersten Lauf auf Render
> **`GET /api/live/status`**.

## Was automatisch läuft

| Aufgabe | Takt | Quelle | Ziel |
|---|---|---|---|
| **News** | alle **5 Minuten** | RSS/Atom von BfArM, PEI, BASG, EMA (+ eigene) | Beiträge im Fach-News-Feed |
| **Engpässe** | alle **4 Stunden** | JSON-Vertrag je Land ODER CSV-Register-Export | Tabelle `shortages` |
| Preise, Rabatte | alle 4 Stunden | JSON-Vertrag je Land | `prices`, `rabatte` |

Beide starten **versetzt** (8 s bzw. 25 s nach dem Hochfahren), damit der erste
Request nach einem Deploy nicht mit Netzabrufen um die CPU konkurriert. Alle
Zeitgeber sind `unref()`-t — sie halten weder Anfragen auf noch den Prozess-Exit.
Läuft eine Aufgabe noch, wird der nächste Takt übersprungen statt aufgestaut.

## Warum aus News keine Engpass-Datensätze werden

Eine Schlagzeile wie „Lieferengpass: Amoxicillin 1000 mg" ist eine **Meldung**,
kein Datensatz. Daraus per Textanalyse Wirkstoff, Status und Enddatum zu raten,
erzeugt Zahlen, die aussehen wie geprüfte Daten und keine sind — und eine
Apotheke entscheidet danach, ob sie umbestellt.

Deshalb zwei getrennte Wege:

- **News** (RSS/Atom) → Beiträge mit Titel, Datum, Quelle und **Link**. Keine
  Interpretation, kein Statuswert, keine Umformulierung.
- **Engpässe** (JSON/CSV) → Datensätze in `shortages`, nur aus **strukturierten**
  Exporten mit benannten Spalten. Fehlt eine Pflichtangabe oder ist der Status
  unbekannt, wird die Zeile **verworfen und gezählt**, nicht geraten.

Bietet ein Register nur HTML an, landet es im News-Weg — sichtbar und verlinkt,
aber ohne erfundenen Status. Ein HTML-Scraper ist bewusst **nicht** gebaut: Er
bricht beim ersten Redesign, und zwar still.

## Quellen steuern

Jede Quelle hat eine Kennung. Umgebungsvariablen:

```
APOPULSE_SOURCE_<ID>_URL      Adresse ersetzen — LEER = Quelle abschalten
APOPULSE_SOURCE_<ID>_FORMAT   rss | json | csv
APOPULSE_SOURCE_<ID>_KIND     news | shortages
APOPULSE_SOURCE_<ID>_COUNTRY  ISO-Ländercode
APOPULSE_SOURCE_<ID>_LABEL    Anzeigename
```

Eingebaut sind elf Quellen — zehn News und ein Engpass-Export:

| Kennung | Land | Behörde | Art |
|---|---|---|---|
| `BASG_NEWS` | AT | BASG | News (RSS) |
| `BFARM_NEWS` | DE | BfArM | News (RSS) |
| `PEI_NEWS` | DE | Paul-Ehrlich-Institut | News (RSS) |
| `SWISSMEDIC_NEWS` | CH | Swissmedic | News (RSS) |
| `MHRA_NEWS` | GB | MHRA | News (Atom) |
| `FDA_NEWS` | US | FDA | News (RSS) |
| `HEALTHCANADA_NEWS` | CA | Health Canada | News (RSS) |
| `TGA_NEWS` | AU | TGA | News (RSS) |
| `SAHPRA_NEWS` | ZA | SAHPRA | News (RSS) |
| `EMA_NEWS` | EU | EMA | News (RSS) |
| `BASG_SHORTAGES` | AT | BASG Vertriebseinschränkungen | Engpässe (JSON) |

Alle elf Behörden stehen mit genau diesen Namen im Länder-Register
(`src/data/countries.js`), die Quellenangabe am Beitrag passt also zum Land.

> **Die URLs sind Startwerte, keine Zusage.** Die Bauumgebung dieses Projekts
> hat keinen Netzzugang — sie konnten hier nicht abgerufen werden. Welche
> Quelle tatsächlich antwortet, steht nach dem ersten Lauf unter
> `/api/live/status`; jede lässt sich per Umgebungsvariable umbiegen oder mit
> leerem Wert abschalten.

Eine eigene Quelle entsteht allein durch das Setzen einer neuen `..._URL`:

```
APOPULSE_SOURCE_APOKAMMER_URL=https://www.apothekerkammer.at/rss
APOPULSE_SOURCE_APOKAMMER_COUNTRY=AT
APOPULSE_SOURCE_APOKAMMER_LABEL=Apothekerkammer
```

Ein CSV-Register als Engpass-Quelle:

```
APOPULSE_SOURCE_BASG_REGISTER_URL=https://…/vertriebseinschraenkungen.csv
APOPULSE_SOURCE_BASG_REGISTER_KIND=shortages
APOPULSE_SOURCE_BASG_REGISTER_FORMAT=csv
APOPULSE_SOURCE_BASG_REGISTER_COUNTRY=AT
```

Spaltennamen werden erkannt (`Wirkstoff`, `Arzneispezialität`, `Vertriebsstatus`,
`Status`, `Grund`, `bis` …). Passt eine Spalte nicht, meldet der Lauf sie als
verworfen — im Ergebnis unter `/api/live/status` sichtbar.

Passt gar nichts, weil eine Behörde ihre Felder umbenannt hat, lässt sich die
Zuordnung **ohne Deploy** setzen:

```
APOPULSE_SOURCE_BASG_SHORTAGES_COLUMNS={"bezeichnung":"nameDesArzneimittels","status":"vertriebsstatus"}
```

Dasselbe gilt für JSON-Quellen. Dort wird die Liste auch in einer üblichen Hülle
gefunden (`items`, `data`, `results`, `shortages`, `content`), nicht nur als
nacktes Array.

### Warum ein unbekannter Status die Zeile verwirft

Die naheliegende Schreibweise wäre `status: item.status || 'LIMITED'`. Sie
schreibt den Rohwert der Behörde ungeprüft weiter. Zwei Folgen, beide schlecht:
Ein unbekannter Wert fliegt beim Schreiben in die Datenbank auf die Nase (die
Spalte ist ein Enum) — oder, schlimmer, ein „nicht lieferbar" kommt als
„eingeschränkt lieferbar" in der Apotheke an. Das ist die eine Stelle, an der
jemand danach entscheidet, ob umbestellt wird.

Deshalb: bekannter Statuswert oder gar keine Zeile. Verworfene Zeilen werden
gezählt; liefert eine Quelle **nur** verworfene Zeilen, schreibt der Lauf eine
Warnung mit den ersten Gründen ins Log — sonst antwortet eine kaputte Quelle
weiter brav mit 200 OK und null brauchbaren Daten, und es fällt niemandem auf.

## Nachsehen und anstoßen

```
GET  /api/live/status          Aufgaben, letzter Lauf, Fehler, Quellen, Takte
POST /api/live/run/news        sofort ausführen (nur Moderation)
POST /api/live/run/shortages   sofort ausführen (nur Moderation)
```

Nach einem Deploy lohnt genau ein Blick: `GET /api/live/status`. Steht bei einer
Quelle ein Fehler, hat die Behörde ihren Feed verschoben — die URL im
Statusbericht zeigt, worauf gerade gezeigt wird.

## Aktionen/Rabatte eintragen

```
GET    /api/deals/mine     eigene Aktionen + ob das Konto eintragen darf
POST   /api/deals          Aktion anlegen
DELETE /api/deals/:id      eigene Aktion zurückziehen
```

Nur **Apotheken- und Pharma-Konten** dürfen eintragen (`private` und `authority`
nicht). Eingetragene Aktionen bekommen `provenance='self_reported'` und den Namen
des Betriebs — sie sehen damit anders aus als geprüfte Feed-Daten, was sie auch
sind. Ein Feed-Austausch löscht sie **nicht**.

Abgelehnt werden: Aktionspreis ≥ Listenpreis (irreführend), Enddatum in der
Vergangenheit, Laufzeit über 365 Tage.

**Rückfall:** Läuft **keine** echte Aktion mehr, legt der Server einen
Demobestand an — gekennzeichnet als `simulated`, Quelle „Demodaten", mit
Anbietern wie „Demo-Großhandel A". Entscheidend ist „laufend": Die kuratierten
Referenzdaten haben feste Enddaten und laufen nach und nach ab; eine Prüfung auf
„gibt es überhaupt Zeilen" hätte die leere Ansicht nie bemerkt. Abschalten mit
`APOPULSE_DEMO_DEALS=off`.

---

## Der JSON-Vertrag (bestehender Weg, unverändert)

```json
{
  "country": "AT",
  "source": "BASG",
  "fetched_at": "2026-07-29T10:00:00Z",
  "shortages": [
    {
      "wirkstoff": "Amoxicillin",
      "bezeichnung": "Amoxicillin 1000 mg Filmtabletten",
      "status": "kritisch",
      "grund": "Erhöhte Nachfrage",
      "gemeldet_am": "2026-06-14",
      "voraussichtlich_bis": "2026-08-15"
    }
  ]
}
```

| Feld                  | Pflicht | Werte / Format                                   |
|-----------------------|---------|--------------------------------------------------|
| `country`             | –       | ISO-Ländercode (informativ)                      |
| `source`              | –       | Behörde/Quelle; fehlt sie, wird der Regulator aus dem Länder-Register genutzt |
| `fetched_at`          | –       | ISO-Zeitstempel (informativ)                     |
| `shortages[]`         | ✅      | Array der Engpässe                               |
| `shortages[].wirkstoff`   | ✅  | nicht-leerer Text                                |
| `shortages[].bezeichnung` | ✅  | nicht-leerer Text                                |
| `shortages[].status`      | ✅  | `kritisch` \| `eingeschraenkt` \| `verfuegbar`   |
| `shortages[].grund`             | – | Text oder weglassen                        |
| `shortages[].gemeldet_am`       | – | `YYYY-MM-DD` oder weglassen                 |
| `shortages[].voraussichtlich_bis` | – | `YYYY-MM-DD` oder weglassen               |

Ungültige Zeilen (fehlender Wirkstoff/Bezeichnung, unbekannter Status) führen
dazu, dass der **gesamte** Payload verworfen wird und die alten Daten stehen
bleiben — bewusst streng, weil Engpassdaten sicherheitsrelevant sind.

## 3. Status prüfen

`GET /api/data-status` (eingeloggt) liefert für die aktive Länder-Ansicht:

```json
{ "country": "AT", "shortages": { "live": false, "source_configured": false } }
```

`live: true`, sobald die Quelle angeschlossen ist.

## 4. Preise (zweiter Datentyp, gleiche Logik)

Analog zu Engpässen: Umgebungsvariable `APOPULSE_LIVE_PRICES_<CC>` setzen.
JSON-Vertrag:

```json
{
  "country": "AT",
  "source": "Großhandel-X",
  "prices": [
    { "bezeichnung": "Amoxicillin 1000 mg", "wirkstoff": "Amoxicillin",
      "supplier": "Kwizda", "aep": 3.01, "prev_aep": 3.05, "currency": "EUR",
      "series": [3.10, 3.08, 3.05, 3.01] }
  ]
}
```

Pflichtfelder je Zeile: `bezeichnung`, `supplier`, `aep` (> 0). Ungültiger
Payload → gesamter Abruf verworfen, alte Preise bleiben. Status unter
`GET /api/data-status` → `prices.live`.

## 5. Rabatte/Aktionen (dritter Datentyp)

Umgebungsvariable `APOPULSE_LIVE_RABATTE_<CC>`. JSON-Vertrag:

```json
{
  "country": "AT",
  "source": "Aktions-Feed",
  "rabatte": [
    { "bezeichnung": "Ibuprofen 400 mg", "wirkstoff": "Ibuprofen",
      "supplier": "Kwizda", "listenpreis": 2.35, "aktionspreis": 1.60,
      "min_menge": 30, "gueltig_bis": "2026-12-31", "currency": "EUR" }
  ]
}
```

Pflichtfelder je Zeile: `bezeichnung`, `supplier`, `listenpreis` (> 0),
`aktionspreis` (> 0), `gueltig_bis` (`YYYY-MM-DD`). `rabatt_pct` und
`ersparnis` werden serverseitig berechnet. Status unter
`GET /api/data-status` → `rabatte.live`.

## 6. Weitere Erweiterung

Die Schnittstelle ist bewusst pro Datentyp aufgebaut. Weitere Feeds
(z. B. Rückrufe) folgen demselben Muster:
`APOPULSE_LIVE_<TYP>_<CC>` + Vertrag + `refresh…` in
`server/src/services/liveData.js`.
