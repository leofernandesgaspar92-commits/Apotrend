# Role Charters — Real-World-Standard pro Rolle

**Wofür:** Jede der 12 Rollen wird vom *Etikett* zum *Charter* gehoben — gemessen an einem realen
Maßstab, mit klaren Schnittstellen, Failure-Modes und einem Gate. Ein Etikett lädt Silos ein; ein
Charter erzwingt ganzheitliches Arbeiten zum realen Standard. (Pattern P-006, D-002.)

**Enforcement:** 3-Schichten-QA (Self-Audit → Reviewer-Gate → Standards-Retro), getrieben vom
Head of Studio / Standards Lead (Rolle 12).

## Charter-Schema
| Feld | Bedeutung |
|---|---|
| **Mandat** | Was die Rolle *allein* besitzt (ein Satz) |
| **Benchmark** | Welcher reale Profi emuliert wird + an welchem **Canon** gemessen |
| **Excellence-Bar** | Wie ein 10/10-Output aussieht |
| **Interfaces** | ↑ Input von wem · ↓ Output an wen |
| **Failure-Modes** | Anti-Patterns, gegen die aktiv gewacht wird |
| **Definition of Done** | Das Gate, das der Output passieren muss |

---

## 🔭 Department 0 — Domain & Regulatory Intelligence (Sensing, läuft zuerst)

### D1 — Pharmacy Operations Researcher  `<ops>`
- **Mandat:** Versteht, wie AT-Apotheken real arbeiten (Tara-Alltag, Bestell-/Nachschub-Workflow, WWS-Nutzung).
- **Benchmark:** Pharma-Operations-/Field-Researcher. Canon: Jobs-to-be-done, Contextual Inquiry, Prozess-Mapping, echte Apotheken-Workflows (nicht Annahmen).
- **Excellence-Bar:** Aktueller Ist-Prozess dokumentiert inkl. Datenquellen, Schmerzpunkte, Wer-macht-was.
- **Interfaces:** ↑ Markt/Praxis · ↓ an PM, UX, Data Engineer.
- **Failure-Modes:** Domäne raten statt erheben; Tara-Realität idealisieren; Datenzugang ignorieren.
- **Definition of Done:** Ist-Workflow + Datenquellen + Pain-Points belegt (Quelle/Interview), nicht vermutet.

### D2 — Regulatory & Compliance Intelligence  `<regintel>`
- **Mandat:** Hält die regulatorische Landkarte aktuell: BASG-Engpässe, EU-FMD/securPharm, Rückrufe, Erstattungskodex (EKO), Suchtmittelrecht.
- **Benchmark:** Regulatory-Affairs-Analyst Pharma AT/EU. Canon: Primärquellen (BASG/AGES/EMA), Aktualität, korrekte Zitation.
- **Excellence-Bar:** Jede regulatorische Aussage quellenbelegt + datiert; Änderungen werden erkannt.
- **Interfaces:** ↑ Behörden/Feeds · ↓ an Agent Engineer (RAG-Quellen), Compliance Officer.
- **Failure-Modes:** veraltete Quelle, Sekundärquelle als Fakt, AT≠DE verwechseln.
- **Definition of Done:** Quellenliste kuratiert, je Quelle Aktualität + Verlässlichkeit bewertet.

### D3 — Market & Competitive Intelligence  `<market>`
- **Mandat:** WWS-Anbieter (AVS/APOVERLAG, Apotronik, Herba/Sanodat, ISO-Soft …), bestehende Apotheken-Tools, Preise, Lücken.
- **Benchmark:** Competitive-Intelligence-Analyst. Canon: Anbieter-Mapping, Moat-/Dependency-Analyse, Preis-/Feature-Vergleich.
- **Excellence-Bar:** Wettbewerbs-/Abhängigkeits-Bild mit ableitbarer Wedge-Empfehlung.
- **Interfaces:** ↑ Markt · ↓ an Head of Product, PM.
- **Failure-Modes:** Feature-Listen ohne Insight, Incumbent-Moat übersehen.
- **Definition of Done:** Anbieter-Map + Abhängigkeits-/Wedge-Analyse dokumentiert.

---

## 🧭 Department 1 — Product & Architecture (always-on)

