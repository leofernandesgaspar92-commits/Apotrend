// ============================================================================
//  Startklar-Check: Was muss der Betreiber noch einrichten?
// ============================================================================
//  Viele Funktionen hängen still an Einstellungen in Render: Ohne
//  Datenbank sind nach einem Deploy alle Konten weg, ohne Domain zeigen
//  Google-Seiten auf die Render-Adresse, ohne Betreiberangaben gibt es keine
//  Rechnung. Einzeln stand das in vielen Dokumenten — der Owner sah es nicht.
//
//  Eine reine Funktion: Sie bekommt nur, OB etwas gesetzt ist, nie den Wert.
//  Kein Geheimnis verlässt den Server (keine Schlüssel, keine IBAN).
// ============================================================================

import { createSms } from './sms.js';
import { parseFingerprints, istPaketname, ASSETLINKS_ENV } from '../http/assetlinks.js';

const ORDNUNG = { fehlt: 0, warnung: 1, info: 2, ok: 3 };
// Warum der SMS-Versand aus ist (createSms().grund) — in Worten statt als Kürzel.
const SMS_GRUND = {
  anbieter_unbekannt: 'APOPULSE_SMS_PROVIDER ist weder „africastalking" noch „twilio".',
  kein_benutzer: 'Anbieter gesetzt, aber APOPULSE_SMS_USERNAME fehlt.',
  kein_schluessel: 'Anbieter gesetzt, aber APOPULSE_SMS_API_KEY fehlt.',
  kein_absender: 'Twilio braucht eine Absendernummer: APOPULSE_SMS_FROM fehlt.',
};

