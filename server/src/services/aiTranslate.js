// ============================================================================
//  Übersetzen auf Zuruf
// ============================================================================
//  Die Plattform läuft in drei Sprachen, die Behörden tun das nicht. Eine
//  NAFDAC-Meldung ist englisch, eine ANVISA-Meldung portugiesisch, eine
//  BfArM-Meldung deutsch — und wer in Luanda eine deutsche Engpassmeldung
//  liest, bekommt sie heute unübersetzt.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WAS DIESER DIENST NICHT ANFASST — UND WARUM DAS DIE WICHTIGSTE ZEILE IST
//  ──────────────────────────────────────────────────────────────────────────
//  Er bekommt NUR TEXT. Keine Adresse, keinen Behördennamen, keine Kennung.
//  Das ist keine Sparsamkeit, sondern dieselbe Regel wie bei der Extraktion
//  (services/aiExtract.js, Dateikopf): Eine Angabe, die ein Sprachmodell
//  setzen kann, ist kein Beleg, sondern eine Behauptung.
//
//  Die Herkunft kann hier also nicht verändert werden, weil sie nie
//  hereinkommt. Das ist strukturell und nicht per Bitte im Prompt gelöst —
//  ein Prompt kann man umgehen, eine fehlende Eingabe nicht. Ein Test prüft,
//  dass auch bei einem Versuch, Adresse und Quelle mitzuschicken, nichts
//  davon beim Anbieter landet.
//
//  ──────────────────────────────────────────────────────────────────────────
//  ÜBERSETZT WIRD AUF ZURUF, NICHT AUTOMATISCH
//  ──────────────────────────────────────────────────────────────────────────
//  Jeder Aufruf kostet Geld. 500 Signale × 3 Sprachen vorab zu übersetzen
//  wäre Geld für Texte, die niemand liest. Deshalb: Knopf, Klick, Übersetzung
//  — und ein Zwischenspeicher, damit derselbe Text nicht zweimal bezahlt wird.
// ============================================================================

import crypto from 'node:crypto';
import { aiKonfiguration, frageAnbieter, SPRACHEN } from './aiExtract.js';

const SPRACHNAME = { de: 'Deutsch', en: 'English', pt: 'Português' };

/**
 * Der Auftrag an das Modell.
 *
 * Eigene Datei-Konstante und nicht der Extraktions-Prompt: Dort wird um JSON
 * mit Wirkstoff und Schweregrad gebeten. Hier geht es ausschließlich ums
 * Übersetzen — und um die beiden Regeln, die bei Behördentexten zählen.
 */
export function uebersetzungsAuftrag(ziel) {
  const name = SPRACHNAME[ziel] || ziel;
  return `Du übersetzt Texte von Arzneimittelbehörden für ein Fachportal für Apotheken.

ABSOLUTE REGELN:

1. ÜBERSETZE NUR, WAS DASTEHT. Keine Ergänzungen, keine Erklärungen, keine
   Einordnung, keine Zusammenfassung. Eine Übersetzung, die mehr sagt als das
   Original, ist eine Falschaussage mit Amtsanstrich.

2. FACHBEGRIFFE BLEIBEN FACHBEGRIFFE. Wirkstoffnamen (INN), Handelsnamen,
   Chargennummern, Dosierungen, Zulassungsnummern und Behördennamen werden
   NICHT übersetzt und NICHT verändert — sie werden unverändert übernommen.

3. KEINE EMPFEHLUNG. Niemals Therapie, Dosierung oder Austausch vorschlagen,
   auch nicht sinngemäß.

4. ANTWORTE AUSSCHLIESSLICH MIT DER ÜBERSETZUNG. Kein Vorwort, kein Nachsatz,
   keine Anführungszeichen um das Ganze, keine Angabe der Ausgangssprache.

5. IST DER TEXT SCHON IN DER ZIELSPRACHE, gib ihn unverändert zurück.

ZIELSPRACHE: ${name}`;
}

/** Zwischenspeicher-Schlüssel: Zielsprache + Hash des Textes. */
export function cacheKey(text, ziel) {
  const h = crypto.createHash('sha256').update(String(text), 'utf8').digest('hex').slice(0, 32);
  return `${ziel}:${h}`;
}

/** Obergrenze je Anfrage. Behördenseiten hängen seitenweise Navigation an. */
export const MAX_ZEICHEN = 4000;

/**
 * Übersetzungsdienst.
 *
 * `max` begrenzt den Zwischenspeicher. Älteste Einträge fallen heraus — ein
 * unbegrenzter Speicher wäre auf einer kostenlosen Instanz ein Leck mit
 * Ansage.
 */
export function createTranslateService({
  env = process.env, fetchImpl = globalThis.fetch, max = 2000, frage = frageAnbieter,
} = {}) {
  const cache = new Map();

  return {
    /** Ist die KI überhaupt konfiguriert? Steuert, ob die Oberfläche den Knopf zeigt. */
    verfuegbar() { return !!aiKonfiguration(env); },

    /** Nur für die Diagnose — nicht für die Abrechnung. */
    stats() { return { gespeichert: cache.size, max }; },

    /**
     * Übersetzen.
     *
     * Wirft mit sprechendem Code statt stillschweigend das Original
     * zurückzugeben: Ein Knopf, der nichts tut und nicht sagt warum, ist
     * schlimmer als keiner. Die Oberfläche zeigt die Meldung an.
     */
    async uebersetze(text, ziel) {
      const t = String(text ?? '').trim();
      const z = String(ziel || '').toLowerCase();
      if (!t) { const e = new Error('Kein Text zum Übersetzen.'); e.code = 'translate_empty'; e.status = 400; throw e; }
      if (!SPRACHEN.includes(z)) {
        const e = new Error(`Zielsprache nicht unterstützt (${SPRACHEN.join('/')}).`);
        e.code = 'translate_lang'; e.status = 400; throw e;
      }
      if (t.length > MAX_ZEICHEN) {
        const e = new Error(`Text zu lang (${t.length} von ${MAX_ZEICHEN} Zeichen).`);
        e.code = 'translate_too_long'; e.status = 400; throw e;
      }
      const cfg = aiKonfiguration(env);
      if (!cfg) {
        // Ehrlich benennen statt den Knopf ins Leere laufen zu lassen.
        const e = new Error('Übersetzung ist nicht konfiguriert (kein KI-Schlüssel).');
        e.code = 'translate_unconfigured'; e.status = 503; throw e;
      }

      const key = cacheKey(t, z);
      if (cache.has(key)) return { text: cache.get(key), cached: true, ziel: z };

      let roh;
      try {
        // NUR der Text geht hinaus. Kein zweites Argument, in dem versehentlich
        // eine Adresse mitreisen könnte.
        roh = await frage(cfg, t, { fetchImpl, system: uebersetzungsAuftrag(z) });
      } catch (e) {
        const err = new Error('KI-Anbieter nicht erreichbar: ' + ((e && e.message) || e));
        err.code = 'translate_provider'; err.status = 502; throw err;
      }

      const out = String(roh ?? '').trim();
      if (!out) {
        const e = new Error('Der KI-Anbieter hat keine Übersetzung geliefert.');
        e.code = 'translate_empty_answer'; e.status = 502; throw e;
      }

      cache.set(key, out);
      while (cache.size > max) cache.delete(cache.keys().next().value);
      return { text: out, cached: false, ziel: z };
    },

    __clearCache() { cache.clear(); },
  };
}
