# Landesspezifische Feature-Konfiguration

`GET /api/country-config?country=<CC>` (eingeloggt) liefert die aktiven und
geplanten Funktionen für ein Land nach dem Framework-Schema `active_features`.
Grundlage: `server/src/data/countryFeatures.js`.

**Ehrlichkeitsregel:** `enabled: true` nur für Funktionen, die **wirklich**
existieren. Daten-/sicherheitsabhängige Module (Echtheitsprüfung, Rückruf-
Tracking) sind `enabled: false` + `planned: true` — sie schalten sich erst
frei, wenn eine echte Quelle angeschlossen ist (siehe `LIVE_DATA.md`). Es
werden nie erfundene Daten oder Scheinfunktionen ausgeliefert.

## Beispiel (Nigeria)

```json
{
  "country": "NG",
  "language": "en",
  "currency": "NGN",
  "regulator": "NAFDAC",
  "active_features": [
    { "feature_id": "shortage_radar",     "type": "tab",    "enabled": true },
    { "feature_id": "price_compare",      "type": "tab",    "enabled": true },
    { "feature_id": "deals",              "type": "tab",    "enabled": true },
    { "feature_id": "stock_exchange",     "type": "tab",    "enabled": true },
    { "feature_id": "watchlist",          "type": "widget", "enabled": true },
    { "feature_id": "currency_converter", "type": "widget", "enabled": true },
    { "feature_id": "live_data_status",   "type": "badge",  "enabled": true },
    { "feature_id": "regulator_source",   "type": "link",   "enabled": true, "label": "NAFDAC", "url": "https://www.nafdac.gov.ng" },
    { "feature_id": "authenticity_check", "type": "widget", "enabled": false, "planned": true },
    { "feature_id": "recall_tracking",    "type": "feed",   "enabled": false, "planned": true }
  ]
}
```

## Gruppen (aus der Ziel-Matrix)

| Gruppe       | Länder (im Register)          | geplantes Extra-Modul   |
|--------------|-------------------------------|-------------------------|
| DACH         | AT, DE, CH, LI                | `pzn_matching`          |
| Lusophonie   | PT, BR, AO, MZ                | `import_logistics`      |
| Anglophonie  | GB, US, NG, KE, GH, CA, AU, ZA| `authenticity_check`    |

`recall_tracking` ist überall geplant (sicherheitskritisch → nur mit echter
Quelle). Neue Module werden hier ergänzt und schalten auf `enabled: true`,
sobald sie real gebaut/angeschlossen sind.
