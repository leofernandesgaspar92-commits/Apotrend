// ============================================================================
//  KI-Extraktion — aus Behördentext werden Felder
// ============================================================================
//  WAS DIESES MODUL DARF UND WAS NICHT
//
//  Darf:  Wirkstoff (INN) und Handelsnamen vorschlagen, Schweregrad und
//         Ursache einordnen, einen Gültigkeitszeitraum lesen, zusammenfassen
//         und in de/en/pt übersetzen.
//
//  Darf NICHT:  bestimmen, WOHER eine Meldung stammt.
//
//  Die zweite Zeile ist die wichtigere. `originalUrl` und `sourceName` kommen
//  mechanisch aus dem Abruf — welche Adresse wurde geholt, welche Quelle steht
//  im Register. Eine KI, die eine Quelle „erkennt", erfindet im Zweifel eine
//  plausible. Dann stünde unter einer Engpassmeldung ein Behördenname, der nie
//  etwas dazu gesagt hat, und eine Apotheke bestellt danach um.
//
//  Dieses Modul bekommt die Herkunft deshalb gar nicht erst zu sehen und gibt
//  sie auch nicht zurück. Ein Test hält das fest.
//
//  ──────────────────────────────────────────────────────────────────────────
//  OHNE SCHLÜSSEL LÄUFT ALLES WEITER
//  ──────────────────────────────────────────────────────────────────────────
//  Ist kein Anbieter konfiguriert, liefert `extractSignal` die Meldung
//  UNVERÄNDERT zurück: Titel, Anriss, Link, Quelle — also genau das, was die
//  Plattform heute schon kann —, mit `confidence: 0` und `aiUsed: false`.
//
//  Das ist Absicht und keine Notlösung. Die KI ist eine Verbesserung der
//  Darstellung, nicht die Grundlage der Aussage. Wer sie zur Voraussetzung
//  macht, hat bei jeder Störung beim Anbieter keinen Engpassdienst mehr —
//  und bezahlt pro Meldung dafür, dass eine Behörde ohnehin schon strukturiert
//  geliefert hat.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WARUM `confidenceScore` NICHT VON DER KI KOMMT
//  ──────────────────────────────────────────────────────────────────────────
//  Ein Sprachmodell nach seiner eigenen Sicherheit zu fragen, liefert eine
//  Zahl, die gut klingt und nichts misst — sie korreliert mit der Flüssigkeit
//  der Antwort, nicht mit ihrer Richtigkeit. Der Wert hier wird deshalb aus
//  ÜBERPRÜFBAREN Merkmalen gerechnet (siehe `bewerteExtraktion`): Steht der
//  genannte Wirkstoff überhaupt im Originaltext? Ist der Schweregrad einer der
//  erlaubten Werte? Ergibt der Zeitraum eine Reihenfolge?
// ============================================================================

import { AI_SYSTEM_PROMPT, baueAuftrag } from './aiPrompt.js';

/** Erlaubte Werte. Alles andere wird verworfen, nicht übernommen. */
export const KATEGORIEN = ['SHORTAGE', 'REGULATORY', 'RECALL', 'NEWS'];
export const SCHWEREGRADE = ['kritisch', 'eingeschraenkt', 'verfuegbar', 'unbekannt'];
export const SPRACHEN = ['de', 'en', 'pt'];

/** Umgebungsvariablen. */
export const AI_ENV = {
  anbieter: 'APOPULSE_AI_PROVIDER',      // 'anthropic' | 'openai' | leer = aus
  schluessel: 'APOPULSE_AI_API_KEY',
  modell: 'APOPULSE_AI_MODEL',
  zeitlimit: 'APOPULSE_AI_TIMEOUT_MS',
};

/**
 * Welcher Anbieter ist konfiguriert? `null` heißt: keiner — und das ist in
 * Ordnung.
 */