export function startklar({ env = {}, dauerhaft = { level: 'flüchtig' }, quellen = { gesamt: 0, liefern: 0, fehler: 0 }, mail = { aktiv: false }, vapidFest = false, wallets = [], zahlwege = [] } = {}) {
  const gesetzt = (k) => String(env[k] || '').trim() !== '';
  const p = [];
  const punkt = (id, stufe, titel, warum, tun) => p.push({ id, stufe, titel, warum, tun: stufe === 'ok' ? null : tun });

  // Nur Datei (ohne Datenbank) ist auf dem kostenlosen Render-Tarif flüchtig:
  // Das nächste Deploy löscht sie. Darum auch dann „fehlt", nicht „empfohlen".
  punkt('daten', dauerhaft.level === 'sicher' ? 'ok' : 'fehlt',
    'Daten dauerhaft speichern',
    dauerhaft.level === 'unvollständig'
      ? 'Die Daten liegen nur in einer Datei. Auf Render überlebt sie das nächste Deploy nicht — dann sind alle Konten, Zahlungen, Rechnungen und Alarme weg.'
      : 'Ohne Datenbank sind nach dem nächsten Neustart alle Konten, Zahlungen, Rechnungen und Alarme weg.',
    'In Render eine PostgreSQL-Datenbank anlegen und deren „Internal Database URL" beim Web-Service als DATABASE_URL eintragen (docs/DATENBANK.md).');
  // Nur für Tests gedacht (services/shortages.js, ZAEHLT_AB_STUNDEN). Steht die
  // Variable im Betrieb, zählen frische Schein-Konten sofort für „bestätigt".
  // Der Wert ist eine Zahl, kein Geheimnis — er darf hier gelesen werden.
  if (gesetzt('APOPULSE_BESTAETIGUNG_AB_STUNDEN') && !(Number(env.APOPULSE_BESTAETIGUNG_AB_STUNDEN) >= 24)) {
    punkt('schutz', 'fehlt',
      'Schutz vor Schein-Konten ist abgeschaltet',
      'APOPULSE_BESTAETIGUNG_AB_STUNDEN ist gesetzt. Damit zählen frisch angelegte Konten sofort für „von 3 Apotheken bestätigt" — eine Person mit drei Konten könnte jede Meldung so erscheinen lassen.',
      'In Render beim Web-Service die Variable APOPULSE_BESTAETIGUNG_AB_STUNDEN löschen (sie ist nur für Tests gedacht) und neu deployen.');
  }
  punkt('anmeldung', gesetzt('APOPULSE_TOKEN_SECRET') ? 'ok' : 'fehlt',
    'Anmeldungen bleiben nach Neustart gültig',
    'Ohne festen Schlüssel werden bei jedem Neustart alle Nutzer:innen abgemeldet.',
    'APOPULSE_TOKEN_SECRET auf eine lange, zufällige Zeichenfolge setzen (nie weitergeben).');
  punkt('quellen', quellen.liefern > 0 && !quellen.fehler ? 'ok' : quellen.liefern > 0 ? 'warnung' : 'fehlt',
    'Behördenlisten kommen an',
    quellen.liefern > 0
      ? `${quellen.liefern} von ${quellen.gesamt} Engpass-Quellen liefern${quellen.fehler ? `, ${quellen.fehler} melden Fehler` : ''}. Davon leben Alarme, Radar, Daten-Schnittstelle und Google-Seiten.`
      : 'Noch keine Behördenliste ist angekommen. Ohne sie gibt es keine Alarme, kein Radar und keine öffentlichen Seiten.',
    'Redaktion → Datenquellen: „Jetzt abrufen" drücken und die Fehlermeldung je Quelle ansehen (docs/LIVE_DATA.md).');
  // Impressum (§ 5 ECG, § 25 MedienG) und Verantwortlicher in der Datenschutzerklärung (DSGVO, Play Store).
  punkt('impressum', gesetzt('APOPULSE_FIRMA_ANSCHRIFT') && gesetzt('APOPULSE_KONTAKT_EMAIL') ? 'ok' : 'fehlt',
    'Impressum vollständig',
    'Ohne Anschrift und E-Mail ist das Impressum unvollständig (in Österreich Pflicht) und die Datenschutzerklärung nennt keinen Verantwortlichen — beides prüft auch der Google Play Store. Als Gründer steht bereits Leo Fernandes Gaspar drin.',
    'In Render APOPULSE_FIRMA_ANSCHRIFT (z. B. „Musterstraße 1, 4020 Linz, Österreich") und APOPULSE_KONTAKT_EMAIL eintragen; optional APOPULSE_FIRMA_NAME (Firma, falls gegründet) und APOPULSE_FIRMA_UST_ID. Ansehen unter /impressum.');
  punkt('adresse', gesetzt('APOPULSE_PUBLIC_URL') ? 'ok' : 'warnung',
    'Eigene Domain eingetragen',
    'Google-Seiten, geteilte Links und E-Mails sollen auf die echte Domain zeigen, nicht auf die Render-Adresse.',
    'APOPULSE_PUBLIC_URL auf die Domain setzen, z. B. https://www.apopulse.com — danach die Sitemap in der Google Search Console einreichen.');
  punkt('mail', mail.aktiv ? 'ok' : 'warnung',
    'E-Mail-Versand',
    'Ohne E-Mail gibt es keinen Wochenbericht — ein Hauptgrund für Premium.',
    'APOPULSE_MAIL_PROVIDER, APOPULSE_MAIL_API_KEY und APOPULSE_MAIL_FROM setzen (server/DEPLOY.md).');
  punkt('push', vapidFest ? 'ok' : 'warnung',
    'Feste Schlüssel für den Handy-Alarm',
    'Ohne feste Schlüssel müssen alle den Sofort-Alarm neu einschalten, falls die gespeicherten Daten verloren gehen.',
    '„npm run vapid-schluessel" ausführen und APOPULSE_VAPID_PUBLIC_KEY / APOPULSE_VAPID_PRIVATE_KEY setzen.');
  const rechnung = gesetzt('APOPULSE_FIRMA_NAME') && gesetzt('APOPULSE_FIRMA_ANSCHRIFT');
  punkt('rechnung', rechnung ? 'ok' : 'warnung',
    'Rechnungen ausstellen',
    'Firmen (Business, Anzeigen) zahlen nicht ohne Rechnung — auch nicht mit Krypto.',
    'APOPULSE_FIRMA_NAME und APOPULSE_FIRMA_ANSCHRIFT setzen, optional APOPULSE_FIRMA_UST_ID (docs/RECHNUNGEN.md).');
  punkt('ueberweisung', gesetzt('APOPULSE_BANK_IBAN') && rechnung ? 'ok' : 'info',
    'Zahlung per Überweisung',
    'Viele Firmen zahlen nur per Rechnung und Überweisung.',
    rechnung ? 'APOPULSE_BANK_IBAN setzen (optional APOPULSE_BANK_BIC, APOPULSE_BANK_INHABER).' : 'Zuerst die Rechnungsangaben setzen, dann APOPULSE_BANK_IBAN.');
  if (rechnung) {
    punkt('ust', gesetzt('APOPULSE_UST_SATZ') ? 'ok' : 'warnung',
      'Umsatzsteuer festgelegt',
      gesetzt('APOPULSE_UST_SATZ') ? `Rechnungen weisen ${Number(env.APOPULSE_UST_SATZ) || 0} % Umsatzsteuer aus.` : 'Ohne Satz weisen Rechnungen keine Umsatzsteuer aus.',
      'Mit der Steuerberatung klären und APOPULSE_UST_SATZ setzen (z. B. 20 für Österreich, 19 für Deutschland).');
  }
  const tron = wallets.some((w) => w.id === 'tron');
  punkt('krypto', wallets.length && tron ? 'ok' : wallets.length ? 'warnung' : 'fehlt',
    'Krypto-Zahlung (Afrika-Strategie)',
    !wallets.length ? 'Keine Wallet hinterlegt — Krypto-Zahlung ist aus.'
      : tron ? `${wallets.length} Wallets aktiv, inklusive USDT über Tron.` : `${wallets.length} Wallets aktiv, aber kein USDT über Tron — in Afrika verbreitet, günstig und ohne Kursschwankung.`,
    'APOPULSE_WALLET_TRON auf die eigene Tron-Adresse (beginnt mit T) setzen — sie empfängt USDT (TRC-20).');
  punkt('karte', zahlwege.length ? 'ok' : 'info',
    'Karte / PayPal (optional)',
    'Für Apotheken in Europa der gewohnte Weg; Krypto bleibt daneben vollständig erhalten.',
    'Stripe (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) oder PayPal einrichten (docs/PAYMENTS.md).');

  // ── Anmeldung so einfach wie bei Facebook (Owner-Wunsch) ────────────────
  const sms = createSms({ env, fetchImpl: null });
  punkt('sms', sms.aktiv ? 'ok' : 'warnung',
    'Anmelden mit Handynummer (SMS-Code)',
    sms.aktiv ? `Aktiv über ${sms.anbieter === 'africastalking' ? "Africa's Talking" : 'Twilio'}.`
      : (SMS_GRUND[sms.grund] || 'In Afrika der gewohnte Weg — viele haben im Alltag keine E-Mail. Solange kein Anbieter eingerichtet ist, ist der Knopf ausgeblendet.'),
    "Africa's Talking (für Afrika günstiger) oder Twilio einrichten: APOPULSE_SMS_PROVIDER, APOPULSE_SMS_USERNAME, APOPULSE_SMS_API_KEY, bei Twilio APOPULSE_SMS_FROM. Jede SMS kostet; Obergrenze je Stunde mit APOPULSE_SMS_MAX_STUNDE (server/DEPLOY.md).");
  punkt('google', gesetzt('OAUTH_GOOGLE_CLIENT_ID') && gesetzt('OAUTH_GOOGLE_CLIENT_SECRET') ? 'ok' : 'warnung',
    '„Weiter mit Google"',
    'Ein Tipp statt Formular — der schnellste Weg zum Konto.',
    'In der Google Cloud Console einen OAuth-Client anlegen und OAUTH_GOOGLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_SECRET setzen (docs/SOCIAL_LOGIN.md).');
  punkt('facebook', gesetzt('OAUTH_FACEBOOK_APP_ID') && gesetzt('OAUTH_FACEBOOK_APP_SECRET') ? 'ok' : 'info',
    '„Weiter mit Facebook" (optional)',
    'In vielen afrikanischen Ländern verbreiteter als Google-Konten.',
    'Bei Meta for Developers eine App anlegen und OAUTH_FACEBOOK_APP_ID / OAUTH_FACEBOOK_APP_SECRET setzen (docs/SOCIAL_LOGIN.md).');
  // ── Android-App (android/README.md, Schritt 4) ─────────────────────────────
  //  Ein einziger Fingerabdruck ist der typische Fehler: Der Selbsttest klappt, die
  //  Store-Installation zeigt eine Adressleiste (Google signiert neu).
  const paketOk = istPaketname(env[ASSETLINKS_ENV.paket]);
  const fp = parseFingerprints(env[ASSETLINKS_ENV.fingerabdruecke]).length;
  punkt('android', paketOk && fp >= 2 ? 'ok' : paketOk && fp === 1 ? 'warnung' : 'info',
    'Android-App ohne Adressleiste',
    paketOk && fp === 1
      ? 'Nur EIN Fingerabdruck eingetragen. Aus dem Play Store installiert zeigt die App dann eine Browser-Adressleiste — Google signiert die App neu.'
      : 'Erst nötig, wenn die App in der Play Console angelegt ist.',
    'APOPULSE_ANDROID_PACKAGE = com.apopulse.app und APOPULSE_ANDROID_SHA256 mit ZWEI Fingerabdrücken (Googles App-Signaturschlüssel und der eigene Upload-Schlüssel), mit Komma getrennt (android/README.md, Schritt 4).');

  p.sort((a, b) => ORDNUNG[a.stufe] - ORDNUNG[b.stufe]);
  const zaehlt = p.filter((x) => x.stufe !== 'info');
  return { erledigt: zaehlt.filter((x) => x.stufe === 'ok').length, gesamt: zaehlt.length, punkte: p };
}
