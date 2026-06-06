# Architecture Decision Log — Apotrend AI Assistant

**Wofür:** Jede strategische, architektonische oder Tool-Entscheidung mit Datum, Kontext, Optionen,
Begründung. **Format:** nummeriert D-001, D-002, …

---

## D-001: Produkt = „Decision-Co-Pilot für Apotheken" (nicht Chatbot)

**Datum:** 2026-06-05 · **Status:** ✅ Aktiv · **Tags:** product, strategy

**Kontext:** Vier gewünschte Fähigkeiten (Produktvergleich, Regulatorik-Verknüpfung, Bestands-Kenntnis,
Bestell-Empfehlung) sind im Kern *ein* Job: fragmentierte Quellen → sichere Entscheidungen.

**Entscheidung:** Das Produkt wird als **proaktiver Decision-Co-Pilot** für Apotheken-Mitarbeiter
gebaut, nicht als reaktiver Chatbot. Moat = die **Verknüpfung** (Bestand × Regulatorik × Markt/Preis),
nicht die Einzeldaten. **Nutzer↔Käufer-Asymmetrie (P-005):** Tara-Mitarbeiter nutzt täglich,
Inhaber/Leiter kauft → Produkt braucht zwei Gesichter (Mikro-Nutzen + ROI/Sicherheits-Story).

**Verworfen:** Reiner Q&A-Chatbot → erzeugt keinen wiederkehrenden Wert, keine Kauf-Story.

**Konsequenzen:** UX als „Decision-Surface" mit Quelle+Konfidenz; PM bewertet jedes Feature auf
Nutzer-Job ∧ Käufer-ROI.

---

## D-002: Team-Architektur — 12 Rollen in 4 Departments, sensing-first, Charter-Standard

**Datum:** 2026-06-05 · **Status:** ✅ Aktiv · **Tags:** coach, architecture, process

**Kontext:** Prinzip-Übertragung vom Fin-&-Ari-Creative-Studio. Dimitri kennt die Apotheken-Domäne
nicht → Sensing ist der höchste Hebel (P-004). Solo-Realität → schlanker Roster statt 19 Köpfe.

**Entscheidung:** 4 Departments (`AI_PRODUCT_COACH.md`, `ROLE_CHARTERS.md`):
- **0 · Domain & Regulatory Intelligence** (D1 Ops, D2 Regulatory, D3 Market) — *läuft zuerst*
- **1 · Product & Architecture** (R1 Head of Product/Orchestrator, R2 PM, R3 UX)
- **2 · Engineering** (R4 Agent, R5 Data/Integration, R6 Backend)
- **3 · Governance & Quality** (R7 Compliance, R8 Reviewer/QA, R9 Standards Lead)

Plus: Role-Charter-Standard + 3-Schichten-QA + Anti-Silo-Pflicht. Carry-over-Patterns P-001…P-006 aktiv.

**Verworfen:** 19-Rollen-Apparat (Overkill/Token-Grab für Solo); Rollen als Labels (P-006).

**Konsequenzen:** `COACH_LEARNING_TRACKER.md` aus Fin & Ari übernommen; Standards-Retro nach erstem
Sensing-Sprint fällig.

---

## D-003: Markt — Österreich zuerst

**Datum:** 2026-06-05 · **Status:** ✅ Aktiv · **Tags:** strategy, market

**Kontext:** Apotrend-Plattform ist AT-zentriert; Regulatorik (BASG, EKO, Suchtmittel) ist national;
WWS-Landschaft AT-spezifisch.

**Entscheidung:** **AT-first.** DE/EU als Phase 2 (ähnliche, aber andere Regulatorik + WWS-Anbieter).

**Konsequenzen:** Regulatory Intelligence kuratiert AT-Primärquellen; Compliance fokussiert AT-Recht
(+ EU-Rahmen DSGVO/AI Act).

---

## D-004: Auf jetzigem Apotrend als „Shell" aufbauen — aber mit eigener Datenschicht

