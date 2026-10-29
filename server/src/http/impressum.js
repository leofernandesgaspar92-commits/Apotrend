// ============================================================================
//  Impressum (§ 5 ECG, § 25 MedienG) und Betreiberangaben
// ============================================================================
//  Bis 10/2026 gab es kein Impressum, und die Datenschutzerklärung (nirgends
//  verlinkt) hatte beim „Verantwortlichen" nur einen Platzhalter. Nirgends auf
//  der Seite stand, wer ApoPulse betreibt — Suchmaschinen und KI-Antworten
//  konnten die Plattform deshalb keiner Person zuordnen und rieten.
//
//  Gründer steht fest (Owner-Wunsch, 29.10.2026). Firma, Anschrift und UID
//  kommen aus denselben Einstellungen wie die Rechnungen (APOPULSE_FIRMA_*),
//  dazu APOPULSE_KONTAKT_EMAIL — nichts davon ist geheim, es ist zur
//  Veröffentlichung gedacht. Fehlt etwas, steht es sichtbar als „noch
//  einzutragen" da (und im Startklar-Check), statt erfunden zu werden.
// ============================================================================

export const GRUENDER = 'Leo Fernandes Gaspar';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Angaben aus der Umgebung (leer = noch nicht eingetragen). */
export function betreiberAngaben(env = process.env) {
  const w = (k) => String(env[k] || '').trim() || null;
  return {
    name: w('APOPULSE_FIRMA_NAME') || GRUENDER,
    gruender: GRUENDER,
    anschrift: w('APOPULSE_FIRMA_ANSCHRIFT'),
    email: w('APOPULSE_KONTAKT_EMAIL'),
    uid: w('APOPULSE_FIRMA_UST_ID'),
  };
}

/** Links „Impressum · Datenschutz" in der Sprache der Seite (öffentliche Seiten, Teilseiten). */
const RECHT = {
  de: ['Impressum', 'Datenschutz'], en: ['Legal notice', 'Privacy'], pt: ['Informação legal', 'Privacidade'],
  fr: ['Mentions légales', 'Confidentialité'], ar: ['البيانات القانونية', 'الخصوصية'],
};
export function rechtsLinksHtml(sp = 'en') {
  const [i, d] = RECHT[sp] || RECHT.en;
  const q = RECHT[sp] ? `?sp=${sp}` : '';
  return `<p style="font-size:14px;margin:14px 0 4px;opacity:.85"><a href="/impressum${q}">${esc(i)}</a> · <a href="/datenschutz.html${q}">${esc(d)}</a></p>`;
}

/** schema.org: wer hinter ApoPulse steht — für Suchmaschinen (kein ausführbares Skript). */
export function organisationJsonLd(basis = '') {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'ApoPulse',
    ...(basis ? { url: basis, logo: `${basis}/icon-512.png` } : {}),
    founder: { '@type': 'Person', name: GRUENDER },
  };
}

const TEXT = {
  de: {
    titel: 'Impressum', grundlage: 'Angaben gemäß § 5 E-Commerce-Gesetz und Offenlegung gemäß § 25 Mediengesetz.',
    betreiber: 'Betreiber und Medieninhaber', gruender: 'Gründer', anschrift: 'Anschrift', email: 'E-Mail', uid: 'UID-Nummer',
    fehlt: '[noch einzutragen]',
    gegenstand: 'Unternehmensgegenstand', gegenstand_t: 'Betrieb einer Informationsplattform zu Lieferengpässen bei Arzneimitteln für Apotheken, Ärzt:innen, Großhandel und Logistik.',
    richtung: 'Grundlegende Richtung', richtung_t: 'Information der Fachkreise über Lieferengpässe — jede Angabe mit Quelle (Behörde oder Meldung aus Apotheken, als solche gekennzeichnet). Keine Therapie- oder Austauschempfehlung.',
    datenschutz: 'Datenschutzerklärung', zurueck: 'Zur App',
  },
  en: {
    titel: 'Legal notice', grundlage: 'Information pursuant to § 5 of the Austrian E-Commerce Act and § 25 of the Austrian Media Act.',
    betreiber: 'Operator and media owner', gruender: 'Founder', anschrift: 'Address', email: 'Email', uid: 'VAT number',
    fehlt: '[to be added]',
    gegenstand: 'Business purpose', gegenstand_t: 'Operation of an information platform on medicine shortages for pharmacies, doctors, wholesalers and logistics.',
    richtung: 'Editorial line', richtung_t: 'Informing healthcare professionals about shortages — every statement with its source (authority or pharmacy report, labelled as such). No therapy or substitution advice.',
    datenschutz: 'Privacy policy', zurueck: 'Open the app',
  },
};

