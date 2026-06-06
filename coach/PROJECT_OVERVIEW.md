# Apotrend AI Assistant — Project Overview

**Top-Level-Pitch und strategischer Rahmen.**

---

## Pitch (1 Absatz)

Ein **KI-Decision-Co-Pilot für Apotheken-Mitarbeiter**, eingebettet in die Apotrend-Plattform.
Er verknüpft den **eigenen Bestand** der Apotheke mit **Regulatorik** (Engpässe, Rückrufe, EKO),
**Produktkatalog/Substituten** und **Markt/Preis** — und macht daraus proaktive, quellenbelegte
Entscheidungen: was nachbestellen, was substituieren, wovor warnen, was vergleichen. Kein Chatbot,
sondern ein Agent, der den kognitiven Aufwand und das Risiko an der Tara senkt.

---

## Problem

Apotheken-Mitarbeiter recherchieren heute manuell über getrennte Quellen (WWS-Bestand, BASG-Engpassliste,
Rückrufe, Großhändler-Verfügbarkeit, Erstattungskodex). Das ist langsam, fehleranfällig und führt zu
Fehlbeständen, verpassten Rückrufen und Margenverlust.

## Lösung / Kern-Fähigkeiten
1. **Produktvergleiche** (Wirkstoff/Substitute, Verfügbarkeit, Preis/Erstattung)
2. **Produkte ↔ regulatorische Nachrichten verknüpfen** (Engpass/Rückruf trifft *deinen* Bestand)
3. **Bestands-Kenntnis & -Übersicht** (was liegt, was dreht, was fehlt)
4. **Bestell-Empfehlungen** (proaktiv vor Engpass/Stockout)

---

## Nutzer & Käufer (P-005 — Engagement ≠ Endorsement)
- **Nutzer:** PKA / Apotheker an der Tara — Tempo, Vertrauen, null Reibung.
- **Käufer:** Apotheken-Leiter/Inhaber — ROI: weniger Fehlbestände, bessere Marge, Compliance-Sicherheit, Zeit.
- Leitsatz: *„Mitarbeiter nutzen, Inhaber zahlt."* → zwei Produkt-Gesichter.

## Markt
**Österreich zuerst** (D-003). ~1.400 öffentliche Apotheken. WWS-Markt von **AVS/APOVERLAG**
dominiert (600+), pharmazeuten-eigen. DE/EU = Phase 2.

---

## Differenzierung / USP
- **Verknüpfung statt Einzeldaten:** Bestand × Regulatorik × Markt in *einer* Entscheidung.
- **Vorhandene Apotrend-Feeds als Startvorteil:** Engpass-, Rückruf- (openFDA), News-, Stock-Backend existiert bereits.
- **Vendor-unabhängiger Daten-Wedge:** Start über CSV/Export — kein WWS-Buy-in nötig (D-005, offen).
- **Compliance-by-Design** als Verkaufsargument (Gesundheits-Domäne).

## Abgrenzung zu Leo
**Leo** überarbeitet Design & Funktionalität der Plattform selbst. **Dimitri + Claude-Team** bauen den
**AI-Assistenten** als Modul. Schnittstelle (UI-Konsistenz + Plattform-Integration) gehört dem Head of Product.

---

## Phasen-Plan (Entwurf)
- **Phase 0 — Sensing & Konzept (jetzt):** Domänen-/Regulatorik-/Markt-Research, Datenzugang klären, Architektur + Decisions.
- **Phase 1 — Prototyp:** Daten-Ingestion (CSV-Export) + Agent (RAG über Apotrend-Feeds) + erste Decision-Surface; Eval-Harness; Compliance-Grundgerüst.
- **Phase 2 — Pilot mit echter Apotheke:** Mandanten-fähige Datenschicht, echte Auth, Pilot-Apotheke, ROI messen.
- **Phase 3 — Integration & Skalierung:** WWS-Integration/Partnerschaft, Geschäftsmodell, DE/EU.

---

## Risiken (Top)
| Risiko | Mitigation |
|---|---|
| Kein Datenzugang zum Bestand | CSV/Export-Wedge zuerst (D-005); WWS-Partnerschaft Phase 3 |
| APOVERLAG baut es selbst (Incumbent-Moat) | Schneller, verknüpfter, vendor-unabhängiger Mehrwert; Nische besetzen |
| Halluzination = Patientenrisiko | Grounded+zitiert, Agent-Eval, Reviewer-Gate |
| Regulatorik/Haftung (Medizinprodukt, Beratung) | Compliance-Frontlinie, Anti-Scope definieren |
| Datenschutz (DSGVO/Gesundheitsdaten) | Datenschicht-by-Design, Datenresidenz AT/EU prüfen |
