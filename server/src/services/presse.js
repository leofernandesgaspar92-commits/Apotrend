// ============================================================================
//  Presse je Land — was Zeitungen und Fachmedien eines Landes berichten
// ============================================================================
//  Behörden melden WAS (Rückruf, Engpass, Zulassung). Das WARUM steht fast nie
//  dort: warum Nigeria knapp ist (Devisen, Importabhängigkeit), was Roche Neues
//  hat, wie eine Sperrung der Straße von Hormus die Herstellung in Kanada
//  trifft. Das steht in der Presse des jeweiligen Landes.
//
//  ──────────────────────────────────────────────────────────────────────────
//  QUELLE: GDELT DOC 2.0
//  ──────────────────────────────────────────────────────────────────────────
//  Das GDELT-Projekt erfasst Online-Nachrichten weltweit in über 65 Sprachen
//  und stellt die Abfrage frei und ohne Schlüssel zur Verfügung. Entscheidend
//  ist `sourcecountry:` — damit kommen Artikel aus Medien DES LANDES, nicht
//  Artikel, in denen das Land vorkommt. „Nigeria" heißt hier: nigerianische
//  Presse über Arzneimittel.
//
//  Von hier aus NICHT geprüft (kein Netzzugang in der Bauumgebung). Deshalb:
//   · Jede Länder-Abfrage ist ohne Deploy ersetzbar:
//       APOPULSE_PRESSE_QUERY_NG='(pharmaceutical OR …) sourcecountry:nigeria'
//   · Ganz abschaltbar: APOPULSE_PRESSE=aus
//   · Ein Fehlschlag sagt WARUM (`fehler`), statt still leer zu sein.
//
//  ──────────────────────────────────────────────────────────────────────────
//  PRESSE IST NICHT BEHÖRDE — UND BLEIBT GETRENNT
//  ──────────────────────────────────────────────────────────────────────────
//  Presseartikel landen NICHT im Behörden-Feed und NICHT im VerifiedSignal-
//  Speicher. Beide sind für amtliche Meldungen da; ein Zeitungsartikel, den die
//  Redaktion „postet", sähe aus wie eine Behördenmeldung. Jeder Artikel trägt
//  `herkunft: 'presse'` und den Namen des Mediums (Domain), und die
//  Oberfläche sagt „Presse — keine Behördenmeldung".
//
//  Übernommen werden Titel, Link, Medium, Datum, Sprache. Kein Volltext, kein
//  Umformulieren.
// ============================================================================

import { fetchWithRetry, fetchTextDefault } from './sources.js';

/** GDELT kennt Länder unter ihrem englischen Namen ohne Leerzeichen. */
export const GDELT_LAND = Object.freeze({
  AT: 'austria', DE: 'germany', CH: 'switzerland', LI: 'liechtenstein',
  PT: 'portugal', BR: 'brazil', AO: 'angola', MZ: 'mozambique',
  GB: 'unitedkingdom', US: 'unitedstates', CA: 'canada', AU: 'australia',
  NG: 'nigeria', KE: 'kenya', GH: 'ghana', ZA: 'southafrica',
  UG: 'uganda', TZ: 'tanzania', ZM: 'zambia', ZW: 'zimbabwe', RW: 'rwanda', BW: 'botswana',
  NA: 'namibia', MW: 'malawi', ET: 'ethiopia', SL: 'sierraleone', LR: 'liberia', GM: 'gambia',
  // Zweite Welle 10/2026. GDELT-Ländernamen ohne Leerzeichen; Eswatini führt GDELT unter
  // dem alten Namen. Falls eine Suche leer bleibt: APOPULSE_PRESSE_QUERY_<LAND> überschreibt.
  LS: 'lesotho', SZ: 'swaziland', MU: 'mauritius', SC: 'seychelles', SS: 'southsudan', ER: 'eritrea',
  CV: 'capeverde', GW: 'guineabissau', ST: 'saotomeandprincipe',
});