export function aiKonfiguration(env = process.env) {
  const anbieter = String(env[AI_ENV.anbieter] || '').trim().toLowerCase();
  const schluessel = String(env[AI_ENV.schluessel] || '').trim();
  if (!anbieter || !schluessel) return null;
  if (!['anthropic', 'openai'].includes(anbieter)) return null;
  return {
    anbieter,
    schluessel,
    modell: String(env[AI_ENV.modell] || '').trim()
      || (anbieter === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'),
    zeitlimit: Number(env[AI_ENV.zeitlimit]) || 20_000,
  };
}

// ── Rohantwort auswerten ────────────────────────────────────────────────────

/**
 * JSON aus einer Modellantwort holen.
 *
 * Modelle rahmen JSON gern in ```json … ``` oder stellen einen Satz davor.
 * Beides wird abgeräumt. Was dann nicht parst, gilt als Fehlschlag — es wird
 * NICHT versucht, aus Textfragmenten Felder zu raten.
 */
export function parseAiAntwort(text) {
  const roh = String(text || '').trim();
  if (!roh) return null;
  const ohneZaun = roh.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = ohneZaun.indexOf('{');
  const ende = ohneZaun.lastIndexOf('}');
  if (start === -1 || ende <= start) return null;
  try { return JSON.parse(ohneZaun.slice(start, ende + 1)); } catch { return null; }
}

const text = (v, max = 400) => {
  const s = String(v ?? '').trim();
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'unbekannt' ? s.slice(0, max) : null;
};

const datum = (v) => {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.length === 10 ? s + 'T00:00:00Z' : s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Modellantwort in geprüfte Felder überführen.
 * Unbekannte Werte werden VERWORFEN, nicht durchgereicht.
 */
export function normalisiereExtraktion(roh) {
  const o = roh && typeof roh === 'object' ? roh : {};
  const kategorie = KATEGORIEN.includes(String(o.category || '').toUpperCase())
    ? String(o.category).toUpperCase() : null;
  const schweregrad = SCHWEREGRADE.includes(String(o.schweregrad || '').toLowerCase())
    ? String(o.schweregrad).toLowerCase() : null;
  const uebersetzungen = {};
  for (const sp of SPRACHEN) {
    const v = text(o.summaries && o.summaries[sp], 1200);
    if (v) uebersetzungen[sp] = v;
  }
  return {
    wirkstoff: text(o.wirkstoff, 160),
    handelsname: text(o.handelsname, 200),
    schweregrad,
    ursache: text(o.ursache, 300),
    kategorie,
    gueltigVon: datum(o.gueltig_von),
    gueltigBis: datum(o.gueltig_bis),
    uebersetzungen,
  };
}

/**
 * Vertrauenswert aus ÜBERPRÜFBAREN Merkmalen — nicht aus der Selbstauskunft
 * des Modells. Siehe Dateikopf.
 *
 * Gewichtung bewusst flach: Der Wert soll grob trennen („vollständig und
 * plausibel" vs. „dünn"), nicht so tun, als sei er eine Messung.
 */
export function bewerteExtraktion(e, originaltext) {
  const quelle = String(originaltext || '').toLowerCase();
  let punkte = 0;
  let moeglich = 0;

  const pruefe = (bedingung, gewicht = 1) => { moeglich += gewicht; if (bedingung) punkte += gewicht; };

  // Der schwerste Punkt: Steht der genannte Wirkstoff ÜBERHAUPT im Original?
  // Ein Wirkstoff, der im Quelltext nicht vorkommt, ist der klassische Fall
  // einer frei erfundenen Angabe.
  pruefe(!!e.wirkstoff && quelle.includes(e.wirkstoff.toLowerCase().split(/\s|,/)[0]), 3);
  pruefe(!!e.kategorie, 2);
  pruefe(!!e.schweregrad, 1);
  pruefe(!!e.ursache, 1);
  // Zeitraum nur dann ein Pluspunkt, wenn er eine Reihenfolge ergibt.
  pruefe(!e.gueltigVon || !e.gueltigBis || e.gueltigVon <= e.gueltigBis, 1);
  pruefe(Object.keys(e.uebersetzungen).length >= 2, 2);

  return moeglich ? Math.round((punkte / moeglich) * 100) / 100 : 0;
}

// ── Anbieter ────────────────────────────────────────────────────────────────

/**
 * Ein Aufruf beim Anbieter. Gibt den reinen Antworttext zurück.
 * Provider-agnostisch wie bei Zahlungen und Social-Login: Die Fachlogik
 * darüber weiß nicht, wer antwortet.
 */
/**
 * Einen Auftrag an den Anbieter schicken.
 *
 * `system` ist ueberschreibbar, weil es einen ZWEITEN Auftrag gibt: das
 * Uebersetzen (services/aiTranslate.js). Beide teilen den Netzaufruf, die
 * Zeitgrenze und die Anbieterwahl — aber nicht den Auftragstext. Den
 * Extraktions-Prompt fuer eine Uebersetzung zu verwenden hiesse, ein Modell um
 * JSON mit Wirkstoff und Schweregrad zu bitten und eine Uebersetzung zu
 * erwarten.
 */
export async function frageAnbieter(cfg, auftrag, { fetchImpl = globalThis.fetch, system = AI_SYSTEM_PROMPT } = {}) {
  const signal = AbortSignal.timeout(cfg.zeitlimit);
  if (cfg.anbieter === 'anthropic') {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.schluessel,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.modell, max_tokens: 1500, system,
        messages: [{ role: 'user', content: auftrag }],
      }),
    });
    if (!r.ok) throw new Error('KI-Anbieter antwortete mit HTTP ' + r.status);
    const d = await r.json();
    return (d.content || []).map((c) => c.text || '').join('');
  }
  const r = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.schluessel },
    body: JSON.stringify({
      model: cfg.modell, max_tokens: 1500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: auftrag },
      ],
    }),
  });
  if (!r.ok) throw new Error('KI-Anbieter antwortete mit HTTP ' + r.status);
  const d = await r.json();
  return ((d.choices || [])[0] || {}).message?.content || '';
}

