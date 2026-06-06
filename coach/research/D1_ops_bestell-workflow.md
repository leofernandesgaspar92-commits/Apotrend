# D1-Ops Sensing — Bestell-/Nachschub-Workflow AT-Apotheke

**Rolle:** Pharmacy Operations Researcher `<ops>` · **Datum:** 2026-06-06 · **Status:** Desk-Research + Erhebungsleitfaden
**Zweck:** Den realen Ist-Bestell-Workflow erfassen, **bevor** D-005 (Datenzugang) entschieden wird.
Pilot-Apotheke vorhanden → Erhebung + realer AVS-Export möglich.

---

## Teil A — Desk-Research: typischer AT-Ist-Workflow (Hypothesen zum Validieren)

1. **Großhandel, mehrmals täglich:** Apotheken bestellen beim pharmazeutischen Großhandel
   **mehrmals pro Tag** (oft ~3×, teils nachts), Lieferung in ~90 Min. Marktführer **Herba Chemosan
   (>40 %)**, dann Jacoby GM, Kwizda, Sanova/Pharmosan, Richter, Phoenix. Jede Apotheke bezieht
   meist von mehreren Großhändlern.
2. **Bestellung semi-automatisch über WWS** (z. B. AVS) oder telefonisch. Versand zunehmend über
   die `ePharmGH`-Schnittstelle direkt aus dem WWS.
3. **Automatischer Bestellvorschlag** im WWS: `Meldebestand = Ø-Tagesverbrauch × Wiederbeschaffungszeit
   + Sicherheitsbestand`. Unterschreitung → Nachbestellung. Mitarbeiter **prüfen/überstimmen** den Vorschlag.
4. **Sicherheits-/Mindestbestand** puffert Engpässe.
5. **Verifizierung beim Abgeben** via FMD/securPharm (in AT: **AMVS**).
6. **Direktbezug** vom Hersteller für Teile des Sortiments; **Defektur/Rezeptur** braucht Rohstoffe.

> Quellen: [Apothekerkammer – Großhandel](https://www.apothekerkammer.at/aktuelles/aktuelle-themen/grosshandel) ·
> [AMVS – Arzneimittel-Lieferkette](https://www.amvs-medicines.at/schutz-vor-gefaelschten-arzneimitteln/die-arzneimittel-lieferkette/) ·
> [IXOS – Automatischer Bestellvorschlag](https://ixos-onlinehilfe.pharmatechnik.de/Default/Content/PT5_Sortiment/Warenlogistik/03_Warenkorb/warenkorb_bestell_bestellvorschlag.htm) ·
> [apo-stb – Einkauf/Großhandel](https://www.apo-stb.de/steuerberater-apotheke-1/apotheke-grosshandel)

---

## Teil B — Die strategische Frage (= unsere Wedge)

Der WWS-Bestellvorschlag (Min/Max) **existiert bereits**. Ihn nachzubauen wäre wertlos. Unser
Mehrwert ist die **Intelligenz-Schicht darüber** — dort, wo Min/Max *blind* ist:

| WWS-Bestellvorschlag kann NICHT … | Unser Assistent soll … |
|---|---|
| kommenden **Engpass** antizipieren | BASG-Engpass-Signal *vor* dem Stockout in die Disposition spielen |
| **Rückruf/Charge** mit Bestand verknüpfen | „Charge Z zurückgerufen → liegt bei *dir* im Lager" |
| **Cross-Großhändler-Verfügbarkeit** zeigen | bei Nicht-Lieferbarkeit Alternative/anderen GH vorschlagen |
| **Substitution** (Wirkstoff/Aut-idem) intelligent | äquivalente Artikel + Preis/Erstattung vergleichen |
| Neuprodukte / Slow Mover / Verfall werten | Überbestand/Verfall/Ladenhüter sichtbar machen |

**Der Leitfaden muss messen, WO der heutige Vorschlag versagt und WO Mitarbeiter manuell Zeit verlieren.**

---

## Teil C — Erhebungsleitfaden Pilot-Apotheke (60–90 Min)

**Ziel:** Ist-Workflow erfassen · Wedge-Lücken finden · Artefakte sammeln (AVS-Export).
Wenn möglich: **Shadowing** eines echten Bestell-Laufs (Zeit stoppen, Klick-Pfade notieren).

### Block 1 — Kontext
- Welches WWS (AVS?), welche Version? Welche Großhändler, wie oft Lieferung/Tag?
- Wer bestellt (Rolle: Apotheker/PKA)? Wie groß das Sortiment (#Artikel)?

### Block 2 — Der normale Nachbestell-Lauf
- Wie entsteht eine Bestellung heute? Automatischer Bestellvorschlag — wie oft, wer prüft, wie lange?
- Sind Min-/Höchstbestände gepflegt? Wie oft wird der Vorschlag **überstimmt** — und **warum**?
- Welche Schritte sind „klick-lastig" / nerven am meisten?

### Block 3 — Schmerzpunkte (= Wedge, am wichtigsten)
- **Engpass:** Artikel nicht lieferbar — was passiert? Wie sucht man Alternative / anderen GH? Wie lange?
- **Rückruf/Charge:** Wie erfährt man davon? Wie prüft man den *eigenen* Bestand?
- **Substitution/Aut-idem:** Wie wird entschieden? Wird Preis/Erstattung verglichen?
- **Neuprodukte / Slow Mover / Überbestand / Verfall:** Wie heute gehandhabt?
- **Wo passieren Fehler / wo geht am meisten Zeit verloren?**

### Block 4 — Daten/Export (entscheidet D-005)
- Kann die Apotheke aus AVS einen Export ziehen? **Artikelstamm + Bestand + Abverkauf**?
- Format (CSV/Excel), Aktualität (live/täglich), welche Felder? Artikel-ID (PZN-Äquivalent AT)?
- → **Anonymisiertes Export-Muster mitnehmen** (echter Test-Datensatz für die Ingestion).

### Block 5 — Wert & Käufer (P-005)
- „Wenn ein Assistent *eine* Sache für dich täte — welche?"
- Wer entscheidet über den Kauf (Inhaber/Leiter)? Was wäre es ihm wert (ROI-Anker: gesparte Zeit /
  vermiedene Fehlbestände / Marge)?

### Mitzunehmende Artefakte
- [ ] Anonymisierter AVS-Export (Stamm + Bestand + Abverkauf)
- [ ] Screenshot der Bestellvorschlag-Maske
- [ ] Liste genutzter Großhändler(-Portale)

---

## Output dieser Erhebung
- Validierter Ist-Workflow + priorisierte Schmerzpunkte → schärft **D-001-Wedge** + Phase-1-Scope.
- Realer Export → entscheidet **D-005** (Datenzugang) datengetrieben.
- ROI-Anker → füttert **D-007** (Geschäftsmodell).