/**
 * Suchwörter je Sprache. Bewusst ohne das nackte „drug": Das holt im
 * Englischen jede Drogenrazzia herein. Phrasen in Anführungszeichen.
 */
export const SUCHWOERTER = Object.freeze({
  de: ['Arzneimittel', 'Medikamente', 'Apotheke', 'Apotheken', 'Lieferengpass', 'Pharmaindustrie'],
  pt: ['medicamentos', 'farmácia', 'farmácias', 'farmacêutica', '"falta de medicamentos"', '"rutura de medicamentos"'],
  en: ['pharmaceutical', 'pharmaceuticals', 'pharmacy', 'medicines', '"drug shortage"', '"medicine shortage"'],
  fr: ['médicaments', 'pharmacie', 'pharmacies', 'pharmaceutique', '"pénurie de médicaments"', '"rupture de médicaments"'],
});

/** Welche Sprachen die Presse eines Landes schreibt (Reihenfolge egal). */
const LAND_SPRACHEN = Object.freeze({
  AT: ['de'], DE: ['de'], LI: ['de'], CH: ['de', 'fr', 'en'],
  PT: ['pt'], BR: ['pt'], AO: ['pt'], MZ: ['pt', 'en'],
  GB: ['en'], US: ['en'], CA: ['en', 'fr'], AU: ['en'],
  NG: ['en'], KE: ['en'], GH: ['en'], ZA: ['en'],
  UG: ['en'], TZ: ['en'], ZM: ['en'], ZW: ['en'], RW: ['en'], BW: ['en'],
  NA: ['en'], MW: ['en'], ET: ['en'], SL: ['en'], LR: ['en'], GM: ['en'],
  // Mauritius und Seychellen: Presse überwiegend bzw. teils französisch.
  LS: ['en'], SZ: ['en'], MU: ['en', 'fr'], SC: ['en', 'fr'], SS: ['en'], ER: ['en'],
  CV: ['pt'], GW: ['pt'], ST: ['pt'],
});

export const presseEnv = (land) => `APOPULSE_PRESSE_QUERY_${String(land).toUpperCase()}`;

/** Die Abfrage für ein Land — oder null, wenn das Land nicht abgedeckt ist. */
export function presseQuery(land, env = process.env) {
  const cc = String(land || '').toUpperCase();
  const eigene = String(env[presseEnv(cc)] || '').trim();
  if (eigene) return eigene;
  const name = GDELT_LAND[cc];
  if (!name) return null;
  const woerter = [...new Set((LAND_SPRACHEN[cc] || ['en']).flatMap((s) => SUCHWOERTER[s] || []))];
  return `(${woerter.join(' OR ')}) sourcecountry:${name}`;
}

export function presseUrl(land, { env = process.env, zeitraum = '14d', max = 50 } = {}) {
  const q = presseQuery(land, env);
  if (!q) return null;
  const p = new URLSearchParams({
    query: q, mode: 'artlist', format: 'json', sort: 'datedesc',
    maxrecords: String(max), timespan: zeitraum,
  });
  return 'https://api.gdeltproject.org/api/v2/doc/doc?' + p.toString();
}

