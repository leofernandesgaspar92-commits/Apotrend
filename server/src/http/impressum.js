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
  return `<p style="font-size:14px;margin:14px 0 4px;opacity:.85"><a href="/impressum">${esc(i)}</a> · <a href="/datenschutz.html">${esc(d)}</a></p>`;
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
<p><a href="/datenschutz.html">${esc(T.datenschutz)}</a> · <a href="/">${esc(T.zurueck)}</a></p>
</div></div></body></html>`;
}

// Dienstleister in der Datenschutzerklärung: NUR Name, Sitzland und Hauptdomain — keine erfundenen
// Unterseiten-Links (die Adressen der Anbieter ändern sich; die Domain führt sicher hin).
const SMS_ANBIETER = {
  africastalking: "Africa's Talking (Sitz in Kenia, außerhalb der EU) — Datenschutzerklärung des Anbieters auf africastalking.com.",
  twilio: 'Twilio (Sitz in den USA, außerhalb der EU) — Datenschutzerklärung des Anbieters auf twilio.com.',
};
const ZAHL_ANBIETER = {
  stripe: 'Kartenzahlung über Stripe — Datenschutzerklärung auf stripe.com.',
  paypal: 'PayPal — Datenschutzerklärung auf paypal.com.',
};

/** Datenschutzerklärung: Platzhalter durch die tatsächliche Einrichtung ersetzen (soweit bekannt). */
export function datenschutzMitAngaben(html, angaben = betreiberAngaben(), { sms = null, zahlwege = [], krypto = false, ueberweisung = false, geprueft = false } = {}) {
  let s = String(html);
  // Hinweis „Entwurf — noch nicht rechtlich geprüft" erst weg, wenn der Owner die Prüfung bestätigt
  // (APOPULSE_DATENSCHUTZ_GEPRUEFT=ja) — nicht automatisch, nur weil keine Lücke mehr offen ist.
  if (geprueft) s = s.replace(/\s*<div class="entwurf">[\s\S]*?<\/div>/, '');
  // SMS: der tatsächlich eingestellte Anbieter — oder ehrlich „nicht eingeschaltet".
  s = s.replace(/<span class="luecke">\[Noch einzutragen: der tatsächlich eingestellte Anbieter[\s\S]*?<\/span>/,
    () => esc(SMS_ANBIETER[sms] ? 'Anbieter: ' + SMS_ANBIETER[sms] : 'Derzeit ist die Anmeldung per SMS nicht eingeschaltet; es werden keine SMS versendet.'));
  // Zahlungen: was wirklich freigeschaltet ist.
  const wege = [
    ...zahlwege.filter((z) => ZAHL_ANBIETER[z]).map((z) => ZAHL_ANBIETER[z]),
    ...(krypto ? ['Krypto-Zahlung direkt an unsere eigene Wallet-Adresse: Es ist kein Zahlungsdienstleister beteiligt. Die Transaktion (Adresse, Betrag, Zeitpunkt) ist auf der jeweiligen Blockchain öffentlich einsehbar; wir speichern die von Ihnen gemeldete Transaktions-ID, um die Zahlung Ihrem Konto zuzuordnen.'] : []),
    ...(ueberweisung ? ['Banküberweisung: Ihre Bank und unsere Bank verarbeiten die Zahlungsdaten (Name, IBAN, Betrag, Verwendungszweck).'] : []),
  ];
  s = s.replace(/<span class="luecke">\[Noch einzutragen: welche Anbieter tatsächlich[\s\S]*?<\/span>/,
    () => (wege.length ? `<ul>${wege.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : esc('Derzeit sind keine kostenpflichtigen Funktionen freigeschaltet.')));
  if (angaben.anschrift && angaben.email) {
    const verantwortlich = `${esc(angaben.name)}${angaben.name !== angaben.gruender ? ` (${esc(angaben.gruender)})` : ''}<br>${esc(angaben.anschrift).replace(/\n/g, '<br>')}<br>E-Mail: <a href="mailto:${esc(angaben.email)}">${esc(angaben.email)}</a>`;
    s = s.replace(/<span class="luecke">\[Noch einzutragen: Name bzw\. Firma[\s\S]*?<\/span>/, verantwortlich);
  }
  if (angaben.email) s = s.replace(/<span class="luecke">\[Noch einzutragen: E-Mail-Adresse für Datenschutzanfragen[\s\S]*?<\/span>/, `<a href="mailto:${esc(angaben.email)}">${esc(angaben.email)}</a>`);
  return s;
}
