# Anzeigen auf ApoPulse — Geschäftsmodell, Regeln, Einrichtung

> ⚠️ **Kein Rechtsrat.** Die Regeln unten sind eine konservative Produktsteuerung.
> Vor dem ersten Verkauf an Pharma-Unternehmen bitte von einer auf Heilmittelwerbe- und
> Medienrecht spezialisierten Kanzlei und für die Rechnungen von der Steuerberatung prüfen lassen.

## Wer zahlt wofür

Unternehmen der Branche — Pharma-Hersteller, Großhandel, Logistik, Apotheken(ketten) — buchen
Anzeigen, die Apotheken, Großhandel und Einkauf **im Moment der Versorgungsplanung** sehen.
Das ist der Wert, den keine Fachzeitschrift hat: Die Zielgruppe ist hier, wenn sie Engpässe
prüft und Bestellungen plant.

| Platz | Wo | Startpreis je Land und Woche |
|---|---|---|
| `start` | Startseite „Für dich", unter dem Überblick | 490 € |
| `feed` | News-Feed, nach dem 5. Beitrag | 290 € |
| `seite` | Rechte Spalte (große Bildschirme) | 190 € |

Die Preise sind **Startpreise des Betreibers**, keine Marktpreise. Ändern ohne Code:
`APOPULSE_WERBEPREISE="start:490,feed:290,seite:190"` (EUR je Land und Woche).

Gebucht wird nach **Land** und **Berufsgruppe** (Apotheke, Pharma, Großhandel, Logistik,
Behörde, Privat). Keine Auswahl nach Verhalten oder Gesundheitsdaten.

## Ablauf

1. **Firma und Rechnungsangaben** (einmalig) — nur Konten vom Typ Pharma, Großhandel, Logistik
   oder Apotheke.
2. **Anzeige anlegen**: Überschrift (≤70), Text (≤280), https-Link, optional Bild und Knopftext;
   Platz, Länder, Berufsgruppen, Start, Wochen. Der Preis steht sofort fest.
3. **Prüfung durch die Redaktion** (Moderation → „Anzeigen prüfen"): freigeben oder mit Grund
   ablehnen. **Erst prüfen, dann zahlen** — niemand zahlt für eine Anzeige, die nicht erscheinen darf.
4. **Zahlung**: Krypto (dieselbe Strecke wie Premium: Wallet, Transaktions-ID, Bestätigung in der
   Prüfliste) **oder Rechnung/Überweisung** (Redaktion verbucht den Eingang).
5. **Auslieferung** im gebuchten Zeitraum; Cockpit mit Einblendungen, Klicks, Klickrate, Tagen
   und Berufsgruppen. Pausieren jederzeit; die Redaktion hat eine **Notbremse**.

## Regeln im Code (`server/src/services/anzeigen.js`)

- **Kennzeichnung:** Jede Anzeige trägt „Anzeige" und die Firma. „Warum sehe ich das?" nennt,
  wer bezahlt hat und nach welchen Merkmalen ausgewählt wurde (vgl. Art. 26 DSA; Kennzeichnung
  kommerzieller Kommunikation, z. B. § 5a UWG / § 6 ECG).
- **Verschreibungspflichtige Arzneimittel:** Publikumswerbung ist unzulässig (DE § 10 HWG,
  AT § 51 AMG, EU-RL 2001/83/EG Art. 88). Solche Anzeigen gehen nur an **verifizierte
  Fachkreise** (`domain/jurisdiction.js`, Rx-Schranke wie bei der Börse). „Nicht sicher" zählt
  wie verschreibungspflichtig. Privatpersonen lassen sich dann gar nicht erst auswählen.
- **Pflichtangaben** (DE § 4 HWG, AT § 54 AMG): Arzneimittelwerbung ohne Pflichtangaben wird nicht
  angenommen; sie sind in der Anzeige aufklappbar. Ob sie inhaltlich stimmen, prüft die Redaktion.
- **Kein Umfeld mit Sicherheitsbezug:** keine Anzeigen auf Engpass-, Live-Warnungs- (Rückrufe,
  Sicherheitsmeldungen) und Wirkstoff-Seiten; im Feed nie direkt neben einer Engpass- oder
  Rückrufmeldung. Substitutionsaussagen gibt es hier nur mit Quelle, nie gekauft.
  (Darum ruhte der alte Bereich `werbung` — der Einwand ist hier eingebaut.)
- **Echte Zahlen:** Einblendungen werden beim Ausliefern gezählt (höchstens 3 je Person, Anzeige
  und Tag), Klicks nur mit signiertem Zeichen und einmal je Person/Anzeige/Tag. Die Mediadaten
  zeigen registrierte Konten je Land und Berufsgruppe — kleine Zahlen (1–9) nur als „unter 10".
- **Ausblenden und Melden:** Jede Person kann eine Anzeige ausblenden oder melden; Meldungen
  gehen an die Redaktion.
- Ziel-Links nur `https`, keine Zugangsdaten; Klicks laufen über `/api/anzeigen/:id/klick`
  (302, `Referrer-Policy: no-referrer`), Links tragen `rel="sponsored noopener noreferrer"`.

## Einrichtung (Render → Environment)

| Variable | Zweck |
|---|---|
| `APOPULSE_WERBEPREISE` | Preise je Platz, z. B. `start:490,feed:290,seite:190` |
| `APOPULSE_FIRMA_NAME` | Rechnungssteller (Pflicht für Zahlung per Rechnung) |
| `APOPULSE_FIRMA_ANSCHRIFT` | Anschrift des Rechnungsstellers (Pflicht) |
| `APOPULSE_FIRMA_UST_ID` | eigene USt-IdNr. (falls vorhanden) |
| `APOPULSE_BANK_IBAN` | IBAN für Überweisungen (Pflicht) |
| `APOPULSE_BANK_BIC`, `APOPULSE_BANK_INHABER` | optional |
| `APOPULSE_UST_SATZ` | Umsatzsteuer in Prozent (leer = keine Zeile). **Mit der Steuerberatung festlegen** — z. B. Reverse Charge bei Kunden im EU-Ausland. |

Ohne Firmenname, Anschrift und IBAN bietet die Seite **keine** Zahlung per Rechnung an — nur
Krypto. Rechnungsnummern: `AP-<Jahr>-<laufend>` — **eine gemeinsame Reihe mit den Tarif-Rechnungen**
(`docs/RECHNUNGEN.md`). Die Krypto-Zahlung einer Anzeige verlangt den **Bruttobetrag** (Preis + USt),
wie die Rechnung.

## Was noch fehlt (bewusst nicht gebaut)

- Automatischer Zahlungsabgleich für Überweisungen (heute verbucht die Redaktion manuell).
- Rechnungs-PDF per E-Mail (heute: druckbare Seite „Drucken / als PDF speichern"; E-Mail erst,
  wenn der Mail-Dienst eingerichtet ist).
- Anzeigen im Wochenbericht.
- Werbearchiv (Pflicht erst für sehr große Plattformen nach Art. 39 DSA).
