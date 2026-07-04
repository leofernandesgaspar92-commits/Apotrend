# ApoTrend Terminal — Technische Architektur (System-Design)

**Version:** 0.1 (MVP-Blueprint)
**Stand:** Juli 2026
**Kontext:** Terminal-System für österreichische Apotheken

---

## 0. Leitprinzip: „Real oder ehrlich simuliert"

Jede Komponente ist einer von drei Reifegraden zugeordnet. Nichts wird als
„echt" ausgegeben, was es nicht ist (harte Vorgabe des Compliance-Teams).

| Reifegrad | Bedeutung |
|-----------|-----------|
| 🟢 **LIVE** | Echte, öffentliche Datenquelle bereits angebunden |
| 🟡 **MOCK** | Vollständiger Workflow, aber simulierte Daten (Zugang vertraglich/zertifizierungspflichtig) |
| 🔴 **BLOCKED** | Braucht Vertrag/Zertifizierung, bevor überhaupt Code sinnvoll ist |

---

## 1. Gesamtarchitektur (High-Level)

```
┌──────────────────────────────────────────────────────────────┐
│                    APOTHEKEN-TERMINAL (Tablet)                │
│  React/PWA · Offline-fähig · Touch-optimiert · Kiosk-Modus   │
│                                                              │
│  ┌────────────┬────────────┬────────────┬────────────────┐  │
│  │ e-Rezept   │ Störungs-  │ Engpass-   │ Service-       │  │
│  │ 🟡 MOCK    │ Dashboard  │ Check      │ Plattform      │  │
│  │            │ 🟡 MOCK    │ 🟢/🟡      │ 🟡 MOCK        │  │
│  └────────────┴────────────┴────────────┴────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / mTLS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   APOTREND BACKEND (Cloud, EU-Region)        │
│  Node.js · REST + WebSocket · OpenAPI-dokumentiert           │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ Auth/RBAC    │ │ Engpass-     │ │ Rezept-Orchestrator │   │
│  │ (OAuth2/OIDC)│ │ Aggregator   │ │ (State-Machine)     │   │
│  └──────────────┘ └──────┬───────┘ └─────────┬──────────┘   │
│                          │                    │              │
│  ┌───────────────────────┴────────────────────┴──────────┐  │
│  │           Adapter-Schicht (austauschbar)              │  │
│  │  BASG🟢 · Großhandel-EDI🔴 · SV-Peering🔴 · Apotronik🔴│  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┴──────────────────────────────┐  │
│  │  PostgreSQL (Transaktionen) · Redis (Cache/PubSub)   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Komponenten im Detail

### 2.1 Terminal-Frontend (React PWA)
- **Warum PWA statt native:** ein Codebase, läuft auf jedem Tablet, offline-fähig
  über Service Worker (kritisch für Notfall-Modus bei TI-Ausfall).
- **Kiosk-Modus:** Vollbild, kein Browser-Chrome, Auto-Reconnect.
- **State:** lokaler Cache (IndexedDB) + Server-Sync; bei Ausfall arbeitet das
  Terminal aus dem Cache weiter.
- **Design-System:** Weiß/Grün (bestehende ApoTrend-Identität), hohe
  Informationsdichte („Bloomberg-Terminal"-Stil), Touch-Ziele ≥ 48 px.

### 2.2 Backend (Node.js)
- **Runtime:** Node.js 20 LTS, TypeScript.
- **API:** REST (OpenAPI 3.1) + WebSocket für Live-Status (Störungs-Dashboard).
- **State-Machine:** Rezept-Status als expliziter endlicher Automat
  (`empfangen → in_bearbeitung → abgegeben → abgerechnet`), auditierbar.
- **Adapter-Muster:** Jede externe Quelle hinter einem Interface. Heute Mock,
  morgen echter EDI-Connector — ohne Änderung der Business-Logik.

### 2.3 Datenhaltung
- **PostgreSQL:** Rezept-Transaktionen, Audit-Log, Abrechnungsdaten.
  Row-Level-Security, Verschlüsselung at-rest.
- **Redis:** Cache für Engpass-Abfragen (TTL 15 min), Pub/Sub für Push-Events.
- **Datenresidenz:** ausschließlich EU-Region (DSGVO Art. 44 ff.). Kein
  Gesundheitsdatentransfer in Drittländer.

### 2.4 Sicherheit & Compliance
- **Transport:** TLS 1.3, zusätzlich mTLS für Terminal↔Backend.
- **Auth:** OAuth2/OIDC, rollenbasiert (Apotheker / PKA / Admin).
- **Gesundheitsdaten:** DSGVO Art. 9 (besondere Kategorien) → strikte
  Zweckbindung, Verschlüsselung, kurze Aufbewahrung, Löschkonzept.
- **Audit:** jede Rezept-Aktion unveränderlich protokolliert (wer/was/wann).
- **e-Card/ELGA:** NUR über zertifizierte SV-Peering-Anbindung — bis dahin 🟡 MOCK.

---

## 3. Reifegrad-Matrix der MVP-Funktionen

| # | Funktion | Reifegrad | Blocker / Voraussetzung |
|---|----------|-----------|--------------------------|
| 1 | e-Rezept-Abruf | 🔴→🟡 | SV-Peering-Zertifizierung + GINA-Client + PC/SC-Leser |
| 2 | Störungs-Dashboard | 🟡 | Offizielle TI-Status-API (SVC) — Zugang klären |
| 3 | Engpass-Check BASG | 🟢 | **Läuft bereits** |
| 3b| Engpass-Check Großhandel | 🔴→🟡 | EDI-Verträge mit je Großhändler |
| 4 | Impftermine/Telemedizin | 🟡 | Baubar; Abrechnung braucht Kassenvertrag |
| 5 | Apotronik-Sync | 🔴 | Partnerschaft mit Apotronik-Hersteller |

---

## 4. Was das Team JETZT ausliefert (ohne Verträge)

1. **Terminal-Dashboard-Prototyp** (`index.html`) — lauffähig, Touch-optimiert,
   zeigt e-Rezept-Workflow, Störungsampel, Engpass-Check, Notfall-Modus.
2. **e-Rezept-Modul-Skelett** (`backend/erezept.js`) — State-Machine + Adapter-
   Interface, Mock-Provider austauschbar gegen echten SV-Connector.
3. **OpenAPI-Spezifikation Großhandel** (`openapi-grosshandel.yaml`) — dient als
   technische Verhandlungsbasis mit den Großhändlern.

---

## 5. Empfohlene Roadmap (realistisch)

| Phase | Dauer | Fokus | Kosten-Schwerpunkt |
|-------|-------|-------|--------------------|
| **0 – Prototyp** | 1–2 Mon | Terminal-Demo für Pilot-Akquise | Entwicklung (gering) |
| **1 – Verträge** | 3–6 Mon | SV-Zertifizierung, Großhandel-EDI, Apotronik-Partnerschaft anbahnen | **BD + Recht (hoch)** |
| **2 – Echt-Integration** | 4–6 Mon | Mock-Adapter durch echte Connectoren ersetzen | Entwicklung + Audit |
| **3 – Pilot** | 2–3 Mon | 3–5 Apotheken Wien/Linz/Graz, Zeitmessung | Support + Iteration |
| **4 – Zertifizierung** | parallel | Apothekerkammer, Datenschutz-Gutachten | Recht + Zertifizierung |

**Kernbotschaft:** Der teuerste und langsamste Teil ist **nicht der Code**,
sondern der Zugang. Prototyp zuerst → damit Verträge gewinnen → dann echt bauen.