/**
 * Eine Meldung anreichern.
 *
 * `meldung` ist das, was aus dem Abruf kommt: { title, summary, raw }.
 * Die HERKUNFT wird bewusst NICHT übergeben — siehe Dateikopf.
 *
 * Wirft NIE. Scheitert die KI, kommt die Meldung unverändert zurück, und das
 * Ergebnis sagt warum. Eine Störung beim Anbieter darf den Engpassdienst nicht
 * anhalten.
 */
export async function extractSignal(meldung, {
  env = process.env, fetchImpl = globalThis.fetch, frage = frageAnbieter, log = null,
} = {}) {
  const basis = {
    wirkstoff: null, handelsname: null, schweregrad: null, ursache: null,
    kategorie: null, gueltigVon: null, gueltigBis: null, uebersetzungen: {},
    confidence: 0, aiUsed: false, grund: null,
  };

  const cfg = aiKonfiguration(env);
  if (!cfg) return { ...basis, grund: 'kein KI-Anbieter konfiguriert' };

  const originaltext = [meldung.title, meldung.summary, meldung.raw].filter(Boolean).join('\n');
  if (!originaltext.trim()) return { ...basis, grund: 'kein Text zum Auswerten' };

  try {
    const antwort = await frage(cfg, baueAuftrag(meldung), { fetchImpl });
    const roh = parseAiAntwort(antwort);
    if (!roh) {
      log?.(`ApoPulse KI: Antwort nicht auswertbar (${String(antwort).slice(0, 80)}…)`);
      return { ...basis, grund: 'Antwort war kein verwertbares JSON' };
    }
    const e = normalisiereExtraktion(roh);
    return { ...e, confidence: bewerteExtraktion(e, originaltext), aiUsed: true, grund: null };
  } catch (e) {
    // Zeitüberschreitung, Kontingent erschöpft, Anbieter gestört — alles
    // dasselbe Ergebnis: Die Meldung läuft ohne Anreicherung weiter.
    log?.(`ApoPulse KI: ${(e && e.message) || e} — Meldung läuft ohne Anreicherung weiter`);
    return { ...basis, grund: (e && e.message) || String(e) };
  }
}
