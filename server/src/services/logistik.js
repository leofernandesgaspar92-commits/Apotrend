// ============================================================================
//  Kühlketten- und Transportmeldungen (B2B)
// ============================================================================
//  Was hier gemeldet wird, weiß keine Behörde: Eine unterbrochene Kühlkette auf
//  dem Weg nach Luanda, ein Container, der im Hafen steht, eine Zollabfertigung
//  die drei Tage braucht. Diese Information entsteht bei den Beteiligten —
//  Spedition, Großhandel, Apotheke — und sonst nirgends.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DESHALB IST DIESER BEREICH AM ANFANG LEER, UND DAS IST RICHTIG
//  ──────────────────────────────────────────────────────────────────────────
//  Es gibt keine kostenlose Behördenschnittstelle für Kühlketten-Brüche. Wer
//  hier Beispieldaten einsetzt, erzeugt genau das, was die eiserne Regel des
//  Projekts verbietet: Zeilen, die aussehen wie geprüfte Meldungen und keine
//  sind — und bei einer Kühlkette entscheidet daran, ob eine Charge
//  vernichtet wird.
//
//  Die Antwort ist deshalb eine EHRLICHE LEERMELDUNG plus die Möglichkeit, die
//  erste Meldung einzustellen. Ein Meldeweg ist vom ersten Teilnehmer an
//  nützlich; eine Anzeige ohne Quelle ist es nie.
//
//  ──────────────────────────────────────────────────────────────────────────
//  HERKUNFT: SELF_REPORTED, IMMER UND SICHTBAR
//  ──────────────────────────────────────────────────────────────────────────
//  Jede Zeile trägt `provenance: 'self_reported'` und den meldenden Betrieb mit
//  Namen. Das ist keine Formalie: Eine Eigenangabe eines Großhändlers ist
//  etwas anderes als eine Behördenmeldung, und wer sie verwechselt, hält eine
//  Vermutung für einen Befund. Die Oberfläche kennzeichnet sie entsprechend.
// ============================================================================

import { AppError } from '../domain/errors.js';
import { logistikErlaubt } from '../domain/jurisdiction.js';

/** Meldungsarten. Reihenfolge = Anzeigereihenfolge. */
export const ARTEN = Object.freeze(['kuehlkette', 'zoll', 'transport']);

/** Dringlichkeit. Farbsemantik wie überall: rot = kritisch. */
export const DRINGLICHKEIT = Object.freeze(['kritisch', 'hinweis', 'behoben']);

export function normalizeArt(a) {
  const v = String(a || '').trim().toLowerCase();
  return ARTEN.includes(v) ? v : null;
}

export function normalizeDringlichkeit(d) {
  const v = String(d || '').trim().toLowerCase();
  return DRINGLICHKEIT.includes(v) ? v : 'hinweis';
}

