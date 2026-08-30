# Sample-Daten — ApoPulse AI Assistant (synthetisch)

> ⚠️ **Alle Daten hier sind frei erfunden** (Produktnamen, Hersteller, PZN, Preise, Chargen, Signale).
> Sie dienen ausschließlich dem Prototyp-Bau, solange keine echten Daten vorliegen (Decision **D-012**).
> Sie sind **schema-treu** zu den realen Quellen (siehe `coach/research/datenquellen-architektur.md`),
> damit später nur die Datenquelle getauscht wird, nicht der Code.

## Die 4 Schichten ↔ reale Quellen
| Datei | Spiegelt reale Quelle | Realer Bezug später |
|---|---|---|
| `products.json` | **Warenverzeichnis** (Apotheker-Verlag/DATACARE) | Lizenz — D-010 |
| `inventory.json` | **WWS-Export (AVS)** der Apotheke | CSV-Export — D-005 |
| `availability.json` | **ePharmGH** Großhandels-Verfügbarkeit | über WWS — D-011 |
| `signals.json` | **BASG/AGES** Engpässe & Rückrufe | bestehende ApoPulse-Feeds + BASG |

**Join-Key über alle Dateien: `pzn`** (Pharmazentralnummer).

## Eingebaute Demo-Szenarien (zeigen den Wedge)
1. **Engpass → Substitut** — `SIG-001` (Levothyroxin, PZN 1000011) trifft Eigenbestand (nur 3 < min 8);
   Original beim Großhandel **nicht lieferbar**; Alternative PZN 1000028 (gleicher Wirkstoff/ATC) **lieferbar**.
2. **Rückruf → Eigenbestand** — `SIG-003` (Charge `IBU400-2410-B`) liegt **genau so im Lager** (PZN 1000035)
   → „aus dem Verkauf nehmen".
3. **Normale Nachbestellung** — PZN 1000042 knapp unter Mindestbestand, lieferbar (Preisvergleich Herba vs. Kwizda).
4. **Überbestand/Verfall** — PZN 1000059: Bestand 22 ≫ max 12, Verfall 2026-07-31, Abverkauf 1/30d → Ladenhüter.
5. **Engpass ohne gelistetes Substitut** — `SIG-002` (Amoxicillin, PZN 1000080): Herba nicht lieferbar,
   Phoenix Restmenge → Cross-Großhändler-Hinweis.
6. **Medizinprodukt** — PZN 1000066 mit `udi` (EUDAMED-artig).

## Reale Daten einschwenken (später)
Schemas beibehalten, nur die Loader-Quelle ersetzen:
`products` → Warenverzeichnis-Import · `inventory` → AVS-CSV-Parser · `availability` → ePharmGH-Response ·
`signals` → BASG-Feed (+ vorhandenes ApoPulse-Backend `api/engpass`, `api/recalls`).
