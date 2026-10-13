// ============================================================================
//  Engpass-Chronik: Was die Behörden-Listen vergessen, hält ApoPulse fest
// ============================================================================
//  Behördenlisten zeigen den HEUTIGEN Stand. Ist ein Engpass vorbei, fällt die
//  Zeile heraus — und mit ihr die Information, dass es ihn gab. Bisher machte
//  ApoPulse es genauso: `replaceFeed` ersetzt bei jedem Abruf den Bestand.
//
//  Die Chronik merkt sich jede ENGPASS-EPISODE je Land und Wirkstoff: wann sie
//  begann, wann sie zuletzt gesehen wurde, wann sie endete. Daraus entsteht mit
//  der Zeit, was keine einzelne Behördenliste hergibt: „Amoxicillin war seit
//  Aufzeichnungsbeginn dreimal knapp, im Schnitt 41 Tage."
//
//  Ehrlichkeitsregeln — die Chronik ist nur so viel wert wie diese:
//
//   1. NUR BEHÖRDENDATEN (provenance 'verified'). Community-Meldungen und
//      Referenzdaten gehen nicht ein: Eine Statistik, die eine unbestätigte
//      Einzelmeldung als Episode zählt, ist eine Behauptung ohne Quelle.
//   2. NUR LÄNDER MIT ERFOLGREICHEM ABRUF. Ein ausgefallener Abruf heißt
//      „wir wissen nichts", nicht „alles vorbei". Ohne diese Regel schlösse
//      jeder Behörden-Ausfall sämtliche offenen Episoden.
//   3. VERDACHT AUF UNVOLLSTÄNDIGE ANTWORT. Verschwinden mit einem Abruf mehr
//      als die Hälfte der offenen Episoden eines Landes (und mindestens zehn),
//      ist das eher eine abgeschnittene Antwort (Seite 1 von 3, geänderte
//      Filter) als eine Welle von Lösungen. Dann wird nichts geschlossen.
//   4. LÜCKE ≤ 7 TAGE = DERSELBE ENGPASS. Fehlt eine Zeile einen Abruf lang und
//      kommt wieder, war das ein Aussetzer der Liste, kein neuer Engpass.
//   5. BEGINN EHRLICH BENANNT. Nennt die Behörde ein Meldedatum, gilt es
//      („gemeldet"); sonst der Tag, an dem ApoPulse die Zeile zuerst sah
//      („beobachtet"). Das Ende ist der erste Abruf OHNE die Zeile — also
//      „spätestens", nicht taggenau.
//   6. AUFZEICHNUNGSBEGINN JE LAND. Jede Zahl steht unter „seit <Datum>".
//      Drei Episoden in zwei Wochen Aufzeichnung sind etwas anderes als drei
//      in zwei Jahren.
// ============================================================================
import { falten } from '../domain/bezeichnung.js';
import { wirkstoffSchluessel } from '../domain/inn.js';

const AKTIV = new Set(['kritisch', 'eingeschraenkt']);
const RANG = { eingeschraenkt: 1, kritisch: 2 };
const LUECKE_TAGE = 7;
const MAX_PRAEPARATE = 20;
const TAG = 86400000;

// Schlüssel über Sprachen hinweg (domain/inn.js): „Amoxicillin-Trihydrat" (BfArM),
// „Amoxicillin" (BASG) und „Amoxicilina" fallen zusammen — Verschiedenes nie.
const wkKey = (wirkstoff) => wirkstoffSchluessel(wirkstoff) || falten(String(wirkstoff || '').trim());
const schluessel = (land, wirkstoff) => `${land}|${wkKey(wirkstoff)}`;
const isoTag = (d) => new Date(d).toISOString().slice(0, 10);
const tageZwischen = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / TAG));
const gueltigesDatum = (s, heute) => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || ''));
  return m && !Number.isNaN(Date.parse(m[1])) && m[1] <= heute ? m[1] : null;
};

