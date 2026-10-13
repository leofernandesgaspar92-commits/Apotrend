// ============================================================================
//  E-Mail-Versand über einen HTTP-Dienst (anbieterneutral)
// ============================================================================
//  Kein SMTP, keine Bibliothek: ein POST an die Schnittstelle des gewählten
//  Anbieters, wie bei der KI (aiExtract.js). Der Owner wählt per Umgebung:
//
//    APOPULSE_MAIL_PROVIDER   resend | postmark
//    APOPULSE_MAIL_API_KEY    Schlüssel des Anbieters (Secret in Render)
//    APOPULSE_MAIL_FROM       Absender, z. B. „ApoPulse <bericht@apopulse.com>"
//                             (Domain muss beim Anbieter bestätigt sein)
//
//  Fehlt etwas davon, ist der Versand AUS — und sagt das (`grund`), statt
//  still nichts zu tun. Der Schlüssel erscheint nie in Logs oder Antworten.
// ============================================================================

const ANBIETER = {
  resend: {
    url: 'https://api.resend.com/emails',
    kopf: (key) => ({ authorization: 'Bearer ' + key }),
    koerper: ({ von, an, betreff, text, html }) => ({ from: von, to: [an], subject: betreff, text, html }),
  },
  postmark: {
    url: 'https://api.postmarkapp.com/email',
    kopf: (key) => ({ 'x-postmark-server-token': key, accept: 'application/json' }),
    koerper: ({ von, an, betreff, text, html }) => ({ From: von, To: an, Subject: betreff, TextBody: text, HtmlBody: html, MessageStream: 'outbound' }),
  },
};

export function createMailer({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const name = String(env.APOPULSE_MAIL_PROVIDER || '').trim().toLowerCase();
  const key = String(env.APOPULSE_MAIL_API_KEY || '').trim();
  const von = String(env.APOPULSE_MAIL_FROM || '').trim();
  const a = ANBIETER[name];
  const grund = !name ? 'kein_anbieter' : !a ? 'anbieter_unbekannt' : !key ? 'kein_schluessel' : !von ? 'kein_absender' : null;
  return {
    aktiv: !grund,
    anbieter: a ? name : null,
    grund,
    async sende({ an, betreff, text, html }) {
      if (grund) throw new Error('E-Mail-Versand aus: ' + grund);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(an || ''))) throw new Error('ungültige Empfängeradresse');
      const res = await fetchImpl(a.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...a.kopf(key) },
        body: JSON.stringify(a.koerper({ von, an, betreff, text, html })),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return true;
    },
  };
}