export function impressumSeite({ sp = 'en', basis = '', angaben = betreiberAngaben() } = {}) {
  const T = sp === 'de' ? TEXT.de : TEXT.en; // rechtlich maßgeblich: Deutsch; sonst Englisch
  const lang = sp === 'de' ? 'de' : 'en';
  const zeile = (k, v) => `<tr><th>${esc(k)}</th><td>${v ? esc(v).replace(/\n/g, '<br>') : `<span class="f">${esc(T.fehlt)}</span>`}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(T.titel)} · ApoPulse</title>
<meta name="description" content="${esc(T.titel)} ApoPulse — ${esc(T.gruender)}: ${esc(angaben.gruender)}">
${basis ? `<link rel="canonical" href="${esc(basis)}/impressum">` : ''}
<script type="application/ld+json">${JSON.stringify(organisationJsonLd(basis)).replace(/</g, '\\u003c')}</script>
<style>
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;color:#0f1419;font-size:17px;line-height:1.5}
.k{max-width:720px;margin:0 auto;padding:16px}.c{background:#fff;border:1px solid #e1e5e8;border-radius:16px;padding:20px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}
th,td{text-align:start;vertical-align:top;padding:8px 0;border-top:1px solid #e9ecef}th{width:40%;padding-inline-end:12px;font-weight:600}
.f{color:#9a6700;font-weight:600}.mu{color:#536471;font-size:15px}a{color:#0b5fa5}
@media (prefers-color-scheme:dark){body{background:#0f1419;color:#e7e9ea}.c{background:#16202a;border-color:#2f3b45}th,td{border-color:#2f3b45}.mu{color:#9aa8b4}a{color:#6cb6ff}.f{color:#ffd166}}
</style></head>
<body><div class="k"><div class="c">
<h1>${esc(T.titel)}</h1><p class="mu">${esc(T.grundlage)}</p>
<table>
${zeile(T.betreiber, angaben.name)}
${zeile(T.gruender, angaben.gruender)}
${zeile(T.anschrift, angaben.anschrift)}
${zeile(T.email, angaben.email)}
${angaben.uid ? zeile(T.uid, angaben.uid) : ''}
</table>
<h2>${esc(T.gegenstand)}</h2><p>${esc(T.gegenstand_t)}</p>
<h2>${esc(T.richtung)}</h2><p>${esc(T.richtung_t)}</p>
<p><a href="/datenschutz.html?sp=${sp}">${esc(T.datenschutz)}</a> · <a href="/">${esc(T.zurueck)}</a></p>
</div></div></body></html>`;
}

// Datenschutzerklärung in fünf Sprachen (public/datenschutz.html = Deutsch, maßgeblich;
// datenschutz-<sp>.html = Übersetzungen). Bis 10/2026 gab es sie nur auf Deutsch — die Apothekerin
// in Senegal tippte auf „Confidentialité" und bekam eine deutsche Seite.
export const DATENSCHUTZ_SPRACHEN = ['de', 'en', 'fr', 'pt', 'ar'];
export const datenschutzDatei = (sp) => (sp === 'de' || !DATENSCHUTZ_SPRACHEN.includes(sp) ? 'datenschutz.html' : `datenschutz-${sp}.html`);
const SPRACHNAME = { de: 'Deutsch', en: 'English', fr: 'Français', pt: 'Português', ar: 'العربية' };

