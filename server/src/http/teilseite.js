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
    quelle: 'Quelle', community: 'gemeldet aus Apotheken, nicht amtlich', referenz: 'Referenzdaten', stand: 'Stand',
    cta_w: (w) => `Kostenlos benachrichtigt werden, wenn sich bei ${w} etwas ändert`,
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
    quelle: 'Source', community: 'reported by pharmacies, not official', referenz: 'reference data', stand: 'As of',
    cta_w: (w) => `Get notified for free when anything changes for ${w}`,
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
    quelle: 'Fonte', community: 'comunicado por farmácias, não oficial', referenz: 'dados de referência', stand: 'Atualizado',
    cta_w: (w) => `Receber aviso grátis quando algo mudar em ${w}`,
    cta_lage: 'Ver todas as ruturas com fonte — grátis', mehr: 'No ApoPulse: histórico, situação no estrangeiro, verificar a sua lista.',
    marke: 'ApoPulse — ruturas de medicamentos com fonte',
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
    titel = !d.daten ? T.lage_ohne(land) : d.offen === 1 ? T.lage_titel_1(land) : T.lage_titel(d.offen, land);
    beschr = d.daten ? T.lage_beschr(d.neu, (d.quellen || []).join(', ') || '—') : T.mehr;
    ziel = `/?land=${encodeURIComponent(d.land)}`;
  } else {
    const w = d.wirkstoff;
    if (!d.beobachtet_land && !d.knapp) titel = T.w_unbekannt(w, land);
    else if (d.knapp) titel = `${T.w_knapp(w, land)}${d.seit_tagen != null ? ' ' + T.w_seit(d.seit_tagen) : ''}`;
    else titel = T.w_nicht(w, land);
    const herkunft = d.herkunft === 'community' ? T.community : d.herkunft === 'reference' ? T.referenz : d.quelle ? `${T.quelle}: ${d.quelle}` : null;
    beschr = [herkunft, d.stand ? `${T.stand}: ${datum(d.stand, d.sprache)}` : null].filter(Boolean).join(' · ') || T.mehr;
    ziel = `/?land=${encodeURIComponent(d.land)}&beobachten=${encodeURIComponent(w)}`;
  }
  const url = `${basis}${d.pfad}`;
  const bild = `${basis}/og-bild.png`;
  const cta = d.art === 'lage' ? T.cta_lage : T.cta_w(d.wirkstoff);
  return `<!DOCTYPE html>
<html lang="${esc(d.sprache)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
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
<div class="m"><svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="#0b7f28"/><path d="M13 6.2v13.6M6.2 13h13.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>ApoPulse</div>
<h1>${esc(flagge(d.land))} ${esc(titel)}</h1>
<p>${esc(beschr)}</p>
<a class="b" href="${esc(ziel)}">${esc(cta)}</a>
<div class="s">${esc(T.mehr)}</div>
</div></div></body></html>`;
}

export const TEILSEITE_SPRACHEN = Object.keys(TEXTE);
