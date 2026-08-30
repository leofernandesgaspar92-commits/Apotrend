# ApoPulse AI Assistant — Prototyp

Decision-Co-Pilot für Apotheken-Mitarbeiter (Produkt, das das **Bau-Team `coach/`** baut).
Stand: Prototyp auf **Sample-Daten** (D-012). Markt AT-first (D-003).

## Architektur (bewusst geschichtet)
```
data/sample/*.json   ── schema-treue Daten (Warenverzeichnis/AVS/ePharmGH/BASG), Join-Key PZN
   │
src/sources/         ── Datenquelle-Schnittstelle: FileSource (heute) | DbSource+ePharmGH (Skelett)
src/data.js          ── loadContext(source): baut PZN-Kontext quellen-agnostisch (Umschalt-Punkt)
   │
src/engine.js        ── DECISION-ENGINE = Kern-Wert: verknüpft Bestand × Signale × Verfügbarkeit
   │                     × Substitution → quellenbelegte Empfehlungen. Deterministisch, keine Halluzination.
src/narrate.js       ── Narration. Default deterministisch; LLM-Schicht (D-006) ist abgetrennter Seam,
   │                     formuliert nur GEGROUNDETE Fakten, erfindet nichts.
src/cli.js           ── Einstieg (Tagesbriefing / Produktvergleich)
src/llm/             ── LLM-Schicht: LlmClient (EU-Residency-Pflicht) | EuProviderStub (Vendor beim Pilot)
src/export.js        ── exportiert Briefing → web/briefing.js
web/index.html       ── Standalone-Decision-Surface (UI-Demo; spätere Integration in Leos Design)
```
**Prinzip:** Fakten kommen deterministisch aus den Daten; ein LLM darf sie später nur *formulieren*,
nicht *erfinden* (Gesundheits-Domäne: Halluzination = Patientenrisiko).

## Ausführen (Node ≥18, keine Dependencies)
```bash
cd assistant
node src/cli.js                      # Tagesbriefing: "Was muss ich heute beachten?"
node src/cli.js compare 1000011 1000028   # Produktvergleich (Original ↔ Substitut)

# Datenquelle umschalten (default file):
APOPULSE_SOURCE=db node src/cli.js   # DB-/ePharmGH-Pfad (Skelett → klarer "nicht konfiguriert"-Fehler)

# Decision-Surface (UI-Demo) ansehen:
npm run export                       # erzeugt web/briefing.js
open web/index.html                  # im Browser (Doppelklick genügt, kein Server nötig)

# Tests:
npm test                             # node --test (13 Tests)
```

## Was der Prototyp kann (4 Kern-Fähigkeiten, an Sample-Szenarien)
1. **Regulatorik ↔ Eigenbestand verknüpfen:** Rückruf-Charge im Lager erkannt; Engpass trifft knappen Bestand.
2. **Produktvergleich & Substitution:** gleicher Wirkstoff/ATC, Preis (AEP/VKP), EKO, Rezeptpflicht, Lieferbarkeit.
3. **Bestands-Übersicht:** Unterschreitung Mindestbestand, Überbestand, naher Verfall, Ladenhüter.
4. **Bestell-Empfehlung:** Menge bis Höchstbestand + günstigster lieferbarer Großhändler.

## Bewusst (noch) NICHT enthalten
- Keine klinische Therapie-Empfehlung am Patienten (**D-009** Anti-Scope).
- Keine echte LLM-Anbindung (**D-006** offen) — Kern läuft deterministisch.
- Keine echten Daten (**D-012**) — Schemas sind drop-in-ready für reale Quellen.

## Nächste Schritte
- LLM-Narrations-Schicht anbinden (nach D-006, Datenresidenz AT/EU).
- Eval-Harness (Reviewer): erwartete Empfehlungen je Szenario als Test fixieren.
- Reale Daten einschwenken (Loader-Tausch: D-005/D-010/D-011).
- UI/Decision-Surface (Schnittstelle zu Leos Plattform-Design).
