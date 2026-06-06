# Datenquellen-Architektur — das Daten-Fundament des Assistenten

**Rollen:** Regulatory Intelligence `<regintel>` + Market Intelligence `<market>` · **Datum:** 2026-06-06
**Warum zentral:** Der Assistent ist nur so gut wie seine Daten. Diese Datei mappt *welche* Daten *woher*
kommen, was sie kosten und wie der Zugang läuft. Speist D-005, D-010, D-011.

---

## Die 4 Datenschichten

### 1. Produkt-/Preis-/Regulatorik-Stammdaten — **Warenverzeichnis** *(der Katalog)*
- **Quelle:** Österreichischer Apotheker-Verlag (APOVERLAG), Stammdaten gepflegt von **DATACARE**
  (Datenpflege des Pharmagroßhandels GmbH). Monatlich aktualisiert. Teile WV I (Arzneispezialitäten),
  WV II, WV III (Gesundheitsprodukte/Ergänzungssortiment).
- **Inhalt (sehr reichhaltig):** **Pharmazentralnummer (PZN)**, Vertriebsfirma, **Apotheken-Einkaufspreis
  (AEP) / Kassen- & Publikumsverkaufspreis**, Preisbänder, Lagerbedingungen, Verfalls-Kennzeichen,
  **Rezeptpflicht-Kennzeichen**, Packungsmengen, **Erstattungskodex (EKO)** inkl. Regel-/Indikationstexte,
  USt-Sätze, Liefercodes, **Zulassungsnummern**, Parallelimport-Zuordnungen, Produktverknüpfungen.
- **Zugang:** **kostenpflichtige Lizenz** (jedes WWS bezieht diese Daten). → unvermeidbares Backbone.
- **Bewertung:** Das mit Abstand wertvollste Dataset — Katalog + Preis + EKO + Rx in *einer* Quelle.

### 2. Eigen-Bestand / Abverkauf — **WWS (AVS)** *(was bei DIR liegt)*
- **Quelle:** die Warenwirtschaft der Apotheke (Marktführer AVS/APOVERLAG). Pro Apotheke.
- **Zugang:** **CSV/Excel-Export** nativ (→ D-005-Wedge); tiefe Integration später.

### 3. Großhändler-Echtzeit-Verfügbarkeit — **ePharmGH** *(ist es lieferbar?)*
- **Quelle/Standard:** **ePharmGH**, entwickelt von **DATACARE** im Auftrag der **ARGE Pharmazeutika**
  (Großhandels-Arbeitsgemeinschaft). Standard für Apotheke↔Großhandel über Internet.
- **Kann:** Bestelldaten senden + **Artikelanfrage (Verfügbarkeits-/Detailinfo)** + Defektmeldung.
  Apotheke wird 3–4×/Tag beliefert → Verfügbarkeit ist quasi-echtzeit relevant.
- **DE-Pendant:** **MSV3** (gleicher Zweck).
- **Zugang:** autorisierungspflichtig; läuft normalerweise *durch das WWS*.

### 4. Medizinprodukte — **EUDAMED** *(Medical Devices, EU)*
- **Quelle:** Europäische Datenbank für Medizinprodukte (UDI/Device-Registrierung). Ab **28.05.2026**
  mehrere Module verpflichtend.
- **Zugang:** öffentliches Portal (ec.europa.eu/tools/eudamed) + **inoffizielle Public-API** (Search/
  Device-Group/Device); offizielle M2M-APIs registrierungspflichtig.

---

## Join-Key
**Pharmazentralnummer (PZN)** verbindet alle Schichten (Bestand ↔ Stammdaten ↔ Verfügbarkeit). GS1 AT
mappt PZN↔GTIN. → Datenmodell baut auf PZN als Primärschlüssel.

## Keystone-Risiko (Reviewer)
**DATACARE** pflegt Warenverzeichnis **und** ePharmGH; **APOVERLAG** besitzt **AVS**. Der Cluster
APOVERLAG/DATACARE/ARGE kontrolliert Stammdaten + Bestell-Standard + WWS → fast das ganze Backbone.
Abhängigkeit ist real; Umgehung kaum möglich → als Lizenz-/Partner-Kosten einplanen, nicht bekämpfen.

## Empfehlung (Vorschlag, zu sparren)
1. **Warenverzeichnis lizenzieren** — unvermeidbares Rückgrat (Katalog+Preis+EKO+Rx). Konditionen klären. → **D-010**
2. **Verfügbarkeit:** auf die **bestehende ePharmGH-Anbindung der Apotheke** aufsetzen (über ihr WWS),
   statt eigene Großhandels-Integration zu bauen. → **D-011**
3. **Eigen-Bestand:** CSV-Export-Wedge. → **D-005** (nach Pilot-Erhebung)
4. **Medizinprodukte:** EUDAMED public API für den Start.

> Quellen: [warenverzeichnis.apoverlag.at](https://warenverzeichnis.apoverlag.at/) ·
> [DATACARE – Meldewesen](https://www.datacare.at/index.php?h=meldewesen&help=on) ·
> [ARGE Pharmazeutika / PZN](https://argepharma.fcio.at/) · [GS1 AT – PZN](https://www.gs1.at/newsroom/der-weg-zu-einer-pzn-oesterreich) ·
> [ePharmGH-Spezifikation (AVS)](https://docplayer.org/29247570-Epharmgh-datenaustausch-apotheke-pharmagrosshandel-ueber-internet-avs-version-1-6-6-0-12-2007.html) ·
> [EUDAMED (EU-Kommission)](https://health.ec.europa.eu/medical-devices-eudamed/overview_en) ·
> [EUDAMED API (inoffiziell)](https://openregulatory.github.io/eudamed-api/)
