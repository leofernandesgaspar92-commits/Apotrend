# To-do für Leo (Owner) — geplant für Samstag, 14. November 2026

Alles, was nur Sie selbst erledigen können (Zugänge, Render-Einstellungen, rechtliche Entscheidungen).
Der Verbesserungs-Loop hält diese Liste aktuell. Stand: 11. November 2026.

> **Wichtig:** Schlüssel und Passwörter immer direkt in Render eintragen — nie in einen Chat.
> `APOPULSE_BESTAETIGUNG_AB_STUNDEN` in Render **nicht** setzen.

## In Render eintragen (Dashboard → Service → Environment)

1. [ ] **`DATABASE_URL`** — Pflicht. Ohne Datenbank gehen Daten bei einem Neustart verloren.
2. [ ] **`APOPULSE_WALLET_TRON`** — mit dem „Kopieren"-Knopf der Wallet-App übernehmen (nicht abtippen).
   Danach in der App (Redaktion → Startklar-Check) prüfen, dass „Krypto-Zahlung" **grün** ist.
3. [ ] **`APOPULSE_FIRMA_ANSCHRIFT`** und **`APOPULSE_KONTAKT_EMAIL`** — für Impressum, Rechnungen und Datenschutzerklärung.
4. [ ] **VAPID-Schlüssel** (empfohlen) — damit „Sofort-Alarm aufs Handy" nach einem Neustart weiter funktioniert.
5. [ ] Optional: **`AISSTREAM_API_KEY`** (Schiffe an Häfen) und **`APOPULSE_HANDEL_EMAIL`** (Proforma-Anfragen per E-Mail).
6. [ ] **Admin-Passwort prüfen:** mindestens 12 Zeichen (unter 8 Zeichen wird es nicht angenommen).
6b. [ ] **Schutz vor Passwort-Durchprobieren:** In der App (Redaktion → Startklar-Check) den Punkt
   „Schutz vor Passwort-Durchprobieren (IP-Erkennung)" ansehen. Ist er **gelb**, die dort genannte Einstellung
   (z. B. `APOPULSE_CLIENT_IP=cf-connecting-ip`) in Render eintragen, neu deployen, Check erneut öffnen → muss grün sein.

## Rechtliches (mit Anwält:in / Datenschutzberatung)

7. [ ] **Datenschutzerklärung prüfen lassen** (`/datenschutz.html`, 5 Sprachen, Deutsch maßgeblich).
   - Neu seit 11.11.: fünf Zeilen (Verifizierung, Logistik-Meldungen, Meldungen von Inhalten, Zahlungen inkl.
     öffentlicher Krypto-Transaktions-ID, Einladungen).
   - Offene Frage: Buchungszeile in Postgres nach einer Kontolöschung pseudonymisieren?
   - Platzhalter füllen: SMS-Anbieter, Zahlungsanbieter, E-Mail-Dienstleister.
   - Danach in Render: `APOPULSE_DATENSCHUTZ_GEPRUEFT=ja`.
8. [ ] **Rechtliche Rolle bei Proforma-Anfragen** klären (Vermittler? Weitergabe an Großhändler außerhalb der EU).
9. [ ] **Aufbewahrungsfrist** für erledigte Meldungen aus Fachkreisen festlegen (nicht dringend) — und in der
   Datenschutzerklärung nennen.

## In der App ausprobieren

10. [ ] Mit dem Redaktionskonto **„Sofort-Alarm aufs Handy"** einschalten, Test-Benachrichtigung senden, dann
    abmelden und prüfen, dass **nichts mehr ankommt**.

## Später

11. [ ] Sobald die App im Play Store ist: Texte aus `android/store-listing.md` in die Play Console übernehmen.

## Entscheidungen, die auf Sie warten (keine Eile)

- **Sitzungsdauer:** Seit 12.11. wird abgemeldet, wer ApoPulse **60 Tage** nicht benutzt hat (aktive Nutzung verlängert
  automatisch). Anders gewünscht? In Render `APOPULSE_SITZUNG_TAGE` setzen (z. B. 30 oder 90).

- Sollen neue **Fälschungswarnungen** zusätzlich als Handy-Benachrichtigung kommen? (Heute: Karte auf der
  Startseite. Die Erkennung ist eine Stichwortsuche — ein Fehlalarm ginge dann an alle.)
- Bevor **Direktnachrichten** oder **Social** je eingeschaltet werden: Stummschalten muss dann auch Nachrichten und
  Benachrichtigungen abhalten (steht im Verbesserungs-Protokoll).
