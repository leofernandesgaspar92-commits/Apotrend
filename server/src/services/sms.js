// ============================================================================
//  SMS-Versand über einen HTTP-Dienst (anbieterneutral) — wie mailer.js
// ============================================================================
//  Für die Anmeldung per Telefonnummer (services/telefonLogin.js). Kein SDK,
//  ein POST an die Schnittstelle des Anbieters. Der Owner wählt per Umgebung:
//
//    APOPULSE_SMS_PROVIDER   africastalking | twilio
//    APOPULSE_SMS_USERNAME   Africa's Talking: App-Benutzername („sandbox" zum Testen)
//                            Twilio: Account SID (AC…)
//    APOPULSE_SMS_API_KEY    Africa's Talking: API Key · Twilio: Auth Token (Secret in Render)
//    APOPULSE_SMS_FROM       Absender (Sender-ID bzw. Twilio-Nummer). Bei Africa's
//                            Talking optional, bei Twilio Pflicht.
//    APOPULSE_SMS_URL        optional: andere Adresse der Schnittstelle (Proxy, Test)
//
//  Fehlt etwas, ist der Versand AUS — und sagt das (`grund`). Ohne Versand gibt
//  es keine Telefon-Anmeldung, also auch keine Kosten. Der Schlüssel erscheint
//  nie in Logs oder Antworten.
// ============================================================================

const ANBIETER = {
  africastalking: {
    url: (env) => env.APOPULSE_SMS_URL || (env.APOPULSE_SMS_USERNAME === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'),
    kopf: (z) => ({ apiKey: z.key, accept: 'application/json' }),
    koerper: (z, { an, text }) => {
      const f = { username: z.benutzer, to: an, message: text };
      if (z.von) f.from = z.von;
      return new URLSearchParams(f);
    },
    // 101 = „Sent", 102 = „Queued" (Africa's Talking Statuscodes je Empfänger)
    ok: async (res) => {
      if (!res.ok) return false;
      const d = await res.json().catch(() => null);
      const r = d && d.SMSMessageData && d.SMSMessageData.Recipients;
      return Array.isArray(r) && r.length > 0 && r.every((x) => x.statusCode === 101 || x.statusCode === 102);
    },
    pflicht: ['benutzer', 'key'],
  },
  twilio: {
    url: (env) => env.APOPULSE_SMS_URL || `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.APOPULSE_SMS_USERNAME || '')}/Messages.json`,
    kopf: (z) => ({ authorization: 'Basic ' + Buffer.from(`${z.benutzer}:${z.key}`).toString('base64'), accept: 'application/json' }),
    koerper: (z, { an, text }) => new URLSearchParams({ To: an, From: z.von, Body: text }),
    ok: async (res) => res.ok,
    pflicht: ['benutzer', 'key', 'von'],
  },
};

export function createSms({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const name = String(env.APOPULSE_SMS_PROVIDER || '').trim().toLowerCase();
  const a = ANBIETER[name];
  const z = {
    benutzer: String(env.APOPULSE_SMS_USERNAME || '').trim(),
    key: String(env.APOPULSE_SMS_API_KEY || '').trim(),
    von: String(env.APOPULSE_SMS_FROM || '').trim(),
  };
  const grund = !name ? 'kein_anbieter' : !a ? 'anbieter_unbekannt'
    : !z.benutzer ? 'kein_benutzer' : !z.key ? 'kein_schluessel'
    : (a.pflicht.includes('von') && !z.von) ? 'kein_absender' : null;
  return {
    aktiv: !grund,
    anbieter: a ? name : null,
    grund,
    async sende({ an, text }) {
      if (grund) throw Object.assign(new Error('SMS-Versand aus: ' + grund), { code: 'sms_aus' });
      if (!/^\+[1-9]\d{7,14}$/.test(String(an || ''))) throw Object.assign(new Error('ungültige Telefonnummer'), { code: 'tel_ungueltig' });
      const res = await fetchImpl(a.url(env), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...a.kopf(z) },
        body: a.koerper(z, { an, text }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!(await a.ok(res))) throw Object.assign(new Error(`${name}: Versand abgelehnt (HTTP ${res.status})`), { code: 'sms_fehler' });
      return true;
    },
  };
}
