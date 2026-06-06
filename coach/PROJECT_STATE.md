# Project State — Apotrend AI Assistant

**Letztes Update:** 2026-06-05
**Aktuelle Phase:** Phase 0 — Sensing & Konzept

---

## Status-Snapshot
| Bereich | Status |
|---|---|
| Coach-Infrastruktur | ✅ Aufgesetzt 2026-06-05 (12 Rollen / 4 Departments) |
| Produkt-Framing | ✅ Decision-Co-Pilot (D-001) |
| Team-Architektur | ✅ D-002 (sensing-first, Charter-Standard) |
| Markt-Scope | ✅ AT-first (D-003) |
| Plattform-Ansatz | ✅ Shell + eigene Datenschicht (D-004) |
| Anti-Scope | ✅ Keine klinische Therapie-Empfehlung (D-009) |
| Sensing: WWS-Landschaft AT | ✅ Erstrecherche (siehe unten) |
| Sensing: Bestell-Workflow | 🔄 Desk-Research ✅ + Erhebung Pilot-Apotheke offen (`research/D1_ops_bestell-workflow.md`) |
| **Pilot-Apotheke** | ✅ **vorhanden** — für Workflow-Erhebung + realen AVS-Export |
| Sensing: Daten-Fundament | ✅ Recherchiert (`research/datenquellen-architektur.md`) |
| **Eigen-Bestands-Zugang** | ⏳ offen — nach Workflow-Erhebung (D-005) |
| **Produkt-Stammdaten** | ⏳ offen — Warenverzeichnis-Lizenz (D-010) |
| Großhandels-Verfügbarkeit | ⏳ offen — ePharmGH (D-011) |
| **Prototyp-Daten** | ✅ **Sample-Daten** schema-treu (`assistant/data/sample/`, D-012) |
| LLM-/Tech-Stack | ⏳ offen (D-006) |
| Geschäftsmodell | ⏳ offen (D-007) |

---

## Sensing-Findings (2026-06-05) — WWS / Datenzugang AT

**Marktführer:** **AVS von APOVERLAG** (Österreichischer Apotheker-Verlag, branchen-eigen) —
600+ Apotheken, Windows-/on-prem. Schnittstellen: BMD-Fibu, Kommissionierautomaten, Scanner/
Kartenleser, e-Medikation/e-card, Webshops/ApoOnline, **ePharmGH** (Großhandels-Bestellung),
**Excel-/CSV-Export**, papierloses Belegarchiv.

**Weitere zugelassene AT-Softwarehäuser** (Pharmazeutische Gehaltskasse, Stand Jan 2026):
Apotronik · Herba Chemosan („Sanodat", großhändler-eigen) · ISO-Soft („Tara Manager") ·
HANN EDV · DataPharm · CRP Software. DE-Systeme teils präsent: WINAPO/CGM, GAWIS/ADV,
PROKAS/Awinta, IXOS/Pharmatechnik.

**Strategische Erkenntnis:** APOVERLAG sitzt auf WWS **+** Arzneimittel-Stammdaten (Warenverzeichnis)
**+** Großhandels-Bestellung (ePharmGH) → Moat + Abhängigkeits-/Konkurrenzrisiko.

**Datenzugang-Pfade:** (1) **CSV/Excel-Export** aus AVS — niedrige Reibung, vendor-unabhängig → **bester Start-Wedge**;
(2) WWS-Integrations-Partnerschaft — hoch, Incumbent-abhängig (Phase 3); (3) Großhändler-Daten
(ePharmGH-Standard) — Katalog/Verfügbarkeit, nicht Eigen-Bestand.

> Quellen: apoverlag.at (AVS), gehaltskasse.at (Anbieter-Verzeichnis), pharmazeutische-zeitung.de.

## Sensing-Findings (2026-06-06) — Bestell-/Nachschub-Workflow

Großhandel **mehrmals täglich** (Herba Chemosan >40 %, Lieferung ~90 Min); Bestellung semi-automatisch
über WWS (`ePharmGH`) oder Telefon. WWS erzeugt **automatischen Bestellvorschlag** (`Meldebestand =
Ø-Tagesverbrauch × Wiederbeschaffungszeit + Sicherheitsbestand`), Mitarbeiter prüfen/überstimmen.
**Strategische Erkenntnis:** Der Min/Max-Vorschlag existiert bereits → **wir bauen ihn nicht nach**;
unser Wert ist die **Intelligenz-Schicht darüber** (Engpass/Rückruf/Regulatorik/Substitution/Cross-GH).
Details + Erhebungsleitfaden: `research/D1_ops_bestell-workflow.md`.

## Sensing-Findings (2026-06-06) — Daten-Fundament (4 Schichten)
Stammdaten = **Warenverzeichnis** (Apotheker-Verlag/DATACARE, **lizenzpflichtig**: PZN, Preise, **EKO**,
Rezeptpflicht) · Eigen-Bestand = WWS-CSV-Export · Großhandels-Verfügbarkeit = **ePharmGH** (DATACARE/ARGE;
DE: MSV3) · Medizinprodukte = **EUDAMED** (EU, Public-API). **Join-Key: PZN.** Keystone-Risiko:
APOVERLAG/DATACARE/ARGE kontrollieren das Backbone. Details + Empfehlung: `research/datenquellen-architektur.md`.

---

## ▶ Nächste Aktionen (Wiedereinstieg)
1. **Prototyp-Agent gegen Sample-Daten bauen** (`assistant/data/sample/`): grounded + zitiert, deckt die
   Demo-Szenarien ab (Engpass→Substitut, Rückruf→Eigenbestand, Nachbestellung, Überbestand). ← jetzt buildable
2. **D-006 anstoßen:** LLM-/Modell-Markt-Check (Datenresidenz AT/EU als harte Variable) — für den Agenten.
3. **Pilot-Apotheke besuchen** (parallel): Ist-Bestell-Workflow erheben + anonymisierten AVS-Export →
   speist D-005; Warenverzeichnis-/ePharmGH-Nutzung der Apotheke abfragen (D-010/D-011).
4. **Reale Daten einschwenken** (später): nur Loader-Quellen tauschen, Schemas bleiben.

---

## Offene Fragen
- ✅ Pilot-Apotheke vorhanden — Termin/Erhebung planen.
- Verhältnis zu Leos überarbeiteter Plattform: Zeitplan/Schnittstelle?
- Budget/Modell-Kosten-Rahmen für LLM-Inferenz?

---

## Änderungs-Protokoll
| Datum | Änderung |
|---|---|
| 2026-06-05 | Coach-Infrastruktur aufgesetzt; D-001…D-004; WWS-Sensing-Erstrecherche. |
| 2026-06-06 | Mandat geschärft (Coach=Bau-Team Apotrend, Fokus Assistant); Ordner→`coach/`; D-009 Anti-Scope; Bestell-Workflow-Desk-Research + Erhebungsleitfaden; Pilot-Apotheke bestätigt. |
| 2026-06-06 | Daten-Fundament recherchiert (Warenverzeichnis/DATACARE · ePharmGH · EUDAMED · PZN als Join-Key); D-010/D-011 ergänzt; `research/datenquellen-architektur.md`. |
| 2026-06-06 | Sample-Daten (schema-treu) angelegt `assistant/data/sample/` + D-012; Prototyp-Agent jetzt buildable. |
