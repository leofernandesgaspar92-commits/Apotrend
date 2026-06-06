# Compliance & Risk Checkliste — Apotrend AI Assistant

**Wofür:** Pflicht-Checkliste vor jedem Release. Gesundheits-Domäne → Compliance ist **Frontlinie**,
nicht Anhang (und zugleich Verkaufsargument). Owner: Healthcare Compliance & Risk Officer (R7).
Markt: AT-first (D-003) im EU-Rahmen.

> ⚠️ Dies ist eine Arbeits-Checkliste, **keine Rechtsberatung.** Vor echtem Patienten-/Daten-Kontakt
> ist juristische Prüfung (AT-Pharmazie-/IT-Recht) einzuholen.

---

## 1. Datenschutz (DSGVO / DSG Österreich)
- [ ] Bestands-/Verkaufsdaten = Geschäftsdaten; sobald **Rx/Patientenbezug** → Gesundheitsdaten (Art. 9, Sonderkategorie).
- [ ] Rechtsgrundlage je Datenart geklärt (Vertrag/Einwilligung/berechtigtes Interesse).
- [ ] **Datenresidenz:** Wo liegen Daten + LLM-Inferenz? AT/EU vs. US-API (→ D-006). Auftragsverarbeitung + ggf. SCC.
- [ ] Mandanten-Trennung (pro Apotheke isoliert), Verschlüsselung at-rest/in-transit, Löschkonzept.
- [ ] AVV (Auftragsverarbeitungs-Vertrag) mit Apotheken + Subprozessoren (LLM-Anbieter, Hosting).

## 2. EU AI Act
- [ ] Risiko-Klassifizierung des Systems bestimmt (Bestell-Empfehlung = vermutlich begrenztes Risiko; **nicht** als klinisches Diagnose-/Therapie-System auslegen).
- [ ] Transparenzpflicht: Nutzer weiß, dass KI antwortet; Quelle + Konfidenz sichtbar.
- [ ] Human-in-the-loop: Empfehlung, **keine** automatische Ausführung ohne Bestätigung.

## 3. Medizinprodukt-Grenze (MDR)
- [ ] Test: Liefert der Assistent **klinische** Entscheidungen am Patienten (Diagnose/Therapie/Dosierung)?
      → Falls ja, droht **Medizinprodukt-Klassifizierung**. **Anti-Scope:** bewusst auf Logistik/
      Beschaffung/Regulatorik-Hinweise begrenzen, nicht auf individuelle Patienten-Therapie.

## 4. Beratungs-/Produkthaftung
- [ ] Aussagen zu Substituten/Rückrufen/Engpässen **nur grounded + zitiert**; keine erfundenen Fakten.
- [ ] Disclaimer + Human-Override; Entscheidung bleibt beim Apotheker.
- [ ] Agent-Eval misst Korrektheit (Halluzination = Patientenrisiko) — Gate vor Release.

## 5. Arzneimittel-/Suchtmittelrecht AT
- [ ] Regulatorik-Quellen kuratiert + datiert (BASG-Engpässe, AGES, EU-FMD/securPharm, Rückrufe, Erstattungskodex EKO).
- [ ] Suchtmittel: keine Empfehlungen/Workflows, die Suchtmittel-Vorschriften unterlaufen.
- [ ] AT ≠ DE: keine deutschen Regeln/Quellen als AT-Fakt ausgeben.

## 6. Datenintegrität / Sicherheit
- [ ] Secrets (LLM-API, DB) **nie** im Frontend/Single-HTML; serverseitig + Secret-Manager.
- [ ] Auth echt (nicht localStorage-Simulation, vgl. D-004); Audit-Log für Daten-/Empfehlungs-Aktionen.

---

## Pre-Release-Gate (Kurzform)
Release nur wenn: Datenschutz-Grundlage ✔ · Datenresidenz geklärt ✔ · AI-Act-Transparenz ✔ ·
Medizinprodukt-Grenze geprüft (Anti-Scope eingehalten) ✔ · Agent-Eval grün ✔ · Secrets/Auth sauber ✔.
