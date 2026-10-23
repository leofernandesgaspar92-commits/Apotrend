// ============================================================================
//  Anmelden mit Telefonnummer + SMS-Code (wie WhatsApp)
// ============================================================================
//  In vielen afrikanischen Ländern ist die Telefonnummer die Identität — eine
//  E-Mail-Adresse hat nicht jede Apothekerin, ein Handy schon. Ablauf:
//    1. Nummer eingeben → 6-stelliger Code per SMS (services/sms.js).
//    2. Code eingeben → angemeldet. Gibt es zu der Nummer noch kein Konto,
//       kommt ein kurzlebiges Ticket zurück; mit Name + Kontotyp entsteht es.
//
//  Regeln:
//   1. NUR MIT EINGERICHTETEM VERSAND. Ohne SMS-Anbieter gibt es die Funktion
//      nicht (keine Kosten, kein halber Ablauf).
//   2. CODE: 6 Ziffern aus crypto.randomInt, 10 Minuten gültig, nur einmal,
//      gespeichert nur als Hash. Nach 5 Fehlversuchen ist er verbrannt.
//   3. EINE NUMMER, EIN KONTO. Die Nummer wird normalisiert (domain/telefon.js)
//      und als Platzhalter-Adresse „tel_<Ziffern>@telefon.local" geführt — die
//      darf niemand über das E-Mail-Formular belegen (server.js, kontoAnlegen).
//   4. TICKET: Zweck-Token 'tel_reg' (http/token.js), 15 Minuten — taugt nie als
//      Sitzung und nie als anderer Link.
//  Bremsen gegen SMS-Kosten-Missbrauch (je Nummer, je Gerät) sitzen in server.js.
// ============================================================================

import crypto from 'node:crypto';
import { AppError } from '../domain/errors.js';
import { normalisiereTelefon } from '../domain/telefon.js';

export const CODE_MINUTEN = 10;
export const MAX_VERSUCHE = 5;
const TICKET_MINUTEN = 15;

// Kurz halten: Eine SMS hat 160 Zeichen (GSM-7), mit Arabisch 70 (UCS-2).
const TEXT = {
  de: (c) => `ApoPulse-Code: ${c}. Gilt ${CODE_MINUTEN} Minuten. Nicht weitergeben.`,
  en: (c) => `ApoPulse code: ${c}. Valid for ${CODE_MINUTEN} minutes. Do not share it.`,
  pt: (c) => `Código ApoPulse: ${c}. Válido ${CODE_MINUTEN} minutos. Não partilhe.`,
  fr: (c) => `Code ApoPulse : ${c}. Valable ${CODE_MINUTEN} minutes. Ne le partagez pas.`,
  ar: (c) => `رمز ApoPulse: ${c}. صالح ${CODE_MINUTEN} دقائق. لا تشاركه.`,
};
export const SMS_SPRACHEN = Object.keys(TEXT);

export const telefonAdresse = (nummer) => `tel_${String(nummer).replace(/^\+/, '')}@telefon.local`;
const hash = (nummer, code) => crypto.createHash('sha256').update(`${nummer}|${code}`).digest();

export function createTelefonLogin({ sms, repo, ausstellen, pruefen, jetzt = Date.now, zufall = () => crypto.randomInt(0, 1_000_000) }) {
  const codes = new Map(); // Nummer -> { hash, ablauf, versuche }
  const aufraeumen = () => { const t = jetzt(); for (const [n, e] of codes) if (e.ablauf < t) codes.delete(n); };
  const nummerOderFehler = (telefon, land) => {
    const n = normalisiereTelefon(telefon, land);
    if (!n) throw new AppError('tel_ungueltig', 'Bitte eine gültige Telefonnummer eingeben.');
    return n;
  };
  return {
    get aktiv() { return !!(sms && sms.aktiv); },
    nummer: nummerOderFehler,

    async anfordern({ telefon, land, sprache }) {
      if (!this.aktiv) throw new AppError('sms_aus', 'SMS-Versand ist nicht eingerichtet.', 503);
      const nummer = nummerOderFehler(telefon, land);
      aufraeumen();
      const code = String(zufall()).padStart(6, '0');
      try { await sms.sende({ an: nummer, text: (TEXT[sprache] || TEXT.en)(code) }); }
      catch { throw new AppError('sms_fehler', 'Die SMS konnte nicht verschickt werden. Bitte später erneut versuchen.', 502); }
      codes.set(nummer, { hash: hash(nummer, code), ablauf: jetzt() + CODE_MINUTEN * 60_000, versuche: 0 });
      return { ok: true, nummer };
    },

    // → { userId } (Konto da) oder { neu: true, ticket } (Konto anlegen).
    pruefen({ telefon, land, code }) {
      const nummer = nummerOderFehler(telefon, land);
      const e = codes.get(nummer);
      if (!e || e.ablauf < jetzt()) { codes.delete(nummer); throw new AppError('tel_code_abgelaufen', 'Der Code ist abgelaufen. Bitte einen neuen anfordern.'); }
      const eingabe = String(code ?? '').replace(/\D/g, '');
      if (eingabe.length !== 6 || !crypto.timingSafeEqual(hash(nummer, eingabe), e.hash)) {
        e.versuche += 1;
        if (e.versuche >= MAX_VERSUCHE) { codes.delete(nummer); throw new AppError('tel_code_gesperrt', 'Zu viele falsche Versuche. Bitte einen neuen Code anfordern.'); }
        throw new AppError('tel_code_falsch', 'Der Code stimmt nicht.');
      }
      codes.delete(nummer); // nur einmal
      const user = repo.getUserByEmail(telefonAdresse(nummer));
      if (user && user.status === 'active') return { userId: user.id };
      if (user) throw new AppError('tel_konto_inaktiv', 'Dieses Konto ist nicht aktiv.', 403);
      return { neu: true, ticket: ausstellen(`${nummer}|${jetzt() + TICKET_MINUTEN * 60_000}`) };
    },

    /** Ticket → Nummer, sonst Fehler. */
    ticketNummer(ticket) {
      const v = pruefen(String(ticket || ''));
      const [nummer, ablauf] = v ? v.split('|') : [];
      if (!nummer || !(Number(ablauf) > jetzt()) || !/^\+[1-9]\d{7,14}$/.test(nummer)) {
        throw new AppError('tel_ticket', 'Bitte die Nummer noch einmal bestätigen.');
      }
      return nummer;
    },
  };
}
