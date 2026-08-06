# Apotrend — Länder-Rechtsrisiko-Matrix (Feature-Gating)

> **⚠️ Kein Rechtsrat / Not legal advice.**
> Dies ist eine **automatisierte Compliance-Risiko-Einschätzung** zur konservativen
> Feature-Steuerung („Gating"), **kein** anwaltlicher Rechtsrat. Sie wurde ohne Mandat
> erstellt, kann Fehler enthalten, bildet keinen aktuellen Gesetzesstand rechtssicher ab
> und muss vor produktivem Einsatz von **qualifizierten Jurist:innen der jeweiligen
> Rechtsordnung** geprüft werden. Im Zweifel wurde die **konservativere** Bewertung
> (blockieren/beschränken) gewählt. Alle Gating-Entscheidungen sind **Betreiber-übersteuerbar**
> (operator-overridable) — dieses Dokument definiert nur einen sicheren Standard, keine
> zwingende Sperre. Stand der Recherche: August 2026.

---

## 0. Was die Features tatsächlich tun (Basis der Bewertung — aus dem Code gelesen)

Apotrend ist überwiegend eine **Informations- und B2B-Kontakt-Plattform**. Entscheidend
für die rechtliche Einordnung: **Auf der Plattform wird kein Arzneimittel verkauft,
abgegeben oder bezahlt.** Es geht um das **Anzeigen/Bewerben/Vermitteln**, nicht um
Handel/Abgabe.

| Feature | Was es real tut (Code) | Sensibel? |
|---|---|---|
| `shortage_radar` | Engpässe ansehen + Community-Meldung (nur Fachkreise, `requireProfessional`) + offizielle Behördeninfo; Status-Änderungen nur mit Quell-Link | gering |
| `price_compare` | Vergleich von **Referenz-Einkaufspreisen (AEP)** je Präparat über mehrere Lieferanten; reine Anzeige, kein Kauf (`prices.js`) | **ja** |
| `deals` | Liste laufender **Rabatt-/Aktionsangebote** auf Arzneimittel (potenziell auch Rx); reine Anzeige (`rabatte.js`) | **ja (höchstes Risiko)** |
| `stock_exchange` | Fachkreise posten **„Biete/Suche"**-Einträge; Kontakt via **Direktnachricht** (`social.startDm`); **kein Verkauf/Abgabe/Zahlung auf der Plattform**, Anlegen nur für Nicht-Privat-Accounts (`exchange.js`) | **ja** |
| `watchlist` | Private Wirkstoff-Merkliste | nein |
| `currency_converter` | Währungsrechner | nein |
| `regulator_source` | Link zur offiziellen Arzneimittelbehörde | nein (positiv) |
| `recall_tracking` | Rückruf-Feed — **aktuell deaktiviert/geplant** (`enabled:false`), erst mit echter Quelle | n/a bis Aktivierung |

**Wichtige Rest-Risiko-Nuance:** Private (Nicht-Fach-)Accounts dürfen `deals`, `price_compare`
und `stock_exchange` **lesen** (nur das Erstellen ist fachkreisbeschränkt). Damit ist die
Anzeige von **Rx-Rabatten/-Preisen** rechtlich potenziell „an die Öffentlichkeit" gerichtet —
das ist der Kern des Risikos bei `deals`/`price_compare`. **Wirksamste Minderung:** die
**Ansicht** dieser Module auf **verifizierte Fachkreise** beschränken und **Rx-Artikel
ausschließen/kennzeichnen**. Das würde viele „blockiert"-Bewertungen zu „beschränkt" absenken.

---

## 1. Zusammenfassende Matrix (Länder × sensible Features)

Legende: 🟢 zulässig · 🟡 beschränkt (mit Auflagen) · 🔴 blockiert/Hochrisiko. Benigne
Features (`watchlist`, `currency_converter`, `regulator_source`, `shortage_radar`) sind
in **allen 16 Ländern 🟢 zulässig** (siehe Länderabschnitte).

| Land | `deals` | `price_compare` | `stock_exchange` | Kurzgrund (Kern) |
|---|:---:|:---:|:---:|---|
| 🇦🇹 AT | 🟡 | 🟡 | 🟡 | §55b AMG Rabatt-in-kind-Verbot; Wettbewerbsrecht; begrenzter Apotheken-GH |
| 🇩🇪 DE | 🔴 | 🟡 | 🟡 | Rx-Preisbindung AMPreisV/§78 AMG + HWG-Publikumswerbeverbot |
| 🇨🇭 CH | 🟡 | 🟡 | 🟡 | Vorteilsverbot HMG/AWV; Publikums-Rx-Werbeverbot |
| 🇱🇮 LI | 🟡 | 🟡 | 🟡 | EWR + Zollunion CH; spiegelt CH/EU |
| 🇵🇹 PT | 🔴 | 🟡 | 🟡 | Art. 153(6) DL 176/2006: Rabattwerbung Rx/erstattet an Publikum verboten |
| 🇧🇷 BR | 🟡 | 🟡 | 🟡 | Rx-Publikumswerbeverbot; CMED-Preisregulierung; AFE-Vertrieb |
| 🇦🇴 AO | 🟡 | 🟢 | 🔴 | Sehr geringe Regulierungsreife; Diversions-/Fälschungsrisiko |
| 🇲🇿 MZ | 🟡 | 🟢 | 🔴 | Sehr geringe Regulierungsreife; Diversions-/Fälschungsrisiko |
| 🇬🇧 GB | 🟡 | 🟡 | 🟡 | HMR 2012 Rx-Publikumswerbeverbot; WDA(H) (s10(7)-Ausnahme aufgehoben) |
| 🇺🇸 US | 🟡 | 🟡 | 🔴 | Staatliche Großhandelslizenz + DSCSA; AKS bei erstatteten Rx |
| 🇳🇬 NG | 🟡 | 🟢 | 🟡 | NAFDAC-Werbefreigabe/POM; PCN-Vertriebslizenz; Fälschungsrisiko |
| 🇰🇪 KE | 🟡 | 🟢 | 🟡 | PPB-Werbeleitlinie (POM HCP-only); Großhandelslizenz |
| 🇬🇭 GH | 🟡 | 🟢 | 🟡 | FDA-Werbefreigabe; Pharmacy-Council-Großhandelslizenz |
| 🇨🇦 CA | 🟡 | 🟡 | 🟡 | Rx-Publikumswerbung nur Name/Preis/Menge; Establishment-/Provinzlizenz |
| 🇦🇺 AU | 🟡 | 🟡 | 🟡 | TG Act Rx-Publikumswerbeverbot; staatliche Großhandels-/Giftlizenz |
| 🇿🇦 ZA | 🟡 | 🟡 | 🟡 | Single Exit Price (SEP): keine Boni/Rabatte über SEP; SAHPRA-Lizenz |

**Blockiert (🔴) insgesamt:** `deals` in DE, PT · `stock_exchange` in US, AO, MZ.

---

## 2. Länder-Einzelanalyse (alle 16)

### 🇦🇹 Österreich (AT) — Regulator: BASG
- **deals — 🟡 beschränkt.** § 55b Arzneimittelgesetz (AMG) verbietet das Gewähren/Anbieten/Versprechen
  von **Naturalrabatten** an zur Verschreibung/Abgabe berechtigte Personen; Rx-Preise sind
  über den Apothekenaufschlag reguliert. Fremd-Rabattaktionen **anzeigen** ist nicht dasselbe
  wie sie gewähren, aber die öffentliche Anzeige von **Rx-Rabatten** ist heikel → Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** Kartellrechtlicher Vorbehalt: Aggregation von Wettbewerber-Einkaufspreisen
  kann als Informationsaustausch gewertet werden (Art. 101 AEUV / öst. KartG). Referenz-AEP, aggregiert/entkoppelt von Echtzeit → vertretbar.
- **stock_exchange — 🟡 beschränkt.** Großhandel bedarf einer Konzession/Gewerbeberechtigung (GDP);
  Apotheken dürfen einander nur begrenzt beliefern. **Kontaktvermittlung** (Biete/Suche + DM, kein
  Verkauf) unter verifizierten Fachkreisen ist vertretbar, aber lizenz-/GDP-Vorbehalt.
- Benigne Features 🟢. *Quellen:* AMG §55b; IBA/ICLG Austria 2025-26; oesterreich.gv.at.

### 🇩🇪 Deutschland (DE) — Regulator: BfArM
- **deals — 🔴 blockiert.** Für Rx gilt bundeseinheitliche **Preisbindung** (Arzneimittelpreisverordnung
  AMPreisV i.V.m. § 78 AMG); **Rabatte auf Rx sind unzulässig**, und das **Heilmittelwerbegesetz (HWG)**
  verbietet Publikumswerbung für Rx sowie enge Grenzen für Rabatte (§ 7 HWG). Öffentliches Anzeigen von
  Rx-Rabatten ist unmittelbar einschlägig verboten → blockieren (Downgrade auf 🟡 nur bei striktem
  Rx-Ausschluss **und** reiner Fachkreis-Ansicht).
- **price_compare — 🟡 beschränkt.** Kartellrechtlicher Informationsaustausch (GWB / Art. 101 AEUV):
  Wettbewerber-Preistransparenz erfordert Safeguards (nur Referenz-/Listen-AEP, keine
  zukunftsgerichteten Preise, Anonymisierung/Aggregation).
- **stock_exchange — 🟡 beschränkt.** Apotheken dürfen einander nur in begrenztem Umfang beliefern
  (§ 17 ApBetrO); darüber hinaus Großhandelserlaubnis (§ 52a AMG) + GDP nötig. Reine
  **Kontaktvermittlung** unter Fachkreisen ist zulässig, Handel selbst nicht ungefiltert.
- Benigne Features 🟢. *Quellen:* AMPreisV/§78 AMG; HWG (Stand 2023); ICLG Germany 2025-26; BGH-Rspr. zu Rx-Boni.

### 🇨🇭 Schweiz (CH) — Regulator: Swissmedic
- **deals — 🟡 beschränkt.** **Vorteilsverbot** (Art. 55 Heilmittelgesetz HMG) untersagt unzulässige
  geldwerte Vorteile im Zusammenhang mit Rx; **Publikumswerbung für Rx** ist verboten (HMG Art. 31 f.,
  Arzneimittel-Werbeverordnung AWV). Rx-Rabattanzeige an Publikum → Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** Kartellgesetz (KG): Preisinformationsaustausch unter Wettbewerbern;
  Referenzdaten mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** Abgabe von Rx nur durch berechtigte Stellen; Großhandel bewilligungspflichtig
  (kantonal/Swissmedic) + GDP. Kontaktvermittlung unter Fachkreisen vertretbar, Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* HMG Art. 31-32, 55; AWV; CMS/Bär&Karrer/Chambers CH 2026.

### 🇱🇮 Liechtenstein (LI) — Regulator: Amt für Gesundheit
- **deals — 🟡 beschränkt.** LI ist **EWR**-Mitglied (EU-Arzneimittel-Werberecht, Richtlinie 2001/83/EG,
  Rx-Publikumswerbeverbot) **und** über die **Zollunion** eng an die Schweiz gebunden — beide Regime
  verbieten Publikums-Rx-Werbung/-Rabatte. Konservativ wie CH/EU.
- **price_compare — 🟡 beschränkt.** EWR-Wettbewerbsrecht (Art. 53 EWR-Abk.) analog Art. 101 AEUV.
- **stock_exchange — 🟡 beschränkt.** Großhandel/GDP lizenzpflichtig; kleiner Markt, enge Anlehnung an CH-Recht.
- Benigne Features 🟢. *Quellen:* EWR-Abkommen; RL 2001/83/EG; CH-Anlehnung (regulator_url derzeit nicht belegt).

### 🇵🇹 Portugal (PT) — Regulator: INFARMED
- **deals — 🔴 blockiert.** **Art. 153(6) Decreto-Lei 176/2006** verbietet ausdrücklich die **Bewerbung
  von Rabatten gegenüber der Öffentlichkeit** bei **verschreibungspflichtigen**, betäubungsmittelhaltigen
  und **staatlich erstatteten** Arzneimitteln. Direkt einschlägig → blockieren (Downgrade 🟡 nur bei
  Rx/erstattet-Ausschluss **und** reiner Fachkreis-Ansicht; Werbematerial ist zudem GPUB-meldepflichtig).
- **price_compare — 🟡 beschränkt.** Wettbewerbsrecht (AdC / Art. 101 AEUV); Referenz-AEP mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** Großhandelsvertrieb erlaubnispflichtig (GDP, DL 176/2006);
  Kontaktvermittlung unter Fachkreisen vertretbar, Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* DL 176/2006 Art. 153(6); INFARMED GPUB; CMS/Chambers PT 2025-26.

### 🇧🇷 Brasilien (BR) — Regulator: ANVISA
- **deals — 🟡 beschränkt.** Rx-Werbung ist auf Fachmedien (Ärzt:innen/Zahnärzt:innen/Apotheker:innen)
  beschränkt — **Publikumswerbung für Rx verboten** (ANVISA RDC 96/2008). Preise werden durch **CMED**
  reguliert (Preisobergrenzen). Rabattanzeige nur als Referenz, Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** Wettbewerbsrecht (CADE/Lei 12.529) + CMED-Preisrahmen; Referenzdaten mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** Vertrieb/Lagerung bedarf **AFE** (Autorização de Funcionamento, RDC 16/2014)
  + Landes-/Kommunallizenz + technischer Verantwortung. Kontaktvermittlung unter verifizierten Fachkreisen
  vertretbar; Diversions-/Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* ANVISA RDC 96/2008, RDC 16/2014; CMED; Lexology/CMS Brazil.

### 🇦🇴 Angola (AO) — Regulator: ARMED
- **deals — 🟡 beschränkt.** ARMED reguliert Registrierung/Werbung; Rx-Werbekontrollen bestehen, die
  Durchsetzung/Reife ist jedoch gering. Konservativ: nur Referenz, Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟢 zulässig.** Kein durchsetzungsstarkes Kartellregime für Preisinformationsaustausch
  erkennbar; dominantes Risiko liegt auf der Handelsseite (siehe stock_exchange). Referenzdaten unkritisch.
- **stock_exchange — 🔴 blockiert.** **Sehr geringe Regulierungsreife** (Ziel Level 3 erst bis 2027);
  Vertrieb/Distributor-Lizenzierung per **Presidential Decree 202/21**; hohes **Diversions-/Fälschungsrisiko**.
  Das Vermitteln von Arzneimittel-Handel ohne belastbare lokale Lizenz-/Verifikationsinfrastruktur ist hier
  klar problematisch → blockieren, bis eine verlässliche Fachkreis-Verifizierung existiert. *(Unsicherheit →
  konservativ.)*
- Benigne Features 🟢. *Quellen:* WHO Afro Angola; Presidential Decree 202/21; trade.gov Angola.

### 🇲🇿 Moçambique (MZ) — Regulator: ANARME
- **deals — 🟡 beschränkt.** Werbekontrollen bestehen, Durchsetzung/Reife gering. Konservativ: Referenz,
  Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟢 zulässig.** Kein durchsetzungsstarkes Preis-Kartellregime erkennbar; Referenzdaten unkritisch.
- **stock_exchange — 🔴 blockiert.** Analog AO: **geringe Regulierungsreife**, ausgeprägtes Diversions-/
  Fälschungsrisiko; Vermittlung von Arzneimittel-Handel ohne belastbare lokale Lizenz-/Verifikation klar
  problematisch → blockieren, bis Fachkreis-Verifizierung existiert. *(Unsicherheit → konservativ.)*
- Benigne Features 🟢. *Quellen:* ANARME (Regulator); AU-Modellgesetz/WHO-Reifegrad-Literatur.

### 🇬🇧 Vereinigtes Königreich (GB) — Regulator: MHRA
- **deals — 🟡 beschränkt.** **Human Medicines Regulations 2012** (Reg. 7, Teil 14): Werbung für
  **prescription-only medicines (POM)** an die Öffentlichkeit ist **verboten**; nur HCP-gerichtete
  Kanäle zulässig. Rx-Rabattanzeige an Publikum → Rx ausschließen/fachkreis-gaten (OTC-Preislisten ok).
- **price_compare — 🟡 beschränkt.** Wettbewerbsrecht (CMA / Competition Act 1998, Chapter I):
  Wettbewerber-Preisinformationsaustausch; Referenz-AEP mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** HMR 2012 verlangt eine **WDA(H)** für Großhandel; die frühere
  Apotheken-Ausnahme (s. 10(7) Medicines Act 1968) wurde **aufgehoben** — Apotheke-zu-Apotheke-Großhandel
  ist grundsätzlich erlaubnispflichtig (begrenzte „occasional supply"-Ausnahme). **Kontaktvermittlung**
  ist keine Distribution durch die Plattform, aber starker Lizenz-Hinweis nötig.
- Benigne Features 🟢. *Quellen:* HMR 2012 (SI 2012/1916) Reg. 7 & Part 14; GOV.UK WDA(H)-Leitfaden; ASA/CAP.

### 🇺🇸 Vereinigte Staaten (US) — Regulator: FDA
- **deals — 🟡 beschränkt.** Bei bundeserstatteten Rx greift der **Anti-Kickback Statute (AKS, 42 U.S.C.
  §1320a-7b)** samt Safe-Harbor-Regeln (Rabatt-Safe-Harbor für PBM/Part-D 2020 verändert); Rx-Rabatt-/
  Coupon-Werbung ist bundesstaatlich unterschiedlich reguliert. Referenz, Rx-Vorsicht, fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** **Sherman Act §1**: Austausch aktueller/künftiger Preisinformationen
  unter Wettbewerbern ist ein klassisches Kartellrisiko (price signaling); Referenz-/Listenpreise,
  aggregiert, historisch, mit Safeguards.
- **stock_exchange — 🔴 blockiert.** Großhandelsvertrieb ist **einzelstaatlich lizenzpflichtig** (State
  Boards of Pharmacy, Wholesale Distributor Licensing) und unterliegt dem **DSCSA** (Track-&-Trace/
  Pedigree, 21 U.S.C. §360eee). Das Vermitteln von Apotheke-zu-Apotheke-Weiterverkauf ohne Lizenz/
  Pedigree ist hochriskant → blockieren.
- Benigne Features 🟢. *Quellen:* 42 U.S.C. §1320a-7b; OIG-Safe-Harbor-Regeln 2020; DSCSA; Sherman Act §1.

### 🇳🇬 Nigeria (NG) — Regulator: NAFDAC
- **deals — 🟡 beschränkt.** NAFDAC muss Arzneimittelwerbung **vorab freigeben**; POM-Werbung an die
  Öffentlichkeit ist beschränkt. Konservativ: Referenz, Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟢 zulässig.** Kein durchsetzungsstarkes Preis-Kartellregime für Referenzdaten erkennbar; unkritisch.
- **stock_exchange — 🟡 beschränkt.** **PCN-Vertriebslizenzierung** (Pharmacists Council of Nigeria) +
  NAFDAC-Null-Toleranz gegen Fälschungen. Angesichts bekannter Diversions-/Fälschungskanäle **nur** für
  **verifizierte** Apotheken/Fachkreise freigeben; ohne belastbare Verifizierung blockieren.
- Benigne Features 🟢. *Quellen:* NAFDAC Act/Compliance; PCN Distribution Guidelines; NAFDAC-Fälschungs-Enforcement.

### 🇰🇪 Kenia (KE) — Regulator: PPB
- **deals — 🟡 beschränkt.** PPB-**Werberichtlinie** (Guideline for Advertisement and Promotion of Health
  Products and Technologies) + Pharmacy and Poisons Act (Cap 244): **POM** nur hinter „for healthcare
  professionals only"-Bereichen, ohne Promotion. Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟢 zulässig.** Kein durchsetzungsstarkes Preis-Kartellregime für Referenzdaten erkennbar; unkritisch.
- **stock_exchange — 🟡 beschränkt.** **Wholesale-Dealer-Lizenz** (PPB) erforderlich; Diversionsrisiko.
  Nur verifizierte Fachkreise; Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* Pharmacy and Poisons Act Cap 244; PPB Advertisement Guideline (2024); Bowmans/Gala Law.

### 🇬🇭 Ghana (GH) — Regulator: FDA Ghana
- **deals — 🟡 beschränkt.** FDA Ghana gibt Arzneimittelwerbung **frei** (Public Health Act 2012, Act 851;
  vormals PNDCL 305B); POM-Publikumswerbung beschränkt. Rx ausschließen/fachkreis-gaten.
- **price_compare — 🟢 zulässig.** Kein durchsetzungsstarkes Preis-Kartellregime für Referenzdaten erkennbar; unkritisch.
- **stock_exchange — 🟡 beschränkt.** **Pharmacy Council** vergibt Wholesale-/Retail-Lizenzen; Vertrieb
  lizenzpflichtig. Nur verifizierte Fachkreise; Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* Public Health Act 2012 (Act 851); Pharmacy Council Ghana Guidelines; FDA Ghana.

### 🇨🇦 Kanada (CA) — Regulator: Health Canada
- **deals — 🟡 beschränkt.** Food and Drugs Act / Food and Drug Regulations: Publikumswerbung für
  verschreibungspflichtige Arzneimittel (Prescription Drug List, vormals Schedule F) ist auf **Name,
  Preis und Menge** begrenzt — **darüber hinausgehende Rabatt-/Aktionswerbung** ist unzulässig. Preis-
  angabe selbst ist erlaubt; Rabatt-„Promotion" ausschließen/fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** Competition Act (Informationsaustausch unter Wettbewerbern);
  Preisangabe an sich zulässig, Aggregation mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** Bundes-**Drug Establishment Licence** + **provinzielle** Großhandels-/
  Apothekenregeln. Kontaktvermittlung unter verifizierten Fachkreisen vertretbar; Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* Food and Drugs Act (RSC 1985, c. F-27); C.01.044 FDR; Prescription Drug List; Competition Act.

### 🇦🇺 Australien (AU) — Regulator: TGA
- **deals — 🟡 beschränkt.** **Therapeutic Goods Act 1989**: Werbung für **Rx (Schedule 4)** und teils
  Schedule-3-Arzneimittel an die Öffentlichkeit ist **verboten** (breite „advertising"-Definition; zivile
  Strafen bis 16,5 Mio. AUD/Verstoß). Preislisten sind eng zulässig; Rx-Rabattpromotion ausschließen/fachkreis-gaten.
- **price_compare — 🟡 beschränkt.** Competition and Consumer Act 2010 (ACCC); Referenzpreise mit Safeguards.
- **stock_exchange — 🟡 beschränkt.** **Staatliche** Großhandelslizenzierung + Poisons Standard (SUSMP).
  Kontaktvermittlung unter verifizierten Fachkreisen vertretbar; Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* Therapeutic Goods Act 1989; TGA Advertising Guidance; CCA 2010; Poisons Standard.

### 🇿🇦 Südafrika (ZA) — Regulator: SAHPRA
- **deals — 🟡 beschränkt.** **Single Exit Price (SEP)** nach Medicines and Related Substances Act 101/1965:
  Hersteller/Großhandel/Vertrieb dürfen **nur den SEP** verlangen — **keine Boni/Rabatte darüber hinaus**
  (Bonus-/Rabatt-Regeln teils noch nicht final). Rx-Rabattanzeige ist damit rechtlich heikel/irreführend →
  Rx ausschließen/fachkreis-gaten. (Preise/Namen/Packungen für Rx dürfen an die Öffentlichkeit, ohne
  Indikationsbezug.)
- **price_compare — 🟡 beschränkt.** Competition Act 89/1998; da SEP fixiert/öffentlich ist, ist der
  kartellrechtliche Mehrwert gering, aber Informationsaustausch-Vorbehalt bleibt.
- **stock_exchange — 🟡 beschränkt.** Vertrieb bedarf **SAHPRA-Lizenz** (Wholesaler/Distributor).
  Kontaktvermittlung unter verifizierten Fachkreisen vertretbar; Lizenzvorbehalt.
- Benigne Features 🟢. *Quellen:* Medicines and Related Substances Act 101/1965 (SEP-Regelungen); SAHPRA-Lizenzierung; CMS South Africa.

---

## 3. Benigne Features — kurze Bestätigung (alle Länder 🟢)

- **`shortage_radar`** — Informativ/sicherheitsorientiert; Community-Meldungen sind fachkreisbeschränkt
  (`requireProfessional`) und als „Community" gekennzeichnet, redaktionelle Status-Änderungen nur mit
  Quell-Link. Kein Werbe-/Handels-/Preischarakter → in allen 16 Ländern zulässig.
- **`watchlist`** — Private Merkliste, keine Veröffentlichung, kein Preis-/Handelsbezug → zulässig.
- **`currency_converter`** — Reines Rechenwerkzeug → zulässig.
- **`regulator_source`** — Verlinkt nur die offizielle Behörde (nur mit verifizierter URL aktiv) →
  zulässig, sogar compliance-fördernd.
- **`recall_tracking`** — Derzeit `enabled:false`/geplant; bei Aktivierung nur mit belegter amtlicher
  Quelle betreiben (sicherheitskritisch) → bis dahin nicht anwendbar.

---

## 4. Wichtigste Minderungsmaßnahmen (senken Risiko / ermöglichen „beschränkt" statt „blockiert")

1. **Ansicht der sensiblen Module (`deals`, `price_compare`) auf verifizierte Fachkreise beschränken**
   (nicht nur das Erstellen) — entschärft das „Werbung an die Öffentlichkeit"-Problem.
2. **Rx-Artikel in `deals`/`price_compare` ausschließen oder klar kennzeichnen** und Rabatte auf Rx
   unterdrücken, wo Rx-Rabatt-/Publikumswerbung verboten ist (DE, PT, CH, AT, GB, AU, BR, ZA …).
3. **`price_compare` kartellrechtssicher gestalten:** nur Referenz-/Listen-AEP, historisch/aggregiert,
   keine zukunftsgerichteten Preise, keine Zuordnung zu identifizierbaren Wettbewerbern in Echtzeit.
4. **`stock_exchange`:** nur **verifizierte** (lizenzierte) Fachkreise; klarer Hinweis „reine
   Kontaktvermittlung, kein Verkauf/keine Abgabe auf der Plattform; Großhandels-/GDP-Pflichten liegen
   bei den Handelnden". In Märkten ohne belastbare Verifizierung (AO, MZ) bzw. mit strikter Lizenzierung
   (US) blockiert lassen.
5. **Betreiber-Übersteuerung dokumentieren:** Jede Sperre ist überschreibbar; die Entscheidung samt
   Rechtsgrundlage sollte protokolliert und anwaltlich gegengeprüft werden.