/** Echtes Kalenderdatum (YYYY-MM-DD), kein Überlauf. */
export function istKalendertag(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function createLogistikService({ repo, social, betrachterVon }) {
  /**
   * Betrachter beschreiben und die Stufe prüfen.
   *
   * `logistikErlaubt` und NICHT `rxErlaubt`: Logistik ist hier die wichtigste
   * Gruppe, beim Rx-Einblick ist sie ausgeschlossen (domain/jurisdiction.js).
   */
  function fordereBetrieb(userId, was) {
    const b = betrachterVon(userId);
    if (!logistikErlaubt(b)) {
      throw new AppError('logistik_fachkreis',
        `${was} ist verifizierten Betrieben vorbehalten (Apotheke, Großhandel, Hersteller, Logistik). `
        + 'Eine Meldung ohne nachgewiesenen Betrieb hinter sich wäre eine anonyme Behauptung über eine '
        + 'Lieferkette — darauf kann niemand handeln.', 403);
    }
    return b;
  }

  const dekorieren = (m) => {
    const prof = social.getProfile ? social.getProfile(m.author_user_id) : null;
    return {
      ...m,
      // Die Herkunft fährt an jeder Zeile mit, mit Namen des Betriebs.
      provenance: 'self_reported',
      melder: prof
        ? { handle: prof.handle, display_name: prof.display_name, account_type: prof.account_type, verified: !!prof.verified }
        : null,
    };
  };

  return {
    ARTEN, DRINGLICHKEIT,

    /**
     * Meldungen des eigenen Rechtsraums.
     *
     * Gibt `{ meldungen, erlaubt, grund }` zurück — nicht nur ein Array. Die
     * Oberfläche muss „du darfst nicht" von „es gibt nichts" unterscheiden
     * können; beides sieht sonst gleich aus und das erste wäre eine
     * Falschaussage.
     */
    list(userId, { art = null, country = null, offen = true } = {}) {
      const b = betrachterVon(userId);
      if (!logistikErlaubt(b)) {
        return { meldungen: [], erlaubt: false, grund: 'unverifiziert' };
      }
      const cc = String(country || b.jurisdiction || '').toUpperCase();
      const a = art ? normalizeArt(art) : null;
      const heute = new Date().toISOString().slice(0, 10);
      const meldungen = repo.list()
        .filter((m) => m.country === cc)
        .filter((m) => !a || m.art === a)
        // `offen`: abgelaufene und behobene Meldungen ausblenden. Eine
        // Kühlketten-Warnung von vor drei Monaten ist keine Warnung mehr,
        // sondern Rauschen — sie bleibt über `offen=false` erreichbar.
        .filter((m) => !offen || (m.dringlichkeit !== 'behoben' && (!m.gueltig_bis || m.gueltig_bis >= heute)))
        .map(dekorieren);
      return { meldungen, erlaubt: true, grund: null };
    },

    /** Eine Meldung einstellen. Nur verifizierte Betriebe. */
    create(userId, { art, titel, beschreibung, region, betroffen, dringlichkeit, gueltigBis } = {}) {
      const b = fordereBetrieb(userId, 'Das Melden von Transport- und Kühlketten-Störungen');
      const a = normalizeArt(art);
      if (!a) throw new AppError('logistik_art', `Art muss eine von ${ARTEN.join(', ')} sein.`, 400);
      const t = String(titel ?? '').trim();
      if (!t) throw new AppError('logistik_titel', 'Bitte die Störung in einem Satz benennen.', 400);
      if (t.length > 200) throw new AppError('logistik_titel_lang', 'Titel zu lang (max. 200 Zeichen).', 400);
      const bis = gueltigBis ? String(gueltigBis).trim() : null;
      if (bis && !istKalendertag(bis)) throw new AppError('logistik_datum', 'Ungültiges Datum.', 400);

      const prof = social.getProfile(userId);
      return dekorieren(repo.create({
        authorUserId: userId,
        art: a,
        titel: t,
        beschreibung: String(beschreibung ?? '').trim().slice(0, 2000) || null,
        region: String(region ?? '').trim().slice(0, 120) || null,
        betroffen: String(betroffen ?? '').trim().slice(0, 200) || null,
        dringlichkeit: normalizeDringlichkeit(dringlichkeit),
        gueltigBis: bis,
        // Land AUS DEM PROFIL, nicht aus der Anfrage — dieselbe Regel wie bei
        // den Börsen-Einträgen: Der Rechtsraum ist keine Anzeigeoption.
        country: String((prof && prof.country) || b.jurisdiction || '').toUpperCase() || null,
      }));
    },

    /** Als behoben markieren — nur die melderin selbst. */
    behoben(userId, id) {
      fordereBetrieb(userId, 'Das Ändern einer Meldung');
      const m = repo.get(id);
      if (!m) throw new AppError('logistik_not_found', 'Meldung nicht gefunden.', 404);
      if (m.author_user_id !== userId) {
        throw new AppError('logistik_not_owner', 'Nur der meldende Betrieb kann seine Meldung schließen.', 403);
      }
      return dekorieren(repo.update(id, { dringlichkeit: 'behoben' }));
    },

    remove(userId, id) {
      const m = repo.get(id);
      if (!m) throw new AppError('logistik_not_found', 'Meldung nicht gefunden.', 404);
      if (m.author_user_id !== userId) {
        throw new AppError('logistik_not_owner', 'Nur der meldende Betrieb kann seine Meldung löschen.', 403);
      }
      repo.remove(id);
      return { ok: true };
    },

    mine(userId) {
      fordereBetrieb(userId, 'Die eigene Meldungsliste');
      return repo.list().filter((m) => m.author_user_id === userId).map(dekorieren);
    },
  };
}