/** `20261011T123000Z` -> ISO. Anderes -> null (nicht raten). */
export function gdeltDatum(wert) {
  const m = String(wert || '').trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const normTitel = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * GDELT-Antwort in Artikel wandeln.
 *
 * Verworfen wird, was keinen http(s)-Link oder keinen Titel hat. Doppelte
 * werden entfernt — auch über den TITEL, weil Agenturmeldungen in zehn
 * Zeitungen wortgleich erscheinen und sonst die Liste füllen.
 *
 * Wirft bei unlesbarer Antwort: GDELT antwortet auf eine fehlerhafte Abfrage
 * mit HTTP 200 und einem Klartext-Satz statt JSON. Der Satz gehört in die
 * Fehlermeldung, sonst sucht beim nächsten Mal wieder jemand im Dunkeln.
 */
export function artikelAusGdelt(roh) {
  let d;
  try { d = typeof roh === 'string' ? JSON.parse(roh) : roh; } catch {
    throw new Error('Antwort ist kein JSON: ' + String(roh || '').trim().slice(0, 160));
  }
  const liste = d && Array.isArray(d.articles) ? d.articles : [];
  const out = [];
  const urls = new Set();
  const titel = new Set();
  for (const a of liste) {
    if (!a || typeof a !== 'object') continue;
    const url = String(a.url || '').trim();
    const t = String(a.title || '').trim();
    if (!/^https?:\/\//i.test(url) || !t) continue;
    const nt = normTitel(t);
    if (urls.has(url) || titel.has(nt)) continue;
    urls.add(url); titel.add(nt);
    let quelle = String(a.domain || '').trim();
    if (!quelle) { try { quelle = new URL(url).hostname; } catch { quelle = ''; } }
    out.push({
      herkunft: 'presse',
      titel: t.length > 240 ? t.slice(0, 237) + '…' : t,
      url,
      quelle: quelle.replace(/^www\./, ''),
      datum: gdeltDatum(a.seendate),
      sprache: String(a.language || '').trim() || null,
    });
  }
  return out;
}

/**
 * Presse je Land, mit Zwischenspeicher.
 *
 * Abgerufen wird auf Anfrage, nicht im Hintergrund für alle Länder: Ein Land,
 * das niemand ansieht, braucht keinen Abruf. GDELT bittet um Abstand zwischen
 * Abfragen — der Mindestabstand je Host (sources.js) gilt auch hier.
 *
 * Ein Fehlschlag wird nur KURZ gemerkt (5 Minuten): lang genug, um GDELT nicht
 * mit Wiederholungen zu belasten, kurz genug, dass eine vorübergehende Störung
 * nicht stundenlang als „keine Presse" stehen bleibt.
 */
export function createPresseDienst({
  env = process.env,
  holen = (url) => fetchWithRetry(url, {
    attempts: 2,
    fetchText: (u) => fetchTextDefault(u, { timeoutMs: 20_000, minHostGapMs: 6_000, headers: { accept: 'application/json' } }),
  }),
  jetzt = () => Date.now(),
  gueltigMs = 60 * 60 * 1000,
  fehlerGueltigMs = 5 * 60 * 1000,
} = {}) {
  const speicher = new Map(); // land -> { bis, ergebnis }

  return {
    abgedeckt: (land) => !!presseQuery(land, env),

    async fuerLand(land) {
      const cc = String(land || '').toUpperCase();
      if (String(env.APOPULSE_PRESSE || '').trim().toLowerCase() === 'aus') {
        return { land: cc, artikel: [], grund: 'abgeschaltet', quelle: 'GDELT' };
      }
      const url = presseUrl(cc, { env });
      if (!url) return { land: cc, artikel: [], grund: 'land_nicht_abgedeckt', quelle: 'GDELT' };

      const gemerkt = speicher.get(cc);
      if (gemerkt && gemerkt.bis > jetzt()) return { ...gemerkt.ergebnis, zwischengespeichert: true };

      let ergebnis;
      try {
        const artikel = artikelAusGdelt(await holen(url));
        ergebnis = {
          land: cc, artikel, quelle: 'GDELT', abgerufen: new Date(jetzt()).toISOString(),
          // „Nichts gefunden" ist ein Ergebnis, kein Fehler — und anders
          // zu benennen als „nicht erreichbar".
          grund: artikel.length ? null : 'keine_artikel',
        };
        speicher.set(cc, { bis: jetzt() + gueltigMs, ergebnis });
      } catch (e) {
        ergebnis = { land: cc, artikel: [], quelle: 'GDELT', grund: 'nicht_erreichbar', fehler: String((e && e.message) || e).slice(0, 200) };
        speicher.set(cc, { bis: jetzt() + fehlerGueltigMs, ergebnis });
      }
      return ergebnis;
    },
  };
}