**Datum:** 2026-06-05 · **Status:** ✅ Aktiv · **Tags:** architecture, platform, infrastructure

**Kontext:** Jetziger Apotrend = Demo-Hülle (Single-HTML 465 KB, 4 Vercel-Funktionen, „Auth"/2FA/
E-Mail nur localStorage-Simulation, **keine echte DB/Mandanten-Trennung**). Ein Assistent, der den
Bestand *einer konkreten Apotheke* kennt, braucht echte Auth, pro-Apotheke isolierte persistente
Daten, Vektor-Store (RAG), Secrets-Management, DSGVO-Kontrollen.

**Entscheidung:** Jetzigen Stand als **Shell** (Marketing/Demo + Einstiegs-UI) weiternutzen, aber den
Assistenten als **eigene Backend-/Datenschicht** bauen (nicht in die Single-HTML/localStorage zwängen).
Vercel-Serverless bleibt valider Ort für Agent-Orchestrierung; ergänzt um DB + Auth + Tenancy.

**Verworfen:** Assistent komplett in der HTML-Datei/localStorage → kein Mandanten-/Datenschutz-Modell,
nicht produktionsfähig für Gesundheits-/Geschäftsdaten.

**Konsequenzen:** Backend-Engineer-Charter (R6) priorisiert Datenschicht; Compliance prüft Datenresidenz.

---

## D-009: Anti-Scope — keine klinische Therapie-Empfehlung am Patienten

**Datum:** 2026-06-06 · **Status:** ✅ Aktiv · **Tags:** compliance, product, scope

**Kontext:** Ein KI-System, das individuelle Therapie/Diagnose/Dosierung am Patienten empfiehlt, droht
als **Medizinprodukt** (MDR) klassifiziert zu werden — plus erhöhte Beratungshaftung. (`COMPLIANCE.md` §3.)

**Entscheidung:** Der Assistent bleibt bewusst auf **Logistik / Beschaffung / Regulatorik-Hinweise /
Produktvergleich** begrenzt. Er gibt **niemals** klinische Therapie-Empfehlungen am Patienten. Mensch
(Apotheker) bleibt Entscheider; Empfehlungen sind quellenbelegt, keine automatische Ausführung.

**Konsequenzen:** Compliance- und Reviewer-Filter prüfen jedes Feature gegen diese Grenze; senkt
Medizinprodukt-/Haftungsrisiko und ist zugleich Verkaufsargument.

---

## Offene Decisions (TBD — nach Priorität)

> **Reihenfolge-Entscheidung (2026-06-06):** Erst **Ist-Bestell-Workflow** in der Pilot-Apotheke
> erheben (`research/D1_ops_bestell-workflow.md`), *dann* D-005 datengetrieben entscheiden.

- [ ] **D-005 (kritisch): Datenzugang-Strategie.** Sensing zeigt: AVS/APOVERLAG dominiert (600+),
      kein offenes API, aber **CSV/Excel-Export nativ**. *Vorschlag:* Start über Export-Ingestion
      (vendor-unabhängig), tiefe WWS-Integration als Phase-2-Partnerschaft. **Noch zu entscheiden.**
- [ ] **D-006: LLM-/Tech-Stack** (Bias-Disclosure P-002) — Modell markt-geprüft wählen; Datenresidenz
      AT/EU vs. US-API als harte Variable.
- [ ] **D-007: Geschäftsmodell** — wer zahlt (Inhaber), Preis-Modell, Verhältnis zu Apotrend-Abos.
- [ ] **D-008: Produktname** des Assistenten (Arbeitstitel „Apotrend AI Assistant").

✅ **Anti-Scope** → jetzt als **D-009** entschieden (keine klinische Therapie-Empfehlung).

---

## Decision-Index
| Kategorie | Decisions |
|---|---|
| Produkt / Strategie | D-001, D-003, D-007 |
| Coach-/Team-Architektur | D-002 |
| Plattform / Infrastruktur | D-004, D-006 |
| Daten / Integration | D-005 |
| Compliance / Scope | D-009 |
| Naming | D-008 |