// Dienstleister: NUR Name, Sitzland und Hauptdomain — keine erfundenen Unterseiten-Links (die
// Adressen der Anbieter ändern sich; die Domain führt sicher hin).
const DS_TEXT = {
  de: {
    anbieter: 'Anbieter: ', email: 'E-Mail',
    sms: { africastalking: "Africa's Talking (Sitz in Kenia, außerhalb der EU) — Datenschutzerklärung des Anbieters auf africastalking.com.", twilio: 'Twilio (Sitz in den USA, außerhalb der EU) — Datenschutzerklärung des Anbieters auf twilio.com.' },
    smsAus: 'Derzeit ist die Anmeldung per SMS nicht eingeschaltet; es werden keine SMS versendet.',
    zahl: { stripe: 'Kartenzahlung über Stripe — Datenschutzerklärung auf stripe.com.', paypal: 'PayPal — Datenschutzerklärung auf paypal.com.' },
    krypto: 'Krypto-Zahlung direkt an unsere eigene Wallet-Adresse: Es ist kein Zahlungsdienstleister beteiligt. Die Transaktion (Adresse, Betrag, Zeitpunkt) ist auf der jeweiligen Blockchain öffentlich einsehbar; wir speichern die von Ihnen gemeldete Transaktions-ID, um die Zahlung Ihrem Konto zuzuordnen.',
    ueberweisung: 'Banküberweisung: Ihre Bank und unsere Bank verarbeiten die Zahlungsdaten (Name, IBAN, Betrag, Verwendungszweck).',
    keine: 'Derzeit sind keine kostenpflichtigen Funktionen freigeschaltet.',
  },
  en: {
    anbieter: 'Provider: ', email: 'Email',
    sms: { africastalking: "Africa's Talking (based in Kenya, outside the EU) — the provider's privacy policy is on africastalking.com.", twilio: "Twilio (based in the USA, outside the EU) — the provider's privacy policy is on twilio.com." },
    smsAus: 'Sign-in by SMS is currently not switched on; no SMS are sent.',
    zahl: { stripe: 'Card payment via Stripe — privacy policy on stripe.com.', paypal: 'PayPal — privacy policy on paypal.com.' },
    krypto: 'Crypto payment directly to our own wallet address: no payment service provider is involved. The transaction (address, amount, time) is publicly visible on the respective blockchain; we store the transaction ID you report in order to assign the payment to your account.',
    ueberweisung: 'Bank transfer: your bank and our bank process the payment data (name, IBAN, amount, reference).',
    keine: 'No paid features are currently enabled.',
  },
  fr: {
    anbieter: 'Prestataire : ', email: 'E-mail',
    sms: { africastalking: "Africa's Talking (siège au Kenya, hors UE) — politique de confidentialité du prestataire sur africastalking.com.", twilio: 'Twilio (siège aux États-Unis, hors UE) — politique de confidentialité du prestataire sur twilio.com.' },
    smsAus: 'La connexion par SMS n’est actuellement pas activée ; aucun SMS n’est envoyé.',
    zahl: { stripe: 'Paiement par carte via Stripe — politique de confidentialité sur stripe.com.', paypal: 'PayPal — politique de confidentialité sur paypal.com.' },
    krypto: 'Paiement en crypto directement à notre propre adresse de portefeuille : aucun prestataire de paiement n’intervient. La transaction (adresse, montant, date) est publiquement visible sur la blockchain concernée ; nous conservons l’identifiant de transaction que vous indiquez afin d’attribuer le paiement à votre compte.',
    ueberweisung: 'Virement bancaire : votre banque et notre banque traitent les données de paiement (nom, IBAN, montant, référence).',
    keine: 'Aucune fonction payante n’est actuellement activée.',
  },
  pt: {
    anbieter: 'Prestador: ', email: 'E-mail',
    sms: { africastalking: "Africa's Talking (sede no Quénia, fora da UE) — política de privacidade do prestador em africastalking.com.", twilio: 'Twilio (sede nos EUA, fora da UE) — política de privacidade do prestador em twilio.com.' },
    smsAus: 'A entrada por SMS não está ativada de momento; não são enviados SMS.',
    zahl: { stripe: 'Pagamento com cartão via Stripe — política de privacidade em stripe.com.', paypal: 'PayPal — política de privacidade em paypal.com.' },
    krypto: 'Pagamento em cripto diretamente para o nosso próprio endereço de carteira: não intervém nenhum prestador de pagamentos. A transação (endereço, montante, data) é publicamente visível na respetiva blockchain; guardamos o ID da transação que indicar para associar o pagamento à sua conta.',
    ueberweisung: 'Transferência bancária: o seu banco e o nosso banco tratam os dados de pagamento (nome, IBAN, montante, referência).',
    keine: 'De momento não estão ativadas funções pagas.',
  },
  ar: {
    anbieter: 'المزوّد: ', email: 'البريد الإلكتروني',
    sms: { africastalking: "Africa's Talking (مقرها كينيا، خارج الاتحاد الأوروبي) — سياسة خصوصية المزوّد على africastalking.com.", twilio: 'Twilio (مقرها الولايات المتحدة، خارج الاتحاد الأوروبي) — سياسة خصوصية المزوّد على twilio.com.' },
    smsAus: 'تسجيل الدخول عبر الرسائل القصيرة غير مفعّل حاليًا؛ لا تُرسَل أي رسائل.',
    zahl: { stripe: 'الدفع بالبطاقة عبر Stripe — سياسة الخصوصية على stripe.com.', paypal: 'PayPal — سياسة الخصوصية على paypal.com.' },
    krypto: 'الدفع بالعملات الرقمية مباشرة إلى عنوان محفظتنا الخاص: لا يشارك أي مقدم خدمات دفع. المعاملة (العنوان، المبلغ، الوقت) مرئية للعموم على سلسلة الكتل المعنية؛ ونحفظ معرّف المعاملة الذي تُبلغ عنه لربط الدفع بحسابك.',
    ueberweisung: 'التحويل المصرفي: يعالج مصرفك ومصرفنا بيانات الدفع (الاسم، IBAN، المبلغ، المرجع).',
    keine: 'لا توجد حاليًا ميزات مدفوعة مفعّلة.',
  },
};

