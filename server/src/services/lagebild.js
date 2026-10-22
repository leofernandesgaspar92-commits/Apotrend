// ============================================================================
//  Lagebild je Land — KI fasst zusammen, die Quellen belegen
// ============================================================================
//  Die Frage, mit der jemand auf „Nigeria" klickt: Was ist dort los, und
//  warum? Die Antwort steht verstreut in Behördenmeldungen und Presseartikeln.
//  Das Lagebild fasst sie in wenigen Punkten zusammen.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE KI ERFINDET NICHTS, WEIL SIE NICHTS ANDERES BEKOMMT — UND WEIL GEPRÜFT WIRD
//  ──────────────────────────────────────────────────────────────────────────
//   1. Das Modell bekommt NUR nummerierte Meldungen mit Quelle. Kein
//      Allgemeinwissen ist erbeten; der Auftrag verbietet es ausdrücklich.
//   2. Jeder Punkt muss Belegnummern nennen. Der SERVER prüft das: Ein Punkt
//      ohne gültige Belegnummer wird verworfen — egal, wie plausibel er klingt.
//      Eine Aussage ohne Quelle ist hier keine Aussage.
//   3. Unter jedem Punkt stehen seine Quellen mit Link. Wer zweifelt, liest
//      nach; die Oberfläche sagt, dass die Quellen maßgeblich sind.
//   4. Zu wenig Quellen -> kein Lagebild. Ehrlich benannt, nicht aufgefüllt.
//
//  Was das NICHT garantiert: dass das Modell eine Quelle richtig wiedergibt.
//  Das lässt sich maschinell nicht prüfen (die Quelle ist englisch, der Punkt
//  deutsch). Deshalb Punkt 3 — die Prüfung bleibt beim Menschen, und die
//  Oberfläche macht sie einen Klick weit.
//
//  Behörde und Presse werden im Auftrag GEKENNZEICHNET. Ein Punkt, der nur auf
//  Presse beruht, ist eine Pressemeldung, keine Behördenaussage — und soll so
//  formuliert sein („laut Medienberichten").
// ============================================================================

import { aiKonfiguration, frageAnbieter, parseAiAntwort } from './aiExtract.js';
import { COUNTRIES } from '../data/countries.js';
import { landPasst } from './signalAlerts.js';

export const SPRACHEN = ['de', 'en', 'pt', 'fr', 'ar'];
export const MIN_BELEGE = 2;
export const MAX_BELEGE = 24;
export const MAX_PUNKTE = 6;

const SPRACHNAME = { de: 'Deutsch', en: 'English', pt: 'Português', fr: 'Français', ar: 'العربية' };

export const LAGEBILD_HINWEIS = {
  de: 'KI-Zusammenfassung der verlinkten Meldungen. Jede Aussage nennt ihre Quellen — maßgeblich sind die Quellen selbst, nicht diese Zusammenfassung.',
  en: 'AI summary of the linked reports. Every statement names its sources — the sources themselves are authoritative, not this summary.',
  pt: 'Resumo por IA das notícias com ligação. Cada afirmação indica as suas fontes — as fontes são determinantes, não este resumo.',
  fr: 'Résumé par IA des communications en lien. Chaque affirmation indique ses sources — ce sont les sources qui font foi, pas ce résumé.',
  ar: 'ملخص بالذكاء الاصطناعي للبلاغات المرتبطة. كل إفادة تذكر مصادرها — المصادر نفسها هي المرجع، لا هذا الملخص.',
};

/**
 * Belege sammeln: Behördenmeldungen des Landes (inkl. EU für EU-Länder) und
 * Presseartikel, neueste zuerst, nummeriert ab 1.
 */
export function belegeSammeln(land, signale, artikel, { max = MAX_BELEGE } = {}) {
  const amtlich = (signale || [])
    .filter((s) => s && s.originalUrl && landPasst(s.country, land))
    .map((s) => ({
      herkunft: 'behoerde',
      titel: s.title,
      text: s.summaryDe || s.summary || '',
      url: s.originalUrl,
      quelle: s.sourceName || null,
      datum: s.publishedAt || s.verifiedAt || null,
    }));
  const presse = (artikel || [])
    .filter((a) => a && a.url && a.titel)
    .map((a) => ({ herkunft: 'presse', titel: a.titel, text: '', url: a.url, quelle: a.quelle || null, datum: a.datum || null }));
  const alle = [...amtlich, ...presse]
    .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
  // Behörden zuerst sicherstellen: Bei viel Presse sollen amtliche Meldungen
  // nicht aus dem Fenster fallen.
  const auswahl = [...alle.filter((b) => b.herkunft === 'behoerde').slice(0, Math.ceil(max / 2))];
  for (const b of alle) { if (auswahl.length >= max) break; if (!auswahl.includes(b)) auswahl.push(b); }
  return auswahl
    .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')))
    .map((b, i) => ({ nr: i + 1, ...b }));
}

export const LAGEBILD_SYSTEM = 'Du fasst Meldungen zur Arzneimittelversorgung für Fachleute zusammen '
  + '(Apotheken, Großhandel, Logistik). Du verwendest AUSSCHLIESSLICH die nummerierten Meldungen, die du '
  + 'bekommst — kein Allgemeinwissen, keine Vermutungen, keine Ursachen, die nicht in den Meldungen stehen. '
  + 'Jeder Punkt nennt die Nummern der Meldungen, auf denen er beruht. Beruht ein Punkt nur auf Presse, '
  + 'formuliere ihn als Medienbericht („laut Medienberichten"). Widersprechen sich Meldungen, sag das. '
  + 'Gibt es nichts Belegbares, gib eine leere Liste zurück. Antworte nur mit JSON.';

