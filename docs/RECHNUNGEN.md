# Rechnungen für Premium und Business

> ⚠️ **Kein Steuer- oder Rechtsrat.** Vor dem ersten Verkauf an Firmen die Rechnungsangaben,
> den Umsatzsteuersatz und Sonderfälle (Reverse Charge bei Firmenkunden im EU-Ausland,
> Kleinunternehmerregelung, Kunden außerhalb der EU) mit der Steuerberatung klären.

## Warum

Eine Apotheke oder ein Großhändler bucht keinen Tarif ohne Rechnung — auch nicht, wenn mit
Krypto gezahlt wurde. Viele Firmen zahlen außerdem **nur** per Rechnung und Überweisung.

## Zwei Wege

1. **Rechnung zu einer bezahlten Zahlung** (Krypto, Karte/PayPal): Auf der Premium-Seite unter
   „Ihre Rechnungen" → „Rechnung erstellen". Die Rechnung trägt „Bezahlt am … per Kryptowährung
   (BTC)" und wird nur einmal ausgestellt; danach immer dieselbe.
2. **Per Rechnung zahlen (Überweisung)**: Knopf auf der Premium-Seite. Die Rechnung kommt
   sofort (Zahlungsziel 14 Tage, IBAN, Verwendungszweck = Rechnungsnummer). Die Zahlung steht
   in der **Prüfliste der Redaktion** neben den Krypto-Zahlungen — „Zahlungseingang verbuchen"
   erst nach Blick auf den Kontoauszug; das schaltet den Tarif frei.

Die Rechnungsangaben (Firma, Anschrift, Land, USt-IdNr., Rechnungs-E-Mail) werden einmal
erfasst. **Ausgestellte Rechnungen ändern sich danach nicht mehr** (Empfänger und Beträge sind
festgeschrieben).

## Regeln im Code (`server/src/services/rechnungen.js`)

- **Eine Nummernreihe** für Anzeigen und Tarife: `AP-<Jahr>-<laufend>`
  (`services/rechnungsnummern.js`). Vorher hatten Anzeigen einen eigenen Zähler — zwei
  Rechnungen mit derselben Nummer wären möglich gewesen. Die Reihe wird mitgesichert und läuft
  nach einem Neustart weiter.
- **Tarifpreise sind Endpreise** (das, was gezahlt wird). Mit `APOPULSE_UST_SATZ` weist die
  Rechnung Nettobetrag und enthaltene Umsatzsteuer aus. Anzeigenpreise sind dagegen Nettopreise
  + USt; **seit 10/2026 verlangt auch die Krypto-Zahlung einer Anzeige den Bruttobetrag**
  (vorher nur netto — weniger als auf der Rechnung).
- Ohne Rechnungssteller (`APOPULSE_FIRMA_NAME` + `APOPULSE_FIRMA_ANSCHRIFT`) keine Rechnung;
  ohne `APOPULSE_BANK_IBAN` kein „Per Rechnung zahlen". Keine halben Rechnungen.
- Konto gelöscht: Rechnungsangaben werden gelöscht, **ausgestellte Rechnungen bleiben**
  (Aufbewahrungspflicht, DE § 147 AO / AT § 132 BAO).
- Eine offene Überweisungs-Rechnung je Tarif — zweimal klicken erzeugt keine zweite.

## Bewusst noch nicht gebaut

- **Stornorechnung**: Lehnt die Redaktion eine offene Überweisung ab, zeigt die Rechnung
  „Zurückgezogen". Eine formale Stornorechnung mit eigener Nummer fehlt noch — mit der
  Steuerberatung klären, ob nötig.
- Rechnung als E-Mail/PDF-Anhang (heute: druckbare Seite „Drucken / als PDF speichern").
- Automatischer Abgleich von Überweisungen mit dem Bankkonto.
