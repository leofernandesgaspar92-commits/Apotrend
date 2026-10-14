// ============================================================================
//  Kopf der Startseite (index.html) in der Sprache des Browsers
// ============================================================================
//  Wer apopulse.com per WhatsApp teilt, bekam immer eine DEUTSCHE Vorschau:
//  „Lieferengpässe mit Quelle — Behördenlisten aus Europa". Für den Start in
//  Afrika die falsche Botschaft, und das Vorschaubild hatte eine relative
//  Adresse (manche Messenger zeigen dann keins).
//
//  Jetzt: Titel, Beschreibung und Open-Graph-Angaben nach Accept-Language
//  (de/en/pt; ohne passende Angabe Englisch — die Plattform ist international),
//  Bild mit absoluter Adresse. Der Inhalt der App bleibt unverändert; die
//  App-Sprache folgt weiterhin dem gewählten Land.
// ============================================================================

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
    .replace(/<html lang="[a-z]{2}">/, `<html lang="${sp}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(K.titel)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(K.beschr)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(K.titel)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(K.og)}" />`)
    .replace(/<meta property="og:image" content="\/og-bild\.png" \/>/, `<meta property="og:image" content="${esc(basis)}/og-bild.png" />`);
}
