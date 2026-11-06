// ============================================================================
//  Passwort vergessen → Link per E-Mail (wie bei Facebook/X)
// ============================================================================
//  Bisher ging „Passwort vergessen" nur mit einem Wiederherstellungscode —
//  den hat kaum jemand zur Hand. Ist der E-Mail-Versand eingerichtet
//  (services/mailer.js), schickt ApoPulse stattdessen einen Link.
//
//  Regeln:
//   1. KEINE KONTO-AUFZÄHLUNG. Die Anfrage antwortet immer gleich und sofort;
//      ob es die Adresse gibt, erfährt nur das Postfach.
//   2. KURZ GÜLTIG, NUR EINMAL. Der Link trägt Ablaufzeit (60 Minuten) und
//      einen Fingerabdruck des aktuellen Passwort-Hashs. Nach dem Ändern passt
//      der Fingerabdruck nicht mehr — der Link ist verbraucht, ohne dass der
//      Server sich etwas merken muss (überlebt Neustarts, keine Tabelle).
//   3. EIGENER SCHLÜSSEL. Signiert mit dem Zweck-Schlüssel 'pw_reset'
//      (http/token.js): taugt nie als Sitzung, kein anderes Zweck-Token
//      taugt als Passwort-Link.
//   4. FESTE ADRESSE. Der Link zeigt auf APOPULSE_PUBLIC_URL, nie auf den
//      Host-Kopf der Anfrage — sonst könnte ein Angreifer fremde Links auf
//      seine eigene Seite umbiegen.
// ============================================================================

import crypto from 'node:crypto';
import { AppError } from '../domain/errors.js';
import { richtung } from '../domain/schreibrichtung.js';

export const GUELTIG_MINUTEN = 60;
export const REDAKTION_GUELTIG_STUNDEN = 24;

const T = {
  de: {
    betreff: 'ApoPulse: Neues Passwort festlegen',
    hallo: (n) => `Hallo${n ? ' ' + n : ''},`,
    text: `über diesen Link legst du ein neues Passwort fest. Er gilt ${GUELTIG_MINUTEN} Minuten und nur einmal.`,
    redaktion: `über diesen Link legen Sie ein neues Passwort fest. Er gilt ${REDAKTION_GUELTIG_STUNDEN} Stunden und nur einmal. Danach sind Sie gleich angemeldet — bitte erstellen Sie im Profil neue Wiederherstellungscodes und bewahren Sie sie gut auf.`,
    knopf: 'Neues Passwort festlegen',
    nicht: 'Du hast das nicht angefordert? Dann ignoriere diese E-Mail — dein Passwort bleibt unverändert.',
  },
  en: {
    betreff: 'ApoPulse: Set a new password',
    hallo: (n) => `Hello${n ? ' ' + n : ''},`,
    text: `use this link to set a new password. It is valid for ${GUELTIG_MINUTEN} minutes and works only once.`,
    redaktion: `use this link to set a new password. It is valid for ${REDAKTION_GUELTIG_STUNDEN} hours and works only once. You will then be logged in straight away — please create new recovery codes in your profile and keep them safe.`,
    knopf: 'Set a new password',
    nicht: 'You did not ask for this? Then ignore this email — your password stays the same.',
  },
  pt: {
    betreff: 'ApoPulse: Definir uma nova palavra-passe',
    hallo: (n) => `Olá${n ? ' ' + n : ''},`,
    text: `use este link para definir uma nova palavra-passe. É válido durante ${GUELTIG_MINUTEN} minutos e só funciona uma vez.`,
    redaktion: `use este link para definir uma nova palavra-passe. É válido durante ${REDAKTION_GUELTIG_STUNDEN} horas e só funciona uma vez. Depois fica logo com sessão iniciada — crie novos códigos de recuperação no seu perfil e guarde-os bem.`,
    knopf: 'Definir nova palavra-passe',
    nicht: 'Não pediu isto? Ignore este e-mail — a sua palavra-passe não muda.',
  },
  fr: {
    betreff: 'ApoPulse : définir un nouveau mot de passe',
    hallo: (n) => `Bonjour${n ? ' ' + n : ''},`,
    text: `ce lien vous permet de définir un nouveau mot de passe. Il est valable ${GUELTIG_MINUTEN} minutes et une seule fois.`,
    redaktion: `ce lien vous permet de définir un nouveau mot de passe. Il est valable ${REDAKTION_GUELTIG_STUNDEN} heures et une seule fois. Vous serez ensuite connecté(e) directement — créez de nouveaux codes de récupération dans votre profil et conservez-les bien.`,
    knopf: 'Définir un nouveau mot de passe',
    nicht: 'Vous n’avez rien demandé ? Ignorez cet e-mail — votre mot de passe reste inchangé.',
  },
  ar: {
    betreff: 'ApoPulse: تعيين كلمة مرور جديدة',
    hallo: (n) => `مرحبًا${n ? ' ' + n : ''}،`,
    text: `استخدم هذا الرابط لتعيين كلمة مرور جديدة. صالح لمدة ${GUELTIG_MINUTEN} دقيقة ولمرة واحدة فقط.`,
    redaktion: `استخدم هذا الرابط لتعيين كلمة مرور جديدة. صالح لمدة ${REDAKTION_GUELTIG_STUNDEN} ساعة ولمرة واحدة فقط. بعد ذلك يتم تسجيل دخولك مباشرة — يُرجى إنشاء رموز استرداد جديدة في ملفك الشخصي والاحتفاظ بها في مكان آمن.`,
    knopf: 'تعيين كلمة مرور جديدة',
    nicht: 'لم تطلب ذلك؟ تجاهل هذه الرسالة — تبقى كلمة المرور كما هي.',
  },
};
export const MAIL_SPRACHEN = Object.keys(T);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fingerabdruck = (hash) => crypto.createHash('sha256').update(String(hash || '')).digest('base64url').slice(0, 16);

