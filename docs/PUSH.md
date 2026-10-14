# Sofort-Alarm aufs Handy (Web-Push)

## Warum

Ein Engpass-Alarm, der erst beim nächsten Öffnen der App oder im Wochenbericht ankommt, ist
zu spät: Der Vorsprung liegt in den Stunden, bevor alle anderen nachbestellen. Mit Web-Push
meldet sich das Handy, sobald die Behörde einen beobachteten Wirkstoff als knapp meldet —
auch wenn ApoPulse geschlossen ist.

## Was als Push kommt

Nur Meldungen mit Quelle, die eine Entscheidung auslösen:

| Typ | Wann |
|---|---|
| `shortage_home` | Behörde meldet einen beobachteten Wirkstoff im eigenen Land neu als knapp |
| `shortage_ended` | wieder lieferbar (von der Engpassliste verschwunden) |
| `shortage_abroad` | Frühwarnung: im Ausland knapp, im eigenen Land noch nicht (Premium) |
| `watch_alert` | eine Apotheke meldet den Wirkstoff als knapp — **als „nicht amtlich" gekennzeichnet** |

Keine Likes, keine Kommentare, keine Werbung. Wer eine Kategorie in den
Benachrichtigungs-Einstellungen abschaltet, bekommt auch keinen Push dazu.

## Bedienung

- Startseite („Für dich"): Karte „Sofort-Alarm aufs Handy" — einschalten oder „Nicht jetzt".
- Meldungen: dieselbe Karte mit **Test senden** und **Ausschalten**.
- iPhone: nur als App vom Home-Bildschirm (iOS 16.4+); die Karte erklärt das statt eines
  Knopfs, der nicht funktionieren kann.

## Technik (`server/src/services/webPush.js`)

- Nur Node-Bordmittel: VAPID-Signatur (RFC 8292, ES256) und Verschlüsselung nach RFC 8291
  („aes128gcm"). Der Test prüft die Verschlüsselung **Byte für Byte gegen den Prüfvektor aus
  dem Standard**.
- Ziel-Adressen nur https und nur bekannte Push-Dienste (Google, Mozilla, Apple, Microsoft) —
  sonst könnte ein Konto den Server Anfragen an beliebige Adressen schicken lassen.
- Abo abgelaufen (404/410 vom Push-Dienst) → gelöscht. Höchstens 10 Geräte je Konto; dasselbe
  Gerät mit einem anderen Konto → das Abo wandert.
- Konto gelöscht → alle Abos weg.
- Betriebs-Cockpit: Anzahl Abos und gesendete Pushes.

## Einrichtung

Siehe `server/DEPLOY.md` → „Sofort-Alarm aufs Handy". Feste Schlüssel: `npm run vapid-schluessel`.
