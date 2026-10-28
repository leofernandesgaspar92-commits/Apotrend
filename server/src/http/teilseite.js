// ============================================================================
//  Teilseiten: Vorschau in WhatsApp, Telegram, LinkedIn, E-Mail
// ============================================================================
//  Messenger lesen kein JavaScript. Ein geteilter App-Link („/?wirkstoff=…")
//  erschien deshalb als nackte Adresse. Diese Seiten werden auf dem Server
//  gebaut und tragen Open-Graph-Angaben: Titel, Beschreibung, Bild.
//
//  Inhalt nur, was ohnehin öffentlich ist (Behördenlisten) — mit Quelle und
//  Stand. Verlauf, Ausland, Radar gibt es nach der Anmeldung. Der Knopf führt
//  in die App und beobachtet den Wirkstoff nach der Anmeldung gleich mit:
//  So wird aus einem geteilten Link eine neue Nutzerin mit sofortigem Nutzen.
//
//  Alles, was aus der Adresse kommt, wird escaped — die Seite ist öffentlich.
// ============================================================================

import { frLand } from '../domain/franzLand.js';
import { richtung } from '../domain/schreibrichtung.js';
import { vorschaubild } from '../domain/vorschaubild.js';

const TEXTE = {
  de: {
    lage_titel: (n, land) => `${n} Wirkstoffe auf der Engpassliste in ${land}`,
    lage_titel_1: (land) => `1 Wirkstoff auf der Engpassliste in ${land}`,
    lage_ohne: (land) => `Lieferengpässe in ${land}`,
    lage_beschr: (neu, quellen) => `${neu} neu in den letzten 7 Tagen · Quelle: ${quellen}`,
    w_knapp: (w, land) => `${w}: knapp in ${land}`,
    w_seit: (n) => (n <= 0 ? 'seit heute' : n === 1 ? 'seit 1 Tag' : `seit ${n} Tagen`),
    w_nicht: (w, land) => `${w}: in ${land} derzeit nicht als knapp gemeldet`,
    w_unbekannt: (w, land) => `${w}: für ${land} liegt noch keine Behördenliste vor`,
    w_apo_best: (w, land, n) => `${w}: von ${n} Apotheken in ${land} als knapp gemeldet`,
    w_apo: (w, land, n) => (n === 1 ? `${w}: 1 Apotheke in ${land} meldet einen Engpass (noch nicht bestätigt)` : `${w}: ${n} Apotheken in ${land} melden einen Engpass (noch nicht bestätigt)`),
    lage_apo: (n, land) => (n === 1 ? `1 Wirkstoff von Apotheken in ${land} als knapp gemeldet` : `${n} Wirkstoffe von Apotheken in ${land} als knapp gemeldet`),
    lage_apo_beschr: (b) => `davon ${b} von mehreren Apotheken bestätigt · nicht amtlich`,
    quelle: 'Quelle', community: 'gemeldet aus Apotheken, nicht amtlich', referenz: 'Referenzdaten', stand: 'Stand',
    cta_w: (w) => `Kostenlos benachrichtigt werden, wenn sich bei ${w} etwas ändert`,
    cta_bestaetigen: (w) => `Bei Ihnen auch knapp? ${w} in ApoPulse bestätigen — kostenlos`,
    cta_lage: 'Alle Engpässe mit Quelle ansehen — kostenlos', mehr: 'In ApoPulse: Verlauf, Lage im Ausland, eigene Liste prüfen.',
    marke: 'ApoPulse — Lieferengpässe mit Quelle',
  },
  en: {
    lage_titel: (n, land) => `${n} substances on the shortage list in ${land}`,
    lage_titel_1: (land) => `1 substance on the shortage list in ${land}`,
    lage_ohne: (land) => `Medicine shortages in ${land}`,
    lage_beschr: (neu, quellen) => `${neu} new in the last 7 days · Source: ${quellen}`,
    w_knapp: (w, land) => `${w}: short in ${land}`,
    w_seit: (n) => (n <= 0 ? 'since today' : n === 1 ? 'for 1 day' : `for ${n} days`),
    w_nicht: (w, land) => `${w}: currently not reported short in ${land}`,
    w_unbekannt: (w, land) => `${w}: no authority list for ${land} yet`,
    w_apo_best: (w, land, n) => `${w}: reported short by ${n} pharmacies in ${land}`,
    w_apo: (w, land, n) => (n === 1 ? `${w}: 1 pharmacy in ${land} reports a shortage (not yet confirmed)` : `${w}: ${n} pharmacies in ${land} report a shortage (not yet confirmed)`),
    lage_apo: (n, land) => (n === 1 ? `1 substance reported short by pharmacies in ${land}` : `${n} substances reported short by pharmacies in ${land}`),
    lage_apo_beschr: (b) => `${b} of them confirmed by several pharmacies · not official`,
    quelle: 'Source', community: 'reported by pharmacies, not official', referenz: 'reference data', stand: 'As of',
    cta_w: (w) => `Get notified for free when anything changes for ${w}`,
    cta_bestaetigen: (w) => `Short at your pharmacy too? Confirm ${w} in ApoPulse — free`,
    cta_lage: 'See all shortages with sources — free', mehr: 'In ApoPulse: history, situation abroad, check your own list.',
    marke: 'ApoPulse — medicine shortages with sources',
  },
  pt: {
    lage_titel: (n, land) => `${n} substâncias na lista de ruturas em ${land}`,
    lage_titel_1: (land) => `1 substância na lista de ruturas em ${land}`,
    lage_ohne: (land) => `Ruturas de medicamentos em ${land}`,
    lage_beschr: (neu, quellen) => `${neu} novas nos últimos 7 dias · Fonte: ${quellen}`,
    w_knapp: (w, land) => `${w}: em rutura em ${land}`,
    w_seit: (n) => (n <= 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`),
    w_nicht: (w, land) => `${w}: sem rutura comunicada atualmente em ${land}`,
    w_unbekannt: (w, land) => `${w}: ainda não há lista de autoridade para ${land}`,
    w_apo_best: (w, land, n) => `${w}: comunicado em rutura por ${n} farmácias em ${land}`,
    w_apo: (w, land, n) => (n === 1 ? `${w}: 1 farmácia em ${land} comunica uma rutura (ainda não confirmado)` : `${w}: ${n} farmácias em ${land} comunicam uma rutura (ainda não confirmado)`),
    lage_apo: (n, land) => (n === 1 ? `1 substância comunicada em rutura por farmácias em ${land}` : `${n} substâncias comunicadas em rutura por farmácias em ${land}`),
    lage_apo_beschr: (b) => `${b} delas confirmadas por várias farmácias · não oficial`,
    quelle: 'Fonte', community: 'comunicado por farmácias, não oficial', referenz: 'dados de referência', stand: 'Atualizado',
    cta_w: (w) => `Receber aviso grátis quando algo mudar em ${w}`,
    cta_bestaetigen: (w) => `Também em rutura na sua farmácia? Confirme ${w} no ApoPulse — grátis`,
    cta_lage: 'Ver todas as ruturas com fonte — grátis', mehr: 'No ApoPulse: histórico, situação no estrangeiro, verificar a sua lista.',
    marke: 'ApoPulse — ruturas de medicamentos com fonte',
  },
  fr: {
    lage_titel: (n, land) => `${n} substances sur la liste des pénuries ${frLand(land)}`,
    lage_titel_1: (land) => `1 substance sur la liste des pénuries ${frLand(land)}`,
    lage_ohne: (land) => `Pénuries de médicaments ${frLand(land)}`,
    lage_beschr: (neu, quellen) => `${neu} nouvelle(s) au cours des 7 derniers jours · Source : ${quellen}`,
    w_knapp: (w, land) => `${w} : en pénurie ${frLand(land)}`,
    w_seit: (n) => (n <= 0 ? 'depuis aujourd’hui' : n === 1 ? 'depuis 1 jour' : `depuis ${n} jours`),
    w_nicht: (w, land) => `${w} : actuellement pas signalé en pénurie ${frLand(land)}`,
    w_unbekannt: (w, land) => `${w} : pas encore de liste officielle ${frLand(land, 'pour')}`,
    w_apo_best: (w, land, n) => `${w} : signalé en pénurie par ${n} pharmacies ${frLand(land)}`,
    w_apo: (w, land, n) => (n === 1 ? `${w} : 1 pharmacie ${frLand(land)} signale une pénurie (pas encore confirmée)` : `${w} : ${n} pharmacies ${frLand(land)} signalent une pénurie (pas encore confirmée)`),
    lage_apo: (n, land) => (n === 1 ? `1 substance signalée en pénurie par des pharmacies ${frLand(land)}` : `${n} substances signalées en pénurie par des pharmacies ${frLand(land)}`),
    lage_apo_beschr: (b) => `dont ${b} confirmée(s) par plusieurs pharmacies · non officiel`,
    quelle: 'Source', community: 'signalé par des pharmacies, non officiel', referenz: 'données de référence', stand: 'Mis à jour',
    cta_w: (w) => `Être averti gratuitement dès que quelque chose change pour ${w}`,
    cta_bestaetigen: (w) => `En pénurie chez vous aussi ? Confirmez ${w} dans ApoPulse — gratuit`,
    cta_lage: 'Voir toutes les pénuries avec sources — gratuit', mehr: 'Dans ApoPulse : historique, situation à l’étranger, vérification de votre propre liste.',
    marke: 'ApoPulse — pénuries de médicaments avec sources',
  },
  ar: {
    lage_titel: (n, land) => `${n} مواد على قائمة النقص في ${land}`,
    lage_titel_1: (land) => `مادة واحدة على قائمة النقص في ${land}`,
    lage_ohne: (land) => `نقص الأدوية في ${land}`,
    lage_beschr: (neu, quellen) => `${neu} جديدة خلال الأيام السبعة الأخيرة · المصدر: ${quellen}`,
    w_knapp: (w, land) => `${w}: ناقص في ${land}`,
    w_seit: (n) => (n <= 0 ? 'منذ اليوم' : n === 1 ? 'منذ يوم واحد' : `منذ ${n} يوم`),
    w_nicht: (w, land) => `${w}: غير مُبلَّغ عن نقصه حاليًا في ${land}`,
    w_unbekannt: (w, land) => `${w}: لا توجد بعد قائمة رسمية لـ ${land}`,
    w_apo_best: (w, land, n) => `${w}: أبلغت ${n} صيدليات في ${land} عن نقصه`,
    w_apo: (w, land, n) => (n === 1 ? `${w}: صيدلية واحدة في ${land} تبلّغ عن نقص (لم يتأكد بعد)` : `${w}: ${n} صيدليات في ${land} تبلّغ عن نقص (لم يتأكد بعد)`),
    lage_apo: (n, land) => (n === 1 ? `مادة واحدة أبلغت صيدليات في ${land} عن نقصها` : `${n} مواد أبلغت صيدليات في ${land} عن نقصها`),
    lage_apo_beschr: (b) => `منها ${b} أكدتها عدة صيدليات · غير رسمي`,
    quelle: 'المصدر', community: 'أبلغت عنه صيدليات، غير رسمي', referenz: 'بيانات مرجعية', stand: 'بتاريخ',
    cta_w: (w) => `احصل على إشعار مجاني عند حدوث أي تغيير في ${w}`,
    cta_bestaetigen: (w) => `ناقص لديك أيضًا؟ أكّد ${w} على ApoPulse — مجانًا`,
    cta_lage: 'عرض كل حالات النقص مع المصادر — مجانًا', mehr: 'على ApoPulse: السجل، الوضع في الخارج، فحص قائمتك الخاصة.',
    marke: 'ApoPulse — نقص الأدوية مع المصادر',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function landName(code, sprache, fallback) {
  try { return new Intl.DisplayNames([sprache], { type: 'region' }).of(code) || fallback; } catch { return fallback; }
}
// „2026-10-14" → „14.10.2026" (de) / „14/10/2026" (pt) — Klartext statt ISO.
function datum(iso, sprache) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))) return iso;
  try { return new Intl.DateTimeFormat(sprache, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(iso).slice(0, 10) + 'T00:00:00Z')); } catch { return iso; }
}
const flagge = (cc) => String.fromCodePoint(...[...cc].map((b) => 0x1F1E6 + b.charCodeAt(0) - 65));

/**
 * Seite bauen. `d`:
 *   { art: 'lage', land, sprache, daten, offen, neu, quellen }
 *   { art: 'wirkstoff', land, sprache, wirkstoff, beobachtet_land, knapp, seit_tagen, herkunft, quelle, stand }
 */
export function teilseite(d, { basis }) {
  const T = TEXTE[d.sprache] || TEXTE.de;
  const land = landName(d.land, d.sprache, d.land);
  let titel; let beschr; let ziel;
  if (d.art === 'lage') {
    if (d.daten) {
      titel = d.offen === 1 ? T.lage_titel_1(land) : T.lage_titel(d.offen, land);
      beschr = T.lage_beschr(d.neu, (d.quellen || []).join(', ') || '—');
    } else if (d.apotheken) {
      // Ohne Behördenliste (große Teile Afrikas): die Apotheken-Lage, klar als nicht amtlich.
      titel = T.lage_apo(d.apotheken, land);
      beschr = T.lage_apo_beschr(d.apotheken_bestaetigt || 0);
    } else { titel = T.lage_ohne(land); beschr = T.mehr; }
    ziel = `/?land=${encodeURIComponent(d.land)}`;
  } else {
    const w = d.wirkstoff;
    const apo = !d.knapp && d.apotheken > 0;
    if (d.knapp) titel = `${T.w_knapp(w, land)}${d.seit_tagen != null ? ' ' + T.w_seit(d.seit_tagen) : ''}`;
    else if (apo) titel = d.bestaetigt ? T.w_apo_best(w, land, d.apotheken) : T.w_apo(w, land, d.apotheken);
    else if (!d.beobachtet_land) titel = T.w_unbekannt(w, land);
    else titel = T.w_nicht(w, land);
    const herkunft = apo || d.herkunft === 'community' ? T.community : d.herkunft === 'reference' ? T.referenz : d.quelle ? `${T.quelle}: ${d.quelle}` : null;
    beschr = [herkunft, d.stand ? `${T.stand}: ${datum(d.stand, d.sprache)}` : null].filter(Boolean).join(' · ') || T.mehr;
    ziel = `/?land=${encodeURIComponent(d.land)}&beobachten=${encodeURIComponent(w)}`;
    // Noch nicht bestätigte Apotheken-Meldung: Der Knopf bittet um Bestätigung
    // und führt nach der Anmeldung direkt zur Meldung (dort „Bestätigen").
    if (apo && !d.bestaetigt) { d.bitte = true; ziel += '&bestaetigen=1'; }
  }
  // Persönlicher Einladungs-Code (services/einladungen.js) — vom Server geprüft.
  if (d.einladung) ziel += `&e=${encodeURIComponent(d.einladung)}`;
  const url = `${basis}${d.pfad}`;
  const bild = `${basis}${vorschaubild(d.sprache)}`;
  const cta = d.art === 'lage' ? T.cta_lage : d.bitte ? T.cta_bestaetigen(d.wirkstoff) : T.cta_w(d.wirkstoff);
  return `<!DOCTYPE html>
<html lang="${esc(d.sprache)}" dir="${richtung(d.sprache)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} · ApoPulse</title>
<meta name="description" content="${esc(beschr)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ApoPulse">
<meta property="og:title" content="${esc(titel)}"><meta property="og:description" content="${esc(beschr)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(bild)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="robots" content="noindex">
<link rel="icon" type="image/png" href="/icon-192.png">
<style>
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;color:#0f1419;}
.k{max-width:560px;margin:40px auto;padding:0 16px}.c{background:#fff;border:1px solid #e1e5e8;border-radius:16px;padding:24px}
.m{display:flex;align-items:center;gap:10px;font-weight:800;color:#0b7f28;font-size:20px;margin-bottom:18px}
h1{font-size:24px;line-height:1.25;margin:0 0 10px}p{color:#536471;font-size:16px;line-height:1.5;margin:0 0 18px}
a.b{display:block;text-align:center;background:#0b7f28;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:15px 18px;border-radius:14px}
.s{font-size:14px;color:#536471;margin-top:14px;text-align:center}
@media (prefers-color-scheme:dark){body{background:#0f1419;color:#e7e9ea}.c{background:#16202a;border-color:#2f3b45}p,.s{color:#9aa8b4}.m{color:#22cc5c}a.b{background:#22cc5c;color:#04170a}}
</style></head>
<body><div class="k"><div class="c">
<div class="m"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lgt1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5562"/><stop offset="1" stop-color="#1d242d"/></linearGradient><mask id="lmt1"><rect width="32" height="32" fill="#fff"/><path d="M4 16.2h7.2l2.2-4.4 3.4 8.6 2.2-4.2H28" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><path d="M11.5 3h9a1 1 0 0 1 1 1v7.5H29a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7.5V28a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7.5V4a1 1 0 0 1 1-1z" fill="url(#lgt1)" mask="url(#lmt1)"/></svg>ApoPulse</div>
<h1>${esc(flagge(d.land))} ${esc(titel)}</h1>
<p>${esc(beschr)}</p>
<a class="b" href="${esc(ziel)}">${esc(cta)}</a>
<div class="s">${esc(T.mehr)}</div>
</div></div></body></html>`;
}

export const TEILSEITE_SPRACHEN = Object.keys(TEXTE);
