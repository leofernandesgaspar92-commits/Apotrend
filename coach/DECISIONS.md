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

## D-012: Prototyp auf synthetischen Sample-Daten (schema-treu)

**Datum:** 2026-06-06 · **Status:** ✅ Aktiv · **Tags:** data, prototype, process

**Kontext:** Echte Daten liegen noch nicht vor (Pilot-Export, Warenverzeichnis-Lizenz, ePharmGH offen).
Der Prototyp-Bau soll dadurch nicht blockiert werden.

**Entscheidung:** Erst mit **synthetischen Sample-Daten** bauen (`assistant/data/sample/`), die
**schema-treu** zu den realen Quellen sind (Warenverzeichnis / AVS-Export / ePharmGH / BASG, Join-Key
**PZN**). Reale Daten später **ohne Code-Umbau** einschwenken — nur die Loader-Quelle tauschen.

**Konsequenzen:** D-005/D-010/D-011 sind damit **aufgeschoben** (nach Pilot-Erhebung / Lizenzklärung);
der Agent kann sofort gegen Sample-Daten gebaut + evaluiert werden. Sample-Set enthält
Demo-Szenarien (Engpass→Substitut, Rückruf→Eigenbestand, Nachbestellung, Überbestand).

---

## D-006: LLM-/Daten-Stack — EU-Residency als hartes Prinzip, Vendor beim Pilot

**Datum:** 2026-06-06 · **Status:** ✅ Aktiv (Prinzip; konkreter Vendor offen) · **Tags:** infrastructure, llm, compliance

**Kontext:** DSGVO + EU AI Act (volle Wirkung 02.08.2026) für ein Gesundheits-nahes Produkt. Markt-Recherche
(`research/llm-stack-eu.md`): EU-resident möglich via Mistral (EU-nativ), Claude@AWS-Bedrock-Frankfurt,
OpenAI-EU, Open-Weights self-host. **Direkte Anthropic-API = NICHT EU-resident** (Bias-Disclosure P-002).

**Entscheidung:**
1. **Hartes Prinzip: nur EU-resident** (Inferenz + Storage in EU, kein Zugriff von außen).
2. **Provider-agnostische LLM-Schicht** jetzt (`assistant/src/llm/`); Vendor-Wahl beim Pilot.
3. **DB:** Postgres + pgvector in EU-Region (Frankfurt), zunächst managed, hinter Repository-Seam.
4. **Hebel:** Fakten bleiben deterministisch; LLM *formuliert* nur → Modell-Stärke zweitrangig,
   Souveränität/Kosten dürfen gewinnen.

**Verworfen:** direkte US-API ohne EU-Residency; frühe Vendor-Bindung (hinter Seam unnötig).

**Konsequenzen:** `narrate.js` nutzt optionalen `LlmClient` (Default deterministisch); `EuProviderStub`
erzwingt die EU-Pflicht; Keys/Vendor erst bei echten Daten/Pilot.

---

## D-013: Plattform-Integration via entkoppeltem iframe-Tab

**Datum:** 2026-06-06 · **Status:** ✅ Aktiv · **Tags:** integration, platform, architecture

**Kontext:** `frontend/index.html` ist **Leos** Datei (aktiver Redesign). Tiefes Einweben des Assistenten
riskiert Merge-Konflikte und greift in sein Design-Revier.

**Entscheidung:** Integration **minimal-invasiv & entkoppelt** — neuer Tab „KI-Assistent" bindet das
eigenständige Surface (`assistant/web/index.html`) per `<iframe>` ein. Keine Logik in Leos Datei
dupliziert; nur Nav-Button (Desktop + Mobile) + `tabMap`-Eintrag + iframe-Panel.

**Verworfen:** Assistent-Logik direkt in die 10.840-Zeilen-Datei einweben (Konflikt-/Boundary-Risiko).

**Konsequenzen:** Von Leo leicht zu restylen/verschieben; native Integration nach seinem Redesign möglich.
*Deployment-Caveat:* relativer iframe-Pfad braucht die Repo-Struktur; GitHub-Pages-Setup separat klären
(Pages hat aktuell ohnehin kein Root-`index.html`).

---

## Offene Decisions (TBD — nach Priorität)

> **Reihenfolge-Entscheidung (2026-06-06):** Erst **Ist-Bestell-Workflow** in der Pilot-Apotheke
> erheben (`research/D1_ops_bestell-workflow.md`), *dann* D-005 datengetrieben entscheiden.
> **Daten-Decisions D-005/D-010/D-011 sind aufgeschoben** — Prototyp läuft zuerst auf Sample-Daten (D-012).

- [ ] **D-005 (kritisch): Eigen-Bestands-Zugang.** AVS dominiert (600+), kein offenes API, aber
      **CSV/Excel-Export nativ**. *Vorschlag:* Start über Export-Ingestion (vendor-unabhängig); WWS-
      Integration als Phase-2/3-Partnerschaft. Entscheidung **nach** Pilot-Apotheken-Erhebung.
- [ ] **D-010 (kritisch): Produkt-/Preis-/Regulatorik-Stammdaten.** Quelle = **Warenverzeichnis**
      (Apotheker-Verlag/DATACARE, monatlich, **kostenpflichtige Lizenz**) — PZN, AEP/KVP/PVP, **EKO**,
      Rezeptpflicht, Zulassungsnr. *Vorschlag:* lizenzieren (unvermeidbares Backbone). Konditionen klären.
- [ ] **D-011: Verfügbarkeits-Quelle Großhandel.** **ePharmGH** (DATACARE/ARGE; DE-Pendant MSV3) liefert
      Bestellung + **Verfügbarkeits-Abfrage**. *Vorschlag:* auf bestehende ePharmGH-Anbindung der Apotheke
      aufsetzen statt eigener GH-Integration. Medizinprodukte separat via **EUDAMED** (Public-API).
      Daten-Fundament: `research/datenquellen-architektur.md`.
✅ **D-006 entschieden** (siehe oben): EU-Residency-Prinzip + provider-agnostische LLM-Schicht;
Vendor beim Pilot; DB Postgres+pgvector EU.
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
| Daten / Integration | D-005, D-010, D-011, D-012 |
| Compliance / Scope | D-009 |
| Naming | D-008 |