export function lagebildAuftrag(land, sprache, belege) {
  const name = (COUNTRIES[land] && COUNTRIES[land].name) || land;
  const zeilen = belege.map((b) => {
    const art = b.herkunft === 'behoerde' ? 'BEHÖRDE' : 'PRESSE';
    const kopf = `[${b.nr}] (${art}${b.quelle ? ', ' + b.quelle : ''}${b.datum ? ', ' + String(b.datum).slice(0, 10) : ''}) ${b.titel}`;
    return b.text ? `${kopf}\n    ${String(b.text).slice(0, 500).replace(/\s+/g, ' ')}` : kopf;
  });
  return `Land: ${name} (${land})\nSprache der Antwort: ${SPRACHNAME[sprache] || 'Deutsch'}\n\n`
    + `Meldungen:\n${zeilen.join('\n')}\n\n`
    + `Fasse die Lage der Arzneimittelversorgung in ${name} in höchstens ${MAX_PUNKTE} Punkten zusammen `
    + '(Engpässe und ihre GENANNTEN Ursachen, Rückrufe, Regulierung, Industrie, Handel). '
    + 'Antwortformat: {"punkte":[{"text":"…","belege":[1,3]}]}';
}

/**
 * Modellantwort prüfen. Das ist die eigentliche Schutzschicht.
 *
 *  · `belege` muss gültige Nummern enthalten (1..N) — sonst fliegt der Punkt.
 *  · Links im Text werden entfernt: Die einzigen Links sind die der Belege.
 *  · Mehr als MAX_PUNKTE werden abgeschnitten.
 */
export function pruefeLagebild(roh, belege) {
  const d = parseAiAntwort(roh);
  const punkte = d && Array.isArray(d.punkte) ? d.punkte : [];
  const gueltig = new Map(belege.map((b) => [b.nr, b]));
  const out = [];
  let verworfen = 0;
  for (const p of punkte) {
    const text = String((p && p.text) || '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);
    const nrn = [...new Set([].concat((p && p.belege) || []).map((n) => Number(n)))]
      .filter((n) => Number.isInteger(n) && gueltig.has(n));
    if (!text || !nrn.length) { verworfen++; continue; }
    out.push({
      text,
      quellen: nrn.map((n) => {
        const b = gueltig.get(n);
        return { nr: n, herkunft: b.herkunft, titel: b.titel, url: b.url, quelle: b.quelle, datum: b.datum };
      }),
    });
    if (out.length >= MAX_PUNKTE) break;
  }
  return { punkte: out, verworfen };
}

const einfacherHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/**
 * Lagebild-Dienst.
 *
 * Zwischengespeichert je Land + Sprache + BELEGSTAND: Solange keine neue
 * Meldung dazukommt, gibt es keinen neuen Aufruf. Das hält die Kosten bei
 * „einmal je neuer Nachrichtenlage", nicht „einmal je Seitenaufruf".
 * Fehlschläge werden nicht gespeichert.
 */
export function createLagebildDienst({
  presse, signale, env = process.env, frage = frageAnbieter,
  jetzt = () => Date.now(), gueltigMs = 6 * 60 * 60 * 1000,
} = {}) {
  const speicher = new Map();

  return {
    verfuegbar: () => !!aiKonfiguration(env),

    async fuerLand(land, { sprache = 'de' } = {}) {
      const cc = String(land || '').toUpperCase();
      const lang = SPRACHEN.includes(sprache) ? sprache : 'de';
      const basis = { land: cc, sprache: lang, punkte: [], quellen_gesamt: 0, hinweis: LAGEBILD_HINWEIS[lang] };

      const cfg = aiKonfiguration(env);
      if (!cfg) return { ...basis, verfuegbar: false, grund: 'ki_aus' };

      const p = presse ? await presse.fuerLand(cc) : { artikel: [] };
      const belege = belegeSammeln(cc, signale ? signale(cc) : [], p.artikel || []);
      const stand = { ...basis, quellen_gesamt: belege.length, presse_grund: p.grund || null };
      if (belege.length < MIN_BELEGE) return { ...stand, verfuegbar: false, grund: 'zu_wenig_quellen' };

      const schluessel = `${cc}|${lang}|${einfacherHash(belege.map((b) => b.url).join('\n'))}`;
      const gemerkt = speicher.get(schluessel);
      if (gemerkt && gemerkt.bis > jetzt()) return { ...gemerkt.ergebnis, zwischengespeichert: true };

      let roh;
      try {
        roh = await frage(cfg, lagebildAuftrag(cc, lang, belege), { system: LAGEBILD_SYSTEM });
      } catch (e) {
        return { ...stand, verfuegbar: false, grund: 'ki_fehler', fehler: String((e && e.message) || e).slice(0, 160) };
      }
      const { punkte, verworfen } = pruefeLagebild(roh, belege);
      if (!punkte.length) return { ...stand, verfuegbar: false, grund: 'keine_belegte_aussage', verworfen };

      const ergebnis = { ...stand, verfuegbar: true, grund: null, punkte, verworfen, erstellt: new Date(jetzt()).toISOString() };
      speicher.set(schluessel, { bis: jetzt() + gueltigMs, ergebnis });
      return ergebnis;
    },
  };
}
