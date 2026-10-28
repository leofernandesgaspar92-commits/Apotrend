// ============================================================================
//  Öffentliche Engpass-Seiten für Suchmaschinen
// ============================================================================
//  Wer „Amoxicillin Lieferengpass" sucht, fand ApoPulse nicht: Die App ist eine
//  Single-Page-App, Suchmaschinen sahen eine leere Hülle. Diese Seiten werden
//  auf dem Server gebaut — lesbar ohne JavaScript, mit Quelle und Stand:
//
//    /engpaesse                    Länder mit Behördenliste
//    /engpaesse/at                 aktuelle Engpässe eines Landes
//    /engpaesse/at/amoxicillin     ein Wirkstoff in einem Land
//    /sitemap.xml, /robots.txt
//
//  Regeln:
//   - NUR amtliche Daten (Behördenlisten). Meldungen aus Apotheken und
//     Beispieldaten erscheinen hier nicht — eine Suchmaschine zeigt Auszüge
//     ohne Kennzeichnung, „nicht amtlich" ginge dabei verloren.
//   - Jede Aussage mit Behörde und Stand; keine Therapie- oder
//     Austauschempfehlung.
//   - Nur Wirkstoffe, die in der Behördenliste des Landes stehen oder standen.
//     Unbekannte Adressen -> 404, keine endlosen Leerseiten.
//   - Keine Anzeigen auf diesen Seiten (wie in der App: kein Werbeumfeld bei
//     Engpässen).
// ============================================================================
import { vorschaubild } from '../domain/vorschaubild.js';
import { wirkstoffSchluessel } from '../domain/inn.js';
import { frLand } from '../domain/franzLand.js';
import { richtung } from '../domain/schreibrichtung.js';

const AKTIV = new Set(['kritisch', 'eingeschraenkt']);