export function rendereLinkMail({ sprache, name, link, redaktion = false }) {
  const sp = T[sprache] ? sprache : 'en';
  const t = { ...T[sp], ...(redaktion ? { text: T[sp].redaktion } : {}) };
  const text = [t.hallo(name), '', t.text, link, '', t.nicht].join('\n');
  const html = `<!doctype html><html lang="${sp}" dir="${richtung(sp)}"><body style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1f1d">
<p>${esc(t.hallo(name))}<br>${esc(t.text)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0b7f28;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(t.knopf)}</a></p>
<p style="font-size:14px;color:#4a524e">${esc(link)}</p>
<p style="font-size:14px;color:#4a524e">${esc(t.nicht)}</p>
</body></html>`;
  return { betreff: t.betreff, text, html };
}

export function createPasswortLink({ repo, mailer, ausstellen, pruefen, basis, hashPassword, jetzt = Date.now, log = console }) {
  return {
    get aktiv() { return !!(mailer && mailer.aktiv); },

    // Immer dieselbe Antwort; der Versand läuft im Hintergrund, damit auch die
    // Antwortzeit nichts über das Konto verrät.
    anfordern({ email, sprache }) {
      if (!this.aktiv) throw new AppError('mail_aus', 'E-Mail-Versand ist nicht eingerichtet.', 503);
      const user = repo.getUserByEmail(String(email || '').trim());
      if (user && user.status === 'active') {
        const ablauf = jetzt() + GUELTIG_MINUTEN * 60_000;
        const token = ausstellen(`${user.id}|${ablauf}|${fingerabdruck(user.password_hash)}`);
        const link = `${basis}/?pwlink=${encodeURIComponent(token)}`;
        const m = rendereLinkMail({ sprache, name: user.name, link });
        Promise.resolve()
          .then(() => mailer.sende({ an: user.email, betreff: m.betreff, text: m.text, html: m.html }))
          .catch((e) => log.warn('Passwort-Link nicht versendet:', e && e.message));
      }
      return { ok: true };
    },

    // Redaktion hilft einem ausgesperrten Konto (keine Codes, kein E-Mail-Versand): derselbe
    // Einmal-Link, 24 h gültig — die Redaktion schickt ihn an die Adresse DES KONTOS.
    // Konto-Prüfung (Redaktionskonten ausgeschlossen) macht der Aufrufer.
    // Die Mail-Vorlage kommt in der Sprache DES KONTOS (nicht der Redaktion).
    fuerRedaktion(user, sprache) {
      const ablauf = jetzt() + REDAKTION_GUELTIG_STUNDEN * 3_600_000;
      const token = ausstellen(`${user.id}|${ablauf}|${fingerabdruck(user.password_hash)}`);
      const link = `${basis}/?pwlink=${encodeURIComponent(token)}`;
      const m = rendereLinkMail({ sprache, name: user.name, link, redaktion: true });
      return { link, gueltig_bis: new Date(ablauf).toISOString(), sprache: MAIL_SPRACHEN.includes(sprache) ? sprache : 'en', mail: { betreff: m.betreff, text: m.text } };
    },
    einloesen({ t, newPassword }) {
      const v = pruefen(String(t || ''));
      const [uid, ablauf, fp] = v ? v.split('|') : [];
      if (!uid || !ablauf || !fp) throw new AppError('pwlink_invalid', 'Der Link ist ungültig oder wurde schon benutzt.');
      if (!(Number(ablauf) > jetzt())) throw new AppError('pwlink_expired', 'Der Link ist abgelaufen. Bitte einen neuen anfordern.');
      const user = repo.getUserById(uid);
      if (!user || user.status !== 'active' || fp !== fingerabdruck(user.password_hash)) {
        throw new AppError('pwlink_invalid', 'Der Link ist ungültig oder wurde schon benutzt.');
      }
      if (!newPassword || String(newPassword).length < 8) throw new AppError('new_pw_short', 'Neues Passwort: mindestens 8 Zeichen.');
      repo.setUserPassword(uid, hashPassword(newPassword));
      return { userId: uid };
    },
  };
}
