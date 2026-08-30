# ApoPulse — Projektdokumentation
**Version:** 2.4  
**Stand:** Juni 2026  
**Erstellt für:** Übergabe an Entwicklungspartner

---

## Was ist ApoPulse?

ApoPulse ist eine **Marktintelligenz-Plattform für Apotheken** — eine Web-App, die Apotheker mit Live-Daten zu Medikamentenengpässen, Pharma-Aktienpreisen, Rückrufen und News versorgt.

Die App läuft als **einzelne HTML-Datei** (frontend-index.html) und nutzt ein serverless Vercel-Backend für Live-Daten.

---

## Live-URLs

| Dienst | URL |
|--------|-----|
| **App (Frontend)** | https://leofernandesgaspar92-commits.github.io/ApoPulse/ |
| **Backend API** | https://apopulse-backend.vercel.app |
| **Stocks API** | https://apopulse-backend.vercel.app/api/stocks |
| **Recalls API** | https://apopulse-backend.vercel.app/api/recalls |
| **Engpass API** | https://apopulse-backend.vercel.app/api/engpass |
| **News API** | https://apopulse-backend.vercel.app/api/news |

---

## GitHub Repos

| Repo | Inhalt |
|------|--------|
| `leofernandesgaspar92-commits/ApoPulse` | Frontend (index.html) → GitHub Pages |
| `leofernandesgaspar92-commits/apopulse-backend` | Vercel-Backend (api/*.js) |

---

## Projektstruktur

```
frontend/
  index.html                 ← Gesamte App (HTML + CSS + JS in einer Datei, ~455KB)
backend/                     ← Vercel Serverless Functions
  api/
    stocks.js                ← Yahoo Finance Aktienkurse (Pfizer, Bayer, Roche, ...)
    recalls.js               ← FDA openFDA Rückrufe
    engpass.js               ← BASG AT-Engpässe (mit Live-Scraping + Fallback)
    news.js                  ← Drugs.com RSS + openFDA Fallback
  vercel.json                ← Vercel-Konfiguration (CORS, Timeouts)
  package.json               ← Node.js Abhängigkeiten
docs/
  PROJEKTDOKUMENTATION.md    ← dieses Dokument
ai-coach/                    ← KI-Coach-Dateien (Brand Bible, Rollen, Compliance, ...)
```

---

## App-Tabs & Funktionen

### 1. Dashboard
- Übersicht: Engpass-Zähler, Aktienpreise, letzte News
- Uhr, Datum, Auto-Refresh alle 5 Min

### 2. Engpass-Monitor
- Tabelle aller Medikamentenengpässe
- Filter: Österreich / Europa / Weltweit
- Status: kritisch / eingeschränkt / verfügbar
- Alternativen & Verfügbarkeitsdatum

### 3. Preis-Tracker
- Pharma-Aktienpreise (Pfizer, Novartis, Bayer, Roche, AstraZeneca, Sanofi, Merck, J&J)
- Suchfunktion
- Chart-Verlauf (letzte 12 Datenpunkte)
- **Daten: ECHT (Yahoo Finance via Vercel)**

### 4. News
- Kategorien: Alle / Rückrufe / Pharma
- Suchfunktion
- Klickbare Links zu Originalartikeln
- **Daten: ECHT (Drugs.com RSS + FDA openFDA)**

### 5. Admin-Bereich (nur für eingeloggte Pro-Nutzer)
- Engpass-Status manuell anpassen
- News hinzufügen/löschen
- KI-Agenten: Design, Daten, Prozess (Simulationen)
- Berichte exportieren (Excel, PDF)

---

## Abo-Modell (4 Stufen)

| Plan | Zugang |
|------|--------|
| `free_preview` | Alle Tabs lesen, kein Login nötig |
| `free_account` | Login, keine Premium-Features |
| `light` | Basis-Features freigeschaltet |
| `pro` | Vollzugriff inkl. Admin, Export, Agenten |

Implementiert via localStorage (Simulation — kein echter Zahlungsanbieter angebunden).

---

## Datenquellen: Echt vs. Simuliert

| Daten | Status | Quelle |
|-------|--------|--------|
| Aktienpreise | ✅ ECHT | Yahoo Finance v8 API |
| FDA-Rückrufe | ✅ ECHT | openFDA enforcement API |
| Pharma-News | ✅ ECHT | Drugs.com RSS-Feeds |
| AT Engpässe | ⚠️ Simulation | BASG-Fallbackliste (kein öffentliches API) |
| Preisserien (Charts) | ⚠️ Simulation | ±3% Drift auf Basis echter Preise |
| Rabatt-Scout | ⚠️ Beispieldaten | Kein öffentliches AT-Rabattregister |

---

## Deployment: So wird aktualisiert

### Frontend ändern:
1. `frontend/index.html` bearbeiten
2. Im GitHub-Repo `ApoPulse` als `index.html` hochladen
3. GitHub Actions baut automatisch → ~1 Min bis live

### Backend ändern:
1. Datei in `backend/api/` bearbeiten
2. Im GitHub-Repo `apopulse-backend` unter `api/` hochladen
3. Vercel deployt automatisch → ~1 Min bis live

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Reines HTML/CSS/JavaScript (kein Framework) |
| Charts | Chart.js 4.4.0 (CDN) |
| Excel-Export | SheetJS (CDN) |
| ZIP-Export | JSZip + FileSaver.js (CDN) |
| Backend | Node.js Serverless Functions auf Vercel |
| Hosting Frontend | GitHub Pages (kostenlos) |
| Hosting Backend | Vercel Hobby Plan (kostenlos) |
| Auth | localStorage-Simulation (kein echter Auth-Server) |
| 2FA | Simulation (Demo-Code: 123456) |
| E-Mail | Simulation (kein SMTP) |

---

## Wichtige Einschränkungen (nicht ändern!)

- **Alles bleibt in einer einzigen HTML-Datei** (keine Build-Pipeline, kein React/Vue)
- E-Mail-Funktionen sind Simulationen (kein echter SMTP)
- 2FA ist Simulation (Demo-Code immer: `123456`)
- API-Endpunkte sind JS-Funktionen, keine echten REST-Server

---

## Nächste Entwicklungsschritte (Empfehlungen)

1. **Echte AT-Engpass-Daten** — Partnerschaft mit BASG oder AGES anstreben
2. **Echter Zahlungsanbieter** — Stripe oder PayPal für Abo-Modell
3. **PWA / Mobile** — App installierbar machen (Service Worker)
4. **Apotheken-Login** — echte Registrierung mit E-Mail-Bestätigung
5. **Mehrsprachigkeit** — DE/EN vollständig trennen
6. **AT-Preisdaten** — Erstattungspreise aus dem österreichischen Erstattungskodex (EKO)

---

## Kontakt / Eigentümer

**GitHub:** leofernandesgaspar92-commits  
**E-Mail:** leofernandesgaspar92@gmail.com