const luecke = (name) => new RegExp(`<span class="luecke" data-luecke="${name}">[\\s\\S]*?<\\/span>`);

/** Sprachwahl oben auf der Datenschutzerklärung (ohne Skript, reine Links). */
function sprachwahl(sp) {
  return `<nav aria-label="Language" style="margin:0 0 16px;font-size:15px">${DATENSCHUTZ_SPRACHEN.map((l) => (l === sp
    ? `<b lang="${l}">${esc(SPRACHNAME[l])}</b>`
    : `<a href="/datenschutz.html?sp=${l}" hreflang="${l}" lang="${l}">${esc(SPRACHNAME[l])}</a>`)).join(' · ')}</nav>`;
}

/** Datenschutzerklärung: Platzhalter durch die tatsächliche Einrichtung ersetzen (soweit bekannt). */
export function datenschutzMitAngaben(html, angaben = betreiberAngaben(), { sms = null, zahlwege = [], krypto = false, ueberweisung = false, geprueft = false } = {}) {
  let s = String(html);
  const sp = (s.match(/<html lang="([a-z]{2})"/) || [])[1] || 'de';
  const T = DS_TEXT[sp] || DS_TEXT.de;
  s = s.replace('<!--sprachen-->', sprachwahl(sp));
  // Hinweis „Entwurf — noch nicht rechtlich geprüft" erst weg, wenn der Owner die Prüfung bestätigt
  // (APOPULSE_DATENSCHUTZ_GEPRUEFT=ja) — nicht automatisch, nur weil keine Lücke mehr offen ist.
  if (geprueft) s = s.replace(/\s*<div class="entwurf">[\s\S]*?<\/div>/, '');
  // SMS: der tatsächlich eingestellte Anbieter — oder ehrlich „nicht eingeschaltet".
  s = s.replace(luecke('sms'), () => esc(T.sms[sms] ? T.anbieter + T.sms[sms] : T.smsAus));
  // Zahlungen: was wirklich freigeschaltet ist.
  const wege = [
    ...zahlwege.filter((z) => T.zahl[z]).map((z) => T.zahl[z]),
    ...(krypto ? [T.krypto] : []),
    ...(ueberweisung ? [T.ueberweisung] : []),
  ];
  s = s.replace(luecke('zahlung'), () => (wege.length ? `<ul>${wege.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : esc(T.keine)));
  if (angaben.anschrift && angaben.email) {
    const verantwortlich = `${esc(angaben.name)}${angaben.name !== angaben.gruender ? ` (${esc(angaben.gruender)})` : ''}<br>${esc(angaben.anschrift).replace(/\n/g, '<br>')}<br>${esc(T.email)}: <a href="mailto:${esc(angaben.email)}">${esc(angaben.email)}</a>`;
    s = s.replace(luecke('verantwortlich'), () => verantwortlich);
  }
  if (angaben.email) s = s.replace(luecke('kontakt'), () => `<a href="mailto:${esc(angaben.email)}">${esc(angaben.email)}</a>`);
  return s;
}
