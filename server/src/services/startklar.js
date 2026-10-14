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

const ORDNUNG = { fehlt: 0, warnung: 1, info: 2, ok: 3 };

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

  p.sort((a, b) => ORDNUNG[a.stufe] - ORDNUNG[b.stufe]);
  const zaehlt = p.filter((x) => x.stufe !== 'info');
  return { erledigt: zaehlt.filter((x) => x.stufe === 'ok').length, gesamt: zaehlt.length, punkte: p };
}