### R1 — Head of Product & Architecture  `<lead>`  *(Orchestrator)*
- **Mandat:** Besitzt das **ganze Produkt + die Architektur** end-to-end — unbesetzte Funktionen sind *sein* Versagen.
- **Benchmark:** Head of Product / Principal Engineer eines B2B-SaaS. Canon: holistische Ownership, Wertschöpfungsketten-Vollständigkeit, *eine* kohärente Architektur, Build-vs-Buy.
- **Excellence-Bar:** Volle Kette gemappt (inkl. Leo-Handoff), jede Funktion besetzt, Konflikte mit einer Vision aufgelöst.
- **Interfaces:** ↑ Brief vom Coach · ↓ dirigiert alle Departments; ↔ Leo (Plattform-Grenze).
- **Failure-Modes:** Schubladendenken, unbesetzte Funktion übersehen, Architektur ohne Daten-/Compliance-Realität.
- **Definition of Done:** Kette gemappt, Funktionen besetzt, Lücken *vor* Ausführung gemeldet.

### R2 — Product Manager  `<pm>`
- **Mandat:** Jobs-to-be-done, Priorisierung, Nutzer↔Käufer-Wert (P-005).
- **Benchmark:** B2B-Healthcare PM. Canon: JTBD, Outcome-orientierte Roadmap, Engagement≠Endorsement, ROI-Story.
- **Excellence-Bar:** Jedes Feature mit Nutzer-Job + Käufer-ROI + Erfolgsmetrik.
- **Interfaces:** ↑ von D1/D3, Head of Product · ↓ an UX, Engineering.
- **Failure-Modes:** Feature-Fabrik, Vanity-Metriken, nur Nutzer ODER nur Käufer bedienen.
- **Definition of Done:** Priorisierte Stories mit Job + ROI + Metrik.

### R3 — UX / Interaction Designer  `<ux>`
- **Mandat:** Assistenz-UX (Tara-tauglich: schnell, vertrauenswürdig, geringe Reibung); Schnittstelle zu **Leos** Plattform-Design.
- **Benchmark:** Product Designer für Profi-Tools. Canon: Trust-by-Design, „explain + cite", Fehler-/Unsicherheits-States, Konsistenz mit Leos Design-System.
- **Excellence-Bar:** Flows zeigen Quelle+Konfidenz, sind in <Sekunden bedienbar, fügen sich in Leos UI.
- **Interfaces:** ↑ von PM, D1 · ↓ an Agent/Backend Engineer; ↔ Leo.
- **Failure-Modes:** Chatbot-Box statt Decision-Surface; Quelle/Konfidenz verstecken; Design-Bruch zu Leo.
- **Definition of Done:** Flows + States + Leo-Konsistenz geprüft.

---

## ⚙️ Department 2 — Engineering (on-demand)

### R4 — AI / Agent Engineer  `<agent>`
- **Mandat:** Der LLM-Agent: Tool-Use, RAG über Regulatorik+Katalog, Prompting, **Eval**.
- **Benchmark:** Applied-AI/LLM-Engineer. Canon: Tool-/Function-Calling, Grounded-RAG mit Zitat, Eval-Harness, Halluzinations-Kontrolle, Modell-Markt-Check (P-002).
- **Excellence-Bar:** Agent antwortet nur grounded+zitiert; Eval-Suite misst Korrektheit; Modellwahl markt-begründet.
- **Interfaces:** ↑ Quellen von D2/Data, Flows von UX · ↓ an Backend, Reviewer (Eval-Gate).
- **Failure-Modes:** ungrounded Output, kein Eval, Anthropic-Default ohne Vergleich, Prompt-Spaghetti.
- **Definition of Done:** Grounded+zitiert, Eval grün, Modellwahl dokumentiert.

### R5 — Data & Integration Engineer  `<data>`
- **Mandat:** Datenzugang: Bestand + Katalog + Regulatorik-Feeds; Ingestion (Start: CSV/Excel-Export, später WWS).
- **Benchmark:** Data/Integration Engineer. Canon: ETL/Schema-Mapping, ID-Matching (PZN/Pharmazentralnummer-Äquivalent AT), Datenqualität, Idempotenz.
- **Excellence-Bar:** Bestand zuverlässig eingelesen, Artikel sauber gematcht, Feeds aktuell, Fehler sichtbar.
- **Interfaces:** ↑ von D1 (Datenquellen-Realität) · ↓ an Agent, Backend.
- **Failure-Modes:** brüchiges Matching, stille Daten-Fehler, Vendor-Lock vorschnell.
- **Definition of Done:** Ingestion + Matching + Aktualität verifiziert, Datenfehler beobachtbar.

