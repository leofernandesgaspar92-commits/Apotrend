window.__BRIEFING__ = {
  "meta": {
    "apotheke_name": "Muster-Apotheke (synthetisch)",
    "stand": "2026-06-06T08:00:00+02:00"
  },
  "recs": [
    {
      "typ": "rueckruf",
      "schweregrad": "kritisch",
      "pzn": "1000035",
      "titel": "Rückruf betrifft deinen Bestand: Ibufix 400 mg Filmtabletten",
      "details": "Charge IBU400-2410-B (14 Stk im Lager) — Chargenrückruf wegen Verpackungsfehler; betroffene Charge aus dem Verkauf nehmen. Sofort aus dem Verkauf nehmen.",
      "quellen": [
        "signals:SIG-003",
        "inventory:1000035"
      ]
    },
    {
      "typ": "engpass",
      "schweregrad": "hoch",
      "pzn": "1000011",
      "titel": "Engpass: Thyronil 100 µg Tabletten",
      "details": "Engpass (hoch), Eigenbestand 3 < Mindestbestand 8. Original beim Großhandel NICHT lieferbar. Substitut Levothyr 100 µg Tabletten (PZN 1000028, gleicher Wirkstoff) lieferbar bei Herba Chemosan (AEP €3.98, ~90 Min).",
      "quellen": [
        "signals:SIG-001",
        "inventory:1000011",
        "availability:1000011",
        "products:1000028",
        "availability:1000028"
      ]
    },
    {
      "typ": "nachbestellung",
      "schweregrad": "normal",
      "pzn": "1000042",
      "titel": "Nachbestellen: Pantogast 40 mg magensaftresistente Tabletten",
      "details": "Bestand 5 < Mindestbestand 6. Vorschlag: 15 Stk bei Kwizda (günstigster AEP €3.01).",
      "quellen": [
        "inventory:1000042",
        "availability:1000042"
      ]
    },
    {
      "typ": "ueberbestand",
      "schweregrad": "info",
      "pzn": "1000059",
      "titel": "Bestand prüfen: Grippostat Complex Granulat",
      "details": "Überbestand (22 > Max 12); Verfall in 55 Tagen (2026-07-31); Ladenhüter (Abverkauf 1/30 T). Nicht nachbestellen; ggf. retournieren/abverkaufen.",
      "quellen": [
        "inventory:1000059"
      ]
    },
    {
      "typ": "hinweis",
      "schweregrad": "niedrig",
      "pzn": "1000080",
      "titel": "Engpass (nicht bevorratet): Amoxclav 1000 mg/200 mg Pulver",
      "details": "Lieferengpass Amoxicillin/Clavulansäure i.v.; eingeschränkte Verfügbarkeit im Großhandel. Restmenge bei Phoenix.",
      "quellen": [
        "signals:SIG-002",
        "availability:1000080"
      ]
    }
  ]
};
