// ── Schriftgröße (Barrierefreiheit): Normal / Groß / Sehr groß, gespeichert ──
const FONT_STEPS = [16, 19, 22];
const FONT_LABELS = ['A', 'A⁺', 'A⁺⁺'];
function applyFontScale() {
  const lvl = Math.max(0, Math.min(2, parseInt(localStorage.getItem('apo_fontscale') || '0', 10) || 0));
  document.body.style.fontSize = FONT_STEPS[lvl] + 'px';
  // Große Schrift markieren, damit das Layout darauf reagieren kann (sonst Querscroll:
  // z.B. Kopf-Beschriftungen passen dann nicht mehr — a11y-Vorgabe „gut lesbar").
  document.body.setAttribute('data-fontscale', String(lvl));
  const btn = document.getElementById('btnFont');
  const ic = document.getElementById('fontIcon');
  if (ic) ic.textContent = FONT_LABELS[lvl];
  if (btn) btn.title = t('font_scale_label') + ': ' + t('font_sz_' + lvl) + ' — ' + t('font_toggle_hint');
}
// ── Hell/Dunkel-Modus (augenschonend). Ohne eigene Wahl: OS-Einstellung
// (prefers-color-scheme) respektieren; eine manuelle Wahl hat Vorrang. ──
function prefersDarkOS() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function applyTheme() {
  const saved = localStorage.getItem('apo_theme');
  const dark = saved ? saved === 'dark' : prefersDarkOS();
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('btnTheme');
  const ic = document.getElementById('themeIcon');
  const lbl = document.getElementById('themeLabel');
  if (ic) ic.textContent = dark ? '☀️' : '🌙';
  if (lbl) lbl.textContent = dark ? t('theme_light') : t('theme_dark');
  if (btn) btn.title = dark ? t('theme_to_light') : t('theme_to_dark');
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', dark ? '#14181a' : '#0b7f28');
}
// Die Sprachtexte stehen in public/i18n.js — dort auch die Begründung.
// Sie wird in index.html VOR dieser Datei geladen; `I18N` ist dadurch hier
// sichtbar (gemeinsamer globaler Bindungsbereich klassischer Skripte).
const SUPPORTED_LOCALES = ['de','en','pt'];
let LOCALE = (() => { const s = localStorage.getItem('apo_locale'); return SUPPORTED_LOCALES.includes(s) ? s : 'de'; })();
// <html lang> beim Laden mit der aktiven Sprache synchronisieren (statisch „de"),
// damit Screenreader engl./pt. Inhalte nicht deutsch aussprechen.
document.documentElement.setAttribute('lang', LOCALE);
const t = (key) => (I18N[LOCALE] && I18N[LOCALE][key]) || I18N.de[key] || key;
function setLocale(l) {
  LOCALE = SUPPORTED_LOCALES.includes(l) ? l : 'de';
  localStorage.setItem('apo_locale', LOCALE);
  document.documentElement.setAttribute('lang', LOCALE);
}
// ── Regionale Schreibweise: Sprache allein genügt nicht ─────────────────────
// Bisher lieferte t('_bcp47') für JEDES englischsprachige Land „en-GB". In den
// USA heißt 03/04/2026 aber März, in Großbritannien April. Bei einem
// Engpass-Meldedatum ist das keine Kosmetik, sondern eine Fehlinformation.
// Deshalb hängt das Format am LAND der Ansicht, nicht nur an der Sprache.
const REGIONAL_TAGS = {
  AT:'de-AT', DE:'de-DE', CH:'de-CH', LI:'de-CH',
  GB:'en-GB', US:'en-US', CA:'en-CA', AU:'en-AU', ZA:'en-ZA', NG:'en-NG', KE:'en-KE', GH:'en-GH',
  PT:'pt-PT', BR:'pt-BR', AO:'pt-AO', MZ:'pt-MZ',
};
// Wichtig: nur übernehmen, wenn die Kennung zur AKTIVEN SPRACHE passt. Wer
// bewusst auf Deutsch bleibt und die US-Ansicht öffnet, will weiterhin
// deutsche Datums- und Zahlenschreibweise sehen — nicht plötzlich 12/31/2026.
function bcp47() {
  const tag = REGIONAL_TAGS[typeof viewCountry === 'function' ? viewCountry() : 'AT'];
  return (tag && tag.indexOf(LOCALE + '-') === 0) ? tag : t('_bcp47');
}

// ── Landesübliche Fachbegriffe ──────────────────────────────────────────────
// Dieselbe Sprache, anderer Amtsbegriff: In Österreich heißt es beim BASG
// „Vertriebseinschränkung", in Deutschland beim BfArM „Lieferengpass". Wer den
// falschen Begriff liest, sucht im falschen Register.
//
// Die Übersteuerung greift NUR, wenn die angezeigte Sprache die des Landes ist
// — auf Englisch heißt die österreichische Ansicht weiterhin „Shortages", denn
// „Vertriebseinschränkung" hilft dort niemandem.
//
// ⚠️ ZU PRÜFEN: Die deutschen und englischen Begriffe sind belegt (Amtsbegriffe
// der jeweiligen Behörde). Bei den portugiesischsprachigen Ländern bin ich mir
// nur bei BR („desabastecimento", vom Owner genannt) sicher; PT/AO/MZ sind
// begründete Annahmen und gehören von Fachleuten vor Ort bestätigt.
const COUNTRY_TERMS = {
  AT: { lang:'de', terms:{ nav_shortages:'📦 Vertriebseinschränkungen' } },
  DE: { lang:'de', terms:{ nav_shortages:'📦 Lieferengpässe' } },
  CH: { lang:'de', terms:{ nav_shortages:'📦 Lieferengpässe' } },
  LI: { lang:'de', terms:{ nav_shortages:'📦 Lieferengpässe' } },
  US: { lang:'en', terms:{ nav_shortages:'📦 Drug shortages' } },
  CA: { lang:'en', terms:{ nav_shortages:'📦 Drug shortages' } },
  GB: { lang:'en', terms:{ nav_shortages:'📦 Medicine supply issues' } },
  AU: { lang:'en', terms:{ nav_shortages:'📦 Medicine shortages' } },
  PT: { lang:'pt', terms:{ nav_shortages:'📦 Ruturas de abastecimento' } },
  BR: { lang:'pt', terms:{ nav_shortages:'📦 Desabastecimento' } },
  AO: { lang:'pt', terms:{ nav_shortages:'📦 Ruturas de abastecimento' } },
  MZ: { lang:'pt', terms:{ nav_shortages:'📦 Ruturas de abastecimento' } },
};
// Wie t(), aber mit landesüblichem Begriff, wenn es einen gibt.
function tc(key) {
  const c = COUNTRY_TERMS[typeof viewCountry === 'function' ? viewCountry() : 'AT'];
  if (c && c.lang === LOCALE && c.terms[key] != null) return c.terms[key];
  return t(key);
}

// Füllt alle [data-i18n]-Elemente (Textinhalt) und [data-i18n-ph] (Platzhalter).
// t() mit einfacher Platzhalter-Ersetzung: ti('key', {land:'…'}) -> {land} wird ersetzt.
function ti(key, vars) {
  let s = t(key);
  if (vars) for (const k in vars) s = s.split('{'+k+'}').join(vars[k]);
  return s;
}
// Geld-Anzeige mit locale-korrektem Dezimaltrennzeichen (de/pt: Komma, en: Punkt),
// 2 Nachkommastellen, ohne Tausender-Trenner (vorhersagbar wie bisher). Das €-Symbol
// bleibt bewusst als Präfix („€ 1,34") — Reihenfolge zu ändern wäre ein separater Schritt.
function fmtMoney(v) { const s = Number(v).toFixed(2); return LOCALE === 'en' ? s : s.replace('.', ','); }
// Betrag MIT Währung. Ersetzt das früher fest angehängte „€": Die Plattform
// rechnet in 16 Ländern mit CHF, USD, AOA, NGN … — ein hartkodiertes Symbol
// war schlicht falsch, sobald jemand das Land wechselt.
// Bei Währungen ohne Nachkommastellen im Handel (AOA, KES, NGN) wird gerundet,
// sonst stehen dort Cent-Beträge, die niemand nennt.
function fmtCurrency(v, currency) {
  const n = Number(v);
  if (!isFinite(n) || !currency) return fmtMoney(v);
  const big = ['AOA', 'NGN', 'KES', 'MZN'].includes(currency) && Math.abs(n) >= 100;
  try {
    return new Intl.NumberFormat(bcp47(), {
      style: 'currency', currency,
      minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : 2,
    }).format(n);
  } catch { return fmtMoney(n) + ' ' + currency; } // unbekannter Code: roh statt Absturz
}
// Kommentar-Button-Beschriftung: 0 -> einladende Handlungsaufforderung („Kommentieren"),
// 1 -> korrekter Singular („1 Kommentar", nicht „1 Kommentare"), sonst Plural.
function commentLabel(n) {
  return n === 0 ? t('pc_comment_cta') : n === 1 ? t('pc_comments_one') : ti('pc_comments', { n });
}
// Engpass-Diskussions-Button: 0 -> „Noch keine Beiträge" (statt „0 … haben gepostet"),
// 1 -> Singular, sonst Plural. Zählt Beiträge (genauer als „Apotheker", da ggf. dieselbe Person).
function shortagePostsLabel(n) {
  return n === 0 ? t('sc_posts_zero') : n === 1 ? t('sc_posts_one') : ti('sc_posts_many', { n });
}
// Generischer Singular/Plural-Zähler: n===1 nutzt oneKey, sonst manyKey ({n} wird ersetzt).
// Vermeidet Grammatikfehler wie „1 Beiträge" quer durch die App.
function nlabel(n, oneKey, manyKey) {
  return n === 1 ? ti(oneKey, { n }) : ti(manyKey, { n });
}
function applyI18n(root) {
  const scope = root || document;
  // tc() statt t(): landesüblicher Amtsbegriff, wo es einen gibt (AT
  // „Vertriebseinschränkung" vs. DE „Lieferengpass"). Ohne Übersteuerung ist
  // tc() identisch mit t(), die übrigen 1375 Schlüssel bleiben unberührt.
  scope.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = tc(n.getAttribute('data-i18n')); });
  scope.querySelectorAll('[data-i18n-ph]').forEach(n => { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
  scope.querySelectorAll('[data-i18n-title]').forEach(n => { n.setAttribute('title', t(n.getAttribute('data-i18n-title'))); });
  // aria-label mehrsprachig: Icon-Buttons (auf Mobil ohne sichtbares Label) für Screenreader
  scope.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
  // alt-Text mehrsprachig: Bildvorschauen brauchen einen Alt-Text (Screenreader/Bild-aus).
  scope.querySelectorAll('[data-i18n-alt]').forEach(n => { n.setAttribute('alt', t(n.getAttribute('data-i18n-alt'))); });
}
const api = async (method, path, body) => {
  const tok = localStorage.getItem('apo_token');
  let r;
  try {
    r = await fetch(path, {
      method,
      headers: { 'Content-Type':'application/json', ...(tok ? { Authorization:'Bearer '+tok } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    // fetch wirft nur bei Netzwerk-/Verbindungsfehlern (offline, Server weg) — statt eines
    // technischen „Failed to fetch" eine freundliche, lokalisierte Meldung zeigen.
    const err = new Error(t('e_network')); err.code = 'network'; throw err;
  }
  const data = await r.json().catch(()=>({}));
  if (!r.ok) {
    // Abgelaufene/ungültige Sitzung: Token verwerfen und sauber zum Login-/Länder-Screen —
    // statt die Nutzer:in mit „Nicht angemeldet"-Fehlern an jeder Aktion hängen zu lassen.
    if (data.code === 'not_authenticated' && localStorage.getItem('apo_token')) {
      localStorage.removeItem('apo_token');
      (_hasCountry() ? authScreen() : countryScreen());
      throw new Error(t('e_network')); // stoppt die weitere Verarbeitung beim Aufrufer
    }
    // Fehler-Code (falls vorhanden) übersetzen — sonst die (deutsche) Server-message.
    // So werden alle e.message-Anzeigestellen automatisch mehrsprachig.
    const translated = data.code && I18N[LOCALE] && I18N[LOCALE]['e_'+data.code];
    const err = new Error(translated || data.error || ('Fehler '+r.status));
    err.code = data.code;
    throw err;
  }
  return data;
};
const el = (h) => { const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.childElementCount===1 ? t.content.firstElementChild : t.content; };
const esc = (s) => String(s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Website-Link lesbar kürzen: ohne Protokoll und ohne trailing slash (z.B. „apopulse.at").
const prettyUrl = (u) => String(u||'').replace(/^https?:\/\//i,'').replace(/\/$/,'');
// Profilstärke (wie bei LinkedIn): welche Bausteine sind ausgefüllt? Nur zur eigenen
// Motivation gedacht — zeigt Prozent + was noch fehlt.
function profileCompleteness(p) {
  const items = [
    { key: 'photo', label: t('pfc_photo'), done: !!p.avatar_url },
    { key: 'cover', label: t('pfc_cover'), done: !!p.cover_url },
    { key: 'title', label: t('pfc_title'), done: !!(p.title && p.title.trim()) },
    { key: 'bio', label: t('pfc_bio'), done: !!(p.bio && p.bio.trim()) },
    { key: 'specs', label: t('pfc_specs'), done: !!(p.specializations && p.specializations.length) },
    { key: 'experience', label: t('pfc_experience'), done: !!(p.experience && p.experience.length) },
    { key: 'website', label: t('pfc_website'), done: !!p.website },
    { key: 'region', label: t('pfc_region'), done: !!p.bundesland },
  ];
  const done = items.filter(i => i.done).length;
  return { pct: Math.round((done / items.length) * 100), done, total: items.length, items };
}
// Kopfzeile: eigenes Profil als anklickbare Mini-Kachel (Foto + Handle) rendern.
function renderWhoami() {
  const w = document.getElementById('whoami');
  if (!w) return;
  if (!me) { w.innerHTML = ''; w.classList.remove('clickable'); w.removeAttribute('role'); w.removeAttribute('tabindex'); w.onclick = null; w.onkeydown = null; return; }
  w.innerHTML = avatarHtml(me, 26, false) + '<span>@' + esc(me.handle) + '</span>';
  w.classList.add('clickable');
  w.setAttribute('role', 'button'); w.setAttribute('tabindex', '0');
  w.setAttribute('title', t('hdr_myprofile')); w.setAttribute('aria-label', t('hdr_myprofile'));
  const go = () => openProfile(me.handle);
  w.onclick = go;
  w.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
}
// Relative Zeit in Klartext (Owner-Vorgabe: keine kryptischen Kürzel).
// Bild lokal verkleinern (max. Kante ~1200px, JPEG) -> kleine data-URL, spart Speicher/Upload.
function fileToDataUrl(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error(t('img_err_pick')));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('img_err_read')));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(t('img_err_invalid')));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale); height = Math.round(height * scale);
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// @-Autovervollständigung an ein Text-/Eingabefeld hängen (schlägt Handles vor).
// Weicher Zeichenzähler: erscheint erst nahe der Grenze (nicht ablenkend), wird rot,
// wenn die Grenze überschritten ist. Der Server erzwingt die Grenze weiterhin.
function attachCharCounter(input, max) {
  if (!input) return;
  const warnAt = Math.floor(max * 0.8);
  const counter = el('<div class="char-counter muted" aria-live="polite"></div>');
  input.insertAdjacentElement('afterend', counter);
  const update = () => {
    const len = input.value.length;
    const left = max - len;
    if (len < warnAt) { counter.textContent = ''; counter.classList.remove('over'); return; }
    counter.classList.toggle('over', left < 0);
    counter.textContent = left < 0 ? ti('cc_over', { n: -left }) : ti('cc_remaining', { n: left });
  };
  input.addEventListener('input', update);
  update();
}
function attachMentionAutocomplete(ta) {
  let box = null;
  const close = () => { if (box) { box.remove(); box = null; } };
  ta.addEventListener('input', async () => {
    const pos = ta.selectionStart;
    const m = ta.value.slice(0, pos).match(/(^|[^\w@])@([a-z0-9_]{1,30})$/i);
    if (!m) { close(); return; }
    const token = m[2];
    let handles;
    try { handles = (await api('GET','/api/handles?q='+encodeURIComponent(token))).handles; } catch { return; }
    if (ta.selectionStart !== pos) return; // Caret hat sich bewegt
    close();
    if (!handles.length) return;
    box = el('<div class="mention-ac"></div>');
    handles.forEach(h => {
      const item = el(`<div class="mention-ac-item"><b>@${esc(h.handle)}</b> <span class="muted">${esc(h.display_name||'')}</span>${h.verified?' <span class="verified">✔</span>':''}</div>`);
      item.onmousedown = (e) => {
        e.preventDefault();
        const start = pos - token.length - 1; // Position des '@'
        ta.value = ta.value.slice(0, start) + '@' + h.handle + ' ' + ta.value.slice(pos);
        const caret = start + h.handle.length + 2;
        ta.setSelectionRange(caret, caret); close(); ta.focus();
      };
      box.appendChild(item);
    });
    ta.after(box);
  });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  ta.addEventListener('blur', () => setTimeout(close, 150));
}
const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return t('rt_now');
  if (diff < 5400) { const m = Math.round(diff/60); return m===1 ? t('rt_min_one') : ti('rt_min_many',{n:m}); }
  if (diff < 79200) { const h = Math.round(diff/3600); return h===1 ? t('rt_hour_one') : ti('rt_hour_many',{n:h}); }
  const days = Math.round(diff/86400);
  if (days < 7) return days===1 ? t('rt_day_one') : ti('rt_day_many',{n:days});
  return d.toLocaleDateString(bcp47(), { day:'2-digit', month:'2-digit', year:'numeric' });
};
// Kalendertag (YYYY-MM-DD) im Datumsformat der aktiven Sprache; bei ungültiger Eingabe Rohtext.
const fmtDateDe = (ymd) => {
  const ts = Date.parse(String(ymd || '') + 'T00:00:00Z');
  if (Number.isNaN(ts)) return String(ymd || '');
  return new Date(ts).toLocaleDateString(bcp47(), { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
};
// Für den Browser-Audit erreichbar machen: Der Test soll die ECHTE Funktion
// prüfen, nicht eine Nachbildung — sonst prüft er seine eigene Kopie.
window.__fmtDateDe = (ymd) => fmtDateDe(ymd);
// Uhrzeit (HH:MM) eines ISO-Zeitstempels in der aktiven Sprache; ungültig -> leer.
const fmtClock = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(bcp47(), { hour:'2-digit', minute:'2-digit' }); };
// Tages-Trenner für Nachrichtenverläufe: „Heute"/„Gestern" oder das Datum.
const dayLabel = (iso) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
  const same = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  if (same(d, now)) return t('dm_today');
  if (same(d, y)) return t('dm_yesterday');
  return d.toLocaleDateString(bcp47(), { day:'2-digit', month:'2-digit', year:'numeric' });
};
// Text escapen UND @Handles + #Hashtags anklickbar machen (kein @ mitten in E-Mails).
const linkifyMentions = (s) => esc(s)
  .replace(/(^|[^\w@])@([a-z0-9_]{3,30})/gi,
    (m, pre, h) => `${pre}<span class="mention clickable" data-openprofile="${h}">@${h}</span>`)
  .replace(/(^|[^\w#])#([a-z0-9äöüß_]{2,30})/gi,
    (m, pre, t) => `${pre}<span class="hashtag clickable" data-hashtag="${t}">#${t}</span>`);
// Bild-Lightbox: Inhaltsbilder (data-zoom) in voller Größe ansehen — wichtig, um kleine
// Details wie Charge/Verfallsdatum auf Verpackungsfotos lesen zu können. Schließen per
// Klick auf den Hintergrund, ✕ oder Escape.
function openLightbox(src, alt) {
  if (!src) return;
  const ov = el(`<div class="lightbox" role="dialog" aria-modal="true" tabindex="-1" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px">
    <img alt="${esc(alt||'')}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px">
    <button class="lightbox-close" aria-label="${esc(t('lb_close'))}" title="${esc(t('lb_close'))}" style="position:absolute;top:12px;right:12px;font-size:22px;line-height:1;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:999px;width:42px;height:42px;cursor:pointer">✕</button>
  </div>`);
  ov.querySelector('img').src = src; // src per Property setzen (auch große data:-URLs sicher)
  const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  ov.onclick = (e) => { if (e.target === ov || (e.target.closest && e.target.closest('.lightbox-close'))) close(); };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  ov.focus();
}
// Delegation (Capture-Phase): Klick auf ein Inhaltsbild mit data-zoom öffnet die Lightbox.
// Capture + stopPropagation verhindert, dass ein klickbares Eltern-Element (z.B. Angebots-Karte
// oder Repost-Einbettung) zusätzlich navigiert — sonst öffnete der Klick beides.
document.addEventListener('click', (e) => {
  const img = e.target && e.target.closest && e.target.closest('img[data-zoom]');
  if (img) { e.preventDefault(); e.stopPropagation(); openLightbox(img.getAttribute('src') || img.src, img.getAttribute('alt')); }
}, true);
const app = document.getElementById('app');
let me = null, tab = 'overview', iAmModerator = false, publicSort = 'neu', publicFilter = 'all';
// Rechtsstatus der Module im aktiven Land (aus /api/country-config): feature_id → 'blocked'|'restricted'.
// Steuert Reiter-Sichtbarkeit + rechtliche Hinweise. Standard leer = alles erlaubt.
let COUNTRY_FEAT = {};
let COUNTRY_NAME = '';
const FEATURE_TAB = { deals: 'rabatte', stock_exchange: 'exchange', price_compare: 'prices' };
const TAB_FEATURE = { rabatte: 'deals', exchange: 'stock_exchange', prices: 'price_compare' };
function featBlocked(featureId) { return COUNTRY_FEAT[featureId] === 'blocked'; }
function featReason(featureId) { return (COUNTRY_FEAT[featureId + '__reason']) || null; }
// Rechtlicher Hinweis (Karte) für ein Modul; null wenn erlaubt. status='blocked' → Sperr-Karte.
function legalNotice(featureId) {
  const status = COUNTRY_FEAT[featureId];
  if (status !== 'restricted' && status !== 'blocked') return null;
  const reason = featReason(featureId);
  const msg = reason ? ti('legal_' + reason, { country: COUNTRY_NAME || t('legal_your_country') }) : '';
  const blocked = status === 'blocked';
  return el(`<div class="card" style="border-left:4px solid ${blocked ? 'var(--crit-fg)' : 'var(--warn-fg)'};background:${blocked ? 'var(--crit-bg)' : 'var(--warn-bg)'}">
    <div class="row"><b>⚖️ ${esc(blocked ? ti('legal_blocked_title', { country: COUNTRY_NAME }) : t('legal_notice_title'))}</b></div>
    <div style="font-size:14px;margin-top:4px">${esc(msg)}</div>
    <div class="muted" style="font-size:12px;margin-top:6px">${esc(t('legal_disclaimer'))}</div>
  </div>`);
}
// Aktiver Länder-Kontext („Land = Sicht"): temporäre Besuchs-Ansicht, die das HEIMATLAND
// (me.country) NICHT verändert. null = eigenes Land. Der Switcher setzt nur diese Variable;
// länder-gescopte Fetches hängen sie an. So bleibt der Account gleich, nur die Inhalte wechseln.
let ACTIVE_COUNTRY = null;
const viewCountry = () => ACTIVE_COUNTRY || (me && me.country) || 'AT';
let shortageFilter = ''; // '', 'kritisch', 'watched', 'community'
let shortageQuery = '';  // Textsuche nach Wirkstoff/Präparat
let shortageSort = 'kritisch'; // 'kritisch' (kritischste zuerst) | 'neu' (neueste zuerst)
let shortageReportPrefill = null; // Wirkstoff, mit dem das Meldeformular vorbelegt/geöffnet wird (z.B. aus der Suche)
let rabattQuery = '';     // Textsuche im Rabatt-Reiter
let rabattExpiring = false; // nur bald ablaufende Aktionen
let rabattWatchedOnly = false; // nur Aktionen zu beobachteten Wirkstoffen
let rabattSort = 'pct'; // 'pct' = höchster Rabatt %, 'saving' = größte Ersparnis € (pro Mindestbestellung)
let priceQuery = '';      // Textsuche im Preise-Reiter
let priceWatchedOnly = false; // nur Preise zu beobachteten Wirkstoffen
let priceRoseOnly = false;    // nur Präparate, deren günstigster Preis zuletzt gestiegen ist
let priceSort = 'best'; // 'best' = Server-Reihenfolge, 'saving' = größte Ersparnis €, 'az' = A–Z
let myBookmarks = new Set();

// ── Auth-Flow: ERST Land wählen, DANN anmelden, dann länderspezifische Inhalte ──
function hideHeaderForAuth() {
  ['btnLogout','btnNotif','btnDm','btnCart','btnMod','btnHelp'].forEach(id => { const b = document.getElementById(id); if (b) b.classList.add('hidden'); });
  const cs = document.getElementById('countrySwitch'); if (cs) cs.classList.add('hidden');
  document.getElementById('whoami').textContent = '';
  document.getElementById('whoami').classList.remove('clickable');
  stopNewsRail();
  stopQuickRail();
  app.classList.remove('auth-mode'); // Standardbreite; authScreen setzt sie danach gezielt wieder
}
function currentAuthCountry() {
  const c = (localStorage.getItem('apo_country') || '').toUpperCase();
  return (COUNTRIES_CACHE || []).find(x => x.code === c) || null;
}
// Wert eines Schlüssels in den ANDEREN beiden Sprachen — für den Länderauswahl-Screen,
// der VOR der Sprachwahl steht und daher mehrsprachig einladen soll.
function csOtherLangs(key) {
  return SUPPORTED_LOCALES.filter(l => l !== LOCALE).map(l => (I18N[l] || {})[key]).filter(Boolean).join(' · ');
}
// Schritt 1: Länderauswahl. Setzt Land + Sprache (folgt dem Land) und geht zum Login.
async function countryScreen() {
  setDocTitle('');
  hideHeaderForAuth();
  app.innerHTML = '';
  await ensureCountries();
  const countries = COUNTRIES_CACHE || [];
  const card = el(`<div class="card" style="text-align:center">
    <div style="display:flex;justify-content:center;margin-bottom:8px"><svg width="54" height="54" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--green)"/><path d="M13 6.2v13.6M6.2 13h13.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></div>
    <h1 style="margin:.2em 0">${esc(t('cs_title'))}</h1>
    <div class="muted" style="font-size:.95em">${esc(csOtherLangs('cs_title'))}</div>
    <div class="muted" style="margin-top:6px">${esc(t('cs_sub'))}</div>
    <div class="country-grid">
      ${countries.map(c => `<button class="country-pick" data-country="${esc(c.code)}" lang="${esc(c.locale_default)}"><span class="flag" aria-hidden="true">${esc(c.flag)}</span> ${esc(c.name)}</button>`).join('')}
    </div>
  </div>`);
  app.appendChild(card);
  app.querySelectorAll('[data-country]').forEach(btn => btn.onclick = () => {
    const code = btn.dataset.country;
    const c = countries.find(x => x.code === code);
    localStorage.setItem('apo_country', code);
    if (c && c.locale_default) { setLocale(c.locale_default); applyI18n(); applyTheme(); applyFontScale(); }
    authScreen();
  });
}
// Schritt 2: Login/Registrierung — für das in Schritt 1 gewählte Land (Sprache folgt).
function authScreen() {
  setDocTitle('');
  hideHeaderForAuth();
  app.innerHTML = '';
  app.classList.add('auth-mode'); // breitere Landing-Ansicht (Wert links, Formulare rechts)
  const ac = currentAuthCountry();
  // Gewähltes Land oben + „Land ändern" (zurück zu Schritt 1).
  app.appendChild(el(`
  <div class="row" style="justify-content:center;gap:10px;margin-bottom:6px;align-items:center">
    <span>${ac ? `<span aria-hidden="true" style="font-size:1.2em">${esc(ac.flag)}</span> <b>${esc(ac.name)}</b>` : ''}</span>
    <button class="ghost small" id="changeCountry">${esc(t('cs_change'))}</button>
  </div>`));
  app.appendChild(el(`
  <div class="auth-grid">
    <div class="card auth-hero">
      <div class="auth-hero-brand">➕ ApoPulse</div>
      <div class="auth-hero-title">${esc(t('au_hero_title'))}</div>
      <div class="auth-hero-sub">${esc(t('au_hero_sub'))}</div>
      <ul class="auth-hero-list">
        <li>${esc(t('au_hero_1'))}</li>
        <li>${esc(t('au_hero_2'))}</li>
        <li>${esc(t('au_hero_3'))}</li>
        <li>${esc(t('au_hero_4'))}</li>
      </ul>
    </div>
    <div class="auth-forms">
      <div class="card">
        <h1>${esc(t('au_login'))}</h1>
        <label for="li_email">${esc(t('au_email'))}</label><input id="li_email" type="email" placeholder="${esc(t('au_email_ph'))}">
        <label for="li_pw">${esc(t('au_pw'))}</label><input id="li_pw" type="password" placeholder="${esc(t('au_pw'))}">
        <div style="margin-top:12px"><button id="li_go">${esc(t('au_login'))}</button></div>
        <div style="margin-top:8px"><button class="linklike small" id="li_forgot">${esc(t('au_forgot'))}</button></div>
        <div id="oauthBtns"></div>
        <div class="err" id="li_err"></div>
      </div>
      <div class="card">
        <h1>${esc(t('au_register'))}</h1>
        <div id="rg_durability" class="err" hidden></div>
        <label for="rg_name">${esc(t('au_name'))}</label><input id="rg_name" placeholder="Dr. Anna Huber">
        <label for="rg_handle">${esc(t('au_handle'))}</label><input id="rg_handle" placeholder="anna_huber">
        <label for="rg_email">${esc(t('au_email'))}</label><input id="rg_email" type="email" placeholder="${esc(t('au_email_ph'))}">
        <label for="rg_pw">${esc(t('au_pw8'))}</label><input id="rg_pw" type="password">
        <label for="rg_country">${esc(t('au_country'))}</label><select id="rg_country"></select>
        <label for="rg_accounttype">${esc(t('at_label'))}</label><select id="rg_accounttype"></select>
        <div style="margin-top:12px"><button id="rg_go">${esc(t('au_create'))}</button></div>
        <div class="err" id="rg_err"></div>
      </div>
    </div>
  </div>`));

  // Warnung, wenn dieser Server Konten nicht dauerhaft speichert.
  //
  // Bewusst NICHT blockierend: Der Betreiber kann bewusst so betreiben wollen
  // (Vorführung, Testlauf). Aber wer sich hier ein Passwort anlegt, muss es
  // vorher wissen — bisher stand die Warnung nur im Server-Protokoll, das
  // ausgerechnet die betroffene Person nie zu sehen bekommt.
  //
  // Fehlschlagen darf die Prüfung ohne Folgen: Ist die Auskunft nicht zu
  // holen, wird nichts behauptet. Eine Warnung zu erfinden, weil eine Abfrage
  // scheiterte, wäre derselbe Fehler in die andere Richtung.
  fetch('/api/health').then((r) => r.json()).then((h) => {
    if (!h || h.durability === 'sicher') return;
    const box = document.getElementById('rg_durability');
    if (!box) return;
    box.textContent = t('au_durability_warn');
    box.hidden = false;
  }).catch(() => {});

  // „Land ändern" -> zurück zur Länderauswahl (Schritt 1).
  const cc = document.getElementById('changeCountry');
  if (cc) cc.onclick = () => countryScreen();
  document.getElementById('li_go').onclick = async () => {
    try {
      const d = await api('POST','/api/login',{ email:v('li_email'), password:v('li_pw') });
      afterAuth(d);
    } catch(e){ document.getElementById('li_err').textContent = e.message; }
  };
  document.getElementById('rg_go').onclick = async () => {
    try {
      const d = await api('POST','/api/register',{ name:v('rg_name'), handle:v('rg_handle'), email:v('rg_email'), password:v('rg_pw'), country:v('rg_country'), accountType:v('rg_accounttype') });
      // Wiederherstellungscodes einmalig zeigen (zum Sichern), dann in die App.
      if (Array.isArray(d.recovery_codes) && d.recovery_codes.length) recoveryCodesScreen(d.recovery_codes, () => afterAuth(d));
      else afterAuth(d);
    } catch(e){ document.getElementById('rg_err').textContent = e.message; }
  };
  const forgot = document.getElementById('li_forgot');
  if (forgot) forgot.onclick = () => resetScreen();
  // Social-Login-Buttons nur zeigen, wenn ein Anbieter serverseitig konfiguriert ist
  // (sonst bleibt der Bereich leer — kein toter „Anmelden mit …"-Button).
  renderOAuthButtons();
  // Länderauswahl bei der Registrierung: das in Schritt 1 gewählte Land ist vorausgewählt
  // (Feed-Inhalte + Sprache folgen dem Land). Änderbar, falls doch ein anderes Land gewünscht.
  ensureCountries().then(() => {
    const sel = document.getElementById('rg_country');
    if (sel) sel.innerHTML = countryOptionsHtml((localStorage.getItem('apo_country') || (me && me.country) || 'AT'));
  });
  // Kontotyp-Auswahl befüllen (Apotheke als Vorauswahl).
  ensureAccountTypes().then(() => {
    const sel = document.getElementById('rg_accounttype');
    if (sel) sel.innerHTML = accountTypeOptionsHtml('pharmacy');
  });
}
const v = (id) => document.getElementById(id).value.trim();

function afterAuth(d) {
  localStorage.setItem('apo_token', d.token);
  me = d.profile || d.user;
  mainScreen();
}

// Wiederherstellungscodes einmalig anzeigen (nach Registrierung oder Neu-Erzeugung).
// onDone wird beim „Weiter" aufgerufen. codesOnly=true nur anzeigen (kein App-Wechsel).
function recoveryCodesScreen(codes, onDone) {
  setDocTitle(t('rc_title'));
  hideHeaderForAuth();
  app.innerHTML = '';
  const list = codes.map(c => `<li><code>${esc(c)}</code></li>`).join('');
  const card = el(`<div class="card" style="max-width:520px;margin:0 auto">
    <h1>${esc(t('rc_title'))}</h1>
    <div class="muted" style="margin-top:4px">${esc(t('rc_intro'))}</div>
    <ol class="recovery-codes" style="margin-top:12px">${list}</ol>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="ghost small" id="rc_copy">${esc(t('rc_copy'))}</button>
      <button class="ghost small" id="rc_dl">${esc(t('rc_download'))}</button>
      <span id="rc_msg" class="muted" style="margin-left:4px"></span>
    </div>
    <div style="margin-top:16px"><button id="rc_done">${esc(t('rc_saved_cta'))}</button></div>
  </div>`);
  app.appendChild(card);
  const text = codes.join('\n');
  card.querySelector('#rc_copy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); card.querySelector('#rc_msg').textContent = t('rc_copied'); }
    catch { /* Clipboard nicht verfügbar — Download bleibt als Fallback */ }
  };
  card.querySelector('#rc_dl').onclick = () => {
    const blob = new Blob([text + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'apopulse-wiederherstellungscodes.txt'; link.click();
    URL.revokeObjectURL(url);
  };
  card.querySelector('#rc_done').onclick = () => { if (typeof onDone === 'function') onDone(); };
}

// „Passwort vergessen" — Reset per Wiederherstellungscode (kein E-Mail-Dienst nötig).
function resetScreen() {
  setDocTitle(t('rs_title'));
  hideHeaderForAuth();
  app.innerHTML = '';
  const card = el(`<div class="card" style="max-width:520px;margin:0 auto">
    <h1>${esc(t('rs_title'))}</h1>
    <div class="muted" style="margin-top:4px">${esc(t('rs_intro'))}</div>
    <label for="rs_email" style="margin-top:10px">${esc(t('au_email'))}</label><input id="rs_email" type="email" placeholder="${esc(t('au_email_ph'))}">
    <label for="rs_code">${esc(t('rs_code'))}</label><input id="rs_code" placeholder="AB2CD-EF3GH" autocomplete="off">
    <label for="rs_pw">${esc(t('rs_newpw'))}</label><input id="rs_pw" type="password">
    <div class="row" style="margin-top:12px;gap:8px"><button id="rs_go">${esc(t('rs_go'))}</button>
      <button class="linklike small" id="rs_back">${esc(t('rs_back'))}</button></div>
    <div id="rs_msg" style="margin-top:8px"></div>
  </div>`);
  app.appendChild(card);
  card.querySelector('#rs_back').onclick = () => authScreen();
  card.querySelector('#rs_go').onclick = async () => {
    const msg = card.querySelector('#rs_msg');
    try {
      await api('POST', '/api/password/reset', { email: v('rs_email'), code: v('rs_code'), newPassword: document.getElementById('rs_pw').value });
      msg.style.color = 'var(--green)'; msg.textContent = t('rs_success');
      card.querySelector('#rs_go').disabled = true;
    } catch (e) { msg.style.color = 'var(--crit-fg)'; msg.textContent = e.message; }
  };
}

// Einheitliches Redirect-Ziel für OAuth (der Provider wird über `state` transportiert).
const oauthRedirectUri = () => location.origin + location.pathname;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// „Anmelden mit …"-Buttons — nur, wenn der Server einen Provider konfiguriert hat.
async function renderOAuthButtons() {
  const host = document.getElementById('oauthBtns');
  if (!host) return;
  try {
    const d = await api('GET', '/api/auth/providers?redirect_uri=' + encodeURIComponent(oauthRedirectUri()));
    const provs = ((d && d.providers) || []).filter(p => p.authorize_url);
    if (!provs.length) return; // kein Provider aktiv -> nichts anzeigen
    host.innerHTML = `<div class="muted" style="text-align:center;margin:10px 0 6px">${esc(t('au_or'))}</div>`;
    provs.forEach(p => {
      const btn = el(`<button class="ghost" style="width:100%;margin-top:8px">${esc(ti('au_oauth_with', { p: capitalize(p.provider) }))}</button>`);
      btn.onclick = () => { location.href = p.authorize_url; };
      host.appendChild(btn);
    });
  } catch { /* Providerliste nicht abrufbar -> stillschweigend ohne Social-Login */ }
}

// OAuth-Rückleitung verarbeiten: ?code=…&state=<provider> -> Konto anmelden/anlegen.
async function handleOAuthCallback() {
  const params = new URLSearchParams(location.search);
  const provider = params.get('state');
  const code = params.get('code');
  if (!provider || !code) return false;
  try {
    const d = await api('POST', '/api/auth/oauth/' + encodeURIComponent(provider), {
      code, redirectUri: oauthRedirectUri(),
      country: localStorage.getItem('apo_country') || undefined, locale: LOCALE,
    });
    history.replaceState({}, '', location.pathname); // Query-Parameter entfernen
    afterAuth(d);
    return true;
  } catch {
    history.replaceState({}, '', location.pathname);
    return false; // fällt auf den normalen Anmelde-Flow zurück
  }
}

// ── Länder-/Sprach-Umschalter (Kopfzeile) ──
// Ein Wechsel des Landes filtert die Inhalte (News/Engpässe/Preise) auf dieses
// Land und stellt die UI-Sprache automatisch auf die Landessprache um.
let COUNTRIES_CACHE = null;
async function ensureCountries() {
  if (!COUNTRIES_CACHE) { try { COUNTRIES_CACHE = (await api('GET','/api/countries')).countries; } catch { COUNTRIES_CACHE = []; } }
  return COUNTRIES_CACHE;
}
function countryOptionsHtml(selected) {
  return (COUNTRIES_CACHE || [])
    .map(c => `<option value="${esc(c.code)}"${c.code===selected?' selected':''}>${esc(c.flag)} ${esc(c.name)}</option>`)
    .join('');
}
// Kontotyp: übersetztes Label je Schlüssel (Register-Reihenfolge aus /api/account-types).
const ACCT_I18N = { pharmacy:'at_pharmacy', pharma:'at_pharma', authority:'at_authority', private:'at_private' };
function acctLabel(key) { return ACCT_I18N[key] ? t(ACCT_I18N[key]) : (key || ''); }
// „Offen für"-Optionen (Schlüssel = Backend OPEN_TO_KEYS); Label übersetzt.
const OPEN_TO = ['kooperation', 'einkauf', 'vertretung', 'austausch', 'mentoring', 'jobs'];
function openToLabel(key) { return t('ot_' + key); }
let ACCOUNT_TYPES_CACHE = null;
async function ensureAccountTypes() {
  if (!ACCOUNT_TYPES_CACHE) { try { ACCOUNT_TYPES_CACHE = (await api('GET','/api/account-types')).account_types; } catch { ACCOUNT_TYPES_CACHE = []; } }
  return ACCOUNT_TYPES_CACHE;
}
function accountTypeOptionsHtml(selected) {
  return (ACCOUNT_TYPES_CACHE || [])
    .map(a => `<option value="${esc(a.key)}"${a.key===selected?' selected':''}>${esc(acctLabel(a.key))}</option>`)
    .join('');
}
async function initCountrySwitcher() {
  const sel = document.getElementById('countrySwitch');
  if (!sel) return;
  await ensureCountries();
  if (!COUNTRIES_CACHE.length) return;
  sel.innerHTML = countryOptionsHtml(viewCountry());
  sel.classList.remove('hidden');
  // Nicht-destruktiver Länder-Wechsel: nur die BESUCHS-Ansicht wechseln, Heimatland bleibt.
  sel.onchange = () => {
    const code = sel.value;
    const home = (me && me.country) || 'AT';
    ACTIVE_COUNTRY = (code === home) ? null : code; // eigenes Land = kein „Besuch"
    const c = (COUNTRIES_CACHE || []).find(x => x.code === viewCountry());
    setLocale((c && c.locale_default) || (me && me.locale) || 'de'); // Sprache folgt der Ansicht
    applyI18n(); applyTheme(); applyFontScale();
    updateViewContext();
    loadTab(); // Inhalte des aktiven Reiters für die gewählte Länder-Ansicht neu laden
    if (newsRailTimer) { newsRailSeen = null; refreshNewsRail(); } // Livestream folgt der Länder-Ansicht
  };
  updateViewContext();
}
// Sichtbarer Hinweis, wenn man ein FREMDES Land besucht — plus 1-Klick zurück zum eigenen.
function updateViewContext() {
  let bar = document.getElementById('viewCtx');
  const home = (me && me.country) || 'AT';
  const visiting = ACTIVE_COUNTRY && ACTIVE_COUNTRY !== home;
  if (!visiting) { if (bar) bar.remove(); return; }
  const c = (COUNTRIES_CACHE || []).find(x => x.code === ACTIVE_COUNTRY);
  const hc = (COUNTRIES_CACHE || []).find(x => x.code === home);
  if (!bar) {
    bar = el('<div id="viewCtx" class="view-ctx" role="status" aria-live="polite"></div>');
    const anchor = document.getElementById('app');
    anchor.parentNode.insertBefore(bar, anchor);
  }
  bar.innerHTML = `<span>${esc(ti('vc_visiting', { flag: (c && c.flag) || '🌍', land: (c && c.name) || ACTIVE_COUNTRY }))}</span>
    <button id="vcBack" class="ghost small">${esc(ti('vc_back', { flag: (hc && hc.flag) || '🏠', land: (hc && hc.name) || home }))}</button>`;
  bar.querySelector('#vcBack').onclick = () => {
    ACTIVE_COUNTRY = null;
    const sel = document.getElementById('countrySwitch'); if (sel) sel.value = home;
    const hcc = (COUNTRIES_CACHE || []).find(x => x.code === home);
    setLocale((hcc && hcc.locale_default) || (me && me.locale) || 'de');
    applyI18n(); applyTheme(); applyFontScale(); updateViewContext(); loadTab();
    if (newsRailTimer) { newsRailSeen = null; refreshNewsRail(); }
  };
}

// Reiter programmatisch wechseln (z.B. aus dem News-Livestream heraus).
function switchTab(name) {
  const b = app.querySelector('.tabs button[data-tab="' + name + '"]');
  if (!b) return;
  app.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); setTabAria(); tab = name; loadTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Höhe der (klebrigen) Kopfzeile als CSS-Variable — damit die mobile Reiter-Leiste
// exakt darunter kleben kann (Kopf kann je nach Breite/Umbruch unterschiedlich hoch sein).
function setHeaderHeightVar() {
  const h = document.querySelector('header');
  if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
}
window.addEventListener('resize', setHeaderHeightVar);
window.addEventListener('orientationchange', setHeaderHeightVar);

// ── Haupt-Screen (Feed) ──
async function mainScreen() {
  const meData = await api('GET','/api/me');
  me = meData.profile;
  iAmModerator = !!meData.is_moderator;
  // Sprache folgt dem Land des Profils (Owner-Vorgabe: länderbasierte Plattform).
  setLocale(me && me.locale ? me.locale : 'de');
  renderWhoami();
  await ladeFeatures();
  document.getElementById('btnLogout').classList.remove('hidden');
  document.getElementById('btnNotif').classList.remove('hidden');
  if (featureAn('direktnachrichten')) document.getElementById('btnDm').classList.remove('hidden');
  const btnMod = document.getElementById('btnMod');
  btnMod.classList.toggle('hidden', !iAmModerator);
  btnMod.onclick = showModeration;
  const btnHelp = document.getElementById('btnHelp');
  btnHelp.classList.remove('hidden');
  btnHelp.onclick = () => showWelcome(true);
  document.getElementById('btnLogout').onclick = () => { localStorage.removeItem('apo_token'); location.reload(); };
  document.getElementById('btnNotif').onclick = showNotifications;
  document.getElementById('btnDm').onclick = showDmInbox;
  const btnCart = document.getElementById('btnCart');
  if (featureAn('bestellung')) btnCart.classList.remove('hidden');
  btnCart.onclick = () => openCart(); // ohne Argument: sonst landet das Klick-Event als „flash"-Text in der Liste
  refreshNotifCount();
  // Ruhende Bereiche werden gar nicht erst abgefragt: Ihre 404 landen sonst
  // als rote Fehler in der Browser-Konsole und sehen aus wie ein Defekt.
  if (featureAn('direktnachrichten')) refreshDmCount();
  if (featureAn('bestellung')) refreshCartCount();
  if (featureAn('social')) {
    try { myBookmarks = new Set((await api('GET','/api/bookmarks/ids')).ids); } catch { myBookmarks = new Set(); }
  } else { myBookmarks = new Set(); }

  app.innerHTML = '';
  app.classList.remove('auth-mode'); // Haupt-App in Standardbreite
  app.appendChild(el(`
    <div class="card" style="padding:10px 12px">
      <div class="row"><input id="sq" data-i18n-ph="search_ph" data-i18n-aria="search_go" placeholder="🔎 Suchen: Wirkstoff, Kolleg:in (@handle), Beitrag, Engpass, Preis…" aria-label="Suche"><button class="small" id="sgo" data-i18n="search_go">Suchen</button></div>
    </div>
    <div class="tabs">
      <button data-tab="overview" class="active" data-i18n="nav_overview">✨ Für dich</button>
      <button data-tab="public" data-i18n="nav_public">🌍 Öffentlich</button>
      <button data-tab="home" data-i18n="nav_home">🏠 Mein Feed</button>
      <button data-tab="shortages" data-i18n="nav_shortages">📦 Engpässe</button>
      <button data-tab="prices" data-i18n="nav_prices">💶 Preise</button>
      <button data-tab="rabatte" data-i18n="nav_rabatte">🏷️ Top-Rabatte</button>
      <button data-tab="exchange" data-i18n="nav_exchange">🔄 Biete/Suche</button>
      <button data-tab="news" data-i18n="nav_news">📰 News</button>
    </div>
    <div id="socialCompose" style="display:none">
      <div class="card">
        <label data-i18n="co_label">Was gibt's Neues? (kurzer Fachbeitrag)</label>
        <textarea id="pb" data-i18n-ph="co_ph" placeholder="Bei uns gerade Engpass bei Amoxicillin — wer hat noch Bestand?"></textarea>
        <input id="psrc" data-i18n-ph="co_src_ph" placeholder="🔗 Quelle (Link, optional – z.B. BASG/Kammer)" style="margin-top:6px">
        <div class="row" style="margin-top:6px">
          <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px"><span data-i18n="co_img">📷 Bild</span><input type="file" id="pimg" accept="image/*" style="display:none"></label>
          <span class="muted" id="pimgname" style="font-size:13px"></span>
          <button class="ghost small" id="pimgclear" data-i18n="co_img_clear" style="display:none">✕ entfernen</button>
        </div>
        <img id="pimgprev" data-i18n-alt="a11y_img_preview" alt="Bildvorschau" style="display:none;max-width:100%;border-radius:8px;margin-top:6px" />
        <label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" id="pfrage" style="width:auto;min-height:0"> <span data-i18n="co_question">❓ Als Fachfrage stellen (beste Antwort auswählbar)</span>
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;font-size:14px">
          <input type="checkbox" id="ppoll" style="width:auto;min-height:0"> <span data-i18n="co_poll">📊 Umfrage</span>
        </label>
        <div id="pollBox" style="display:none;margin-top:8px"></div>
        <div class="row" style="margin-top:8px">
          <select id="pv" data-i18n-aria="co_vis_aria" aria-label="Sichtbarkeit des Beitrags" style="max-width:220px">
            <option value="public" data-i18n="pv_public">🌍 Öffentlich (alle Apotheker)</option>
            <option value="followers" data-i18n="pv_followers">👥 Nur meine Follower</option>
          </select>
          <span class="sp" style="flex:1"></span>
          <button id="pgo" data-i18n="sc_post_send">Posten</button>
        </div>
        <div class="err" id="perr"></div>
      </div>
      <div class="card">
        <label data-i18n="co_follow_label">Jemandem folgen (@Handle)</label>
        <div class="row"><input id="fh" placeholder="ben_mayer"><button class="ghost small" id="fgo" data-i18n="co_follow_btn">Folgen</button></div>
        <div class="err" id="ferr"></div>
      </div>
    </div>
    <div id="feed"></div>
  `));

  let composeImage = null;
  const pimg = document.getElementById('pimg'), pimgprev = document.getElementById('pimgprev');
  const pimgname = document.getElementById('pimgname'), pimgclear = document.getElementById('pimgclear');
  const clearImg = () => { composeImage = null; pimg.value=''; pimgprev.style.display='none'; pimgprev.src=''; pimgname.textContent=''; pimgclear.style.display='none'; };
  pimg.onchange = async () => {
    const f = pimg.files[0]; if (!f) return;
    try { composeImage = await fileToDataUrl(f); pimgprev.src = composeImage; pimgprev.style.display='block'; pimgname.textContent = f.name; pimgclear.style.display='inline-block'; document.getElementById('perr').textContent=''; }
    catch(e){ document.getElementById('perr').textContent = e.message; clearImg(); }
  };
  pimgclear.onclick = clearImg;
  attachMentionAutocomplete(document.getElementById('pb'));
  attachCharCounter(document.getElementById('pb'), 1000);

  // Entwurf-Schutz: halbfertige Beiträge überstehen ein Neuladen/Weg-Navigieren
  // (zielgruppengerecht: zeitknapp, wird oft unterbrochen). Nur der Text (#pb),
  // pro Konto in localStorage. Wird beim erfolgreichen Posten/Verwerfen gelöscht.
  const pbEl = document.getElementById('pb');
  const DRAFT_KEY = 'apo_draft_pb_' + ((me && me.handle) || '');
  const clearDraft = () => { localStorage.removeItem(DRAFT_KEY); const h = document.getElementById('pbDraftHint'); if (h) h.remove(); };
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved && !pbEl.value) {
    pbEl.value = saved;
    const hint = el(`<div id="pbDraftHint" class="muted" style="font-size:12px;margin-bottom:4px">${esc(t('dr_restored'))} · <button class="linklike small" id="pbDraftDiscard">${esc(t('dr_discard'))}</button></div>`);
    pbEl.insertAdjacentElement('beforebegin', hint);
    hint.querySelector('#pbDraftDiscard').onclick = () => { pbEl.value = ''; clearDraft(); pbEl.dispatchEvent(new Event('input')); };
  }
  pbEl.addEventListener('input', () => {
    if (pbEl.value.trim()) localStorage.setItem(DRAFT_KEY, pbEl.value);
    else localStorage.removeItem(DRAFT_KEY);
    const h = document.getElementById('pbDraftHint'); if (h) h.remove(); // eigenes Tippen ersetzt den Hinweis
  });

  // Poll composer: toggle reveals dynamic answer-option inputs (2..6)
  const ppoll = document.getElementById('ppoll'), pfrage = document.getElementById('pfrage'), pollBox = document.getElementById('pollBox');
  const MAX_POLL_OPTS = 6;
  function pollOptInputs() { return Array.from(pollBox.querySelectorAll('input.poll-opt-in')); }
  function setPollVals(vals) {
    while (vals.length < 2) vals.push('');
    const canRemove = vals.length > 2; // Minimum 2 Optionen bleiben erhalten
    const rows = vals.map((val, i) =>
      `<div class="row poll-opt-row" style="margin-top:6px;gap:6px">
        <input class="poll-opt-in" placeholder="${esc(t('co_poll_opt'))} ${i+1}" value="${esc(val)}" maxlength="80" style="flex:1">
        ${canRemove ? `<button class="ghost small poll-opt-del" data-i="${i}" aria-label="${esc(t('co_poll_del'))}" title="${esc(t('co_poll_del'))}">✕</button>` : ''}
      </div>`
    ).join('');
    const canAdd = vals.length < MAX_POLL_OPTS;
    pollBox.innerHTML = rows + (canAdd ? `<button class="ghost small" id="pollAdd" data-i18n="co_poll_add" style="margin-top:6px">+ Option hinzufügen</button>` : '');
    if (canAdd) document.getElementById('pollAdd').onclick = () => { const cur = pollOptInputs().map(i=>i.value); cur.push(''); setPollVals(cur); };
    pollBox.querySelectorAll('.poll-opt-del').forEach(b => b.onclick = () => { const cur = pollOptInputs().map(i=>i.value); cur.splice(Number(b.dataset.i), 1); setPollVals(cur); });
    applyI18n(pollBox);
  }
  ppoll.onchange = () => {
    if (ppoll.checked) { pfrage.checked = false; pollBox.style.display = 'block'; if (!pollOptInputs().length) setPollVals([]); document.getElementById('pb').placeholder = t('co_poll_q_ph'); }
    else { pollBox.style.display = 'none'; document.getElementById('pb').placeholder = t('co_ph'); }
  };
  pfrage.onchange = () => { if (pfrage.checked && ppoll.checked) { ppoll.checked = false; pollBox.style.display='none'; document.getElementById('pb').placeholder = t('co_ph'); } };

  document.getElementById('pgo').onclick = async () => {
    try {
      const isFrage = pfrage.checked, isPoll = ppoll.checked;
      const payload = { body:v('pb'), visibility:document.getElementById('pv').value, image:composeImage, sourceUrl:v('psrc'), kind: isPoll ? 'poll' : (isFrage ? 'frage' : 'post') };
      if (isPoll) payload.pollOptions = pollOptInputs().map(i => i.value.trim()).filter(Boolean);
      await api('POST','/api/posts', payload);
      document.getElementById('pb').value=''; document.getElementById('psrc').value=''; pfrage.checked=false;
      clearDraft(); // erfolgreich gepostet -> Entwurf verwerfen
      ppoll.checked=false; pollBox.style.display='none'; pollBox.innerHTML=''; document.getElementById('pb').placeholder=t('co_ph'); clearImg(); loadFeed();
    } catch(e){ document.getElementById('perr').textContent = e.message; }
  };
  document.getElementById('fgo').onclick = async () => {
    try { await api('POST','/api/follow',{ handle:v('fh') }); document.getElementById('fh').value=''; document.getElementById('ferr').textContent=''; loadFeed(); }
    catch(e){ document.getElementById('ferr').textContent = e.message; }
  };
  const runSearch = () => { const q = v('sq').trim(); if (q) renderSearch(q); };
  document.getElementById('sgo').onclick = runSearch;
  document.getElementById('sq').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  // Ruhende Bereiche verschwinden, BEVOR Klick-Handler gesetzt werden —
  // sonst haengt ein Handler an einem Element, das gleich entfernt wird.
  wendeFeaturesAn();
  app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    app.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); tab = b.dataset.tab; loadTab();
  });
  await applyCountryGating(); // rechtlich gesperrte Reiter fürs Heimatland ausblenden
  applyI18n();          // Navigation/Suche in aktueller Sprache beschriften
  applyTheme();         // Theme-Label (Hell/Dunkel) in aktueller Sprache
  initCountrySwitcher(); // Länder-/Sprach-Umschalter in der Kopfzeile aktivieren
  startNewsRail();      // News-Livestream links starten (nur auf breiten Bildschirmen sichtbar)
  renderQuickRail();    // Schnellzugriff-Rail rechts (nur auf Laptop/Desktop sichtbar)
  renderAdSlot();       // Anzeigen-Fläche rechts unter dem Schnellzugriff (Monetarisierung)
  setHeaderHeightVar(); // Kopfhöhe für die klebrige mobile Reiter-Leiste
  loadTab();
  // Deep-Links: /?post=ID öffnet einen Beitrag, /?wirkstoff=Name die Wirkstoff-Seite,
  // /?profile=Handle ein Profil, /?hashtag=Tag einen Hashtag-Feed.
  const params = new URLSearchParams(location.search);
  const sharedPost = params.get('post');
  const sharedWirkstoff = params.get('wirkstoff');
  const sharedProfile = params.get('profile');
  const sharedHashtag = params.get('hashtag');
  const deepTab = params.get('tab');
  const validTabs = ['overview','public','home','shortages','prices','rabatte','exchange','news'];
  if (sharedPost) { history.replaceState(null, '', location.pathname); openPost(sharedPost); }
  else if (sharedWirkstoff) { history.replaceState(null, '', location.pathname); openWirkstoff(sharedWirkstoff); }
  else if (sharedProfile) { history.replaceState(null, '', location.pathname); openProfile(sharedProfile); }
  else if (sharedHashtag) { history.replaceState(null, '', location.pathname); openHashtag(sharedHashtag); }
  else if (deepTab && validTabs.includes(deepTab)) { history.replaceState(null, '', location.pathname); goTab(deepTab); }
  else if (!localStorage.getItem('apo_welcome_seen')) showWelcome(false);
}

function showWelcome(reopened) {
  document.getElementById('welcomeOverlay')?.remove();
  const steps = [
    ['⭐', 'wc_s1_t', 'wc_s1_d'], ['➕', 'wc_s2_t', 'wc_s2_d'], ['💶', 'wc_s3_t', 'wc_s3_d'],
    ['📝', 'wc_s4_t', 'wc_s4_d'], ['🔄', 'wc_s5_t', 'wc_s5_d'], ['👥', 'wc_s6_t', 'wc_s6_d'],
    ['✉️', 'wc_s7_t', 'wc_s7_d'], ['🔎', 'wc_s8_t', 'wc_s8_d'],
  ];
  const ov = el(`<div id="welcomeOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto">
      <div class="row"><h1 id="welcomeTitle" style="flex:1;margin:0">${esc(t('wc_title'))}</h1></div>
      <p class="muted" style="margin:6px 0 14px">${esc(t('wc_sub'))}</p>
      ${steps.map(([ic,tk,dk])=>`<div style="display:flex;gap:12px;margin:12px 0">
        <div style="font-size:24px;flex:0 0 auto">${ic}</div>
        <div><b>${esc(t(tk))}</b><div class="muted" style="font-size:14px;margin-top:2px">${esc(t(dk))}</div></div></div>`).join('')}
      <div class="card" style="background:var(--ok-bg);border-color:var(--ok-bd);margin-top:8px">
        <b>${esc(t('wc_tip_t'))}</b>
        <div class="muted" style="font-size:14px;margin-top:4px">${esc(t('wc_tip_d'))}</div>
      </div>
      <div class="row" style="margin-top:16px"><span class="sp" style="flex:1"></span>
        <button id="welcomeClose">${esc(t('wc_go'))}</button></div>
    </div>
  </div>`);
  document.body.appendChild(ov);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { localStorage.setItem('apo_welcome_seen','1'); document.removeEventListener('keydown', onKey); ov.remove(); };
  ov.querySelector('#welcomeClose').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.addEventListener('keydown', onKey);       // Escape schließt (Barrierefreiheit)
  // Fokus in den Dialog setzen — aber OHNE zu scrollen: der „Los geht's"-Button steht
  // ganz unten; ein normaler focus() würde den langen Dialog nach unten scrollen und den
  // Titel/ersten Schritt oben abschneiden. preventScroll hält den Anfang sichtbar.
  ov.querySelector('#welcomeClose').focus({ preventScroll: true });
  ov.querySelector('.card').scrollTop = 0;           // sicher am Anfang starten (Titel zuerst)
}

function goTab(name) {
  tab = name;
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  const b = document.querySelector('.tabs button[data-tab="'+name+'"]'); if (b) b.classList.add('active');
  loadTab();
}

// Zeitkritische Live-Sessions auf der Übersicht: laufende zum sofortigen Beitreten,
// die nächsten geplanten mit „Erinnern". Nur gerendert, wenn es etwas gibt.
// Lokaler Kalendertag (Wall-Clock) + einheitliche Überfällig-Regel für ALLE Aufgaben-Ansichten
// (Übersicht, Team-Überfällig, Aufgaben-Filter, Aushang) — eine Quelle der Wahrheit.
const taskToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10);
const taskIsOverdue = (t, today = taskToday()) => !!(t.due_date && t.status !== 'erledigt' && t.due_date < today);

// Deine offenen Aufgaben auf der Übersicht (nur wenn welche dir zugewiesen sind).
// Überfällige zuerst; „auf einen Screen" — direkter Einstieg in die Team-Aufgaben.
function renderMyTasksOverview(feed, tasks) {
  if (!featureAn('zusammenarbeit')) return;
  const today = taskToday();
  const mine = (tasks || []).filter(t => t.mine && t.status !== 'erledigt');
  if (!mine.length) return;
  const isOverdue = (t) => taskIsOverdue(t, today);
  mine.sort((a, b) => (Number(isOverdue(b)) - Number(isOverdue(a))) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const overdue = mine.filter(isOverdue).length;
  const top = mine.slice(0, 3);
  const card = el(`<div class="card"${overdue?' style="border-left:4px solid var(--crit-fg)"':''}>
    <div class="row" style="align-items:baseline"><b style="flex:1">✅ ${esc(ti('ovt_title',{n:mine.length}))}</b>
      ${overdue?`<span style="font-size:12px;font-weight:700;color:var(--crit-fg)">${esc(ti('ovt_overdue',{n:overdue}))}</span>`:''}
      <button class="linklike small" data-all style="margin-left:8px">${esc(t('ovt_all'))} ›</button></div>
    ${top.map(t2=>`<div class="comment clickable" data-open><span>${isOverdue(t2)?'🔴 ':'▫️ '}</span>${esc(t2.title)}${t2.due_date?` <span class="muted" style="font-size:12px">· ${esc(ti('tk_due',{d:fmtDateDe(t2.due_date)}))}</span>`:''}</div>`).join('')}
  </div>`);
  card.querySelector('[data-all]').onclick = () => openTasks();
  card.querySelectorAll('[data-open]').forEach(row => row.onclick = () => openTasks());
  feed.appendChild(card);
}

// Manager-Sicht (nur mit Zuweise-Recht): überfällige Aufgaben, die NICHT dir zugewiesen sind
// (Kolleg:innen oder unzugewiesen) — Aufsicht über liegengebliebene Delegationen, ohne die
// Team-Ansicht öffnen zu müssen. Ergänzt „Deine Aufgaben" (dort stehen deine eigenen).
function renderTeamOverdueOverview(feed, tasks, canAssign) {
  if (!featureAn('zusammenarbeit')) return;
  if (!canAssign) return;
  const today = taskToday();
  const teamOverdue = (tasks || []).filter(t => !t.mine && taskIsOverdue(t, today))
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))); // am längsten überfällig zuerst
  if (!teamOverdue.length) return;
  const top = teamOverdue.slice(0, 3);
  const card = el(`<div class="card" style="border-left:4px solid var(--crit-fg)">
    <div class="row" style="align-items:baseline"><b style="flex:1">${esc(ti('ovt_team_title',{n:teamOverdue.length}))}</b>
      <button class="linklike small" data-all style="margin-left:8px">${esc(t('ovt_all'))} ›</button></div>
    <div class="muted" style="font-size:12px;margin:2px 0 4px">${esc(t('ovt_team_sub'))}</div>
    ${top.map(tk=>`<div class="comment clickable" data-open>🔴 ${esc(tk.title)} <span class="muted" style="font-size:12px">· ${esc(tk.assignee_name?ti('tk_assigned_to',{name:tk.assignee_name}):t('tk_unassigned'))} · ${esc(ti('tk_due',{d:fmtDateDe(tk.due_date)}))}</span></div>`).join('')}
  </div>`);
  const openOverdue = () => { taskFilter = 'ueberfaellig'; openTasks(); };
  card.querySelector('[data-all]').onclick = openOverdue;
  card.querySelectorAll('[data-open]').forEach(row => row.onclick = openOverdue);
  feed.appendChild(card);
}

function renderLiveOverview(feed, liveNow, liveSoon) {
  if (!liveNow.length && !liveSoon.length) return;
  const soon = liveSoon.slice(0, 2);
  const hostLine = (s) => `<b class="clickable" data-openprofile="${esc(s.host?s.host.handle:'')}">${esc(s.host?(s.host.display_name||('@'+s.host.handle)):'—')}</b>${s.host&&s.host.verified?' <span title="'+esc(t('pc_verified'))+'">✔</span>':''}`;
  const card = el(`<div class="card" style="border-left:4px solid var(--crit-fg)">
    ${liveNow.length?`<div style="font-weight:800;color:var(--crit-fg);margin-bottom:6px">🔴 ${esc(t('lv_ov_now'))}</div>
      ${liveNow.map(s=>`<div class="row" style="align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap">
        <div style="flex:1;min-width:160px"><b>${esc(s.titel)}</b><div class="muted" style="font-size:13px">${esc(t('lv_host'))}: ${hostLine(s)}</div></div>
        ${s.room_url?`<a class="small" style="text-decoration:none;font-weight:700;color:var(--crit-fg)" href="${esc(s.room_url)}" target="_blank" rel="noopener noreferrer">${esc(t('lv_join'))}</a>`:''}
      </div>`).join('')}`:''}
    ${soon.length?`<div style="font-weight:700;margin:${liveNow.length?'10':'0'}px 0 6px">${esc(t('lv_ov_soon'))}</div>
      ${soon.map(s=>`<div class="row" style="align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap">
        <div style="flex:1;min-width:160px"><b>${esc(s.titel)}</b><div class="muted" style="font-size:13px">🗓 ${esc(liveWhen(s.geplant_am))} · ${hostLine(s)}</div></div>
        ${!s.i_am_host?`<button class="${s.i_am_interested?'':'ghost '}small" data-remind="${esc(s.id)}">${esc(s.i_am_interested?t('lv_interested'):t('lv_interest'))}</button>`:''}
      </div>`).join('')}`:''}
    <div class="row" style="margin-top:8px"><button class="linklike small" data-all>${esc(t('lv_nav'))} ›</button></div>
  </div>`);
  card.querySelectorAll('[data-openprofile]').forEach(e2 => { if (e2.dataset.openprofile) e2.onclick = () => openProfile(e2.dataset.openprofile); });
  card.querySelectorAll('[data-remind]').forEach(b => b.onclick = async () => { try { await api('POST',`/api/live/${b.dataset.remind}/interest`); loadOverview(); } catch(e){ alert(e.message); } });
  card.querySelector('[data-all]').onclick = () => openLive();
  feed.appendChild(card);
}

async function loadOverview() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">…</div>';
  let d, liveData = null, tasksData = null;
  try {
    // Live-Sessions + Aufgaben parallel laden (Fehler dort dürfen die Übersicht nicht blockieren).
    [d, liveData, tasksData] = await Promise.all([
      api('GET','/api/overview'),
      // Live-Sessions ruhen (Bereich `termine`). Ohne diese Wache quittiert
      // der Server mit 404, und das steht als roter Fehler in der Konsole.
      featureAn('termine') ? api('GET','/api/live').catch(() => null) : null,
      // Ruhende Bereiche werden gar nicht erst abgefragt — ihre 404 landen
      // sonst als rote Fehler in der Konsole und sehen aus wie ein Defekt.
      featureAn('zusammenarbeit') ? api('GET','/api/tasks').catch(() => null) : null,
    ]);
  }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const liveNow = (liveData && liveData.sessions || []).filter(s => s.status === 'live');
  // „Demnächst": nur künftige geplante Sessions (lokale Wall-Clock, lexikografisch vergleichbar).
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  const liveSoon = (liveData && liveData.sessions || []).filter(s => s.status === 'geplant' && String(s.geplant_am) >= localNow);
  // Reihenfolge (Desktop, Owner-Vorgabe „sofort verständlich, weniger scrollen"):
  // zuerst der Wert auf einen Blick — Begrüßung + Kennzahlen-Kacheln — und das
  // Zeitkritische (Live). Danach erst Referenz-/Hinweis-Karten (Behörde, Profil,
  // Umrechner). Nur die kleine Daten-Ehrlichkeits-Notiz bleibt ganz oben.
  { const n = countryDataNotice(); if (n) feed.appendChild(n); }
  const hello = me ? (me.display_name || '@'+me.handle) : '';
  const firstName = hello ? (hello.split(/\s+/).find(w => !/\.$/.test(w)) || hello) : '';
  // Kennzahlen-Kacheln
  // Kacheln sind Navigations-Buttons (alle klickbar): .clickable macht sie zusätzlich
  // tastaturbedienbar (tabindex+role via zentralem a11y-Mechanismus) und zeigt Hover-Affordanz.
  const tile = (icon, num, label, col, go, filter) => `<div class="ovtile clickable" data-go="${go||''}" data-filter="${filter||''}" style="flex:1;min-width:120px;padding:12px;--tile-accent:${col}">
    <div style="font-size:26px;font-weight:800;color:${col}">${icon} <span style="white-space:nowrap">${num}</span></div>
    <div class="muted" style="font-size:13px;margin-top:2px">${esc(label)} <span class="ovtile-go" aria-hidden="true">›</span></div></div>`;
  const tiles = [
    tile('🔴', d.shortages.kritisch, t('ov_t_crit'), 'var(--crit-fg)', 'shortages'),
  ];
  // Antibiotika-Engpässe: neutral-informativ (blau), NICHT grün — grün stünde für
  // „gut/ok", ein Engpass-Zähler ist aber nichts Positives (Owner-Prinzip: konsistente
  // Farb-Semantik). Rot bleibt der „kritisch"-Kachel vorbehalten.
  if (d.shortages.antibiotika) tiles.push(tile('🧫', d.shortages.antibiotika, t('ov_t_abx'), 'var(--info-fg)', 'shortages', 'antibiotika'));
  // Tauschboersen-Kacheln nur, wenn der Bereich laeuft. Sie zeigten sonst
  // „0 Angebote ›" und fuehrten beim Klick auf einen Reiter, den es nicht mehr
  // gibt. Dieselbe Klasse wie die Schnellzugriff-Leiste — und wieder erst
  // aufgefallen, als eine Browser-Pruefung den Ueberblick im Klartext ausgab.
  if (featureAn('tauschboerse')) {
    tiles.push(
      tile('📦', d.exchange.biete, t('ov_t_offer'), 'var(--ok-fg)', 'exchange'),
      tile('🔎', d.exchange.suche, t('ov_t_seek'), 'var(--warn-fg)', 'exchange'),
    );
  }
  // Beobachtete Wirkstoffe mit überschrittenem Liefertermin — starkes „nachfassen"-Signal.
  const overdueWatched = ((d.watchlist && d.watchlist.items) || []).filter(w => w.overdue).length;
  if (overdueWatched) tiles.push(tile('⚠️', overdueWatched, t('ov_t_overdue'), 'var(--crit-fg)', 'shortages', 'watched'));
  if (d.savings && d.savings.count) tiles.push(tile('💶', '€ ' + fmtMoney(d.savings.total_abs), t('ov_t_savings'), 'var(--ok-fg)', 'prices'));
  if (d.rabatte_expiring && d.rabatte_expiring.count) tiles.push(tile('⏳', d.rabatte_expiring.count, t('ov_t_expiring'), 'var(--warn-fg)', 'rabatte'));
  if (liveNow.length) tiles.push(tile('🔴', liveNow.length, t('lv_ov_now'), 'var(--crit-fg)', 'live'));
  tiles.push(tile('🔔', d.notifications.unread, t('ov_t_notif'), 'var(--info-fg)', ''));
  const head = el(`<div class="card">
    <h1 style="margin:0 0 2px">✨ ${esc(t('ov_hello'))}${firstName?', '+esc(firstName):''}</h1>
    <div class="muted" style="margin-bottom:12px">${esc(t('ov_sub'))}</div>
    <div class="row" style="flex-wrap:wrap;gap:10px">
      ${tiles.join('')}
    </div>
    <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button class="ghost small" id="ov_bm">${esc(t('ov_bookmarks'))}</button><button class="ghost small" id="ov_promos">${esc(t('wb_nav'))}</button><button class="ghost small" id="ov_live">${esc(t('lv_nav'))}</button><button class="ghost small" id="ov_dir">${esc(t('dir_nav'))}</button><button class="ghost small" id="ov_team">${esc(t('th_nav'))}</button></div>
  </div>`);
  head.querySelectorAll('.ovtile[data-go]').forEach(t => { if (t.dataset.go) t.onclick = () => { if (t.dataset.go === 'live') { openLive(); return; } if (t.dataset.filter) shortageFilter = t.dataset.filter; goTab(t.dataset.go); }; });
  head.querySelectorAll('.ovtile').forEach(t => { if (!t.dataset.go) t.onclick = () => document.getElementById('btnNotif').click(); });
  head.querySelector('#ov_bm').onclick = openBookmarks;
  head.querySelector('#ov_promos').onclick = () => openPromotions();
  head.querySelector('#ov_live').onclick = () => openLive();
  head.querySelector('#ov_dir').onclick = () => openDirectory();
  head.querySelector('#ov_team').onclick = () => openTeamHub();
  feed.appendChild(head);
  renderLiveOverview(feed, liveNow, liveSoon); // zeitkritisch: laufende/kommende Live-Sessions ganz oben
  renderMyTasksOverview(feed, (tasksData && tasksData.tasks) || []); // deine offenen Aufgaben
  renderTeamOverdueOverview(feed, (tasksData && tasksData.tasks) || [], !!(tasksData && tasksData.can_assign)); // Manager: Team-Überfälligkeiten
  // Realisierte Beschaffungs-Ersparnis: macht den konkreten Euro-Nutzen auf der Startseite
  // sichtbar und führt direkt zum Report. Nur wenn tatsächlich Ersparnis erzielt wurde.
  if (d.procurement && d.procurement.saved > 0) {
    const pc = d.procurement;
    const c = el(`<div class="card" style="border-left:4px solid var(--ok-fg)">
      <div class="row" style="align-items:baseline;gap:8px;flex-wrap:wrap"><b style="flex:1">${esc(t('ov_proc_title'))}</b><button class="linklike small" data-report>${esc(t('ov_proc_cta'))} ›</button></div>
      <div style="font-size:22px;font-weight:800;color:var(--ok-fg);margin-top:2px">€ ${fmtMoney(pc.saved)}</div>
      <div class="muted" style="font-size:13px">${esc(pc.orders === 1 ? t('ov_proc_sub_one') : ti('ov_proc_sub', { n: pc.orders }))}</div>
    </div>`);
    c.querySelector('[data-report]').onclick = () => openOrders();
    feed.appendChild(c);
  }
  // Sekundäre Karten unter dem Wert-Überblick (siehe Reihenfolge-Hinweis oben).
  { const r = countryRegulatorCard(!!d.data_live); if (r) feed.appendChild(r); } // offizielle Behörde/Quelle
  renderNewsInline(feed);    // News-Karten fürs Handy (nur wenn die Seitenleiste fehlt)
  renderProfileNudge(feed);  // Hinweis, das eigene Profil zu vervollständigen (nur wenn unfertig)
  renderCurrencyConverter(feed);

  // Zuletzt angesehene Wirkstoffe (nur lokal) — schneller Wiedereinstieg.
  const recent = getRecentWirkstoff();
  if (recent.length) {
    const rc = el(`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">${esc(t('ov_recent'))}</div><div class="row" data-recent style="flex-wrap:wrap;gap:10px"></div></div>`);
    const box = rc.querySelector('[data-recent]');
    // Ein-Klick-Beobachten direkt aus den zuletzt angesehenen Wirkstoffen (Konsistenz mit der Suche).
    const watched = new Set(((d.watchlist && d.watchlist.items) || []).map(i => i.wirkstoff.toLowerCase()));
    recent.forEach(w => box.appendChild(substanceWatchChip(w, watched)));
    feed.appendChild(rc);
  }

  // Wochenrückblick: was sich bei beobachteten Wirkstoffen zuletzt geändert hat (7 Tage)
  renderWeekReview(feed, d.week_review);

  // Meine beobachteten Wirkstoffe (mit Schnell-Vorschlägen aus kritischen Engpässen)
  renderWatchlistCard(feed, (d.watchlist && d.watchlist.items) || [], d.shortages.top || [], !!d.premium);

  // Aktionen zu beobachteten Wirkstoffen (Beobachtungsliste ↔ Rabatte)
  if (d.watch_deals && d.watch_deals.length) {
    const c = el(`<div class="card"><div class="row" style="flex-wrap:wrap;gap:6px"><b style="flex:1">${esc(t('wd_title'))}</b>${d.watch_deals.length>1?`<button class="ghost small" data-addall>🛒 ${esc(t('wd_add_all'))}</button>`:''}<button class="ghost small" data-all>${esc(t('wd_all'))}</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('wd_sub'))}</div><div data-wd></div></div>`);
    const box = c.querySelector('[data-wd]');
    const addAll = c.querySelector('[data-addall]');
    if (addAll) addAll.onclick = async () => {
      addAll.disabled = true;
      let n = 0;
      for (const w of d.watch_deals) {
        try { await api('POST','/api/cart', { bezeichnung: w.bezeichnung || w.wirkstoff, wirkstoff: w.wirkstoff, supplier: w.supplier, aktionspreis: w.aktionspreis, listenpreis: (w.aktionspreis!=null && w.ersparnis!=null) ? Number(w.aktionspreis)+Number(w.ersparnis) : undefined, rabattPct: w.rabatt_pct, gueltigBis: w.gueltig_bis, menge: w.min_menge || 1, sourceKind: 'rabatt' }); n++; } catch { /* weiter */ }
      }
      addAll.textContent = '✓ ' + ti('wd_added_all', { n });
      refreshCartCount();
      c.querySelectorAll('[data-addcart]').forEach(b => { b.textContent = '✓'; b.disabled = true; });
    };
    d.watch_deals.forEach(w => {
      const row = el(`<div class="comment"><div class="row" style="align-items:baseline">
        <span style="flex:1">🏷️ <b>${esc(w.wirkstoff)}</b> — ${esc(w.supplier)} <span style="color:var(--ok-fg);font-weight:700">−${w.rabatt_pct}%</span> (€ ${fmtMoney(w.aktionspreis)})${w.ersparnis>0?` · <span style="color:var(--ok-fg);font-weight:700">${esc(ti('wd_saving',{x:fmtMoney(w.ersparnis)}))}</span>`:''}${w.expiring_soon?` · <b style="color:${w.days_left<=3?'var(--crit-fg)':'var(--warn-fg)'}">${esc(w.days_left<=0?t('pg_only_today'):ti('pg_only_days',{d:w.days_left}))}</b>`:''}</span>
        <button class="ghost small" data-addcart title="${esc(t('cart_add'))}" aria-label="${esc(t('cart_add'))}" style="margin-left:6px">🛒</button>
      </div></div>`);
      row.querySelector('[data-addcart]').onclick = (ev) => cartAdd({
        bezeichnung: w.bezeichnung || w.wirkstoff, wirkstoff: w.wirkstoff, supplier: w.supplier,
        aktionspreis: w.aktionspreis, listenpreis: (w.aktionspreis!=null && w.ersparnis!=null) ? Number(w.aktionspreis)+Number(w.ersparnis) : undefined, rabattPct: w.rabatt_pct, gueltigBis: w.gueltig_bis,
        menge: w.min_menge || 1, sourceKind: 'rabatt',
      }, ev.target);
      box.appendChild(row);
    });
    c.querySelector('[data-all]').onclick = () => goTab('rabatte');
    feed.appendChild(c);
  }

  // Eigene „Biete"-Angebote mit nahendem/überschrittenem Verfallsdatum: aktiver Anstoß,
  // Restbestand abzugeben, bevor er verfällt (spart Geld, vermeidet Verschwendung).
  if (d.expiring_offers && d.expiring_offers.count) {
    const daysChip = (o) => {
      if (o.expired) return `<span style="display:inline-block;font-size:12px;font-weight:700;color:#fff;background:var(--crit-fg);padding:2px 8px;border-radius:999px">${esc(t('xo_expired'))}</span>`;
      const label = o.days_until_expiry === 0 ? t('xo_today') : nlabel(o.days_until_expiry, 'xo_days_one', 'xo_days_many');
      const soon = o.days_until_expiry <= 7;
      const col = soon ? 'var(--warn-fg)' : 'var(--muted)';
      const bg = soon ? 'var(--warn-bg)' : 'var(--chip-bg)';
      const bd = soon ? 'var(--warn-bd)' : 'var(--line)';
      return `<span style="display:inline-block;font-size:12px;font-weight:700;color:${col};background:${bg};border:1px solid ${bd};padding:2px 8px;border-radius:999px">${esc(label)}</span>`;
    };
    const c = el(`<div class="card" style="border-left:4px solid var(--warn-fg)"><div class="row"><b>${esc(t('xo_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('xo_all'))}</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('xo_sub'))}</div>
      ${d.expiring_offers.items.map(o=>`<div class="comment clickable" data-open>📦 <b>${esc(o.bezeichnung)}</b>${o.menge?` <span class="muted">· ${esc(o.menge)}</span>`:''} ${daysChip(o)}<div class="muted" style="font-size:12px;margin-top:2px">${esc(t('xo_expires'))} <b>${esc(fmtDateDe(o.ablauf))}</b>${o.match_count>0?` · <span style="color:var(--ok-fg);font-weight:700">${esc(o.match_count>1?ti('xo_matches_pl',{n:o.match_count}):t('xo_matches_sg'))}</span>`:''}</div></div>`).join('')}</div>`);
    c.querySelector('[data-all]').onclick = () => { exchangeMine = true; goTab('exchange'); };
    c.querySelectorAll('[data-open]').forEach(row => row.onclick = () => { exchangeMine = true; goTab('exchange'); });
    feed.appendChild(c);
  }

  // Eigene, lange offene Community-Engpass-Meldungen: Anstoß, den Status zu prüfen —
  // hält die Engpass-Daten verlässlich (nur die eigenen Meldungen der Nutzer:in).
  if (d.my_reports && d.my_reports.count) {
    const c = el(`<div class="card" style="border-left:4px solid var(--info-fg)"><div class="row"><b>${esc(t('sr_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('sp_view_all'))}</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('sr_sub'))}</div>
      ${d.my_reports.items.map(r=>{const m=watchStatusMeta(r.status);return `<div class="comment clickable" data-wk="${esc(r.wirkstoff)}"><span style="font-size:16px">${m.icon}</span> <b>${esc(r.wirkstoff)}</b>${r.bezeichnung?` <span class="muted">${esc(r.bezeichnung)}</span>`:''} <span style="display:inline-block;font-size:12px;font-weight:700;color:var(--warn-fg);background:var(--warn-bg);border:1px solid var(--warn-bd);padding:1px 8px;border-radius:999px">${esc(nlabel(r.days_reported,'sr_since_one','sr_since_many'))}</span>${r.confirm_count>0?` <span class="muted" style="font-size:12px">· ${esc(nlabel(r.confirm_count,'sr_confirms_one','sr_confirms_many'))}</span>`:''} <span class="ovtile-go" aria-hidden="true">›</span></div>`;}).join('')}</div>`);
    c.querySelector('[data-all]').onclick = () => goTab('shortages');
    c.querySelectorAll('[data-wk]').forEach(row => row.onclick = () => openWirkstoff(row.dataset.wk));
    feed.appendChild(c);
  }

  // Bezugsquellen zu beobachteten Wirkstoffen (Beobachtungsliste ↔ Biete/Suche)
  if (d.watch_offers && d.watch_offers.length) {
    const c = el(`<div class="card"><div class="row"><b>${esc(t('wo_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('sp_exch_go'))}</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('wo_sub'))}</div>
      ${d.watch_offers.map(w=>`<div class="comment clickable" data-w="${esc(w.wirkstoff)}">📦 <b>${esc(w.wirkstoff)}</b> — <span style="color:var(--ok-fg);font-weight:700">${w.offers_count} ${esc(w.offers_count>1?t('wo_offers_pl'):t('wo_offers_sg'))}</span> ${esc(t('wo_in_exchange'))}</div>`).join('')}</div>`);
    c.querySelector('[data-all]').onclick = () => goTab('exchange');
    c.querySelectorAll('[data-w]').forEach(row => row.onclick = () => {
      exchangeQuery = row.dataset.w; exchangeFilter = 'biete'; exchangeBL = ''; exchangeMine = false;
      goTab('exchange');
    });
    feed.appendChild(c);
  }

  // Deine offenen Gesuche mit passenden Angeboten: schließt die „Ich suche das"-Schleife —
  // sobald zu einem Gesuch Angebote da sind, direkt zu den Treffern springen.
  if (d.my_seeks && d.my_seeks.with_matches > 0) {
    const c = el(`<div class="card"><div class="row"><b>${esc(t('ms_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('sp_exch_go'))}</button></div>
      <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('ms_sub'))}</div>
      ${d.my_seeks.items.map(s=>`<div class="comment clickable" data-b="${esc(s.bezeichnung)}">🔎 <b>${esc(s.bezeichnung)}</b> — <span style="color:var(--ok-fg);font-weight:700">${s.match_count} ${esc(s.match_count>1?t('ms_matches_pl'):t('ms_matches_sg'))}</span> <span class="ovtile-go" aria-hidden="true">›</span></div>`).join('')}</div>`);
    c.querySelector('[data-all]').onclick = () => { exchangeMine=true; goTab('exchange'); };
    c.querySelectorAll('[data-b]').forEach(row => row.onclick = () => {
      exchangeQuery = row.dataset.b; exchangeFilter = 'biete'; exchangeBL = ''; exchangeMine = false;
      goTab('exchange');
    });
    feed.appendChild(c);
  }

  // Kritische Engpässe (Top 3)
  if (d.shortages.top.length) {
    const c = el(`<div class="card"><div class="row"><b>${esc(t('sp_crit_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('sp_view_all'))}</button></div>
      ${d.shortages.top.map(s=>`<div class="comment clickable" data-wk="${esc(s.wirkstoff)}"><b>${esc(s.wirkstoff)}</b> <span class="muted">${esc(s.bezeichnung)}</span> <span class="ovtile-go" aria-hidden="true">›</span></div>`).join('')}</div>`);
    c.querySelector('[data-all]').onclick = () => goTab('shortages');
    c.querySelectorAll('[data-wk]').forEach(row => row.onclick = () => openWirkstoff(row.dataset.wk));
    feed.appendChild(c);
  }
  // Neueste Austausch-Einträge
  if (d.exchange.recent.length) {
    const c = el(`<div class="card"><div class="row"><b>${esc(t('sp_exch_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-all>${esc(t('sp_exch_go'))}</button></div></div>`);
    c.querySelector('[data-all]').onclick = () => goTab('exchange');
    d.exchange.recent.forEach(e => c.appendChild(exchangeCard(e)));
    feed.appendChild(c);
  }
  // Hinweis: Sparpotenzial, Top-Rabatt und bald ablaufende Aktionen stehen jetzt
  // kompakt als Kennzahl-Kacheln oben (weniger Scrollen); Details auf den Reitern.

  // Antibiotic-Stewardship-Fachforum (Einstieg)
  const stew = el(`<div class="card clickable" style="border-left:4px solid #0b7f28">
    <div class="row"><b>${esc(t('sp_stew_title'))}</b><span class="sp" style="flex:1"></span><span class="muted" style="font-size:12px">${esc(t('sp_stew_tag'))}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">${esc(t('sp_stew_sub'))}</div></div>`);
  stew.onclick = () => openStewardship();
  feed.appendChild(stew);

  // Offene Fachfragen von Kolleg:innen (nicht-blockierend nachgeladen)
  renderOpenQuestions(feed);
  // Apotheken im selben Bundesland (nicht-blockierend nachgeladen)
  renderNearbyColleagues(feed);
  // „Offen für"-Kategorien zum Entdecken (nicht-blockierend)
  renderOpenToDiscover(feed);
  // Aktuelle Themen (Trending-Hashtags, nicht-blockierend)
  renderTrendingHashtags(feed);
}

// Entdecken-Einstieg: „Offen für"-Kategorien mit Anzahl, öffnet die passende Liste.
async function renderOpenToDiscover(feed) {
  if (!featureAn('social')) return;
  let d;
  try { d = await api('GET','/api/discover/open-to'); } catch { return; }
  const counts = (d && d.counts) || {};
  const active = OPEN_TO.filter(k => (counts[k] || 0) > 0);
  if (!active.length) return;
  const card = el(`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">🧭 ${esc(t('ot_hub_title'))}</div>
    <div class="row" data-oth style="flex-wrap:wrap;gap:6px"></div></div>`);
  const box = card.querySelector('[data-oth]');
  active.forEach(k => {
    const chip = el(`<button class="small sortbtn">${esc(openToLabel(k))} <span class="muted">${counts[k]}</span></button>`);
    chip.onclick = () => openDiscoverOpenTo(k);
    box.appendChild(chip);
  });
  feed.appendChild(card);
}

// Unbeantwortete Fachfragen anderer sichtbar machen — wer antwortet, hilft
// Kolleg:innen und sammelt "beste Antwort"-Reputation.
async function renderOpenQuestions(feed) {
  let d;
  try { d = await api('GET','/api/feed/public?filter=questions&country=' + viewCountry()); } catch { return; }
  const open = (d.posts || []).filter(p => p.is_question && !p.answered && !(me && p.author && p.author.handle === me.handle)).slice(0, 3);
  if (!open.length) return;
  const card = el(`<div class="card"><div class="row"><b>${esc(t('oq_title'))}</b><span class="sp" style="flex:1"></span><span class="muted" style="font-size:12px">${esc(t('oq_waiting'))}</span></div><div data-oq style="margin-top:6px"></div></div>`);
  const box = card.querySelector('[data-oq]');
  open.forEach(q => {
    const nAns = q.comment_count||0;
    const ansHtml = nAns === 0
      ? `<b style="color:var(--warn-fg)">${esc(t('oq_no_answer'))}</b>`
      : `${nAns} ${esc(nAns===1?t('oq_answer_sg'):t('oq_answer_pl'))}`;
    const row = el(`<div class="comment clickable">❓ ${esc((q.body||'').slice(0,90))}${(q.body||'').length>90?'…':''} <span class="muted" style="font-size:12px">· ${q.author?'@'+esc(q.author.handle):''} · ${ansHtml}</span></div>`);
    row.onclick = () => openPost(q.id);
    box.appendChild(row);
  });
  feed.appendChild(card);
}

async function renderTrendingHashtags(feed) {
  if (!featureAn('social')) return;
  let d;
  try { d = await api('GET','/api/trending/hashtags'); } catch { return; }
  if (!d.hashtags || !d.hashtags.length) return;
  const card = el(`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">${esc(t('tr_title'))}</div><div class="row" data-tt style="flex-wrap:wrap;gap:6px"></div></div>`);
  const box = card.querySelector('[data-tt]');
  d.hashtags.forEach(h => {
    const chip = el(`<button class="small sortbtn">#${esc(h.tag)} <span class="muted">${h.count}</span></button>`);
    chip.onclick = () => openHashtag(h.tag);
    box.appendChild(chip);
  });
  feed.appendChild(card);
}

async function renderNearbyColleagues(feed) {
  if (!featureAn('verzeichnis')) return;
  let d;
  try { d = await api('GET','/api/colleagues/nearby'); } catch { return; }
  if (!d.bundesland || !d.people.length) return;
  const card = el(`<div class="card"><div class="row"><b>${esc(ti('nb_title',{bl:d.bundesland}))}</b><span class="muted" style="font-size:13px;margin-left:8px">${d.people.length}</span></div>
    <div class="muted" style="font-size:13px;margin:2px 0 6px">${esc(t('nb_sub'))}</div><div data-nb></div></div>`);
  const box = card.querySelector('[data-nb]');
  d.people.forEach(p => {
    const row = el(`<div class="comment"><div class="row" style="align-items:baseline">
      <b class="clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name||t('ex_unknown'))}</b>
      <span class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</span>
      ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}${p.verified?'<span class="verified">✔</span>':''}
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-msg="${esc(p.handle)}">${esc(t('pf_dm'))}</button>
      ${p.is_following?`<span class="muted" style="font-size:13px">${esc(t('nb_following'))}</span>`:`<button class="small" data-follow="${esc(p.handle)}">${esc(t('pf_follow'))}</button>`}
    </div>${p.title?`<div class="muted" style="font-size:13px;margin-top:2px">${esc(p.title)}</div>`:''}</div>`);
    row.querySelectorAll('[data-openprofile]').forEach(el=>el.onclick=()=>openProfile(el.dataset.openprofile));
    const fb = row.querySelector('[data-follow]');
    if (fb) fb.onclick = async (ev) => { try { await api('POST','/api/follow',{ handle:p.handle }); ev.target.textContent=t('fl_following_btn'); ev.target.disabled=true; } catch(e){ alert(e.message); } };
    row.querySelector('[data-msg]').onclick = () => messagePerson(p.handle);
    box.appendChild(row);
  });
  feed.appendChild(card);
}

// Status-Anzeige für beobachtete Wirkstoffe (Farb-Semantik: rot = kritisch).
function watchStatusMeta(status) {
  if (status === 'kritisch')        return { label: t('st_krit'), color: 'var(--crit-fg)', bg: 'rgba(192,57,43,.12)', icon: '🔴' };
  if (status === 'eingeschraenkt')  return { label: t('st_eing'), color: 'var(--warn-fg)', bg: 'rgba(178,106,0,.12)', icon: '🟠' };
  if (status === 'verfuegbar')      return { label: t('st_verf'), color: 'var(--ok-fg)', bg: 'rgba(11,127,40,.12)', icon: '🟢' };
  return { label: t('st_none'), color: 'var(--muted)', bg: 'var(--bg)', icon: '⚪' };
}

// Wiederverwendbarer Wirkstoff-Chip mit Ein-Klick-Beobachten-Umschalter (wie in der Suche):
// 💊 Wirkstoff (öffnet Detail) + „+ Beobachten"/„✓ Beobachtet". `watched` ist ein Set
// kleingeschriebener Namen; wird optimistisch mitgepflegt.
function substanceWatchChip(w, watched) {
  const group = el(`<span class="row" style="gap:2px;align-items:stretch"></span>`);
  const chip = el(`<button class="small sortbtn">💊 ${esc(w)}</button>`);
  chip.onclick = () => openWirkstoff(w);
  const btn = el(`<button class="small ghost" title="${esc(t('search_watch_title'))}"></button>`);
  const key = w.toLowerCase();
  const paint = () => { const on = watched.has(key); btn.textContent = on ? t('search_watched') : t('search_watch'); btn.classList.toggle('watched-on', on); };
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      if (watched.has(key)) { await api('DELETE','/api/watchlist/'+encodeURIComponent(w)); watched.delete(key); }
      else { await api('POST','/api/watchlist',{ wirkstoff: w }); watched.add(key); }
      paint();
    } catch(e) { /* Titel/Zustand bleibt */ }
    btn.disabled = false;
  };
  paint();
  group.appendChild(chip); group.appendChild(btn);
  return group;
}

// Wochenrückblick-Karte: kompakte Zusammenfassung der Änderungen an beobachteten
// Wirkstoffen der letzten 7 Tage (neu gemeldet / wieder verfügbar / Status geändert).
// Erscheint nur, wenn es tatsächlich etwas gab — ein leerer Rückblick ist keine
// Neuigkeit und würde die „Für dich"-Übersicht nur unnötig füllen. Druckbar fürs Team.
function wrDaysAgo(dc) {
  const n = dc && dc.days_ago;
  if (n === 0) return t('wr_today');
  return n === 1 ? t('wr_ago_one') : ti('wr_ago_many', { n });
}
function renderWeekReview(feed, wr) {
  if (!featureAn('bindungsmechanik')) return;
  if (!wr || !wr.total) return;
  const sections = [
    { key: 'neu', items: wr.neu || [] },
    { key: 'wieder_verfuegbar', items: wr.wieder_verfuegbar || [] },
    { key: 'status', items: wr.status || [] },
  ].filter(s => s.items.length);
  const head = { neu: t('wr_neu'), wieder_verfuegbar: t('wr_wieder'), status: t('wr_status') };
  const rowHtml = (it) => {
    const m = watchStatusMeta(it.status);
    return `<div class="comment clickable" data-wk="${esc(it.wirkstoff)}">
      <span style="font-size:16px">${m.icon}</span> <b>${esc(it.wirkstoff)}</b>${it.bezeichnung ? ` <span class="muted">${esc(it.bezeichnung)}</span>` : ''}
      <span style="display:inline-block;font-size:12px;font-weight:700;color:${m.color};background:${m.bg};padding:1px 8px;border-radius:999px">${esc(m.label)}</span>
      <span class="muted" style="font-size:12px">· ${esc(wrDaysAgo(it.week_change))}</span>
      <span class="ovtile-go" aria-hidden="true">›</span></div>`;
  };
  const blocks = sections.map(s => `<div style="margin-top:8px"><div class="muted" style="font-size:13px;font-weight:700;margin-bottom:4px">${esc(head[s.key])} <span style="opacity:.7">(${s.items.length})</span></div>${s.items.map(rowHtml).join('')}</div>`).join('');
  const c = el(`<div class="card" style="border-left:4px solid var(--info-fg)">
    <div class="row" style="flex-wrap:wrap;gap:6px"><b style="flex:1">${esc(t('wr_title'))}</b><button class="ghost small" data-wr-print title="${esc(t('wr_print_title'))}">🖨️ ${esc(t('wr_print'))}</button></div>
    <div class="muted" style="font-size:13px;margin:2px 0 2px">${esc(t('wr_sub'))}</div>
    ${blocks}</div>`);
  c.querySelectorAll('[data-wk]').forEach(row => row.onclick = () => openWirkstoff(row.dataset.wk));
  c.querySelector('[data-wr-print]').onclick = () => printWeekReview(wr);
  feed.appendChild(c);
}

// Wochenrückblick als druckbarer Team-Aushang (gleicher Rahmen wie die übrigen Aushänge).
function printWeekReview(wr) {
  const head = { neu: t('wr_neu'), wieder_verfuegbar: t('wr_wieder'), status: t('wr_status') };
  const sections = [
    { key: 'neu', items: (wr && wr.neu) || [] },
    { key: 'wieder_verfuegbar', items: (wr && wr.wieder_verfuegbar) || [] },
    { key: 'status', items: (wr && wr.status) || [] },
  ].filter(s => s.items.length);
  const rows = (items) => items.map(it => {
    const m = watchStatusMeta(it.status);
    return `<tr><td class="wk">${esc(it.wirkstoff)}${it.bezeichnung ? `<div class="pr">${esc(it.bezeichnung)}</div>` : ''}</td>
      <td><span class="st" style="color:${m.color};background:${m.bg}">${esc(m.icon)} ${esc(m.label)}</span></td>
      <td class="nt">${esc(wrDaysAgo(it.week_change))}</td></tr>`;
  }).join('');
  const groups = sections.map(s => `<h2>${esc(head[s.key])}</h2><table><tbody>${rows(s.items)}</tbody></table>`).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} h2{font-size:15px;margin:20px 0 6px;color:#333} .meta{color:#555;font-size:13px;margin-bottom:8px}
    table{width:100%;border-collapse:collapse} td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px}
    .wk{font-weight:700} .pr{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .st{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap} .nt{font-size:13px;color:#555}
    .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>📋 ${esc(t('wr_print_title'))}</h1><div class="meta">${esc(ti('wr_print_asof', { date: printDate() }))}</div>
    ${groups}<div class="src">${esc(t('wr_print_foot'))}</div>`;
  openPrintDoc(t('wr_print_title'), css, body);
}

async function renderWatchlistCard(feed, items, suggestions = [], premium = false) {
  const alerts = items.filter(i => i.status === 'kritisch' || i.status === 'eingeschraenkt').length;
  const card = el(`<div class="card">
    <div class="row" style="flex-wrap:wrap;gap:6px 8px;align-items:center"><b>${esc(t('wl_title'))}</b>
      ${alerts?`<span style="background:#c0392b;color:#fff;border-radius:999px;font-size:12px;font-weight:700;padding:2px 8px">${alerts} ${esc(alerts>1?t('wl_alerts_pl'):t('wl_alerts_sg'))}</span>`:''}
      ${items.length?`<button class="ghost small" data-wl-csv title="${esc(t('wl_csv_title'))}">⬇️ CSV</button>`:''}
      ${premium?`<button class="ghost small" data-wl-print title="${esc(t('wl_print_title'))}">🖨️ ${esc(t('wl_print'))}</button>`:''}
    </div>
    <div class="muted" style="font-size:13px;margin:2px 0 8px">${esc(t('wl_sub'))}</div>
    ${items.length>=2?`<div class="row" data-bulkalert style="flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px;background:var(--chip-bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px">
      <span aria-hidden="true">🔔</span><span style="font-size:13px">${esc(t('wl_alert_all_label'))}</span>
      <input type="number" min="1" max="99" data-baval placeholder="${esc(t('wk_alert_ph'))}" style="width:74px" aria-label="${esc(t('wl_alert_all_aria'))}"><span>%</span>
      <button class="small" data-baset>${esc(t('wl_alert_all_set'))}</button>
      <button class="ghost small" data-baoff>${esc(t('wl_alert_all_off'))}</button>
      <span class="muted" data-bamsg style="font-size:12px;color:var(--ok-fg)"></span>
    </div>`:''}
    <div data-wl></div>
    <div data-wl-sug></div>
    <div class="row" style="margin-top:8px;gap:6px">
      <input data-wl-in placeholder="${esc(t('wl_ph'))}" style="flex:1" aria-label="${esc(t('wl_add_aria'))}">
      <button class="small" data-wl-add>${esc(t('wl_add'))}</button>
    </div>
    <div class="err" data-wl-err></div>
  </div>`);
  const box = card.querySelector('[data-wl]');
  const sugBox = card.querySelector('[data-wl-sug]');
  const err = card.querySelector('[data-wl-err]');
  // Sammel-Rabattalarm: eine Schwelle für alle beobachteten Wirkstoffe auf einmal.
  const baSet = card.querySelector('[data-baset]');
  if (baSet) {
    const baVal = card.querySelector('[data-baval]');
    const baMsg = card.querySelector('[data-bamsg]');
    const apply = async (clear) => {
      const val = clear ? null : (baVal.value === '' ? null : Number(baVal.value));
      if (!clear && val == null) { err.textContent = t('wl_alert_all_need'); return; }
      err.textContent = '';
      try {
        const r = await api('POST','/api/watchlist/alert-all',{ pct: val });
        draw(r.items); refreshWatchAlerts(r.items);
        if (!clear) baVal.value = '';
        baMsg.textContent = clear ? t('wl_alert_all_off_done') : ti('wl_alert_all_done',{ n: r.count, pct: r.pct });
        setTimeout(()=>{ baMsg.textContent=''; }, 2600);
      } catch(e){ err.textContent = e.message; }
    };
    baSet.onclick = () => apply(false);
    card.querySelector('[data-baoff]').onclick = () => apply(true);
  }
  // Beobachtungsliste mit aktuellem Status als CSV (Team-Aushang am Handverkaufstisch).
  const csvBtn = card.querySelector('[data-wl-csv]');
  if (csvBtn) csvBtn.onclick = () => {
    const cur = renderWatchlistCard._items || items;
    // Premium: private Notizen als zusätzliche Spalte mit exportieren.
    const header = ['Wirkstoff', 'Aktueller Status', 'Präparat'];
    if (premium) header.push('Notiz');
    const rows = cur.map(it => {
      const r = [it.wirkstoff, watchStatusMeta(it.status).label, it.bezeichnung || ''];
      if (premium) r.push(it.note || '');
      return r;
    });
    downloadCsv('apopulse-merkliste', header, rows);
  };
  // Premium: druckbarer Team-Aushang (mit Status + Notizen) zum Aushängen am HV-Tisch.
  const printBtn = card.querySelector('[data-wl-print]');
  if (printBtn) printBtn.onclick = () => printWatchlist(renderWatchlistCard._items || items);
  // Schnell-Vorschläge aus aktuell kritischen Engpässen (nur noch nicht beobachtete).
  function drawSuggestions(list) {
    const have = new Set(list.map(i => i.wirkstoff.trim().toLowerCase()));
    const open = suggestions.filter(s => s.wirkstoff && !have.has(s.wirkstoff.trim().toLowerCase()));
    sugBox.innerHTML = '';
    if (!open.length) return;
    const wrap = el(`<div style="margin-top:8px"><div class="muted" style="font-size:12px">${esc(t('wl_quick'))}</div><div class="row" data-chips style="flex-wrap:wrap;gap:6px;margin-top:4px"></div></div>`);
    const chips = wrap.querySelector('[data-chips]');
    open.slice(0, 6).forEach(s => {
      const chip = el(`<button class="small sortbtn">🔴 ${esc(s.wirkstoff)} +</button>`);
      chip.onclick = async () => {
        chip.disabled = true;
        try { const r = await api('POST','/api/watchlist',{ wirkstoff: s.wirkstoff }); draw(r.items); }
        catch(e){ err.textContent = e.message; chip.disabled = false; }
      };
      chips.appendChild(chip);
    });
    if (open.length >= 2) {
      const all = el(`<button class="small" style="margin-top:6px">${esc(ti('wl_all', { n: open.length }))}</button>`);
      all.onclick = async () => {
        all.disabled = true;
        try {
          let items = null;
          for (const s of open) { items = (await api('POST','/api/watchlist',{ wirkstoff: s.wirkstoff })).items; }
          if (items) draw(items);
        } catch(e){ err.textContent = e.message; all.disabled = false; }
      };
      wrap.appendChild(all);
    }
    sugBox.appendChild(wrap);
  }
  function draw(list) {
    renderWatchlistCard._items = list;         // Merker für den CSV-Export
    if (csvBtn) csvBtn.style.display = list.length ? '' : 'none';
    if (printBtn) printBtn.style.display = list.length ? '' : 'none';
    box.innerHTML = '';
    if (!list.length) { box.appendChild(el(`<div class="muted" style="font-size:14px">${esc(t('wl_empty'))}</div>`)); drawSuggestions(list); return; }
    list.forEach(it => {
      const m = watchStatusMeta(it.status);
      const row = el(`<div class="comment">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">${m.icon}</span>
          <div style="flex:1;min-width:0">
            <div><b>${esc(it.wirkstoff)}</b></div>
            <div style="display:inline-block;font-size:12px;font-weight:700;color:${m.color};background:${m.bg};padding:2px 8px;border-radius:999px;margin-top:2px">${m.label}</div>${shortageCountdown(it)}
            ${it.bezeichnung?`<div class="muted" style="font-size:12px;margin-top:2px">${esc(it.bezeichnung)}</div>`:''}
          </div>
          ${it.shortage_id?`<button class="ghost small" data-open>${esc(t('wl_view'))}</button>`:''}
          <button class="ghost small" data-rm title="${esc(t('wl_remove'))}" aria-label="${esc(t('wl_remove'))}">✕</button>
        </div>
        <div data-alert-wrap style="margin-top:6px"></div>
        ${premium?`<div class="wl-note" data-note-wrap style="margin-top:6px"></div>`:''}
      </div>`);
      if (it.shortage_id) row.querySelector('[data-open]').onclick = () => openWirkstoff(it.wirkstoff);
      // Rabatt-Alarm direkt an der Beobachtungsliste setzen/ändern (nicht nur auf der
      // Wirkstoff-Detailseite) — benachrichtigt, sobald es eine Aktion ab X % gibt.
      {
        const aw = row.querySelector('[data-alert-wrap]');
        const renderAlert = () => {
          aw.innerHTML = '';
          if (it.alert_pct) {
            const view = el(`<div class="row" style="gap:6px;align-items:center"><span style="display:inline-block;font-size:12px;font-weight:700;color:var(--ok-fg);background:var(--ok-bg);border:1px solid var(--ok-bd);padding:2px 8px;border-radius:999px">${esc(ti('wl_alert_on',{n:it.alert_pct}))}</span><button class="linklike small" data-aedit>${esc(t('wl_alert_edit'))}</button></div>`);
            view.querySelector('[data-aedit]').onclick = editAlert;
            aw.appendChild(view);
          } else {
            const b = el(`<button class="linklike small" data-aset>${esc(t('wl_alert_set'))}</button>`);
            b.onclick = editAlert;
            aw.appendChild(b);
          }
        };
        const editAlert = () => {
          aw.innerHTML = '';
          const ed = el(`<div class="row" style="gap:6px;align-items:center"><span aria-hidden="true">🔔</span><input type="number" min="1" max="99" class="wl-alert-in" value="${it.alert_pct||''}" placeholder="${esc(t('wk_alert_ph'))}" style="width:80px" aria-label="${esc(t('wk_alert_label'))}"><span>%</span><button class="small" data-asave>${esc(t('wl_note_save'))}</button>${it.alert_pct?`<button class="linklike small" data-aoff>${esc(t('wl_alert_off_btn'))}</button>`:''}</div>`);
          aw.appendChild(ed);
          const inp = ed.querySelector('.wl-alert-in'); inp.focus();
          const save = async (clear) => {
            const val = clear ? null : (inp.value === '' ? null : Number(inp.value));
            try { const r = await api('POST', `/api/watchlist/${encodeURIComponent(it.wirkstoff)}/alert`, { pct: val });
              const fresh = (r.items || []).find(x => x.wirkstoff.toLowerCase() === it.wirkstoff.toLowerCase());
              it.alert_pct = fresh ? fresh.alert_pct : val; renderAlert();
            } catch(e){ err.textContent = e.message; }
          };
          ed.querySelector('[data-asave]').onclick = () => save(false);
          const off = ed.querySelector('[data-aoff]'); if (off) off.onclick = () => save(true);
          inp.onkeydown = (e) => { if (e.key === 'Enter') save(false); };
        };
        renderAlert();
      }
      row.querySelector('[data-rm]').onclick = async () => {
        try { const r = await api('DELETE','/api/watchlist/'+encodeURIComponent(it.wirkstoff)); draw(r.items); refreshWatchAlerts(r.items); }
        catch(e){ err.textContent = e.message; }
      };
      // Premium: private Notiz je Wirkstoff (anzeigen + inline bearbeiten).
      if (premium) {
        const nw = row.querySelector('[data-note-wrap]');
        const renderNote = () => {
          nw.innerHTML = '';
          if (it.note) {
            const view = el(`<div class="row" style="gap:6px;align-items:flex-start"><span style="flex:1;font-size:13px">📝 ${esc(it.note)}</span><button class="linklike small" data-edit>${esc(t('wl_note_edit'))}</button></div>`);
            view.querySelector('[data-edit]').onclick = () => editNote();
            nw.appendChild(view);
          } else {
            const addb = el(`<button class="linklike small" data-add>${esc(t('wl_note_add'))}</button>`);
            addb.onclick = () => editNote();
            nw.appendChild(addb);
          }
        };
        const editNote = () => {
          nw.innerHTML = '';
          const ed = el(`<div class="row" style="gap:6px"><input class="wl-note-in" value="${esc(it.note||'')}" placeholder="${esc(t('wl_note_ph'))}" maxlength="280" style="flex:1"><button class="small" data-save>${esc(t('wl_note_save'))}</button></div>`);
          nw.appendChild(ed);
          const inp = ed.querySelector('.wl-note-in'); inp.focus();
          const save = async () => {
            try { const r = await api('POST', `/api/watchlist/${encodeURIComponent(it.wirkstoff)}/note`, { note: inp.value });
              const fresh = (r.items || []).find(x => x.wirkstoff.toLowerCase() === it.wirkstoff.toLowerCase());
              it.note = fresh ? fresh.note : inp.value.trim(); renderNote();
            } catch(e){ err.textContent = e.message; }
          };
          ed.querySelector('[data-save]').onclick = save;
          inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
        };
        renderNote();
      }
      box.appendChild(row);
    });
    drawSuggestions(list);
  }
  draw(items);
  const input = card.querySelector('[data-wl-in]');
  async function add() {
    const w = input.value.trim(); err.textContent = '';
    if (!w) return;
    // Mehrere auf einmal: mit Komma/Semikolon/Zeile getrennt einfügen (Massen-Beobachtung).
    const multi = /[,;\n]/.test(w);
    try {
      const r = multi ? await api('POST','/api/watchlist/bulk',{ wirkstoffe:w }) : await api('POST','/api/watchlist',{ wirkstoff:w });
      input.value=''; draw(r.items); refreshWatchAlerts(r.items);
    } catch(e){ err.textContent = e.message; }
  }
  card.querySelector('[data-wl-add]').onclick = add;
  input.onkeydown = (e) => { if (e.key === 'Enter') add(); };
  // Für Gratis-Nutzer:innen ein dezenter, ehrlicher Hinweis auf den Premium-Zusatznutzen
  // dieser Liste (private Notizen + druckbarer Aushang). Kein Sperren von Kern-Funktionen.
  if (!premium) {
    const hint = el(`<div class="row" style="margin-top:8px;gap:8px;align-items:center;font-size:13px">
      <span class="muted" style="flex:1;min-width:140px">${esc(t('wl_premium_hint'))}</span>
      <button class="ghost small" data-upsell>${esc(t('wl_premium_cta'))}</button>
    </div>`);
    hint.querySelector('[data-upsell]').onclick = () => { if (typeof openPremium === 'function') openPremium(); };
    card.appendChild(hint);
  }
  feed.appendChild(card);
}

// Premium: Beobachtungsliste als sauberer, druckbarer Team-Aushang (Status + Notizen).
// ── Gemeinsame Druck-Helfer (von allen window.open-Druck-Reports genutzt) ──
// Locale-korrektes Datum bzw. Geldbetrag für Druck-Reports.
function printDate() { return new Date().toLocaleDateString(LOCALE === 'de' ? 'de-AT' : LOCALE === 'pt' ? 'pt-PT' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); }
function printMoney(v) { return LOCALE === 'en' ? Number(v).toFixed(2) : Number(v).toFixed(2).replace('.', ','); }
// Öffnet ein Druck-Dokument mit gemeinsamem Rahmen (Popup-Guard, <head>/<body>, Auto-Print).
// `css` bleibt pro Report unverändert -> keine visuelle Änderung. Gibt false bei Popup-Blocker.
function openPrintDoc(title, css, bodyHtml, lang = LOCALE) {
  const win = window.open('', '_blank');
  if (!win) { alert(t('pi_popup')); return false; }
  win.document.write(`<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
  return true;
}

function printWatchlist(items) {
  const list = items || [];
  const rows = list.map(it => {
    const m = watchStatusMeta(it.status);
    return `<tr>
      <td class="wk">${esc(it.wirkstoff)}${it.bezeichnung ? `<div class="pr">${esc(it.bezeichnung)}</div>` : ''}</td>
      <td><span class="st" style="color:${m.color};background:${m.bg}">${esc(m.icon)} ${esc(m.label)}</span></td>
      <td class="nt">${it.note ? esc(it.note) : '<span class="empty">—</span>'}</td>
    </tr>`;
  }).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} .meta{color:#555;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px}
    td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px} .wk{font-weight:700} .pr{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .st{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap} .nt{font-size:13px} .empty{color:#999}
    .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>💊 ${esc(t('wl_print_title'))}</h1><div class="meta">${esc(ti('wl_print_asof', { date: printDate() }))} · ${esc(list.length === 1 ? t('wl_print_count_sg') : ti('wl_print_count', { n: list.length }))}</div>
    <table><thead><tr><th>${esc(t('wl_print_col_sub'))}</th><th>${esc(t('wl_print_col_status'))}</th><th>${esc(t('wl_print_col_note'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="src">${esc(t('wl_print_foot'))}</div>`;
  openPrintDoc(t('wl_print_title'), css, body);
}

// Druck-Aushang der offenen Team-Aufgaben (für die Morgen-Besprechung). Zeigt nur
// nicht-erledigte Aufgaben, überfällige klar markiert — konsistent zu den übrigen
// „Aushang/Drucken"-Funktionen (Engpässe, Beobachtungsliste, Preise, Rabatte).
function printTasks(tasks) {
  const localToday = taskToday();
  const open = (tasks || []).filter(tk => tk.status !== 'erledigt')
    .sort((a,b) => (a.due_date||'9999').localeCompare(b.due_date||'9999')); // frühester Termin zuerst, ohne Termin ans Ende
  const stLabel = { offen: t('tk_st_offen'), in_arbeit: t('tk_st_in_arbeit') };
  const rows = open.map(tk => {
    const overdue = taskIsOverdue(tk, localToday);
    const due = tk.due_date ? `${esc(fmtDateDe(tk.due_date))}${overdue?` <b class="od">(${esc(t('tk_overdue'))})</b>`:''}` : '<span class="empty">—</span>';
    return `<tr>
      <td class="tk">${esc(tk.title)}${tk.description?`<div class="ds">${esc(tk.description)}</div>`:''}</td>
      <td>${tk.assignee_name?esc(tk.assignee_name):`<span class="empty">${esc(t('tk_unassigned'))}</span>`}</td>
      <td>${due}</td>
      <td>${esc(stLabel[tk.status]||tk.status)}</td>
    </tr>`;
  }).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} .meta{color:#555;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px}
    td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px} .tk{font-weight:700} .ds{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .od{color:#b3261e} .empty{color:#999} .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>✅ ${esc(t('tk_print_title'))}</h1><div class="meta">${esc(ti('wl_print_asof', { date: printDate() }))} · ${esc(open.length === 1 ? t('tk_print_count_sg') : ti('tk_print_count', { n: open.length }))}</div>
    <table><thead><tr><th>${esc(t('tk_print_col_task'))}</th><th>${esc(t('tk_print_col_assignee'))}</th><th>${esc(t('tk_f_due'))}</th><th>${esc(t('csv_status'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="src">${esc(t('tk_print_foot'))}</div>`;
  openPrintDoc(t('tk_print_title'), css, body);
}

// Aktualisiert die kritische Kennzahl-Kachel nach Änderung der Beobachtungsliste.
function refreshWatchAlerts() { /* Kennzahlen werden beim nächsten Overview-Aufruf frisch geladen */ }

// Einheitlicher Fehlerzustand: freundliche Karte statt nackter roter Textzeile,
// mit „Erneut versuchen"-Aktion.
function errorState(message, onRetry) {
  const card = el(`<div class="card empty">
    <div class="empty-ic" aria-hidden="true">⚠️</div>
    <div class="empty-t">${esc(t('err_title'))}</div>
    <div class="err empty-s" role="alert" style="margin-top:6px">${esc(message || t('err_generic'))}</div>
    ${onRetry ? `<div style="margin-top:12px"><button class="small" data-retry>${esc(t('err_retry'))}</button></div>` : ''}
  </div>`);
  if (onRetry) card.querySelector('[data-retry]').onclick = onRetry;
  return card;
}

// Einheitlicher Leerzustand: Icon, Titel, erklärender Text, optionale Aktion.
function emptyState({ icon = '🗒️', title, text = '', cta = null }) {
  const card = el(`<div class="card empty">
    <div class="empty-ic" aria-hidden="true">${icon}</div>
    <div class="empty-t">${esc(title)}</div>
    ${text ? `<div class="muted empty-s">${esc(text)}</div>` : ''}
    ${cta ? `<div style="margin-top:12px"><button class="small" data-cta>${esc(cta.label)}</button></div>` : ''}
  </div>`);
  if (cta) card.querySelector('[data-cta]').onclick = cta.onClick;
  return card;
}

// Leerer Zustand einer GEFILTERTEN Datenliste (Engpässe/Preise/Rabatte): zeigt den
// Hinweistext und – wenn ein Filter/Suchbegriff aktiv ist – einen sichtbaren
// „Filter zurücksetzen"-Button. Owner-Prinzip: den Ausweg als Knopf anbieten, nicht
// nur im Text erwähnen (offensichtliche Bedienung, keine versteckte Geste).
// ── Ehrliche Ansage statt wortloser Leere ───────────────────────────────────
//  Eine leere Liste ohne Erklaerung ist das teuerste Signal, das die Plattform
//  senden kann: Sie sieht aus wie ein Defekt, und die Nutzerin sucht den
//  Fehler bei sich. Genau das drohte in zwoelf der sechzehn Laender — dort ist
//  eine Quelle EINGETRAGEN, aber sie liefert nicht.
//
//  Ausblenden waere das Naheliegende gewesen und war falsch: Nigeria, Kenia,
//  Ghana, Angola und Mocambique tragen die Afrika-Strategie. Ein Land
//  unsichtbar zu machen, um ein Anzeigeproblem zu loesen, legt den Markt still.
//
//  Der Zustand kommt aus dem letzten echten Durchlauf (services/coverage.js),
//  nicht aus einer Liste im Code. Faengt eine Behoerde wieder an zu liefern,
//  verschwindet der Hinweis von selbst.
//  `art` unterscheidet Nachrichten und Engpaesse. Das ist keine Feinheit:
//  Oesterreich bezieht Nachrichten vom BASG-Newsfeed und Engpaesse aus einer
//  anderen BASG-Schnittstelle. Ohne die Trennung erklaerte sich die leere
//  Engpass-Liste mit der Gesundheit des Newsfeeds — also womoeglich mit
//  „laeuft alles", waehrend nichts ankommt.
const coverageCache = new Map();
async function ladeCoverage(land, art = 'news') {
  if (!land) return null;
  const key = art + ':' + land;
  if (coverageCache.has(key)) return coverageCache.get(key);
  let st = null;
  try {
    st = await (await fetch(`/api/coverage/${encodeURIComponent(land)}?art=${encodeURIComponent(art)}`)).json();
  } catch { st = null; }
  coverageCache.set(key, st);
  return st;
}

/** Erklaerkarte, oder null wenn es nichts zu erklaeren gibt. */
function coverageKarte(status) {
  // 'liefert' braucht keine Erklaerung: Dann ist die Liste aus einem anderen
  // Grund leer (Filter, oder die Behoerde hat schlicht nichts gemeldet), und
  // eine Stoerungsmeldung waere hier eine Falschaussage.
  if (!status || status.zustand === 'liefert') return null;
  const koerper = status.zustand === 'stumm' ? 'cov_stumm_body'
    : status.zustand === 'unbekannt' ? 'cov_unbekannt_body'
      : 'cov_keine_body';
  const titel = status.zustand === 'stumm' ? `<b>${esc(t('cov_stumm_title'))}</b>` : '';
  // Wer nicht antwortet, wird benannt. „Die NAFDAC antwortet nicht" ist eine
  // Aussage, mit der eine Apotheke etwas anfangen kann; „keine Daten" nicht.
  const wer = (status.stumm && status.stumm.length)
    ? `<div class="muted" style="margin-top:8px;font-size:13px">${esc(ti('cov_quellen', { q: status.stumm.join(', ') }))}</div>` : '';
  return el(`<div class="card">${titel}<div class="muted" style="margin-top:${titel ? '6px' : '0'}">${esc(t(koerper))}</div>${wer}</div>`);
}

function filteredEmptyCard(msgKey, active, onReset) {
  const card = el(`<div class="card"><div class="muted">${esc(t(msgKey))}</div>${active ? `<div style="margin-top:10px"><button class="small" data-reset>↺ ${esc(t('sh_reset'))}</button></div>` : ''}</div>`);
  const btn = card.querySelector('[data-reset]');
  if (btn) btn.onclick = onReset;
  return card;
}

// aria-current an der aktiven Registerkarte spiegeln (Aktiv-Zustand nicht nur
// über Farbe, sondern auch für Screenreader/Tastatur erkennbar).
function setTabAria() {
  document.querySelectorAll('.tabs button').forEach(x => {
    if (x.classList.contains('active')) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
}
// Browsertab-Titel je Ansicht setzen (Orientierung, History, Screenreader).
const BASE_TITLE = 'ApoPulse';
function setDocTitle(section) { document.title = section ? `${section} · ${BASE_TITLE}` : `${BASE_TITLE} — ${t('dt_tagline')}`; }
// Browsertab-Titel je Reiter (übersetzt, ohne Emoji): Schlüssel, zur Laufzeit via t().
const TAB_TITLES = { overview:'dt_overview', public:'dt_public', home:'dt_home', shortages:'dt_shortages', prices:'dt_prices', rabatte:'dt_rabatte', exchange:'dt_exchange', news:'dt_news' };

// Rechtlich gesperrte Reiter fürs Heimatland ausblenden (aus /api/country-config).
async function applyCountryGating() {
  try {
    const cfg = await api('GET', '/api/country-config');
    COUNTRY_FEAT = {}; COUNTRY_NAME = cfg.country_name || '';
    (cfg.active_features || []).forEach(f => {
      if (f.status === 'blocked' || f.status === 'restricted') {
        COUNTRY_FEAT[f.feature_id] = f.status;
        if (f.legal_reason) COUNTRY_FEAT[f.feature_id + '__reason'] = f.legal_reason;
      }
    });
  } catch { COUNTRY_FEAT = {}; }
  Object.entries(FEATURE_TAB).forEach(([feat, tabName]) => {
    const b = app.querySelector('.tabs button[data-tab="' + tabName + '"]');
    if (b) b.style.display = featBlocked(feat) ? 'none' : '';
  });
}

function loadTab() {
  // Reiterwechsel beginnt oben: Ohne das behält das Fenster die alte Scroll-Position,
  // sodass man nach dem Wechsel (z. B. von einer langen Engpass-Liste zu „Preise")
  // mitten im neuen Inhalt landet. Nur echte Navigation läuft über loadTab() —
  // In-Place-Aktualisierungen (bestätigen/auflösen/reagieren) rufen die Spezial-Lader
  // direkt und bleiben daher an Ort und Stelle. Sofort (nicht smooth): auf mobil soll
  // der Wechsel unmittelbar oben starten, ohne sichtbaren Scroll-Flug.
  window.scrollTo({ top: 0 });
  // Compose- und Folgen-Boxen gehören zum sozialen Feed — nur dort zeigen, damit
  // die Daten-Reiter (Engpässe/Preise/Rabatte/…) nicht hinter Formularen liegen.
  const sc = document.getElementById('socialCompose');
  if (sc) sc.style.display = (tab === 'public' || tab === 'home') ? '' : 'none';
  setDocTitle(TAB_TITLES[tab] ? t(TAB_TITLES[tab]) : '');
  setTabAria();
  // Rechts-Gate: gesperrter Reiter (z.B. Deep-Link) zeigt statt Inhalt einen Sperr-Hinweis.
  const gatedFeature = TAB_FEATURE[tab];
  if (gatedFeature && featBlocked(gatedFeature)) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    const n = legalNotice(gatedFeature); if (n) feed.appendChild(n);
    return;
  }
  if (tab === 'overview') return loadOverview();
  if (tab === 'shortages') return loadShortages();
  if (tab === 'prices') return loadPrices();
  if (tab === 'rabatte') return loadRabatte();
  if (tab === 'exchange') return loadExchange();
  if (tab === 'news') return loadNews();
  loadFeed();
}

// ── News-Livestream (linke Seitenleiste, nur auf breiten Bildschirmen) ──
let newsRailTimer = null;      // Polling-Intervall
let newsRailSeen = null;       // bekannte News-IDs (für „neu"-Markierung)
// Sanfter Hinweis auf der Startseite, das eigene Profil zu vervollständigen — nur wenn
// es noch nicht 100 % ist. Hilft Neuen, ihr Profil überhaupt zu finden/auszufüllen.
function renderProfileNudge(feed) {
  if (!featureAn('bindungsmechanik')) return;
  if (!me || !me.handle) return;
  const c = profileCompleteness(me);
  if (c.pct >= 100) return;
  const missing = c.items.filter(i => !i.done).slice(0, 4).map(i => i.label).join(' · ');
  const card = el(`<div class="card" style="border-left:4px solid var(--green)">
    <div class="row" style="align-items:center;gap:8px"><b style="flex:1">🙋 ${esc(ti('ov_profile_nudge', { pct: c.pct }))}</b><b>${c.pct}%</b></div>
    <div class="pfc-bar" style="margin-top:6px"><span style="width:${c.pct}%"></span></div>
    <div class="muted" style="font-size:13px;margin:6px 0">${esc(t('ov_profile_nudge_sub'))}${missing ? ' — ' + esc(missing) : ''}</div>
    <div class="row"><button class="small" data-editprofile>${esc(t('pfc_cta'))}</button></div>
  </div>`);
  card.querySelector('[data-editprofile]').onclick = () => openProfile(me.handle);
  feed.appendChild(card);
}

// News-Karten inline in „Für dich" — nur auf schmalen Screens (Handy), wo die feste
// Seitenleiste nicht sichtbar ist. Gleiche 𝕏-Karten-Optik wie der Livestream links.
async function renderNewsInline(feed) {
  if (window.matchMedia('(min-width:1300px)').matches) return; // breit: Seitenleiste zeigt News
  let d;
  try { d = await api('GET', '/api/news?country=' + viewCountry()); } catch { return; }
  const top = ((d && d.posts) || []).slice(0, 3);
  if (!top.length) return;
  const card = el(`<div class="card news-inline">
    <div class="row" style="align-items:center;gap:8px;margin-bottom:8px"><span class="nr-live" aria-hidden="true"></span><b style="flex:1">${esc(t('nr_title'))}</b><button class="ghost small" data-all>${esc(t('nav_news'))}</button></div>
    <div data-nl></div></div>`);
  const box = card.querySelector('[data-nl]');
  top.forEach(p => {
    const handle = (p.author && p.author.handle) ? '@' + p.author.handle : ((p.author && p.author.display_name) || t('prov_editorial'));
    const body = (p.body || '').trim() || (p.image ? t('pc_img_alt') : '');
    const b = el(`<button class="nr-card" data-openpost="${esc(p.id)}">
      <div class="nr-src"><span class="nr-x" aria-hidden="true">𝕏</span><span class="nr-handle">${esc(handle)}</span><span class="nr-time">${relTime(p.created_at)}</span></div>
      <div class="nr-body">${esc(body.slice(0, 220))}</div></button>`);
    b.onclick = () => openPost(p.id);
    box.appendChild(b);
  });
  card.querySelector('[data-all]').onclick = () => switchTab('news');
  feed.appendChild(card);
}

async function refreshNewsRail() {
  const rail = document.getElementById('newsRail');
  if (!rail || !rail.classList.contains('on')) return;
  let posts = [];
  try { const d = await api('GET', '/api/news?country=' + viewCountry()); posts = (d && d.posts) || []; }
  catch { return; } // still: bestehende Liste stehen lassen
  const top = posts.slice(0, 8);
  const firstLoad = newsRailSeen === null;
  const seen = newsRailSeen || new Set();
  const items = top.map(p => {
    const isNew = !firstLoad && !seen.has(p.id);
    // Euronews-Stil: „𝕏 @handle"-Kopf pro Karte. Fallback: Anzeigename bzw. Redaktion.
    const handle = (p.author && p.author.handle) ? '@' + p.author.handle : ((p.author && p.author.display_name) || t('prov_editorial'));
    const body = (p.body || '').trim() || (p.image ? t('pc_img_alt') : '');
    return `<button class="nr-card${isNew ? ' nr-new' : ''}" data-openpost="${esc(p.id)}">
      <div class="nr-src"><span class="nr-x" aria-hidden="true">𝕏</span><span class="nr-handle">${esc(handle)}</span>${isNew ? `<span class="nr-newtag">${esc(t('nr_new'))}</span>` : ''}<span class="nr-time">${relTime(p.created_at)}</span></div>
      <div class="nr-body">${esc(body.slice(0, 220))}</div>
    </button>`;
  }).join('');
  newsRailSeen = new Set(top.map(p => p.id));
  rail.innerHTML = `
    <div class="nr-head"><span class="nr-live" aria-hidden="true"></span>${esc(t('nr_title'))}<span class="nr-clock">${esc(new Date().toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }))}</span></div>
    ${items || `<div class="muted" style="font-size:13px;padding:8px 4px">${esc(t('nw_empty'))}</div>`}`;
  rail.querySelectorAll('[data-openpost]').forEach(b => b.onclick = () => openPost(b.dataset.openpost));
}
// Schnellzugriff-Rail (Laptop/Desktop): füllt den leeren rechten Rand mit den sekundären
// Bereichen, die nicht in der Reiter-Leiste stehen. Per CSS nur ab 1240px sichtbar.
function renderQuickRail() {
  const rail = document.getElementById('quickRail');
  if (!rail) return;
  // Jeder Eintrag nennt den Bereich, zu dem er gehoert. Ohne diese Zuordnung
  // bot die Schnellzugriff-Leiste weiter Lesezeichen, Verzeichnis, Team,
  // Live-Sessions und Bestellungen an — allesamt ruhend, allesamt mit 404
  // beim Klick. Genau das Signal, das wie ein Defekt der Plattform aussieht
  // und das die Funktionsschaltung eigentlich verhindern soll. Gefunden erst,
  // als eine Browser-Pruefung den Ueberblick im Klartext ausgab.
  const items = [
    ['social', t('ov_bookmarks'), openBookmarks],
    ['verzeichnis', t('dir_nav'), () => openDirectory()],
    ['zusammenarbeit', t('th_nav'), () => openTeamHub()],
    ['termine', t('lv_nav'), () => openLive()],
    ['rabatte', t('wb_nav'), () => openPromotions()],
    ['bestellung', t('ord_title'), () => openOrders()],
  ].filter(([bereich]) => featureAn(bereich)).map(([, label, fn]) => [label, fn]);
  // Bleibt nichts uebrig, gehoert die Leiste ganz weg — eine leere Karte mit
  // Ueberschrift ist schlechter als keine Karte.
  if (!items.length) { stopQuickRail(); return; }
  rail.classList.add('on');
  rail.innerHTML = `<div class="card qr-card"><div class="qr-title">${esc(t('qr_title'))}</div>${items.map((it,i)=>`<button class="qr-link" data-qr="${i}">${esc(it[0])}</button>`).join('')}</div>`;
  rail.querySelectorAll('[data-qr]').forEach(b => { b.onclick = items[+b.dataset.qr][1]; });
}
function stopQuickRail() {
  const rail = document.getElementById('quickRail');
  if (rail) { rail.classList.remove('on'); rail.innerHTML = ''; }
}
// Anzeigen-Fläche (nur Laptop/Desktop, eigene Ebene rechts): zeigt EINE klar als „Anzeige"
// gekennzeichnete Werbung aus dem bestehenden Angebote-System — die Monetarisierungs-Fläche.
// Gibt es keine Anzeige, bleibt der Platz leer (die Seite wirkt nie überladen).
// ── Funktionsschaltung ──────────────────────────────────────────────────────
//  Welche Bereiche laufen, entscheidet der Server (src/data/features.js). Die
//  Oberflaeche fragt einmal beim Start und bietet nur an, was auch beantwortet
//  wird. Ein Reiter, der beim Klick 404 liefert, ist schlimmer als kein
//  Reiter: Er sieht aus wie ein Fehler der Plattform.
//
//  Faellt die Abfrage aus, gilt ALLES als aktiv. Lieber ein Reiter zu viel als
//  eine Anwendung, die nach einem Netzwackler halb leer startet.
const FEATURE_ZUSTAND = {};
async function ladeFeatures() {
  try {
    const d = await (await fetch('/api/features')).json();
    for (const f of (d.features || [])) FEATURE_ZUSTAND[f.id] = f.zustand;
  } catch { /* Voreinstellung: alles an */ }
}
const featureAn = (id) => FEATURE_ZUSTAND[id] !== 'ruht';

/** Bedienelemente ruhender Bereiche entfernen. Entfernen, nicht nur verstecken:
 *  Ein verstecktes Element bleibt per Tastatur erreichbar. */
function wendeFeaturesAn() {
  // Bewusst IMMER auf `document`: Die Kopfzeilen-Knoepfe (#btnDm, #btnCart)
  // liegen ausserhalb des App-Containers. Ein auf `app` begrenztes Aufraeumen
  // liess sie stehen — der Browser-Audit hat genau das gemeldet.
  const raus = [];
  if (!featureAn('tauschboerse')) raus.push('.tabs button[data-tab="exchange"]');
  if (!featureAn('bestellung')) raus.push('#btnCart');
  if (!featureAn('direktnachrichten')) raus.push('#btnDm');
  for (const sel of raus) document.querySelectorAll(sel).forEach((el) => el.remove());
}

async function renderAdSlot() {
  if (!featureAn('werbung')) return;
  const rail = document.getElementById('quickRail');
  if (!rail) return;
  let promos = [];
  try { promos = ((await api('GET', '/api/promotions')).promotions) || []; } catch { return; }
  if (!promos.length) return;
  const p = promos[Math.floor(Math.random() * Math.min(promos.length, 5))]; // leichte Rotation
  const author = p.author ? (p.author.display_name || ('@' + (p.author.handle || ''))) : '';
  const card = el(`<div class="card qr-ad clickable" data-openpromo="${esc(p.id)}" role="link" tabindex="0" aria-label="${esc(t('wb_ad'))}: ${esc(p.titel || '')}">
    <div class="qr-ad-label">${esc(t('wb_ad'))}</div>
    ${p.image ? `<img class="qr-ad-img" src="${esc(p.image)}" alt="">` : ''}
    <div class="qr-ad-cat">${esc(promoCatLabel(p.kategorie))}</div>
    <div class="qr-ad-title">${esc(p.titel || '')}</div>
    <div class="qr-ad-price">${promoPrice(p)}</div>
    ${author ? `<div class="qr-ad-by">${esc(t('wb_by'))} ${esc(author)}</div>` : ''}
    <div class="qr-ad-cta">${esc(t('wb_view'))} <span aria-hidden="true">›</span></div>
  </div>`);
  const open = () => openPromotionDetail(p.id);
  card.onclick = open;
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  rail.appendChild(card);
}
function startNewsRail() {
  const rail = document.getElementById('newsRail');
  if (!rail) return;
  rail.classList.add('on');
  newsRailSeen = null;
  refreshNewsRail();
  clearInterval(newsRailTimer);
  newsRailTimer = setInterval(refreshNewsRail, 30000); // „live": alle 30 Sekunden aktualisieren
}
function stopNewsRail() {
  clearInterval(newsRailTimer); newsRailTimer = null; newsRailSeen = null;
  const rail = document.getElementById('newsRail');
  if (rail) { rail.classList.remove('on'); rail.innerHTML = ''; }
}

async function loadNews() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  // Composer einklappbar (standardmäßig zu): so stehen die News zuerst (content-first,
  // weniger Scrollen). Wer News teilen will, klappt ihn mit einem Klick auf.
  feed.appendChild(el(`<div class="card">
    <button class="ghost small" data-ntoggle aria-expanded="false" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px">
      <b>${esc(t('news_compose'))}</b><span class="sp" style="flex:1"></span><span data-nchev aria-hidden="true">▸</span>
    </button>
    <div data-ncompose class="hidden" style="margin-top:8px">
      <label>${esc(t('nb_label'))}</label>
      <textarea id="nb" placeholder="${esc(t('nb_ph'))}"></textarea>
      <input id="nsrc" placeholder="${esc(t('nb_src_ph'))}" style="margin-top:6px">
      <div class="row" style="margin-top:6px">
        <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px">${esc(t('co_img'))}<input type="file" id="nimg" accept="image/*" style="display:none"></label>
        <span class="muted" id="nimgname" style="font-size:13px"></span>
        <button class="ghost small" id="nimgclear" style="display:none">✕</button>
      </div>
      <img id="nimgprev" data-i18n-alt="a11y_img_preview" alt="Bildvorschau" style="display:none;max-width:100%;border-radius:8px;margin-top:6px" />
      <div style="margin-top:8px"><button id="ngo">${esc(t('nb_share'))}</button></div>
      <div class="err" id="nerr"></div>
    </div>
  </div><div id="newslist"></div>`));
  { const tgl = document.querySelector('[data-ntoggle]'), cmp = document.querySelector('[data-ncompose]'), chev = document.querySelector('[data-nchev]');
    tgl.onclick = () => { const open = cmp.classList.toggle('hidden') === false; tgl.setAttribute('aria-expanded', String(open)); chev.textContent = open ? '▾' : '▸'; if (open) document.getElementById('nb').focus(); }; }
  let newsImage = null;
  const nimg = document.getElementById('nimg'), nimgprev = document.getElementById('nimgprev');
  const nimgname = document.getElementById('nimgname'), nimgclear = document.getElementById('nimgclear');
  const clearN = () => { newsImage=null; nimg.value=''; nimgprev.style.display='none'; nimgprev.src=''; nimgname.textContent=''; nimgclear.style.display='none'; };
  nimg.onchange = async () => {
    const f = nimg.files[0]; if (!f) return;
    try { newsImage = await fileToDataUrl(f); nimgprev.src=newsImage; nimgprev.style.display='block'; nimgname.textContent=f.name; nimgclear.style.display='inline-block'; document.getElementById('nerr').textContent=''; }
    catch(e){ document.getElementById('nerr').textContent = e.message; clearN(); }
  };
  nimgclear.onclick = clearN;
  attachMentionAutocomplete(document.getElementById('nb'));
  attachCharCounter(document.getElementById('nb'), 1000);
  document.getElementById('ngo').onclick = async () => {
    const ta = document.getElementById('nb');
    if (!ta.value.trim() && !newsImage) { document.getElementById('nerr').textContent=t('news_empty'); return; }
    try { await api('POST','/api/posts',{ body:ta.value, kind:'news', visibility:'public', image:newsImage, sourceUrl:v('nsrc') }); ta.value=''; document.getElementById('nsrc').value=''; clearN(); loadNews(); }
    catch(e){ document.getElementById('nerr').textContent = e.message; }
  };
  const list = document.getElementById('newslist');
  list.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/news?country=' + viewCountry());
    list.innerHTML = '';
    if (!d.posts.length) {
      // Dieselbe ehrliche Ansage wie bei den Engpaessen — hier mit der
      // NACHRICHTEN-Quelle, denn das sind andere Server. Ohne diese Karte
      // stand hier nur „keine News", und das liest sich wie ein Defekt.
      const st = await ladeCoverage(viewCountry(), 'news');
      const k = coverageKarte(st);
      if (k) list.appendChild(k);
      list.appendChild(el(`<div class="card muted">${esc(t('nw_empty'))}</div>`));
      return;
    }
    d.posts.forEach(p => list.appendChild(postCard(p)));
  } catch(e){ list.innerHTML = ''; list.appendChild(errorState(e.message, loadTab)); }
}

// Status-Kurzlabel (übersetzt) + feste Farbe (Farb-Semantik bleibt sprachunabhängig).
const STATUS_COLORS = { kritisch:'#c0392b', eingeschraenkt:'#c77700', verfuegbar:'#0b7f28' };
const STATUS_I18N = { kritisch:'st_krit_short', eingeschraenkt:'st_eing_short', verfuegbar:'st_verf_short' };
function statusShort(key) { return [ STATUS_I18N[key] ? t(STATUS_I18N[key]) : '?', STATUS_COLORS[key] || '#666' ]; }
// Herkunfts-Label (übersetzt) je Datenquelle.
const PROV_I18N = { verified:'prov_verified', reference:'prov_reference', simulated:'prov_simulated', editorial:'prov_editorial', community:'prov_community' };
function provLabel(key) { return PROV_I18N[key] ? t(PROV_I18N[key]) : (key || ''); }
// Engpass-Grund: bekannte Standard-Gründe (aus den Seed-Daten) übersetzen;
// frei eingegebene Community-Gründe bleiben unverändert (kein Falsch-Übersetzen).
const GRUND_I18N = { 'Erhöhte Nachfrage':'gr_demand', 'Herstellungsproblem':'gr_manuf', 'Kontingentierung':'gr_ration', 'Produktionsverzögerung':'gr_delay', 'Wirkstoffknappheit':'gr_api' };
function grundLabel(g) { return g ? (GRUND_I18N[g] ? t(GRUND_I18N[g]) : g) : ''; }

// Ehrlicher Länder-Hinweis: Die Live-Regulierungsdaten (Engpässe/Preise/Rabatte)
// stammen derzeit aus Österreich. Für andere Länder das offen ausweisen, statt
// AT-Daten stillschweigend als Landesdaten zu zeigen (Sicherheits-/Quellenpflicht,
// CLAUDE.md). Gibt null zurück, wenn das aktive Land Österreich ist.
function countryDataNotice() {
  const cc = (me && me.country) || 'AT';
  if (cc === 'AT') return null;
  const c = (COUNTRIES_CACHE || []).find(x => x.code === cc);
  const land = c ? `${c.flag} ${c.name}` : cc;
  return el(`<div class="card" style="border-color:var(--info-bd);background:var(--info-bg);color:var(--info-fg)">
    <b>${esc(ti('data_notice_title', { land }))}</b>
    <div style="margin-top:6px;font-size:14px;line-height:1.5">${esc(ti('data_notice_body', { land }))}</div>
  </div>`);
}

// Offizielle Arzneimittelbehörde des aktiven Landes als belegte Quelle (echter Link).
// Ohne verifizierten Link kein Link — nur den Behördennamen nennen (Quellenpflicht, CLAUDE.md).
function countryRegulatorCard(live = false) {
  const c = (COUNTRIES_CACHE || []).find(x => x.code === viewCountry());
  if (!c || !c.regulator) return null;
  const link = c.regulator_url
    ? `<a href="${esc(c.regulator_url)}" target="_blank" rel="noopener noreferrer" class="btn-link small">${esc(ti('reg_open', { reg: c.regulator }))}</a>`
    : `<span class="muted" style="font-size:13px">${esc(t('reg_no_link'))}</span>`;
  // Ehrliches Daten-Herkunfts-Signal: grün = echte Live-Daten angeschlossen, gelb = kuratierte
  // Referenzdaten (im Aufbau). Schafft Vertrauen und macht die Quellenlage transparent (CLAUDE.md).
  const pill = live
    ? `<span class="data-pill live" title="${esc(t('ds_live_title'))}">🟢 ${esc(t('ds_live'))}</span>`
    : `<span class="data-pill ref" title="${esc(t('ds_ref_title'))}">🟡 ${esc(t('ds_ref'))}</span>`;
  return el(`<div class="card"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">
    <span style="font-size:20px">🏛️</span>
    <div style="flex:1;min-width:180px">
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><span style="font-weight:700">${esc(ti('reg_title', { reg: c.regulator }))}</span>${pill}</div>
      <div class="muted" style="font-size:13px">${esc(ti('reg_sub', { land: c.flag + ' ' + c.name }))}</div>
    </div>
    ${link}
  </div></div>`);
}

// Währungsumrechner mit ECHTEN Live-Kursen (EUR-Basis, Quelle open.er-api.com). Nützlich für
// Import/Einkauf über Grenzen (NGN/BRL/AOA ↔ EUR/USD). Rendert asynchron; bei fehlenden Kursen
// ehrlicher Hinweis statt erfundener Zahlen. Rechnet A->B clientseitig über die EUR-Kreuzrate.
function renderCurrencyConverter(feed) {
  // Einklappbar + „lazy": entlastet die Übersicht (weniger Scrollen, CLAUDE.md) und ruft die
  // Live-Kurse erst beim Öffnen ab. Standardmäßig zu.
  const card = el(`<div class="card">
    <button class="ghost small" data-cc-toggle aria-expanded="false" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">🔁</span><b>${esc(t('cc_title'))}</b>
      <span class="muted" style="font-weight:400;font-size:13px">— ${esc(t('cc_hint'))}</span>
      <span class="sp" style="flex:1"></span><span data-cc-chev aria-hidden="true">▸</span>
    </button>
    <div data-cc class="hidden" style="margin-top:8px"></div>
  </div>`);
  feed.appendChild(card);
  const box = card.querySelector('[data-cc]'), toggle = card.querySelector('[data-cc-toggle]'), chev = card.querySelector('[data-cc-chev]');
  let built = false;
  toggle.onclick = () => {
    const open = box.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
    chev.textContent = open ? '▾' : '▸';
    if (open && !built) { built = true; buildCurrencyConverter(box); }
  };
}

async function buildCurrencyConverter(box) {
  box.textContent = '…'; box.classList.add('muted');
  let data;
  try { data = await api('GET', '/api/fx-rates'); } catch { data = null; }
  if (!data || !data.rates) { box.textContent = t('cc_unavailable'); return; }
  const rates = data.rates;
  // Währungsauswahl: EUR/USD + die Währungen aus dem Länder-Register, sofern Kurs vorhanden.
  const regCur = [...new Set((COUNTRIES_CACHE || []).map(c => c.currency))].filter(Boolean);
  const options = [...new Set(['EUR', 'USD', ...regCur])].filter(c => rates[c] > 0);
  const home = (COUNTRIES_CACHE || []).find(x => x.code === viewCountry());
  const fromDef = (home && rates[home.currency] > 0) ? home.currency : 'USD';
  const toDef = fromDef === 'EUR' ? 'USD' : 'EUR';
  const opts = (sel) => options.map(c => `<option value="${c}"${c === sel ? ' selected' : ''}>${c}</option>`).join('');
  box.classList.remove('muted');
  box.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
      <input data-amt type="number" min="0" step="any" value="100" style="width:110px" aria-label="${esc(t('cc_amount'))}">
      <select data-from aria-label="${esc(t('cc_from'))}">${opts(fromDef)}</select>
      <span>→</span>
      <select data-to aria-label="${esc(t('cc_to'))}">${opts(toDef)}</select>
      <button class="ghost small" data-swap title="${esc(t('cc_swap'))}" aria-label="${esc(t('cc_swap'))}">⇅</button>
    </div>
    <div data-res style="font-weight:700;font-size:18px;margin-top:8px"></div>
    <div class="muted" style="font-size:12px;margin-top:2px">${esc(ti('cc_updated', { date: data.updated_at ? new Date(data.updated_at).toLocaleDateString() : '—' }))} · open.er-api.com</div>`;
  const amt = box.querySelector('[data-amt]'), from = box.querySelector('[data-from]'), to = box.querySelector('[data-to]'), res = box.querySelector('[data-res]');
  const fmt = (n) => n.toLocaleString(LOCALE === 'en' ? 'en-GB' : LOCALE === 'pt' ? 'pt-PT' : 'de-AT', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const recompute = () => {
    const a = parseFloat(amt.value); const rf = rates[from.value], rt = rates[to.value];
    if (!(a >= 0) || !(rf > 0) || !(rt > 0)) { res.textContent = '—'; return; }
    const out = (a / rf) * rt;
    res.textContent = `${fmt(a)} ${from.value} = ${fmt(out)} ${to.value}`;
  };
  amt.oninput = recompute; from.onchange = recompute; to.onchange = recompute;
  box.querySelector('[data-swap]').onclick = () => { const f = from.value; from.value = to.value; to.value = f; recompute(); };
  recompute();
}

// Aufklappbare Legende zur Datenherkunft — schafft Vertrauen bei nicht-technischen
// Fachleuten und macht die Quellenpflicht sichtbar (CLAUDE.md). Standard: zugeklappt.
function provenanceLegend() {
  const card = el(`<div class="card" style="margin-bottom:10px">
    <button class="ghost small" data-tgl style="width:100%;text-align:left">${esc(t('pl_open'))}</button>
    <div class="hidden" data-body style="margin-top:8px;font-size:14px">
      <div class="comment">${t('pl_v')}</div>
      <div class="comment">${t('pl_r')}</div>
      <div class="comment">${t('pl_e')}</div>
      <div class="comment">${t('pl_c')}</div>
      <div class="muted" style="margin-top:6px">${esc(t('pl_note'))}</div>
    </div>
  </div>`);
  const body = card.querySelector('[data-body]');
  const btn = card.querySelector('[data-tgl]');
  btn.onclick = () => { const open = body.classList.toggle('hidden'); btn.textContent = open ? t('pl_open') : t('pl_close'); };
  return card;
}

async function loadShortages() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    // Wie bei den News: das ANGESEHENE Land, nicht das eigene.
    const d = await api('GET','/api/shortages?country=' + viewCountry());
    feed.innerHTML = '';
    { const n = countryDataNotice(); if (n) feed.appendChild(n); }
    feed.appendChild(provenanceLegend());
    feed.appendChild(reportShortageCard(d.shortages));
    const bar = shortageFilterBar();
    feed.appendChild(bar);
    const listBox = el('<div data-shortlist></div>');
    feed.appendChild(listBox);
    renderShortlist(listBox, bar, d.shortages);
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

// Filtert die (bereits geladenen) Engpässe und füllt nur die Listenbox — die
// Filterleiste bleibt bestehen, damit der Suchfokus beim Tippen nicht verloren geht.
// Prädikate je Filter — geteilt von Liste UND Chip-Zählern (eine Quelle der Wahrheit).
const SHORTAGE_FILTERS = {
  '': () => true,
  kritisch: s => s.status === 'kritisch',
  antibiotika: s => !!s.is_antibiotic,
  watched: s => !!s.watched,
  community: s => s.provenance === 'community',
  verfuegbar: s => s.status === 'verfuegbar',
};
function renderShortlist(listBox, bar, all) {
  const q = shortageQuery.trim().toLowerCase();
  // Basis = Textsuche angewandt; darauf zählen die Chips, damit die Zahlen zur Ansicht passen.
  const base = all.filter(s => !q || (s.wirkstoff||'').toLowerCase().includes(q) || (s.bezeichnung||'').toLowerCase().includes(q));
  bar.querySelectorAll('[data-f]').forEach(b => {
    const on = b.dataset.f === shortageFilter;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    const cs = b.querySelector('[data-fc]');
    if (cs) cs.textContent = String(base.filter(SHORTAGE_FILTERS[b.dataset.f] || (() => true)).length);
  });
  bar.querySelectorAll('[data-sort]').forEach(b => { const on = b.dataset.sort === shortageSort; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  const list = base.filter(SHORTAGE_FILTERS[shortageFilter] || (() => true));
  // Sortierung: kritischste zuerst (Status → Bestätigungen → Datum) oder neueste zuerst.
  const when = s => s.gemeldet_am || (s.created_at ? s.created_at.slice(0,10) : '');
  const rank = { kritisch: 3, eingeschraenkt: 2, verfuegbar: 1 };
  // Aktivität = wie breit die Community den Engpass bestätigt/bespricht (Bestätigungen + Beiträge).
  const activity = s => (s.confirm_count||0) + (s.post_count||0);
  list.sort((a, b) => {
    if (shortageSort === 'neu') return String(when(b)).localeCompare(String(when(a))) || (b.confirm_count||0) - (a.confirm_count||0);
    if (shortageSort === 'aktiv') return activity(b) - activity(a) || (rank[b.status]||0) - (rank[a.status]||0) || String(when(b)).localeCompare(String(when(a)));
    return (rank[b.status]||0) - (rank[a.status]||0) || (b.confirm_count||0) - (a.confirm_count||0) || String(when(b)).localeCompare(String(when(a)));
  });
  listBox.innerHTML = '';
  if (!list.length) {
    // Zuerst die Erklaerung, warum ueberhaupt nichts da ist — DANN der
    // Filter-Hinweis. Umgekehrt liest sich „Filter zuruecksetzen" wie die
    // Loesung eines Problems, das gar nicht am Filter liegt.
    // NUR wenn ueberhaupt nichts da ist. Ist die Liste blos wegen Filter oder
    // Suchbegriff leer, waere „die Behoerde hat nicht geantwortet" schlicht
    // falsch — die Daten sind ja da, sie wurden nur weggefiltert. Eine falsche
    // Stoerungsmeldung ist schlimmer als gar keine: Sie schickt die Nutzerin
    // auf die Suche nach einem Fehler, den es nicht gibt.
    if (!base.length && !shortageFilter && !q) {
      ladeCoverage(typeof viewCountry === 'function' ? viewCountry() : null, 'shortages').then((st) => {
        const k = coverageKarte(st);
        if (k && listBox.firstChild) listBox.insertBefore(k, listBox.firstChild);
        else if (k) listBox.appendChild(k);
      });
    }
    listBox.appendChild(filteredEmptyCard('sh_empty', !!(shortageFilter || q), () => {
      shortageFilter = ''; shortageQuery = '';
      const qin = bar.querySelector('[data-q]'); if (qin) qin.value = '';
      renderShortlist(listBox, bar, all);
    }));
  }
  else list.forEach(s => listBox.appendChild(shortageCard(s)));
  // Merker für Neu-Rendern nach Filter-/Suchänderung + Export der aktuellen Auswahl
  renderShortlist._ctx = { listBox, bar, all };
  renderShortlist._filtered = list;
  const csvBtn = bar.querySelector('[data-scsv]');
  if (csvBtn) csvBtn.textContent = `⬇️ CSV (${list.length})`;
}

// Filter- und Suchleiste für den Engpässe-Reiter.
function shortageFilterBar() {
  const chips = [['',t('sh_f_all')],['kritisch',t('sh_f_crit')],['antibiotika',t('sh_f_abx')],['watched',t('sh_f_watched')],['community',t('sh_f_comm')],['verfuegbar',t('sh_f_available')]];
  const bar = el(`<div class="card">
    <div class="row" style="gap:6px"><input data-q placeholder="${esc(t('sh_q_ph'))}" value="${esc(shortageQuery)}" style="flex:1"></div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      ${chips.map(([v,l])=>`<button class="small sortbtn${shortageFilter===v?' active':''}" data-f="${v}" aria-pressed="${shortageFilter===v}">${esc(l)} <span class="muted" data-fc></span></button>`).join('')}
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-sprint title="${esc(t('sh_print_t'))}">${esc(t('sh_print'))}</button>
      <button class="ghost small" data-scsv title="${esc(t('sh_csv_t'))}">⬇️ CSV</button>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
      <span class="muted" style="font-size:13px">${esc(t('sh_sort'))}</span>
      ${[['kritisch',t('sh_sort_crit')],['neu',t('sh_sort_new')],['aktiv',t('sh_sort_active')]].map(([v,l])=>`<button class="small sortbtn${shortageSort===v?' active':''}" data-sort="${v}" aria-pressed="${shortageSort===v}">${esc(l)}</button>`).join('')}
    </div>
  </div>`);
  const rerender = () => { const c = renderShortlist._ctx; if (c) renderShortlist(c.listBox, c.bar, c.all); };
  bar.querySelector('[data-sprint]').onclick = () => {
    const pd = document.getElementById('printdate');
    if (pd) pd.textContent = t('sh_print_asof') + new Date().toLocaleString(t('_bcp47')) + (shortageFilter?(t('sh_print_filter')+shortageFilter):'') + (shortageQuery?(t('sh_print_query')+shortageQuery):'');
    window.print();
  };
  bar.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { shortageFilter = b.dataset.f; rerender(); });
  bar.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { shortageSort = b.dataset.sort; rerender(); });
  bar.querySelector('[data-scsv]').onclick = () => exportShortagesCsv(renderShortlist._filtered || []);
  const q = bar.querySelector('[data-q]');
  let deb; q.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { shortageQuery = q.value; rerender(); }, 250); };
  return bar;
}

// "Engpass melden": eine Apotheke meldet einen selbst beobachteten Engpass (Community).
function reportShortageCard(existing = []) {
  // Privatnutzer:innen: Engpass-Meldung ist Fachkreisen vorbehalten (sicherheitsrelevant).
  // Statt des Formulars ein klarer Hinweis (das Backend erzwingt es zusätzlich).
  if (me && me.account_type === 'private') {
    return el(`<div class="card"><div class="row"><b>${esc(t('sh_rep_title'))}</b></div>
      <div class="muted" style="font-size:13px;margin-top:6px">${esc(t('sh_rep_private'))}</div></div>`);
  }
  const card = el(`<div class="card">
    <div class="row"><b>${esc(t('sh_rep_title'))}</b>
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-toggle>${esc(t('sh_rep_open'))}</button>
    </div>
    <div class="muted" style="font-size:13px;margin-top:2px">${esc(t('sh_rep_desc'))}</div>
    <div class="hidden" data-form style="margin-top:10px">
      <label>${esc(t('sh_rep_w'))}</label>
      <input data-w placeholder="${esc(t('sh_rep_w_ph'))}">
      <div data-exists style="margin-top:6px"></div>
      <label style="margin-top:6px">${esc(t('sh_rep_b'))}</label>
      <input data-b placeholder="${esc(t('sh_rep_b_ph'))}">
      <label style="margin-top:6px">${esc(t('sh_rep_status'))}</label>
      <select data-s data-i18n-aria="sh_rep_status" aria-label="${esc(t('sh_rep_status'))}">
        <option value="kritisch">${esc(t('sh_rep_opt_krit'))}</option>
        <option value="eingeschraenkt">${esc(t('st_eing'))}</option>
      </select>
      <label style="margin-top:6px">${esc(t('sh_rep_reason'))}</label>
      <input data-g placeholder="${esc(t('sh_rep_reason_ph'))}">
      <label style="margin-top:6px">${esc(t('sh_rep_until'))}</label>
      <input data-vb type="date" data-i18n-aria="sh_rep_until_t" aria-label="${esc(t('sh_rep_until_t'))}" title="${esc(t('sh_rep_until_t'))}">
      <div style="margin-top:8px"><button class="small" data-send>${esc(t('sh_rep_send'))}</button></div>
      <div class="err" data-err></div>
    </div>
  </div>`);
  const form = card.querySelector('[data-form]');
  const toggle = card.querySelector('[data-toggle]');
  toggle.onclick = () => { const open = form.classList.toggle('hidden'); toggle.textContent = open ? t('sh_rep_open') : t('sh_rep_close'); };
  // Datenqualität: gibt es schon eine offene Meldung zum getippten Wirkstoff, zum Ansehen/
  // Bestätigen führen statt ein Duplikat anzulegen (nur Hinweis, blockiert nichts).
  const openByWirkstoff = new Map();
  (existing || []).forEach(s => {
    if (s.status && s.status !== 'verfuegbar' && s.wirkstoff) {
      const k = s.wirkstoff.trim().toLowerCase();
      // Erster offener Treffer, bevorzugt eine bestätigbare Community-Meldung (Datenqualität).
      const cur = openByWirkstoff.get(k);
      const confirmable = s.provenance === 'community' && !s.is_reporter && !s.i_confirmed;
      if (!cur || (confirmable && !(cur.provenance === 'community' && !cur.is_reporter && !cur.i_confirmed))) openByWirkstoff.set(k, s);
    }
  });
  const existsBox = card.querySelector('[data-exists]');
  const winput = card.querySelector('[data-w]');
  let deb;
  winput.oninput = () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      const w = winput.value.trim().toLowerCase();
      const s = openByWirkstoff.get(w);
      existsBox.innerHTML = '';
      if (s) {
        // Statt ein Duplikat anzulegen: ansehen — und bei fremder Community-Meldung direkt „Auch bei uns".
        const canConfirm = s.provenance === 'community' && !s.is_reporter && !s.i_confirmed && !(me && me.account_type === 'private');
        const hint = el(`<div class="muted" style="font-size:13px;background:var(--info-bg,#eef);border:1px solid var(--info-bd,#cce);border-radius:8px;padding:6px 10px">${esc(ti('sh_rep_exists', { w: s.wirkstoff }))} <button class="linklike small" data-view>${esc(t('sh_rep_exists_view'))}</button>${canConfirm ? ` <button class="small" data-confirm style="margin-left:6px">${esc(t('sc_conf_btn'))}</button>` : ''}</div>`);
        hint.querySelector('[data-view]').onclick = () => openWirkstoff(s.wirkstoff);
        const cb = hint.querySelector('[data-confirm]');
        if (cb) cb.onclick = async () => { cb.disabled = true; try { await api('POST', `/api/shortages/${s.id}/confirm`); loadShortages(); } catch (e) { alert(e.message); cb.disabled = false; } };
        existsBox.appendChild(hint);
      }
    }, 300);
  };
  card.querySelector('[data-send]').onclick = async () => {
    const err = card.querySelector('[data-err]'); err.textContent = '';
    const wirkstoff = card.querySelector('[data-w]').value.trim();
    if (!wirkstoff) { err.textContent = t('sh_rep_need_w'); return; }
    try {
      await api('POST','/api/shortages/report',{
        wirkstoff,
        bezeichnung: card.querySelector('[data-b]').value.trim(),
        status: card.querySelector('[data-s]').value,
        grund: card.querySelector('[data-g]').value.trim(),
        voraussichtlichBis: card.querySelector('[data-vb]').value || undefined,
      });
      loadShortages();
    } catch(e){ err.textContent = e.message; }
  };
  // Vorbelegung aus der Suche: Formular öffnen und Wirkstoff eintragen (Sackgasse -> nächster Schritt).
  if (shortageReportPrefill) {
    const w = shortageReportPrefill; shortageReportPrefill = null;
    form.classList.remove('hidden'); toggle.textContent = t('sh_rep_close');
    winput.value = w;
    setTimeout(() => { winput.dispatchEvent(new Event('input')); winput.focus(); }, 0);
  }
  return card;
}

// Countdown-Chip zum voraussichtlichen Termin: überfällig (rot), heute (gelb),
// sonst „noch X Tage" (bei ≤7 Tagen gelb hervorgehoben, sonst dezent). Rein aus
// den Datumsfeldern abgeleitet — keine Sicherheitsaussage.
function shortageCountdown(s) {
  if (s.status === 'verfuegbar' || s.days_until == null) return '';
  const chip = (label, bg, fg, bd) => ` <span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${bd};font-weight:700;font-size:12px;padding:1px 8px;border-radius:999px;margin-left:6px">${esc(label)}</span>`;
  if (s.overdue) return chip(`⚠️ ${nlabel(-s.days_until, 'sc_overdue_one', 'sc_overdue_many')}`, 'var(--crit-bg)', 'var(--crit-fg)', 'var(--crit-bd)');
  if (s.days_until === 0) return chip(`⏳ ${t('sc_due_today')}`, 'var(--warn-bg)', 'var(--warn-fg)', 'var(--warn-bd)');
  const label = `⏳ ${nlabel(s.days_until, 'sc_in_days_one', 'sc_in_days_many')}`;
  return s.days_until <= 7
    ? chip(label, 'var(--warn-bg)', 'var(--warn-fg)', 'var(--warn-bd)')
    : chip(label, 'var(--chip-bg)', 'var(--muted)', 'var(--line)');
}

function shortageCard(s) {
  const [slabel, scol] = statusShort(s.status);
  const card = el(`<div class="card">
    <div class="row">
      <span class="post-author clickable" data-wirkstoff="${esc(s.wirkstoff)}" title="${esc(ti('sh_view_all_wk',{wk:s.wirkstoff}))}">${esc(s.wirkstoff)}</span>
      <span style="background:${scol};color:#fff;border-radius:6px;padding:2px 8px;font-size:12px">${slabel}</span>
      <span class="sp" style="flex:1"></span>
      <span class="vis" title="${esc(t('pl_open'))}">${esc(provLabel(s.provenance))}</span>
    </div>
    <div class="post-body">${esc(s.bezeichnung)}</div>
    <div class="muted">${s.grund?esc(grundLabel(s.grund))+' · ':''}${esc(t('sc_reported'))} ${esc(s.gemeldet_am||'—')}${s.days_reported>0&&s.status!=='verfuegbar'?` · ${esc(nlabel(s.days_reported,'sc_age_one','sc_age_many'))}`:''}${s.quelle&&/^https?:\/\//i.test(s.quelle)?` · <a href="${esc(s.quelle)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(t('wk_hist_src'))}${srcDomSuffix(s.quelle)}</a>`:''}</div>
    ${s.voraussichtlich_bis&&s.status!=='verfuegbar'?`<div class="muted" style="font-size:13px;margin-top:2px">${esc(t('sc_until'))} <b>${esc(fmtDateDe(s.voraussichtlich_bis))}</b>${shortageCountdown(s)}</div>`:''}
    ${s.is_antibiotic?`<div style="margin-top:6px;font-size:13px"><span style="color:var(--ok-fg);font-weight:600">${esc(t('sc_abx'))}</span> — <span class="clickable" data-amr style="color:var(--ok-fg);text-decoration:underline">${esc(t('sc_abx_link'))}</span> <span class="muted">${esc(t('sc_abx_note'))}</span></div>`:''}
    ${s.price_alternatives>0&&s.status!=='verfuegbar'?`<div style="margin-top:6px"><button class="linklike small" data-alts style="color:var(--ok-fg);font-weight:700">${esc(ti('sc_alts',{n:s.price_alternatives}))}</button> <span class="muted" style="font-size:12px">${esc(t('sc_alts_note'))}</span></div>`:''}
    ${s.provenance==='community'&&s.reporter?`<div class="muted" style="font-size:13px;margin-top:2px">${esc(t('sc_reported_by'))} <b>@${esc(s.reporter.handle)}</b>${s.reporter.verified?' <span class="verified">✔</span>':''}${s.confirm_count?` · <b style="color:var(--crit-fg)">${s.confirm_count}</b> ${esc(s.confirm_count>1?t('sc_conf_many'):t('sc_conf_one'))}`:''}</div>`:''}
    <div class="reacts">
      <button data-about>${esc(shortagePostsLabel(s.post_count||0))}</button>
      <button class="ghost" data-postbtn>${esc(t('sc_post_about'))}</button>
      ${!featBlocked('stock_exchange')?`<button class="ghost" data-exchange title="${esc(t('sc_sources_t'))}">${esc(t('sc_sources'))}</button>`:''}
      ${(me&&me.account_type!=='private'&&!featBlocked('stock_exchange'))?`<button class="ghost" data-seek title="${esc(t('sc_seek_t'))}">${esc(t('sc_seek'))}</button>`:''}
      <button class="ghost" data-watch title="${esc(t('wl_add_aria'))}" aria-pressed="${!!s.watched}">${s.watched?esc(t('sc_watched')):esc(t('sc_watch'))}</button>
      <button class="ghost" data-share title="${esc(t('pc_share'))}">${esc(t('pc_share'))}</button>
      ${s.provenance==='community'&&!s.is_reporter&&!(me&&me.account_type==='private')?(s.i_confirmed
        ? `<span style="display:inline-flex;align-items:center;font-weight:700;color:var(--ok-fg)">${esc(t('sc_confd_btn'))}</span><button class="ghost" data-unconfirm>${esc(t('sc_unconfirm_btn'))}</button>`
        : `<button class="ghost" data-confirm>${esc(t('sc_conf_btn'))}</button>`):''}
      ${s.provenance==='community'&&s.is_reporter&&s.status!=='verfuegbar'?`<button class="ghost" data-resolve>${esc(t('sc_resolve'))}</button>`:''}
      ${s.provenance==='community'&&s.is_reporter&&s.status!=='verfuegbar'?`<button class="ghost" data-datebtn>${esc(t('sc_setdate'))}</button>`:''}
      ${s.provenance==='community'&&s.is_reporter&&s.status!=='verfuegbar'?`<button class="ghost" data-repstatusbtn>${esc(t('sc_repstatus'))}</button>`:''}
      ${(s.history||[]).length>1?`<button class="ghost" data-hist aria-expanded="false">${esc(t('sc_history'))} (${s.history.length})</button>`:''}
    </div>
    <div class="comments hidden" data-repstatusbox>
      <label style="font-size:13px" for="rst_${esc(s.id)}">${esc(t('sc_repstatus_label'))}</label>
      <select data-rstatus id="rst_${esc(s.id)}" style="margin-top:4px">
        <option value="kritisch"${s.status==='kritisch'?' selected':''}>${esc(t('st_krit'))}</option>
        <option value="eingeschraenkt"${s.status==='eingeschraenkt'?' selected':''}>${esc(t('st_eing'))}</option>
      </select>
      <label style="font-size:13px;margin-top:6px" for="rgr_${esc(s.id)}">${esc(t('sh_rep_reason'))}</label>
      <input data-rgrund id="rgr_${esc(s.id)}" placeholder="${esc(t('sh_rep_reason_ph'))}" maxlength="200" value="${esc(s.grund||'')}">
      <div style="margin-top:6px"><button class="small" data-rsave>${esc(t('cm_save'))}</button></div>
      <div class="err" data-rerr></div>
    </div>
    <div class="comments hidden" data-datebox>
      <label style="font-size:13px">${esc(t('sh_rep_until'))}</label>
      <div class="row" style="gap:6px;margin-top:4px"><input data-dinput type="date" value="${esc(s.voraussichtlich_bis||'')}" style="flex:1" aria-label="${esc(t('sh_rep_until_t'))}"><button class="small" data-dsave>${esc(t('cm_save'))}</button>${s.voraussichtlich_bis?`<button class="ghost small" data-dclear>${esc(t('sc_date_clear'))}</button>`:''}</div>
    </div>
    <div class="comments hidden" data-histbox></div>
    <div class="comments hidden" data-postbox>
      <textarea data-pinput placeholder="${esc(t('sc_post_ph'))}"></textarea>
      <div style="margin-top:6px"><button class="small" data-psend>${esc(t('sc_post_send'))}</button></div>
    </div>
    ${iAmModerator?`<div class="reacts"><button class="ghost" data-statusbtn>${esc(t('sc_mod_status'))}</button></div>
    <div class="comments hidden" data-statusbox>
      <label style="font-size:13px">${esc(t('sc_mod_new'))}</label>
      <select data-sstatus>
        <option value="kritisch">${esc(t('st_krit'))}</option>
        <option value="eingeschraenkt">${esc(t('st_eing'))}</option>
        <option value="verfuegbar">${esc(t('st_verf'))}</option>
      </select>
      <label style="font-size:13px;margin-top:6px">${esc(t('sc_mod_src'))}</label>
      <input data-ssrc placeholder="https://www.basg.gv.at/…">
      <div style="margin-top:6px"><button class="small" data-ssave>${esc(t('sc_mod_save'))}</button></div>
      <div class="err" data-serr></div>
    </div>`:''}
    <div class="comments hidden" data-aboutbox></div>
  </div>`);
  const postbox = card.querySelector('[data-postbox]');
  card.querySelector('[data-postbtn]').onclick = () => postbox.classList.toggle('hidden');
  const exBtn = card.querySelector('[data-exchange]');
  if (exBtn) exBtn.onclick = () => {
    // Bei einem Engpass zählen Bezugsquellen: direkt die „Biete"-Angebote zum Wirkstoff zeigen.
    exchangeQuery = s.wirkstoff; exchangeFilter = 'biete'; exchangeBL = ''; exchangeMine = false;
    tab = 'exchange';
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
    document.querySelector('.tabs button[data-tab="exchange"]').classList.add('active');
    loadTab();
  };
  const seekBtn = card.querySelector('[data-seek]');
  if (seekBtn) seekBtn.onclick = () => {
    // Kein Angebot in Sicht? Bedarf aktiv broadcasten: Gesuch (Suche) zum Wirkstoff vorbelegen.
    // Das aktive Matching benachrichtigt passende „Biete"-Einträge und künftige Anbieter.
    exchangePrefill = { kind:'suche', bezeichnung: s.wirkstoff };
    exchangeQuery = ''; exchangeFilter = ''; exchangeBL = ''; exchangeMine = false;
    tab = 'exchange';
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
    document.querySelector('.tabs button[data-tab="exchange"]').classList.add('active');
    loadTab();
  };
  card.querySelector('[data-psend]').onclick = async () => {
    const t = card.querySelector('[data-pinput]');
    if (!t.value.trim()) return;
    try { await api('POST',`/api/shortages/${s.id}/post`,{ body:t.value }); t.value=''; postbox.classList.add('hidden'); loadShortages(); }
    catch(e){ alert(e.message); }
  };
  const wname = card.querySelector('[data-wirkstoff]');
  if (wname) wname.onclick = () => openWirkstoff(wname.dataset.wirkstoff);
  const amrLink = card.querySelector('[data-amr]');
  if (amrLink) amrLink.onclick = () => openWirkstoff(s.wirkstoff);
  const altsLink = card.querySelector('[data-alts]');
  if (altsLink) altsLink.onclick = () => openWirkstoff(s.wirkstoff); // Hub zeigt Preise/Verfügbarkeit
  // Statusverlauf: jede Änderung mit Datum, Status und Quelle (neueste zuerst).
  const histBtn = card.querySelector('[data-hist]');
  if (histBtn) histBtn.onclick = () => {
    const box = card.querySelector('[data-histbox]');
    const open = !box.classList.toggle('hidden');
    histBtn.setAttribute('aria-expanded', String(open));
    if (!open || box.childElementCount) return;
    [...s.history].reverse().forEach(hEntry => {
      const m = watchStatusMeta(hEntry.status);
      // Quelle nur als Link zeigen — Text-Quellen (z.B. "Referenzdaten") stecken
      // bereits im Herkunfts-Label und würden doppelt erscheinen.
      const q = hEntry.quelle && /^https?:\/\//.test(hEntry.quelle)
        ? `<a href="${esc(hEntry.quelle)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(t('wk_hist_src'))}${srcDomSuffix(hEntry.quelle)}</a>`
        : '';
      box.appendChild(el(`<div class="comment" style="font-size:13px"><b>${esc(fmtDateDe(hEntry.am))}</b> — <span style="color:${m.color};font-weight:700">${m.icon} ${m.label}</span> <span class="muted">· ${esc(provLabel(hEntry.provenance))}${q?' · ':''}</span>${q}</div>`));
    });
  };
  if (iAmModerator) {
    const statusbox = card.querySelector('[data-statusbox]');
    card.querySelector('[data-statusbtn]').onclick = () => statusbox.classList.toggle('hidden');
    card.querySelector('[data-sstatus]').value = s.status;
    card.querySelector('[data-ssave]').onclick = async () => {
      const serr = card.querySelector('[data-serr]'); serr.textContent = '';
      try {
        await api('POST',`/api/shortages/${s.id}/status`,{ status: card.querySelector('[data-sstatus]').value, sourceUrl: card.querySelector('[data-ssrc]').value.trim() });
        loadShortages();
      } catch(e){ serr.textContent = e.message; }
    };
  }
  // Bestätigen und Zurücknehmen sind zwei klar beschriftete Buttons (keine versteckte Geste).
  const confirmBtn = card.querySelector('[data-confirm]');
  if (confirmBtn) confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    try { await api('POST',`/api/shortages/${s.id}/confirm`); loadShortages(); }
    catch(e){ alert(e.message); confirmBtn.disabled = false; }
  };
  const unconfirmBtn = card.querySelector('[data-unconfirm]');
  if (unconfirmBtn) unconfirmBtn.onclick = async () => {
    unconfirmBtn.disabled = true;
    try { await api('POST',`/api/shortages/${s.id}/unconfirm`); loadShortages(); }
    catch(e){ alert(e.message); unconfirmBtn.disabled = false; }
  };
  const resolveBtn = card.querySelector('[data-resolve]');
  if (resolveBtn) resolveBtn.onclick = async () => {
    if (!confirm(t('sh_resolve_confirm'))) return;
    resolveBtn.disabled = true;
    try { await api('POST',`/api/shortages/${s.id}/resolve`); loadShortages(); }
    catch(e){ alert(e.message); resolveBtn.disabled = false; }
  };
  // Voraussichtlichen Termin ändern (Melder:in) — hält den Countdown für Beobachter:innen aktuell.
  const dateBtn = card.querySelector('[data-datebtn]');
  if (dateBtn) {
    const datebox = card.querySelector('[data-datebox]');
    dateBtn.onclick = () => datebox.classList.toggle('hidden');
    const saveDate = async (clear) => {
      const val = clear ? '' : (card.querySelector('[data-dinput]').value || '');
      try { await api('POST',`/api/shortages/${s.id}/expected`, { voraussichtlichBis: val }); loadShortages(); }
      catch(e){ alert(e.message); }
    };
    card.querySelector('[data-dsave]').onclick = () => saveDate(false);
    const dclear = card.querySelector('[data-dclear]');
    if (dclear) dclear.onclick = () => saveDate(true);
  }
  // Lieferstatus/Grund der eigenen Meldung aktualisieren (kritisch ↔ eingeschränkt lieferbar),
  // ohne löschen + neu melden — die Bestätigungen der Kolleg:innen bleiben erhalten.
  const repStatusBtn = card.querySelector('[data-repstatusbtn]');
  if (repStatusBtn) {
    const box = card.querySelector('[data-repstatusbox]');
    repStatusBtn.onclick = () => box.classList.toggle('hidden');
    card.querySelector('[data-rsave]').onclick = async () => {
      const err = card.querySelector('[data-rerr]'); err.textContent = '';
      const status = card.querySelector('[data-rstatus]').value;
      const grund = card.querySelector('[data-rgrund]').value.trim();
      try { await api('POST',`/api/shortages/${s.id}/report-update`, { status, grund }); loadShortages(); }
      catch(e){ err.textContent = e.message; }
    };
  }
  const watchBtn = card.querySelector('[data-watch]');
  let isWatched = !!s.watched;
  watchBtn.onclick = async () => {
    watchBtn.disabled = true;
    try {
      if (isWatched) { await api('DELETE','/api/watchlist/'+encodeURIComponent(s.wirkstoff)); isWatched = false; }
      else { await api('POST','/api/watchlist',{ wirkstoff:s.wirkstoff }); isWatched = true; }
      watchBtn.textContent = isWatched ? t('sc_watched') : t('sc_watch');
      watchBtn.setAttribute('aria-pressed', String(isWatched));
    } catch(e){ alert(e.message); }
    watchBtn.disabled = false;
  };
  // Engpass direkt aus der Liste teilen (Deep-Link zum Wirkstoff) — z.B. an Kolleg:innen.
  const shBtn = card.querySelector('[data-share]');
  shBtn.onclick = async () => {
    const url = location.origin + '/?wirkstoff=' + encodeURIComponent(s.wirkstoff);
    try { await navigator.clipboard.writeText(url); shBtn.textContent = t('pc_copied'); setTimeout(()=>{ shBtn.textContent = t('pc_share'); }, 1500); }
    catch { prompt(t('copy_link_fb'), url); }
  };
  const aboutbox = card.querySelector('[data-aboutbox]');
  card.querySelector('[data-about]').onclick = async () => {
    aboutbox.classList.toggle('hidden');
    if (aboutbox.classList.contains('hidden')) return;
    aboutbox.innerHTML = '<div class="loading">…</div>';
    const d = await api('GET',`/api/shortages/${s.id}`);
    aboutbox.innerHTML = d.posts.length ? '' : `<div class="muted">${esc(t('sa_empty'))}</div>`;
    d.posts.forEach(p => aboutbox.appendChild(el(`<div class="comment"><b>@${esc(p.author?.handle||'?')}</b>: ${esc(p.body)}</div>`)));
  };
  return card;
}

async function loadPrices() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/prices?country=' + viewCountry());
    feed.innerHTML = '';
    { const n = countryDataNotice(); if (n) feed.appendChild(n); }
    { const ln = legalNotice('price_compare'); if (ln) feed.appendChild(ln); }
    feed.appendChild(provenanceLegend());
    if (d.savings && d.savings.count) {
      const s = d.savings;
      const head = el(`<div class="card">
        <div class="row"><b>${esc(t('pr_savings_title'))}</b></div>
        <div style="font-size:22px;font-weight:800;color:var(--ok-fg);margin-top:4px">${esc(ti('pr_savings_amount', { x: fmtMoney(s.total_abs) }))}</div>
        <div class="muted" style="font-size:13px">${esc(ti(s.count>1?'pr_savings_sub_many':'pr_savings_sub_one', { n: s.count }))}</div>
        ${s.top.length?`<div style="margin-top:8px">${s.top.map(it=>`<div class="comment" style="font-size:14px">💰 <b>${esc(it.bezeichnung)}</b>: −€ ${fmtMoney(it.saving_abs)} (−${it.saving_pct}%) ${esc(t('pr_at'))} <b>${esc(it.best_supplier)}</b></div>`).join('')}</div>`:''}
      </div>`);
      feed.appendChild(head);
    }
    // CSV-Export für Einkauf/Großhandel (Excel-tauglich)
    let shownPrices = d.comparisons; // aktuell gefilterte Auswahl für Export/Druck
    const exp = el(`<div class="card"><div class="row" style="flex-wrap:wrap;gap:6px"><b>${esc(t('pr_csv_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-print>🖨️ ${esc(t('pr_print_btn'))}</button><button class="ghost small" data-csv>${esc(t('pr_csv_btn'))}</button></div><div class="muted" style="font-size:13px;margin-top:2px">${esc(t('pr_csv_sub'))}</div></div>`);
    exp.querySelector('[data-csv]').onclick = () => exportPricesCsv(shownPrices);
    exp.querySelector('[data-print]').onclick = () => printPrices(shownPrices);
    feed.appendChild(exp);
    // Beobachtungsliste laden für den „nur beobachtete"-Filter (Fehler = kein Filter).
    let pWatched = new Set();
    try { const wl = await api('GET','/api/watchlist'); pWatched = new Set((wl.items||[]).map(i => (i.wirkstoff||'').toLowerCase())); } catch { /* ohne Filter */ }
    if (!pWatched.size) priceWatchedOnly = false;
    const bar = el(`<div class="card"><div class="row" style="gap:6px"><input data-pq placeholder="${esc(t('pr_q_ph'))}" value="${esc(priceQuery)}" style="flex:1"></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
        ${pWatched.size?`<button class="small sortbtn${priceWatchedOnly?' active':''}" data-pwatched aria-pressed="${priceWatchedOnly}">${esc(t('rb_watched_only'))}</button>`:''}
        <button class="small sortbtn${priceRoseOnly?' active':''}" data-prose aria-pressed="${priceRoseOnly}">${esc(t('pr_rose_filter'))}</button>
        <span class="sp" style="flex:1"></span>
        <select class="small" data-psort data-i18n-aria="pr_sort_aria" aria-label="${esc(t('pr_sort_aria'))}"><option value="best"${priceSort==='best'?' selected':''}>${esc(t('pr_sort_best'))}</option><option value="saving"${priceSort==='saving'?' selected':''}>${esc(t('pr_sort_saving'))}</option><option value="az"${priceSort==='az'?' selected':''}>${esc(t('pr_sort_az'))}</option></select>
      </div></div>`);
    feed.appendChild(bar);
    const listBox = el('<div data-plist></div>');
    feed.appendChild(listBox);
    const draw = () => {
      const q = priceQuery.trim().toLowerCase();
      const list = d.comparisons.filter(g =>
        (!priceWatchedOnly || pWatched.has((g.wirkstoff||'').toLowerCase())) &&
        (!priceRoseOnly || (g.offers && g.offers[0] && Number(g.offers[0].trend_pct) >= 5)) &&
        (!q || (g.bezeichnung||'').toLowerCase().includes(q) || (g.wirkstoff||'').toLowerCase().includes(q)
           || (g.offers||[]).some(o => (o.supplier||'').toLowerCase().includes(q))));
      // Sortierung: Server-Standard, größte Ersparnis € (Lieferantenwechsel lohnt am meisten) oder A–Z.
      if (priceSort === 'saving') list.sort((a,b) => (Number(b.saving_abs)||0) - (Number(a.saving_abs)||0) || String(a.bezeichnung||'').localeCompare(String(b.bezeichnung||'')));
      else if (priceSort === 'az') list.sort((a,b) => String(a.bezeichnung||'').localeCompare(String(b.bezeichnung||'')));
      const wb = bar.querySelector('[data-pwatched]'); if (wb) { wb.classList.toggle('active', priceWatchedOnly); wb.setAttribute('aria-pressed', String(priceWatchedOnly)); }
      { const rb = bar.querySelector('[data-prose]'); if (rb) { rb.classList.toggle('active', priceRoseOnly); rb.setAttribute('aria-pressed', String(priceRoseOnly)); } }
      shownPrices = list;
      listBox.innerHTML = '';
      if (!list.length) listBox.appendChild(filteredEmptyCard('pr_empty', !!(q || priceWatchedOnly || priceRoseOnly), () => {
        priceQuery = ''; priceWatchedOnly = false; priceRoseOnly = false;
        if (pq) pq.value = '';
        draw();
      }));
      else list.forEach(g => listBox.appendChild(priceGroup(g, pWatched, () => { if (priceWatchedOnly) draw(); })));
    };
    { const wb = bar.querySelector('[data-pwatched]'); if (wb) wb.onclick = () => { priceWatchedOnly = !priceWatchedOnly; draw(); }; }
    bar.querySelector('[data-prose]').onclick = () => { priceRoseOnly = !priceRoseOnly; draw(); };
    bar.querySelector('[data-psort]').onchange = (ev) => { priceSort = ev.target.value; draw(); };
    const pq = bar.querySelector('[data-pq]');
    let deb; pq.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { priceQuery = pq.value; draw(); }, 250); };
    draw();
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

// Generischer CSV-Download im deutschen Excel-Format: Semikolon-Trenner,
// UTF-8 mit BOM, CRLF, korrektes Quoting. `header` + `rows` sind Arrays von Zellen.
// CSV-Format folgt der Sprache, damit Excel es korrekt öffnet:
//  de/pt (Europa-Excel): Semikolon-Trenner + Komma-Dezimal.
//  en: Komma-Trenner + Punkt-Dezimal.
// So bricht kein Import, egal in welchem Land die Datei geöffnet wird.
function csvSep() { return LOCALE === 'en' ? ',' : ';'; }
function csvNum(n) { return fmtMoney(n); }
function csvYesNo(b) { return b ? t('csv_yes') : t('csv_no'); }
function downloadCsv(baseName, header, rows) {
  const sep = csvSep();
  const needsQuote = new RegExp('["' + (sep === ';' ? ';' : ',') + '\\n]');
  const cell = (v) => { const s = String(v ?? ''); return needsQuote.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [header, ...rows].map(r => r.map(cell).join(sep)).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = baseName + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

// Wirkstoff-Dossier: alles Kaufentscheidungs-Relevante zu einem Wirkstoff auf einer Seite
// (Engpass-Status, günstigster Preis, beste Aktion, Bezugsquellen, eigene Notiz) — zum Drucken.
function printWirkstoff(d) {
  const money = printMoney;
  const section = (title, inner) => inner ? `<h2>${esc(title)}</h2>${inner}` : '';
  const shortHtml = (d.shortages && d.shortages.length)
    ? '<ul>' + d.shortages.map(s => { const [lbl, col] = statusShort(s.status); return `<li><b style="color:${col}">${esc(lbl)}</b> — ${esc(s.bezeichnung || d.wirkstoff)}${s.quelle ? ` <span class="muted">(${esc(s.quelle)})</span>` : ''}</li>`; }).join('') + '</ul>'
    : `<p class="muted">${esc(t('wk_print_no_shortage'))}</p>`;
  let cheapest = null;
  (d.prices || []).forEach(g => (g.offers || []).forEach(o => { if (!cheapest || o.aep < cheapest.aep) cheapest = o; }));
  const priceHtml = cheapest ? `<p>${esc(cheapest.supplier)}: <b>€ ${money(cheapest.aep)}</b> ${esc(t('pg_aep'))}</p>` : '';
  const bestDeal = (d.rabatte || []).slice().sort((a, b) => (b.rabatt_pct || 0) - (a.rabatt_pct || 0))[0] || null;
  const dealHtml = bestDeal ? `<p>${esc(bestDeal.supplier)}: <b>€ ${money(bestDeal.aktionspreis)}</b> (−${bestDeal.rabatt_pct}%)${bestDeal.gueltig_bis ? ` · ${esc(t('pg_valid'))} ${esc(bestDeal.gueltig_bis)}` : ''}</p>` : '';
  const biete = (d.exchange && d.exchange.biete) || [];
  const sourcesHtml = biete.length ? '<ul>' + biete.map(e => `<li><b>${esc((e.author && e.author.display_name) || t('ex_unknown'))}</b>${e.author && e.author.handle ? ` @${esc(e.author.handle)}` : ''}${e.menge ? ` — ${esc(e.menge)}` : ''}${e.ort || e.bundesland ? ` · 📍 ${esc([e.ort, e.bundesland].filter(Boolean).join(', '))}` : ''}</li>`).join('') + '</ul>' : '';
  const noteHtml = d.note ? `<p>📝 ${esc(d.note)}</p>` : '';
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:24px;margin:0 0 2px} h2{font-size:15px;margin:18px 0 4px;border-bottom:1px solid #cbd5cf;padding-bottom:3px}
    .meta{color:#555;font-size:13px} ul{margin:4px 0;padding-left:20px} li{margin:3px 0;font-size:14px} p{font-size:14px;margin:4px 0}
    .muted{color:#777} .src{font-size:12px;color:#555;margin-top:20px}`;
  const body = `<h1>💊 ${esc(d.wirkstoff)}</h1><div class="meta">${esc(t('wk_print_title'))} · ${esc(ti('wl_print_asof', { date: printDate() }))}</div>
    ${section(t('wk_short_title'), shortHtml)}
    ${section(t('wk_print_cheapest'), priceHtml)}
    ${section(t('wk_print_deal'), dealHtml)}
    ${section(t('wk_print_sources'), sourcesHtml)}
    ${section(t('wk_note_title'), noteHtml)}
    <div class="src">${esc(t('wl_print_foot'))}</div>`;
  openPrintDoc(`${d.wirkstoff} — ${t('wk_print_title')}`, css, body);
}

// Preisvergleich als sauberer, druckbarer Report für den Einkauf (Aushang/Besprechung).
// Je Präparat: günstigster Lieferant + AEP, Ersparnis vs. teuerstem, ggf. beste Aktion.
function printPrices(comparisons) {
  const list = comparisons || [];
  const money = printMoney;
  const rows = list.map(g => {
    const cheapest = (g.offers && g.offers[0]) || null;
    const action = g.action ? `${esc(g.action.supplier)}: € ${money(g.action.aktionspreis)} (−${g.action.rabatt_pct}%)` : '<span class="empty">—</span>';
    const saving = g.saving_abs > 0 ? `€ ${money(g.saving_abs)}` : '<span class="empty">—</span>';
    return `<tr>
      <td class="wk">${esc(g.bezeichnung)}${g.wirkstoff ? `<div class="pr">${esc(g.wirkstoff)}</div>` : ''}</td>
      <td>${cheapest ? esc(cheapest.supplier) : '—'}</td>
      <td class="num">${cheapest ? '€ ' + money(cheapest.aep) : '—'}</td>
      <td class="num">${saving}</td>
      <td>${action}</td>
    </tr>`;
  }).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} .meta{color:#555;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px}
    td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px} .wk{font-weight:700} .pr{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} .empty{color:#999} .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>💶 ${esc(t('pr_print_title'))}</h1><div class="meta">${esc(ti('wl_print_asof', { date: printDate() }))} · ${esc(list.length === 1 ? '1' : list.length)} ${esc(t('pr_print_count'))}</div>
    <table><thead><tr><th>${esc(t('csv_praeparat'))}</th><th>${esc(t('pr_print_cheapest'))}</th><th class="num">${esc(t('csv_aep'))}</th><th class="num">${esc(t('pr_print_saving'))}</th><th>${esc(t('pr_print_deal'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="src">${esc(t('wl_print_foot'))}</div>`;
  openPrintDoc(t('pr_print_title'), css, body);
}

function exportPricesCsv(comparisons) {
  const rows = [];
  (comparisons || []).forEach(g => g.offers.forEach((o, i) => rows.push([
    g.bezeichnung, g.wirkstoff || '', o.supplier, csvNum(o.aep),
    (o.trend_pct > 0 ? '+' : '') + (LOCALE === 'en' ? String(o.trend_pct) : String(o.trend_pct).replace('.', ',')),
    csvYesNo(i === 0 && g.saving_abs > 0),
    i === 0 ? csvNum(g.saving_abs || 0) : '',
  ])));
  downloadCsv('apopulse-preisvergleich', [t('csv_praeparat'), t('csv_wirkstoff'), t('csv_lieferant'), t('csv_aep'), t('csv_trend'), t('csv_guenstigster'), t('csv_saving_vs_max')], rows);
}

// Rabatt-Aktionen (aktuell gefiltert) als CSV für den Einkauf.
// Laufende Rabatt-Aktionen als sauberer, druckbarer Report für den Einkauf.
function printRabatte(list) {
  const rows0 = list || [];
  const money = printMoney;
  const rows = rows0.map(r => `<tr>
      <td class="wk">${esc(r.bezeichnung)}${r.wirkstoff ? `<div class="pr">${esc(r.wirkstoff)}</div>` : ''}</td>
      <td>${esc(r.supplier || '')}</td>
      <td class="num">€ ${money(r.aktionspreis || 0)}</td>
      <td class="num">−${r.rabatt_pct || 0}%</td>
      <td class="num">${r.ersparnis > 0 ? '€ ' + money(r.ersparnis) : '—'}</td>
      <td class="num">${r.min_menge || '—'}</td>
      <td>${esc(r.gueltig_bis || '—')}${r.expiring_soon ? ' ⏳' : ''}</td>
    </tr>`).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} .meta{color:#555;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px}
    td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px} .wk{font-weight:700} .pr{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>🏷️ ${esc(t('rb_print_title'))}</h1><div class="meta">${esc(ti('wl_print_asof', { date: printDate() }))} · ${rows0.length} ${esc(t('pr_print_count'))}</div>
    <table><thead><tr><th>${esc(t('csv_praeparat'))}</th><th>${esc(t('csv_lieferant'))}</th><th class="num">${esc(t('csv_aktionspreis'))}</th><th class="num">${esc(t('csv_rabatt'))}</th><th class="num">${esc(t('pr_print_saving'))}</th><th class="num">${esc(t('csv_minmenge'))}</th><th>${esc(t('csv_gueltig_bis'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="src">${esc(t('wl_print_foot'))}</div>`;
  openPrintDoc(t('rb_print_title'), css, body);
}

// Bestandsaustausch (Biete/Suche) — aktuelle Auswahl als CSV. Nur öffentliche Angaben
// (Anbieter-Handle), Kontakt läuft weiter über Direktnachricht.
function exportExchangeCsv(entries) {
  const rows = (entries || []).map(e => [
    e.kind === 'biete' ? t('ex_badge_biete') : t('ex_badge_suche'),
    e.bezeichnung || '', e.menge || '',
    [e.ort, e.bundesland].filter(Boolean).join(', '),
    (e.author && e.author.display_name) || '', e.author && e.author.handle ? '@' + e.author.handle : '',
    (e.created_at || '').slice(0, 10), e.match_count || 0,
  ]);
  downloadCsv('apopulse-austausch', [t('ex_csv_art'), t('csv_praeparat'), t('ex_csv_menge'), t('ex_csv_ort'), t('ex_csv_anbieter'), t('ex_csv_handle'), t('ex_csv_erstellt'), t('ex_csv_treffer')], rows);
}

// Bestandsaustausch als Aushang/Druck (aktuelle Auswahl) — für den Backoffice-Ausdruck.
// Nur öffentliche Angaben; Kontakt läuft weiter über Direktnachricht.
function printExchange(entries) {
  const rows0 = entries || [];
  const rows = rows0.map(e => `<tr>
      <td>${esc(e.kind === 'biete' ? t('ex_badge_biete') : t('ex_badge_suche'))}</td>
      <td class="wk">${esc(e.bezeichnung || '')}</td>
      <td>${esc(e.menge || '—')}</td>
      <td>${esc([e.ort, e.bundesland].filter(Boolean).join(', ') || '—')}</td>
      <td>${esc((e.author && e.author.display_name) || '')}${e.author && e.author.handle ? `<div class="pr">@${esc(e.author.handle)}</div>` : ''}</td>
      <td class="num">${e.match_count || 0}</td>
    </tr>`).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} .meta{color:#555;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px}
    td{padding:8px;border-bottom:1px solid #e3e8e5;vertical-align:top;font-size:14px} .wk{font-weight:700} .pr{font-weight:400;color:#555;font-size:12px;margin-top:2px}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>🔄 ${esc(t('ex_print_title'))}</h1><div class="meta">${esc(ti('wl_print_asof', { date: printDate() }))} · ${rows0.length} ${esc(t('pr_print_count'))}</div>
    <table><thead><tr><th>${esc(t('ex_csv_art'))}</th><th>${esc(t('csv_praeparat'))}</th><th>${esc(t('ex_csv_menge'))}</th><th>${esc(t('ex_csv_ort'))}</th><th>${esc(t('ex_csv_anbieter'))}</th><th class="num">${esc(t('ex_csv_treffer'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="src">${esc(t('ex_contact'))}</div>`;
  openPrintDoc(t('ex_print_title'), css, body);
}

function exportRabatteCsv(list) {
  const rows = (list || []).map(r => [
    r.rank ?? '', r.bezeichnung || '', r.wirkstoff || '', r.supplier || '',
    csvNum(r.listenpreis || 0), csvNum(r.aktionspreis || 0), csvNum(r.rabatt_pct || 0),
    csvNum(r.ersparnis || 0), r.min_menge || '',
    r.min_menge && r.ersparnis ? csvNum(Number(r.ersparnis) * Number(r.min_menge)) : '',
    r.gueltig_bis || '', csvYesNo(r.best_for_wirkstoff),
  ]);
  downloadCsv('apopulse-rabatte', [t('csv_rang'), t('csv_praeparat'), t('csv_wirkstoff'), t('csv_lieferant'), t('csv_listenpreis'), t('csv_aktionspreis'), t('csv_rabatt'), t('csv_saving_pkg'), t('csv_minmenge'), t('csv_saving_atmin'), t('csv_gueltig_bis'), t('csv_best_per_wirkstoff')], rows);
}

// Engpass-Liste (aktuell gefiltert) als CSV — u.a. zur Dokumentation der Nichtverfügbarkeit.
function exportShortagesCsv(list) {
  const statusText = { kritisch: t('st_krit'), eingeschraenkt: t('st_eing'), verfuegbar: t('st_verf') };
  const provText = { verified: t('csv_prov_verified'), reference: t('csv_prov_reference'), editorial: t('csv_prov_editorial'), community: t('csv_prov_community'), simulated: t('csv_prov_simulated') };
  const rows = (list || []).map(s => [
    s.wirkstoff, s.bezeichnung || '', statusText[s.status] || s.status || '', grundLabel(s.grund),
    s.gemeldet_am || '',
    // Dauer als fertige Zahl (Excel-Nutzer:innen müssen nicht selbst Datumsdifferenzen
    // rechnen) — nur für noch offene Engpässe sinnvoll.
    (s.days_reported != null && s.status !== 'verfuegbar') ? String(s.days_reported) : '',
    s.status !== 'verfuegbar' ? (s.voraussichtlich_bis || '') : '',
    csvYesNo(s.is_antibiotic),
    provText[s.provenance] || s.provenance || '',
    s.provenance === 'community' && s.reporter ? '@' + s.reporter.handle : '',
    csvYesNo(s.watched),
  ]);
  downloadCsv('apopulse-engpaesse', [t('csv_wirkstoff'), t('csv_praeparat'), t('csv_status'), t('csv_grund'), t('csv_gemeldet_am'), t('csv_tage_gemeldet'), t('csv_wieder_bis'), t('csv_antibiotikum'), t('csv_herkunft'), t('csv_melder'), t('csv_beobachtet')], rows);
}

function trendStr(t) { if (t>0) return `<span style="color:var(--crit-fg)">▲ +${t}%</span>`; if (t<0) return `<span style="color:var(--ok-fg)">▼ ${t}%</span>`; return '<span class="muted">±0%</span>'; }

// Kompakte Preisverlaufs-Linie (Sparkline) aus den letzten Preisen. Einzelserie,
// dünne 2px-Linie; Farbe nach Netto-Richtung (steigend rot / fallend grün) — die
// Richtung steht zusätzlich als ▲/▼-Text daneben, also nie nur über Farbe.
function sparkline(series) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const w = 66, h = 20, pad = 2;
  const min = Math.min(...series), max = Math.max(...series);
  const span = (max - min) || 1;
  const n = series.length;
  const x = (i) => pad + i * ((w - 2*pad) / (n - 1));
  const y = (v) => h - pad - ((v - min) / span) * (h - 2*pad);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const dir = series[n-1] - series[0];
  // Theme-aware (wie trendStr): im Dunkelmodus wären die hellen Hex-Töne #c0392b/#0b7f28
  // auf dem dunklen Kartengrund kaum sichtbar. Als CSS-Variable im style (nicht als SVG-
  // Attribut, wo var() unzuverlässig ist) passt die Farbe sich an und bleibt kontrastreich.
  const col = dir > 0 ? 'var(--crit-fg)' : (dir < 0 ? 'var(--ok-fg)' : 'var(--muted)');
  const lastX = x(n-1).toFixed(1), lastY = y(series[n-1]).toFixed(1);
  const dirWord = dir > 0 ? t('spark_rising') : (dir < 0 ? t('spark_falling') : t('spark_stable'));
  const label = ti('spark_label', { dir: dirWord }) + series.map(v => fmtMoney(v) + ' ' + t('spark_eur')).join(', ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" style="display:block;overflow:visible">
    <polyline points="${pts}" fill="none" style="stroke:${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="2.5" style="fill:${col}"/>
  </svg>`;
}

function priceGroup(g, watchedSet, onWatchChange) {
  // Trend-Warnung: günstigster Anbieter (erste Zeile, nach AEP sortiert) zuletzt
  // spürbar teurer (>= +5%). Nur Hinweis zum Beobachten, keine Kaufberatung.
  const cheapest = (g.offers && g.offers[0]) || null;
  const rose = cheapest && Number(cheapest.trend_pct) >= 5;
  const wKey = g.wirkstoff ? g.wirkstoff.toLowerCase() : '';
  const showStar = watchedSet && g.wirkstoff;
  const card = el(`<div class="card">
    <div class="post-author">${esc(g.bezeichnung)} ${g.wirkstoff?`<span class="handle clickable" data-wirkstoff="${esc(g.wirkstoff)}" title="${esc(ti('pg_all_about',{w:g.wirkstoff}))}">${esc(g.wirkstoff)}</span>`:''}${showStar?`<button class="ghost small" data-wwatch aria-pressed="${watchedSet.has(wKey)}" title="${esc(watchedSet.has(wKey)?t('sc_watched'):t('sc_watch'))}" style="padding:2px 8px;min-height:0;margin-left:4px">${watchedSet.has(wKey)?'⭐':'☆'}</button>`:''}</div>
    <div class="muted" style="margin:2px 0 8px">${esc(t('pg_compare'))} ${esc(t('prov_reference'))}</div>
    ${rose?`<div style="display:inline-block;background:var(--crit-bg);color:var(--crit-fg);border:1px solid var(--crit-bd);font-weight:700;font-size:13px;padding:3px 10px;border-radius:999px;margin-bottom:8px">${esc(ti('pg_rose',{x:Number(cheapest.trend_pct).toFixed(1)}))}</div>`:''}
    ${g.saving_abs>0?`<div style="display:inline-block;background:rgba(11,127,40,.12);color:var(--ok-fg);font-weight:700;font-size:13px;padding:3px 10px;border-radius:999px;margin-bottom:8px">${esc(ti('pg_cheaper',{x:fmtMoney(g.saving_abs),supplier:g.best_supplier}))}</div>`:''}
    ${g.action?`<div style="background:rgba(11,127,40,.08);border:1px solid rgba(11,127,40,.35);border-radius:10px;padding:8px 10px;margin-bottom:8px">
      <div style="font-weight:700;color:var(--ok-fg);font-size:14px">${esc(t('pg_act_title'))}</div>
      <div style="font-size:13px;margin-top:2px">${esc(g.action.supplier)}: <b>€ ${fmtMoney(g.action.aktionspreis)}</b> ${esc(t('pg_instead'))} € ${fmtMoney(g.best_aep)} ${esc(t('pg_aep'))} — <b>−€ ${fmtMoney(g.action.unter_aep_abs)} ${esc(t('pg_per_pack'))}</b> · −${g.action.rabatt_pct}%</div>
      <div class="muted" style="font-size:12px;margin-top:2px">${esc(ti('pg_from',{n:g.action.min_menge}))}${g.action.expiring_soon?` · <b style="color:${g.action.days_left<=3?'var(--crit-fg)':'var(--warn-fg)'}">${esc(g.action.days_left<=0?t('pg_only_today'):ti('pg_only_days',{d:g.action.days_left}))}</b>`:` · ${esc(t('pg_valid'))} ${esc(g.action.gueltig_bis)}`} · ${esc(t('prov_reference'))}</div>
      <div style="margin-top:6px"><button class="ghost small" data-actcart>🛒 ${esc(t('cart_add'))}</button></div>
    </div>`:''}
    <div data-offers></div>
    ${cheapest&&cheapest.aep!=null?`<div class="row" style="margin-top:8px;align-items:center;gap:6px;flex-wrap:wrap"><label style="font-size:13px">🧮 ${esc(t('pg_calc_qty'))}</label><input type="number" min="1" step="1" value="1" data-pqty style="width:88px" aria-label="${esc(t('pg_calc_qty'))}"><span data-pcalc style="font-size:13px;font-weight:700;color:var(--ok-fg)"></span></div>`:''}
  </div>`);
  // Mengen-Kostenrechner: günstigster verfügbarer Preis für die Bestellmenge — bezieht
  // eine laufende Aktion mit ein, sobald die Menge deren Mindestabnahme erreicht.
  const pq = card.querySelector('[data-pqty]'), pc = card.querySelector('[data-pcalc]');
  if (pq && pc && cheapest && cheapest.aep != null) {
    const rc = () => {
      const n = Math.max(0, Math.floor(Number(pq.value) || 0));
      if (!n) { pc.textContent = ''; return; }
      let unit = Number(cheapest.aep), sup = cheapest.supplier;
      if (g.action && g.action.aktionspreis != null && n >= (g.action.min_menge || 1) && Number(g.action.aktionspreis) < unit) {
        unit = Number(g.action.aktionspreis); sup = g.action.supplier;
      }
      const total = fmtMoney(unit * n);
      pc.textContent = sup ? ti('pg_calc_result', { supplier: sup, total }) : ('€ ' + total);
    };
    pq.addEventListener('input', rc); rc();
  }
  // Beste laufende Aktion direkt zum Aktionspreis (+ Mindestmenge) in die Einkaufsliste.
  const actCart = card.querySelector('[data-actcart]');
  if (actCart) actCart.onclick = (ev) => {
    // Listenpreis aus Aktionspreis + Rabatt % ableiten (für die Ersparnis-Anzeige der Einkaufsliste).
    const ap = Number(g.action.aktionspreis), pct = Number(g.action.rabatt_pct);
    const lp = (ap > 0 && pct > 0 && pct < 100) ? Math.round((ap / (1 - pct / 100)) * 100) / 100 : undefined;
    cartAdd({
      bezeichnung: g.bezeichnung, wirkstoff: g.wirkstoff, supplier: g.action.supplier,
      aktionspreis: g.action.aktionspreis, listenpreis: lp, rabattPct: g.action.rabatt_pct, gueltigBis: g.action.gueltig_bis,
      menge: g.action.min_menge || 1, sourceKind: 'rabatt',
    }, ev.target);
  };
  const box = card.querySelector('[data-offers]');
  g.offers.forEach((o, i) => {
    const row = el(`<div class="comment"${i===0&&g.saving_abs>0?' style="background:rgba(11,127,40,.06);border-radius:8px"':''}>
      <div class="row">
        <span>${i===0?'⭐ ':''}<b>${esc(o.supplier)}</b>${i===0?` <span style="color:var(--ok-fg);font-size:12px;font-weight:700">${esc(t('pg_cheapest'))}</span>`:''}</span>
        <span class="sp" style="flex:1"></span>
        <span title="${Array.isArray(o.series)&&o.series.length?o.series.map(v=>'€ '+fmtMoney(v)).join(' → '):esc(t('pg_no_series'))}">${sparkline(o.series)}</span>
        <span style="margin-left:8px"><b>€ ${fmtMoney(o.aep)}</b> ${trendStr(o.trend_pct)}</span>
      </div>
      <div class="row" style="margin-top:4px">
        <span class="muted">${esc(nlabel(o.post_count||0,'pg_posts_one','pg_posts'))}</span>
        <span class="sp" style="flex:1"></span>
        <button class="ghost small" data-addcart>🛒 ${esc(t('cart_add'))}</button>
        <button class="ghost small" data-pp>${esc(t('sc_post_about'))}</button>
      </div>
      <div class="hidden" data-ppbox style="margin-top:6px">
        <textarea data-ppinput placeholder="${esc(ti('pg_post_ph',{supplier:o.supplier}))}"></textarea>
        <div style="margin-top:4px"><button class="small" data-ppsend>${esc(t('sc_post_send'))}</button></div>
      </div>
    </div>`);
    row.querySelector('[data-addcart]').onclick = (ev) => cartAdd({
      bezeichnung: g.bezeichnung, wirkstoff: g.wirkstoff, supplier: o.supplier,
      aktionspreis: o.aep, menge: 1, sourceKind: 'price',
    }, ev.target);
    const ppbox = row.querySelector('[data-ppbox]');
    row.querySelector('[data-pp]').onclick = () => ppbox.classList.toggle('hidden');
    row.querySelector('[data-ppsend]').onclick = async () => {
      const t = row.querySelector('[data-ppinput]');
      if (!t.value.trim()) return;
      try { await api('POST',`/api/prices/${o.id}/post`,{ body:t.value }); t.value=''; loadPrices(); }
      catch(e){ alert(e.message); }
    };
    box.appendChild(row);
  });
  const pw = card.querySelector('[data-wirkstoff]');
  if (pw) pw.onclick = () => openWirkstoff(pw.dataset.wirkstoff);
  // Ein-Klick „beobachten" direkt am Preisvergleich (für Rabatt-/Preis-Alarm).
  const wwatch = card.querySelector('[data-wwatch]');
  if (wwatch) wwatch.onclick = async () => {
    wwatch.disabled = true;
    try {
      if (watchedSet.has(wKey)) { await api('DELETE','/api/watchlist/'+encodeURIComponent(g.wirkstoff)); watchedSet.delete(wKey); }
      else { await api('POST','/api/watchlist',{ wirkstoff: g.wirkstoff }); watchedSet.add(wKey); }
      const now = watchedSet.has(wKey);
      wwatch.textContent = now ? '⭐' : '☆'; wwatch.setAttribute('aria-pressed', String(now));
      wwatch.title = now ? t('sc_watched') : t('sc_watch');
      if (onWatchChange) onWatchChange(); // aktiven „nur beobachtete"-Filter mitziehen
    } catch(e){ alert(e.message); }
    wwatch.disabled = false;
  };
  return card;
}

const BUNDESLAENDER = ['Wien','Niederösterreich','Oberösterreich','Steiermark','Tirol','Kärnten','Salzburg','Vorarlberg','Burgenland'];
const blOptions = (sel) => BUNDESLAENDER.map(b=>`<option value="${b}"${b===sel?' selected':''}>${b}</option>`).join('');
let exchangeFilter = ''; // '', 'biete', 'suche'
let exchangeQuery = '';   // Text-Filter (z.B. aus einem Engpass heraus vorbelegt)
let exchangeBL = '';      // Bundesland-Filter
let exchangeMine = false;  // nur eigene Einträge
let exchangeMineStatus = 'offen'; // Status-Filter der eigenen Einträge: 'offen' | 'erledigt' | '' (alle)
let exchangeSort = '';     // '' = neueste; 'ablauf' = bald ablaufend zuerst
let exchangeBLInit = false; // Standard-Vorbelegung auf eigenes Bundesland nur einmal
let exchangeFlash = null;  // Einmal-Hinweis nach dem Anlegen: { count, kind } — passende Gegenstücke gefunden
let exchangePrefill = null; // Einmal-Vorbelegung des Formulars: { kind, bezeichnung } — z.B. „Ich suche das" aus einem Engpass
async function loadExchange() {
  const feed = document.getElementById('feed');
  // Standard: eigenes Bundesland vorbelegen (opt-out über „Alle Bundesländer").
  if (!exchangeBLInit) { exchangeBLInit = true; if (me && me.bundesland && !exchangeBL) exchangeBL = me.bundesland; }
  feed.innerHTML = '';
  { const ln = legalNotice('stock_exchange'); if (ln) feed.appendChild(ln); }
  // Formular zum Anlegen — für Privatnutzer:innen gesperrt (professioneller B2B-Vorgang);
  // das Backend erzwingt es zusätzlich. Lesen/Filtern der Einträge bleibt möglich.
  if (me && me.account_type === 'private') {
    feed.appendChild(el(`<div class="card"><label>${esc(t('ex_form_title'))}</label><div class="muted" style="font-size:13px;margin-top:6px">${esc(t('ex_private'))}</div></div>`));
  } else {
  const form = el(`<div class="card">
    <label>${esc(t('ex_form_title'))}</label>
    <div class="row" style="margin-top:6px">
      <select id="ex_kind" data-i18n-aria="ex_kind_aria" aria-label="${esc(t('ex_kind_aria'))}" style="max-width:150px"><option value="biete">${esc(t('ex_offer'))}</option><option value="suche">${esc(t('ex_seek'))}</option></select>
      <input id="ex_bez" placeholder="${esc(t('ex_bez_ph'))}" style="flex:1">
    </div>
    <div class="row" style="margin-top:6px">
      <input id="ex_menge" placeholder="${esc(t('ex_menge_ph'))}">
      <input id="ex_ort" placeholder="${esc(t('ex_ort_ph'))}">
    </div>
    <select id="ex_bl" data-i18n-aria="ex_bl_ph" aria-label="${esc(t('ex_bl_ph'))}" style="margin-top:6px"><option value="">${esc(t('ex_bl_ph'))}</option>${blOptions((me&&me.bundesland)||'')}</select>
    <input id="ex_note" placeholder="${esc(t('ex_note_ph'))}" style="margin-top:6px">
    <div class="row" style="margin-top:6px;align-items:center;gap:6px"><label style="font-size:13px;margin:0" for="ex_ablauf">⏳ ${esc(t('ex_expiry'))}</label><input id="ex_ablauf" type="date" aria-label="${esc(t('ex_expiry'))}"></div>
    <div class="row" style="margin-top:6px">
      <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px">${esc(t('ex_photo'))}<input type="file" id="ex_img" accept="image/*" style="display:none"></label>
      <span class="muted" id="ex_imgname" style="font-size:13px"></span>
      <button class="ghost small" id="ex_imgclear" style="display:none">✕</button>
    </div>
    <img id="ex_imgprev" data-i18n-alt="a11y_img_preview" alt="Bildvorschau" style="display:none;max-width:100%;border-radius:8px;margin-top:6px" />
    <div class="row" style="margin-top:8px"><button id="ex_go">${esc(t('ex_publish'))}</button><span class="err" id="ex_err" style="margin-left:10px"></span></div>
    <div class="muted" style="font-size:13px;margin-top:6px">${esc(t('ex_contact'))}</div>
  </div>`);
  feed.appendChild(form);
  // Einmal-Vorbelegung (z.B. „Ich suche das" aus einem Engpass): Art + Präparat setzen und
  // das Formular in den Blick rücken, damit nur noch Menge/Ort ergänzt werden muss.
  if (exchangePrefill) {
    const pf = exchangePrefill; exchangePrefill = null;
    const kSel = document.getElementById('ex_kind'), bInp = document.getElementById('ex_bez');
    if (kSel && pf.kind) kSel.value = pf.kind;
    if (bInp && pf.bezeichnung) bInp.value = pf.bezeichnung;
    if (bInp) { bInp.focus(); form.scrollIntoView({ behavior:'smooth', block:'center' }); }
  }
  let exImage = null;
  const exImg = document.getElementById('ex_img'), exImgprev = document.getElementById('ex_imgprev');
  const exImgname = document.getElementById('ex_imgname'), exImgclear = document.getElementById('ex_imgclear');
  const clearEx = () => { exImage=null; exImg.value=''; exImgprev.style.display='none'; exImgprev.src=''; exImgname.textContent=''; exImgclear.style.display='none'; };
  exImg.onchange = async () => {
    const f = exImg.files[0]; if (!f) return;
    try { exImage = await fileToDataUrl(f); exImgprev.src=exImage; exImgprev.style.display='block'; exImgname.textContent=f.name; exImgclear.style.display='inline-block'; document.getElementById('ex_err').textContent=''; }
    catch(e){ document.getElementById('ex_err').textContent = e.message; clearEx(); }
  };
  exImgclear.onclick = clearEx;
  document.getElementById('ex_go').onclick = async () => {
    try {
      const created = await api('POST','/api/exchange',{ kind:v('ex_kind'), bezeichnung:v('ex_bez'), menge:v('ex_menge'), ort:v('ex_ort'), bundesland:v('ex_bl'), note:v('ex_note'), image:exImage, ablauf: document.getElementById('ex_ablauf').value || null });
      // Genau im Moment der Absicht: wenn es passende Gegenstücke gibt, direkt dorthin filtern + Hinweis.
      if (created && created.match_count >= 1) {
        const key = (String(created.bezeichnung).toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || [])[0] || created.bezeichnung;
        exchangeMine = false; exchangeFilter = created.kind === 'biete' ? 'suche' : 'biete'; exchangeQuery = key;
        exchangeFlash = { count: created.match_count, kind: created.kind };
      } else if (created) {
        // Noch kein Treffer: beruhigen + auf das Frühwarnnetz hinweisen (man wird benachrichtigt).
        exchangeFlash = { count: 0, kind: created.kind };
      }
      loadExchange();
    } catch(e){ document.getElementById('ex_err').textContent = e.message; }
  };
  } // Ende Nicht-Privat-Formular
  // Filter + Textsuche
  const filt = el(`<div class="card" style="padding:8px 12px">
    <div class="row"><input id="ex_q" placeholder="${esc(t('ex_q_ph'))}" value="${esc(exchangeQuery)}"><button class="ghost small" id="ex_qgo">${esc(t('ex_filter_btn'))}</button>${exchangeQuery?'<button class="ghost small" id="ex_qclear">✕</button>':''}</div>
    <div class="reacts" style="margin-top:6px">
      <button class="${!exchangeMine&&exchangeFilter===''?'':'ghost '}small" data-f="">${esc(t('sh_f_all'))}</button>
      <button class="${!exchangeMine&&exchangeFilter==='biete'?'':'ghost '}small" data-f="biete">${esc(t('ex_offers'))}</button>
      <button class="${!exchangeMine&&exchangeFilter==='suche'?'':'ghost '}small" data-f="suche">${esc(t('ex_seeks'))}</button>
      <button class="${exchangeMine?'':'ghost '}small" data-mine>${esc(t('ex_mine'))}</button>
      <button class="${!exchangeMine&&exchangeSort==='ablauf'?'':'ghost '}small" data-sortabl ${exchangeMine?'disabled':''} title="${esc(t('ex_sort_expiry'))}">${esc(t('ex_sort_expiry'))}</button>
      <select id="ex_blf" data-i18n-aria="ex_all_bl" aria-label="${esc(t('ex_all_bl'))}" class="small" style="margin-left:auto" ${exchangeMine?'disabled':''}><option value="">${esc(t('ex_all_bl'))}</option>${blOptions(exchangeBL)}</select>
    </div>
    ${exchangeMine?`<div class="reacts" style="margin-top:6px;align-items:center">
      <span class="muted" style="font-size:13px">${esc(t('ex_mine_status'))}</span>
      ${[['offen',t('ex_st_open')],['erledigt',t('ex_st_done')],['',t('sh_f_all')]].map(([v2,l])=>`<button class="small sortbtn${exchangeMineStatus===v2?' active':''}" data-mst="${v2}" aria-pressed="${exchangeMineStatus===v2}">${esc(l)}</button>`).join('')}
    </div>`:''}</div>`);
  filt.querySelectorAll('[data-f]').forEach(btn => btn.onclick = () => { exchangeMine=false; exchangeFilter = btn.dataset.f; loadExchange(); });
  filt.querySelector('[data-mine]').onclick = () => { exchangeMine = !exchangeMine; loadExchange(); };
  filt.querySelectorAll('[data-mst]').forEach(b => b.onclick = () => { exchangeMineStatus = b.dataset.mst; loadExchange(); });
  filt.querySelector('[data-sortabl]').onclick = () => { exchangeMine=false; exchangeSort = exchangeSort==='ablauf' ? '' : 'ablauf'; loadExchange(); };
  filt.querySelector('#ex_qgo').onclick = () => { exchangeQuery = v('ex_q').trim(); loadExchange(); };
  filt.querySelector('#ex_q').addEventListener('keydown', e => { if (e.key==='Enter') { exchangeQuery = v('ex_q').trim(); loadExchange(); } });
  const blf = filt.querySelector('#ex_blf'); if (blf) blf.onchange = (ev) => { exchangeBL = ev.target.value; loadExchange(); };
  const qclear = filt.querySelector('#ex_qclear');
  if (qclear) qclear.onclick = () => { exchangeQuery=''; loadExchange(); };
  feed.appendChild(filt);
  // Einmal-Hinweis direkt nach dem Anlegen: Treffer gefunden (Moment der Absicht) oder — falls
  // noch keiner — beruhigen und aufs Frühwarnnetz hinweisen (man wird automatisch benachrichtigt).
  if (exchangeFlash) {
    const { count, kind } = exchangeFlash; exchangeFlash = null;
    if (count === 0) {
      const msg = kind === 'biete' ? t('ex_flash_none_biete') : t('ex_flash_none_suche');
      feed.appendChild(el(`<div class="card" style="padding:10px 14px;background:var(--info-bg);border-color:var(--info-bd);color:var(--info-fg)">📣 ${esc(msg)}</div>`));
    } else {
      const msg = kind === 'biete'
        ? (count === 1 ? t('ex_flash_seeks_1') : ti('ex_flash_seeks', { n: count }))
        : (count === 1 ? t('ex_flash_offers_1') : ti('ex_flash_offers', { n: count }));
      feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(msg)}</div>`));
    }
  }
  try {
    let d;
    if (exchangeMine) {
      d = await api('GET','/api/exchange/mine' + (exchangeMineStatus ? '?status=' + encodeURIComponent(exchangeMineStatus) : ''));
      if (!d.entries.length) {
        if (exchangeMineStatus) {
          // Nur diese Status-Ansicht ist leer — nicht die „lege den ersten Eintrag an"-Sackgasse.
          const c = el(`<div class="card muted">${esc(t('ex_mine_none_filter'))} <button class="linklike small" data-showall>${esc(t('ex_mine_show_all'))}</button></div>`);
          c.querySelector('[data-showall]').onclick = () => { exchangeMineStatus = ''; loadExchange(); };
          feed.appendChild(c); return;
        }
        feed.appendChild(emptyState({ icon:'🗂️', title:t('ex_mine_empty_t'), text:t('ex_mine_empty_s'), cta:{ label:t('ex_new'), onClick:()=>{ const b=document.getElementById('ex_bez'); if(b){ b.focus(); b.scrollIntoView({behavior:'smooth',block:'center'}); } } } })); return;
      }
    } else {
      const params = new URLSearchParams();
      if (exchangeFilter) params.set('kind', exchangeFilter);
      if (exchangeQuery) params.set('q', exchangeQuery);
      if (exchangeBL) params.set('bundesland', exchangeBL);
      if (exchangeSort) params.set('sort', exchangeSort);
      // Land der ANSICHT mitschicken. Ohne diesen Parameter blieben Börse und
      // Rabatte auf dem Heimatland stehen, während News und Engpässe dem
      // Länder-Umschalter folgen — dieselbe Seite zeigte dann zwei
      // verschiedene Länder gleichzeitig.
      params.set('country', viewCountry());
      d = await api('GET','/api/exchange'+(params.toString()?'?'+params.toString():''));
      if (!d.entries.length) {
        // „Gefiltert leer" ehrlich von „Netzwerk leer" trennen: liegt ein Filter an
        // (Suche/Art/Bundesland), ist nicht das ganze Netz leer — dann einen sichtbaren
        // „Filter zurücksetzen"-Knopf anbieten statt fälschlich „sei der/die Erste".
        const anyFilter = exchangeQuery || exchangeFilter || exchangeBL;
        if (anyFilter) {
          const reset = { label: t('sh_reset'), onClick: () => { exchangeQuery=''; exchangeFilter=''; exchangeBL=''; exchangeSort=''; loadExchange(); } };
          feed.appendChild(exchangeQuery
            ? emptyState({ icon:'🔍', title:ti('ex_search_empty_t',{q:exchangeQuery}), text:t('ex_search_empty_s'), cta:reset })
            : emptyState({ icon:'🔍', title:t('ex_filter_empty_t'), text:t('ex_filter_empty_s'), cta:reset }));
          return;
        }
        feed.appendChild(emptyState({ icon:'🔄', title:t('ex_empty_t'), text:t('ex_empty_s'), cta:{ label:t('ex_new'), onClick:()=>{ const b=document.getElementById('ex_bez'); if(b){ b.focus(); b.scrollIntoView({behavior:'smooth',block:'center'}); } } } })); return;
      }
    }
    // CSV-Export der aktuellen Auswahl — Netzwerk-Überblick zu Angebot/Nachfrage für den Einkauf.
    const expCard = el(`<div class="card" style="padding:8px 12px"><div class="row"><span class="muted" style="font-size:13px;flex:1">${esc(ti('ex_csv_sub',{n:d.entries.length}))}</span><button class="ghost small" data-exprint>🖨️ ${esc(t('pr_print_btn'))}</button><button class="ghost small" data-excsv>⬇️ CSV</button></div></div>`);
    expCard.querySelector('[data-excsv]').onclick = () => exportExchangeCsv(d.entries);
    expCard.querySelector('[data-exprint]').onclick = () => printExchange(d.entries);
    feed.appendChild(expCard);
    d.entries.forEach(e => feed.appendChild(exchangeCard(e)));
  } catch(e){ feed.appendChild(errorState(e.message, loadTab)); }
}

function exchangeCard(e) {
  const au = e.author || {};
  const mine = me && au.handle === me.handle;
  const isBiete = e.kind === 'biete';
  const badge = isBiete ? `<span style="background:var(--ok-bg);color:var(--ok-fg);border:1px solid var(--ok-bd);border-radius:999px;padding:2px 10px;font-weight:700;font-size:13px">${esc(t('ex_badge_biete'))}</span>`
                        : `<span style="background:var(--warn-bg);color:var(--warn-fg);border:1px solid var(--warn-bd);border-radius:999px;padding:2px 10px;font-weight:700;font-size:13px">${esc(t('ex_badge_suche'))}</span>`;
  const erledigt = e.status === 'erledigt';
  const doneBadge = erledigt ? ` <span style="background:var(--line);color:var(--muted);border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600">${esc(t('ex_done_badge'))}</span>` : '';
  const reservedBadge = (!erledigt && e.reserved) ? ` <span style="background:var(--warn-bg);color:var(--warn-fg);border:1px solid var(--warn-bd);border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700">${esc(t('ex_reserved_badge'))}</span>` : '';
  // Frische-Hinweis: eigener, offener Eintrag, der schon lange steht — zum Aufräumen anregen
  // (hält Angebot/Nachfrage im Netzwerk aktuell). Schwelle: 21 Tage.
  const ageDays = e.created_at ? Math.floor((Date.now() - Date.parse(e.created_at)) / 86400000) : 0;
  const stale = mine && !erledigt && ageDays >= 21;
  // Matchmaking-Signal: passende offene Gegen-Einträge (Biete zeigt Gesuche, Suche zeigt Angebote).
  const mc = (!erledigt && e.match_count >= 1) ? e.match_count : 0;
  const matchLabel = mc ? (isBiete
    ? (mc === 1 ? t('ex_match_seeks_1') : ti('ex_match_seeks', { n: mc }))
    : (mc === 1 ? t('ex_match_offers_1') : ti('ex_match_offers', { n: mc }))) : '';
  const card = el(`<div class="card"${erledigt?' style="opacity:.75"':''}>
    <div class="row" style="align-items:baseline">
      ${badge}${doneBadge}${reservedBadge}
      <b style="margin-left:8px">${esc(e.bezeichnung)}</b>
      <span class="sp" style="flex:1"></span>
      <span class="muted" style="font-size:12px">${relTime(e.created_at)}</span>
    </div>
    <div class="muted" style="margin-top:4px">${e.menge?esc(t('ex_qty'))+' '+esc(e.menge):''}${e.menge&&(e.ort||e.bundesland)?' · ':''}${e.ort||e.bundesland?'📍 '+esc([e.ort,e.bundesland].filter(Boolean).join(', ')):''}</div>
    ${e.ablauf?(()=>{const lt=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);const du=Math.round((Date.parse(e.ablauf+'T00:00:00Z')-Date.parse(lt+'T00:00:00Z'))/86400000);const expired=du!=null&&du<0;const soon=du!=null&&du>=0&&du<=30;const col=expired?'var(--crit-fg)':(soon?'var(--warn-fg)':'var(--muted)');const bg=expired?'var(--crit-bg)':(soon?'var(--warn-bg)':'var(--chip-bg)');const txt=expired?t('ex_expired'):(du===0?t('ex_exp_today'):(du===1?t('ex_exp_1'):ti('ex_exp_in',{d:du})));return `<div style="display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:${col};background:${bg};border-radius:999px;padding:2px 10px">⏳ ${esc(t('ex_valid'))} ${esc(fmtDateDe(e.ablauf))} · ${esc(txt)}</div>`;})():''}
    ${mc?`<div style="margin-top:6px"><button class="linklike small" data-match style="color:var(--green);font-weight:700">${esc(matchLabel)}</button></div>`:''}
    ${e.note?`<div class="post-body" style="margin:6px 0">${esc(e.note)}</div>`:''}
    ${e.image && /^data:image\//.test(e.image) ? `<img data-zoom src="${e.image}" alt="${esc(t('ex_photo_alt'))}" style="max-width:100%;border-radius:10px;margin-top:6px;display:block;cursor:zoom-in" />` : ''}
    ${stale?`<div style="font-size:13px;margin-top:6px;background:var(--warn-bg);border:1px solid var(--warn-bd);color:var(--warn-fg);border-radius:8px;padding:6px 10px">⏳ ${esc(ti('ex_stale',{d:ageDays}))} <button class="linklike small" data-freshrenew>${esc(t('ex_renew'))}</button> · <button class="linklike small" data-freshdone>${esc(t('ex_stale_done'))}</button></div>`:''}
    <div class="row" style="margin-top:8px;align-items:baseline">
      <span class="handle clickable" data-openprofile="${esc(au.handle||'')}">${esc(t('ex_by'))} ${esc(au.display_name||t('ex_unknown'))} @${esc(au.handle||'?')}</span>
      <span class="sp" style="flex:1"></span>
      ${!mine ? `<button class="small" data-contact>${esc(t('ex_contact_btn'))}</button>`
              : (erledigt ? `<button class="ghost small" data-edit title="${esc(t('ex_edit'))}">✏️</button><button class="ghost small" data-reopen>${esc(t('ex_reopen'))}</button><button class="ghost small" data-del>🗑</button>`
                          : `<button class="ghost small" data-reserve title="${esc(t('ex_reserve_t'))}">${esc(e.reserved?t('ex_unreserve'):t('ex_reserve'))}</button><button class="ghost small" data-edit title="${esc(t('ex_edit'))}">✏️</button><button class="ghost small" data-done>${esc(t('ex_done_btn'))}</button><button class="ghost small" data-del>🗑</button>`)}
    </div>
    ${mine ? `<div class="comments hidden" data-editbox style="margin-top:8px">
      <input data-e-bez value="${esc(e.bezeichnung||'')}" placeholder="${esc(t('ex_bez_ph'))}">
      <div class="row" style="margin-top:6px"><input data-e-menge value="${esc(e.menge||'')}" placeholder="${esc(t('ex_menge_ph'))}"><input data-e-ort value="${esc(e.ort||'')}" placeholder="${esc(t('ex_ort_ph'))}"></div>
      <select data-e-bl data-i18n-aria="ex_bl_ph" aria-label="${esc(t('ex_bl_ph'))}" style="margin-top:6px"><option value="">${esc(t('ex_bl_ph'))}</option>${blOptions(e.bundesland||'')}</select>
      <input data-e-note value="${esc(e.note||'')}" placeholder="${esc(t('ex_note_ph'))}" style="margin-top:6px">
      <div class="row" style="margin-top:6px;align-items:center;gap:6px"><label style="font-size:13px;margin:0">⏳ ${esc(t('ex_expiry'))}</label><input type="date" data-e-ablauf value="${esc(e.ablauf||'')}" aria-label="${esc(t('ex_expiry'))}"></div>
      <div class="row" style="margin-top:8px"><button class="small" data-e-save>${esc(t('cm_save'))}</button><button class="ghost small" data-e-cancel>${esc(t('ex_edit_cancel'))}</button><span class="err" data-e-err style="margin-left:8px"></span></div>
    </div>` : ''}
  </div>`);
  card.querySelectorAll('[data-openprofile]').forEach(el => { if (el.dataset.openprofile) el.onclick = () => openProfile(el.dataset.openprofile); });
  const matchBtn = card.querySelector('[data-match]');
  if (matchBtn) matchBtn.onclick = () => {
    // Zeigt die passenden Gegen-Einträge: gegenteilige Art + erstes bedeutungstragendes Wort als Filter.
    const key = (String(e.bezeichnung).toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || [])[0] || e.bezeichnung;
    exchangeMine = false; exchangeFilter = isBiete ? 'suche' : 'biete'; exchangeQuery = key; loadExchange();
  };
  const contact = card.querySelector('[data-contact]');
  if (contact) contact.onclick = async () => {
    try {
      const r = await api('POST','/api/dm/start',{ handle: au.handle });
      // Kontext des Eintrags als editierbaren Entwurf mitgeben (Biete/Suche + Präparat).
      const kindLbl = isBiete ? t('ex_badge_biete') : t('ex_badge_suche');
      const draft = ti('ex_dm_draft', { kind: kindLbl, item: e.bezeichnung });
      openDmThread(r.thread.id, draft);
    } catch(err){ alert(err.message); }
  };
  const done = card.querySelector('[data-done]');
  if (done) done.onclick = async () => { try { await api('POST',`/api/exchange/${e.id}/resolve`); loadExchange(); } catch(err){ alert(err.message); } };
  const reserve = card.querySelector('[data-reserve]');
  if (reserve) reserve.onclick = async () => { try { await api('POST',`/api/exchange/${e.id}/reserve`,{ reserved: !e.reserved }); loadExchange(); } catch(err){ alert(err.message); } };
  const freshRenew = card.querySelector('[data-freshrenew]');
  if (freshRenew) freshRenew.onclick = async () => { try { await api('POST',`/api/exchange/${e.id}/renew`); loadExchange(); } catch(err){ alert(err.message); } };
  const freshDone = card.querySelector('[data-freshdone]');
  if (freshDone) freshDone.onclick = async () => { try { await api('POST',`/api/exchange/${e.id}/resolve`); loadExchange(); } catch(err){ alert(err.message); } };
  const reopen = card.querySelector('[data-reopen]');
  if (reopen) reopen.onclick = async () => { try { await api('POST',`/api/exchange/${e.id}/reopen`); loadExchange(); } catch(err){ alert(err.message); } };
  const del = card.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (!confirm(t('ex_del_confirm'))) return; try { await api('POST',`/api/exchange/${e.id}/delete`); loadExchange(); } catch(err){ alert(err.message); } };
  // Eigenen Eintrag bearbeiten (Präparat/Menge/Ort/Bundesland/Notiz) ohne löschen + neu anlegen.
  const editBtn = card.querySelector('[data-edit]');
  if (editBtn) {
    const box = card.querySelector('[data-editbox]');
    editBtn.onclick = () => box.classList.toggle('hidden');
    card.querySelector('[data-e-cancel]').onclick = () => box.classList.add('hidden');
    card.querySelector('[data-e-save]').onclick = async () => {
      const q = (sel) => card.querySelector(sel).value;
      try {
        await api('POST', `/api/exchange/${e.id}/update`, { bezeichnung: q('[data-e-bez]'), menge: q('[data-e-menge]'), ort: q('[data-e-ort]'), bundesland: q('[data-e-bl]'), note: q('[data-e-note]'), ablauf: q('[data-e-ablauf]') || null });
        loadExchange();
      } catch (err) { card.querySelector('[data-e-err]').textContent = err.message; }
    };
  }
  return card;
}

async function loadRabatte() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/rabatte?country=' + encodeURIComponent(viewCountry()));
    // Warenkorb-Zaehler nur, wenn der Bereich laeuft: Sonst quittiert der
    // Server mit 404, und das steht als roter Fehler in der Konsole.
    let cartN = 0;
    if (featureAn('bestellung')) { try { cartN = (await api('GET','/api/cart')).count; } catch { /* ohne Zähler weiter */ } }
    // Beobachtungsliste laden, um „nur beobachtete" zu ermöglichen (Fehler = kein Filter).
    let watched = new Set();
    try { const wl = await api('GET','/api/watchlist'); watched = new Set((wl.items||[]).map(i => (i.wirkstoff||'').toLowerCase())); } catch { /* ohne Filter weiter */ }
    if (!watched.size) rabattWatchedOnly = false; // ohne beobachtete Wirkstoffe keinen leeren Filter erzwingen
    feed.innerHTML = '';
    { const n = countryDataNotice(); if (n) feed.appendChild(n); }
    { const ln = legalNotice('deals'); if (ln) feed.appendChild(ln); }
    feed.appendChild(provenanceLegend());
    feed.appendChild(el(`<div class="card muted" style="margin-bottom:10px">${t('rb_header')} ${esc(t('prov_reference'))}</div>`));
    if (!d.rabatte.length) { feed.appendChild(emptyState({ icon:'🏷️', title:t('rb_empty_t'), text:t('rb_empty_s') })); return; }
    const bar = el(`<div class="card">
      <div class="row" style="gap:6px"><input data-q placeholder="${esc(t('pr_q_ph'))}" value="${esc(rabattQuery)}" style="flex:1"></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
        <button class="small sortbtn${rabattExpiring?'':' active'}" data-exp="0" aria-pressed="${!rabattExpiring}">${esc(t('sh_f_all'))}</button>
        <button class="small sortbtn${rabattExpiring?' active':''}" data-exp="1" aria-pressed="${rabattExpiring}">${esc(t('rb_expiring'))}</button>
        ${watched.size?`<button class="small sortbtn${rabattWatchedOnly?' active':''}" data-watchedonly aria-pressed="${rabattWatchedOnly}">${esc(t('rb_watched_only'))}</button>`:''}
        <select class="small" data-sort data-i18n-aria="rb_sort_aria" aria-label="${esc(t('rb_sort_aria'))}"><option value="pct"${rabattSort==='pct'?' selected':''}>${esc(t('rb_sort_pct'))}</option><option value="saving"${rabattSort==='saving'?' selected':''}>${esc(t('rb_sort_saving'))}</option></select>
        <span class="sp" style="flex:1"></span>
        <button class="ghost small" data-cart>🛒 ${esc(t('cart_title'))}${cartN?` (${cartN})`:''}</button>
        <button class="ghost small" data-rprint title="${esc(t('rb_print_t'))}">🖨️ ${esc(t('pr_print_btn'))}</button>
        <button class="ghost small" data-rcsv title="${esc(t('rb_csv_t'))}">⬇️ CSV</button>
      </div></div>`);
    feed.appendChild(bar);
    bar.querySelector('[data-cart]').onclick = () => openCart();
    const listBox = el('<div data-rlist></div>');
    feed.appendChild(listBox);
    let shown = [];
    bar.querySelector('[data-rcsv]').onclick = () => exportRabatteCsv(shown);
    bar.querySelector('[data-rprint]').onclick = () => printRabatte(shown);
    // Absolute Ersparnis je Aktion für die Mindestbestellung (pro Packung × Mindestmenge).
    const savingTotal = r => Number(r.ersparnis||0) * Math.max(Number(r.min_menge)||1, 1);
    const draw = () => {
      const q = rabattQuery.trim().toLowerCase();
      const list = d.rabatte.filter(r =>
        (!rabattExpiring || r.expiring_soon) &&
        (!rabattWatchedOnly || watched.has((r.wirkstoff||'').toLowerCase())) &&
        (!q || (r.bezeichnung||'').toLowerCase().includes(q) || (r.wirkstoff||'').toLowerCase().includes(q) || (r.supplier||'').toLowerCase().includes(q)));
      // Sortierung: höchster Rabatt % (Server-Standard) oder größte absolute Ersparnis €.
      if (rabattSort === 'saving') list.sort((a,b) => savingTotal(b) - savingTotal(a) || (b.rabatt_pct - a.rabatt_pct));
      // Rang für die aktuell gezeigte, sortierte Liste neu vergeben (#1..N bleibt sinnvoll).
      list.forEach((r,i) => { r.rank = i+1; });
      bar.querySelectorAll('[data-exp]').forEach(b => { const on = (b.dataset.exp==='1')===rabattExpiring; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
      { const wb = bar.querySelector('[data-watchedonly]'); if (wb) { wb.classList.toggle('active', rabattWatchedOnly); wb.setAttribute('aria-pressed', String(rabattWatchedOnly)); } }
      shown = list;
      const csvBtn = bar.querySelector('[data-rcsv]'); if (csvBtn) csvBtn.textContent = `⬇️ CSV (${list.length})`;
      listBox.innerHTML = '';
      if (!list.length) listBox.appendChild(filteredEmptyCard('rb_none', !!(q || rabattExpiring || rabattWatchedOnly), () => {
        rabattQuery = ''; rabattExpiring = false; rabattWatchedOnly = false;
        if (qi) qi.value = '';
        draw();
      }));
      else list.forEach(r => listBox.appendChild(rabattCard(r, watched, () => { if (rabattWatchedOnly) draw(); })));
    };
    bar.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => { rabattExpiring = b.dataset.exp==='1'; draw(); });
    { const wb = bar.querySelector('[data-watchedonly]'); if (wb) wb.onclick = () => { rabattWatchedOnly = !rabattWatchedOnly; draw(); }; }
    bar.querySelector('[data-sort]').onchange = (ev) => { rabattSort = ev.target.value; draw(); };
    const qi = bar.querySelector('[data-q]');
    let deb; qi.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { rabattQuery = qi.value; draw(); }, 250); };
    draw();
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

function rabattCard(r, watchedSet, onWatchChange) {
  const wKey = r.wirkstoff ? r.wirkstoff.toLowerCase() : '';
  const showStar = watchedSet && r.wirkstoff;
  const card = el(`<div class="card">
    <div class="row">
      <span class="rank">#${r.rank}</span>
      <span class="post-author">${esc(r.bezeichnung)}</span>
      ${r.wirkstoff?`<span class="handle clickable" data-wirkstoff="${esc(r.wirkstoff)}" title="Alles zu ${esc(r.wirkstoff)}">${esc(r.wirkstoff)}</span>`:''}
      ${showStar?`<button class="ghost small" data-wwatch aria-pressed="${watchedSet.has(wKey)}" title="${esc(watchedSet.has(wKey)?t('sc_watched'):t('sc_watch'))}" style="padding:2px 8px;min-height:0">${watchedSet.has(wKey)?'⭐':'☆'}</button>`:''}
      <span class="sp" style="flex:1"></span>
      <span class="rabatt-badge">−${r.rabatt_pct}%</span>
    </div>
    <div class="row" style="margin-top:8px;align-items:baseline">
      <span><b>${esc(r.supplier)}</b></span>
      <span class="sp" style="flex:1"></span>
      <span class="muted" style="text-decoration:line-through">€ ${fmtMoney(r.listenpreis)}</span>
      <span style="font-size:20px;font-weight:800;color:var(--ok-fg);margin-left:8px">€ ${fmtMoney(r.aktionspreis)}</span>
    </div>
    <div class="muted" style="margin-top:4px">${esc(ti('rb_saving',{x:fmtMoney(r.ersparnis)}))}${r.min_menge?` · ${esc(ti('pg_from',{n:r.min_menge}))}`:''} · ${esc(t('pg_valid'))} <b>${esc(r.gueltig_bis)}</b></div>
    ${r.min_menge&&r.ersparnis>0?`<div style="margin-top:4px;font-size:13px;font-weight:700;color:var(--ok-fg)">${esc(ti('rb_minorder',{n:r.min_menge,x:fmtMoney(Number(r.ersparnis)*Number(r.min_menge))}))}</div>`:''}
    ${r.aktionspreis!=null?`<div class="row" style="margin-top:6px;align-items:center;gap:6px;flex-wrap:wrap"><label style="font-size:13px">🧮 ${esc(t('rb_calc_qty'))}</label><input type="number" min="1" step="1" value="${r.min_menge||1}" data-qty style="width:88px" aria-label="${esc(t('rb_calc_qty'))}"><span data-calc style="font-size:13px;font-weight:700;color:var(--ok-fg)"></span></div>`:''}
    ${r.best_for_wirkstoff?`<div style="display:inline-block;margin-top:6px;background:rgba(11,127,40,.12);color:var(--ok-fg);border:1px solid rgba(11,127,40,.35);font-weight:700;font-size:13px;padding:3px 10px;border-radius:999px">${esc(ti('rb_best',{w:r.wirkstoff,alt:(r.wirkstoff_alternatives===1?t('rb_alt_one'):ti('rb_alt_many',{n:r.wirkstoff_alternatives}))}))}</div>`:''}
    ${!r.best_for_wirkstoff&&r.wirkstoff_alternatives>0?`<div class="muted" style="margin-top:6px;font-size:13px">${esc(ti('rb_cheaper_hint',{w:r.wirkstoff}))}</div>`:''}
    ${r.expiring_soon?`<div style="display:inline-block;margin-top:6px;background:${r.days_left<=3?'#c0392b':'#c77700'};color:#fff;font-weight:700;font-size:13px;padding:3px 10px;border-radius:999px">⏳ ${esc(r.days_left<=0?t('rb_exp_today'):(r.days_left===1?t('rb_exp_one'):ti('pg_only_days',{d:r.days_left})))}</div>`:''}
    <div class="row" style="margin-top:8px">
      <span class="muted">${esc(nlabel(r.post_count||0,'pg_posts_one','pg_posts'))}</span>
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-addcart>🛒 ${esc(t('cart_add'))}</button>
      <button class="ghost small" data-pp>${esc(t('sc_post_about'))}</button>
    </div>
    <div class="hidden" data-ppbox style="margin-top:6px">
      <textarea data-ppinput placeholder="${esc(ti('rb_post_ph',{supplier:r.supplier}))}"></textarea>
      <div style="margin-top:4px"><button class="small" data-ppsend>${esc(t('sc_post_send'))}</button></div>
    </div>
  </div>`);
  const ppbox = card.querySelector('[data-ppbox]');
  card.querySelector('[data-pp]').onclick = () => ppbox.classList.toggle('hidden');
  // Mengenrechner: Gesamtpreis + Gesamtersparnis für die eingegebene Bestellmenge.
  const qtyIn = card.querySelector('[data-qty]'), calcOut = card.querySelector('[data-calc]');
  if (qtyIn && calcOut) {
    const recalc = () => {
      const n = Math.max(0, Math.floor(Number(qtyIn.value) || 0));
      if (!n) { calcOut.textContent = ''; return; }
      const total = Number(r.aktionspreis) * n;
      const saved = Number(r.ersparnis || 0) * n;
      let txt = ti('rb_calc_result', { total: fmtMoney(total), saved: fmtMoney(saved) });
      if (r.min_menge && n < r.min_menge) txt += ' · ' + ti('rb_calc_below_min', { n: r.min_menge });
      calcOut.textContent = txt;
    };
    qtyIn.addEventListener('input', recalc);
    recalc();
  }
  card.querySelector('[data-ppsend]').onclick = async () => {
    const t = card.querySelector('[data-ppinput]');
    if (!t.value.trim()) return;
    try { await api('POST',`/api/rabatte/${r.id}/post`,{ body:t.value }); t.value=''; loadRabatte(); }
    catch(e){ alert(e.message); }
  };
  const rw = card.querySelector('[data-wirkstoff]');
  if (rw) rw.onclick = () => openWirkstoff(rw.dataset.wirkstoff);
  // Ein-Klick „beobachten" direkt am Rabatt: Wirkstoff auf die Merkliste (für Rabatt-Alarm).
  const wwatch = card.querySelector('[data-wwatch]');
  if (wwatch) wwatch.onclick = async () => {
    wwatch.disabled = true;
    try {
      if (watchedSet.has(wKey)) { await api('DELETE','/api/watchlist/'+encodeURIComponent(r.wirkstoff)); watchedSet.delete(wKey); }
      else { await api('POST','/api/watchlist',{ wirkstoff: r.wirkstoff }); watchedSet.add(wKey); }
      const now = watchedSet.has(wKey);
      wwatch.textContent = now ? '⭐' : '☆'; wwatch.setAttribute('aria-pressed', String(now));
      wwatch.title = now ? t('sc_watched') : t('sc_watch');
      if (onWatchChange) onWatchChange(); // aktiven „nur beobachtete"-Filter mitziehen
    } catch(e){ alert(e.message); }
    wwatch.disabled = false;
  };
  card.querySelector('[data-addcart]').onclick = (ev) => cartAdd({
    bezeichnung: r.bezeichnung, wirkstoff: r.wirkstoff, supplier: r.supplier,
    aktionspreis: r.aktionspreis, listenpreis: r.listenpreis, rabattPct: r.rabatt_pct, gueltigBis: r.gueltig_bis,
    // Menge aus dem Mengenrechner übernehmen (die gerade berechnete Menge = die Bestellmenge).
    menge: (qtyIn && Math.floor(Number(qtyIn.value)) > 0) ? Math.floor(Number(qtyIn.value)) : (r.min_menge || 1), sourceKind: 'rabatt',
  }, ev.target);
  return card;
}

// Artikel zur Einkaufsliste hinzufügen (mit optischer Bestätigung am Button).
async function cartAdd(payload, btn) {
  try {
    await api('POST', '/api/cart', payload);
    if (btn) { btn.textContent = '✓ ' + t('cart_added'); btn.disabled = true; }
    refreshCartCount();
  } catch(e){ alert(e.message); }
}

// Bestellung eines Lieferanten als Klartext in die Zwischenablage (zum Einfügen in
// Bestellportal/E-Mail des Großhandels). Positionen dieses Lieferanten + Summe.
async function copySupplierOrder(supplier, items, btn) {
  const key = (supplier || '').trim();
  const mine = items.filter(i => (i.supplier || '').trim() === key);
  if (!mine.length) return;
  const lines = mine.map(i => `- ${i.menge}× ${i.bezeichnung}${i.wirkstoff ? ` (${i.wirkstoff})` : ''}${i.aktionspreis != null ? ` — € ${fmtMoney(i.aktionspreis)}` : ''}`);
  const pieces = mine.reduce((s, i) => s + (Number(i.menge) || 0), 0);
  const sum = mine.reduce((s, i) => s + (i.aktionspreis != null ? Number(i.aktionspreis) * (Number(i.menge) || 0) : 0), 0);
  const text = [
    ti('cart_order_title', { supplier: key || t('cart_supplier_none') }),
    ...lines,
    ti('cart_summary', { n: pieces, sum: fmtMoney(Math.round(sum * 100) / 100) }),
  ].join('\n');
  try { await navigator.clipboard.writeText(text); if (btn) { const o = btn.textContent; btn.textContent = t('cart_order_copied'); setTimeout(() => { btn.textContent = o; }, 1600); } }
  catch { prompt(t('copy_link_fb'), text); }
}

// Einkaufsliste (Bestell-Merkzettel): Positionen mit Menge, Entfernen, CSV/Ausdruck.
async function openCart(flash) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('cart_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/cart'); } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  refreshCartCount();
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>
      <button class="ghost small" data-corders>${esc(t('cart_orders'))}</button>
      ${d.items.length?`<button class="ghost small" data-ccsv>⬇️ CSV</button><button class="ghost small" data-cprint>🖨️ ${esc(t('pr_print_btn'))}</button>`:''}
    </div>
    <h1 style="margin:8px 0 0">🛒 ${esc(t('cart_title'))}</h1>
    <div class="muted" data-grandtotal>${esc(ti('cart_summary',{ n:d.total_positions, sum:fmtMoney(d.total_price) }))}</div>
    <div data-savings style="font-weight:800;color:var(--ok-fg);font-size:14px;margin-top:2px${d.total_savings>0?'':';display:none'}">${d.total_savings>0?esc(ti('cart_savings',{ sum:fmtMoney(d.total_savings) })):''}</div>
    <div class="row" style="margin-top:10px;gap:6px">
      <input data-madd placeholder="${esc(t('cart_manual_ph'))}" style="flex:1" aria-label="${esc(t('cart_manual_add'))}">
      <input type="number" min="1" value="1" data-mqty style="width:78px" aria-label="${esc(t('cart_col_menge'))}">
      <button class="small" data-maddbtn>${esc(t('cart_manual_add'))}</button>
    </div>
    ${d.items.length?`<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">
      <input data-cref placeholder="${esc(t('cart_checkout_ref_ph'))}" style="flex:1;min-width:140px" aria-label="${esc(t('cart_checkout_ref_ph'))}">
      <button class="small" data-ccheckout>${esc(t('cart_checkout'))}</button>
      <button class="ghost small" data-savetpl title="${esc(t('tpl_save_t'))}">${esc(t('tpl_save'))}</button>
      <button class="ghost small" data-cclear>${esc(t('cart_clear'))}</button>
    </div>`:''}
  </div>`);
  head.querySelector('[data-back]').onclick = () => loadTab();
  head.querySelector('[data-corders]').onclick = () => openOrders();
  const stBtn = head.querySelector('[data-savetpl]');
  if (stBtn) stBtn.onclick = async () => {
    const name = prompt(t('tpl_save_prompt'));
    if (name == null) return;
    const nm = name.trim();
    if (nm.length < 2) { alert(t('tpl_name_short')); return; }
    try { await api('POST','/api/cart/templates',{ name: nm }); openCart(ti('tpl_saved',{name:nm})); }
    catch(e){ alert(e.message); }
  };
  feed.appendChild(head);
  if (flash) feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(flash)}</div>`));
  // Bestell-Vorlagen: wiederkehrende Listen per Klick laden. Immer anzeigen (auch bei leerer
  // Liste — genau dann will man eine Vorlage anwenden).
  try {
    const tl = await api('GET','/api/cart/templates');
    if (tl.templates && tl.templates.length) {
      const tc = el(`<div class="card"><b>${esc(t('tpl_title'))}</b><div class="muted" style="font-size:13px;margin:2px 0 8px">${esc(t('tpl_sub'))}</div><div data-tpllist></div></div>`);
      const box = tc.querySelector('[data-tpllist]');
      tl.templates.forEach(tp => {
        const row = el(`<div class="comment"><div class="row" style="align-items:baseline;gap:8px;flex-wrap:wrap">
          <b style="flex:1;min-width:120px">📋 ${esc(tp.name)}</b>
          <span class="muted" style="font-size:13px">${esc(ti('ord_positions',{n:tp.positions}))}${tp.total_price>0?` · € ${fmtMoney(tp.total_price)}`:''}</span>
          <button class="small" data-apply>${esc(t('tpl_apply'))}</button>
          <button class="ghost small" data-del title="${esc(t('tpl_delete'))}" aria-label="${esc(t('tpl_delete'))}">🗑</button>
        </div></div>`);
        row.querySelector('[data-apply]').onclick = async () => { try { await api('POST',`/api/cart/templates/${tp.id}/apply`); openCart(ti('tpl_applied',{name:tp.name})); } catch(e){ alert(e.message); } };
        row.querySelector('[data-del]').onclick = async () => { if (!confirm(ti('tpl_delete_confirm',{name:tp.name}))) return; try { await api('POST',`/api/cart/templates/${tp.id}/delete`); openCart(); } catch(e){ alert(e.message); } };
        box.appendChild(row);
      });
      feed.appendChild(tc);
    }
  } catch { /* ohne Vorlagen weiter */ }
  const madd = head.querySelector('[data-madd]');
  const addManual = async () => {
    const bez = madd.value.trim(); if (!bez) { madd.focus(); return; }
    let m = Math.round(Number(head.querySelector('[data-mqty]').value)); if (!(m>=1)) m=1;
    try { await api('POST','/api/cart',{ bezeichnung: bez, menge: m, sourceKind: 'manual' }); openCart(); }
    catch(e){ alert(e.message); }
  };
  head.querySelector('[data-maddbtn]').onclick = addManual;
  madd.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } };
  if (!d.items.length) {
    feed.appendChild(emptyState({ icon:'🛒', title:t('cart_empty_t'), text:t('cart_empty_s') }));
    // Leere Liste + vorhandene Historie: letzte Bestellung mit 1-Klick erneut bestellen.
    try {
      const oh = await api('GET','/api/orders');
      const last = (oh.orders||[])[0];
      if (last) {
        const label = last.reference ? last.reference : relTime(last.created_at);
        const c = el(`<div class="card"><div class="row" style="align-items:baseline;flex-wrap:wrap;gap:8px">
          <span>${esc(ti('cart_last_order',{ ref: label }))}</span><span class="muted" style="font-size:13px">${esc(ti('ord_positions',{n:last.positions}))} · € ${fmtMoney(last.total_price)}</span>
          <span class="sp" style="flex:1"></span><button class="small" data-relast>${esc(t('ord_reorder'))}</button></div></div>`);
        c.querySelector('[data-relast]').onclick = async () => { try { await api('POST',`/api/orders/${last.id}/reorder`); openCart(); } catch(e){ alert(e.message); } };
        feed.appendChild(c);
      }
    } catch { /* ohne Historie weiter */ }
    return;
  }
  head.querySelector('[data-ccsv]').onclick = () => exportCartCsv(d.items);
  head.querySelector('[data-cprint]').onclick = () => printCart(d);
  head.querySelector('[data-cclear]').onclick = async () => { if (!confirm(t('cart_clear_confirm'))) return; try { await api('POST','/api/cart/clear'); openCart(); } catch(e){ alert(e.message); } };
  // Als bestellt markieren: Liste als Bestellung sichern (Snapshot) und leeren.
  head.querySelector('[data-ccheckout]').onclick = async () => {
    const reference = head.querySelector('[data-cref]').value.trim();
    try { await api('POST','/api/cart/checkout', { reference }); openOrders(t('cart_checkout_done')); }
    catch(e){ alert(e.message); }
  };
  // Nach Lieferant sortieren (gleiche Bestellung zusammen); ohne Lieferant zuletzt.
  const bySupplier = [...d.items].sort((a, b) => {
    const sa = (a.supplier || '').trim(), sb = (b.supplier || '').trim();
    if (!sa && sb) return 1; if (sa && !sb) return -1;
    return sa.toLowerCase().localeCompare(sb.toLowerCase());
  });
  // Zwischensummen je Lieferant (Bestellungen gehen je Großhandel raus) — live gehalten,
  // damit Mengenänderungen sofort in Gruppen- und Gesamtsumme durchschlagen.
  const subEls = new Map(); // Lieferant-Key -> Subtotal-Element
  const grand = head.querySelector('[data-grandtotal]');
  const savingsEl = head.querySelector('[data-savings]');
  const recomputeTotals = () => {
    const byKey = new Map(); // key -> { sum, count }
    let total = 0, pieces = 0, savings = 0;
    for (const it of d.items) {
      const key = (it.supplier || '').trim();
      const cur = byKey.get(key) || { sum: 0, count: 0 };
      if (it.aktionspreis != null) { cur.sum += it.aktionspreis * it.menge; total += it.aktionspreis * it.menge; }
      if (it.listenpreis != null && it.aktionspreis != null) {
        const lp = Number(it.listenpreis), ap = Number(it.aktionspreis);
        if (lp > ap) savings += (lp - ap) * (Number(it.menge) || 0);
      }
      cur.count += 1;
      pieces += Number(it.menge) || 0;
      byKey.set(key, cur);
    }
    for (const [key, elp] of subEls) {
      const g = byKey.get(key) || { sum: 0, count: 0 };
      elp.textContent = ti('cart_sub_line', { n: g.count, sum: fmtMoney(Math.round(g.sum * 100) / 100) });
    }
    if (grand) grand.textContent = ti('cart_summary', { n: pieces, sum: fmtMoney(Math.round(total * 100) / 100) });
    if (savingsEl) {
      const sv = Math.round(savings * 100) / 100;
      savingsEl.style.display = sv > 0 ? '' : 'none';
      savingsEl.textContent = sv > 0 ? ti('cart_savings', { sum: fmtMoney(sv) }) : '';
    }
  };
  // Mehrere Lieferantengruppen? Dann kann die Apotheke einen Großhandel jetzt als bestellt
  // abschließen und den Rest später — jede Gruppe bekommt einen eigenen „bestellt"-Button.
  const supplierGroupCount = new Set(d.items.map(i => (i.supplier || '').trim().toLowerCase())).size;
  // Aktion abgelaufen? Gültigkeitsdatum in der Vergangenheit (lokaler Tag) — dann ist der
  // gespeicherte Aktionspreis nicht mehr verlässlich und sollte vor der Bestellung geprüft werden.
  const cartToday = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const dealExpired = (i) => i.gueltig_bis && String(i.gueltig_bis) < cartToday;
  { const expiredN = d.items.filter(dealExpired).length;
    if (expiredN) feed.appendChild(el(`<div class="card" style="background:var(--warn-bg);border-color:var(--warn-bd);color:var(--warn-fg);padding:10px 14px;font-size:14px" data-expwarn>⏳ ${esc(ti('cart_deal_expired_n',{n:expiredN}))}</div>`)); }
  let lastSupplier = null;
  bySupplier.forEach((i, idx) => {
    const sup = (i.supplier || '').trim();
    if (sup !== lastSupplier) {
      lastSupplier = sup;
      const sh = el(`<div class="cart-sup" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="flex:1">🏢 ${esc(sup || t('cart_supplier_none'))}</span>${supplierGroupCount>=2?`<button class="small" data-supcheckout title="${esc(t('cart_sup_checkout_t'))}">✓ ${esc(t('cart_sup_checkout'))}</button>`:''}<button class="ghost small" data-supcopy title="${esc(t('cart_copy_order'))}">📋 ${esc(t('cart_copy_order'))}</button></div>`);
      sh.querySelector('[data-supcopy]').onclick = (ev) => copySupplierOrder(sup, d.items, ev.target);
      const scBtn = sh.querySelector('[data-supcheckout]');
      if (scBtn) scBtn.onclick = async () => {
        const supLabel = sup || t('cart_supplier_none');
        if (!confirm(ti('cart_sup_checkout_confirm', { sup: supLabel }))) return;
        scBtn.disabled = true;
        const reference = (head.querySelector('[data-cref]') || {}).value;
        try {
          await api('POST','/api/cart/checkout',{ reference: reference ? reference.trim() : '', supplier: sup });
          openCart(ti('cart_sup_checkout_done', { sup: supLabel }));
        } catch(e){ alert(e.message); scBtn.disabled = false; }
      };
      feed.appendChild(sh);
    }
    const card = el(`<div class="card"><div class="row" style="align-items:baseline">
      <span class="post-author">${esc(i.bezeichnung)}</span>
      ${i.wirkstoff?`<span class="handle">${esc(i.wirkstoff)}</span>`:''}
      <span class="sp" style="flex:1"></span>
      ${i.aktionspreis!=null?`<span style="font-weight:800;color:var(--ok-fg)">€ ${fmtMoney(i.aktionspreis)}</span>`:''}
    </div>
    ${i.supplier?`<div class="muted" style="font-size:13px">${esc(i.supplier)}${i.rabatt_pct?` · −${i.rabatt_pct}%`:''}${i.gueltig_bis?` · ${esc(t('pg_valid'))} <span${dealExpired(i)?' style="color:var(--warn-fg);font-weight:700"':''}>${esc(fmtDateDe(i.gueltig_bis))}</span>`:''}</div>`:''}
    ${dealExpired(i)?`<div style="margin-top:6px;font-size:13px;background:var(--warn-bg);border:1px solid var(--warn-bd);color:var(--warn-fg);border-radius:8px;padding:4px 10px">⏳ ${esc(t('cart_deal_expired'))}</div>`:''}
    <div class="row" style="margin-top:8px;align-items:center;gap:8px;flex-wrap:wrap">
      <label style="margin:0">${esc(t('cart_col_menge'))}</label>
      <button class="ghost small" data-qminus aria-label="${esc(t('cart_qty_minus'))}" title="${esc(t('cart_qty_minus'))}" style="min-width:36px;font-size:18px;line-height:1">−</button>
      <input type="number" min="1" value="${i.menge}" data-qty style="width:60px;text-align:center" aria-label="${esc(t('cart_col_menge'))}">
      <button class="ghost small" data-qplus aria-label="${esc(t('cart_qty_plus'))}" title="${esc(t('cart_qty_plus'))}" style="min-width:36px;font-size:18px;line-height:1">+</button>
      ${i.aktionspreis!=null?`<span class="muted" data-linesum>= € ${fmtMoney(i.aktionspreis*i.menge)}</span>`:''}
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-crem title="${esc(t('cart_remove'))}" aria-label="${esc(t('cart_remove'))}">🗑</button>
    </div>
    <input data-note value="${esc(i.note||'')}" placeholder="${esc(t('cart_note_ph'))}" maxlength="200" style="margin-top:6px" aria-label="${esc(t('cart_col_note'))}"></div>`);
    const qty = card.querySelector('[data-qty]');
    const saveQty = async (val) => {
      let m = Math.round(Number(val)); if (!(m>=1)) m=1; qty.value=m;
      try { const r = await api('POST',`/api/cart/${i.id}`,{ menge:m }); i.menge=r.item.menge;
        const ls = card.querySelector('[data-linesum]'); if (ls && i.aktionspreis!=null) ls.textContent = '= € '+fmtMoney(i.aktionspreis*i.menge);
        recomputeTotals(); // Gruppen- und Gesamtsumme sofort mitziehen
      } catch(e){ alert(e.message); }
    };
    qty.onchange = () => saveQty(qty.value);
    card.querySelector('[data-qminus]').onclick = () => saveQty((Number(qty.value)||1) - 1);
    card.querySelector('[data-qplus]').onclick = () => saveQty((Number(qty.value)||1) + 1);
    const note = card.querySelector('[data-note]');
    note.onchange = async () => { try { await api('POST',`/api/cart/${i.id}`,{ note: note.value }); i.note = note.value.trim(); } catch(e){ alert(e.message); } };
    card.querySelector('[data-crem]').onclick = async () => { try { await api('POST',`/api/cart/${i.id}/remove`); openCart(); } catch(e){ alert(e.message); } };
    feed.appendChild(card);
    // Am Ende jeder Lieferantengruppe die Zwischensumme ausgeben (nur wenn mehr als eine
    // Gruppe existiert — bei nur einem Lieferant genügt die Gesamtsumme oben).
    const next = bySupplier[idx + 1];
    const nextSup = next ? (next.supplier || '').trim() : ' end';
    if (nextSup !== sup && !(idx === bySupplier.length - 1 && subEls.size === 0)) {
      const subEl = el(`<div class="cart-subline"></div>`);
      subEls.set(sup, subEl);
      feed.appendChild(subEl);
    }
  });
  recomputeTotals();
}

// Einkaufsliste/Bestellung als CSV (Excel-tauglich) — geteilt von Liste und Bestell-Historie.
function exportCartCsv(items) {
  const lineSaving = (i) => (i.listenpreis!=null && i.aktionspreis!=null && Number(i.listenpreis) > Number(i.aktionspreis)) ? (Number(i.listenpreis)-Number(i.aktionspreis))*Number(i.menge) : 0;
  const rows = (items||[]).map(i => [i.bezeichnung, i.wirkstoff||'', i.supplier||'', i.menge, i.listenpreis!=null?fmtMoney(i.listenpreis):'', i.aktionspreis!=null?fmtMoney(i.aktionspreis):'', i.aktionspreis!=null?fmtMoney(i.aktionspreis*i.menge):'', lineSaving(i)>0?fmtMoney(lineSaving(i)):'', i.gueltig_bis||'', i.note||'']);
  downloadCsv('apopulse-einkaufsliste', [t('csv_praeparat'), t('csv_wirkstoff'), t('csv_lieferant'), t('cart_col_menge'), t('csv_listenpreis'), t('csv_aktionspreis'), t('cart_col_sum'), t('pr_print_saving'), t('csv_gueltig_bis'), t('cart_col_note')], rows);
}

function printCart(d) {
  const css = `table{border-collapse:collapse;width:100%;margin-bottom:14px} th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;font-size:13px} th{background:#eee} .r{text-align:right} h3{margin:14px 0 6px;font-size:15px} tfoot td{font-weight:700;background:#eee}`;
  // Bestellungen gehen je Großhandel raus -> nach Lieferant gruppieren, je Gruppe eine Zwischensumme.
  const groups = new Map();
  for (const i of d.items) {
    const key = (i.supplier || '').trim() || ' '; // ohne Lieferant zuletzt
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const ordered = [...groups.keys()].sort((a, b) => {
    if (a === ' ' && b !== ' ') return 1; if (b === ' ' && a !== ' ') return -1;
    return a.localeCompare(b);
  });
  const section = (key) => {
    const items = groups.get(key);
    const label = key === ' ' ? t('cart_supplier_none') : key;
    const sub = items.reduce((s, i) => s + (Number(i.aktionspreis) || 0) * (Number(i.menge) || 0), 0);
    const rows = items.map(i => `<tr><td>${esc(i.bezeichnung)}</td><td>${esc(i.wirkstoff||'')}</td><td class="r">${i.menge}</td><td class="r">${i.aktionspreis!=null?'€ '+printMoney(i.aktionspreis):'—'}</td><td class="r">${i.aktionspreis!=null?'€ '+printMoney(i.aktionspreis*i.menge):'—'}</td><td>${esc(i.gueltig_bis||'')}</td>${i.note?`<td>${esc(i.note)}</td>`:'<td></td>'}</tr>`).join('');
    return `<h3>🏢 ${esc(label)}</h3>
      <table><thead><tr><th>${esc(t('csv_praeparat'))}</th><th>${esc(t('csv_wirkstoff'))}</th><th>${esc(t('cart_col_menge'))}</th><th>${esc(t('csv_aktionspreis'))}</th><th>${esc(t('cart_col_sum'))}</th><th>${esc(t('csv_gueltig_bis'))}</th><th>${esc(t('cart_col_note'))}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4" class="r">${esc(t('cart_subtotal'))}</td><td class="r">€ ${printMoney(Math.round(sub*100)/100)}</td><td></td><td></td></tr></tfoot></table>`;
  };
  const savings = Number(d.total_savings) || 0;
  const body = `<div style="color:#444;margin-bottom:8px">${esc(printDate())} · ${esc(ti('cart_summary',{ n:d.total_positions, sum:printMoney(d.total_price) }))}${savings>0?` · <b style="color:#0b7f28">${esc(ti('cart_savings',{ sum:printMoney(savings) }))}</b>`:''}</div>
    ${ordered.map(section).join('')}
    <div style="margin-top:6px;color:#666;font-size:12px">${esc(t('cart_print_foot'))}</div>`;
  openPrintDoc(t('cart_print_title'), css, body);
}

// Bestell-Historie: abgeschlossene Einkaufslisten ansehen, erneut bestellen oder löschen.
// Premium: Videosprechstunde bei einer Apotheke anfragen (Terminbuchung).
function openBookVideocall(providerHandle, providerName) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('vc_book'));
  feed.innerHTML = '';
  const today = new Date().toISOString().slice(0,10);
  const card = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('vc_book'))}</h1>
    <div class="muted" style="margin-bottom:10px">${esc(ti('vc_book_sub',{name: providerName||('@'+providerHandle)}))}</div>
    <label>${esc(t('vc_date'))}</label>
    <input type="date" data-vdate min="${today}" value="${today}">
    <label style="margin-top:6px">${esc(t('vc_time'))}</label>
    <input type="time" data-vtime value="10:00">
    <label style="margin-top:6px">${esc(t('vc_reason'))}</label>
    <input data-vreason placeholder="${esc(t('vc_reason_ph'))}" maxlength="300">
    <div class="row" style="margin-top:10px"><button data-vsend>${esc(t('vc_request'))}</button><span class="err" data-verr style="margin-left:10px"></span></div>
    <div class="muted" style="font-size:12px;margin-top:8px">${esc(t('vc_privacy'))}</div>
  </div>`);
  card.querySelector('[data-back]').onclick = () => openProfile(providerHandle);
  card.querySelector('[data-vsend]').onclick = async () => {
    const err = card.querySelector('[data-verr]'); err.textContent = '';
    try {
      await api('POST','/api/appointments', { providerHandle, datum: card.querySelector('[data-vdate]').value, uhrzeit: card.querySelector('[data-vtime]').value, grund: card.querySelector('[data-vreason]').value.trim() });
      openAppointments(t('vc_requested'));
    } catch(e){ err.textContent = e.message; }
  };
  feed.appendChild(card);
}

// Premium: eigene Videosprechstunden verwalten (als Anbieter bestätigen/ablehnen, Call starten).
// Termine so ordnen, dass der NÄCHSTE zuerst steht: anstehende (heute/künftig) zuerst,
// soonest oben; vergangene danach, neueste zuerst. Der Server liefert rein aufsteigend —
// dabei landen erledigte Vergangenheits-Termine oben und verdecken den nächsten Termin.
function sortAppointments(list, today) {
  const isPast = (a) => (a && a.datum || '') < today;
  return [...(list || [])].sort((a, b) => {
    const pa = isPast(a), pb = isPast(b);
    if (pa !== pb) return pa ? 1 : -1; // anstehende vor vergangenen
    const ka = (a.datum || '') + (a.uhrzeit || ''), kb = (b.datum || '') + (b.uhrzeit || '');
    return pa ? kb.localeCompare(ka) : ka.localeCompare(kb); // vergangene: neueste zuerst; anstehende: soonest zuerst
  });
}

async function openAppointments(flash) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('vc_my'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/appointments'); } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card"><div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span></div>
    <h1 style="margin:8px 0 2px">${esc(t('vc_my'))}</h1>
    <div class="muted">${esc(d.premium?t('vc_my_sub_premium'):t('vc_my_sub_free'))}</div></div>`);
  head.querySelector('[data-back]').onclick = () => me && openProfile(me.handle);
  feed.appendChild(head);
  if (flash) feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(flash)}</div>`));
  if (!d.appointments.length) { feed.appendChild(emptyState({ icon:'📹', title:t('vc_empty_t'), text:t('vc_empty_s') })); return; }
  const statusMeta = { angefragt:['var(--warn-fg)','var(--warn-bg)',t('vc_st_pending')], bestaetigt:['var(--ok-fg)','var(--ok-bg)',t('vc_st_confirmed')], abgelehnt:['var(--crit-fg)','var(--crit-bg)',t('vc_st_declined')], storniert:['var(--muted)','var(--chip-bg)',t('vc_st_cancelled')] };
  for (const a of sortAppointments(d.appointments, taskToday())) {
    const other = a.i_am_provider ? a.requester : a.provider;
    const [col,bg,lab] = statusMeta[a.status] || ['var(--muted)','var(--chip-bg)',a.status];
    const card = el(`<div class="card">
      <div class="row" style="align-items:baseline">
        <b>${esc(fmtDateDe(a.datum))} · ${esc(a.uhrzeit)}</b>
        <span class="sp" style="flex:1"></span>
        <span style="display:inline-block;font-size:12px;font-weight:700;color:${col};background:${bg};padding:2px 8px;border-radius:999px">${esc(lab)}</span>
      </div>
      <div class="muted" style="font-size:13px;margin-top:2px">${esc(a.i_am_provider?t('vc_with_customer'):t('vc_with_pharmacy'))}: <b class="clickable" data-openprofile="${esc(other?other.handle:'')}">${esc(other?(other.display_name||('@'+other.handle)):'—')}</b></div>
      ${a.grund?`<div class="post-body" style="margin-top:6px">${esc(a.grund)}</div>`:''}
      <div class="reacts" style="margin-top:8px">
        ${a.status==='bestaetigt'&&a.room_url?`<a class="small" style="text-decoration:none" href="${esc(a.room_url)}" target="_blank" rel="noopener noreferrer">📹 ${esc(t('vc_join'))}</a>`:''}
        ${a.i_am_provider&&a.status==='angefragt'?`<button class="small" data-accept>${esc(t('vc_accept'))}</button><button class="ghost small" data-decline>${esc(t('vc_decline'))}</button>`:''}
        ${(a.status==='angefragt'||a.status==='bestaetigt')?`<button class="ghost small" data-cancel>${esc(t('vc_cancel'))}</button>`:''}
      </div></div>`);
    card.querySelectorAll('[data-openprofile]').forEach(el2 => { if (el2.dataset.openprofile) el2.onclick = () => openProfile(el2.dataset.openprofile); });
    const acc = card.querySelector('[data-accept]'); if (acc) acc.onclick = async () => { try { await api('POST',`/api/appointments/${a.id}/respond`,{ accept:true }); openAppointments(); } catch(e){ alert(e.message); } };
    const dec = card.querySelector('[data-decline]'); if (dec) dec.onclick = async () => { try { await api('POST',`/api/appointments/${a.id}/respond`,{ accept:false }); openAppointments(); } catch(e){ alert(e.message); } };
    const can = card.querySelector('[data-cancel]'); if (can) can.onclick = async () => { if (!confirm(t('vc_cancel_confirm'))) return; try { await api('POST',`/api/appointments/${a.id}/cancel`); openAppointments(); } catch(e){ alert(e.message); } };
    feed.appendChild(card);
  }
}

// ── Team-Verwaltung (Mitglieder der eigenen Organisation) ───────────────────
const TEAM_ROLES = ['admin', 'apotheker', 'pta', 'lehrling'];
function roleLabel(r) { return t('tm_role_' + r) !== 'tm_role_' + r ? t('tm_role_' + r) : r; }
async function openTeam() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('tm_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/team'); } catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, openTeam)); return; }
  feed.innerHTML = '';
  const mem = d.membership;
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 2px">👥 ${esc(t('tm_title'))}</h1>
    <div class="muted">${mem?esc(mem.org_name||''):''}${mem?' · '+esc(roleLabel(mem.role)):''}</div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => openTeamHub();
  feed.appendChild(head);
  if (!mem || !mem.can_manage_users) {
    feed.appendChild(el(`<div class="card muted">${esc(t('tm_no_perm'))}</div>`));
    return;
  }
  // Mitglied hinzufügen
  const addCard = el(`<div class="card">
    <b>${esc(t('tm_add_title'))}</b>
    <div class="muted" style="font-size:13px;margin:2px 0 8px">${esc(t('tm_add_hint'))}</div>
    <input id="tm_name" placeholder="${esc(t('tm_name'))}" maxlength="80">
    <input id="tm_email" type="email" placeholder="${esc(t('tm_email'))}" style="margin-top:6px">
    <div class="row" style="gap:6px;margin-top:6px">
      <select id="tm_role" aria-label="${esc(t('tm_role'))}">${TEAM_ROLES.map(r=>`<option value="${r}"${r==='pta'?' selected':''}>${esc(roleLabel(r))}</option>`).join('')}</select>
      <input id="tm_pw" type="text" placeholder="${esc(t('tm_pw'))}" style="flex:1;min-width:120px">
    </div>
    <div class="row" style="margin-top:8px"><button data-add>${esc(t('tm_add_btn'))}</button><span class="err" data-err style="margin-left:10px"></span></div>
  </div>`);
  addCard.querySelector('[data-add]').onclick = async () => {
    const err = addCard.querySelector('[data-err]'); err.textContent='';
    try {
      await api('POST','/api/team', { name: v('tm_name'), email: v('tm_email'), role: document.getElementById('tm_role').value, password: document.getElementById('tm_pw').value });
      openTeam();
    } catch(e){ err.textContent = e.message; }
  };
  feed.appendChild(addCard);
  // Mitgliederliste
  const listCard = el(`<div class="card"><b>${esc(ti('tm_members',{n:d.members.length}))}</b><div data-ml style="margin-top:8px"></div></div>`);
  const ml = listCard.querySelector('[data-ml]');
  d.members.forEach(m => {
    const row = el(`<div class="row" style="align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line);flex-wrap:wrap">
      <div style="flex:1;min-width:140px"><b>${esc(m.name||m.email)}</b>${m.is_self?` <span class="muted">(${esc(t('tm_you'))})</span>`:''}<div class="muted" style="font-size:13px">${esc(m.email)}</div></div>
      <select data-role aria-label="${esc(t('tm_role'))}">${TEAM_ROLES.map(r=>`<option value="${r}"${m.role===r?' selected':''}>${esc(roleLabel(r))}</option>`).join('')}</select>
      <button class="ghost small" data-remove ${m.is_self?'disabled':''}>${esc(t('tm_remove'))}</button>
    </div>`);
    row.querySelector('[data-role]').onchange = async (e) => {
      try { await api('POST',`/api/team/${m.user_id}/role`,{ role: e.target.value }); openTeam(); }
      catch(err){ alert(err.message); openTeam(); }
    };
    const rm = row.querySelector('[data-remove]');
    if (!m.is_self) rm.onclick = async () => { if (!confirm(ti('tm_remove_confirm',{name:m.name||m.email}))) return; try { await api('POST',`/api/team/${m.user_id}/remove`); openTeam(); } catch(err){ alert(err.message); } };
    ml.appendChild(row);
  });
  feed.appendChild(listCard);
}

// ── Team-Arbeitsbereich (Hub: Aufgaben, Notizen, Verwaltung) ────────────────
async function openTeamHub() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('th_nav'));
  feed.innerHTML = '<div class="loading">…</div>';
  let mem = null;
  try { mem = (await api('GET','/api/team')).membership; } catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openTeamHub())); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('th_nav'))}</h1>
    <div class="muted">${mem?esc(mem.org_name||''):''}${mem&&mem.role?' · '+esc(roleLabel(mem.role)):''}</div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  feed.appendChild(head);
  const tile = (icon, title, sub, fn) => {
    const c = el(`<div class="card clickable" role="button" tabindex="0" style="cursor:pointer"><div class="row" style="align-items:center;gap:12px"><div style="font-size:26px">${icon}</div><div style="flex:1"><b>${esc(title)}</b><div class="muted" style="font-size:13px">${esc(sub)}</div></div><span class="ovtile-go" aria-hidden="true">›</span></div></div>`);
    c.onclick = fn; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
    feed.appendChild(c);
  };
  tile('✅', t('tk_title'), t('th_tasks_sub'), () => openTasks());
  tile('📋', t('kb_title'), t('th_notes_sub'), () => openNotes());
  if (mem && mem.can_manage_users) tile('⚙️', t('tm_title'), t('th_manage_sub'), () => openTeam());
}

// ── Team-Aufgaben ───────────────────────────────────────────────────────────
let taskPrefill = null; // {title} — z.B. „Als Aufgabe" aus einem Engpass
let taskFilter = 'aktiv'; // 'aktiv' (offen+in Arbeit) | 'meine' | 'ueberfaellig' | 'erledigt' | 'alle'
function taskStatusMeta(s) {
  if (s === 'erledigt')  return ['var(--ok-fg)', 'var(--ok-bg)', t('tk_st_erledigt')];
  if (s === 'in_arbeit') return ['var(--warn-fg)', 'var(--warn-bg)', t('tk_st_in_arbeit')];
  return ['var(--muted)', 'var(--chip-bg)', t('tk_st_offen')];
}
async function openTasks() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('tk_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/tasks'); } catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openTasks())); return; }
  feed.innerHTML = '';
  const hasOpen = (d.tasks || []).some(tk => tk.status !== 'erledigt');
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>${hasOpen?`<button class="ghost small" data-print title="${esc(t('tk_print_t'))}">${esc(t('tk_print'))}</button>`:''}</div>
    <h1 style="margin:8px 0 2px">✅ ${esc(t('tk_title'))}</h1>
    <div class="muted">${esc(t('tk_sub'))}</div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => openTeamHub();
  { const pb = head.querySelector('[data-print]'); if (pb) pb.onclick = () => printTasks(d.tasks); }
  feed.appendChild(head);
  if (d.can_assign) {
    const opts = `<option value="">${esc(t('tk_unassigned'))}</option>` + d.members.map(m=>`<option value="${esc(m.user_id)}">${esc(m.name||'')}</option>`).join('');
    const addCard = el(`<div class="card">
      <b>${esc(t('tk_new'))}</b>
      <input id="tk_title" placeholder="${esc(t('tk_f_title_ph'))}" maxlength="120" style="margin-top:6px">
      <textarea id="tk_desc" rows="2" placeholder="${esc(t('tk_f_desc_ph'))}" maxlength="1000" style="margin-top:6px"></textarea>
      <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
        <select id="tk_assignee" aria-label="${esc(t('tk_f_assignee'))}">${opts}</select>
        <input id="tk_due" type="date" aria-label="${esc(t('tk_f_due'))}">
      </div>
      <div class="row" style="margin-top:8px"><button data-add>${esc(t('tk_add'))}</button><span class="err" data-err style="margin-left:10px"></span></div>
    </div>`);
    addCard.querySelector('[data-add]').onclick = async () => {
      const err = addCard.querySelector('[data-err]'); err.textContent='';
      try {
        await api('POST','/api/tasks', { title: v('tk_title'), description: document.getElementById('tk_desc').value.trim(), assigneeUserId: document.getElementById('tk_assignee').value || null, dueDate: document.getElementById('tk_due').value || null });
        openTasks();
      } catch(e){ err.textContent = e.message; }
    };
    feed.appendChild(addCard);
    // Vorbelegter Titel (z.B. „Als Aufgabe" aus einem Engpass) — Formular ausfüllen & fokussieren.
    if (taskPrefill && taskPrefill.title) { const ti_ = addCard.querySelector('#tk_title'); ti_.value = taskPrefill.title; ti_.focus(); }
  } else if (taskPrefill && taskPrefill.title) {
    // Vorbelegung angefordert, aber keine Berechtigung zum Anlegen — nicht stillschweigend
    // verwerfen, sondern klar erklären (Owner-UX: keine toten Primär-Aktionen).
    feed.appendChild(el(`<div class="card" style="border-left:4px solid var(--warn-fg)">${esc(t('tk_no_create'))}</div>`));
  }
  taskPrefill = null; // Vorbelegung ist einmalig
  if (!d.tasks.length) { feed.appendChild(emptyState({ icon:'✅', title:t('tk_empty_t'), text: d.can_assign ? t('tk_empty_s') : t('tk_empty_s_member') })); return; }
  const localToday = taskToday();
  const isOverdue = (tk) => taskIsOverdue(tk, localToday);
  // Filter-Prädikate: „aktiv" (Standard) blendet Erledigtes aus, damit die Liste auf das
  // Handlungsrelevante fokussiert — weniger Scrollen für ein zeitknappes Team.
  const preds = {
    aktiv: (tk) => tk.status !== 'erledigt',
    meine: (tk) => tk.mine && tk.status !== 'erledigt',
    ueberfaellig: (tk) => isOverdue(tk),
    erledigt: (tk) => tk.status === 'erledigt',
    alle: () => true,
  };
  if (!preds[taskFilter]) taskFilter = 'aktiv';
  const count = (k) => d.tasks.filter(preds[k]).length;
  // Nur sinnvolle Chips zeigen: „Meine" nur wenn es welche gibt, „Überfällig" nur bei Bedarf.
  const chips = [['aktiv', t('tk_f_active')], ['meine', t('tk_f_mine')], ['ueberfaellig', t('tk_f_overdue')], ['erledigt', t('tk_f_done')], ['alle', t('tk_f_all')]]
    .filter(([k]) => k === 'aktiv' || k === 'alle' || count(k) > 0);
  const bar = el(`<div class="card" style="padding:8px 12px"><div class="reacts" style="flex-wrap:wrap" role="group" aria-label="${esc(t('tk_filter_aria'))}">
    ${chips.map(([k,l]) => `<button class="small sortbtn${taskFilter===k?' active':''}" data-tf="${k}" aria-pressed="${taskFilter===k}">${esc(l)} <span class="muted">${count(k)}</span></button>`).join('')}
  </div></div>`);
  feed.appendChild(bar);
  const listBox = el('<div data-tasklist></div>');
  feed.appendChild(listBox);
  const renderList = () => {
    listBox.innerHTML = '';
    bar.querySelectorAll('[data-tf]').forEach(b => { const on = b.dataset.tf === taskFilter; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    const shown = d.tasks.filter(preds[taskFilter] || preds.aktiv);
    if (!shown.length) { listBox.appendChild(el(`<div class="card muted">${esc(t('tk_none_filter'))}</div>`)); return; }
    // Nach Dringlichkeit sortieren statt nach Anlege-Reihenfolge: überfällig zuerst, dann
    // nach Fälligkeit (bald zuerst), dann ohne Termin, Erledigtes ans Ende. So steht das
    // Brennendste oben — weniger Scrollen für ein zeitknappes Team.
    const urgency = (tk) => tk.status === 'erledigt' ? 3 : (isOverdue(tk) ? 0 : (tk.due_date ? 1 : 2));
    shown.sort((a, b) => urgency(a) - urgency(b) || String(a.due_date || '').localeCompare(String(b.due_date || '')));
    shown.forEach(tk => {
      const [col,bg,lab] = taskStatusMeta(tk.status);
      const canEdit = tk.mine || d.can_assign;
      const overdue = isOverdue(tk);
      const card = el(`<div class="card">
        <div class="row" style="align-items:baseline;gap:8px">
          <b style="flex:1">${esc(tk.title)}</b>
          <span style="display:inline-block;font-size:12px;font-weight:800;color:${col};background:${bg};padding:2px 10px;border-radius:999px">${esc(lab)}</span>
        </div>
        ${tk.description?`<div class="muted" style="font-size:14px;white-space:pre-wrap;margin-top:4px">${esc(tk.description)}</div>`:''}
        <div class="muted" style="font-size:13px;margin-top:6px">
          ${tk.assignee_name?`👤 ${esc(ti('tk_assigned_to',{name:tk.assignee_name}))}`:`👤 ${esc(t('tk_unassigned'))}`}
          ${tk.due_date?` · 🗓 ${esc(ti('tk_due',{d:fmtDateDe(tk.due_date)}))}${overdue?` <b style="color:var(--crit-fg)">(${esc(t('tk_overdue'))})</b>`:''}`:''}
        </div>
        ${canEdit?`<div class="reacts" style="margin-top:8px">
          <button class="ghost small" data-st="offen"${tk.status==='offen'?' disabled':''}>${esc(t('tk_set_offen'))}</button>
          <button class="ghost small" data-st="in_arbeit"${tk.status==='in_arbeit'?' disabled':''}>${esc(t('tk_set_progress'))}</button>
          <button class="small" data-st="erledigt"${tk.status==='erledigt'?' disabled':''}>${esc(t('tk_set_done'))}</button>
        </div>`:''}
        ${d.can_assign?`<div class="row" style="margin-top:8px;align-items:center;gap:6px;flex-wrap:wrap">
          <label style="margin:0;font-size:13px" for="tkasg_${esc(tk.id)}">${esc(t('tk_f_assignee'))}</label>
          <select data-reassign id="tkasg_${esc(tk.id)}" class="small" style="max-width:100%">
            <option value="">${esc(t('tk_unassigned'))}</option>
            ${d.members.map(m=>`<option value="${esc(m.user_id)}"${tk.assignee_user_id===m.user_id?' selected':''}>${esc(m.name||'')}</option>`).join('')}
          </select>
          <button class="ghost small" data-edit style="margin-left:auto">${esc(t('tk_edit'))}</button>
        </div>`:''}</div>`);
      card.querySelectorAll('[data-st]').forEach(b => { if (!b.disabled) b.onclick = async () => { try { await api('POST',`/api/tasks/${tk.id}/status`,{ status: b.dataset.st }); openTasks(); } catch(e){ alert(e.message); } }; });
      { const rs = card.querySelector('[data-reassign]'); if (rs) rs.onchange = async () => { try { await api('POST',`/api/tasks/${tk.id}/assign`,{ assigneeUserId: rs.value || null }); openTasks(); } catch(e){ alert(e.message); } }; }
      { const eb = card.querySelector('[data-edit]'); if (eb) eb.onclick = () => {
        // Inline-Bearbeiten (nur berechtigte Rolle): Titel/Details/Fälligkeit vorbefüllt ändern.
        const form = el(`<div class="card">
          <label style="font-size:13px" for="tke_t_${esc(tk.id)}">${esc(t('tk_f_title_ph'))}</label>
          <input id="tke_t_${esc(tk.id)}" data-etitle maxlength="120" value="${esc(tk.title)}">
          <textarea data-edesc rows="2" maxlength="1000" placeholder="${esc(t('tk_f_desc_ph'))}" style="margin-top:6px">${esc(tk.description||'')}</textarea>
          <label style="font-size:13px;margin-top:6px" for="tke_d_${esc(tk.id)}">${esc(t('tk_f_due'))}</label>
          <input id="tke_d_${esc(tk.id)}" data-edue type="date" value="${esc(tk.due_date||'')}">
          <div class="row" style="margin-top:8px;gap:6px"><button data-esave>${esc(t('cm_save'))}</button><button class="ghost" data-ecancel>${esc(t('cm_cancel'))}</button><span class="err" data-eerr style="margin-left:6px"></span></div>
        </div>`);
        form.querySelector('[data-ecancel]').onclick = () => renderList();
        form.querySelector('[data-esave]').onclick = async () => {
          const err = form.querySelector('[data-eerr]'); err.textContent='';
          try {
            await api('POST',`/api/tasks/${tk.id}`,{ title: form.querySelector('[data-etitle]').value.trim(), description: form.querySelector('[data-edesc]').value.trim(), dueDate: form.querySelector('[data-edue]').value || null });
            openTasks();
          } catch(e){ err.textContent = e.message; }
        };
        card.replaceWith(form);
        form.querySelector('[data-etitle]').focus();
      }; }
      listBox.appendChild(card);
    });
  };
  bar.querySelectorAll('[data-tf]').forEach(b => b.onclick = () => { taskFilter = b.dataset.tf; renderList(); });
  renderList();
}

// ── Team-Notizen (gemeinsame Wissensablage) ─────────────────────────────────
async function openNotes() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('kb_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/notes'); } catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openNotes())); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 2px">📋 ${esc(t('kb_title'))}</h1>
    <div class="muted">${esc(t('kb_sub'))}</div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => openTeamHub();
  feed.appendChild(head);
  if (d.can_create) {
    const addCard = el(`<div class="card">
      <b>${esc(t('kb_new'))}</b>
      <input id="kb_title" placeholder="${esc(t('kb_f_title_ph'))}" maxlength="120" style="margin-top:6px">
      <textarea id="kb_body" rows="3" placeholder="${esc(t('kb_f_body_ph'))}" maxlength="2000" style="margin-top:6px"></textarea>
      <input id="kb_link" placeholder="${esc(t('kb_f_link_ph'))}" maxlength="500" style="margin-top:6px">
      <div class="row" style="margin-top:8px"><button data-add>${esc(t('kb_add'))}</button><span class="err" data-err style="margin-left:10px"></span></div>
    </div>`);
    addCard.querySelector('[data-add]').onclick = async () => {
      const err = addCard.querySelector('[data-err]'); err.textContent='';
      try {
        await api('POST','/api/notes', { title: v('kb_title'), body: document.getElementById('kb_body').value.trim(), docUrl: document.getElementById('kb_link').value.trim() || null });
        openNotes();
      } catch(e){ err.textContent = e.message; }
    };
    feed.appendChild(addCard);
  }
  if (!d.notes.length) { feed.appendChild(emptyState({ icon:'📋', title:t('kb_empty_t'), text:t('kb_empty_s') })); return; }
  // Suche über Titel/Inhalt/Link — hilft, in einer wachsenden Wissensablage schnell die
  // richtige Notiz zu finden (z.B. „Nachtdienst-Großhandel"). Nur ab ein paar Notizen.
  let notesQuery = '';
  if (d.notes.length >= 4) {
    const sc = el(`<div class="card" style="padding:8px 12px"><div class="row" style="gap:6px"><input data-kbq placeholder="${esc(t('kb_search_ph'))}" aria-label="${esc(t('kb_search_ph'))}" style="flex:1"></div></div>`);
    const inp = sc.querySelector('[data-kbq]');
    inp.oninput = () => { notesQuery = inp.value.trim().toLowerCase(); renderNotes(); };
    feed.appendChild(sc);
  }
  const listBox = el('<div data-kblist></div>');
  feed.appendChild(listBox);
  const renderNotes = () => {
    listBox.innerHTML = '';
    const shown = !notesQuery ? d.notes : d.notes.filter(n =>
      (n.title||'').toLowerCase().includes(notesQuery)
      || (n.body||'').toLowerCase().includes(notesQuery)
      || (n.doc_url||'').toLowerCase().includes(notesQuery)
      || (n.creator_name||'').toLowerCase().includes(notesQuery));
    if (!shown.length) { listBox.appendChild(el(`<div class="card muted">${esc(ti('kb_none_filter',{q:notesQuery}))}</div>`)); return; }
    shown.forEach(n => {
      const canDelete = n.mine || d.can_delete_role;
      const card = el(`<div class="card"${n.pinned?' style="border-left:4px solid var(--warn-fg)"':''}>
        <div class="row" style="align-items:baseline;gap:8px">
          <b style="flex:1">${n.pinned?'📌 ':''}${esc(n.title)}</b>
        </div>
        ${n.body?`<div class="muted" style="font-size:14px;white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div>`:''}
        ${n.doc_url?`<div style="margin-top:6px"><a href="${esc(n.doc_url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(n.doc_url)}</a></div>`:''}
        <div class="muted" style="font-size:12px;margin-top:6px">${n.creator_name?esc(ti('kb_by',{name:n.creator_name}))+' · ':''}${esc(relTime(n.created_at))}</div>
        <div class="reacts" style="margin-top:8px">
          ${d.can_pin?`<button class="ghost small" data-pin>${n.pinned?esc(t('kb_unpin')):esc(t('kb_pin'))}</button>`:''}
          ${canDelete?`<button class="ghost small" data-edit>${esc(t('kb_edit'))}</button>`:''}
          ${canDelete?`<button class="ghost small" data-del>${esc(t('kb_delete'))}</button>`:''}
        </div></div>`);
      const pb = card.querySelector('[data-pin]'); if (pb) pb.onclick = async () => { try { await api('POST',`/api/notes/${n.id}/pin`,{ pinned: !n.pinned }); openNotes(); } catch(e){ alert(e.message); } };
      const db = card.querySelector('[data-del]'); if (db) db.onclick = async () => { if (!confirm(t('kb_delete_confirm'))) return; try { await api('POST',`/api/notes/${n.id}/delete`); openNotes(); } catch(e){ alert(e.message); } };
      const eb = card.querySelector('[data-edit]'); if (eb) eb.onclick = () => {
        // Inline-Bearbeiten: Karte durch ein Formular ersetzen (Titel/Inhalt/Link vorbefüllt).
        const form = el(`<div class="card"${n.pinned?' style="border-left:4px solid var(--warn-fg)"':''}>
          <input data-etitle maxlength="120" value="${esc(n.title)}" aria-label="${esc(t('kb_f_title_ph'))}">
          <textarea data-ebody rows="3" maxlength="2000" placeholder="${esc(t('kb_f_body_ph'))}" style="margin-top:6px">${esc(n.body||'')}</textarea>
          <input data-elink maxlength="500" placeholder="${esc(t('kb_f_link_ph'))}" value="${esc(n.doc_url||'')}" style="margin-top:6px">
          <div class="row" style="margin-top:8px;gap:6px"><button data-esave>${esc(t('kb_save'))}</button><button class="ghost" data-ecancel>${esc(t('kb_cancel'))}</button><span class="err" data-eerr style="margin-left:6px"></span></div>
        </div>`);
        form.querySelector('[data-ecancel]').onclick = () => renderNotes();
        form.querySelector('[data-esave]').onclick = async () => {
          const err = form.querySelector('[data-eerr]'); err.textContent='';
          try {
            await api('POST',`/api/notes/${n.id}`,{ title: form.querySelector('[data-etitle]').value.trim(), body: form.querySelector('[data-ebody]').value.trim(), docUrl: form.querySelector('[data-elink]').value.trim() || null });
            openNotes();
          } catch(e){ err.textContent = e.message; }
        };
        card.replaceWith(form);
        form.querySelector('[data-etitle]').focus();
      };
      listBox.appendChild(card);
    });
  };
  renderNotes();
}

// Direktnachricht mit einer Person starten (aus Entdecken-/Verzeichnis-Listen).
async function messagePerson(handle) {
  try { const r = await api('POST','/api/dm/start',{ handle }); openDmThread(r.thread.id); }
  catch(e){ alert(e.message); }
}

// ── Partner-Verzeichnis (nach Kontotyp) ─────────────────────────────────────
const DIR_TYPES = ['pharmacy', 'pharma', 'authority'];
const DIR_ICON = { pharmacy: '🏥', pharma: '🏭', authority: '🏛️' };
let dirState = { type: 'pharmacy', q: '', bl: '', verified: false };
async function openDirectory(type) {
  if (type) dirState.type = type;
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('dir_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let counts, list;
  try {
    // Unabhängige Anfragen parallel (Zähler + Liste).
    [counts, list] = await Promise.all([
      api('GET','/api/directory' + (dirState.bl ? '?bundesland=' + encodeURIComponent(dirState.bl) : '')),
      (() => { const p = new URLSearchParams(); if (dirState.q) p.set('q', dirState.q); if (dirState.bl) p.set('bundesland', dirState.bl); if (dirState.verified) p.set('verified', '1'); const qs = p.toString(); return api('GET', `/api/directory/${dirState.type}` + (qs ? `?${qs}` : '')); })(),
    ]);
  } catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openDirectory())); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 2px">🔎 ${esc(t('dir_title'))}</h1>
    <div class="muted" style="margin-bottom:10px">${esc(t('dir_sub'))}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      ${DIR_TYPES.map(ty=>`<button class="small sortbtn${dirState.type===ty?' active':''}" data-type="${ty}">${DIR_ICON[ty]} ${esc(acctLabel(ty))} <span class="muted">${(counts.counts&&counts.counts[ty])||0}</span></button>`).join('')}
    </div>
    <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><input data-q value="${esc(dirState.q)}" placeholder="${esc(t('dir_search'))}" maxlength="60" style="flex:1;min-width:140px"><button class="small" data-go>🔎</button>
      ${(me&&me.country==='AT')?`<select data-blf class="small" data-i18n-aria="ex_all_bl" aria-label="${esc(t('ex_all_bl'))}"><option value="">${esc(t('ex_all_bl'))}</option>${blOptions(dirState.bl)}</select>`:''}
    </div>
    <div class="reacts" style="margin-top:8px"><button class="small sortbtn${dirState.verified?' active':''}" data-vonly aria-pressed="${dirState.verified}">${esc(t('dir_verified_only'))}</button></div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  head.querySelector('[data-vonly]').onclick = () => { dirState.verified = !dirState.verified; openDirectory(); };
  head.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { dirState.type = b.dataset.type; dirState.q=''; dirState.bl=''; openDirectory(); });
  const doSearch = () => { dirState.q = head.querySelector('[data-q]').value.trim(); openDirectory(); };
  head.querySelector('[data-go]').onclick = doSearch;
  head.querySelector('[data-q]').addEventListener('keydown', e => { if (e.key==='Enter') doSearch(); });
  { const blf = head.querySelector('[data-blf]'); if (blf) blf.onchange = () => { dirState.bl = blf.value; openDirectory(); }; }
  feed.appendChild(head);
  if (!list.people.length) {
    // Wie bei den Daten-Reitern: bei aktivem Filter (Suche/Bundesland/nur verifiziert) einen
    // sichtbaren „Filter zurücksetzen"-Knopf anbieten — konsistente, offensichtliche Bedienung.
    const active = dirState.q || dirState.bl || dirState.verified;
    feed.appendChild(emptyState({ icon:'🔎', title:t('dir_empty_t'), text: dirState.verified ? t('dir_empty_verified') : t('dir_empty_s'),
      cta: active ? { label: t('sh_reset'), onClick: () => { dirState.q=''; dirState.bl=''; dirState.verified=false; openDirectory(); } } : null }));
    return;
  }
  // Auf breiteren Screens mehrspaltig (füllt den Platz), am Handy einspaltig — responsiv
  // über auto-fill, ohne Media-Query.
  const grid = el('<div class="dir-grid"></div>');
  feed.appendChild(grid);
  list.people.forEach(p => {
    // Karte mit Profilbild (wie im Feed): Avatar links, Info-Spalte rechts, Aktionen darunter.
    // Konsistente, scannbare Optik; Foto wenn vorhanden, sonst Initialen.
    const row = el(`<div class="card"><div class="row" style="align-items:flex-start">
      ${avatarHtml(p, 44)}
      <div style="flex:1;min-width:0">
        <div class="row" style="align-items:baseline;gap:6px;flex-wrap:wrap">
          <b class="clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name||('@'+p.handle))}</b>
          ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}${p.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
          <span class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</span>
        </div>
        ${p.title?`<div class="muted" style="font-size:13px;margin-top:2px">${esc(p.title)}</div>`:''}
        <div class="muted" style="font-size:12px;margin-top:2px">${p.bundesland?esc(p.bundesland)+' · ':''}${ti('dir_followers',{n:p.follower_count})}</div>
      </div>
    </div>
    <div class="row" style="margin-top:10px;gap:6px">
      <button class="ghost small" data-msg="${esc(p.handle)}">${esc(t('pf_dm'))}</button>
      ${p.is_following?`<span class="muted" style="font-size:13px;align-self:center">${esc(t('nb_following'))}</span>`:`<button class="small" data-follow="${esc(p.handle)}">${esc(t('pf_follow'))}</button>`}
    </div></div>`);
    row.querySelectorAll('[data-openprofile]').forEach(e2 => e2.onclick = () => openProfile(e2.dataset.openprofile));
    const fb = row.querySelector('[data-follow]');
    if (fb) fb.onclick = async () => { try { await api('POST','/api/follow',{ handle:p.handle }); fb.textContent=t('fl_following_btn'); fb.disabled=true; } catch(e){ alert(e.message); } };
    row.querySelector('[data-msg]').onclick = () => messagePerson(p.handle);
    grid.appendChild(row);
  });
}

// ── Premium-Werbung/Shop ────────────────────────────────────────────────────
const PROMO_CATS = ['medikamente','kosmetik','nahrungsergaenzung','medizinprodukte','dienstleistung','sonstiges'];
function promoCatLabel(cat) { return t('promo_cat_' + (PROMO_CATS.includes(cat) ? cat : 'sonstiges')); }
let promoState = { cat: null, mine: false };

function promoAuthorLine(a) {
  if (!a) return '';
  const badge = (a.verified ? ' <span title="'+esc(t('pc_verified'))+'">✔</span>' : '') + (a.premium ? ' <span title="'+esc(t('pc_premium'))+'">⭐</span>' : '');
  const av = a.avatar_url ? `<img src="${esc(a.avatar_url)}" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:5px">` : '';
  return `<span class="clickable" data-openprofile="${esc(a.handle)}">${av}<b>${esc(a.display_name||('@'+a.handle))}</b>${badge}</span>`;
}
function promoPrice(p) {
  if (p.preis == null) return `<span class="muted">${esc(t('wb_on_request'))}</span>`;
  return `<b>€ ${esc(fmtMoney(p.preis))}</b>${p.einheit?` <span class="muted" style="font-size:12px">${esc(p.einheit)}</span>`:''}`;
}
function promoCard(p) {
  const card = el(`<div class="card" style="cursor:pointer" data-open="${esc(p.id)}">
    ${p.image?`<img data-zoom src="${esc(p.image)}" alt="${esc(p.titel)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:8px;cursor:zoom-in">`:''}
    <div class="row" style="align-items:baseline;gap:8px">
      <span style="display:inline-block;font-size:12px;font-weight:700;color:var(--info-fg);background:var(--info-bg);padding:2px 8px;border-radius:999px">${esc(promoCatLabel(p.kategorie))}</span>
      <span class="sp" style="flex:1"></span>
      <span style="font-size:11px;font-weight:700;color:var(--muted);border:1px solid var(--line);padding:1px 6px;border-radius:6px">${esc(t('wb_ad'))}</span>
    </div>
    <h3 style="margin:8px 0 4px">${esc(p.titel)}</h3>
    <div style="margin-bottom:6px">${promoPrice(p)}</div>
    ${p.beschreibung?`<div class="muted" style="font-size:14px;white-space:pre-wrap">${esc(p.beschreibung.length>160?p.beschreibung.slice(0,160)+'…':p.beschreibung)}</div>`:''}
    <div class="row" style="margin-top:10px;align-items:center;gap:12px;font-size:13px">
      <span class="muted">${esc(t('wb_by'))} ${promoAuthorLine(p.author)}</span>
      <span class="sp" style="flex:1"></span>
      <span title="${esc(t('wb_like'))}">${p.liked_by_me?'❤️':'🤍'} ${p.like_count}</span>
      <span title="${esc(t('wb_comments'))}">💬 ${p.comment_count}</span>
    </div>
  </div>`);
  card.querySelectorAll('[data-openprofile]').forEach(e2 => { e2.onclick = (ev) => { ev.stopPropagation(); openProfile(e2.dataset.openprofile); }; });
  card.onclick = () => openPromotionDetail(p.id);
  return card;
}

async function openPromotions(flash) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('wb_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  const qs = [];
  if (promoState.cat) qs.push('kategorie=' + encodeURIComponent(promoState.cat));
  let d;
  try { d = await api('GET', (promoState.mine ? '/api/promotions/mine' : '/api/promotions') + (qs.length?('?'+qs.join('&')):'')); }
  catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openPromotions())); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>${d.premium?`<button class="small" data-new>${esc(t('wb_new'))}</button>`:''}</div>
    <h1 style="margin:8px 0 2px">${esc(t('wb_title'))}</h1>
    <div class="muted" style="margin-bottom:10px">${esc(t('wb_sub'))}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <button class="small sortbtn${promoState.mine?'':' active'}" data-scope="all">${esc(t('wb_all'))}</button>
      <button class="small sortbtn${promoState.mine?' active':''}" data-scope="mine">${esc(t('wb_mine'))}</button>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      <button class="small sortbtn${promoState.cat?'':' active'}" data-cat="">${esc(t('wb_cat_all'))}</button>
      ${PROMO_CATS.map(c=>`<button class="small sortbtn${promoState.cat===c?' active':''}" data-cat="${c}">${esc(promoCatLabel(c))}</button>`).join('')}
    </div>
    ${d.premium?'':`<div class="row" style="align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap"><span style="font-size:13px">⭐ ${esc(t('wb_premium_only'))}</span><button class="ghost small" data-gopremium>${esc(t('wb_go_premium'))}</button></div>`}
  </div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  const nb = head.querySelector('[data-new]'); if (nb) nb.onclick = () => openPromoForm(null);
  const gp = head.querySelector('[data-gopremium]'); if (gp) gp.onclick = () => { if (typeof openPremium==='function') openPremium(); };
  head.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { promoState.mine = b.dataset.scope==='mine'; openPromotions(); });
  head.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { promoState.cat = b.dataset.cat || null; openPromotions(); });
  feed.appendChild(head);
  if (flash) feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(flash)}</div>`));
  if (!d.promotions.length) { feed.appendChild(emptyState({ icon:'🏷️', title:t('wb_empty_t'), text: promoState.mine ? t('wb_empty_mine_s') : t('wb_empty_s') })); return; }
  // Volltextsuche über Titel/Beschreibung/Anbieter — hilft, im wachsenden Angebotskatalog
  // schnell das Passende zu finden. Nur ab ein paar Angeboten; filtert die geladene Liste.
  let promoQuery = '';
  if (d.promotions.length >= 4) {
    const sc = el(`<div class="card" style="padding:8px 12px"><div class="row" style="gap:6px"><input data-wbq placeholder="${esc(t('wb_search_ph'))}" aria-label="${esc(t('wb_search_ph'))}" style="flex:1"></div></div>`);
    const inp = sc.querySelector('[data-wbq]');
    inp.oninput = () => { promoQuery = inp.value.trim().toLowerCase(); renderPromos(); };
    feed.appendChild(sc);
  }
  const listBox = el('<div data-wblist></div>');
  feed.appendChild(listBox);
  const renderPromos = () => {
    listBox.innerHTML = '';
    const shown = !promoQuery ? d.promotions : d.promotions.filter(p =>
      (p.titel||'').toLowerCase().includes(promoQuery)
      || (p.beschreibung||'').toLowerCase().includes(promoQuery)
      || (p.author && ((p.author.display_name||'').toLowerCase().includes(promoQuery) || (p.author.handle||'').toLowerCase().includes(promoQuery))));
    if (!shown.length) { listBox.appendChild(el(`<div class="card muted">${esc(ti('wb_none_filter',{q:promoQuery}))}</div>`)); return; }
    for (const p of shown) listBox.appendChild(promoCard(p));
  };
  renderPromos();
}

function openPromoForm(existing) {
  const feed = document.getElementById('feed');
  setDocTitle(t(existing?'wb_edit':'wb_new'));
  feed.innerHTML = '';
  let img = existing && existing.image ? existing.image : null;
  const card = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 8px">${esc(existing?t('wb_edit'):t('wb_new'))}</h1>
    <label>${esc(t('wb_f_title'))}</label>
    <input id="pr_title" maxlength="120" placeholder="${esc(t('wb_f_title_ph'))}" value="${esc(existing?existing.titel:'')}">
    <label style="margin-top:8px">${esc(t('wb_f_cat'))}</label>
    <select id="pr_cat">${PROMO_CATS.map(c=>`<option value="${c}"${existing&&existing.kategorie===c?' selected':''}>${esc(promoCatLabel(c))}</option>`).join('')}</select>
    <label style="margin-top:8px">${esc(t('wb_f_desc'))}</label>
    <textarea id="pr_desc" rows="4" maxlength="1000" placeholder="${esc(t('wb_f_desc_ph'))}">${esc(existing&&existing.beschreibung?existing.beschreibung:'')}</textarea>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px"><label>${esc(t('wb_f_price'))}</label><input id="pr_price" type="number" min="0" step="0.01" value="${existing&&existing.preis!=null?existing.preis:''}"></div>
      <div style="flex:1;min-width:140px"><label>${esc(t('wb_f_unit'))}</label><input id="pr_unit" maxlength="30" placeholder="${esc(t('wb_f_unit_ph'))}" value="${esc(existing&&existing.einheit?existing.einheit:'')}"></div>
    </div>
    <label style="margin-top:8px">${esc(t('wb_f_link'))}</label>
    <input id="pr_link" maxlength="500" placeholder="${esc(t('wb_f_link_ph'))}" value="${esc(existing&&existing.link?existing.link:'')}">
    <div class="row" style="margin-top:10px;align-items:center;gap:10px">
      <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px">${esc(t('wb_f_img'))}<input type="file" id="pr_img" accept="image/*" style="display:none"></label>
      <img id="pr_imgprev" alt="" style="${img?'':'display:none;'}max-height:80px;border-radius:8px" ${img?`src="${esc(img)}"`:''}>
      <button class="linklike small" id="pr_imgclear" style="${img?'':'display:none'}">✕</button>
    </div>
    <div class="row" style="margin-top:12px"><button data-save>${esc(existing?t('wb_save_edit'):t('wb_save'))}</button><span class="err" data-err style="margin-left:10px"></span></div>
  </div>`);
  card.querySelector('[data-back]').onclick = () => existing ? openPromotionDetail(existing.id) : openPromotions();
  const prev = card.querySelector('#pr_imgprev'), clr = card.querySelector('#pr_imgclear');
  card.querySelector('#pr_img').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { img = await fileToDataUrl(f); prev.src = img; prev.style.display='inline-block'; clr.style.display='inline-block'; }
    catch(err){ alert(err.message); }
  };
  clr.onclick = () => { img = null; prev.style.display='none'; clr.style.display='none'; card.querySelector('#pr_img').value=''; };
  card.querySelector('[data-save]').onclick = async () => {
    const err = card.querySelector('[data-err]'); err.textContent='';
    const payload = {
      titel: document.getElementById('pr_title').value.trim(),
      kategorie: document.getElementById('pr_cat').value,
      beschreibung: document.getElementById('pr_desc').value.trim(),
      preis: document.getElementById('pr_price').value.trim(),
      einheit: document.getElementById('pr_unit').value.trim(),
      link: document.getElementById('pr_link').value.trim(),
      image: img,
    };
    try {
      if (existing) { await api('POST', `/api/promotions/${existing.id}/update`, payload); openPromotions(t('wb_updated')); }
      else { await api('POST', '/api/promotions', payload); openPromotions(t('wb_saved')); }
    } catch(e){ err.textContent = e.message; }
  };
  feed.appendChild(card);
}

async function openPromotionDetail(id) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = (await api('GET', `/api/promotions/${id}`)).promotion; }
  catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openPromotions())); return; }
  setDocTitle(d.titel);
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>${d.is_mine?`<button class="ghost small" data-edit>${esc(t('wb_edit'))}</button><button class="ghost small" data-del>${esc(t('wb_delete'))}</button>`:`<button class="ghost small" data-report>${esc(t('pc_report'))}</button>`}</div>
    ${d.image?`<img data-zoom src="${esc(d.image)}" alt="${esc(d.titel)}" style="width:100%;max-height:320px;object-fit:cover;border-radius:10px;margin:8px 0;cursor:zoom-in">`:''}
    <div class="row" style="align-items:baseline;gap:8px;margin-top:6px">
      <span style="display:inline-block;font-size:12px;font-weight:700;color:var(--info-fg);background:var(--info-bg);padding:2px 8px;border-radius:999px">${esc(promoCatLabel(d.kategorie))}</span>
      <span class="sp" style="flex:1"></span><span style="font-size:11px;font-weight:700;color:var(--muted);border:1px solid var(--line);padding:1px 6px;border-radius:6px">${esc(t('wb_ad'))}</span>
    </div>
    <h1 style="margin:8px 0 4px">${esc(d.titel)}</h1>
    <div style="font-size:18px;margin-bottom:6px">${promoPrice(d)}</div>
    ${d.beschreibung?`<div class="post-body" style="white-space:pre-wrap;margin:8px 0">${esc(d.beschreibung)}</div>`:''}
    ${d.link?`<div style="margin:6px 0"><a href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(d.link)}</a></div>`:''}
    <div class="muted" style="font-size:13px;margin-top:6px">${esc(t('wb_by'))} ${promoAuthorLine(d.author)} · ${esc(relTime(d.created_at))}</div>
    <div class="reacts" style="margin-top:10px">
      <button class="${d.liked_by_me?'':'ghost '}small" data-like>${d.liked_by_me?'❤️':'🤍'} ${esc(d.liked_by_me?t('wb_liked'):t('wb_like'))} · <span data-likecount>${d.like_count}</span></button>
    </div>
  </div>`);
  head.querySelector('[data-back]').onclick = () => openPromotions();
  head.querySelectorAll('[data-openprofile]').forEach(e2 => e2.onclick = () => openProfile(e2.dataset.openprofile));
  const ed = head.querySelector('[data-edit]'); if (ed) ed.onclick = () => openPromoForm(d);
  const de = head.querySelector('[data-del]'); if (de) de.onclick = async () => { if (!confirm(t('wb_delete_confirm'))) return; try { await api('POST', `/api/promotions/${id}/delete`); openPromotions(); } catch(e){ alert(e.message); } };
  const rp = head.querySelector('[data-report]'); if (rp) rp.onclick = async () => { const reason = prompt(t('rep_prompt')) ?? ''; try { await api('POST', `/api/promotions/${id}/report`, { reason }); alert(t('rep_thanks')); } catch(e){ alert(e.message); } };
  head.querySelector('[data-like]').onclick = async () => {
    try { const r = await api('POST', `/api/promotions/${id}/like`); openPromotionDetail(id); void r; } catch(e){ alert(e.message); }
  };
  feed.appendChild(head);

  // Anfragen & Kommentare
  const cbox = el(`<div class="card">
    <b>${esc(t('wb_comments'))} (${d.comment_count})</b>
    <div class="row" style="margin-top:8px;gap:6px"><input id="pr_cinput" placeholder="${esc(t('wb_comment_ph'))}" maxlength="1000"><button class="small" data-csend>${esc(t('wb_comment_send'))}</button></div>
    <div data-clist style="margin-top:10px"></div>
  </div>`);
  const clist = cbox.querySelector('[data-clist]');
  if (!d.comments.length) clist.appendChild(el(`<div class="muted" style="font-size:13px">${esc(t('wb_no_comments'))}</div>`));
  for (const c of d.comments) {
    const row = el(`<div style="padding:8px 0;border-top:1px solid var(--line)">
      <div class="muted" style="font-size:13px">${promoAuthorLine(c.author)} · ${esc(relTime(c.created_at))}</div>
      <div style="white-space:pre-wrap;margin-top:2px">${esc(c.body)}</div></div>`);
    row.querySelectorAll('[data-openprofile]').forEach(e2 => e2.onclick = () => openProfile(e2.dataset.openprofile));
    clist.appendChild(row);
  }
  const send = async () => {
    const inp = document.getElementById('pr_cinput'); const body = inp.value.trim(); if (!body) return;
    try { await api('POST', `/api/promotions/${id}/comment`, { body }); openPromotionDetail(id); } catch(e){ alert(e.message); }
  };
  cbox.querySelector('[data-csend]').onclick = send;
  cbox.querySelector('#pr_cinput').addEventListener('keydown', e => { if (e.key==='Enter') send(); });
  feed.appendChild(cbox);
}

// ── Premium-Live-Sessions ───────────────────────────────────────────────────
let liveState = { mine: false };
function liveWhen(g) { // "YYYY-MM-DDTHH:MM" -> "01.09.2026 · 18:00" (bzw. lokalisiert)
  const [d, tm] = String(g || '').split('T');
  return `${fmtDateDe(d)}${tm ? ' · ' + tm : ''}`;
}
async function openLive(flash) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('lv_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET', liveState.mine ? '/api/live/mine' : '/api/live'); }
  catch(e){ feed.innerHTML=''; feed.appendChild(errorState(e.message, () => openLive())); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>${d.premium?`<button class="small" data-new>${esc(t('lv_new'))}</button>`:''}</div>
    <h1 style="margin:8px 0 2px">${esc(t('lv_title'))}</h1>
    <div class="muted" style="margin-bottom:10px">${esc(t('lv_sub'))}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <button class="small sortbtn${liveState.mine?'':' active'}" data-scope="all">${esc(t('lv_all'))}</button>
      <button class="small sortbtn${liveState.mine?' active':''}" data-scope="mine">${esc(t('lv_mine'))}</button>
    </div>
    ${d.premium?'':`<div class="row" style="align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap"><span style="font-size:13px">⭐ ${esc(t('lv_premium_only'))}</span><button class="ghost small" data-gopremium>${esc(t('lv_go_premium'))}</button></div>`}
  </div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  const nb = head.querySelector('[data-new]'); if (nb) nb.onclick = () => openLiveForm();
  const gp = head.querySelector('[data-gopremium]'); if (gp) gp.onclick = () => { if (typeof openPremium==='function') openPremium(); };
  head.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { liveState.mine = b.dataset.scope==='mine'; openLive(); });
  feed.appendChild(head);
  if (flash) feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(flash)}</div>`));
  if (!d.sessions.length) { feed.appendChild(emptyState({ icon:'🔴', title:t('lv_empty_t'), text: liveState.mine ? t('lv_empty_mine_s') : t('lv_empty_s') })); return; }
  const statusMeta = { geplant:['var(--muted)','var(--chip-bg)',t('lv_st_planned')], live:['var(--crit-fg)','var(--crit-bg)',t('lv_st_live')], beendet:['var(--muted)','var(--chip-bg)',t('lv_st_ended')] };
  for (const s of d.sessions) {
    const [col,bg,lab] = statusMeta[s.status] || ['var(--muted)','var(--chip-bg)',s.status];
    const card = el(`<div class="card">
      <div class="row" style="align-items:baseline;gap:8px">
        <span style="display:inline-block;font-size:12px;font-weight:800;color:${col};background:${bg};padding:2px 10px;border-radius:999px">${esc(lab)}</span>
        <span class="sp" style="flex:1"></span>
        <span class="muted" style="font-size:13px">🗓 ${esc(liveWhen(s.geplant_am))}</span>
      </div>
      <h3 style="margin:8px 0 4px">${esc(s.titel)}</h3>
      ${s.thema?`<div class="muted" style="font-size:14px;white-space:pre-wrap">${esc(s.thema)}</div>`:''}
      <div class="muted" style="font-size:13px;margin-top:6px">${esc(t('lv_host'))}: <b class="clickable" data-openprofile="${esc(s.host?s.host.handle:'')}">${esc(s.host?(s.host.display_name||('@'+s.host.handle)):'—')}</b>${s.host&&s.host.verified?' <span title="'+esc(t('pc_verified'))+'">✔</span>':''}${s.host&&s.host.premium?' <span title="'+esc(t('pc_premium'))+'">⭐</span>':''}</div>
      <div class="reacts" style="margin-top:10px;align-items:center">
        ${s.status==='live'&&s.room_url?`<a class="small" style="text-decoration:none;font-weight:700;color:var(--crit-fg)" href="${esc(s.room_url)}" target="_blank" rel="noopener noreferrer">${esc(t('lv_join'))}</a>`:''}
        ${!s.i_am_host&&s.status==='geplant'?`<button class="${s.i_am_interested?'':'ghost '}small" data-interest>${esc(s.i_am_interested?t('lv_interested'):t('lv_interest'))}</button>`:''}
        ${s.i_am_host&&s.status==='geplant'?`<button class="small" data-start>${esc(t('lv_start'))}</button>`:''}
        ${s.i_am_host&&s.status==='live'?`<button class="ghost small" data-end>${esc(t('lv_end'))}</button>`:''}
        ${s.i_am_host?`<button class="ghost small" data-del>${esc(t('lv_delete'))}</button>`:`<button class="ghost small" data-report>${esc(t('pc_report'))}</button>`}
        ${s.interest_count?`<span class="muted" style="font-size:13px">🔔 ${esc(ti('lv_interest_count',{n:s.interest_count}))}</span>`:''}
      </div></div>`);
    card.querySelectorAll('[data-openprofile]').forEach(e2 => { if (e2.dataset.openprofile) e2.onclick = () => openProfile(e2.dataset.openprofile); });
    const iv = card.querySelector('[data-interest]'); if (iv) iv.onclick = async () => { try { await api('POST',`/api/live/${s.id}/interest`); openLive(); } catch(e){ alert(e.message); } };
    const st = card.querySelector('[data-start]'); if (st) st.onclick = async () => { try { await api('POST',`/api/live/${s.id}/start`); openLive(); } catch(e){ alert(e.message); } };
    const en = card.querySelector('[data-end]'); if (en) en.onclick = async () => { if (!confirm(t('lv_end_confirm'))) return; try { await api('POST',`/api/live/${s.id}/end`); openLive(); } catch(e){ alert(e.message); } };
    const de = card.querySelector('[data-del]'); if (de) de.onclick = async () => { if (!confirm(t('lv_delete_confirm'))) return; try { await api('POST',`/api/live/${s.id}/delete`); openLive(); } catch(e){ alert(e.message); } };
    const rp = card.querySelector('[data-report]'); if (rp) rp.onclick = async () => { const reason = prompt(t('rep_prompt')) ?? ''; try { await api('POST',`/api/live/${s.id}/report`, { reason }); alert(t('rep_thanks')); } catch(e){ alert(e.message); } };
    feed.appendChild(card);
  }
}
function openLiveForm() {
  const feed = document.getElementById('feed');
  setDocTitle(t('lv_new'));
  feed.innerHTML = '';
  // Default: in 1 Stunde, in lokaler Zeit (datetime-local erwartet Ortszeit, nicht UTC).
  const dt = new Date(Date.now() + 3600000);
  const now = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  const card = el(`<div class="card">
    <div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button></div>
    <h1 style="margin:8px 0 8px">🔴 ${esc(t('lv_new'))}</h1>
    <label>${esc(t('lv_f_title'))}</label>
    <input id="lv_title_in" maxlength="120" placeholder="${esc(t('lv_f_title_ph'))}">
    <label style="margin-top:8px">${esc(t('lv_f_topic'))}</label>
    <textarea id="lv_topic_in" rows="3" maxlength="500" placeholder="${esc(t('lv_f_topic_ph'))}"></textarea>
    <label style="margin-top:8px">${esc(t('lv_f_when'))}</label>
    <input id="lv_when_in" type="datetime-local" value="${now}">
    <div class="row" style="margin-top:12px"><button data-save>${esc(t('lv_save'))}</button><span class="err" data-err style="margin-left:10px"></span></div>
    <div class="muted" style="font-size:12px;margin-top:8px">${esc(t('lv_privacy'))}</div>
  </div>`);
  card.querySelector('[data-back]').onclick = () => openLive();
  card.querySelector('[data-save]').onclick = async () => {
    const err = card.querySelector('[data-err]'); err.textContent='';
    try {
      await api('POST','/api/live', { titel: document.getElementById('lv_title_in').value.trim(), thema: document.getElementById('lv_topic_in').value.trim(), geplant_am: document.getElementById('lv_when_in').value });
      openLive(t('lv_saved'));
    } catch(e){ err.textContent = e.message; }
  };
  feed.appendChild(card);
}

let orderStatsPeriod = 'all'; // Zeitraum-Filter für Beschaffungs-Statistik + Report
// Gehört eine Bestellung in den gewählten Zeitraum? (rein datumsbasiert, grob — für eine
// Management-Übersicht genügt Tagesgenauigkeit). 'all' = ohne Filter.
function orderInPeriod(o, period) {
  if (period === 'all') return true;
  const day = (o && o.created_at || '').slice(0, 10);
  if (!day) return false;
  if (period === 'year') return day.slice(0, 4) === new Date().toISOString().slice(0, 4);
  const days = period === 'd30' ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return day >= cutoff;
}

// Ersparnis je Monat (YYYY-MM) aus den Bestell-Snapshots — nur Monate mit Ersparnis,
// chronologisch, höchstens die letzten `maxMonths`. Grundlage des Ersparnis-Verlaufs.
function monthlySavings(orders, maxMonths = 6) {
  const byMonth = new Map();
  for (const o of (orders || [])) {
    const ym = (o && o.created_at || '').slice(0, 7);
    if (!ym) continue;
    byMonth.set(ym, (byMonth.get(ym) || 0) + (Number(o.total_savings) || 0));
  }
  return [...byMonth.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxMonths)
    .map(([ym, saved]) => ({ ym, saved }));
}

// Monats-Label „Mon. JJJJ" in aktueller Sprache aus „YYYY-MM" (UTC, tagesunabhängig).
function ymLabel(ym) {
  const [y, m] = String(ym).split('-');
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString(t('_bcp47'), { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Kleiner, gut lesbarer Ersparnis-Verlauf (waagerechte Balken je Monat) — erzählt den
// Wert über die Zeit („wir sparen laufend"). Erst ab 2 Monaten sinnvoll, sonst null.
function renderMonthlySavings(orders) {
  const data = monthlySavings(orders);
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.saved));
  const card = el(`<div class="card"><b>📈 ${esc(t('os_month_title'))}</b><div class="muted" style="font-size:13px;margin:2px 0 10px">${esc(t('os_month_sub'))}</div><div data-bars></div></div>`);
  const box = card.querySelector('[data-bars]');
  data.forEach(d => {
    const pct = max > 0 ? Math.max(4, Math.round(d.saved / max * 100)) : 0;
    box.appendChild(el(`<div class="row" style="align-items:center;gap:8px;margin-bottom:6px">
      <span class="muted" style="min-width:72px;font-size:13px">${esc(ymLabel(d.ym))}</span>
      <span style="flex:1;min-width:40px;background:var(--chip-bg);border-radius:6px;height:16px;overflow:hidden" aria-hidden="true"><span style="display:block;height:100%;width:${pct}%;background:var(--ok-fg);border-radius:6px"></span></span>
      <b style="min-width:72px;text-align:right;color:var(--ok-fg)">€ ${fmtMoney(d.saved)}</b>
    </div>`));
  });
  return card;
}

// Druckbarer Beschaffungs-Report für die Geschäftsführung: verdichtet die Bestell-
// Historie zu einem sauberen Ein-Seiter (Ausgaben, Ersparnis ggü. Liste, Ersparnis-
// Quote, Ausgaben je Lieferant, Top-Präparate, Zeitraum). Belegt den konkreten
// Euro-Nutzen der Plattform — reine Aggregation vorhandener Bestell-Snapshots.
function printProcurementReport(orders) {
  const list = orders || [];
  const spent = list.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const saved = list.reduce((s, o) => s + (Number(o.total_savings) || 0), 0);
  const pieces = list.reduce((s, o) => s + (Number(o.total_pieces) || 0), 0);
  const rate = (spent + saved) > 0 ? Math.round((saved / (spent + saved)) * 1000) / 10 : 0;
  const rateStr = (LOCALE === 'en' ? String(rate) : String(rate).replace('.', ',')) + ' %';
  const dates = list.map(o => (o.created_at || '').slice(0, 10)).filter(Boolean).sort();
  const from = dates[0] || '', to = dates[dates.length - 1] || '';
  const byProduct = new Map(), bySupplier = new Map();
  for (const o of list) for (const i of (o.items || [])) {
    const pk = (i.wirkstoff || i.bezeichnung || '').trim();
    if (pk) byProduct.set(pk, (byProduct.get(pk) || 0) + (Number(i.menge) || 0));
    const sk = (i.supplier || '').trim();
    const ap = i.aktionspreis != null ? Number(i.aktionspreis) : null;
    if (sk && ap != null) {
      const m = Number(i.menge) || 0;
      const cur = bySupplier.get(sk) || { spend: 0, saved: 0 };
      cur.spend += ap * m;
      if (i.listenpreis != null && Number(i.listenpreis) > ap) cur.saved += (Number(i.listenpreis) - ap) * m;
      bySupplier.set(sk, cur);
    }
  }
  const topP = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topS = [...bySupplier.entries()].sort((a, b) => b[1].spend - a[1].spend);
  const months = monthlySavings(list); // Ersparnis-Verlauf je Monat (falls ≥2 Monate)
  const kpi = (num, label, col = '#111') => `<div class="kpi"><div class="n" style="color:${col}">${esc(num)}</div><div class="l">${esc(label)}</div></div>`;
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:22px;margin:0 0 2px} h2{font-size:15px;margin:20px 0 6px;color:#333} .meta{color:#555;font-size:13px;margin-bottom:14px}
    .kpis{display:flex;flex-wrap:wrap;gap:20px;margin:8px 0} .kpi .n{font-size:22px;font-weight:800} .kpi .l{color:#555;font-size:12px}
    table{width:100%;border-collapse:collapse} th{text-align:left;font-size:12px;color:#555;border-bottom:2px solid #cbd5cf;padding:6px 8px} td{padding:6px 8px;border-bottom:1px solid #e3e8e5;font-size:14px} th.r,td.r{text-align:right} td.r{font-weight:700;white-space:nowrap} td.sav{color:#0b7f28}
    .src{font-size:12px;color:#555;margin-top:18px}`;
  const body = `<h1>📊 ${esc(t('os_rep_title'))}</h1>
    <div class="meta">${esc(ti('os_rep_period', { from: from ? fmtDateDe(from) : '—', to: to ? fmtDateDe(to) : '—' }))} · ${esc(ti('wl_print_asof', { date: printDate() }))}</div>
    <div class="kpis">
      ${kpi(String(list.length), t('os_orders'))}
      ${kpi('€ ' + printMoney(spent), t('os_spent'))}
      ${saved > 0 ? kpi('€ ' + printMoney(saved), t('os_saved') + ' (' + t('os_rep_vs_list') + ')', '#0b7f28') : ''}
      ${saved > 0 ? kpi(rateStr, t('os_rep_rate'), '#0b7f28') : ''}
      ${kpi(String(pieces), t('os_pieces'))}
    </div>
    ${months.length >= 2 ? `<h2>${esc(t('os_month_title'))}</h2><table><tbody>${months.map(m => `<tr><td>${esc(ymLabel(m.ym))}</td><td class="r sav">€ ${esc(printMoney(m.saved))}</td></tr>`).join('')}</tbody></table>` : ''}
    ${topS.length ? `<h2>${esc(t('os_rep_suppliers'))}</h2><table><thead><tr><th></th><th class="r">${esc(t('os_spent'))}</th><th class="r">${esc(t('os_saved'))}</th></tr></thead><tbody>${topS.map(([s, v]) => `<tr><td>${esc(s)}</td><td class="r">€ ${esc(printMoney(v.spend))}</td><td class="r sav">${v.saved > 0 ? '€ ' + esc(printMoney(v.saved)) : '—'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${topP.length ? `<h2>${esc(t('os_top'))}</h2><table><tbody>${topP.map(([n, m]) => `<tr><td>${esc(n)}</td><td class="r">${esc(String(m))}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="src">${esc(t('os_rep_foot'))}</div>`;
  openPrintDoc(t('os_rep_title'), css, body);
}

async function openOrders(flash) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(t('ord_title'));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/orders'); } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, () => openCart()))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card"><div class="row"><button class="ghost small" data-back>${esc(t('gen_back'))}</button><span class="sp" style="flex:1"></span>${d.orders.length?`<button class="ghost small" data-allcsv title="${esc(t('os_csv_all_t'))}">⬇️ ${esc(t('os_csv_all'))}</button>`:''}</div>
    <h1 style="margin:8px 0 0">${esc(t('ord_title'))}</h1></div>`);
  { const ac = head.querySelector('[data-allcsv]'); if (ac) ac.onclick = () => {
    // Gesamt-Export für die Buchhaltung: eine Zeile je Position über alle Bestellungen.
    const header = [t('os_col_date'), t('os_col_ref'), t('csv_praeparat'), t('csv_wirkstoff'), t('csv_lieferant'), t('cart_col_menge'), t('csv_aktionspreis'), t('cart_col_sum'), t('pr_print_saving'), t('os_col_status')];
    const rows = [];
    for (const o of d.orders) {
      const date = (o.created_at || '').slice(0, 10);
      const status = o.received_at ? t('ord_received') : t('ord_ordered');
      for (const i of (o.items || [])) {
        const ap = i.aktionspreis != null ? Number(i.aktionspreis) : null;
        const saving = (i.listenpreis != null && ap != null && Number(i.listenpreis) > ap) ? (Number(i.listenpreis) - ap) * (Number(i.menge) || 0) : 0;
        rows.push([date, o.reference || '', i.bezeichnung, i.wirkstoff || '', i.supplier || '', i.menge, ap != null ? fmtMoney(ap) : '', ap != null ? fmtMoney(ap * (Number(i.menge) || 0)) : '', saving > 0 ? fmtMoney(saving) : '', status]);
      }
    }
    downloadCsv('apopulse-bestellungen', header, rows);
  }; }
  head.querySelector('[data-back]').onclick = () => openCart();
  feed.appendChild(head);
  if (flash) feed.appendChild(el(`<div class="card ok-box" style="padding:10px 14px;font-weight:600">✅ ${esc(flash)}</div>`));
  if (!d.orders.length) { feed.appendChild(emptyState({ icon:'📋', title:t('ord_empty_t'), text:t('ord_empty_s') })); return; }
  // Beschaffungs-Statistik mit wählbarem Zeitraum: Ausgaben, Ersparnis, Top-Präparate.
  // Der Zeitraum skaliert nur diese Zusammenfassung + den Report („Was haben wir in
  // Q3 gespart?") — die Bestell-Liste darunter bleibt die vollständige Historie.
  {
    const statsCard = el('<div class="card"></div>');
    feed.appendChild(statsCard);
    const PERIODS = [['all', t('os_p_all')], ['year', t('os_p_year')], ['d90', t('os_p_90')], ['d30', t('os_p_30')]];
    const stat = (num, label, col) => `<div style="flex:1;min-width:96px"><div style="font-size:20px;font-weight:800;color:${col}">${esc(num)}</div><div class="muted" style="font-size:12px">${esc(label)}</div></div>`;
    const renderStats = () => {
      const list = d.orders.filter(o => orderInPeriod(o, orderStatsPeriod));
      const spent = list.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const saved = list.reduce((s, o) => s + (Number(o.total_savings) || 0), 0);
      const pieces = list.reduce((s, o) => s + (Number(o.total_pieces) || 0), 0);
      const byProduct = new Map();
      for (const o of list) for (const i of (o.items || [])) {
        const key = (i.wirkstoff || i.bezeichnung || '').trim(); if (!key) continue;
        byProduct.set(key, (byProduct.get(key) || 0) + (Number(i.menge) || 0));
      }
      const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const od = taskToday();
      const open = list.filter(o => !o.received_at).length;
      const overdue = list.filter(o => !o.received_at && o.expected_delivery && o.expected_delivery < od).length;
      statsCard.innerHTML = `<div class="row"><b style="flex:1">📊 ${esc(t('os_title'))}</b><button class="ghost small" data-repprint title="${esc(t('os_report_t'))}">🖨️ ${esc(t('os_report'))}</button></div>
        <div class="reacts" style="margin-top:6px;flex-wrap:wrap;gap:6px">${PERIODS.map(([v,l])=>`<button class="small sortbtn${orderStatsPeriod===v?' active':''}" data-period="${v}" aria-pressed="${orderStatsPeriod===v}">${esc(l)}</button>`).join('')}</div>
        ${list.length ? `<div class="row" style="flex-wrap:wrap;gap:12px;margin-top:8px">
          ${stat(String(list.length), t('os_orders'), 'var(--text)')}
          ${stat('€ '+fmtMoney(spent), t('os_spent'), 'var(--text)')}
          ${saved>0?stat('€ '+fmtMoney(saved), t('os_saved'), 'var(--ok-fg)'):''}
          ${stat(String(pieces), t('os_pieces'), 'var(--text)')}
          ${open?stat(String(open), t('os_open'), 'var(--warn-fg)'):''}
          ${overdue?stat(String(overdue), t('os_overdue'), 'var(--crit-fg)'):''}
        </div>${top.length?`<div class="muted" style="font-size:13px;margin-top:10px">${esc(t('os_top'))}: ${top.map(([n,m])=>`<span class="spec">${esc(n)} · ${m}</span>`).join(' ')}</div>`:''}`
        : `<div class="muted" style="font-size:14px;margin-top:10px">${esc(t('os_p_none'))}</div>`}`;
      statsCard.querySelectorAll('[data-period]').forEach(b => b.onclick = () => { orderStatsPeriod = b.dataset.period; renderStats(); });
      const rp = statsCard.querySelector('[data-repprint]'); if (rp) rp.onclick = () => printProcurementReport(list);
    };
    renderStats();
  }
  // Ersparnis-Verlauf (über die gesamte Historie, unabhängig vom Zeitraum-Filter) —
  // zeigt die Entwicklung Monat für Monat. Nur wenn es ≥2 Monate mit Ersparnis gibt.
  { const mc = renderMonthlySavings(d.orders); if (mc) feed.appendChild(mc); }
  for (const o of d.orders) {
    // Lieferanten-Kurzliste (eindeutig) für den Überblick.
    const suppliers = [...new Set((o.items||[]).map(i => (i.supplier||'').trim()).filter(Boolean))];
    const card = el(`<div class="card">
      <div class="row" style="align-items:baseline;flex-wrap:wrap;gap:6px">
        <b>${o.reference?esc(o.reference):esc(relTime(o.created_at))}</b>
        ${o.received_at
          ? `<span style="font-size:12px;font-weight:700;color:var(--ok-fg);background:var(--ok-bg);border:1px solid var(--ok-bd);padding:1px 8px;border-radius:999px">${esc(t('ord_received'))}</span>`
          : `<span style="font-size:12px;font-weight:700;color:var(--warn-fg);background:var(--warn-bg);border:1px solid var(--warn-bd);padding:1px 8px;border-radius:999px">${esc(t('ord_ordered'))}</span>`}
        <span class="sp" style="flex:1"></span>
        <span style="font-weight:800">€ ${fmtMoney(o.total_price)}</span>
      </div>
      ${o.reference?`<div class="muted" style="font-size:12px">${esc(relTime(o.created_at))}</div>`:''}
      <div class="muted" style="font-size:13px;margin-top:4px">${esc(ti('ord_positions',{n:o.positions}))} · ${o.total_pieces} ${esc(t('cart_col_menge'))}${o.total_savings>0?` · <span style="color:var(--ok-fg);font-weight:700">${esc(ti('cart_savings',{sum:fmtMoney(o.total_savings)}))}</span>`:''}</div>
      ${suppliers.length?`<div class="muted" style="font-size:13px;margin-top:2px">🏢 ${esc(suppliers.join(' · '))}</div>`:''}
      ${suppliers.length?`<div class="reacts" style="margin-top:8px;gap:6px;flex-wrap:wrap">${suppliers.map(s=>`<button class="ghost small" data-copysup="${esc(s)}" title="${esc(t('cart_copy_order'))}">📋 ${esc(s)}</button>`).join('')}</div>`:''}
      ${!o.received_at?`<div class="row" style="margin-top:8px;align-items:center;gap:6px;flex-wrap:wrap">
        <label style="font-size:13px;margin:0" for="oexp_${esc(o.id)}">${esc(t('ord_expected_label'))}</label>
        <input id="oexp_${esc(o.id)}" type="date" data-oexp value="${esc(o.expected_delivery||'')}" style="max-width:170px">
        ${(o.expected_delivery && o.expected_delivery < taskToday())?`<b style="color:var(--crit-fg);font-size:13px">${esc(t('ord_delivery_overdue'))}</b>`:''}
      </div>`:''}
      <div class="reacts" style="margin-top:8px">
        <button class="${o.received_at?'ghost ':''}small" data-otoggle>${o.received_at?esc(t('ord_mark_open')):esc(t('ord_mark_received'))}</button>
        <button class="small" data-reorder>${esc(t('ord_reorder'))}</button>
        <button class="ghost small" data-oprint>🖨️ ${esc(t('pr_print_btn'))}</button>
        <button class="ghost small" data-ocsv>⬇️ CSV</button>
        <button class="ghost small" data-odel>${esc(t('ord_delete'))}</button>
      </div></div>`);
    // Bestellung als Dokument (Druck/CSV) — dieselbe Aufbereitung wie die Einkaufsliste.
    const orderDoc = { items: o.items, total_positions: o.total_pieces, total_price: o.total_price, total_savings: o.total_savings };
    card.querySelector('[data-oprint]').onclick = () => printCart(orderDoc);
    card.querySelector('[data-ocsv]').onclick = () => exportCartCsv(o.items);
    card.querySelectorAll('[data-copysup]').forEach(b => b.onclick = (ev) => copySupplierOrder(b.dataset.copysup, o.items, ev.target));
    card.querySelector('[data-otoggle]').onclick = async () => { try { await api('POST',`/api/orders/${o.id}/received`,{ received: !o.received_at }); openOrders(); } catch(e){ alert(e.message); } };
    { const oe = card.querySelector('[data-oexp]'); if (oe) oe.onchange = async () => { try { await api('POST',`/api/orders/${o.id}/expected`,{ expected: oe.value || null }); openOrders(); } catch(e){ alert(e.message); } }; }
    card.querySelector('[data-reorder]').onclick = async () => { try { await api('POST',`/api/orders/${o.id}/reorder`); openCart(); } catch(e){ alert(e.message); } };
    card.querySelector('[data-odel]').onclick = async () => { if (!confirm(t('ord_delete_confirm'))) return; try { await api('POST',`/api/orders/${o.id}/delete`); openOrders(); } catch(e){ alert(e.message); } };
    feed.appendChild(card);
  }
}

// Reaktionen: [Schlüssel, i18n-Key]. Label wird beim Rendern übersetzt (Emoji bleibt zuerst).
const REACTS = [['hilfreich','react_helpful'],['danke','react_thanks'],['bestaetigt','react_confirmed'],['interessant','react_interesting']];

function refChip(r) {
  if (!r) return '';
  const base = 'background:var(--chip-bg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;display:inline-block;margin-bottom:4px';
  if (r.kind === 'price') {
    const t = r.trend_pct>0?` ▲ +${r.trend_pct}%`:(r.trend_pct<0?` ▼ ${r.trend_pct}%`:'');
    return `<div class="vis" style="${base}">💶 Preis: <b>${esc(r.bezeichnung)}</b> — ${esc(r.supplier)} € ${fmtMoney(r.aep)}${t}</div>`;
  }
  if (r.kind === 'rabatt') {
    return `<div class="vis" style="${base}">${esc(t('rc_deal'))} <b>${esc(r.bezeichnung)}</b> — ${esc(r.supplier)} € ${fmtMoney(r.aktionspreis)} <span style="color:var(--ok-fg)">−${r.rabatt_pct}%</span> · ${esc(t('pg_valid'))} ${esc(r.gueltig_bis)}</div>`;
  }
  return `<div class="vis" style="${base}">${esc(t('rc_shortage'))} <b>${esc(r.wirkstoff)}</b> — ${esc(r.bezeichnung)}</div>`;
}

// In-Feed-Anzeige (Social-Media-Prinzip, Owner-Vorgabe Monetarisierung): EINE klar als
// „Anzeige" gekennzeichnete native Werbung aus dem bestehenden Angebote-System, dezent
// zwischen die Beiträge gesetzt. Optik wie ein Beitrag, aber unmissverständlich als
// Werbung markiert (Klartext-Prinzip + rechtliche Kennzeichnung). Klick öffnet das Angebot.
function feedAdCard(p) {
  const author = p.author ? (p.author.display_name || ('@' + (p.author.handle || ''))) : '';
  const card = el(`<div class="card feed-ad clickable" data-openpromo="${esc(p.id)}" role="link" tabindex="0" aria-label="${esc(t('wb_ad'))}: ${esc(p.titel || '')}">
    <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
      <span class="qr-ad-label" style="margin:0">${esc(t('wb_ad'))}</span>
      <span class="qr-ad-cat">${esc(promoCatLabel(p.kategorie))}</span>
    </div>
    ${p.image ? `<img class="feed-ad-img" src="${esc(p.image)}" alt="">` : ''}
    <div class="feed-ad-title">${esc(p.titel || '')}</div>
    <div class="qr-ad-price">${promoPrice(p)}</div>
    ${author ? `<div class="qr-ad-by">${esc(t('wb_by'))} ${esc(author)}</div>` : ''}
    <div class="qr-ad-cta">${esc(t('wb_view'))} <span aria-hidden="true">›</span></div>
  </div>`);
  const open = () => openPromotionDetail(p.id);
  card.onclick = open;
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  return card;
}

async function loadFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const url = tab==='home' ? '/api/feed/home' : ('/api/feed/public?sort=' + publicSort + '&filter=' + publicFilter + '&country=' + viewCountry());
    const d = await api('GET', url);
    feed.innerHTML = '';
    if (tab !== 'home') {
      const bar = el(`<div style="margin-bottom:10px">
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
          <span class="muted" style="font-size:14px" id="sortlbl">${esc(t('sh_sort'))}</span>
          <button class="small sortbtn${publicSort==='neu'?' active':''}" data-sort="neu" aria-pressed="${publicSort==='neu'}">${esc(t('pubf_new'))}</button>
          <button class="small sortbtn${publicSort==='top'?' active':''}" data-sort="top" aria-pressed="${publicSort==='top'}">${esc(t('pubf_top'))}</button>
        </div>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
          <span class="muted" style="font-size:14px">${esc(t('pubf_show'))}</span>
          <button class="small sortbtn${publicFilter==='all'?' active':''}" data-filter="all" aria-pressed="${publicFilter==='all'}">${esc(t('pubf_all'))}</button>
          <button class="small sortbtn${publicFilter==='questions'?' active':''}" data-filter="questions" aria-pressed="${publicFilter==='questions'}">${esc(t('pubf_questions'))}</button>
        </div>
      </div>`);
      bar.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
        if (publicSort === b.dataset.sort) return;
        publicSort = b.dataset.sort; loadFeed();
      });
      bar.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
        if (publicFilter === b.dataset.filter) return;
        publicFilter = b.dataset.filter; loadFeed();
      });
      feed.appendChild(bar);
    }
    if (!d.posts.length) {
      if (tab==='home') {
        feed.appendChild(emptyState({ icon:'📭', title:t('fe_home_t'), text:t('fe_home_s') }));
        await renderSuggestions(feed);
      } else if (publicFilter==='questions') {
        feed.appendChild(emptyState({ icon:'❓', title:t('fe_q_t'), text:t('fe_q_s'), cta:{ label:t('fe_q_cta'), onClick:()=>{ const t=document.getElementById('pfrage'); if(t){ t.checked=true; } const b=document.getElementById('pb'); if(b){ b.focus(); b.scrollIntoView({behavior:'smooth',block:'center'}); } } } }));
      } else {
        feed.appendChild(emptyState({ icon:'✍️', title:t('fe_new_t'), text:t('fe_new_s'), cta:{ label:t('fe_new_cta'), onClick:()=>{ const b=document.getElementById('pb'); if(b){ b.focus(); b.scrollIntoView({behavior:'smooth',block:'center'}); } } } }));
      }
      return;
    }
    // Eine In-Feed-Anzeige nur im öffentlichen Feed und nur, wenn Werbung vorhanden ist
    // (sonst nichts — die Seite wirkt nie überladen). Platzierung nach dem 3. Beitrag,
    // damit sie nie allein ganz unten hängt.
    let adCard = null;
    if (tab !== 'home') {
      try {
        const promos = ((await api('GET','/api/promotions')).promotions) || [];
        if (promos.length) adCard = feedAdCard(promos[Math.floor(Math.random() * Math.min(promos.length, 5))]);
      } catch { /* keine Werbung → nichts anzeigen */ }
    }
    const adAfter = Math.min(2, d.posts.length - 1); // nach dem 3. Beitrag (oder letzter, wenn kürzer)
    d.posts.forEach((p, i) => {
      feed.appendChild(postCard(p));
      if (adCard && i === adAfter) { feed.appendChild(adCard); adCard = null; }
    });
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

async function renderSuggestions(feed) {
  if (!featureAn('social')) return;
  try {
    const s = await api('GET','/api/suggestions/follow');
    if (!s.suggestions.length) return;
    const card = el(`<div class="card"><b>${esc(t('sg_title'))}</b><div data-sug style="margin-top:6px"></div></div>`);
    const box = card.querySelector('[data-sug]');
    s.suggestions.forEach(p => {
      const row = el(`<div class="comment"><div class="row" style="align-items:baseline">
        <b class="clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name)}</b>
        <span class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</span>
        ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}${p.verified?'<span class="verified">✔</span>':''}
        <span class="sp" style="flex:1"></span>
        <button class="small" data-follow="${esc(p.handle)}">${esc(t('pf_follow'))}</button></div>
        ${p.specializations&&p.specializations.length?`<div class="muted" style="font-size:13px;margin-top:2px">${p.specializations.map(esc).join(' · ')}</div>`:''}</div>`);
      row.querySelectorAll('[data-openprofile]').forEach(el=>el.onclick=()=>openProfile(el.dataset.openprofile));
      row.querySelector('[data-follow]').onclick = async (ev) => {
        try { await api('POST','/api/follow',{ handle:p.handle }); ev.target.textContent=t('sg_followed'); ev.target.disabled=true; } catch(e){ alert(e.message); }
      };
      box.appendChild(row);
    });
    feed.appendChild(card);
  } catch {}
}

// ⭐ Premium: einfacher Direkt-Weg per Krypto (Coin → Adresse + „in Wallet öffnen" + Betrag).
// Karte/PayPal erscheinen nur, wenn ein Zahlungsanbieter konfiguriert ist. Freischaltung
// erfolgt nach manueller Prüfung der gemeldeten Transaktion (ehrlich, kein Fake-Auto).
async function openPremium() {
  setDocTitle(t('pr_title'));
  app.innerHTML = '';
  const back = el(`<div class="row" style="margin-bottom:8px"><button class="ghost small" id="prBack">${esc(t('gen_back'))}</button></div>`);
  app.appendChild(back);
  back.querySelector('#prBack').onclick = () => mainScreen();
  const card = el(`<div class="card"><h1 style="margin:0 0 2px">${esc(t('pr_title'))}</h1>
    <div class="muted" style="margin-bottom:6px">${esc(t('pr_intro'))}</div>
    <div id="prBody"><div class="loading">…</div></div></div>`);
  app.appendChild(card);
  const body = card.querySelector('#prBody');
  try {
    const mine = await api('GET', '/api/me/premium').catch(() => ({ premium: false }));
    if (mine.premium) { body.innerHTML = `<div class="ok-box" style="padding:10px 12px">${esc(t('pr_have'))}</div>`; return; }
    const opt = await api('GET', `/api/payments/crypto?product=premium_monthly&country=${encodeURIComponent(viewCountry())}`);
    body.innerHTML = '';
    // Nutzen zuerst zeigen (Warum Premium?) — sonst zahlt niemand. Klar, scannbar, ehrlich
    // (nur tatsächlich freigeschaltete Funktionen).
    body.appendChild(el(`<div class="ok-box" style="padding:12px 14px;margin-bottom:12px">
      <b>${esc(t('pr_benefits_lead'))}</b>
      <ul style="margin:8px 0 0;padding-left:18px;display:grid;gap:6px">
        <li>${esc(t('pr_b1'))}</li><li>${esc(t('pr_b2'))}</li><li>${esc(t('pr_b3'))}</li><li>${esc(t('pr_b4'))}</li>
      </ul>
    </div>`));
    const priceMain = fmtCurrency(opt.amount, opt.currency || 'EUR');
    body.appendChild(el(`<div style="font-weight:800;font-size:1.15em;margin-bottom:4px">${esc(opt.product_name)} — <span style="color:var(--green)">${esc(priceMain)}</span></div>`));
    // Näherung in der Landeswährung, damit niemand selbst umrechnen muss.
    // Erscheint NUR mit echtem Kurs — fehlt er, steht hier bewusst nichts.
    if (opt.local) {
      body.appendChild(el(`<div class="muted" style="font-size:13px;margin-bottom:8px">${
        esc(ti('pr_local_approx', { local: fmtCurrency(opt.local.amount, opt.local.currency), billed: priceMain }))
      }</div>`));
    }
    if (!opt.coins.length) { body.appendChild(el(`<div class="muted">${esc(t('pr_none'))}</div>`)); }
    opt.coins.forEach(c => {
      const amountLbl = c.amount_crypto != null ? ti('pr_amount', { n: c.amount_crypto, sym: c.symbol }) : ti('pr_amount_na', { amount: fmtCurrency(opt.amount, opt.currency || 'EUR') });
      const title = esc(c.symbol) + (c.label ? ` <span class="muted" style="font-weight:400;font-size:13px">· ${esc(c.label)}</span>` : '');
      const cc = el(`<div class="crypto-pay">
        <div class="row"><b>${title}</b> <span class="muted" style="font-size:13px">${esc(ti('pr_network', { net: c.network }))}</span><span class="sp" style="flex:1"></span><span style="font-weight:700">${esc(amountLbl)}</span></div>
        <div class="crypto-addr"><code>${esc(c.address)}</code></div>
        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
          <a class="btn-link" href="${esc(c.uri)}">${esc(t('pr_open_wallet'))}</a>
          <button class="ghost small" data-copy="${esc(c.address)}">${esc(t('pr_copy_addr'))}</button>
        </div>
        <div style="margin-top:10px"><div class="muted" style="font-size:13px;margin-bottom:4px">${esc(t('pr_paid_q'))}</div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><input class="tx-in" placeholder="${esc(t('pr_tx_ph'))}" style="flex:1;min-width:180px"><button class="small" data-report="${esc(c.id)}">${esc(t('pr_report'))}</button></div>
          <div class="tx-msg" style="margin-top:6px"></div>
        </div>
      </div>`);
      cc.querySelector('[data-copy]').onclick = async (e) => { try { await navigator.clipboard.writeText(c.address); e.target.textContent = t('pr_copied'); } catch { /* Clipboard n/a */ } };
      cc.querySelector('[data-report]').onclick = async () => {
        const inp = cc.querySelector('.tx-in'); const msg = cc.querySelector('.tx-msg');
        try {
          const s = await api('POST', '/api/payments/crypto/start', { productId: 'premium_monthly', walletId: c.id });
          await api('POST', `/api/payments/crypto/${encodeURIComponent(s.payment_id)}/claim`, { txRef: inp.value });
          msg.style.color = 'var(--green)'; msg.textContent = t('pr_reported'); inp.value = '';
        } catch (e) { msg.style.color = 'var(--crit-fg)'; msg.textContent = e.message; }
      };
      body.appendChild(cc);
    });
    body.appendChild(el(`<div class="muted" style="font-size:13px;margin-top:10px">${esc(t('pr_note'))}</div>`));
    // Karte/PayPal: nur anzeigen, wenn ein Anbieter aktiv ist; sonst Hinweis.
    const methods = await api('GET', '/api/payments/methods').catch(() => ({ methods: [] }));
    if (!methods.methods.length) body.appendChild(el(`<div class="muted" style="font-size:13px;margin-top:6px">${esc(t('pr_fiat_soon'))}</div>`));
  } catch (e) { body.innerHTML = ''; body.appendChild(errorState(e.message, openPremium)); }
}

async function openBookmarks() {
  setDocTitle(t('bm_doc'));
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/bookmarks');
    myBookmarks = new Set(d.posts.map(p=>p.id));
    feed.innerHTML = '';
    const head = el(`<div class="card"><div class="row"><b>${esc(t('bm_title'))}</b><span class="sp" style="flex:1"></span><span class="muted">${d.posts.length}</span><button class="ghost small" data-back style="margin-left:10px">${esc(t('search_back'))}</button></div></div>`);
    head.querySelector('[data-back]').onclick = () => goTab('overview');
    feed.appendChild(head);
    if (!d.posts.length) { feed.appendChild(emptyState({ icon:'🔖', title:t('bm_empty_t'), text:t('bm_empty_s') })); return; }
    // Suche über Text/Autor — hilft, in einer wachsenden Merkliste den richtigen Beitrag zu finden.
    let bmQuery = '';
    if (d.posts.length >= 4) {
      const sc = el(`<div class="card" style="padding:8px 12px"><div class="row" style="gap:6px"><input data-bmq placeholder="${esc(t('bm_search_ph'))}" aria-label="${esc(t('bm_search_ph'))}" style="flex:1"></div></div>`);
      const inp = sc.querySelector('[data-bmq]');
      inp.oninput = () => { bmQuery = inp.value.trim().toLowerCase(); renderBm(); };
      feed.appendChild(sc);
    }
    const listBox = el('<div data-bmlist></div>');
    feed.appendChild(listBox);
    const renderBm = () => {
      listBox.innerHTML = '';
      const shown = !bmQuery ? d.posts : d.posts.filter(p =>
        (p.body||'').toLowerCase().includes(bmQuery)
        || (p.author && ((p.author.display_name||'').toLowerCase().includes(bmQuery) || (p.author.handle||'').toLowerCase().includes(bmQuery))));
      if (!shown.length) { listBox.appendChild(el(`<div class="card muted">${esc(ti('bm_none_filter',{q:bmQuery}))}</div>`)); return; }
      shown.forEach(p => listBox.appendChild(postCard(p)));
    };
    renderBm();
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

// Einheitlicher Detailseiten-Einstieg: nach oben scrollen (man kommt oft aus einer tief
// gescrollten Liste) und Fokus auf die Überschrift setzen, damit Screenreader/Tastatur die
// neue Seite mitbekommen. Der Fokusring erscheint nur bei Tastaturnutzung (:focus-visible).
function startDetailView(titleEl) {
  window.scrollTo({ top: 0 });
  if (titleEl) titleEl.focus({ preventScroll: true });
}

async function openHashtag(tag) {
  setDocTitle('#' + String(tag||'').replace(/^#/, ''));
  if (!tag) return;
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/hashtag/'+encodeURIComponent(tag));
    feed.innerHTML = '';
    const head = el(`<div class="card"><div class="row" style="flex-wrap:wrap;gap:6px"><b tabindex="-1" data-httitle>🏷️ #${esc(d.tag)}</b><span class="sp" style="flex:1"></span><span class="muted">${esc(ti('ht_posts',{n:d.posts.length}))}</span><button class="ghost small" data-share title="${esc(t('pc_share'))}">${esc(t('pc_share'))}</button><button class="ghost small" data-back>${esc(t('search_back'))}</button></div></div>`);
    head.querySelector('[data-back]').onclick = () => { tab='public'; document.querySelector('.tabs button[data-tab="public"]').classList.add('active'); loadTab(); };
    { const shb = head.querySelector('[data-share]'); if (shb) shb.onclick = async () => {
      const url = location.origin + '/?hashtag=' + encodeURIComponent(d.tag);
      try { await navigator.clipboard.writeText(url); shb.textContent = t('pc_copied'); setTimeout(()=>{ shb.textContent = t('pc_share'); }, 1500); }
      catch { prompt(t('copy_link_fb'), url); }
    }; }
    feed.appendChild(head);
    if (!d.posts.length) feed.appendChild(emptyState({ icon:'🏷️', title:t('ht_empty_t'), text:ti('ht_empty_s',{tag:d.tag}) }));
    d.posts.forEach(p => feed.appendChild(postCard(p)));
    startDetailView(head.querySelector('[data-httitle]'));
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

// Stewardship-Fachforum: kuratierter Themen-Einstieg über den #stewardship-Hashtag,
// mit klarem Zweck/Disclaimer und Composer. Anonymisierte Fachdiskussion — keine
// Patientenberatung, keine personenbezogenen Patientendaten.
async function openStewardship() {
  setDocTitle(t('stew_doc'));
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/hashtag/stewardship'); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card" style="border-left:4px solid #0b7f28">
    <div><button class="ghost small" data-back>${esc(t('search_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('stew_title'))}</h1>
    <div class="muted" style="font-size:14px">${esc(t('stew_sub'))}</div>
    <div class="muted" style="font-size:12px;margin-top:8px;font-style:italic">${esc(t('stew_warn'))}</div>
    <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="ghost small" data-pinfo>${esc(t('stew_pinfo'))}</button><button class="ghost small" data-zettel>${esc(t('stew_zettel'))}</button></div></div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  head.querySelector('[data-pinfo]').onclick = () => openPatientInfo();
  head.querySelector('[data-zettel]').onclick = () => openBegleitzettel();
  feed.appendChild(head);
  if (me) {
    const comp = el(`<div class="card"><b>${esc(t('stew_compose_t'))}</b>
      <textarea data-sf-in placeholder="${esc(t('stew_compose_ph'))}" style="margin-top:6px;width:100%"></textarea>
      <div class="row" style="margin-top:6px;gap:8px;align-items:center"><button class="small" data-sf-send>${esc(t('stew_post_btn'))}</button><span class="err" data-sf-err style="font-size:13px"></span></div></div>`);
    const ta = comp.querySelector('[data-sf-in]');
    comp.querySelector('[data-sf-send]').onclick = async () => {
      const err = comp.querySelector('[data-sf-err]'); err.textContent = '';
      let body = ta.value.trim();
      if (!body) return;
      if (!/#stewardship\b/i.test(body)) body += ' #stewardship';
      try { await api('POST','/api/posts',{ body, visibility:'public' }); ta.value=''; openStewardship(); }
      catch(e){ err.textContent = e.message; }
    };
    feed.appendChild(comp);
  }
  const listBox = el('<div></div>');
  feed.appendChild(listBox);
  if (!d.posts.length) listBox.appendChild(el(`<div class="card muted">${esc(t('stew_empty'))}</div>`));
  else d.posts.forEach(p => listBox.appendChild(postCard(p)));
}

// Mehrsprachige Patienten-Infokarten (Antibiotika) — Aufklärung zur Abgabe.
let patientLang = 'de';
// Überschrift der Patienteninfo in der gewählten Patienten-Sprache (de/en/tr) —
// damit gedruckte Info-Blätter nicht deutsch betitelt sind, obwohl der Inhalt engl./türk. ist.
function patientInfoHeading(lang) {
  return lang === 'en' ? 'Antibiotics – Patient information'
    : lang === 'tr' ? 'Antibiyotikler – Hasta bilgisi'
    : 'Antibiotika – Patienteninformation';
}
function printPatientInfo(d) {
  const cards = d.cards.map(c => `<div class="c"><h2>${esc(c.icon)} ${esc(c.title)}</h2><p>${esc(c.body)}</p></div>`).join('');
  const css = `body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111}
    h1{font-size:20px} .c{border:1px solid #cbd5cf;border-radius:8px;padding:12px 14px;margin:10px 0;break-inside:avoid}
    h2{font-size:16px;margin:0 0 4px} p{margin:0;font-size:14px;line-height:1.5} .src{font-size:12px;color:#555;margin-top:16px}`;
  // Quell-Label in der Patienten-Sprache (wie die Überschrift) — ein deutsches „Quelle:"
  // auf einem englischen/türkischen Blatt wäre inkonsistent.
  const srcLabel = d.lang === 'en' ? 'Source' : d.lang === 'tr' ? 'Kaynak' : 'Quelle';
  const body = `<h1>🧫 ${esc(patientInfoHeading(d.lang))}</h1>${cards}
    <div class="src">${esc(srcLabel)}: ${esc(d.source.label)} · ${esc(d.source.url)}<br>${esc(d.disclaimer)}</div>`;
  openPrintDoc(patientInfoHeading(d.lang), css, body, d.lang);
}
async function openPatientInfo() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/patient-info?lang='+encodeURIComponent(patientLang)); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card" style="border-left:4px solid #0b7f28">
    <div><button class="ghost small" data-back>${esc(t('search_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('pi_title'))}</h1>
    <div class="muted" style="font-size:14px">${esc(t('pi_sub'))}</div>
    <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap;align-items:center">
      <span data-langs style="display:flex;gap:6px;flex-wrap:wrap"></span>
      <span class="sp" style="flex:1"></span>
      <button class="ghost small" data-zettel>${esc(t('pi_zettel_btn'))}</button>
      <button class="ghost small" data-print>${esc(t('sh_print'))}</button></div></div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  head.querySelector('[data-zettel]').onclick = () => openBegleitzettel();
  head.querySelector('[data-print]').onclick = () => printPatientInfo(d);
  const langs = head.querySelector('[data-langs]');
  d.langs.forEach(l => {
    const bt = el(`<button class="small sortbtn${l.code===d.lang?' active':''}">${esc(l.label)}</button>`);
    bt.onclick = () => { patientLang = l.code; openPatientInfo(); };
    langs.appendChild(bt);
  });
  feed.appendChild(head);
  d.cards.forEach(c => {
    const card = el(`<div class="card"><div class="row"><b>${esc(c.icon)} ${esc(c.title)}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-copy>${esc(t('pi_copy'))}</button></div>
      <div style="font-size:14px;margin-top:6px">${esc(c.body)}</div></div>`);
    card.querySelector('[data-copy]').onclick = async (e) => {
      try { await navigator.clipboard.writeText(c.title + '\n' + c.body); e.target.textContent = t('pc_copied'); setTimeout(()=>{ e.target.textContent=t('pi_copy'); }, 1400); }
      catch { prompt(t('copy_text_fb'), c.title + '\n' + c.body); }
    };
    feed.appendChild(card);
  });
  feed.appendChild(el(`<div class="card muted" style="font-size:12px"><a href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(d.source.label)}</a> · <span style="font-style:italic">${esc(d.disclaimer)}</span></div>`));
}

// Verordnungs-Klartext-Begleitzettel (Abgabe in der Apotheke, ohne ELGA).
// REINE AUFBEREITUNG: formatiert ausschließlich die vom Fachpersonal laut
// Verordnung eingegebenen Angaben als großen, mehrsprachigen Einnahmeplan.
// Es wird KEINE Dosierung berechnet, geprüft oder vorgeschlagen.
const ZETTEL_L = {
  de: { title: 'Einnahmeplan', morgens: 'Morgens', mittags: 'Mittags', abends: 'Abends', nacht: 'Zur Nacht',
    essen: { unabh: 'Einnahme unabhängig vom Essen', vor: 'Einnahme vor dem Essen', zum: 'Einnahme zum Essen', nach: 'Einnahme nach dem Essen' },
    dauer: 'Einnahmedauer', hinweise: 'Wichtige Hinweise',
    fragen: 'Bei Fragen wenden Sie sich an Ihre Apotheke oder Ihre Ärztin / Ihren Arzt.',
    herkunft: 'Angaben laut Verordnung — ausgefüllt vom Apothekenpersonal.' },
  en: { title: 'Medication schedule', morgens: 'Morning', mittags: 'Noon', abends: 'Evening', nacht: 'At night',
    essen: { unabh: 'Take independently of meals', vor: 'Take before meals', zum: 'Take with meals', nach: 'Take after meals' },
    dauer: 'Duration', hinweise: 'Important notes',
    fragen: 'If you have questions, contact your pharmacy or your doctor.',
    herkunft: 'Details as prescribed — completed by pharmacy staff.' },
  tr: { title: 'İlaç kullanım planı', morgens: 'Sabah', mittags: 'Öğle', abends: 'Akşam', nacht: 'Gece',
    essen: { unabh: 'Yemekten bağımsız alın', vor: 'Yemekten önce alın', zum: 'Yemekle birlikte alın', nach: 'Yemekten sonra alın' },
    dauer: 'Kullanım süresi', hinweise: 'Önemli notlar',
    fragen: 'Sorularınız için eczanenize veya doktorunuza başvurun.',
    herkunft: 'Reçeteye göre bilgiler — eczane personeli tarafından dolduruldu.' },
};
let zettelLang = 'de';
// Innerer Inhalt (für Vorschau und Druck identisch).
function zettelBody(z) {
  const L = ZETTEL_L[z.lang] || ZETTEL_L.de;
  const cell = (v, lab) => `<div style="flex:1;min-width:90px;text-align:center;border:1px solid #9aa8a0;border-radius:8px;padding:10px 6px">
    <div style="font-size:26px;font-weight:800;line-height:1.1">${esc(v || '0')}</div>
    <div style="font-size:13px;margin-top:2px">${esc(lab)}</div></div>`;
  return `<div style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#4a5a51">${esc(L.title)}</div>
    <div style="font-size:24px;font-weight:800;margin:4px 0 12px">${esc(z.praeparat)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${cell(z.morgens, L.morgens)}${cell(z.mittags, L.mittags)}${cell(z.abends, L.abends)}${cell(z.nacht, L.nacht)}</div>
    <div style="font-size:16px;margin-top:12px">🍽️ ${esc(L.essen[z.essen] || L.essen.unabh)}</div>
    ${z.dauer ? `<div style="font-size:16px;margin-top:6px">📅 ${esc(L.dauer)}: <b>${esc(z.dauer)}</b></div>` : ''}
    ${z.hinweise ? `<div style="font-size:15px;margin-top:10px"><b>${esc(L.hinweise)}:</b> ${esc(z.hinweise)}</div>` : ''}
    <div style="font-size:14px;margin-top:14px">${esc(L.fragen)}</div>
    <div style="font-size:11.5px;color:#4a5a51;margin-top:12px;font-style:italic">${esc(L.herkunft)}</div>`;
}
// Komplette Druckseite: Einnahmeplan, optional plus Patienten-Infokarten
// (gleiche Sprache) auf einer Folgeseite — ein Druckauftrag bei der Abgabe.
function zettelPrintHtml(z, cards) {
  const cardsHtml = cards ? `<div style="break-before:page;page-break-before:always">
      <h1 style="font-size:20px">🧫 ${esc(patientInfoHeading(cards.lang))}</h1>
      ${cards.cards.map(c => `<div style="border:1px solid #cbd5cf;border-radius:8px;padding:12px 14px;margin:10px 0;break-inside:avoid"><h2 style="font-size:16px;margin:0 0 4px">${esc(c.icon)} ${esc(c.title)}</h2><p style="margin:0;font-size:14px;line-height:1.5">${esc(c.body)}</p></div>`).join('')}
      <div style="font-size:12px;color:#555;margin-top:14px">${esc(cards.source.label)} · ${esc(cards.source.url)}<br>${esc(cards.disclaimer)}</div>
    </div>` : '';
  return `<!doctype html><html lang="${esc(z.lang)}"><head><meta charset="utf-8"><title>${esc(ZETTEL_L[z.lang].title)}</title>
    <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:28px auto;padding:0 18px;color:#111}</style></head>
    <body>${zettelBody(z)}${cardsHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`;
}
function writeZettel(w, z, cards) {
  w.document.open();
  w.document.write(zettelPrintHtml(z, cards));
  w.document.close();
}
function openBegleitzettel() {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '';
  const head = el(`<div class="card" style="border-left:4px solid #0b7f28">
    <div><button class="ghost small" data-back>${esc(t('search_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('bz_title'))}</h1>
    <div class="muted" style="font-size:14px">${esc(t('bz_sub'))}</div>
    <div class="muted" style="font-size:12px;margin-top:6px;font-style:italic">${esc(t('bz_warn'))}</div></div>`);
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  feed.appendChild(head);
  const form = el(`<div class="card">
    <label>${esc(t('bz_med'))}</label>
    <input data-z-p placeholder="${esc(t('bz_med_ph'))}">
    <label style="margin-top:8px">${esc(t('bz_schema'))}</label>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      ${[['m',t('bz_morning')],['mi',t('bz_noon')],['a',t('bz_evening')],['n',t('bz_night')]].map(([k,l])=>`<label style="flex:1;min-width:80px;font-size:12px">${esc(l)}<input data-z-${k} value="0" style="width:100%;text-align:center"></label>`).join('')}
    </div>
    <label style="margin-top:8px">${esc(t('bz_food'))}</label>
    <select data-z-e>
      <option value="unabh">${esc(t('bz_food_indep'))}</option>
      <option value="vor">${esc(t('bz_food_before'))}</option>
      <option value="zum">${esc(t('bz_food_with'))}</option>
      <option value="nach">${esc(t('bz_food_after'))}</option>
    </select>
    <label style="margin-top:8px">${esc(t('bz_duration'))}</label>
    <input data-z-d placeholder="${esc(t('bz_duration_ph'))}">
    <label style="margin-top:8px">${esc(t('bz_notes'))}</label>
    <textarea data-z-h placeholder="${esc(t('bz_notes_ph'))}"></textarea>
    <label style="margin-top:8px">${esc(t('bz_lang_label'))}</label>
    <div class="row" data-z-langs style="gap:6px;flex-wrap:wrap"></div>
    <label style="margin-top:10px;display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer">
      <input type="checkbox" data-z-cards style="width:auto;margin:0"> ${esc(t('bz_cards'))}
    </label>
    <div class="row" style="margin-top:12px;gap:8px"><button class="small" data-z-print>${esc(t('bz_print'))}</button><span class="err" data-z-err style="font-size:13px"></span></div>
  </div>`);
  const preview = el(`<div class="card"><div class="muted" style="font-size:12px;margin-bottom:8px">${esc(t('bz_preview'))}</div><div data-z-prev style="background:#fff;color:#111;border:1px solid var(--line,#ccc);border-radius:10px;padding:16px"></div></div>`);
  const readZ = () => ({
    lang: zettelLang,
    praeparat: form.querySelector('[data-z-p]').value.trim(),
    morgens: form.querySelector('[data-z-m]').value.trim(),
    mittags: form.querySelector('[data-z-mi]').value.trim(),
    abends: form.querySelector('[data-z-a]').value.trim(),
    nacht: form.querySelector('[data-z-n]').value.trim(),
    essen: form.querySelector('[data-z-e]').value,
    dauer: form.querySelector('[data-z-d]').value.trim(),
    hinweise: form.querySelector('[data-z-h]').value.trim(),
  });
  const drawPrev = () => { const z = readZ(); preview.querySelector('[data-z-prev]').innerHTML = z.praeparat ? zettelBody(z) : `<span style="color:#777">${esc(t('bz_preview_empty'))}</span>`; };
  const langBox = form.querySelector('[data-z-langs]');
  const drawLangs = () => {
    langBox.innerHTML = '';
    [['de','Deutsch'],['en','English'],['tr','Türkçe']].forEach(([c,l]) => {
      const bt = el(`<button class="small sortbtn${zettelLang===c?' active':''}" aria-pressed="${zettelLang===c}">${l}</button>`);
      bt.onclick = () => { zettelLang = c; drawLangs(); drawPrev(); };
      langBox.appendChild(bt);
    });
  };
  drawLangs();
  form.querySelectorAll('input,textarea,select').forEach(i => i.oninput = drawPrev);
  form.querySelector('[data-z-print]').onclick = async () => {
    const err = form.querySelector('[data-z-err]'); err.textContent = '';
    const z = readZ();
    if (!z.praeparat) { err.textContent = t('bz_need_med'); return; }
    // Fenster synchron im Klick öffnen (Popup-Blocker), Inhalt danach schreiben.
    const w = window.open('', '_blank');
    if (!w) { err.textContent = t('pi_popup'); return; }
    let cards = null;
    if (form.querySelector('[data-z-cards]').checked) {
      try { cards = await api('GET','/api/patient-info?lang='+encodeURIComponent(z.lang)); }
      catch { /* Karten optional — Zettel drucken trotzdem */ }
    }
    writeZettel(w, z, cards);
  };
  feed.appendChild(form);
  feed.appendChild(preview);
  drawPrev();
}

async function renderSearch(q) {
  setDocTitle(t('search_doc') + ': ' + q);
  recordRecentSearch(q); // jede Suche lokal merken (für „Letzte Suchen")
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/search?q='+encodeURIComponent(q));
    feed.innerHTML = '';
    const head = el(`<div class="card"><div class="row"><b tabindex="-1" data-stitle>${esc(ti('search_results_for',{q:d.query}))}</b><span class="sp" style="flex:1"></span><span class="muted">${esc(ti('search_hits',{n:d.total}))}</span><button class="ghost small" data-back style="margin-left:10px">${esc(t('search_back'))}</button></div></div>`);
    head.querySelector('[data-back]').onclick = () => { tab='public'; document.querySelector('.tabs button[data-tab="public"]').classList.add('active'); loadTab(); };
    feed.appendChild(head);
    // Wie die Wirkstoff-Detailseite: oben starten (man sucht oft aus einer tief gescrollten
    // Ansicht) und Fokus auf die Ergebnis-Überschrift, damit Screenreader/Tastatur die neue
    // Trefferliste als solche mitbekommen (Ring nur bei Tastaturnutzung via :focus-visible).
    startDetailView(head.querySelector('[data-stitle]'));
    // Letzte Suchen (nur lokal) als Schnell-Chips — häufige Suchen mit einem Klick wiederholen.
    const others = getRecentSearches().filter(x => x.toLowerCase() !== (d.query||'').toLowerCase());
    if (others.length) {
      const rs = el(`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">${esc(t('search_recent'))}</div><div class="row" data-recentq style="flex-wrap:wrap;gap:6px"></div></div>`);
      const rb = rs.querySelector('[data-recentq]');
      others.slice(0, 6).forEach(qq => { const c = el(`<button class="small sortbtn">🔎 ${esc(qq)}</button>`); c.onclick = () => renderSearch(qq); rb.appendChild(c); });
      feed.appendChild(rs);
    }
    if (!d.total) {
      feed.appendChild(emptyState({ icon:'🔍', title:t('search_none_t'), text:ti('search_none_s',{q:d.query}) }));
      // Sackgasse vermeiden: den Suchbegriff direkt beobachten oder (Fachkreis) als Engpass melden.
      // Originaltext der Suche verwenden (behält Groß-/Kleinschreibung; d.query ist normalisiert).
      const nq = (q||'').trim();
      if (nq.length >= 2 && nq.length <= 80) {
        const acts = el(`<div class="card" style="text-align:center">
          <div class="muted" style="font-size:14px;margin-bottom:8px">${esc(t('search_none_lead'))}</div>
          <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
            <button class="small" data-swatch>${esc(ti('search_none_watch',{q:nq}))}</button>
            ${(me&&me.account_type!=='private')?`<button class="ghost small" data-sreport>${esc(ti('search_none_report',{q:nq}))}</button>`:''}
          </div>
          <div class="err" data-serr style="margin-top:6px"></div>
        </div>`);
        acts.querySelector('[data-swatch]').onclick = async (ev) => {
          ev.target.disabled = true;
          try { await api('POST','/api/watchlist',{ wirkstoff: nq }); ev.target.textContent = '✓ ' + t('sc_watched'); }
          catch(e){ acts.querySelector('[data-serr]').textContent = e.message; ev.target.disabled = false; }
        };
        const rb = acts.querySelector('[data-sreport]');
        if (rb) rb.onclick = () => { shortageReportPrefill = nq; goTab('shortages'); };
        feed.appendChild(acts);
      }
      return;
    }
    // Direkter Weg zur Wirkstoff-Detailseite: aus den Treffern gefundene Wirkstoffe.
    const wset = new Map();
    [...d.shortages, ...d.prices, ...d.rabatte].forEach(x => { if (x.wirkstoff) wset.set(x.wirkstoff.toLowerCase(), x.wirkstoff); });
    if (wset.size) {
      // Aktuelle Beobachtungsliste laden, um schon beobachtete Wirkstoffe zu markieren.
      let watched = new Set();
      try { const wl = await api('GET','/api/watchlist'); watched = new Set((wl.items||[]).map(i => i.wirkstoff.toLowerCase())); } catch { /* ohne Markierung weiter */ }
      const wc = el(`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:6px">${esc(t('search_wk'))}</div><div class="row" data-wchips style="flex-wrap:wrap;gap:10px"></div></div>`);
      const box = wc.querySelector('[data-wchips]');
      [...wset.values()].slice(0, 8).forEach(w => {
        const group = el(`<span class="row" style="gap:2px;align-items:stretch"></span>`);
        const chip = el(`<button class="small sortbtn">💊 ${esc(w)}</button>`);
        chip.onclick = () => openWirkstoff(w);
        const watchBtn = el(`<button class="small ghost" title="${esc(t('search_watch_title'))}"></button>`);
        const paint = () => { const on = watched.has(w.toLowerCase()); watchBtn.textContent = on ? t('search_watched') : t('search_watch'); watchBtn.classList.toggle('watched-on', on); };
        watchBtn.onclick = async () => {
          watchBtn.disabled = true;
          try {
            if (watched.has(w.toLowerCase())) { await api('DELETE','/api/watchlist/'+encodeURIComponent(w)); watched.delete(w.toLowerCase()); }
            else { await api('POST','/api/watchlist',{ wirkstoff: w }); watched.add(w.toLowerCase()); }
            paint();
          } catch(e){ /* still: Button-Titel bleibt */ }
          watchBtn.disabled = false;
        };
        paint();
        group.appendChild(chip); group.appendChild(watchBtn);
        box.appendChild(group);
      });
      feed.appendChild(wc);
    }
    const section = (title) => feed.appendChild(el(`<div class="muted" style="margin:14px 2px 4px;font-weight:700">${title}</div>`));
    if (d.people.length) {
      section(t('search_sec_people'));
      d.people.forEach(p => {
        const specs = (p.specializations||[]).map(s=>`<span class="spec">${esc(s)}</span>`).join(' ');
        // Mit Profilbild — konsistent zu Feed und Verzeichnis, schneller wiederzuerkennen.
        const card = el(`<div class="card"><div class="row" style="align-items:flex-start">
          ${avatarHtml(p, 40)}
          <div style="flex:1;min-width:0">
            <div class="row" style="align-items:baseline;gap:6px;flex-wrap:wrap">
              <span class="post-author clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name)}</span>
              <span class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</span>
              ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}
              ${p.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
            </div>${specs?`<div style="margin-top:6px">${specs}</div>`:''}
          </div>
        </div></div>`);
        card.querySelectorAll('[data-openprofile]').forEach(el => el.onclick = () => openProfile(el.dataset.openprofile));
        feed.appendChild(card);
      });
    }
    if (d.posts.length) { section(t('search_sec_posts')); d.posts.forEach(p => feed.appendChild(postCard(p))); }
    if (d.shortages.length) { section(t('search_sec_shortages')); d.shortages.forEach(s => feed.appendChild(shortageCard(s))); }
    if (d.prices.length) {
      section(t('search_sec_prices'));
      d.prices.forEach(pr => feed.appendChild(el(`<div class="card"><div class="row">
        <span class="post-author">${esc(pr.bezeichnung)}</span><span class="handle">${esc(pr.wirkstoff||'')}</span>
        <span class="sp" style="flex:1"></span><span><b>€ ${fmtMoney(pr.aep)}</b> ${trendStr(pr.trend_pct)}</span></div>
        <div class="muted">${esc(pr.supplier)} · ${esc(provLabel(pr.provenance))}</div></div>`)));
    }
    if (d.rabatte.length) { section(t('search_sec_rabatte')); d.rabatte.forEach((r,i) => { r.rank = i+1; feed.appendChild(rabattCard(r)); }); }
    if (d.exchange && d.exchange.length) { section(t('nav_exchange')); d.exchange.forEach(e => feed.appendChild(exchangeCard(e))); }
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

function editProfileForm(p) {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  const specs = (p.specializations || []).join(', ');
  const initials = (p.display_name||'?').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  // Aktueller Zustand von Profil-/Titelbild: undefined = unverändert, '' = entfernt, data-URL = neu.
  let avatar = undefined, cover = undefined;
  const form = el(`<div class="card">
    <div class="row"><h1 style="flex:1">${esc(t('pf_edit'))}</h1><button class="ghost small" data-cancel>${esc(t('cm_cancel'))}</button></div>
    <label>${esc(t('ep_cover'))}</label>
    <div class="profile-cover" id="ep_cov_prev" style="${p.cover_url?`background-image:url('${esc(p.cover_url)}')`:''}"></div>
    <div class="row" style="align-items:center;gap:12px;margin:6px 0 4px">
      <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px">${esc(t('ep_cover_pick'))}<input type="file" id="ep_covfile" accept="image/*" style="display:none"></label>
      <button type="button" class="ghost small" id="ep_covclear"${p.cover_url?'':' style="display:none"'}>${esc(t('ep_photo_remove'))}</button>
    </div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">${esc(t('ep_cover_hint'))}</div>
    <label>${esc(t('ep_photo'))}</label>
    <div class="row" style="align-items:center;gap:12px;margin-bottom:4px">
      <span class="avatar" id="ep_av_ini"${p.avatar_url?' style="display:none"':''}>${esc(initials)}</span>
      <img id="ep_av_img" alt="" class="avatar" style="object-fit:cover;${p.avatar_url?'':'display:none'}" src="${esc(p.avatar_url||'')}">
      <label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:8px">${esc(t('ep_photo_pick'))}<input type="file" id="ep_avfile" accept="image/*" style="display:none"></label>
      <button type="button" class="ghost small" id="ep_avclear"${p.avatar_url?'':' style="display:none"'}>${esc(t('ep_photo_remove'))}</button>
    </div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">${esc(t('ep_photo_hint'))}</div>
    <label for="ep_name">${esc(t('ep_name'))}</label><input id="ep_name" value="${esc(p.display_name||'')}">
    <label for="ep_title">${esc(t('ep_func'))}</label><input id="ep_title" value="${esc(p.title||'')}" placeholder="${esc(t('ep_func_ph'))}">
    <label for="ep_bio">${esc(t('ep_about'))}</label><textarea id="ep_bio" placeholder="${esc(t('ep_about_ph'))}">${esc(p.bio||'')}</textarea>
    <label for="ep_specs">${esc(t('ep_specs_l'))}</label><input id="ep_specs" value="${esc(specs)}" placeholder="${esc(t('ep_specs_ph'))}">
    <label style="margin-top:8px">${esc(t('ep_opento'))}</label>
    <div class="muted" style="font-size:12px;margin-bottom:4px">${esc(t('ep_opento_hint'))}</div>
    <div id="ep_opento">${OPEN_TO.map(k=>`<label class="ot-check"><input type="checkbox" value="${k}"${(p.open_to||[]).includes(k)?' checked':''}> ${esc(openToLabel(k))}</label>`).join('')}</div>
    <label>${esc(t('ep_region'))}</label>
    <select id="ep_bl"><option value="">${esc(t('ep_none'))}</option>${BUNDESLAENDER.map(x=>`<option value="${x}"${x===(p.bundesland||'')?' selected':''}>${x}</option>`).join('')}</select>
    <div class="muted" style="font-size:12px;margin-top:2px">${esc(t('ep_region_hint'))}</div>
    <label for="ep_web">${esc(t('ep_website'))}</label><input id="ep_web" type="url" value="${esc(p.website||'')}" placeholder="${esc(t('ep_website_ph'))}">
    <label for="ep_pmail">${esc(t('ep_pubmail'))}</label><input id="ep_pmail" type="email" value="${esc(p.public_email||'')}" placeholder="${esc(t('ep_pubmail_ph'))}">
    <label for="ep_phone">${esc(t('ep_phone'))}</label><input id="ep_phone" type="tel" value="${esc(p.phone||'')}" placeholder="${esc(t('ep_phone_ph'))}">
    <div class="muted" style="font-size:12px;margin-top:2px">${esc(t('ep_contact_hint'))}</div>
    <label style="margin-top:10px">${esc(t('ep_exp'))}</label>
    <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(t('ep_exp_hint'))}</div>
    <div id="ep_exp_list"></div>
    <button type="button" class="ghost small" id="ep_exp_add" style="margin-top:2px">${esc(t('ep_exp_add'))}</button>
    <label style="margin-top:10px">${esc(t('ep_edu'))}</label>
    <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(t('ep_edu_hint'))}</div>
    <div id="ep_edu_list"></div>
    <button type="button" class="ghost small" id="ep_edu_add" style="margin-top:2px">${esc(t('ep_edu_add'))}</button>
    <div class="row" style="margin-top:12px"><button id="ep_save">${esc(t('cm_save'))}</button><span class="err" id="ep_err" style="margin-left:10px"></span></div>
  </div>`);
  feed.appendChild(form);
  // Werdegang: wiederholbare Stationen (Rolle Pflicht, Rest optional).
  const expList = document.getElementById('ep_exp_list');
  function addExpRow(e = {}) {
    const row = el(`<div class="exp-edit">
      <div class="row" style="gap:6px">
        <input data-x="role" style="flex:2" placeholder="${esc(t('ep_exp_role_ph'))}" value="${esc(e.role||'')}">
        <input data-x="org" style="flex:2" placeholder="${esc(t('ep_exp_org_ph'))}" value="${esc(e.org||'')}">
        <button type="button" class="ghost small" data-x="del" title="${esc(t('ep_exp_del'))}" aria-label="${esc(t('ep_exp_del'))}">🗑</button>
      </div>
      <div class="row" style="gap:6px;margin-top:4px">
        <input data-x="from" style="flex:1" placeholder="${esc(t('ep_exp_from_ph'))}" value="${esc(e.from||'')}">
        <input data-x="to" style="flex:1" placeholder="${esc(t('ep_exp_to_ph'))}" value="${esc(e.to||'')}">
      </div>
      <input data-x="description" style="margin-top:4px" placeholder="${esc(t('ep_exp_desc_ph'))}" value="${esc(e.description||'')}">
    </div>`);
    row.querySelector('[data-x="del"]').onclick = () => row.remove();
    expList.appendChild(row);
  }
  (p.experience || []).forEach(addExpRow);
  document.getElementById('ep_exp_add').onclick = () => addExpRow();
  // Aus- & Weiterbildung: wiederholbare Einträge (Abschluss Pflicht).
  const eduList = document.getElementById('ep_edu_list');
  function addEduRow(e = {}) {
    const row = el(`<div class="exp-edit">
      <div class="row" style="gap:6px">
        <input data-x="degree" style="flex:2" placeholder="${esc(t('ep_edu_degree_ph'))}" value="${esc(e.degree||'')}">
        <button type="button" class="ghost small" data-x="del" title="${esc(t('ep_edu_del'))}" aria-label="${esc(t('ep_edu_del'))}">🗑</button>
      </div>
      <div class="row" style="gap:6px;margin-top:4px">
        <input data-x="school" style="flex:2" placeholder="${esc(t('ep_edu_school_ph'))}" value="${esc(e.school||'')}">
        <input data-x="year" style="flex:1" placeholder="${esc(t('ep_edu_year_ph'))}" value="${esc(e.year||'')}">
      </div>
    </div>`);
    row.querySelector('[data-x="del"]').onclick = () => row.remove();
    eduList.appendChild(row);
  }
  (p.education || []).forEach(addEduRow);
  document.getElementById('ep_edu_add').onclick = () => addEduRow();
  const avImg = document.getElementById('ep_av_img'), avIni = document.getElementById('ep_av_ini'), avClear = document.getElementById('ep_avclear');
  document.getElementById('ep_avfile').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      avatar = await fileToDataUrl(f, 400);
      avImg.src = avatar; avImg.style.display='block'; avIni.style.display='none'; avClear.style.display='inline-block';
      document.getElementById('ep_err').textContent='';
    } catch(e){ document.getElementById('ep_err').textContent = e.message; }
  };
  avClear.onclick = () => {
    avatar = ''; avImg.style.display='none'; avImg.src=''; avIni.style.display='inline-flex'; avClear.style.display='none';
    document.getElementById('ep_avfile').value='';
  };
  const covPrev = document.getElementById('ep_cov_prev'), covClear = document.getElementById('ep_covclear');
  document.getElementById('ep_covfile').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      cover = await fileToDataUrl(f, 1200);
      covPrev.style.backgroundImage = `url('${cover}')`; covClear.style.display='inline-block';
      document.getElementById('ep_err').textContent='';
    } catch(e){ document.getElementById('ep_err').textContent = e.message; }
  };
  covClear.onclick = () => {
    cover = ''; covPrev.style.backgroundImage=''; covClear.style.display='none';
    document.getElementById('ep_covfile').value='';
  };
  document.getElementById('ep_save').onclick = async () => {
    try {
      const experience = [...expList.querySelectorAll('.exp-edit')].map(row => {
        const get = x => (row.querySelector(`[data-x="${x}"]`).value || '').trim();
        return { role: get('role'), org: get('org'), from: get('from'), to: get('to'), description: get('description') };
      }).filter(e => e.role);
      const education = [...eduList.querySelectorAll('.exp-edit')].map(row => {
        const get = x => (row.querySelector(`[data-x="${x}"]`).value || '').trim();
        return { degree: get('degree'), school: get('school'), year: get('year') };
      }).filter(e => e.degree);
      const openTo = [...document.querySelectorAll('#ep_opento input:checked')].map(c => c.value);
      const payload = {
        displayName: v('ep_name'), title: v('ep_title'), bio: v('ep_bio'), specializations: v('ep_specs'), bundesland: v('ep_bl'), website: v('ep_web'), publicEmail: v('ep_pmail'), phone: v('ep_phone'), experience, education, openTo,
      };
      if (avatar !== undefined) payload.avatarUrl = avatar;
      if (cover !== undefined) payload.coverUrl = cover;
      await api('POST','/api/profile', payload);
      const meData = await api('GET','/api/me'); me = meData.profile;
      renderWhoami();
      openProfile(p.handle);
    } catch(e){ document.getElementById('ep_err').textContent = e.message; }
  };
  form.querySelector('[data-cancel]').onclick = () => openProfile(p.handle);
}

async function openProfile(handle) {
  setDocTitle('@' + handle);
  if (!handle) return;
  const feed = document.getElementById('feed');
  // Tab-Markierung entfernen (wir sind auf einer Detailseite)
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET',`/api/profiles/${encodeURIComponent(handle)}/page`);
    const p = d.profile;
    const initials = (p.display_name||'?').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
    const specs = (p.specializations||[]).map(s=>{
      const e = (d.endorsements && d.endorsements[s]) || { count:0, mine:false };
      const cnt = e.count ? ` <b>${e.count}</b>` : '';
      if (d.is_self) return `<span class="spec">${esc(s)}${cnt}</span>`;
      return `<button class="spec spec-endorse${e.mine?' spec-endorsed':''}" data-endorse="${esc(s)}" title="${esc(t('en_hint'))}">${e.mine?'✓ ':'+ '}${esc(s)}${cnt}</button>`;
    }).join(' ');
    // Werdegang/Berufserfahrung als eigene Sektion (nur wenn vorhanden).
    const expHtml = (p.experience && p.experience.length) ? `
      <div class="exp-section">
        <div class="exp-head">💼 ${esc(t('pf_experience'))}</div>
        ${p.experience.map(e => {
          const when = [e.from, e.to].filter(Boolean).join(' – ');
          return `<div class="exp-item">
            <div class="exp-role">${esc(e.role)}${e.org?` <span class="muted">· ${esc(e.org)}</span>`:''}</div>
            ${when?`<div class="muted" style="font-size:13px">${esc(when)}</div>`:''}
            ${e.description?`<div style="font-size:14px;margin-top:2px">${esc(e.description)}</div>`:''}
          </div>`;
        }).join('')}
      </div>` : '';
    const eduHtml = (p.education && p.education.length) ? `
      <div class="exp-section">
        <div class="exp-head">🎓 ${esc(t('pf_education'))}</div>
        ${p.education.map(e => `<div class="exp-item">
            <div class="exp-role">${esc(e.degree)}${e.school?` <span class="muted">· ${esc(e.school)}</span>`:''}</div>
            ${e.year?`<div class="muted" style="font-size:13px">${esc(e.year)}</div>`:''}
          </div>`).join('')}
      </div>` : '';
    feed.innerHTML = '';
    const head = el(`<div class="card">
      <div class="row"><button class="ghost small" data-back>${esc(t('post_back'))}</button><span class="sp" style="flex:1"></span><button class="ghost small" data-shareprofile title="${esc(t('pc_share'))}">${esc(t('pc_share'))}</button></div>
      <div class="profile-cover${p.cover_url?'':' profile-cover-ph'}" style="margin-top:10px${p.cover_url?`;background-image:url('${esc(p.cover_url)}')`:''}"></div>
      <div class="profile-avatar-wrap">
        ${p.avatar_url?`<img class="avatar profile-avatar" style="object-fit:cover" alt="${esc(p.display_name||'')}" src="${esc(p.avatar_url)}">`:`<span class="avatar profile-avatar">${esc(initials)}</span>`}
      </div>
      <div class="profile-idblock">
        <div class="row" style="align-items:center">
          <span class="post-author" tabindex="-1" data-pftitle style="font-size:20px">${esc(p.display_name||t('ex_unknown'))}</span>
          ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}
          ${p.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
          ${p.premium?`<span class="premium-badge" title="${esc(t('pc_premium'))}">${esc(t('pc_premium'))}</span>`:''}
          ${p.account_type?`<span class="spec" style="margin-left:2px">${esc(acctLabel(p.account_type))}</span>`:''}
        </div>
        <div class="handle">@${esc(p.handle)}</div>
        ${p.title?`<div class="muted">${esc(p.title)}</div>`:''}
        ${p.bundesland?`<div class="muted" style="font-size:13px">📍 ${esc(p.bundesland)}</div>`:''}
        ${p.website?`<div style="font-size:13px;margin-top:2px">🔗 <a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer nofollow" class="mention">${esc(prettyUrl(p.website))}</a></div>`:''}
        ${p.public_email?`<div style="font-size:13px;margin-top:2px">📧 <a href="mailto:${encodeURIComponent(p.public_email)}" class="mention">${esc(p.public_email)}</a></div>`:''}
        ${p.phone?`<div style="font-size:13px;margin-top:2px">📞 <a href="tel:${encodeURIComponent(p.phone.replace(/[^0-9+]/g,''))}" class="mention">${esc(p.phone)}</a></div>`:''}
      </div>
      ${p.bio?`<div class="post-body">${esc(p.bio)}</div>`:''}
      ${(p.open_to&&p.open_to.length)?`<div class="opento-row">🤝 <b>${esc(t('pf_opento'))}:</b> ${p.open_to.filter(k=>OPEN_TO.includes(k)).map(k=>`<button class="opento-badge clickable" data-opento="${esc(k)}" title="${esc(t('ot_discover_hint'))}">${esc(openToLabel(k))}</button>`).join(' ')}</div>`:''}
      ${specs?`<div style="margin-top:8px">${specs}</div>`:''}
      ${expHtml}
      ${eduHtml}
      <div class="row" style="margin-top:12px;gap:18px">
        <span><b>${d.post_count}</b> <span class="muted">${esc(nlabel(d.post_count,'pf_post_one','pf_posts'))}</span></span>
        <span class="clickable" data-followers><b>${d.follower_count}</b> <span class="muted">${esc(nlabel(d.follower_count,'pf_follower_one','pf_followers'))}</span></span>
        <span class="clickable" data-following><b>${d.following_count}</b> <span class="muted">${esc(t('pf_following'))}</span></span>
        ${d.best_answers?`<span title="${esc(t('pf_best_title'))}"><b>🏆 ${d.best_answers}</b> <span class="muted">${esc(nlabel(d.best_answers,'pf_best_one','pf_best'))}</span></span>`:''}
        <span class="sp" style="flex:1"></span>
        ${d.is_self?`<button class="ghost small" data-activity>${esc(t('pf_activity'))}</button> <button class="ghost small" data-appts>${esc(t('vc_my'))}</button> <button class="ghost small" data-edit>${esc(t('pf_edit'))}</button>`:`<button class="ghost small" data-dm>${esc(t('pf_dm'))}</button> <button class="${d.is_following?'ghost ':''}small" data-togglefollow>${d.is_following?esc(t('pf_unfollow')):esc(t('pf_follow'))}</button>${d.profile&&d.profile.premium?` <button class="small" data-bookvc>${esc(t('vc_book'))}</button>`:''} <button class="ghost small" data-togglemute>${d.is_muted?esc(t('pf_unmute')):esc(t('pf_mute'))}</button>`}
      </div>
      ${d.is_self ? (() => {
        const c = profileCompleteness(p);
        if (c.pct >= 100) return `<div class="pfc-done">${esc(t('pfc_complete'))}</div>`;
        const missing = c.items.filter(i => !i.done);
        return `<div class="pfc">
          <div class="row" style="align-items:center;gap:8px">
            <b>${esc(t('pfc_title_head'))}</b><span class="sp" style="flex:1"></span><b>${c.pct}%</b>
          </div>
          <div class="pfc-bar"><span style="width:${c.pct}%"></span></div>
          <div class="muted" style="font-size:13px;margin:4px 0 6px">${esc(ti('pfc_missing', { n: missing.length }))}</div>
          <div>${missing.map(i => `<span class="spec">➕ ${esc(i.label)}</span>`).join(' ')}</div>
          <div class="row" style="margin-top:8px"><button class="small" data-edit>${esc(t('pfc_cta'))}</button></div>
        </div>`;
      })() : ''}
      ${d.is_self ? `<div class="pv">
        <div class="row" style="align-items:center;gap:8px"><b>👀 ${esc(t('pv_title'))}</b><span class="sp" style="flex:1"></span><b>${d.viewer_count}</b></div>
        ${d.viewer_count ? `<div class="muted" style="font-size:12px;margin:2px 0 6px">${esc(t('pv_hint'))}</div>
          <div class="pv-list">${d.viewers.map(v => `<button class="pv-item" data-openprofile="${esc(v.handle)}" title="@${esc(v.handle)}">
            ${avatarHtml(v, 30, false)}<span class="pv-name">${esc(v.display_name||('@'+v.handle))}</span><span class="muted" style="font-size:12px">· ${relTime(v.viewed_at)}</span>
          </button>`).join('')}</div>`
        : `<div class="muted" style="font-size:13px">${esc(t('pv_none'))}</div>`}
      </div>` : ''}
    </div>`);
    head.querySelector('[data-back]').onclick = () => { tab='public'; document.querySelector('.tabs button[data-tab="public"]').classList.add('active'); loadTab(); };
    const spb = head.querySelector('[data-shareprofile]');
    if (spb) spb.onclick = async () => {
      const url = location.origin + '/?profile=' + encodeURIComponent(p.handle);
      try { await navigator.clipboard.writeText(url); spb.textContent = t('pc_copied'); setTimeout(()=>{ spb.textContent = t('pc_share'); }, 1500); }
      catch { prompt(t('copy_link_fb'), url); }
    };
    head.querySelectorAll('[data-edit]').forEach(eb => { eb.onclick = () => editProfileForm(p); });
    const ab = head.querySelector('[data-activity]');
    if (ab) ab.onclick = openMyActivity;
    head.querySelector('[data-followers]').onclick = () => openFollowList(p.handle, 'followers');
    head.querySelector('[data-following]').onclick = () => openFollowList(p.handle, 'following');
    head.querySelectorAll('[data-opento]').forEach(b => b.onclick = () => openDiscoverOpenTo(b.dataset.opento));
    head.querySelectorAll('.pv-item[data-openprofile]').forEach(b => b.onclick = () => openProfile(b.dataset.openprofile));
    head.querySelectorAll('[data-endorse]').forEach(b => b.onclick = async () => {
      const skill = b.dataset.endorse;
      try {
        const r = await api('POST', `/api/profiles/${encodeURIComponent(p.handle)}/endorse`, { skill });
        b.classList.toggle('spec-endorsed', r.mine);
        b.innerHTML = `${r.mine?'✓ ':'+ '}${esc(skill)}${r.count?` <b>${r.count}</b>`:''}`;
      } catch(e){ alert(e.message); }
    });
    const tf = head.querySelector('[data-togglefollow]');
    if (tf) tf.onclick = async () => {
      try { await api('POST', d.is_following?'/api/unfollow':'/api/follow', { handle:p.handle }); openProfile(handle); }
      catch(e){ alert(e.message); }
    };
    const dmb = head.querySelector('[data-dm]');
    if (dmb) dmb.onclick = async () => {
      try { const r = await api('POST','/api/dm/start',{ handle:p.handle }); openDmThread(r.thread.id); }
      catch(e){ alert(e.message); }
    };
    const tm = head.querySelector('[data-togglemute]');
    if (tm) tm.onclick = async () => {
      try { await api('POST', d.is_muted?'/api/unmute':'/api/mute', { handle:p.handle }); openProfile(handle); }
      catch(e){ alert(e.message); }
    };
    const apptsBtn = head.querySelector('[data-appts]');
    if (apptsBtn) apptsBtn.onclick = () => openAppointments();
    const bookBtn = head.querySelector('[data-bookvc]');
    if (bookBtn) bookBtn.onclick = () => openBookVideocall(p.handle, p.display_name);
    feed.appendChild(head);
    startDetailView(head.querySelector('[data-pftitle]'));
    // Eigenes Profil: Stummgeschaltete verwalten (aufklappbar, mit „aufheben").
    if (d.is_self && d.muted_count > 0) {
      const mc = el(`<div class="card"><button class="linklike small" data-mtoggle aria-expanded="false">🔇 ${esc(ti('pf_muted_title',{n:d.muted_count}))} ▸</button><div class="hidden" data-mbox style="margin-top:6px"></div></div>`);
      const mbox = mc.querySelector('[data-mbox]'); const mtog = mc.querySelector('[data-mtoggle]');
      let loaded = false;
      mtog.onclick = async () => {
        const open = mbox.classList.toggle('hidden') === false;
        mtog.setAttribute('aria-expanded', String(open));
        mtog.textContent = `🔇 ${ti('pf_muted_title',{n:d.muted_count})} ${open?'▾':'▸'}`;
        if (open && !loaded) {
          loaded = true;
          try {
            const r = await api('GET','/api/muted');
            mbox.innerHTML = '';
            (r.muted||[]).forEach(m => {
              const row = el(`<div class="comment"><div class="row" style="align-items:baseline"><b class="clickable" data-openprofile="${esc(m.handle)}">${esc(m.display_name||('@'+m.handle))}</b> <span class="handle clickable" data-openprofile="${esc(m.handle)}">@${esc(m.handle)}</span><span class="sp" style="flex:1"></span><button class="ghost small" data-unmute="${esc(m.handle)}">${esc(t('pf_unmute'))}</button></div></div>`);
              row.querySelectorAll('[data-openprofile]').forEach(el2 => el2.onclick = () => openProfile(el2.dataset.openprofile));
              row.querySelector('[data-unmute]').onclick = async (ev) => { ev.target.disabled = true; try { await api('POST','/api/unmute',{ handle: m.handle }); row.remove(); } catch(e){ alert(e.message); ev.target.disabled = false; } };
              mbox.appendChild(row);
            });
          } catch(e){ mbox.textContent = e.message; }
        }
      };
      feed.appendChild(mc);
    }
    if (d.is_self && !p.verified) {
      const vcard = el('<div class="card"></div>');
      feed.appendChild(vcard);
      renderVerifyCard(vcard);
    }
    if (d.is_self) {
      const pcard = el(`<div class="card"><div class="row"><b style="flex:1">${esc(t('pr_title'))}</b><button class="small" id="go_premium">${esc(t('ac_premium'))}</button></div></div>`);
      pcard.querySelector('#go_premium').onclick = openPremium;
      feed.appendChild(pcard);
      const tcard = el(`<div class="card"><div class="row"><div style="flex:1"><b>${esc(t('th_nav'))}</b><div class="muted" style="font-size:13px">${esc(t('th_sub'))}</div></div><button class="small" id="go_team">${esc(t('tm_open'))}</button></div></div>`);
      tcard.querySelector('#go_team').onclick = openTeamHub;
      feed.appendChild(tcard);
      const dcard = el(`<div class="card"><b>${esc(t('ac_title'))}</b>
        <div class="muted" style="margin-top:4px">${esc(t('ac_export_d'))}</div>
        <div style="margin-top:8px"><button class="ghost small" id="dl_export">${esc(t('ac_export_btn'))}</button></div>
        <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
          <b style="font-size:0.95em">${esc(t('ac_pw_title'))}</b>
          <input id="pw_old" type="password" placeholder="${esc(t('ac_pw_old'))}" style="margin-top:6px">
          <input id="pw_new" type="password" placeholder="${esc(t('ac_pw_new'))}" style="margin-top:6px">
          <div class="row" style="margin-top:8px"><button class="small" id="pw_go">${esc(t('ac_pw_title'))}</button><span id="pw_msg" style="margin-left:8px"></span></div>
        </div>
        <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
          <b style="font-size:0.95em">${esc(t('ac_rc_title'))}</b>
          <div class="muted" style="margin-top:4px" id="rc_remaining">—</div>
          <div class="row" style="margin-top:8px"><button class="ghost small" id="rc_regen">${esc(t('ac_rc_regen'))}</button><span class="muted" style="margin-left:8px;font-size:0.85em">${esc(t('ac_rc_warn'))}</span></div>
        </div>
        <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
          <b style="font-size:0.95em;color:var(--crit-fg)">${esc(t('ac_del_title'))}</b>
          <div class="muted" style="margin-top:4px">${esc(t('ac_del_d'))}</div>
          <div class="row" style="margin-top:8px"><button class="ghost small" id="acc_del" style="color:var(--crit-fg);border-color:var(--crit-fg)">${esc(t('ac_del_btn'))}</button></div>
        </div></div>`);
      // Verbleibende Wiederherstellungscodes anzeigen + Neu-Erzeugung (invalidiert alte).
      (async () => {
        try {
          const rc = await api('GET','/api/recovery-codes');
          const n = rc.remaining;
          const el2 = dcard.querySelector('#rc_remaining');
          if (el2) el2.textContent = n === 0 ? t('ac_rc_remaining_zero') : (n === 1 ? t('ac_rc_remaining_one') : ti('ac_rc_remaining', { n }));
        } catch { /* still lassen */ }
      })();
      dcard.querySelector('#rc_regen').onclick = async () => {
        try { const r = await api('POST','/api/recovery-codes/regenerate'); if (r && r.codes) recoveryCodesScreen(r.codes, () => openProfile(me.handle)); }
        catch(e){ alert(e.message); }
      };
      dcard.querySelector('#acc_del').onclick = async () => {
        if (!confirm(t('ac_del_confirm'))) return;
        const pwd = prompt(t('ac_del_pw'));
        if (!pwd) return;
        try { await api('POST','/api/me/delete',{ password: pwd }); alert(t('ac_del_done')); localStorage.removeItem('apo_token'); location.reload(); }
        catch(e){ alert(e.message); }
      };
      dcard.querySelector('#pw_go').onclick = async () => {
        const msg = dcard.querySelector('#pw_msg');
        try { await api('POST','/api/me/password',{ oldPassword:v('pw_old'), newPassword:v('pw_new') });
          msg.style.color='var(--green)'; msg.textContent=t('ac_pw_ok'); dcard.querySelector('#pw_old').value=''; dcard.querySelector('#pw_new').value='';
        } catch(e){ msg.style.color='var(--crit-fg)'; msg.textContent=e.message; }
      };
      dcard.querySelector('#dl_export').onclick = async () => {
        try {
          const data = await api('GET','/api/me/export');
          const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = 'apopulse-meine-daten.json'; link.click();
          URL.revokeObjectURL(url);
        } catch(e){ alert(e.message); }
      };
      feed.appendChild(dcard);
    }
    // Offene Biete/Suche der Apotheke: macht die Apotheke als Bezugsquelle/Nachfrager sichtbar
    // (Netzwerk-Nutzen). Kontakt läuft wie im Austausch per DM; Klick springt zum Eintrag.
    if (d.exchange_entries && d.exchange_entries.length) {
      const exCard = el(`<div class="card"><div class="row"><b style="flex:1">${esc(t('nav_exchange'))}</b><button class="ghost small" data-exall>${esc(t('sp_exch_go'))} ›</button></div>
        ${d.exchange_entries.map(e => {
          const isB = e.kind === 'biete';
          const badge = isB
            ? `<span style="background:var(--ok-bg);color:var(--ok-fg);border:1px solid var(--ok-bd);border-radius:999px;padding:1px 8px;font-weight:700;font-size:12px">${esc(t('ex_badge_biete'))}</span>`
            : `<span style="background:var(--warn-bg);color:var(--warn-fg);border:1px solid var(--warn-bd);border-radius:999px;padding:1px 8px;font-weight:700;font-size:12px">${esc(t('ex_badge_suche'))}</span>`;
          const loc = [e.ort, e.bundesland].filter(Boolean).join(', ');
          return `<div class="comment clickable" data-exq="${esc(e.bezeichnung)}" data-exk="${esc(e.kind)}">${badge} <b>${esc(e.bezeichnung)}</b>${e.menge?` <span class="muted">· ${esc(t('ex_qty'))} ${esc(e.menge)}</span>`:''}${loc?` <span class="muted" style="font-size:12px">· 📍 ${esc(loc)}</span>`:''} <span class="ovtile-go" aria-hidden="true">›</span></div>`;
        }).join('')}</div>`);
      exCard.querySelector('[data-exall]').onclick = () => goTab('exchange');
      exCard.querySelectorAll('[data-exq]').forEach(row => row.onclick = () => {
        exchangeMine = false; exchangeFilter = row.dataset.exk; exchangeQuery = row.dataset.exq; exchangeBL = ''; goTab('exchange');
      });
      feed.appendChild(exCard);
    }
    feed.appendChild(recommendationsCard(d, p.handle));
    if (!d.posts.length) feed.appendChild(el(`<div class="card muted">${esc(t('pf_no_posts'))}</div>`));
    d.posts.forEach(post => feed.appendChild(postCard(post)));
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

// Empfehlungen-Karte für ein Profil: Liste + (für Fremde) Schreib-Formular.
function recommendationsCard(d, handle) {
  const recs = d.recommendations || [];
  const card = el(`<div class="card">
    <div class="row" style="align-items:center"><b style="flex:1">💬 ${esc(t('rec_title'))}${recs.length?` (${recs.length})`:''}</b>
      ${d.can_recommend?`<button class="ghost small" data-recwrite>${esc(d.my_recommendation?t('rec_edit'):t('rec_write'))}</button>`:''}
    </div>
    ${d.can_recommend?`<div data-recform class="hidden" style="margin-top:8px">
      <textarea data-recbody maxlength="600" placeholder="${esc(t('rec_ph'))}">${esc(d.my_recommendation||'')}</textarea>
      <div class="row" style="margin-top:6px"><button class="small" data-recsave>${esc(t('rec_save'))}</button><span class="err" data-recerr style="margin-left:8px"></span></div>
    </div>`:''}
    <div data-reclist style="margin-top:8px"></div>
  </div>`);
  const list = card.querySelector('[data-reclist]');
  const draw = (items) => {
    if (!items.length) { list.innerHTML = `<div class="muted" style="font-size:14px">${esc(t('rec_none'))}</div>`; return; }
    list.innerHTML = '';
    items.forEach(r => {
      const a = r.author || {};
      const row = el(`<div class="rec-item">
        <div class="row" style="align-items:center">${avatarHtml(a, 34)}
          <div style="flex:1;min-width:0">
            <span class="post-author clickable" data-openprofile="${esc(a.handle||'')}">${esc(a.display_name||t('ex_unknown'))}</span>
            ${a.title?`<div class="muted" style="font-size:12px">${esc(a.title)}</div>`:''}
          </div>
          <span class="muted" style="font-size:12px">${relTime(r.created_at)}</span>
          ${r.can_remove?`<button class="ghost small" data-recdel="${esc(r.id)}" title="${esc(t('rec_remove'))}" aria-label="${esc(t('rec_remove'))}" style="margin-left:6px">🗑</button>`:''}
        </div>
        <div class="rec-body">${esc(r.body)}</div>
      </div>`);
      row.querySelectorAll('[data-openprofile]').forEach(el => el.onclick = () => openProfile(el.dataset.openprofile));
      const del = row.querySelector('[data-recdel]');
      if (del) del.onclick = async () => {
        if (!confirm(t('rec_remove_confirm'))) return;
        try { await api('POST', `/api/recommendations/${encodeURIComponent(del.dataset.recdel)}/remove`); openProfile(handle); }
        catch(e){ alert(e.message); }
      };
      list.appendChild(row);
    });
  };
  draw(recs);
  const wbtn = card.querySelector('[data-recwrite]');
  if (wbtn) {
    const form = card.querySelector('[data-recform]');
    wbtn.onclick = () => { form.classList.toggle('hidden'); if (!form.classList.contains('hidden')) card.querySelector('[data-recbody]').focus(); };
    card.querySelector('[data-recsave]').onclick = async () => {
      const body = card.querySelector('[data-recbody]').value;
      try { await api('POST', `/api/profiles/${encodeURIComponent(handle)}/recommend`, { body }); openProfile(handle); }
      catch(e){ card.querySelector('[data-recerr]').textContent = e.message; }
    };
  }
  return card;
}

// Follower- bzw. Folge-Liste eines Profils.
async function openFollowList(handle, which) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET',`/api/profiles/${encodeURIComponent(handle)}/${which}`); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card"><div><button class="ghost small" data-back>${esc(t('fl_back'))}</button></div>
    <h1 style="margin:8px 0 0">${which==='followers'?esc(t('fl_h_followers')):esc(t('fl_h_following'))}</h1>
    <div class="muted">${which==='followers'?esc(ti('fl_who_followers',{h:d.handle})):esc(ti('fl_who_following',{h:d.handle}))} · ${d.people.length}</div></div>`);
  head.querySelector('[data-back]').onclick = () => openProfile(handle);
  feed.appendChild(head);
  if (!d.people.length) { feed.appendChild(which==='followers'
    ? emptyState({ icon:'👥', title:t('fl_none_fr_t'), text:t('fl_none_fr_s') })
    : emptyState({ icon:'👥', title:t('fl_none_fg_t'), text:t('fl_none_fg_s') })); return; }
  d.people.forEach(p => {
    const specs = (p.specializations||[]).map(s=>`<span class="spec">${esc(s)}</span>`).join(' ');
    const card = el(`<div class="card"><div class="row" style="align-items:baseline">
      <span class="post-author clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name||t('ex_unknown'))}</span>
      <span class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</span>
      ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}${p.verified?'<span class="verified">✔</span>':''}
      <span class="sp" style="flex:1"></span>
      ${p.is_self?'':`<button class="${p.is_following?'ghost ':''}small" data-follow="${esc(p.handle)}" data-on="${p.is_following?'1':'0'}">${p.is_following?esc(t('fl_following_btn')):esc(t('pf_follow'))}</button>`}
    </div>${p.title?`<div class="muted" style="font-size:13px;margin-top:2px">${esc(p.title)}</div>`:''}${specs?`<div style="margin-top:6px">${specs}</div>`:''}</div>`);
    card.querySelectorAll('[data-openprofile]').forEach(el => el.onclick = () => openProfile(el.dataset.openprofile));
    const fb = card.querySelector('[data-follow]');
    if (fb) fb.onclick = async () => {
      const on = fb.dataset.on === '1';
      try { await api('POST', on?'/api/unfollow':'/api/follow', { handle: fb.dataset.follow });
        fb.dataset.on = on?'0':'1'; fb.textContent = on?t('pf_follow'):t('fl_following_btn'); fb.classList.toggle('ghost', !on);
      } catch(e){ alert(e.message); }
    };
    feed.appendChild(card);
  });
}

// „Offen für"-Entdecken: Kolleg:innen, die für dieselbe Kategorie offen sind.
async function openDiscoverOpenTo(key) {
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  setDocTitle(openToLabel(key));
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET', `/api/discover/open-to/${encodeURIComponent(key)}`); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card"><div><button class="ghost small" data-back>${esc(t('fl_back'))}</button></div>
    <h1 style="margin:8px 0 0">🤝 ${esc(ti('ot_discover_title', { cat: openToLabel(key) }))}</h1>
    <div class="muted">${esc(ti('ot_discover_count', { n: d.people.length }))}</div></div>`);
  head.querySelector('[data-back]').onclick = () => loadTab();
  feed.appendChild(head);
  if (!d.people.length) { feed.appendChild(emptyState({ icon:'🤝', title:t('ot_discover_none_t'), text:t('ot_discover_none_s') })); return; }
  d.people.forEach(p => {
    const badges = (p.open_to||[]).filter(k=>OPEN_TO.includes(k)).map(k=>`<span class="opento-badge${k===key?' opento-badge-hi':''}">${esc(openToLabel(k))}</span>`).join(' ');
    const card = el(`<div class="card"><div class="row" style="align-items:center">
      ${avatarHtml(p, 40)}
      <div style="flex:1;min-width:0">
        <div class="row" style="align-items:center">
          <span class="post-author clickable" data-openprofile="${esc(p.handle)}">${esc(p.display_name||t('ex_unknown'))}</span>
          ${p.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}${p.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
          ${p.account_type&&p.account_type!=='pharmacy'?`<span class="spec" style="margin-left:2px">${esc(acctLabel(p.account_type))}</span>`:''}
        </div>
        <div class="handle clickable" data-openprofile="${esc(p.handle)}">@${esc(p.handle)}</div>
        ${p.title?`<div class="muted" style="font-size:13px">${esc(p.title)}</div>`:''}
        ${p.bundesland?`<div class="muted" style="font-size:13px">📍 ${esc(p.bundesland)}</div>`:''}
      </div>
      <div class="row" style="gap:6px">
        <button class="ghost small" data-msg="${esc(p.handle)}">${esc(t('pf_dm'))}</button>
        <button class="${p.is_following?'ghost ':''}small" data-follow="${esc(p.handle)}" data-on="${p.is_following?'1':'0'}">${p.is_following?esc(t('fl_following_btn')):esc(t('pf_follow'))}</button>
      </div>
    </div><div style="margin-top:6px">${badges}</div></div>`);
    card.querySelectorAll('[data-openprofile]').forEach(el => el.onclick = () => openProfile(el.dataset.openprofile));
    card.querySelector('[data-msg]').onclick = () => messagePerson(p.handle);
    const fb = card.querySelector('[data-follow]');
    if (fb) fb.onclick = async () => {
      const on = fb.dataset.on === '1';
      try { await api('POST', on?'/api/unfollow':'/api/follow', { handle: fb.dataset.follow });
        fb.dataset.on = on?'0':'1'; fb.textContent = on?t('pf_follow'):t('fl_following_btn'); fb.classList.toggle('ghost', !on);
      } catch(e){ alert(e.message); }
    };
    feed.appendChild(card);
  });
}

// Eigene Aktivität an einem Ort: Fragen, Engpass-Meldungen, Austausch-Einträge.
async function openMyActivity() {
  setDocTitle(t('ma_doc'));
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/me/activity'); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  feed.innerHTML = '';
  const head = el(`<div class="card"><div><button class="ghost small" data-back>${esc(t('search_back'))}</button></div>
    <h1 style="margin:8px 0 2px">${esc(t('ma_title'))}</h1>
    <div class="muted">${esc(t('ma_sub'))}</div></div>`);
  head.querySelector('[data-back]').onclick = () => me && openProfile(me.handle);
  feed.appendChild(head);

  // Beitrag-Statistik: Kennzahlen des eigenen Engagements auf einen Blick.
  const st = d.stats || {};
  const kpi = (val, label, color) => `<div style="flex:1;min-width:96px;text-align:center;padding:10px 8px;background:var(--card2,rgba(0,0,0,.03));border-radius:10px">
      <div style="font-size:26px;font-weight:800;line-height:1.1;color:${color||'inherit'}">${val}</div>
      <div class="muted" style="font-size:13px;margin-top:2px">${label}</div></div>`;
  const scard = el(`<div class="card"><div class="row"><b>${esc(t('ma_stats'))}</b></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
      ${kpi(st.posts||0, t('ma_k_posts'))}
      ${kpi(st.questions||0, st.questions_open?`${t('ma_k_questions')} · ${st.questions_open} ${t('ma_open_suffix')}`:t('ma_k_questions'))}
      ${kpi(st.best_answers||0, t('ma_k_best'), st.best_answers?'#0b7f28':null)}
      ${kpi(st.reports||0, t('ma_k_reports'))}
      ${kpi(st.confirms_received||0, t('ma_k_confirms'))}
      ${kpi(st.exchange||0, t('ma_k_exchange'))}
    </div></div>`);
  feed.appendChild(scard);

  // Meine Fragen
  const qOpen = d.questions.filter(q=>!q.answered).length;
  const qcard = el(`<div class="card"><div class="row"><b>${esc(t('ma_q_title'))}</b><span class="sp" style="flex:1"></span><span class="muted" style="font-size:13px">${d.questions.length} ${esc(t('ma_total'))}${qOpen?` · ${qOpen} ${esc(t('ma_open_suffix'))}`:''}</span></div><div data-qs style="margin-top:6px"></div></div>`);
  const qs = qcard.querySelector('[data-qs]');
  if (!d.questions.length) qs.appendChild(el(`<div class="muted" style="font-size:14px">${esc(t('ma_no_q'))}</div>`));
  else d.questions.forEach(q => {
    const row = el(`<div class="comment clickable"><span style="color:${q.answered?'var(--ok-fg)':'var(--info-fg)'};font-weight:700">${q.answered?'✔':'❓'}</span> ${esc((q.body||'').slice(0,90))}${(q.body||'').length>90?'…':''} <span class="muted" style="font-size:12px">· ${q.comment_count||0} ${esc(t('oq_answer_pl'))}</span></div>`);
    row.onclick = () => openPost(q.id);
    qs.appendChild(row);
  });
  feed.appendChild(qcard);

  // Meine Engpass-Meldungen
  const rcard = el(`<div class="card"><div class="row"><b>${esc(t('ma_r_title'))}</b><span class="sp" style="flex:1"></span><span class="muted" style="font-size:13px">${d.reports.length} ${esc(t('ma_total'))}</span></div><div data-rs style="margin-top:6px"></div></div>`);
  const rs = rcard.querySelector('[data-rs]');
  if (!d.reports.length) rs.appendChild(el(`<div class="muted" style="font-size:14px">${esc(t('ma_no_r'))}</div>`));
  else d.reports.forEach(s => {
    const m = watchStatusMeta(s.status);
    const row = el(`<div class="comment clickable">${m.icon} <b>${esc(s.wirkstoff)}</b> <span style="color:${m.color};font-weight:700;font-size:12px">${m.label}</span>${s.confirm_count?` · <span class="muted" style="font-size:12px">${esc(ti('ma_confirmed',{n:s.confirm_count}))}</span>`:''}</div>`);
    row.onclick = () => goTab('shortages');
    rs.appendChild(row);
  });
  feed.appendChild(rcard);

  // Meine Austausch-Einträge
  const ecard = el(`<div class="card"><div class="row"><b>${esc(t('ma_e_title'))}</b><span class="sp" style="flex:1"></span><span class="muted" style="font-size:13px">${d.exchange.length} ${esc(t('ma_total'))}</span></div></div>`);
  if (!d.exchange.length) ecard.appendChild(el(`<div class="muted" style="font-size:14px;margin-top:6px">${esc(t('ma_no_e'))}</div>`));
  else d.exchange.forEach(e => ecard.appendChild(exchangeCard(e)));
  feed.appendChild(ecard);
}

// Zuletzt genutzte Suchbegriffe (nur lokal) — schnelles Wiederholen häufiger Suchen.
function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem('apo_recent_searches') || '[]'); } catch { return []; }
}
function recordRecentSearch(q) {
  q = String(q || '').trim();
  if (!q) return;
  const list = getRecentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  try { localStorage.setItem('apo_recent_searches', JSON.stringify(list.slice(0, 6))); } catch { /* Speicher n/a */ }
}

// Zuletzt angesehene Wirkstoffe (nur lokal im Gerät gespeichert).
function getRecentWirkstoff() {
  try { return JSON.parse(localStorage.getItem('apo_recent_wirkstoff') || '[]'); } catch { return []; }
}
function recordRecentWirkstoff(name) {
  if (!name) return;
  const list = getRecentWirkstoff().filter(w => w.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  try { localStorage.setItem('apo_recent_wirkstoff', JSON.stringify(list.slice(0, 8))); } catch {}
}

// Wirkstoff-Detailseite: alles zu einem Wirkstoff auf einen Blick.
async function openWirkstoff(name) {
  setDocTitle('💊 ' + name);
  if (!name) return;
  const feed = document.getElementById('feed');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/wirkstoff/'+encodeURIComponent(name)); }
  catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); return; }
  recordRecentWirkstoff(d.wirkstoff);
  feed.innerHTML = '';
  const head = el(`<div class="card"><div><button class="ghost small" data-back>${esc(t('search_back'))}</button></div>
    <h1 tabindex="-1" style="margin:8px 0 2px">💊 ${esc(d.wirkstoff)}</h1>
    <div class="muted">${esc(t('wk_sub'))}</div>
    ${d.also_watching >= 1 ? `<div class="muted" style="font-size:13px;margin-top:4px">${esc(d.also_watching === 1 ? t('wk_also_1') : ti('wk_also_n', { n: d.also_watching }))}</div>` : ''}
    <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="${d.watched?'':'ghost '}small" data-watch aria-pressed="${!!d.watched}">${d.watched?esc(t('sc_watched')):esc(t('sc_watch'))}</button><button class="ghost small" data-share title="${esc(t('pc_share'))}">${esc(t('pc_share'))}</button><button class="ghost small" data-wkprint title="${esc(t('wk_print_t'))}">🖨️ ${esc(t('pr_print_btn'))}</button><button class="ghost small" data-wktask title="${esc(t('tk_as_task'))}">${esc(t('tk_as_task'))}</button></div></div>`);
  head.querySelector('[data-wkprint]').onclick = () => printWirkstoff(d);
  head.querySelector('[data-wktask]').onclick = () => { taskPrefill = { title: ti('tk_from_shortage', { w: d.wirkstoff }) }; openTasks(); };
  head.querySelector('[data-back]').onclick = () => goTab('overview');
  const shb = head.querySelector('[data-share]');
  shb.onclick = async () => {
    const url = location.origin + '/?wirkstoff=' + encodeURIComponent(d.wirkstoff);
    try { await navigator.clipboard.writeText(url); shb.textContent = t('pc_copied'); setTimeout(()=>{ shb.textContent=t('pc_share'); }, 1500); }
    catch { prompt(t('copy_link_fb'), url); }
  };
  const wb = head.querySelector('[data-watch]');
  let watched = !!d.watched;
  wb.onclick = async () => {
    wb.disabled = true;
    try {
      if (watched) { await api('DELETE','/api/watchlist/'+encodeURIComponent(d.wirkstoff)); watched = false; }
      else { await api('POST','/api/watchlist',{ wirkstoff: d.wirkstoff }); watched = true; }
      wb.textContent = watched ? t('sc_watched') : t('sc_watch');
      wb.setAttribute('aria-pressed', String(watched));
      wb.classList.toggle('ghost', !watched);
      if (noteCard) renderDetailNote();
    } catch(e){ alert(e.message); }
    wb.disabled = false;
  };
  feed.appendChild(head);
  // Detailseite oben starten (man kommt oft aus einer tief gescrollten Liste/Suche) und den
  // Fokus auf die Überschrift setzen: Screenreader/Tastatur bekommen so mit, dass eine neue
  // Seite geladen ist, und lesen den Wirkstoffnamen vor. Der Ring erscheint nur bei
  // Tastaturnutzung (:focus-visible), stört Maus-Klicks also nicht.
  startDetailView(head.querySelector('h1'));

  // Rabatt-Alarm für diesen Wirkstoff (nur wenn beobachtet): ab X % Rabatt benachrichtigen.
  if (d.watched) {
    const al = el(`<div class="card"><div class="row" style="align-items:center;gap:8px;flex-wrap:wrap">
        <span aria-hidden="true">🔔</span><label style="margin:0">${esc(t('wk_alert_label'))}</label>
        <input type="number" min="1" max="99" value="${d.alert_pct||''}" data-alertpct placeholder="${esc(t('wk_alert_ph'))}" style="width:88px" aria-label="${esc(t('wk_alert_label'))}"><span>%</span>
        <button class="small" data-alertsave>${esc(t('cm_save'))}</button>
        <span class="muted" data-alertmsg style="font-size:13px"></span>
      </div><div class="muted" style="font-size:12px;margin-top:4px">${esc(t('wk_alert_hint'))}</div></div>`);
    al.querySelector('[data-alertsave]').onclick = async () => {
      const v = al.querySelector('[data-alertpct]').value;
      const msg = al.querySelector('[data-alertmsg]');
      try { const r = await api('POST', `/api/watchlist/${encodeURIComponent(d.wirkstoff)}/alert`, { pct: v === '' ? null : Number(v) });
        const cur = (r.items.find(i => i.wirkstoff.trim().toLowerCase() === d.wirkstoff.trim().toLowerCase()) || {}).alert_pct;
        msg.textContent = cur ? ti('wk_alert_saved', { n: cur }) : t('wk_alert_off');
      } catch(e){ msg.textContent = e.message; }
    };
    feed.appendChild(al);
  }

  // Premium: private Notiz zu diesem Wirkstoff — direkt auf der Detailseite (nur wenn beobachtet).
  let noteCard = null;
  function renderDetailNote() {
    if (!d.premium) return;
    if (!noteCard) { noteCard = el(`<div class="card" data-note-card></div>`); head.after(noteCard); }
    noteCard.style.display = watched ? '' : 'none';
    if (!watched) return;
    noteCard.innerHTML = '';
    const label = el(`<div class="muted" style="font-size:13px;margin-bottom:6px">📝 ${esc(t('wk_note_title'))}</div>`);
    const wrap = el(`<div></div>`);
    noteCard.appendChild(label); noteCard.appendChild(wrap);
    const view = () => {
      wrap.innerHTML = '';
      if (d.note) {
        const v = el(`<div class="row" style="gap:6px;align-items:flex-start"><span style="flex:1">${esc(d.note)}</span><button class="linklike small" data-edit>${esc(t('wl_note_edit'))}</button></div>`);
        v.querySelector('[data-edit]').onclick = edit; wrap.appendChild(v);
      } else {
        const a = el(`<button class="linklike small" data-add>${esc(t('wl_note_add'))}</button>`);
        a.onclick = edit; wrap.appendChild(a);
      }
    };
    const edit = () => {
      wrap.innerHTML = '';
      const ed = el(`<div class="row" style="gap:6px"><input class="wl-note-in" value="${esc(d.note||'')}" placeholder="${esc(t('wl_note_ph'))}" maxlength="280" style="flex:1"><button class="small" data-save>${esc(t('wl_note_save'))}</button></div>`);
      wrap.appendChild(ed); const inp = ed.querySelector('.wl-note-in'); inp.focus();
      const save = async () => {
        try { await api('POST', `/api/watchlist/${encodeURIComponent(d.wirkstoff)}/note`, { note: inp.value }); d.note = inp.value.trim(); view(); }
        catch(e){ alert(e.message); }
      };
      ed.querySelector('[data-save]').onclick = save;
      inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    };
    view();
  }
  renderDetailNote();

  // Antibiotic-Stewardship-Wissensecke (nur bei Antibiotika). REIN INFORMATIV,
  // quellenbelegt, ausdrücklich keine patientenindividuelle Therapieempfehlung.
  if (d.amr && d.amr.is_antibiotic) {
    const a = d.amr;
    const panel = el(`<div class="card" style="border-left:4px solid #0b7f28">
      <div class="row"><b>${esc(t('wk_amr_title'))}</b>
        <span class="sp" style="flex:1"></span>
        <span class="muted" style="font-size:12px">${esc(t('wk_amr_tag'))}</span></div>
      <div style="font-size:14px;margin-top:8px">${esc(a.note)}</div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">
        ${(a.sources||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="small" style="display:inline-block;text-decoration:none;border:1px solid var(--line,#ccc);border-radius:8px;padding:6px 10px">🔗 ${esc(s.label)}</a>`).join('')}
        <button class="ghost small" data-forum>${esc(t('wk_amr_forum'))}</button>
        <button class="ghost small" data-pinfo>${esc(t('wk_amr_pinfo'))}</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px;font-style:italic">⚠️ ${esc(a.disclaimer)}</div>
    </div>`);
    panel.querySelector('[data-forum]').onclick = () => openStewardship();
    panel.querySelector('[data-pinfo]').onclick = () => openPatientInfo();
    feed.appendChild(panel);
  }

  const section = (title, count, emptyMsg, render, action = null) => {
    const c = el(`<div class="card"><div class="row"><b>${title}</b><span class="sp" style="flex:1"></span>${action?`<button class="ghost small" data-secact>${esc(action.label)}</button>`:''}<span class="muted" style="font-size:13px">${count}</span></div><div data-body style="margin-top:6px"></div></div>`);
    if (action) c.querySelector('[data-secact]').onclick = action.onClick;
    const body = c.querySelector('[data-body]');
    if (!count) body.appendChild(el(`<div class="muted" style="font-size:14px">${emptyMsg}</div>`));
    else render(body);
    feed.appendChild(c);
  };
  // Aus dem Wirkstoff-Hub heraus direkt ein Angebot/Gesuch anlegen (Formular in
  // Biete/Suche vorbelegt). Nur für Fachkreise — das Backend erzwingt es zusätzlich.
  const canExchange = me && me.account_type !== 'private' && !featBlocked('stock_exchange');
  const startExchange = (kind) => {
    exchangePrefill = { kind, bezeichnung: d.wirkstoff };
    exchangeQuery = ''; exchangeFilter = ''; exchangeBL = ''; exchangeMine = false;
    goTab('exchange');
  };

  // Engpass-Status (+ direkt für diesen Wirkstoff melden)
  const scard = el(`<div class="card"><div class="row"><b>${esc(t('wk_short_title'))}</b><span class="sp" style="flex:1"></span>
    <button class="ghost small" data-report>${esc(t('sh_rep_title'))}</button></div>
    <div data-sbody style="margin-top:6px"></div>
    <div class="hidden" data-sform style="margin-top:8px">
      <label style="font-size:13px">${esc(t('sh_rep_b'))}</label>
      <input data-b placeholder="z.B. ${esc(d.wirkstoff)} 500 mg" value="${esc(d.wirkstoff)}">
      <label style="font-size:13px;margin-top:6px">${esc(t('sh_rep_status'))}</label>
      <select data-s><option value="kritisch">${esc(t('st_krit'))}</option><option value="eingeschraenkt">${esc(t('st_eing'))}</option></select>
      <label style="font-size:13px;margin-top:6px">${esc(t('sh_rep_reason'))}</label>
      <input data-g placeholder="${esc(t('sh_rep_reason_ph'))}">
      <label style="font-size:13px;margin-top:6px">${esc(t('sh_rep_until'))}</label>
      <input data-vb type="date" data-i18n-aria="sh_rep_until_t" aria-label="${esc(t('sh_rep_until_t'))}" title="${esc(t('sh_rep_until_t'))}">
      <div style="margin-top:8px"><button class="small" data-send>${esc(t('wk_send_community'))}</button></div>
      <div class="muted" style="font-size:12px;margin-top:4px">${esc(t('wk_community_note'))}</div>
      <div class="err" data-err></div>
    </div></div>`);
  const sbody = scard.querySelector('[data-sbody]');
  if (!d.shortages.length) sbody.appendChild(el(`<div class="muted" style="font-size:14px">${esc(t('wk_no_short'))}</div>`));
  else d.shortages.forEach(s => {
    const [lab,col] = statusShort(s.status);
    // Erstmeldedatum aus dem Statusverlauf (Fallback: gemeldet_am) — zeigt „seit wann".
    const hist = Array.isArray(s.history) ? s.history.filter(h => h && h.am) : [];
    const firstAm = (hist[0] && hist[0].am) || s.gemeldet_am || null;
    const row = el(`<div class="comment"><span style="background:${col};color:#fff;border-radius:6px;padding:2px 8px;font-size:12px">${lab}</span> <b>${esc(s.bezeichnung)}</b> <span class="muted" style="font-size:12px">· ${esc(provLabel(s.provenance))}${s.grund?' · '+esc(grundLabel(s.grund)):''}${firstAm?' · '+esc(ti('wk_since',{date:fmtDateDe(firstAm)})):''}${s.quelle&&/^https?:\/\//i.test(s.quelle)?` · <a href="${esc(s.quelle)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(t('wk_hist_src'))}${srcDomSuffix(s.quelle)}</a>`:''}</span></div>`);
    // Statusverlauf (nur ab 2 dokumentierten Schritten): macht sichtbar, wie lange und
    // wie stabil der Engpass ist — hilft bei der Entscheidung, ob aktiv beschafft werden
    // muss. Standardmäßig eingeklappt, damit die Detailseite kompakt bleibt.
    if (hist.length >= 2) {
      const toggle = el(`<button class="linklike small" aria-expanded="false" style="margin-top:4px;display:inline-block">📈 ${esc(ti('wk_hist',{n:hist.length}))}</button>`);
      const tl = el(`<div class="hidden" style="margin-top:6px;padding-left:8px;border-left:2px solid var(--line)"></div>`);
      // Neueste Änderung zuerst — konsistent mit dem „Verlauf" auf der Engpass-Karte
      // (dort [...history].reverse()); so lesen beide Ansichten die gleiche Reihenfolge.
      [...hist].reverse().forEach(h => {
        const [hl,hc] = statusShort(h.status);
        const q = h.quelle && /^https?:\/\//i.test(h.quelle)
          ? ` · <a href="${esc(h.quelle)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(t('wk_hist_src'))}${srcDomSuffix(h.quelle)}</a>` : '';
        tl.appendChild(el(`<div style="display:flex;gap:8px;font-size:13px;padding:2px 0;flex-wrap:wrap"><span class="muted" style="min-width:84px">${esc(fmtDateDe(h.am))}</span><span style="color:${hc};font-weight:700">${hl}</span><span class="muted">${q}</span></div>`));
      });
      toggle.onclick = () => { const open = !tl.classList.toggle('hidden'); toggle.setAttribute('aria-expanded', String(open)); };
      row.appendChild(toggle); row.appendChild(tl);
    }
    sbody.appendChild(row);
  });
  const sform = scard.querySelector('[data-sform]');
  scard.querySelector('[data-report]').onclick = () => sform.classList.toggle('hidden');
  scard.querySelector('[data-send]').onclick = async () => {
    const err = scard.querySelector('[data-err]'); err.textContent = '';
    try {
      await api('POST','/api/shortages/report',{ wirkstoff: d.wirkstoff, bezeichnung: scard.querySelector('[data-b]').value.trim(), status: scard.querySelector('[data-s]').value, grund: scard.querySelector('[data-g]').value.trim(), voraussichtlichBis: scard.querySelector('[data-vb]').value || undefined });
      openWirkstoff(d.wirkstoff);
    } catch(e){ err.textContent = e.message; }
  };
  feed.appendChild(scard);
  // Bezugsquellen (biete) — mit Schnell-Aktion „Angebot einstellen"
  section(t('wk_offers_t'), d.exchange.biete.length, t('wk_offers_e'), body => d.exchange.biete.forEach(e => body.appendChild(exchangeCard(e))),
    canExchange ? { label: t('wk_offer_cta'), onClick: () => startExchange('biete') } : null);
  // Gesuche (suche) — mit Schnell-Aktion „Ich suche das"
  section(t('wk_seeks_t'), d.exchange.suche.length, t('wk_seeks_e'), body => d.exchange.suche.forEach(e => body.appendChild(exchangeCard(e))),
    canExchange ? { label: t('sc_seek'), onClick: () => startExchange('suche') } : null);
  // Preise
  section(t('wk_prices_t'), d.prices.length, t('wk_prices_e'), body => d.prices.forEach(g => body.appendChild(priceGroup(g))));
  // Rabatte
  section(t('wk_deals_t'), d.rabatte.length, t('wk_deals_e'), body => d.rabatte.forEach(r => { r.rank = r.rank || 1; body.appendChild(rabattCard(r)); }));
  // Diskussion & Fragen (öffentliche Beiträge, die den Wirkstoff erwähnen) + Compose
  const posts = d.posts || [];
  const dcard = el(`<div class="card"><div class="row"><b>${esc(t('wk_disc_t'))}</b><span class="sp" style="flex:1"></span>
    <button class="ghost small" data-write>${esc(t('wk_write'))}</button></div>
    <div class="hidden" data-wform style="margin-top:8px">
      <textarea data-wt placeholder="${esc(ti('wk_write_ph',{w:d.wirkstoff}))}"></textarea>
      <label style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer;font-size:14px"><input type="checkbox" data-wq style="width:auto;min-height:0"> ${esc(t('wk_ask'))}</label>
      <div style="margin-top:8px"><button class="small" data-wsend>${esc(t('wk_post_public'))}</button></div>
      <div class="err" data-werr></div>
    </div>
    <div data-wbody style="margin-top:8px"></div></div>`);
  const wbody = dcard.querySelector('[data-wbody]');
  if (!posts.length) wbody.appendChild(el(`<div class="muted" style="font-size:14px">${esc(t('wk_no_posts'))}</div>`));
  else posts.forEach(p => wbody.appendChild(postCard(p)));
  const wform = dcard.querySelector('[data-wform]');
  dcard.querySelector('[data-write]').onclick = () => { wform.classList.toggle('hidden'); const ta = dcard.querySelector('[data-wt]'); if (!wform.classList.contains('hidden') && !ta.value) ta.value = d.wirkstoff + ': '; };
  dcard.querySelector('[data-wsend]').onclick = async () => {
    const werr = dcard.querySelector('[data-werr]'); werr.textContent = '';
    const body = dcard.querySelector('[data-wt]').value.trim();
    if (!body) { werr.textContent = t('wk_need_body'); return; }
    try {
      await api('POST','/api/posts',{ body, visibility:'public', kind: dcard.querySelector('[data-wq]').checked ? 'frage' : 'post' });
      openWirkstoff(d.wirkstoff);
    } catch(e){ werr.textContent = e.message; }
  };
  feed.appendChild(dcard);
}

async function renderVerifyCard(card) {
  let s; try { s = await api('GET','/api/verify/me'); } catch { return; }
  if (s.status === 'verifiziert') { card.remove(); return; }
  if (s.status === 'offen') {
    card.innerHTML = `<b>${esc(t('vf_pending_t'))}</b><div class="muted" style="margin-top:4px">${esc(t('vf_pending_s'))}</div>`;
    return;
  }
  const abgelehnt = s.status === 'abgelehnt';
  card.innerHTML = `<b>${esc(t('vf_title'))}</b>
    <div class="muted" style="margin-top:4px">${abgelehnt?esc(t('vf_rejected')):''}${esc(t('vf_desc'))}</div>
    <input id="vf_note" placeholder="${esc(t('vf_note_ph'))}" style="margin-top:8px">
    <div class="row" style="margin-top:8px"><button id="vf_go">${esc(t('vf_apply'))}</button><span class="err" id="vf_err" style="margin-left:8px"></span></div>`;
  card.querySelector('#vf_go').onclick = async () => {
    try { await api('POST','/api/verify/request',{ note: v('vf_note') }); renderVerifyCard(card); }
    catch(e){ card.querySelector('#vf_err').textContent = e.message; }
  };
}

function qBadgeHtml(answered) {
  return `<span style="display:inline-block;background:${answered?'rgba(11,127,40,.12)':'rgba(41,82,204,.12)'};color:${answered?'var(--ok-fg)':'var(--info-fg)'};font-weight:700;font-size:13px;padding:2px 10px;border-radius:999px">${esc(answered?t('pc_answered'):t('pc_question_open'))}</span>`;
}

// Umfrage-Block: Optionen als antippbare Balken mit Ergebnis-Anteil, eigene Stimme markiert.
function pollHtml(p) {
  const poll = p.poll; if (!poll || !Array.isArray(poll.options)) return '';
  const total = poll.total || 0;
  const rows = poll.options.map(o => {
    const n = (poll.counts || {})[o.id] || 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    const mine = poll.my_vote === o.id;
    // Rohe Stimmenzahl neben dem Prozentwert: 40% von 5 ≠ 40% von 200 — wichtig für die
    // Einordnung bei kleinen Fach-Umfragen (Klartext/Transparenz, CLAUDE.md).
    const cntTitle = n === 1 ? t('pl_total_one') : ti('pl_total', { n });
    return `<button class="poll-opt${mine ? ' mine' : ''}" data-pollvote="${esc(o.id)}" aria-pressed="${mine}">
      <span class="poll-bar" style="width:${pct}%"></span>
      <span class="poll-lbl">${esc(o.text)}${mine ? ` <span class="poll-you">${esc(t('pl_you'))}</span>` : ''}</span>
      <span class="poll-pct" title="${esc(cntTitle)}">${total ? n + ' · ' + pct + '%' : ''}</span>
    </button>`;
  }).join('');
  const totalLbl = total === 0 ? t('pl_total_zero') : (total === 1 ? t('pl_total_one') : ti('pl_total', { n: total }));
  return `<div class="poll" data-poll>${rows}<div class="poll-total muted">${esc(totalLbl)}${total ? '' : ' · ' + esc(t('pl_tap'))}</div></div>`;
}
// Eingebettetes Original eines Reposts: kompakt, anklickbar (öffnet das Original).
function repostEmbedHtml(o) {
  if (!o) return '';
  if (o.deleted) return `<div class="repost-embed muted">${esc(t('rp_deleted'))}</div>`;
  const a = o.author || {};
  const img = o.image && /^data:image\//.test(o.image) ? `<img data-zoom src="${o.image}" alt="${esc(t('pc_img_alt'))}" style="max-width:100%;border-radius:8px;margin-top:6px;display:block;cursor:zoom-in" />` : '';
  const pollHint = o.poll ? `<div class="muted" style="font-size:13px;margin-top:4px">${esc(t('rp_poll_hint'))}</div>` : '';
  // Vorschau-Text als reiner Text (kein linkifyMentions): die ganze Einbettung ist EIN
  // anklickbares/tastaturbedienbares Element — verschachtelte Klick-Elemente (Mentions/
  // Hashtags als eigene Buttons) darin wären ungültiges ARIA (Button im Button).
  return `<div class="repost-embed clickable" data-openpost="${esc(o.id)}">
    <div class="row" style="align-items:center">${avatarHtml(a, 28, false)}<span class="post-author">${esc(a.display_name || t('ex_unknown'))}</span><span class="handle">@${esc(a.handle || '?')}</span>${a.verified ? `<span class="verified">${esc(t('pc_verified'))}</span>` : ''}</div>
    <div class="post-body">${esc(o.body)}</div>${img}${pollHint}
  </div>`;
}
// Kleines Autor-Avatar (Bild wenn vorhanden, sonst Initialen) für Feed-Karten.
// link=false: rein dekorativ (z.B. verschachtelt in einem bereits klickbaren Element).
function avatarHtml(a, size = 36, link = true) {
  const ini = (a.display_name||'?').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px;margin-right:9px`;
  const attr = link ? ` class="avatar clickable" data-openprofile="${esc(a.handle||'')}"` : ' class="avatar"';
  if (a.avatar_url) return `<img${attr} alt="" style="object-fit:cover;${st}" src="${esc(a.avatar_url)}">`;
  return `<span${attr} style="${st}">${esc(ini)}</span>`;
}
// Domain einer Quelle (ohne „www.") — für Vertrauen auf einen Blick: eine amtliche
// Quelle (z. B. basg.gv.at) ist so sofort von einer beliebigen unterscheidbar.
function srcDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
// „: <domain>"-Suffix (bereits escaped) für Quellen-Labels — leer, wenn nicht erkennbar.
function srcDomSuffix(url) { const d = srcDomain(url); return d ? ': ' + esc(d) : ''; }
// Quellen-Link fürs Beitrag-/News-Rendering: „🔗 Quelle: <domain>" (Domain nur wenn
// erkennbar). Sicher via target=_blank rel=noopener noreferrer.
function sourceLinkHtml(url) {
  if (!url) return '';
  return `<div style="margin-top:6px"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="mention">${esc(t('pc_source'))}${srcDomSuffix(url)}</a></div>`;
}

function postCard(p) {
  const a = p.author || {};
  const rc = p.reaction_counts || {};
  const mine = me && a.handle === me.handle;
  const card = el(`<div class="card">
    <div class="post-head">
      ${avatarHtml(a)}
      <div class="post-hd-main">
        <div class="post-hd-top">
          <span class="post-author clickable" data-openprofile="${esc(a.handle||'')}">${esc(a.display_name||t('ex_unknown'))}</span>
          ${a.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}
          ${a.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
          ${a.premium?`<span class="premium-badge" title="${esc(t('pc_premium'))}">${esc(t('pc_premium'))}</span>`:''}
          ${a.account_type&&a.account_type!=='pharmacy'?`<span class="spec" style="margin-left:2px">${esc(acctLabel(a.account_type))}</span>`:''}
          ${mine?'':`<button class="${a.is_following?'ghost ':''}small" data-follow="${esc(a.handle)}" data-on="${a.is_following?'1':'0'}" style="margin-left:auto">${a.is_following?esc(t('fl_following_btn')):esc(t('co_follow_btn'))}</button>`}
        </div>
        <div class="post-hd-sub">
          <span class="handle clickable" data-openprofile="${esc(a.handle||'')}">@${esc(a.handle||'?')}</span>
          <span aria-hidden="true">·</span>
          <span title="${esc(p.created_at)}">${relTime(p.created_at)}</span>
        </div>
      </div>
    </div>
    ${p.is_question?`<div style="margin-top:4px" data-qbadge>${qBadgeHtml(p.answered)}</div>`:''}
    ${p.repost_of_post?`<div class="vis" style="margin-top:2px">🔁 ${esc(t('rp_shared'))}</div>`:''}
    ${(p.body||'').trim()||!p.repost_of_post?`<div class="post-body" data-body>${linkifyMentions(p.body)}</div>`:'<div class="post-body" data-body hidden></div>'}
    ${p.poll ? pollHtml(p) : ''}
    ${p.repost_of_post ? repostEmbedHtml(p.repost_of_post) : ''}
    ${p.image && /^data:image\//.test(p.image) ? `<img data-zoom src="${p.image}" alt="${esc(t('pc_img_alt'))}" style="max-width:100%;border-radius:10px;margin-top:8px;display:block;cursor:zoom-in" />` : ''}
    ${sourceLinkHtml(p.source_url)}
    <div class="vis" data-edited ${p.edited_at?'':'style="display:none"'}>${esc(t('pc_edited'))}</div>
    ${refChip(p.ref_summary)}
    <div class="vis">${p.visibility==='public'?esc(t('pc_vis_public')):esc(t('pc_vis_followers'))}</div>
    <div class="reacts">
      ${REACTS.map(([k,keyLab])=>`<button data-react="${k}"${p.my_reaction===k?' class="reacted" aria-pressed="true"':' aria-pressed="false"'}>${esc(t(keyLab))}${rc[k]?` ${rc[k]}`:''}</button>`).join('')}
      <button data-comments>${esc(commentLabel(p.comment_count||0))}</button>
      <button class="ghost small" data-bookmark title="${esc(t('pc_save'))}">${myBookmarks.has(p.id)?esc(t('pc_saved')):esc(t('pc_save'))}</button>
      <button class="ghost small" data-share title="${esc(t('pc_share'))}">${esc(t('pc_share'))}</button>
      ${mine?'':`<button class="ghost small${p.reposted_by_me?' reacted':''}" data-repost aria-pressed="${!!p.reposted_by_me}" title="${esc(t('pc_repost'))}">${esc(p.reposted_by_me?t('pc_reposted_on'):t('pc_repost'))}${p.repost_count?` ${p.repost_count}`:''}</button>`}
      <span class="sp" style="flex:1"></span>
      ${mine ? `<button class="ghost small" data-edit title="${esc(t('pc_edit'))}">${esc(t('pc_edit'))}</button><button class="ghost small" data-del title="${esc(t('pc_delete'))}">${esc(t('pc_delete'))}</button>`
             : `<button class="ghost small" data-report title="${esc(t('pc_report'))}">${esc(t('pc_report'))}</button>`}
    </div>
    <div class="comments hidden" data-cbox>
      <div data-clist></div>
      <div class="row" style="margin-top:8px"><input data-cinput placeholder="${esc(t('pc_reply_ph'))}"><label class="ghost small" style="display:inline-flex;align-items:center;cursor:pointer;padding:7px 10px;border:1px solid var(--line);border-radius:8px" title="${esc(t('co_img'))}">📷<input type="file" data-cimg accept="image/*" style="display:none"></label><button class="small" data-csend>${esc(t('pc_send'))}</button></div>
      <img data-cimgprev data-i18n-alt="a11y_img_preview" alt="Bildvorschau" style="display:none;max-width:140px;border-radius:8px;margin-top:6px" />
    </div>
  </div>`);
  card._post = p; // für Q&A (beste Antwort) im Kommentar-Thread verfügbar machen
  card.querySelectorAll('[data-react]').forEach(btn => btn.onclick = async () => {
    try { await api('POST',`/api/posts/${p.id}/react`,{ type:btn.dataset.react }); loadFeed(); } catch(e){ alert(e.message); }
  });
  // Umfrage: Option antippen stimmt ab / ändert; erneut auf die eigene Option = zurückziehen.
  card.querySelectorAll('[data-pollvote]').forEach(btn => btn.onclick = async () => {
    const opt = btn.dataset.pollvote;
    const retract = p.poll && p.poll.my_vote === opt;
    try { await api('POST',`/api/polls/${p.id}/vote`,{ optionId: retract ? null : opt }); loadFeed(); } catch(e){ alert(e.message); }
  });
  const fb = card.querySelector('[data-follow]');
  if (fb) fb.onclick = async () => { const on = fb.dataset.on === '1'; try { await api('POST', on?'/api/unfollow':'/api/follow', { handle:fb.dataset.follow }); loadFeed(); } catch(e){ alert(e.message);} };
  card.querySelectorAll('[data-openprofile]').forEach(el => { if (el.dataset.openprofile) el.onclick = () => openProfile(el.dataset.openprofile); });
  card.querySelectorAll('[data-hashtag]').forEach(el => el.onclick = () => openHashtag(el.dataset.hashtag));
  const sh = card.querySelector('[data-share]');
  if (sh) sh.onclick = async () => {
    const url = location.origin + '/?post=' + encodeURIComponent(p.id);
    try { await navigator.clipboard.writeText(url); sh.textContent = t('pc_copied'); setTimeout(()=>{ sh.textContent=t('pc_share'); }, 1500); }
    catch { prompt(t('copy_link_fb'), url); }
  };
  // Repost-Umschalter (Ein-Klick im Feed teilen / zurücknehmen).
  const rp = card.querySelector('[data-repost]');
  if (rp) rp.onclick = async () => {
    rp.disabled = true;
    try { await api('POST', `/api/posts/${p.id}/repost`, {}); loadFeed(); }
    catch(e){ rp.disabled = false; alert(e.message); }
  };
  // Klick auf das eingebettete Original öffnet den Originalbeitrag.
  card.querySelectorAll('[data-openpost]').forEach(elp => elp.onclick = () => openPost(elp.dataset.openpost));
  const bm = card.querySelector('[data-bookmark]');
  if (bm) bm.onclick = async () => {
    try {
      const r = await api('POST',`/api/posts/${p.id}/bookmark`);
      if (r.bookmarked) myBookmarks.add(p.id); else myBookmarks.delete(p.id);
      bm.textContent = r.bookmarked ? t('pc_saved') : t('pc_save');
    } catch(e){ alert(e.message); }
  };
  const delb = card.querySelector('[data-del]');
  if (delb) delb.onclick = async () => {
    if (!confirm(t('pc_del_confirm'))) return;
    try { await api('POST',`/api/posts/${p.id}/delete`); card.remove(); } catch(e){ alert(e.message); }
  };
  const editb = card.querySelector('[data-edit]');
  if (editb) editb.onclick = () => {
    const bodyEl = card.querySelector('[data-body]');
    if (card.querySelector('[data-editbox]')) return; // schon offen
    const cur = bodyEl.textContent;
    const box = el(`<div data-editbox style="margin:8px 0">
      <textarea data-eb>${esc(cur)}</textarea>
      <div class="row" style="margin-top:6px"><button class="small" data-ebsave>${esc(t('cm_save'))}</button><button class="ghost small" data-ebcancel>${esc(t('cm_cancel'))}</button><span class="err" data-eberr style="margin-left:8px"></span></div>
    </div>`);
    bodyEl.style.display = 'none';
    bodyEl.after(box);
    box.querySelector('[data-ebcancel]').onclick = () => { box.remove(); bodyEl.style.display = ''; };
    box.querySelector('[data-ebsave]').onclick = async () => {
      const nv = box.querySelector('[data-eb]').value;
      try {
        const r = await api('POST',`/api/posts/${p.id}/edit`,{ body: nv });
        bodyEl.textContent = r.body;
        card.querySelector('[data-edited]').style.display = '';
        box.remove(); bodyEl.style.display = '';
      } catch(e){ box.querySelector('[data-eberr]').textContent = e.message; }
    };
  };
  const repb = card.querySelector('[data-report]');
  if (repb) repb.onclick = async () => {
    const reason = prompt(t('pc_report_prompt')) ?? '';
    if (reason === null) return;
    try { await api('POST',`/api/posts/${p.id}/report`,{ reason }); alert(t('pc_reported')); }
    catch(e){ alert(e.message); }
  };
  const cbtn = card.querySelector('[data-comments]');
  const cbox = card.querySelector('[data-cbox]');
  cbtn.onclick = async () => {
    cbox.classList.toggle('hidden');
    if (!cbox.classList.contains('hidden')) loadComments(p.id, card);
  };
  let commentImg = null;
  const cimg = card.querySelector('[data-cimg]'), cimgprev = card.querySelector('[data-cimgprev]');
  cimg.onchange = async () => {
    const f = cimg.files[0]; if (!f) return;
    try { commentImg = await fileToDataUrl(f); cimgprev.src = commentImg; cimgprev.style.display='block'; } catch(e){ alert(e.message); commentImg=null; }
  };
  card.querySelector('[data-csend]').onclick = async () => {
    const inp = card.querySelector('[data-cinput]');
    if (!inp.value.trim() && !commentImg) return;
    try {
      await api('POST',`/api/posts/${p.id}/comments`,{ body:inp.value, image:commentImg });
      inp.value=''; commentImg=null; cimg.value=''; cimgprev.style.display='none'; cimgprev.src='';
      loadComments(p.id, card);
    } catch(e){ alert(e.message); }
  };
  return card;
}

async function loadComments(postId, card) {
  const list = card.querySelector('[data-clist]');
  list.innerHTML = '<div class="loading">…</div>';
  const d = await api('GET',`/api/posts/${postId}/comments`);
  list.innerHTML = d.comments.length ? '' : `<div class="muted">${esc(t('cm_empty'))}</div>`;
  // Baum aufbauen: parent_comment_id -> Kinder, in Reihenfolge (DFS) mit Einrückung.
  const byParent = {};
  const present = new Set(d.comments.map(c => c.id));
  d.comments.forEach(c => { (byParent[c.parent_comment_id || 'root'] ||= []).push(c); });
  const build = (key, depth) => (byParent[key] || []).forEach(c => {
    list.appendChild(commentRow(postId, c, card, depth));
    build(c.id, depth + 1);
  });
  build('root', 0);
  // Verwaiste Antworten (Eltern-Kommentar entfernt) auf Wurzelebene zeigen, statt sie zu verstecken.
  d.comments.forEach(c => {
    if (c.parent_comment_id && !present.has(c.parent_comment_id)) {
      list.appendChild(commentRow(postId, c, card, 0));
      build(c.id, 1);
    }
  });
  const cb = card.querySelector('[data-comments]');
  if (cb) cb.textContent = commentLabel(d.comments.length);
}

function commentRow(postId, c, card, depth = 0) {
  const au = c.author || {};
  const mine = me && (c.author_user_id === me.user_id || au.handle === me.handle);
  const indent = Math.min(depth, 5) * 18;
  const post = card._post || {};
  const isQuestion = post.kind === 'frage';
  const isAccepted = isQuestion && post.accepted_comment_id === c.id;
  const iAmAsker = me && post.author && post.author.handle === me.handle;
  const accentStyle = isAccepted ? 'border-left:3px solid #0b7f28;background:rgba(11,127,40,.06);' : (indent?'border-left:2px solid var(--line);':'');
  const row = el(`<div class="comment" style="${indent?`margin-left:${indent}px;`:''}${accentStyle}">
    <div class="row" style="align-items:center">
      ${avatarHtml(au, 30)}
      <b class="clickable" data-openprofile="${esc(au.handle||'')}">${esc(au.display_name||t('ex_unknown'))}</b>
      <span class="handle clickable" data-openprofile="${esc(au.handle||'')}">@${esc(au.handle||'?')}</span>
      ${au.is_editorial?`<span class="editorial">${esc(t('prov_editorial'))}</span>`:''}
      ${au.verified?`<span class="verified">${esc(t('pc_verified'))}</span>`:''}
      ${au.account_type&&au.account_type!=='pharmacy'?`<span class="spec" style="margin-left:2px">${esc(acctLabel(au.account_type))}</span>`:''}
      ${isAccepted?`<span style="color:var(--ok-fg);font-weight:700;font-size:12px;margin-left:6px">${esc(t('cm_best'))}</span>`:''}
      <span class="muted" style="font-size:12px;margin-left:6px" title="${esc(c.created_at)}">${relTime(c.created_at)}</span>
      ${c.edited_at?`<span class="vis" style="margin-left:6px">${esc(t('pc_edited'))}</span>`:''}
      <span class="sp" style="flex:1"></span>
      ${mine?'<button class="ghost small" data-ced>✏️</button><button class="ghost small" data-cdel>🗑</button>':''}
    </div>
    <div data-cbody style="margin-top:2px">${linkifyMentions(c.body)}</div>
    ${c.image && /^data:image\//.test(c.image) ? `<img data-zoom src="${c.image}" alt="${esc(t('cm_img_alt'))}" style="max-width:100%;border-radius:8px;margin-top:6px;display:block;cursor:zoom-in" />` : ''}
    <div class="reacts" style="margin-top:4px">
      ${REACTS.map(([k,keyLab])=>{const n=c.reaction_counts&&c.reaction_counts[k];const on=c.my_reaction===k;return `<button class="small${on?' reacted':''}" data-creact="${k}" aria-pressed="${on}">${esc(t(keyLab).split(' ')[0])}${n?` ${n}`:''}</button>`;}).join('')}
      <button class="ghost small" data-creply>${esc(t('cm_reply'))}</button>
      ${(isQuestion && iAmAsker && !mine)?`<button class="ghost small" data-accept title="${esc(t('cm_accept_title'))}">${isAccepted?esc(t('cm_unaccept')):esc(t('cm_accept'))}</button>`:''}
      ${mine?'':`<button class="ghost small" data-creport title="${esc(t('cm_report_title'))}">🚩</button>`}
    </div>
  </div>`);
  const acceptBtn = row.querySelector('[data-accept]');
  if (acceptBtn) acceptBtn.onclick = async () => {
    acceptBtn.disabled = true;
    try {
      const nowAccepted = !isAccepted;
      await api('POST',`/api/posts/${postId}/accept`,{ commentId: c.id });
      if (card._post) card._post.accepted_comment_id = nowAccepted ? c.id : null;
      const qb = card.querySelector('[data-qbadge]'); if (qb) qb.innerHTML = qBadgeHtml(nowAccepted);
      loadComments(postId, card);
    } catch(e){ alert(e.message); acceptBtn.disabled = false; }
  };
  row.querySelectorAll('[data-openprofile]').forEach(el => { if (el.dataset.openprofile) el.onclick = () => openProfile(el.dataset.openprofile); });
  row.querySelectorAll('[data-hashtag]').forEach(el => el.onclick = () => openHashtag(el.dataset.hashtag));
  const crep = row.querySelector('[data-creport]');
  if (crep) crep.onclick = async () => {
    const reason = prompt(t('cm_report_prompt')) ?? '';
    if (reason === null) return;
    try { await api('POST',`/api/comments/${c.id}/report`,{ reason }); alert(t('cm_reported')); }
    catch(e){ alert(e.message); }
  };
  row.querySelectorAll('[data-creact]').forEach(btn => btn.onclick = async () => {
    try { await api('POST',`/api/comments/${c.id}/react`,{ type:btn.dataset.creact }); loadComments(postId, card); } catch(e){ alert(e.message); }
  });
  row.querySelector('[data-creply]').onclick = () => {
    if (row.querySelector('[data-replybox]')) return;
    const box = el(`<div data-replybox style="margin-top:6px">
      <input data-ri placeholder="${esc(ti('cm_reply_to',{handle:au.handle||''}))}">
      <div class="row" style="margin-top:4px"><button class="small" data-rs>${esc(t('cm_reply_send'))}</button><button class="ghost small" data-rc>${esc(t('cm_cancel'))}</button></div></div>`);
    row.appendChild(box);
    box.querySelector('[data-ri]').focus();
    box.querySelector('[data-rc]').onclick = () => box.remove();
    box.querySelector('[data-rs]').onclick = async () => {
      const val = box.querySelector('[data-ri]').value;
      if (!val.trim()) return;
      try { await api('POST',`/api/posts/${postId}/comments`,{ body: val, parentCommentId: c.id }); loadComments(postId, card); }
      catch(e){ alert(e.message); }
    };
  };
  const del = row.querySelector('[data-cdel]');
  if (del) del.onclick = async () => {
    if (!confirm(t('cm_del_confirm'))) return;
    try { await api('POST',`/api/comments/${c.id}/delete`); loadComments(postId, card); } catch(e){ alert(e.message); }
  };
  const ed = row.querySelector('[data-ced]');
  if (ed) ed.onclick = () => {
    const bodyEl = row.querySelector('[data-cbody]');
    if (row.querySelector('[data-cedit]')) return;
    const box = el(`<div data-cedit style="margin-top:4px"><input data-ci value="${esc(bodyEl.textContent)}">
      <div class="row" style="margin-top:4px"><button class="small" data-cs>${esc(t('cm_save'))}</button><button class="ghost small" data-cc>${esc(t('cm_cancel'))}</button></div></div>`);
    bodyEl.style.display='none'; bodyEl.after(box);
    box.querySelector('[data-cc]').onclick = () => { box.remove(); bodyEl.style.display=''; };
    box.querySelector('[data-cs]').onclick = async () => {
      try { await api('POST',`/api/comments/${c.id}/edit`,{ body: box.querySelector('[data-ci]').value }); loadComments(postId, card); }
      catch(e){ alert(e.message); }
    };
  };
  return row;
}

async function refreshNotifCount() {
  try {
    const d = await api('GET','/api/notifications');
    const badge = document.getElementById('notifBadge');
    if (d.unread > 0) { badge.textContent = d.unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch {}
}
// Engpass-/Beschaffungs-relevante Benachrichtigungstypen (für den Meldungs-Filter).
const NOTIF_PROCUREMENT = new Set(['watch_alert','shortage_confirm','watch_offer','exchange_offer','exchange_want']);
let notifFilter = 'all'; // 'all' | 'procurement' | 'social'
let notifUnreadOnly = false; // Zusatzfilter: nur ungelesene zeigen
async function showNotifications() {
  setDocTitle(t('notif_doc'));
  const d = await api('GET','/api/notifications');
  const verb = (ty) => t('nv_'+ty) !== 'nv_'+ty ? t('nv_'+ty) : ty;
  const icons = { follow:'👥', comment:'💬', reaction:'👍', mention:'@', dm:'✉️', poll_vote:'📊', repost:'🔁', exchange_offer:'🔄', exchange_want:'🔄', verified:'✔', watch_alert:'⭐', shortage_confirm:'✅', answer_accepted:'🏆', watch_offer:'📦', endorsement:'👏', recommendation:'💬', price_alert:'🔔', appt_request:'📹', appt_confirmed:'✅', appt_declined:'🚫', appt_cancelled:'🗑️', promo_like:'❤️', promo_comment:'💬', live_start:'🔴', task_assigned:'✅', task_done:'🏁' };
  app.innerHTML = '';
  const procCount = d.notifications.filter(n => NOTIF_PROCUREMENT.has(n.type)).length;
  const showFilter = d.notifications.length >= 5 && procCount > 0 && procCount < d.notifications.length;
  const unreadN = d.notifications.filter(n => !n.read).length;
  const showUnreadToggle = unreadN > 0 && d.notifications.some(n => n.read); // nur sinnvoll bei Mix aus gelesen/ungelesen
  if (!showUnreadToggle) notifUnreadOnly = false;
  const head = el(`<div class="card"><div class="row"><h1 style="flex:1">${esc(t('notif_title'))}</h1>
    <button class="ghost small" id="back">${esc(t('gen_back'))}</button></div>
    ${showFilter?`<div class="reacts" data-nfilter style="margin-top:8px">
      <button class="small sortbtn" data-nf="all">${esc(t('nf_all'))}</button>
      <button class="small sortbtn" data-nf="procurement">${esc(t('nf_procurement'))}</button>
      <button class="small sortbtn" data-nf="social">${esc(t('nf_social'))}</button>
    </div>`:''}
    ${showUnreadToggle?`<div class="reacts" style="margin-top:8px"><button class="small sortbtn" data-unreadonly aria-pressed="false">${esc(ti('nf_unread_only',{n:unreadN}))}</button></div>`:''}
    <div id="notiflist" style="margin-top:8px"></div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="small" id="readall">${esc(t('notif_readall'))}</button>${d.notifications.some(n=>n.read)?`<button class="ghost small" id="clearread">${esc(t('notif_clearread'))}</button>`:''}<button class="ghost small" id="notifsettings">${esc(t('np_open'))}</button></div></div>`);
  app.appendChild(head);
  const list = head.querySelector('#notiflist');
  if (!showFilter) notifFilter = 'all';
  const matchesCat = (n) => notifFilter === 'all' || (notifFilter === 'procurement' ? NOTIF_PROCUREMENT.has(n.type) : !NOTIF_PROCUREMENT.has(n.type));
  const matchesFilter = (n) => matchesCat(n) && (!notifUnreadOnly || !n.read);
  const drawNotifs = () => {
  list.innerHTML = '';
  const shown = d.notifications.filter(matchesFilter);
  if (showFilter) head.querySelectorAll('[data-nf]').forEach(b => { const on = b.dataset.nf === notifFilter; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  { const ub = head.querySelector('[data-unreadonly]'); if (ub) { ub.textContent = ti('nf_unread_only',{n:d.notifications.filter(n=>!n.read).length}); ub.classList.toggle('active', notifUnreadOnly); ub.setAttribute('aria-pressed', String(notifUnreadOnly)); } }
  if (!shown.length) { list.innerHTML = `<div class="muted">${esc(t('notif_empty'))}</div>`; return; }
  shown.forEach(n => {
    const who = n.actor ? n.actor.display_name : t('notif_someone');
    const noWho = n.type === 'verified' || n.type === 'watch_alert' || n.type === 'watch_offer' || n.type === 'price_alert';
    // Profilbild der handelnden Person (wer) + Typ-Emoji (was) — auf einen Blick erkennbar,
    // konsistent zu Feed/Verzeichnis/Suche. Ohne Person (System-Meldung) nur das Emoji.
    const row = el(`<div class="comment clickable" style="cursor:pointer;${n.read?'':'background:var(--ok-bg)'}">
      <div class="row" style="align-items:center">
        ${n.actor ? avatarHtml(n.actor, 34, false) : ''}
        <span${n.actor?' style="font-size:16px"':''}>${icons[n.type]||'🔔'}</span>
        <span style="margin-left:6px">${n.read?'':'<b>'}${noWho?'':'<b>'+esc(who)+'</b> '}${esc(verb(n.type))}${n.label?' „'+esc(n.label)+'"':''}${n.read?'':'</b>'}</span>
        <span class="sp" style="flex:1"></span>
        <span class="muted" style="font-size:12px">${relTime(n.created_at)}</span>
      </div></div>`);
    row.onclick = () => {
      if (!n.read) { api('POST',`/api/notifications/${n.id}/read`).then(refreshNotifCount).catch(()=>{}); }
      if (n.type === 'follow' && n.actor) { mainScreen().then(()=>openProfile(n.actor.handle)); }
      else if (n.type === 'dm' && n.ref_id) { openDmThread(n.ref_id); }
      else if (n.type === 'exchange_offer' || n.type === 'exchange_want' || n.type === 'watch_offer') {
        mainScreen().then(()=>{ exchangeQuery = (n.label||'').split(/\s+/)[0]; exchangeFilter = n.type==='watch_offer'?'biete':''; exchangeBL=''; tab='exchange';
          document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
          const tb=document.querySelector('.tabs button[data-tab="exchange"]'); if(tb) tb.classList.add('active'); loadTab(); });
      }
      else if (n.type === 'watch_alert') { const w = (n.label||'').split(' · ')[0].trim(); mainScreen().then(()=> w ? openWirkstoff(w) : goTab('shortages')); }
      else if (n.type === 'price_alert') { const w = (n.label||'').split(' · ')[0].trim(); mainScreen().then(()=> w ? openWirkstoff(w) : goTab('rabatte')); }
      else if (n.type === 'shortage_confirm') { mainScreen().then(()=>goTab('shortages')); }
      else if (n.type === 'appt_request' || n.type === 'appt_confirmed' || n.type === 'appt_declined' || n.type === 'appt_cancelled') { mainScreen().then(()=>openAppointments()); }
      else if (n.type === 'promo_like' || n.type === 'promo_comment') { mainScreen().then(()=> n.ref_id ? openPromotionDetail(n.ref_id) : openPromotions()); }
      else if (n.type === 'live_start') { mainScreen().then(()=>openLive()); }
      else if (n.type === 'task_assigned' || n.type === 'task_done') { mainScreen().then(()=>openTasks()); }
      else if (n.type === 'endorsement' || n.type === 'recommendation') { mainScreen().then(()=> me && openProfile(me.handle)); }
      else if (n.post_id) { mainScreen().then(()=>openPost(n.post_id)); }
      else if (n.actor) { mainScreen().then(()=>openProfile(n.actor.handle)); }
    };
    list.appendChild(row);
  });
  };
  drawNotifs();
  if (showFilter) head.querySelectorAll('[data-nf]').forEach(b => b.onclick = () => { notifFilter = b.dataset.nf; drawNotifs(); });
  { const ub = head.querySelector('[data-unreadonly]'); if (ub) ub.onclick = () => { notifUnreadOnly = !notifUnreadOnly; drawNotifs(); }; }
  head.querySelector('#back').onclick = mainScreen;
  head.querySelector('#readall').onclick = async () => { await api('POST','/api/notifications/read-all'); refreshNotifCount(); showNotifications(); };
  { const cr = head.querySelector('#clearread'); if (cr) cr.onclick = async () => { if (!confirm(t('notif_clearread_confirm'))) return; try { await api('POST','/api/notifications/clear-read'); refreshNotifCount(); showNotifications(); } catch(e){ alert(e.message); } }; }
  head.querySelector('#notifsettings').onclick = openNotifSettings;
  refreshNotifCount();
}

// Benachrichtigungs-Einstellungen: je Kategorie an/aus. Sofort gespeichert.
async function openNotifSettings() {
  setDocTitle(t('np_title'));
  app.innerHTML = '<div class="loading">…</div>';
  let d;
  try { d = await api('GET','/api/notification-prefs'); }
  catch(e){ app.innerHTML=''; app.appendChild(errorState(e.message, openNotifSettings)); return; }
  const meta = {
    follows:   ['👥', t('np_c_follows'),   t('np_c_follows_d')],
    community: ['💬', t('np_c_community'), t('np_c_community_d')],
    dm:        ['✉️', t('np_c_dm'),        t('np_c_dm_d')],
    watch:     ['⭐', t('np_c_watch'),     t('np_c_watch_d')],
    live:      ['🔴', t('np_c_live'),      t('np_c_live_d')],
    promos:    ['🏷️', t('np_c_promos'),    t('np_c_promos_d')],
  };
  app.innerHTML = '';
  const head = el(`<div class="card">
    <div class="row"><h1 style="flex:1">${esc(t('np_title'))}</h1><button class="ghost small" id="back">${esc(t('gen_back'))}</button></div>
    <div class="muted" style="margin-bottom:10px">${esc(t('np_sub'))}</div>
    <div id="np_list"></div>
  </div>`);
  const list = head.querySelector('#np_list');
  for (const cat of d.categories) {
    const [icon, label, desc] = meta[cat] || ['🔔', cat, ''];
    const on = d.settings[cat] !== false;
    const row = el(`<div class="row" style="align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--line)">
      <div style="font-size:22px;line-height:1.2">${icon}</div>
      <div style="flex:1"><b>${esc(label)}</b><div class="muted" style="font-size:13px">${esc(desc)}</div></div>
      <button class="${on?'':'ghost '}small" data-cat="${esc(cat)}" aria-pressed="${on}">${on?esc(t('np_on')):esc(t('np_off'))}</button>
    </div>`);
    const btn = row.querySelector('[data-cat]');
    btn.onclick = async () => {
      const next = btn.getAttribute('aria-pressed') !== 'true'; // umschalten
      btn.disabled = true;
      try {
        const r = await api('POST','/api/notification-prefs', { category: cat, enabled: next });
        const nowOn = r.settings[cat] !== false;
        btn.setAttribute('aria-pressed', String(nowOn));
        btn.textContent = nowOn ? t('np_on') : t('np_off');
        btn.classList.toggle('ghost', !nowOn);
      } catch(e){ alert(e.message); }
      btn.disabled = false;
    };
    list.appendChild(row);
  }
  head.querySelector('#back').onclick = showNotifications;
  app.appendChild(head);
}

// Einzelbeitrag-Ansicht (z.B. aus einer Benachrichtigung heraus), Kommentare offen.
async function openPost(postId) {
  setDocTitle(t('post_doc'));
  const feed = document.getElementById('feed');
  if (!feed) return;
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); setTabAria();
  feed.innerHTML = '<div class="loading">…</div>';
  try {
    const d = await api('GET','/api/posts/'+encodeURIComponent(postId));
    feed.innerHTML = '';
    const head = el(`<div class="card"><div class="row"><b tabindex="-1" data-ptitle>${esc(t('post_title'))}</b><span class="sp" style="flex:1"></span><button class="ghost small" data-back>${esc(t('post_back'))}</button></div></div>`);
    head.querySelector('[data-back]').onclick = () => { tab='public'; document.querySelector('.tabs button[data-tab="public"]').classList.add('active'); loadTab(); };
    feed.appendChild(head);
    const cardEl = postCard(d.post);
    feed.appendChild(cardEl);
    cardEl.querySelector('[data-comments]').click(); // Kommentare gleich aufklappen
    startDetailView(head.querySelector('[data-ptitle]'));
  } catch(e){ (feed.innerHTML='', feed.appendChild(errorState(e.message, loadTab))); }
}

async function showModeration() {
  setDocTitle(t('md_doc'));
  app.innerHTML = '<div class="loading">…</div>';
  let d, vq, sh;
  try { d = await api('GET','/api/reports'); vq = await api('GET','/api/verify/requests'); sh = await api('GET','/api/shortages'); }
  catch(e){ app.innerHTML = ''; app.appendChild(errorState(e.message, showModeration)); return; }
  app.innerHTML = '';
  const krit = (sh.shortages||[]).filter(s => s.status === 'kritisch').length;
  const comm = (sh.shortages||[]).filter(s => s.provenance === 'community').length;
  const mtile = (icon, num, label, col) => `<div style="flex:1;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px">
    <div style="font-size:24px;font-weight:800;color:${col}">${icon} ${num}</div><div class="muted" style="font-size:13px;margin-top:2px">${esc(label)}</div></div>`;
  const head = el(`<div class="card"><div class="row"><h1 style="flex:1">${esc(t('md_title'))}</h1>
    <button class="ghost small" id="back">${esc(t('gen_back'))}</button></div>
    <div class="muted" style="margin-bottom:10px">${esc(t('md_sub'))}</div>
    <div class="row" style="flex-wrap:wrap;gap:10px">
      ${mtile('🚩', d.reports.length, t('md_reports'), 'var(--crit-fg)')}
      ${mtile('✔', vq.requests.length, t('md_verifs'), 'var(--info-fg)')}
      ${mtile('🔴', krit, t('ov_t_crit'), 'var(--crit-fg)')}
      ${mtile('👥', comm, t('md_community'), 'var(--warn-fg)')}
    </div></div>`);
  head.querySelector('#back').onclick = mainScreen;
  app.appendChild(head);
  // Verifizierungs-Anträge
  if (vq.requests.length) {
    app.appendChild(el(`<div class="muted" style="margin:6px 2px;font-weight:700">${esc(t('md_verif_sec'))}</div>`));
    vq.requests.forEach(rq => {
      const card = el(`<div class="card">
        <div><b>${esc(rq.display_name||'?')}</b> <span class="handle">@${esc(rq.handle||'?')}</span></div>
        <div class="post-body" style="margin:6px 0">${rq.note?esc(rq.note):`<span class="muted">${esc(t('md_no_note'))}</span>`}</div>
        <div class="row"><button class="small" data-approve>${esc(t('md_verify_btn'))}</button><button class="ghost small" data-reject>${esc(t('md_reject'))}</button></div>
      </div>`);
      card.querySelector('[data-approve]').onclick = async () => { try { await api('POST',`/api/verify/${encodeURIComponent(rq.user_id)}/resolve`,{ approve:true }); showModeration(); } catch(e){ alert(e.message); } };
      card.querySelector('[data-reject]').onclick = async () => { try { await api('POST',`/api/verify/${encodeURIComponent(rq.user_id)}/resolve`,{ approve:false }); showModeration(); } catch(e){ alert(e.message); } };
      app.appendChild(card);
    });
  }
  if (d.reports.length) app.appendChild(el(`<div class="muted" style="margin:10px 2px 6px;font-weight:700">${esc(t('md_reported_sec'))}</div>`));
  else if (!vq.requests.length) { app.appendChild(el(`<div class="card muted">${esc(t('md_empty'))}</div>`)); return; }
  d.reports.forEach(r => {
    const post = r.post;
    const card = el(`<div class="card">
      <div class="muted">${post&&post.is_comment?esc(t('md_comment_prefix')):''}${esc(ti('md_reported_by',{h:r.reporter_handle||'?'}))}${r.reason?' · '+esc(t('md_reason'))+': '+esc(r.reason):' · '+esc(t('md_no_reason'))}</div>
      ${post ? `<div class="post-body">${esc(post.body)}</div>
        <div class="vis">${esc(t('md_author'))}: @${esc(post.author_handle||'?')}${post.deleted?` · <b style="color:var(--crit-fg)">${esc(t('md_removed'))}</b>`:''}</div>`
             : `<div class="muted">${esc(t('md_gone'))}</div>`}
      <div class="row" style="margin-top:10px">
        <button class="small" data-remove style="background:#c0392b">${post&&post.is_comment?esc(t('md_remove_comment')):esc(t('md_remove_post'))}</button>
        <button class="ghost small" data-ok>${esc(t('md_ok'))}</button>
      </div>
    </div>`);
    card.querySelector('[data-remove]').onclick = async () => {
      try { await api('POST',`/api/reports/${r.id}/resolve`,{ remove:true }); showModeration(); } catch(e){ alert(e.message); }
    };
    card.querySelector('[data-ok]').onclick = async () => {
      try { await api('POST',`/api/reports/${r.id}/resolve`,{ remove:false }); showModeration(); } catch(e){ alert(e.message); }
    };
    app.appendChild(card);
  });
}

async function refreshDmCount() {
  try {
    const d = await api('GET','/api/dm');
    const badge = document.getElementById('dmBadge');
    if (d.unread > 0) { badge.textContent = d.unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch {}
}

// Einkaufslisten-Zähler in der Kopfzeile aktualisieren (jederzeit erreichbar).
async function refreshCartCount() {
  try {
    const d = await api('GET','/api/cart');
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    if (d.count > 0) { badge.textContent = d.count; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch {}
}

async function showDmInbox() {
  setDocTitle(t('dm_doc'));
  const d = await api('GET','/api/dm');
  app.innerHTML = '';
  const box = el(`<div class="card"><div class="row"><h1 style="flex:1">${esc(t('dm_title'))}</h1>
    <button class="ghost small" id="back">${esc(t('gen_back'))}</button></div>
    <div class="row" style="margin:6px 0 12px"><input id="dmto" placeholder="${esc(t('dm_to_ph'))}"><button class="small" id="dmnew">${esc(t('dm_write'))}</button></div>
    ${d.threads.length>=4?`<div style="margin:0 0 10px"><input id="dmq" placeholder="${esc(t('dm_search_ph'))}" aria-label="${esc(t('dm_search_ph'))}" style="width:100%"></div>`:''}
    <div id="dmthreads"></div>
    <div id="dmarchived" style="margin-top:12px"></div></div>`);
  app.appendChild(box);
  document.getElementById('back').onclick = mainScreen;
  // Archiv-Bereich: ausgeblendete Konversationen sichtbar & wiederherstellbar machen
  // (kein Sackgassen-Archivieren — Owner-UX: jede Aktion ist umkehrbar und auffindbar).
  const renderArchived = () => {
    const box2 = document.getElementById('dmarchived');
    const arch = d.archived || [];
    box2.innerHTML = '';
    if (!arch.length) return;
    const toggle = el(`<button class="ghost small" data-atoggle aria-expanded="false">${esc(ti('dm_archived_show',{n:arch.length}))}</button>`);
    const inner = el('<div data-abox class="hidden" style="margin-top:8px"></div>');
    arch.forEach(th => {
      const o = th.other || {};
      const when = th.last_message?.created_at ? relTime(th.last_message.created_at) : '';
      const r = el(`<div class="comment clickable" style="cursor:pointer;opacity:.85">
        <div class="row" style="align-items:center">${avatarHtml(o, 38, false)}<div style="flex:1;min-width:0">
        <div class="row"><b>${esc(o.display_name||t('ex_unknown'))}</b> <span class="handle">@${esc(o.handle||'?')}</span>
        <span class="sp" style="flex:1"></span>${when?`<span class="muted" style="font-size:12px;margin-right:6px">${when}</span>`:''}<button class="ghost small" data-restore>${esc(t('dm_restore'))}</button></div>
        <div class="muted" style="margin-top:2px">${esc((th.last_message?.body||'').slice(0,60))}</div></div></div></div>`);
      r.onclick = () => openDmThread(th.thread_id);
      r.querySelector('[data-restore]').onclick = async (e) => {
        e.stopPropagation();
        try { await api('POST',`/api/dm/${th.thread_id}/hide`,{ hidden: false }); showDmInbox(); }
        catch(err){ alert(err.message); }
      };
      inner.appendChild(r);
    });
    toggle.onclick = () => { const open = inner.classList.toggle('hidden') === false; toggle.setAttribute('aria-expanded', String(open)); };
    box2.appendChild(toggle); box2.appendChild(inner);
  };
  const dmnew = async () => {
    const h = v('dmto').trim().replace(/^@/,''); if (!h) return;
    try { const r = await api('POST','/api/dm/start',{ handle:h }); openDmThread(r.thread.id); }
    catch(e){ alert(e.message); }
  };
  document.getElementById('dmnew').onclick = dmnew;
  document.getElementById('dmto').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); dmnew(); } };
  const list = document.getElementById('dmthreads');
  if (!d.threads.length) { list.innerHTML = `<div class="muted">${esc(t('dm_empty'))}</div>`; renderArchived(); refreshDmCount(); return; }
  // Suche über Kontakt (Name/Handle) und letzte Nachricht — findet den richtigen Verlauf schnell.
  let dmQuery = '';
  const renderThreads = () => {
    list.innerHTML = '';
    const shown = !dmQuery ? d.threads : d.threads.filter(th => {
      const o = th.other || {};
      return (o.display_name||'').toLowerCase().includes(dmQuery) || (o.handle||'').toLowerCase().includes(dmQuery) || (th.last_message?.body||'').toLowerCase().includes(dmQuery);
    });
    if (!shown.length) { list.innerHTML = `<div class="muted">${esc(ti('dm_none_filter',{q:dmQuery}))}</div>`; return; }
    shown.forEach(th => {
      const o = th.other || {};
      const when = th.last_message?.created_at ? relTime(th.last_message.created_at) : '';
      const unread = th.unread > 0;
      // Profilbild des Kontakts links (wie überall) — Verlauf schneller wiederzuerkennen.
      const row = el(`<div class="comment clickable" style="cursor:pointer${unread?';background:rgba(11,127,40,.06);border-radius:8px':''}">
        <div class="row" style="align-items:center">${avatarHtml(o, 38, false)}<div style="flex:1;min-width:0">
        <div class="row"><b style="${unread?'font-weight:800':''}">${esc(o.display_name||t('ex_unknown'))}</b> <span class="handle">@${esc(o.handle||'?')}</span>
        <span class="sp" style="flex:1"></span>${when?`<span class="muted" style="font-size:12px;margin-right:6px">${when}</span>`:''}${unread?`<span style="background:var(--green);color:#fff;border-radius:999px;font-size:12px;font-weight:700;padding:1px 8px;min-width:20px;text-align:center;margin-right:6px">${th.unread}</span>`:''}<button class="ghost small" data-archive title="${esc(t('dm_archive'))}" aria-label="${esc(t('dm_archive'))}">🗂</button></div>
        <div class="muted" style="margin-top:2px${unread?';color:inherit;font-weight:600':''}">${esc((th.last_message?.body||'').slice(0,60))}</div></div></div></div>`);
      row.onclick = () => openDmThread(th.thread_id);
      row.querySelector('[data-archive]').onclick = async (e) => {
        e.stopPropagation();
        try { await api('POST',`/api/dm/${th.thread_id}/hide`,{ hidden: true }); showDmInbox(); }
        catch(err){ alert(err.message); }
      };
      list.appendChild(row);
    });
  };
  { const dq = document.getElementById('dmq'); if (dq) dq.oninput = () => { dmQuery = dq.value.trim().toLowerCase(); renderThreads(); }; }
  renderThreads();
  renderArchived();
  refreshDmCount();
}

async function openDmThread(threadId, prefill) {
  const d = await api('GET','/api/dm/'+encodeURIComponent(threadId));
  const o = d.other || {};
  app.innerHTML = '';
  const box = el(`<div class="card"><div class="row" style="align-items:center">
      <button class="ghost small" id="back">${esc(t('dm_back'))}</button>
      <span class="sp" style="flex:1"></span>
      ${avatarHtml(o, 30, false)}
      <b class="clickable" data-openprofile="${esc(o.handle||'')}">${esc(o.display_name||t('ex_unknown'))}</b>
      <span class="handle">@${esc(o.handle||'?')}</span>
    </div>
    <div id="dmmsgs" style="margin:12px 0;max-height:60vh;overflow-y:auto"></div>
    <div class="row"><input id="dmbody" placeholder="${esc(t('dm_body_ph'))}" style="flex:1"><button class="small" id="dmsend">${esc(t('pc_send'))}</button></div>
  </div>`);
  app.appendChild(box);
  document.getElementById('back').onclick = showDmInbox;
  const openP = box.querySelector('[data-openprofile]');
  if (openP && openP.dataset.openprofile) openP.onclick = () => { mainScreen().then(()=>openProfile(openP.dataset.openprofile)); };
  const msgs = document.getElementById('dmmsgs');
  const render = (messages) => {
    msgs.innerHTML = '';
    if (!messages.length) { msgs.innerHTML = `<div class="muted">${esc(t('dm_no_msgs'))}</div>`; return; }
    // Letzte eigene Nachricht merken: nur dort steht der Zustellungs-/Gelesen-Hinweis
    // (Messenger-Konvention — nicht an jeder einzelnen Nachricht).
    let lastMineIdx = -1;
    messages.forEach((m, i) => { if (me && m.sender_user_id === me.user_id) lastMineIdx = i; });
    let lastDay = null;
    messages.forEach((m, i) => {
      const day = (m.created_at || '').slice(0, 10);
      if (day && day !== lastDay) {
        lastDay = day;
        msgs.appendChild(el(`<div style="text-align:center;margin:12px 0 6px"><span class="muted" style="font-size:12px;background:var(--chip-bg);border:1px solid var(--line);border-radius:999px;padding:2px 10px">${esc(dayLabel(m.created_at))}</span></div>`));
      }
      const mine = me && m.sender_user_id === me.user_id;
      // Zustell-/Lese-Hinweis nur unter der letzten eigenen Nachricht: „Gelesen" (grün) sobald
      // read_at gesetzt ist (Gegenüber hat den Verlauf geöffnet), sonst „Zugestellt".
      const receipt = (mine && i === lastMineIdx)
        ? `<div style="font-size:11px;margin-top:2px;font-weight:600;color:${m.read_at ? 'var(--ok-fg)' : 'var(--muted)'}">${m.read_at ? '✓✓ ' + esc(t('dm_read')) : '✓ ' + esc(t('dm_delivered'))}</div>`
        : '';
      msgs.appendChild(el(`<div style="display:flex;flex-direction:column;margin:4px 0;${mine?'align-items:flex-end':'align-items:flex-start'}">
        <div style="max-width:75%;padding:8px 12px;border-radius:12px;background:${mine?'var(--green)':'var(--chip-bg)'};color:${mine?'#fff':'inherit'}">${esc(m.body)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(fmtClock(m.created_at))}</div>
        ${receipt}
      </div>`));
    });
    msgs.scrollTop = msgs.scrollHeight;
  };
  render(d.messages);
  // Kontext-Entwurf (z. B. aus einem Biete/Suche-Eintrag) nur vorbelegen, wenn der Verlauf
  // noch leer ist — der/die Empfänger:in weiß dann sofort, worum es geht. Bleibt editierbar.
  if (prefill && !d.messages.length) { const inp = document.getElementById('dmbody'); inp.value = prefill; inp.focus(); }
  const send = async () => {
    const inp = document.getElementById('dmbody');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = ''; // sofort leeren: ein paralleler Aufruf liest leer und bricht ab (Doppelversand-Schutz)
    try {
      await api('POST','/api/dm/'+encodeURIComponent(threadId),{ body: text });
      const fresh = await api('GET','/api/dm/'+encodeURIComponent(threadId));
      render(fresh.messages);
    } catch(e){ inp.value = text; alert(e.message); } // bei Fehler Text wiederherstellen
  };
  document.getElementById('dmsend').onclick = send;
  // Enter sendet (Shift+Enter nicht). Nur EIN Handler — ein zweiter (addEventListener)
  // löste send() doppelt aus und verschickte jede Nachricht zweimal.
  document.getElementById('dmbody').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  refreshDmCount();
}

// PWA: Service Worker registrieren (macht die App installierbar).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

// „Nach oben"-Button für lange Listen (v.a. mobil): erscheint ab ~600px Scroll.
(function setupBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'backtotop';
  btn.type = 'button';
  btn.textContent = '↑';
  btn.setAttribute('data-i18n-aria', 'backtotop_aria');
  btn.setAttribute('aria-label', t('backtotop_aria'));
  btn.setAttribute('title', t('backtotop_aria'));
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);
  let ticking = false;
  const update = () => { btn.classList.toggle('show', window.scrollY > 600); ticking = false; };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// Tastatur-Komfort: „/" fokussiert die Suche (nicht, wenn man ohnehin gerade tippt).
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const ae = document.activeElement;
  const tag = ae && ae.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ae && ae.isContentEditable)) return;
  const sq = document.getElementById('sq');
  if (sq) { e.preventDefault(); sq.focus(); if (sq.select) sq.select(); }
});

// Offline-Hinweis: zeitknappe Nutzer:innen sollen sofort verstehen, warum nichts lädt,
// statt stiller Fehler. Bernstein-Balken oben, folgt dem Verbindungsstatus.
function updateOfflineBanner() {
  const el = document.getElementById('offlineBanner');
  if (el) el.classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
updateOfflineBanner();

// A11y: klickbare div/span.clickable-Elemente per Tastatur erreichbar & auslösbar
// machen — zentral (MutationObserver), ohne jede einzelne Fundstelle anzufassen.
// Container, die bereits eigene Bedienelemente enthalten, werden nicht selbst zum
// Button (verhindert verschachtelte Interaktiv-Elemente).
function makeClickableAccessible(scope) {
  const nodes = scope && scope.querySelectorAll ? scope.querySelectorAll('.clickable') : [];
  nodes.forEach(elm => {
    if (elm.dataset.kbd) return;
    if (elm.querySelector('button,a,input,select,textarea,[role="button"]')) return;
    elm.dataset.kbd = '1';
    if (!elm.hasAttribute('tabindex')) elm.setAttribute('tabindex', '0');
    if (!elm.hasAttribute('role')) elm.setAttribute('role', 'button');
  });
}
let _kbdScan = null;
new MutationObserver(() => { clearTimeout(_kbdScan); _kbdScan = setTimeout(() => makeClickableAccessible(document), 60); })
  .observe(document.body, { childList: true, subtree: true });
document.addEventListener('keydown', e => {
  const a = document.activeElement;
  if ((e.key === 'Enter' || e.key === ' ') && a && a.dataset && a.dataset.kbd && a.classList.contains('clickable')) {
    e.preventDefault(); a.click();
  }
});
makeClickableAccessible(document);

// Start
applyFontScale();
applyTheme();
document.getElementById('btnFont').onclick = () => {
  const lvl = (parseInt(localStorage.getItem('apo_fontscale') || '0', 10) + 1) % 3;
  localStorage.setItem('apo_fontscale', String(lvl));
  applyFontScale();
};
document.getElementById('btnTheme').onclick = () => {
  // Auf Basis des tatsächlich angezeigten Modus umschalten (nicht nur localStorage),
  // damit der erste Klick auch aus dem OS-Default heraus korrekt wechselt.
  const nowDark = document.body.classList.contains('dark');
  localStorage.setItem('apo_theme', nowDark ? 'light' : 'dark');
  applyTheme();
};
// OS-Themenwechsel übernehmen, solange die Nutzer:in nicht selbst gewählt hat.
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onOsChange = () => { if (!localStorage.getItem('apo_theme')) applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onOsChange);
  else if (mq.addListener) mq.addListener(onOsChange);
}
// Logo oben links -> zur Startseite (eine Art „Home"/Aktualisierung).
function goHome() {
  if (localStorage.getItem('apo_token') && me) {
    // Eingeloggt: zurück zum Start-Reiter „Für dich" + nach oben.
    tab = 'overview';
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
    const ov = document.querySelector('.tabs button[data-tab="overview"]');
    if (ov) ov.classList.add('active');
    if (typeof setTabAria === 'function') setTabAria();
    loadTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Ausgeloggt: zurück zum Start des Flows (Länderauswahl).
    countryScreen();
  }
}
const _logo = document.getElementById('logoHome');
if (_logo) _logo.onclick = goHome;


const _hasCountry = () => !!localStorage.getItem('apo_country');
(async () => {
  // Zuerst eine mögliche OAuth-Rückleitung abfangen (Social-Login), sonst normaler Start.
  if (await handleOAuthCallback()) return;
  if (localStorage.getItem('apo_token')) mainScreen().catch(() => (_hasCountry() ? authScreen() : countryScreen()));
  else if (_hasCountry()) authScreen();
  else countryScreen();
})();