export function slug(name) {
  return String(name || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TEXTE = {
  de: {
    index_titel: 'Lieferengpässe bei Arzneimitteln — aktuell, mit Quelle',
    index_beschr: 'Aktuelle Engpasslisten der Arzneimittelbehörden nach Land. Mit Quelle, Stand und Verlauf.',
    land_titel: (l) => `Lieferengpässe ${l} — aktuelle Liste`,
    land_beschr: (n, l, q) => `${n} Wirkstoffe stehen derzeit auf der Engpassliste in ${l}. Quelle: ${q}.`,
    land_leer: (l) => `Derzeit steht kein Wirkstoff auf der Engpassliste in ${l}.`,
    w_titel_knapp: (w, l) => `${w}: Lieferengpass in ${l}`,
    w_titel_nicht: (w, l) => `${w} in ${l}: derzeit kein Lieferengpass gemeldet`,
    w_knapp: (w, l, q) => `${w} steht auf der Engpassliste in ${l} (Quelle: ${q}).`,
    w_nicht: (w, l, bis) => `${w} steht derzeit nicht auf der Engpassliste in ${l}.${bis ? ` Zuletzt knapp bis ${bis}.` : ''}`,
    seit: (n) => (n <= 0 ? 'seit heute' : n === 1 ? 'seit 1 Tag' : `seit ${n} Tagen`),
    praeparate: 'Betroffene Präparate', status: { kritisch: 'nicht lieferbar', eingeschraenkt: 'eingeschränkt lieferbar' },
    bis: 'voraussichtlich bis', verlauf: (n, d) => `Seit Beginn der Aufzeichnung ${n}× auf der Liste${d ? `, im Schnitt ${d} Tage` : ''}.`,
    anderswo: (n) => (n === 1 ? 'Auch in 1 weiteren Land knapp.' : `Auch in ${n} weiteren Ländern knapp.`),
    quelle: 'Quelle', stand: 'Stand', wirkstoff: 'Wirkstoff', lage: 'Status', laender: 'Länder mit Behördenliste',
    cta_w: (w) => `Kostenlos benachrichtigt werden, wenn sich bei ${w} etwas ändert`, cta_land: 'Eigene Liste prüfen und Alarme einrichten — kostenlos',
    hinweis: 'Angaben aus der amtlichen Engpassliste. Keine Therapie- oder Austauschempfehlung — bei Fragen bitte an Apotheke oder Ärztin/Arzt wenden.',
    hinweis_ohne: 'Meldungen aus Apotheken sind nicht amtlich bestätigt. Keine Therapie- oder Austauschempfehlung — bei Fragen bitte an Apotheke oder Ärztin/Arzt wenden.',
    zurueck_land: (l) => `Alle Engpässe in ${l}`, alle_laender: 'Alle Länder',
    ohne_titel: (l) => `Lieferengpässe bei Arzneimitteln in ${l}`,
    ohne_beschr: (l, r) => `ApoPulse erhält für ${l} (noch) keine amtliche Engpassliste${r ? ` (Behörde: ${r})` : ''}. In ApoPulse melden Apotheken in ${l} Engpässe selbst und bestätigen sie gegenseitig — klar gekennzeichnet als nicht amtlich.`,
    ohne_cta: (l) => `Meldungen aus Apotheken in ${l} ansehen und Alarme einrichten — kostenlos`,
    laender_ohne: 'Länder ohne amtliche Liste in ApoPulse — Meldungen aus Apotheken',
    nicht_gefunden: 'Seite nicht gefunden', alle_engpaesse: 'Alle Lieferengpässe nach Land',
  },
  en: {
    index_titel: 'Medicine shortages — current, with sources',
    index_beschr: 'Current shortage lists of medicines authorities by country. With source, date and history.',
    land_titel: (l) => `Medicine shortages ${l} — current list`,
    land_beschr: (n, l, q) => `${n} substances are currently on the shortage list in ${l}. Source: ${q}.`,
    land_leer: (l) => `No substance is currently on the shortage list in ${l}.`,
    w_titel_knapp: (w, l) => `${w}: shortage in ${l}`,
    w_titel_nicht: (w, l) => `${w} in ${l}: no shortage currently reported`,
    w_knapp: (w, l, q) => `${w} is on the shortage list in ${l} (source: ${q}).`,
    w_nicht: (w, l, bis) => `${w} is currently not on the shortage list in ${l}.${bis ? ` Last short until ${bis}.` : ''}`,
    seit: (n) => (n <= 0 ? 'since today' : n === 1 ? 'for 1 day' : `for ${n} days`),
    praeparate: 'Affected products', status: { kritisch: 'unavailable', eingeschraenkt: 'limited availability' },
    bis: 'expected until', verlauf: (n, d) => `On the list ${n}× since records began${d ? `, on average ${d} days` : ''}.`,
    anderswo: (n) => (n === 1 ? 'Also short in 1 other country.' : `Also short in ${n} other countries.`),
    quelle: 'Source', stand: 'As of', wirkstoff: 'Substance', lage: 'Status', laender: 'Countries with an authority list',
    cta_w: (w) => `Get notified for free when anything changes for ${w}`, cta_land: 'Check your own list and set up alerts — free',
    hinweis: 'Data from the official shortage list. Not a treatment or substitution recommendation — please ask your pharmacist or doctor.',
    hinweis_ohne: 'Reports from pharmacies are not officially confirmed. Not a treatment or substitution recommendation — please ask your pharmacist or doctor.',
    zurueck_land: (l) => `All shortages in ${l}`, alle_laender: 'All countries',
    ohne_titel: (l) => `Medicine shortages in ${l}`,
    ohne_beschr: (l, r) => `ApoPulse does not (yet) receive an official shortage list for ${l}${r ? ` (authority: ${r})` : ''}. In ApoPulse, pharmacies in ${l} report shortages themselves and confirm each other's reports — clearly marked as not official.`,
    ohne_cta: (l) => `See reports from pharmacies in ${l} and set up alerts — free`,
    laender_ohne: 'Countries without an official list in ApoPulse — pharmacy reports',
    nicht_gefunden: 'Page not found', alle_engpaesse: 'All medicine shortages by country',
  },
  pt: {
    index_titel: 'Ruturas de medicamentos — atuais, com fonte',
    index_beschr: 'Listas atuais de ruturas das autoridades do medicamento por país. Com fonte, data e histórico.',
    land_titel: (l) => `Ruturas de medicamentos ${l} — lista atual`,
    land_beschr: (n, l, q) => `${n} substâncias estão atualmente na lista de ruturas em ${l}. Fonte: ${q}.`,
    land_leer: (l) => `Nenhuma substância está atualmente na lista de ruturas em ${l}.`,
    w_titel_knapp: (w, l) => `${w}: rutura em ${l}`,
    w_titel_nicht: (w, l) => `${w} em ${l}: sem rutura comunicada atualmente`,
    w_knapp: (w, l, q) => `${w} consta da lista de ruturas em ${l} (fonte: ${q}).`,
    w_nicht: (w, l, bis) => `${w} não consta atualmente da lista de ruturas em ${l}.${bis ? ` Última rutura até ${bis}.` : ''}`,
    seit: (n) => (n <= 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`),
    praeparate: 'Medicamentos afetados', status: { kritisch: 'indisponível', eingeschraenkt: 'disponibilidade limitada' },
    bis: 'previsto até', verlauf: (n, d) => `Na lista ${n}× desde o início do registo${d ? `, em média ${d} dias` : ''}.`,
    anderswo: (n) => (n === 1 ? 'Também em rutura em 1 outro país.' : `Também em rutura em ${n} outros países.`),
    quelle: 'Fonte', stand: 'Atualizado', wirkstoff: 'Substância', lage: 'Estado', laender: 'Países com lista oficial',
    cta_w: (w) => `Receber aviso grátis quando algo mudar em ${w}`, cta_land: 'Verificar a sua lista e criar alertas — grátis',
    hinweis: 'Dados da lista oficial de ruturas. Não é recomendação de tratamento ou substituição — consulte o seu farmacêutico ou médico.',
    hinweis_ohne: 'As comunicações de farmácias não são confirmadas oficialmente. Não é recomendação de tratamento ou substituição — consulte o seu farmacêutico ou médico.',
    zurueck_land: (l) => `Todas as ruturas em ${l}`, alle_laender: 'Todos os países',
    ohne_titel: (l) => `Ruturas de medicamentos em ${l}`,
    ohne_beschr: (l, r) => `O ApoPulse (ainda) não recebe uma lista oficial de ruturas para ${l}${r ? ` (autoridade: ${r})` : ''}. No ApoPulse, as farmácias em ${l} comunicam ruturas e confirmam-nas entre si — claramente assinaladas como não oficiais.`,
    ohne_cta: (l) => `Ver comunicações de farmácias em ${l} e criar alertas — grátis`,
    laender_ohne: 'Países sem lista oficial no ApoPulse — comunicações de farmácias',
    nicht_gefunden: 'Página não encontrada', alle_engpaesse: 'Todas as ruturas de medicamentos por país',
  },
  fr: {
    index_titel: 'Pénuries de médicaments — à jour, avec sources',
    index_beschr: 'Listes actuelles de pénuries des autorités du médicament, par pays. Avec source, date et historique.',
    land_titel: (l) => `Pénuries de médicaments ${l} — liste actuelle`,
    land_beschr: (n, l, q) => `${n} substances figurent actuellement sur la liste des pénuries ${frLand(l)}. Source : ${q}.`,
    land_leer: (l) => `Aucune substance ne figure actuellement sur la liste des pénuries ${frLand(l)}.`,
    w_titel_knapp: (w, l) => `${w} : pénurie ${frLand(l)}`,
    w_titel_nicht: (w, l) => `${w} ${frLand(l)} : aucune pénurie signalée actuellement`,
    w_knapp: (w, l, q) => `${w} figure sur la liste des pénuries ${frLand(l)} (source : ${q}).`,
    w_nicht: (w, l, bis) => `${w} ne figure actuellement pas sur la liste des pénuries ${frLand(l)}.${bis ? ` Dernière pénurie jusqu’au ${bis}.` : ''}`,
    seit: (n) => (n <= 0 ? 'depuis aujourd’hui' : n === 1 ? 'depuis 1 jour' : `depuis ${n} jours`),
    praeparate: 'Produits concernés', status: { kritisch: 'indisponible', eingeschraenkt: 'disponibilité limitée' },
    bis: 'prévu jusqu’au', verlauf: (n, d) => `${n}× sur la liste depuis le début de l’enregistrement${d ? `, en moyenne ${d} jours` : ''}.`,
    anderswo: (n) => (n === 1 ? 'Également en pénurie dans 1 autre pays.' : `Également en pénurie dans ${n} autres pays.`),
    quelle: 'Source', stand: 'Mis à jour', wirkstoff: 'Substance', lage: 'Statut', laender: 'Pays avec liste officielle',
    cta_w: (w) => `Être averti gratuitement dès que quelque chose change pour ${w}`, cta_land: 'Vérifier votre propre liste et créer des alertes — gratuit',
    hinweis: 'Données issues de la liste officielle des pénuries. Pas une recommandation de traitement ou de substitution — veuillez demander conseil à votre pharmacien ou médecin.',
    hinweis_ohne: 'Les signalements des pharmacies ne sont pas confirmés officiellement. Pas une recommandation de traitement ou de substitution — veuillez demander conseil à votre pharmacien ou médecin.',
    zurueck_land: (l) => `Toutes les pénuries ${frLand(l)}`, alle_laender: 'Tous les pays',
    ohne_titel: (l) => `Pénuries de médicaments ${frLand(l)}`,
    ohne_beschr: (l, r) => `ApoPulse ne reçoit pas (encore) de liste officielle des pénuries ${frLand(l, 'pour')}${r ? ` (autorité : ${r})` : ''}. Dans ApoPulse, les pharmacies ${frLand(l)} signalent elles-mêmes les pénuries et confirment mutuellement leurs signalements — clairement indiqués comme non officiels.`,
    ohne_cta: (l) => `Voir les signalements des pharmacies ${frLand(l)} et créer des alertes — gratuit`,
    laender_ohne: 'Pays sans liste officielle dans ApoPulse — signalements des pharmacies',
    nicht_gefunden: 'Page introuvable', alle_engpaesse: 'Toutes les pénuries de médicaments par pays',
  },
  ar: {
    index_titel: 'نقص الأدوية — محدّث، مع المصادر',
    index_beschr: 'قوائم النقص الحالية لدى الجهات الرسمية للأدوية حسب البلد. مع المصدر والتاريخ والسجل.',
    land_titel: (l) => `نقص الأدوية في ${l} — القائمة الحالية`,
    land_beschr: (n, l, q) => `${n} مواد على قائمة النقص حاليًا في ${l}. المصدر: ${q}.`,
    land_leer: (l) => `لا توجد حاليًا أي مادة على قائمة النقص في ${l}.`,
    w_titel_knapp: (w, l) => `${w}: نقص في ${l}`,
    w_titel_nicht: (w, l) => `${w} في ${l}: لا نقص مُبلَّغ عنه حاليًا`,
    w_knapp: (w, l, q) => `${w} على قائمة النقص في ${l} (المصدر: ${q}).`,
    w_nicht: (w, l, bis) => `${w} ليس على قائمة النقص حاليًا في ${l}.${bis ? ` آخر نقص حتى ${bis}.` : ''}`,
    seit: (n) => (n <= 0 ? 'منذ اليوم' : n === 1 ? 'منذ يوم واحد' : `منذ ${n} يوم`),
    praeparate: 'المنتجات المتأثرة', status: { kritisch: 'غير متوفر', eingeschraenkt: 'توفر محدود' },
    bis: 'متوقع حتى', verlauf: (n, d) => `على القائمة ${n} مرات منذ بدء التسجيل${d ? `، بمتوسط ${d} يوم` : ''}.`,
    anderswo: (n) => (n === 1 ? 'ناقص أيضًا في بلد آخر واحد.' : `ناقص أيضًا في ${n} بلدان أخرى.`),
    quelle: 'المصدر', stand: 'بتاريخ', wirkstoff: 'المادة', lage: 'الحالة', laender: 'بلدان لديها قائمة رسمية',
    cta_w: (w) => `احصل على إشعار مجاني عند حدوث أي تغيير في ${w}`, cta_land: 'افحص قائمتك وأنشئ تنبيهات — مجانًا',
    hinweis: 'بيانات من قائمة النقص الرسمية. ليست توصية بالعلاج أو الاستبدال — يرجى استشارة الصيدلي أو الطبيب.',
    hinweis_ohne: 'بلاغات الصيدليات غير مؤكدة رسميًا. ليست توصية بالعلاج أو الاستبدال — يرجى استشارة الصيدلي أو الطبيب.',
    zurueck_land: (l) => `كل حالات النقص في ${l}`, alle_laender: 'كل البلدان',
    ohne_titel: (l) => `نقص الأدوية في ${l}`,
    ohne_beschr: (l, r) => `لا يتلقى ApoPulse (بعد) قائمة نقص رسمية لـ ${l}${r ? ` (الجهة الرسمية: ${r})` : ''}. في ApoPulse تبلّغ الصيدليات في ${l} عن النقص بنفسها وتؤكد بلاغات بعضها — مع تعليم واضح بأنها غير رسمية.`,
    ohne_cta: (l) => `اعرض بلاغات الصيدليات في ${l} وأنشئ تنبيهات — مجانًا`,
    laender_ohne: 'بلدان دون قائمة رسمية في ApoPulse — بلاغات الصيدليات',
    nicht_gefunden: 'الصفحة غير موجودة', alle_engpaesse: 'كل حالات نقص الأدوية حسب البلد',
  },
};

function datum(iso, sprache) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))) return iso || null;
  try { return new Intl.DateTimeFormat(sprache, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(iso).slice(0, 10) + 'T00:00:00Z')); } catch { return iso; }
}

// `ohneQuelle(cc)`: Für das Land ist GAR KEINE Engpass-Quelle eingetragen (große
// Teile Afrikas). Dann eine ehrliche Landing-Seite statt 404 — wer „medicine
// shortage Uganda" sucht, fand vorher nichts. Länder MIT Quelle, die nur noch
// nicht geliefert hat, bleiben 404: „keine amtliche Liste" wäre dort falsch.
export function createOeffentlicheSeiten({ chronik, shortagesRepo, laender, stand = () => null, ohneQuelle = () => false }) {
  const sprache = (cc) => (laender[cc] && laender[cc].locale_default) || 'de';
  const landName = (cc, sp) => { try { return new Intl.DisplayNames([sp], { type: 'region' }).of(cc) || cc; } catch { return cc; } };
  const amtlich = (cc) => shortagesRepo.list({ country: cc })
    .filter((z) => z.provenance === 'verified' && !z.reporter_user_id && String(z.country || '').toUpperCase() === cc && AKTIV.has(z.status) && z.wirkstoff);

  /** Aktive amtliche Engpässe eines Landes, je Wirkstoff zusammengefasst. */
  function eintraege(cc) {
    const je = new Map();
    for (const z of amtlich(cc)) {
      const k = wirkstoffSchluessel(z.wirkstoff) || z.wirkstoff.toLowerCase();
      if (!je.has(k)) je.set(k, { wirkstoff: z.wirkstoff.trim(), zeilen: [] });
      je.get(k).zeilen.push(z);
    }
    return [...je.values()].map((e) => {
      const kurz = chronik.kurz(e.wirkstoff, cc);
      const kritisch = e.zeilen.some((z) => z.status === 'kritisch');
      const bisse = e.zeilen.map((z) => z.voraussichtlich_bis).filter(Boolean).sort();
      return {
        wirkstoff: e.wirkstoff, slug: slug(e.wirkstoff), status: kritisch ? 'kritisch' : 'eingeschraenkt',
        praeparate: e.zeilen.map((z) => ({ bezeichnung: z.bezeichnung || e.wirkstoff, status: z.status, voraussichtlich_bis: z.voraussichtlich_bis || null })),
        seit_tagen: kurz && kurz.offen_seit_tagen != null ? kurz.offen_seit_tagen : null,
        voraussichtlich_bis: bisse.length ? bisse[bisse.length - 1] : null,
        quelle: e.zeilen.find((z) => z.quelle)?.quelle || (laender[cc] && laender[cc].regulator) || null,
      };
    }).sort((a, b) => (a.status === b.status ? a.wirkstoff.localeCompare(b.wirkstoff, 'de') : a.status === 'kritisch' ? -1 : 1));
  }

  const laenderMitDaten = () => chronik.beobachteteLaender().map((x) => x.land).filter((cc) => laender[cc]);
  const laenderOhneQuelle = () => Object.keys(laender).filter((cc) => ohneQuelle(cc) && !laenderMitDaten().includes(cc))
    .sort((a, b) => landName(a, 'en').localeCompare(landName(b, 'en')));

  // Landing-Seite für Länder ohne jede Behördenquelle: KEINE Daten (auch keine
  // Apotheken-Meldungen — eine Suchmaschine zeigte sie ohne Kennzeichnung),
  // nur die ehrliche Aussage und der Weg in die App.
  function ohneListe(cc, { basis }) {
    const sp = sprache(cc); const T = TEXTE[sp] || TEXTE.de; const ln = landName(cc, sp);
    const beschr = T.ohne_beschr(ln, laender[cc].regulator || null);
    return rahmen({ sp, titel: T.ohne_titel(ln), beschr, pfad: `/engpaesse/${cc.toLowerCase()}`, basis,
      inhalt: `<nav class="p"><a href="/engpaesse">${esc(T.alle_laender)}</a></nav>
<div class="c"><h1>${esc(T.ohne_titel(ln))}</h1><p>${esc(beschr)}</p></div>
<div class="c"><a class="b" href="/?land=${esc(cc)}&amp;k=suchmaschine">${esc(T.ohne_cta(ln))}</a><p class="mu" style="margin-top:12px">${esc(T.hinweis_ohne)}</p></div>` });
  }

  /** Name zu einer Adresse: nur, was in der Behördenliste steht oder stand. */
  function nameZu(cc, s) {
    for (const e of eintraege(cc)) if (e.slug === s) return e.wirkstoff;
    for (const b of chronik.bekannteWirkstoffe()) if (b.land === cc && slug(b.wirkstoff) === s) return b.wirkstoff;
    return null;
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function rahmen({ sp, titel, beschr, pfad, basis, inhalt, jsonld = null }) {
    const url = `${basis}${pfad}`;
    return `<!DOCTYPE html>
<html lang="${esc(sp)}" dir="${richtung(sp)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} · ApoPulse</title>
<meta name="description" content="${esc(beschr)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ApoPulse"><meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschr)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(basis)}${vorschaubild(sp)}">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/png" href="/icon-192.png">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<style>
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;color:#0f1419;font-size:17px;line-height:1.5}
.k{max-width:760px;margin:0 auto;padding:16px}.c{background:#fff;border:1px solid #e1e5e8;border-radius:16px;padding:20px;margin-bottom:14px}
.m{display:flex;align-items:center;gap:10px;font-weight:800;color:#0b7f28;font-size:20px;text-decoration:none}
h1{font-size:26px;line-height:1.25;margin:12px 0 8px}h2{font-size:19px;margin:0 0 10px}p{margin:0 0 12px}.mu{color:#536471;font-size:15px}
a{color:#0b5fa5}a.b{display:block;text-align:center;background:#0b7f28;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:15px 18px;border-radius:14px;margin-top:6px}
ul.l{list-style:none;margin:0;padding:0}ul.l li{padding:10px 0;border-top:1px solid #e9ecef;display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap}
.s{font-weight:700;white-space:nowrap}.s.kritisch{color:#b42318}.s.eingeschraenkt{color:#9a6700}nav.p{font-size:15px;margin:8px 0}
@media (prefers-color-scheme:dark){body{background:#0f1419;color:#e7e9ea}.c{background:#16202a;border-color:#2f3b45}.mu{color:#9aa8b4}ul.l li{border-color:#2f3b45}a{color:#6cb6ff}.m{color:#22cc5c}a.b{background:#22cc5c;color:#04170a}.s.kritisch{color:#ff8a80}.s.eingeschraenkt{color:#ffd166}}
</style></head>
<body><div class="k"><a class="m" href="/"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#0b7f28"/><path d="M5.5 16.5h5l2.6-5.5 4.2 10.5 2.6-5h3.1" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25.2" cy="16.5" r="2.3" fill="#fff"/></svg>ApoPulse</a>
${inhalt}
</div></body></html>`;
  }

  return {
    slug, laenderMitDaten, nameZu,
    // Für die Funktionsvorschau der App (/api/vorschau): dieselben amtlichen Einträge wie hier.
    eintraege,

    laenderOhneQuelle,

    // Sprache der Übersicht aus Accept-Language (sie gehört keinem Land) — vorher immer Deutsch.
    index({ basis, sp: wunsch = 'de' }) {
      const sp = TEXTE[wunsch] ? wunsch : 'de'; const T = TEXTE[sp];
      // Ländernamen in der Sprache DIESER Seite (vorher je Land: „Australia", „مصر" mitten in der
      // französischen Liste) und danach sortiert.
      const nachName = (a, b) => landName(a, sp).localeCompare(landName(b, sp), sp);
      const liste = laenderMitDaten().sort(nachName).map((cc) => {
        const n = eintraege(cc).length;
        return `<li><a href="/engpaesse/${cc.toLowerCase()}">${esc(landName(cc, sp))}</a><span class="mu">${n} · ${esc(laender[cc].regulator || '')}</span></li>`;
      }).join('');
      const ohne = laenderOhneQuelle().sort(nachName).map((cc) => `<li><a href="/engpaesse/${cc.toLowerCase()}">${esc(landName(cc, sp))}</a></li>`).join('');
      return rahmen({ sp, titel: T.index_titel, beschr: T.index_beschr, pfad: '/engpaesse', basis,
        inhalt: `<div class="c"><h1>${esc(T.index_titel)}</h1><p class="mu">${esc(T.index_beschr)}</p>${liste ? `<h2>${esc(T.laender)}</h2><ul class="l">${liste}</ul>` : ''}</div>
${ohne ? `<div class="c"><h2>${esc(T.laender_ohne)}</h2><ul class="l">${ohne}</ul></div>` : ''}` });
    },

    nichtGefunden({ sp: wunsch = 'de' }) {
      const sp = TEXTE[wunsch] ? wunsch : 'de'; const T = TEXTE[sp];
      return `<!DOCTYPE html><html lang="${sp}" dir="${richtung(sp)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(T.nicht_gefunden)} · ApoPulse</title></head><body style="font-family:system-ui;padding:24px;font-size:17px"><h1>${esc(T.nicht_gefunden)}</h1><p><a href="/engpaesse">${esc(T.alle_engpaesse)}</a></p></body></html>`;
    },

    land(cc, { basis }) {
      if (laender[cc] && ohneQuelle(cc) && !laenderMitDaten().includes(cc)) return ohneListe(cc, { basis });
      if (!laender[cc] || !laenderMitDaten().includes(cc)) return null;
      const sp = sprache(cc); const T = TEXTE[sp] || TEXTE.de; const ln = landName(cc, sp);
      const liste = eintraege(cc);
      const q = [...new Set(liste.map((e) => e.quelle).filter(Boolean))].join(', ') || laender[cc].regulator || '—';
      const st = datum(stand(), sp);
      const zeilen = liste.map((e) => `<li><a href="/engpaesse/${cc.toLowerCase()}/${esc(e.slug)}">${esc(e.wirkstoff)}</a><span><span class="s ${e.status}">${esc(T.status[e.status])}</span>${e.seit_tagen != null ? ` <span class="mu">· ${esc(T.seit(e.seit_tagen))}</span>` : ''}</span></li>`).join('');
      const beschr = liste.length ? T.land_beschr(liste.length, ln, q) : T.land_leer(ln);
      return rahmen({ sp, titel: T.land_titel(ln), beschr, pfad: `/engpaesse/${cc.toLowerCase()}`, basis,
        inhalt: `<nav class="p"><a href="/engpaesse">${esc(T.alle_laender)}</a></nav>
<div class="c"><h1>${esc(T.land_titel(ln))}</h1><p>${esc(beschr)}</p><p class="mu">${esc(T.quelle)}: ${esc(q)}${st ? ` · ${esc(T.stand)}: ${esc(st)}` : ''}</p>
${liste.length ? `<ul class="l">${zeilen}</ul>` : ''}</div>
<div class="c"><a class="b" href="/?land=${esc(cc)}&amp;k=suchmaschine">${esc(T.cta_land)}</a><p class="mu" style="margin-top:12px">${esc(T.hinweis)}</p></div>` });
    },

    wirkstoff(cc, s, { basis }) {
      if (!laender[cc] || !laenderMitDaten().includes(cc)) return null;
      const name = nameZu(cc, s);
      if (!name) return null;
      const sp = sprache(cc); const T = TEXTE[sp] || TEXTE.de; const ln = landName(cc, sp);
      const e = eintraege(cc).find((x) => x.slug === s) || null;
      const f = chronik.fuer(name, cc);
      const letzteEnde = f && !f.offen && f.episoden.length ? f.episoden[0].ende : null;
      const anderswo = chronik.offenAnderswo(name, cc).length;
      const st = datum(stand(), sp);
      const titel = e ? T.w_titel_knapp(name, ln) : T.w_titel_nicht(name, ln);
      const satz = e ? `${T.w_knapp(name, ln, e.quelle || laender[cc].regulator)}${e.seit_tagen != null ? ' ' + T.seit(e.seit_tagen).replace(/^./, (c) => c.toUpperCase()) + '.' : ''}` : T.w_nicht(name, ln, datum(letzteEnde, sp));
      const praep = e ? `<h2>${esc(T.praeparate)}</h2><ul class="l">${e.praeparate.slice(0, 40).map((p) => `<li><span>${esc(p.bezeichnung)}</span><span><span class="s ${p.status}">${esc(T.status[p.status])}</span>${p.voraussichtlich_bis ? ` <span class="mu">· ${esc(T.bis)} ${esc(datum(p.voraussichtlich_bis, sp))}</span>` : ''}</span></li>`).join('')}</ul>` : '';
      const jsonld = { '@context': 'https://schema.org', '@type': 'WebPage', name: titel, description: satz, inLanguage: sp, dateModified: stand() || undefined, isPartOf: { '@type': 'WebSite', name: 'ApoPulse', url: basis } };
      return rahmen({ sp, titel, beschr: satz, pfad: `/engpaesse/${cc.toLowerCase()}/${s}`, basis, jsonld,
        inhalt: `<nav class="p"><a href="/engpaesse">${esc(T.alle_laender)}</a> › <a href="/engpaesse/${cc.toLowerCase()}">${esc(T.zurueck_land(ln))}</a></nav>
<div class="c"><h1>${esc(titel)}</h1><p>${esc(satz)}</p>
${f && f.anzahl ? `<p class="mu">${esc(T.verlauf(f.anzahl, f.durchschnitt_tage))}</p>` : ''}
${anderswo ? `<p class="mu">${esc(T.anderswo(anderswo))}</p>` : ''}
<p class="mu">${esc(T.quelle)}: ${esc((e && e.quelle) || laender[cc].regulator || '—')}${st ? ` · ${esc(T.stand)}: ${esc(st)}` : ''}</p>${praep}</div>
<div class="c"><a class="b" href="/?land=${esc(cc)}&amp;beobachten=${encodeURIComponent(name)}&amp;k=suchmaschine">${esc(T.cta_w(name))}</a><p class="mu" style="margin-top:12px">${esc(T.hinweis)}</p></div>` });
    },

    robots({ basis }) {
      return `User-agent: *\nAllow: /\nAllow: /engpaesse\nDisallow: /api/\nDisallow: /teilen/\n\nSitemap: ${basis}/sitemap.xml\n`;
    },

    sitemap({ basis }) {
      const lm = stand() ? String(stand()).slice(0, 10) : null;
      const urls = ['/', '/engpaesse', ...laenderOhneQuelle().map((cc) => `/engpaesse/${cc.toLowerCase()}`)];
      for (const cc of laenderMitDaten()) {
        urls.push(`/engpaesse/${cc.toLowerCase()}`);
        const gesehen = new Set();
        for (const e of eintraege(cc)) { gesehen.add(e.slug); urls.push(`/engpaesse/${cc.toLowerCase()}/${e.slug}`); }
        for (const b of chronik.bekannteWirkstoffe()) {
          const sl = slug(b.wirkstoff);
          if (b.land === cc && sl && !gesehen.has(sl)) { gesehen.add(sl); urls.push(`/engpaesse/${cc.toLowerCase()}/${sl}`); }
        }
      }
      const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${xmlEsc(basis + u)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
    },
  };
}