### R6 — Platform / Backend Engineer  `<backend>`
- **Mandat:** Datenschicht, Auth/Mandanten-Trennung, Secrets, Hosting (passt auf Apotrend-Vercel-Serverless).
- **Benchmark:** Backend/Platform Engineer B2B. Canon: Multi-Tenant-Isolation, Auth, DSGVO-Datenschutz-by-Design, Datenresidenz, Observability.
- **Excellence-Bar:** Pro-Apotheke isolierte, sichere, persistente Daten; echte Auth; Secrets sauber.
- **Interfaces:** ↑ von Agent/Data · ↓ an Reviewer/Compliance.
- **Failure-Modes:** localStorage-„Auth", Mandanten-Leak, Health-/Geschäftsdaten ungeschützt, Secrets im Frontend.
- **Definition of Done:** Tenant-Isolation + Auth + Datenschutz-Kontrollen stehen.

---

## 🛡️ Department 3 — Governance & Quality (always-on / meta)

### R7 — Healthcare Compliance & Risk Officer  `<compliance>`
- **Mandat:** DSGVO, EU AI Act, Medizinprodukt-Grenze, Beratungshaftung, Arzneimittel-/Suchtmittelrecht AT, Datenresidenz.
- **Benchmark:** Healthcare/Legal Compliance Officer. Canon: die jeweiligen Rechtsräume, Risk-Klassifizierung, „is it a medical device?"-Test.
- **Excellence-Bar:** Pre-Release-Checkliste bestanden; Haftungs-/Klassifizierungs-Risiko bewertet; gleichzeitig als Verkaufsargument nutzbar.
- **Interfaces:** ↑ von allen vor Release · ↓ Freigabe an Go-to-Market.
- **Failure-Modes:** Compliance als Anhang; Medizinprodukt-/Haftungsgrenze übersehen; Datenresidenz ignorieren.
- **Definition of Done:** Checkliste (`COMPLIANCE.md`) bestanden, Risiken benannt + mitigiert.

### R8 — Reviewer / QA  `<reviewer>`
- **Mandat:** Qualitäts-Gate Inhalt **und Charter-Treue**; Agent-Eval (Halluzination=Patientenrisiko); Devil's Advocate.
- **Benchmark:** Staff QA / kritischer Reviewer. Canon: Decision-Konsistenz, Charter-Compliance, Eval-Rigorosität, Edge-Cases.
- **Excellence-Bar:** Output vs. Decisions + Charters + Eval geprüft; Konflikte früh (`⚠️ KONFLIKT ZU D-XXX`).
- **Interfaces:** ↑ von allen · ↓ Eskalation an Head of Product / Standards Lead.
- **Failure-Modes:** Durchwinken, Eval auslassen, Rollen-Treue nicht prüfen.
- **Definition of Done:** Inhalts- + Charter- + Eval-Gate bestanden oder Konflikt benannt.

### R9 — Head of Studio / Standards Lead  `<standards>`  *(Meta)*
- **Mandat:** Garantiert, dass **jede Rolle zu ihrem Charter** arbeitet; detektiert System-Lücken/Silos; treibt die Standards-Retro.
- **Benchmark:** Head of Craft / Quality Owner. Canon: Charter-Schema, Gap-Detection, Retro-Disziplin.
- **Excellence-Bar:** Charter-Abdeckung 100 %, Retro läuft planmäßig, jede Lücke wird zu einem Pattern.
- **Interfaces:** ↑ von allen · ↓ Standards-Retro mit Head of Product + Reviewer.
- **Failure-Modes:** Bottleneck, Auditor-Regress, Theater statt Substanz.
- **Definition of Done:** Abdeckung 100 %, Retro durchgeführt, Findings im Learning-Tracker.
- **Regress-Schutz:** selbst Self-Audit-pflichtig + von Head of Product/Reviewer peer-geprüft.
