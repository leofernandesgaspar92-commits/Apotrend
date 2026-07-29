# Live-Daten anschließen (Auto-Refresh)

Solange **keine** Live-Quelle konfiguriert ist, läuft Apotrend auf kuratierten
**Referenzdaten** (Seed, `provenance='reference'`). Das ist überall ehrlich
gekennzeichnet. Sobald pro Land eine Quelle-URL gesetzt wird, holt der Server
dort **automatisch** echte Engpassdaten, validiert sie und übernimmt sie
(`provenance='verified'`). Es ist **kein Code-Deploy** nötig — nur die
Umgebungsvariable setzen und neu starten.

## 1. Quelle anschließen

Pro Land eine Umgebungsvariable mit der Feed-URL setzen:

```
APOTREND_LIVE_SHORTAGES_AT = https://dein-server.example/at/shortages.json
APOTREND_LIVE_SHORTAGES_NG = https://dein-server.example/ng/shortages.json
```

Der Ländercode ist der ISO-Code aus `server/src/data/countries.js`
(`AT`, `DE`, `NG`, `BR`, …). Beim Start meldet der Server:
`ApoTrend: Live-Datenquellen angeschlossen für AT, NG — Auto-Refresh aktiv.`

- **Auto-Refresh:** sofort beim Start + danach alle 15 Minuten.
- **Fehler-sicher:** Schlägt der Abruf fehl oder sind die Daten ungültig,
  bleibt der bisherige Bestand unverändert (nie halbe/kaputte Daten).
- **Community-Meldungen** von Apotheken (`reporter_user_id` gesetzt) werden
  beim Aktualisieren **nie** überschrieben — nur die Feed-Daten werden ersetzt.

## 2. Der JSON-Vertrag

Die URL muss genau dieses JSON liefern (Content-Type `application/json`):

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

Analog zu Engpässen: Umgebungsvariable `APOTREND_LIVE_PRICES_<CC>` setzen.
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

Umgebungsvariable `APOTREND_LIVE_RABATTE_<CC>`. JSON-Vertrag:

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
`APOTREND_LIVE_<TYP>_<CC>` + Vertrag + `refresh…` in
`server/src/services/liveData.js`.