export function createChronik({ jetzt = () => Date.now(), log = console } = {}) {
  /** schluessel -> Episode[] (älteste zuerst) */
  const episoden = new Map();
  /** Land -> erster erfolgreich beobachteter Tag */
  const seit = new Map();

  const offeneIn = (land) => {
    const out = [];
    for (const [k, liste] of episoden) {
      if (!k.startsWith(land + '|')) continue;
      const e = liste[liste.length - 1];
      if (e && !e.ende) out.push(e);
    }
    return out;
  };

  return {
    /**
     * Einen Abruf auswerten.
     * @param zeilen  aktueller Bestand (beliebige Herkunft; gefiltert wird hier)
     * @param laender Länder, deren Behördenabruf in DIESEM Lauf Zeilen lieferte
     */
    beobachte({ zeilen = [], laender = [] } = {}) {
      const heute = isoTag(jetzt());
      const bericht = { neu: 0, fortgesetzt: 0, geschlossen: 0, zurueckgehalten: [], neue: [], beendete: [] };
      for (const roh of laender) {
        const land = String(roh || '').toUpperCase();
        if (!land) continue;
        const behoerde = zeilen.filter((z) => z.provenance === 'verified' && !z.reporter_user_id
          && String(z.country || '').toUpperCase() === land);
        // Regel 2: Liegt für das Land gar keine Behördenzeile vor, wurde es in
        // diesem Lauf nicht wirklich beobachtet — egal, was der Aufrufer meint.
        if (!behoerde.length) continue;
        // Erster Lauf eines Landes: JEDE Zeile ist für uns „neu", obwohl die
        // meisten Engpässe längst laufen. Wer darauf Meldungen verschickt,
        // flutet alle Beobachter:innen mit Altfällen — deshalb markiert.
        const ersterLauf = !seit.has(land);
        if (ersterLauf) seit.set(land, heute);

        const aktuell = new Map();
        for (const z of behoerde) {
          if (!AKTIV.has(z.status)) continue;
          const k = schluessel(land, z.wirkstoff || z.bezeichnung);
          if (!aktuell.has(k)) aktuell.set(k, []);
          aktuell.get(k).push(z);
        }

        // Regel 3: Verdacht auf abgeschnittene Antwort.
        const offen = offeneIn(land);
        const verschwinden = offen.filter((e) => !aktuell.has(schluessel(land, e.wirkstoff)));
        const verdacht = verschwinden.length >= 10 && verschwinden.length > offen.length / 2;
        if (verdacht) {
          bericht.zurueckgehalten.push({ land, anzahl: verschwinden.length, offen: offen.length });
          log.warn?.(`ApoPulse Chronik: ${land} — ${verschwinden.length} von ${offen.length} offenen Engpässen `
            + 'fehlen auf einmal. Verdacht auf unvollständige Antwort; nichts geschlossen.');
        } else {
          for (const e of verschwinden) {
            e.ende = heute; bericht.geschlossen++;
            // Für „wieder lieferbar"-Hinweise (fruehwarnung.meldeHeimat).
            bericht.beendete.push({ land, wirkstoff: e.wirkstoff, beginn: e.beginn, ende: heute, dauer_tage: tageZwischen(e.beginn, heute), quelle: e.quelle });
          }
        }

        for (const [k, gruppe] of aktuell) {
          if (!episoden.has(k)) episoden.set(k, []);
          const liste = episoden.get(k);
          let e = liste[liste.length - 1];
          // Regel 4: kurze Lücke -> dieselbe Episode wieder öffnen.
          if (e && e.ende && tageZwischen(e.ende, heute) <= LUECKE_TAGE) { e.ende = null; }
          if (!e || e.ende) {
            const gemeldet = gruppe.map((z) => gueltigesDatum(z.gemeldet_am, heute)).filter(Boolean).sort()[0] || null;
            e = {
              land, wirkstoff: String(gruppe[0].wirkstoff || gruppe[0].bezeichnung).trim(),
              beginn: gemeldet || heute, beginn_art: gemeldet ? 'gemeldet' : 'beobachtet',
              erstmals_gesehen: heute, zuletzt_gesehen: heute, ende: null,
              schwerster_status: 'eingeschraenkt', praeparate: [], quelle: null,
            };
            liste.push(e);
            bericht.neu++;
            bericht.neue.push({ land, wirkstoff: e.wirkstoff, beginn: e.beginn, schwerster_status: e.schwerster_status, erster_lauf: ersterLauf });
          } else {
            bericht.fortgesetzt++;
          }
          e.zuletzt_gesehen = heute;
          for (const z of gruppe) {
            if ((RANG[z.status] || 0) > (RANG[e.schwerster_status] || 0)) e.schwerster_status = z.status;
            if (z.bezeichnung && !e.praeparate.includes(z.bezeichnung) && e.praeparate.length < MAX_PRAEPARATE) e.praeparate.push(z.bezeichnung);
            if (z.quelle) e.quelle = z.quelle;
          }
        }
      }
      return bericht;
    },

    /** Zusammenfassung für einen Wirkstoff in einem Land — oder null, wenn das Land nie beobachtet wurde. */
    fuer(wirkstoff, land) {
      const cc = String(land || '').toUpperCase();
      if (!seit.has(cc)) return null;
      const heute = isoTag(jetzt());
      const liste = (episoden.get(schluessel(cc, wirkstoff)) || []).map((e) => ({
        ...e, praeparate: [...e.praeparate],
        dauer_tage: tageZwischen(e.beginn, e.ende || heute),
      }));
      const beendet = liste.filter((e) => e.ende);
      const offen = liste.find((e) => !e.ende) || null;
      return {
        land: cc,
        aufzeichnung_seit: seit.get(cc),
        anzahl: liste.length,
        offen,
        durchschnitt_tage: beendet.length ? Math.round(beendet.reduce((s, e) => s + e.dauer_tage, 0) / beendet.length) : null,
        laengste_tage: liste.length ? Math.max(...liste.map((e) => e.dauer_tage)) : null,
        episoden: liste.reverse(), // neueste zuerst
      };
    },

    /** Ist der Wirkstoff in diesem Land gerade (laut Chronik) knapp? */
    offenIn(wirkstoff, land) {
      const liste = episoden.get(schluessel(String(land || '').toUpperCase(), wirkstoff)) || [];
      const e = liste[liste.length - 1];
      return !!(e && !e.ende);
    },

    /**
     * Offene Episoden desselben Wirkstoffs in ANDEREN Ländern.
     * Abgleich über den gefalteten Namen — „Amoxicillin" (AT) trifft
     * „amoxicillin" (US), aber nicht „Amoxicilina" (PT): Ohne INN-Abgleich
     * wird nichts geraten.
     */
    offenAnderswo(wirkstoff, ausser) {
      const cc = String(ausser || '').toUpperCase();
      const name = wkKey(wirkstoff);
      const heute = isoTag(jetzt());
      const out = [];
      for (const [k, liste] of episoden) {
        const [land, w] = k.split('|');
        if (land === cc || w !== name) continue;
        const e = liste[liste.length - 1];
        if (e && !e.ende) out.push({ land, beginn: e.beginn, beginn_art: e.beginn_art, dauer_tage: tageZwischen(e.beginn, heute), schwerster_status: e.schwerster_status, quelle: e.quelle });
      }
      return out.sort((a, b) => a.dauer_tage - b.dauer_tage);
    },

    /** Kurzform je Wirkstoff für Listen: { anzahl, offen_seit_tagen, durchschnitt_tage } */
    kurz(wirkstoff, land) {
      const f = this.fuer(wirkstoff, land);
      if (!f || !f.anzahl) return null;
      return {
        anzahl: f.anzahl,
        offen_seit_tagen: f.offen ? f.offen.dauer_tage : null,
        durchschnitt_tage: f.durchschnitt_tage,
        aufzeichnung_seit: f.aufzeichnung_seit,
      };
    },

    /** Alle Episoden eines Landes (für den Export), älteste zuerst. */
    alle(land) {
      const cc = String(land || '').toUpperCase();
      const heute = isoTag(jetzt());
      const out = [];
      for (const [k, liste] of episoden) {
        if (!k.startsWith(cc + '|')) continue;
        for (const e of liste) out.push({ ...e, praeparate: [...e.praeparate], dauer_tage: tageZwischen(e.beginn, e.ende || heute) });
      }
      return out.sort((a, b) => (a.beginn < b.beginn ? -1 : a.beginn > b.beginn ? 1 : a.wirkstoff.localeCompare(b.wirkstoff)));
    },

    /**
     * Was hat sich in den letzten `tage` Tagen in einem Land getan?
     * „Neu" zählt nur, was NACH dem ersten Abruf des Landes auftauchte —
     * beim ersten Lauf ist alles „neu", obwohl es längst läuft.
     */
    wochenbilanz(land, { tage = 7 } = {}) {
      const cc = String(land || '').toUpperCase();
      if (!seit.has(cc)) return null;
      const heute = isoTag(jetzt());
      const grenze = isoTag(jetzt() - tage * TAG);
      const start = seit.get(cc);
      const neu = []; const beendet = []; let offen = 0;
      for (const [k, liste] of episoden) {
        if (!k.startsWith(cc + '|')) continue;
        for (const e of liste) {
          if (!e.ende) offen++;
          if (e.erstmals_gesehen >= grenze && e.erstmals_gesehen > start) neu.push({ wirkstoff: e.wirkstoff, beginn: e.beginn, schwerster_status: e.schwerster_status, quelle: e.quelle, offen: !e.ende });
          if (e.ende && e.ende >= grenze) beendet.push({ wirkstoff: e.wirkstoff, ende: e.ende, dauer_tage: tageZwischen(e.beginn, e.ende), quelle: e.quelle });
        }
      }
      const rang = (x) => RANG[x.schwerster_status] || 0;
      neu.sort((a, b) => rang(b) - rang(a) || a.wirkstoff.localeCompare(b.wirkstoff));
      beendet.sort((a, b) => a.wirkstoff.localeCompare(b.wirkstoff));
      return { land: cc, aufzeichnung_seit: start, heute, offen, neu, beendet };
    },

    aufzeichnungSeit(land) { return seit.get(String(land || '').toUpperCase()) || null; },

    /** Länder, deren Behördenliste mitgeschrieben wird: [{ land, seit }]. */
    beobachteteLaender() { return [...seit].map(([land, ab]) => ({ land, seit: ab })).sort((a, b) => a.land.localeCompare(b.land)); },

    /** Jeder Wirkstoffname, der je in einer Behördenliste stand: [{ land, wirkstoff }]. */
    bekannteWirkstoffe() {
      const out = [];
      for (const liste of episoden.values()) if (liste.length) out.push({ land: liste[0].land, wirkstoff: liste[liste.length - 1].wirkstoff });
      return out;
    },

    __dump() { return { episoden: [...episoden], seit: [...seit] }; },
    __load(d) {
      episoden.clear(); seit.clear();
      if (!d) return;
      // Schlüssel NEU berechnen statt übernehmen: Gespeicherte Bestände tragen
      // ggf. den alten Schlüssel (nur Akzente/Großschreibung gefaltet). Ohne
      // Umrechnung fände der nächste Abruf die laufende Episode nicht, legte
      // eine „neue" an — und die Frühwarnung alarmierte für einen Altfall.
      // Fallen zwei alte Schlüssel zusammen, werden ihre Episoden zeitlich
      // zusammengeführt; überlappende offene Episoden verschmelzen zu einer.
      for (const [k, v] of d.episoden || []) {
        const land = String(k).split('|')[0];
        const neu = schluessel(land, (v[0] && v[0].wirkstoff) || String(k).split('|')[1]);
        episoden.set(neu, [...(episoden.get(neu) || []), ...v]);
      }
      for (const [k, liste] of episoden) {
        liste.sort((a, b) => (a.beginn < b.beginn ? -1 : a.beginn > b.beginn ? 1 : 0));
        const zusammen = [];
        for (const e of liste) {
          const letzte = zusammen[zusammen.length - 1];
          if (letzte && (!letzte.ende || letzte.ende >= e.beginn)) {
            if (!e.ende || (letzte.ende && e.ende > letzte.ende)) letzte.ende = e.ende;
            if (e.zuletzt_gesehen > letzte.zuletzt_gesehen) letzte.zuletzt_gesehen = e.zuletzt_gesehen;
            if ((RANG[e.schwerster_status] || 0) > (RANG[letzte.schwerster_status] || 0)) letzte.schwerster_status = e.schwerster_status;
            for (const p of e.praeparate || []) if (!letzte.praeparate.includes(p) && letzte.praeparate.length < MAX_PRAEPARATE) letzte.praeparate.push(p);
          } else zusammen.push(e);
        }
        episoden.set(k, zusammen);
      }
      for (const [k, v] of d.seit || []) seit.set(k, v);
    },
  };
}

/**
 * Premium-Schnitt (Owner-Freigabe 12.10.2026): Die ZUSAMMENFASSUNG ist frei —
 * wie oft, wie lange im Schnitt, läuft gerade. Das ist die Information, die
 * bei einer Umbestellung hilft, und sie gehört nicht hinter eine Bezahlschranke.
 * Die EPISODENLISTE (jeder Zeitraum mit Präparaten und Quelle) und der Export
 * sind das Analysewerkzeug — das ist Premium.
 *
 * Die Schranke sitzt hier auf dem Server: Eine Oberfläche, die die Liste nur
 * ausblendet, hätte sie trotzdem an jeden ausgeliefert.
 */
export function chronikFuerBetrachter(f, { premium }) {
  if (!f || premium) return f ? { ...f, episoden_gesperrt: false } : f;
  const { episoden, ...rest } = f;
  return { ...rest, episoden: [], episoden_gesperrt: episoden.length > 0 };
}
