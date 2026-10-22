// ============================================================================
//  Kopf der Startseite (index.html) in der Sprache des Browsers
// ============================================================================
//  Wer apopulse.com per WhatsApp teilt, bekam immer eine DEUTSCHE Vorschau:
//  „Lieferengpässe mit Quelle — Behördenlisten aus Europa". Für den Start in
//  Afrika die falsche Botschaft, und das Vorschaubild hatte eine relative
//  Adresse (manche Messenger zeigen dann keins).
//
//  Jetzt: Titel, Beschreibung und Open-Graph-Angaben nach Accept-Language
//  (de/en/pt/fr/ar; ohne passende Angabe Englisch — die Plattform ist international),
//  Bild mit absoluter Adresse. Der Inhalt der App bleibt unverändert; die
//  App-Sprache folgt weiterhin dem gewählten Land.
// ============================================================================

import { richtung } from '../domain/schreibrichtung.js';

const KOPF = {
  de: {
    titel: 'ApoPulse — Lieferengpässe mit Quelle',
    beschr: 'Lieferengpässe bei Arzneimitteln mit Quelle: Behördenlisten und Meldungen aus Apotheken, Benachrichtigung bei jeder Änderung, eigene Liste prüfen — für Apotheken, Großhandel und Einkauf.',
    og: 'Behördenlisten und Meldungen aus Apotheken — aktuell, verständlich, mit Benachrichtigung bei jeder Änderung.',
  },
  en: {
    titel: 'ApoPulse — medicine shortages with sources',
    beschr: 'Medicine shortages with sources: official lists and reports from pharmacies, an alert on every change, check your own list — for pharmacies, wholesale and purchasing.',
    og: 'Official lists and reports from pharmacies — current, clear, with an alert on every change.',
  },
  pt: {
    titel: 'ApoPulse — ruturas de medicamentos com fonte',
    beschr: 'Ruturas de medicamentos com fonte: listas oficiais e comunicações de farmácias, alerta a cada alteração, verificar a sua lista — para farmácias, distribuição e compras.',
    og: 'Listas oficiais e comunicações de farmácias — atuais, claras, com alerta a cada alteração.',
  },
  fr: {
    titel: 'ApoPulse — pénuries de médicaments avec sources',
    beschr: 'Pénuries de médicaments avec sources : listes officielles et signalements des pharmacies, alerte à chaque changement, vérification de votre propre liste — pour pharmacies, grossistes et achats.',
    og: 'Listes officielles et signalements des pharmacies — à jour, clairs, avec une alerte à chaque changement.',
  },
  ar: {
    titel: 'ApoPulse — نقص الأدوية مع المصادر',
    beschr: 'نقص الأدوية مع المصادر: قوائم رسمية وبلاغات من الصيدليات، تنبيه عند كل تغيير، فحص قائمتك الخاصة — للصيدليات وتجارة الجملة والمشتريات.',
    og: 'قوائم رسمية وبلاغات من الصيدليات — محدّثة وواضحة، مع تنبيه عند كل تغيير.',
  },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Bevorzugte unterstützte Sprache aus Accept-Language; sonst Englisch. */
export function kopfSprache(acceptLanguage) {
  for (const teil of String(acceptLanguage || '').split(',')) {
    const l = teil.trim().slice(0, 2).toLowerCase();
    if (KOPF[l]) return l;
  }
  return 'en';
}

/** index.html mit lokalisiertem Kopf. Unbekannter Aufbau -> unverändert (nie kaputt). */
export function startseiteKopf(html, { sp = 'en', basis = '' } = {}) {
  const K = KOPF[sp] || KOPF.en;
  return String(html)
    .replace(/<html lang="[a-z]{2}"( dir="[a-z]{3}")?>/, `<html lang="${sp}" dir="${richtung(sp)}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(K.titel)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(K.beschr)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(K.titel)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(K.og)}" />`)
    .replace(/<meta property="og:image" content="\/og-bild\.png" \/>/, `<meta property="og:image" content="${esc(basis)}/og-bild.png" />`);
}

// ── Manifest (App auf dem Startbildschirm) ───────────────────────────────────
//  Name, Beschreibung und Schnellzugriffe (langes Drücken auf das App-Symbol)
//  standen nur deutsch da — auch auf Handys in Uganda.
const MANIFEST = {
  de: {
    name: 'ApoPulse – Lieferengpässe mit Quelle',
    description: 'Lieferengpässe bei Arzneimitteln mit Quelle: Behördenlisten und Meldungen aus Apotheken, Benachrichtigung bei jeder Änderung.',
    kurz: { shortages: ['Lieferengpässe', 'Engpässe', 'Aktuelle Engpässe ansehen und melden'], overview: ['Für dich', 'Für dich', 'Deine Startübersicht mit Beobachtungsliste'], news: ['News', 'News', 'Behörden-Meldungen mit Quelle'] },
    bilder: ['Lieferengpässe mit Quelle und Datum', 'Startübersicht: was heute zählt', 'Behörden-News mit Quellenangabe'],
  },
  en: {
    name: 'ApoPulse – medicine shortages with sources',
    description: 'Medicine shortages with sources: official lists and reports from pharmacies, an alert on every change.',
    kurz: { shortages: ['Shortages', 'Shortages', 'See and report current shortages'], overview: ['For you', 'For you', 'Your overview with watched substances'], news: ['News', 'News', 'Authority notices with sources'] },
    bilder: ['Shortages with source and date', 'Overview: what matters today', 'Authority news with sources'],
  },
  pt: {
    name: 'ApoPulse – ruturas de medicamentos com fonte',
    description: 'Ruturas de medicamentos com fonte: listas oficiais e comunicações de farmácias, alerta a cada alteração.',
    kurz: { shortages: ['Ruturas', 'Ruturas', 'Ver e comunicar ruturas atuais'], overview: ['Para si', 'Para si', 'A sua visão geral com substâncias acompanhadas'], news: ['Notícias', 'Notícias', 'Avisos das autoridades com fonte'] },
    bilder: ['Ruturas com fonte e data', 'Visão geral: o que conta hoje', 'Notícias das autoridades com fonte'],
  },
  fr: {
    name: 'ApoPulse – pénuries de médicaments avec sources',
    description: 'Pénuries de médicaments avec sources : listes officielles et signalements des pharmacies, alerte à chaque changement.',
    kurz: { shortages: ['Pénuries', 'Pénuries', 'Voir et signaler les pénuries actuelles'], overview: ['Pour vous', 'Pour vous', 'Votre vue d’ensemble avec les substances suivies'], news: ['Actualités', 'Actualités', 'Communications des autorités avec sources'] },
    bilder: ['Pénuries avec source et date', 'Vue d’ensemble : ce qui compte aujourd’hui', 'Actualités des autorités avec sources'],
  },
  ar: {
    name: 'ApoPulse – نقص الأدوية مع المصادر',
    description: 'نقص الأدوية مع المصادر: قوائم رسمية وبلاغات من الصيدليات، تنبيه عند كل تغيير.',
    kurz: { shortages: ['النقص', 'النقص', 'عرض حالات النقص الحالية والإبلاغ عنها'], overview: ['لك', 'لك', 'نظرتك العامة مع المواد المتابَعة'], news: ['الأخبار', 'الأخبار', 'بلاغات الجهات الرسمية مع المصادر'] },
    bilder: ['النقص مع المصدر والتاريخ', 'نظرة عامة: ما يهم اليوم', 'أخبار الجهات الرسمية مع المصادر'],
  },
};

/** manifest.webmanifest in der Sprache sp. Unlesbares JSON -> unverändert. */
export function manifestSprache(text, sp = 'en') {
  const M = MANIFEST[sp] || MANIFEST.en;
  let m;
  try { m = JSON.parse(text); } catch { return text; }
  m.name = M.name; m.description = M.description; m.lang = sp; m.dir = richtung(sp);
  // Nur Schnellzugriffe, die überall Inhalt haben (Preise gibt es nicht in jedem Land).
  m.shortcuts = (m.shortcuts || []).map((s) => {
    const tab = (String(s.url || '').match(/tab=([a-z]+)/) || [])[1];
    const k = M.kurz[tab];
    return k ? { ...s, name: k[0], short_name: k[1], description: k[2] } : null;
  }).filter(Boolean);
  m.screenshots = (m.screenshots || []).filter((b) => !/preise/.test(b.src)).map((b, i) => ({ ...b, label: M.bilder[i] || b.label }));
  return JSON.stringify(m, null, 2);
}
