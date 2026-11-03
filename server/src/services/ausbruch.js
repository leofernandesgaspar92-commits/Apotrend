// @ts-check
// ============================================================================
//  Ausbruchs- und Nachfrage-Radar (Sprint 5)
// ============================================================================
//  Zwei Signalarten, beide mit Quelle:
//   1. WHO-Ausbruchsmeldungen (Disease Outbreak News, offene WHO-Schnittstelle).
//   2. Regionaler ANSTIEG von Engpässen: neue Einträge in Behördenlisten (Chronik)
//      plus neue Apotheken-Meldungen je Wirkstoff und Region, letzte 14 Tage
//      gegenüber den 14 Tagen davor.
//  Großhandel und Hersteller in ANDEREN Regionen bekommen eine Frühwarnung — sie
//  haben Zeit, Bestand und Bezugswege zu prüfen, bevor die Welle sie erreicht.
//
//  EHRLICHKEITSREGEL: keine erfundene Empfehlung wie „+25 % Lageraufbau". ApoPulse
//  hat weder Absatz- noch Preisdaten der Händler; eine Prozentzahl wäre geraten und
//  würde als Kaufempfehlung gelesen. Die Warnung nennt, was beobachtet wurde (wie
//  viele Meldungen, wo, seit wann, laut wem) — die Menge entscheidet der Betrieb.
//  Suchanfragen werden nicht ausgewertet: ApoPulse speichert keine Suchbegriffe
//  (Datenschutz), also gibt es dafür keine ehrliche Zahl.
// ============================================================================
import { createAbruf } from './extern/abruf.js';
import { wirkstoffSchluessel } from '../domain/inn.js';

export const FENSTER_TAGE = 14;
export const MIN_NEU = 3;              // mindestens so viele neue Meldungen in der Region …
export const FAKTOR = 2;               // … und mindestens doppelt so viele wie im Fenster davor
export const ALARM_PAUSE_TAGE = 14;    // je Wirkstoff+Region höchstens alle 14 Tage ein Alarm
export const ALARM_KONTOARTEN = ['wholesale', 'pharma'];

const tag = (ms) => new Date(ms).toISOString().slice(0, 10);

/** WHO-DON-Antwort → Meldungen (neueste zuerst). Wirft bei unbrauchbarer Antwort. */
export function whoLesen(j) {
  const liste = j && Array.isArray(j.value) ? j.value : null;
  if (!liste) throw Object.assign(new Error('WHO: keine Meldungsliste'), { code: 'quelle_gestoert' });
  return liste.map((x) => {
    const titel = String(x.Title || x.OverrideTitle || '').trim();
    const datum = String(x.PublicationDateAndTime || x.PublicationDate || x.DateCreated || '').slice(0, 10);
    const pfad = x.ItemDefaultUrl ? String(x.ItemDefaultUrl) : x.UrlName ? '/' + String(x.UrlName) : '';
    if (!titel || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
    return { titel, datum, link: 'https://www.who.int/emergencies/disease-outbreak-news/item' + pfad.replace(/^\/?/, '/'), quelle: 'WHO Disease Outbreak News' };
  }).filter(Boolean).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 15);
}

/**
 * Regionaler Anstieg je Wirkstoff.
 * @param {{ episoden: Array<{land:string,wirkstoff:string,erstmals_gesehen:string,quelle?:string|null}>,
 *   meldungen: Array<{country?:string|null,wirkstoff:string,gemeldet_am:string,provenance:string,status?:string,history?:Array<{am:string}>}>,
 *   regionVon: (cc: string) => string|null, heute: number }} e
 */
export function regionaleSignale({ episoden, meldungen, regionVon, heute }) {
  const grenze = tag(heute - FENSTER_TAGE * 86_400_000), davor = tag(heute - 2 * FENSTER_TAGE * 86_400_000);
  const z = new Map(); // key region|schluessel -> { jetzt, vorher, laender:Set, namen:Map, amtlich, apotheken }
  const zaehle = (land, wirkstoff, datum, art) => {
    const region = land ? regionVon(land) : null;
    const k = wirkstoffSchluessel(wirkstoff) || String(wirkstoff || '').trim().toLowerCase();
    if (!region || !k || !datum || datum < davor) return;
    const key = region + '|' + k;
    if (!z.has(key)) z.set(key, { region, schluessel: k, jetzt: 0, vorher: 0, laender: new Set(), namen: new Map(), amtlich: 0, apotheken: 0 });
    const e = z.get(key);
    e.namen.set(wirkstoff, (e.namen.get(wirkstoff) || 0) + 1);
    if (datum >= grenze) { e.jetzt++; e.laender.add(land); if (art === 'amtlich') e.amtlich++; else e.apotheken++; } else e.vorher++;
  };
  for (const ep of episoden || []) zaehle(ep.land, ep.wirkstoff, ep.erstmals_gesehen, 'amtlich');
  // Nur OFFENE Apotheken-Meldungen, gezählt am Tag der ERSTmeldung (Verlauf). `gemeldet_am` wird
  // bei „wieder lieferbar" und Statuswechsel auf heute gesetzt — vorher zählte eine Entwarnung als
  // neue Engpassmeldung und konnte eine falsche Frühwarnung an Großhändler auslösen (11/2026).
  for (const m of meldungen || []) {
    if (m.provenance !== 'community' || !['kritisch', 'eingeschraenkt'].includes(m.status)) continue;
    const erst = (Array.isArray(m.history) && m.history[0] && m.history[0].am) || m.gemeldet_am;
    zaehle(String(m.country || '').toUpperCase(), m.wirkstoff, erst, 'apotheke');
  }
  return [...z.values()]
    .filter((e) => e.jetzt >= MIN_NEU && e.jetzt >= FAKTOR * e.vorher)
    .map((e) => ({
      region: e.region, wirkstoff: [...e.namen].sort((a, b) => b[1] - a[1])[0][0], schluessel: e.schluessel,
      neu: e.jetzt, vorher: e.vorher, laender: [...e.laender].sort(), amtlich: e.amtlich, apotheken: e.apotheken, fenster_tage: FENSTER_TAGE,
    }))
    .sort((a, b) => b.neu - a.neu || b.laender.length - a.laender.length);
}

export function createAusbruchsRadar({ speicher, fetchImpl, jetzt = () => Date.now() } = /** @type {any} */ ({})) {
  const who = createAbruf({ name: 'who_ausbrueche', quelle: 'WHO Disease Outbreak News', link: 'https://www.who.int/emergencies/disease-outbreak-news', ttlMs: 6 * 3_600_000, speicher, fetchImpl, jetzt });
  /** @type {Map<string, number>} */
  const gemeldet = new Map(); // region|schluessel -> Zeitpunkt des letzten Alarms
  // Wer die Frühwarnung nicht will (sie ist die einzige Benachrichtigung, die niemand selbst
  // bestellt hat) — abschaltbar auf der Radar-Seite, ohne die übrigen Alarme zu verlieren.
  const abbestellt = new Set();
  return {
    whoMeldungen() {
      return who.holen('neu', 'https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$orderby=PublicationDateAndTime%20desc&$top=15', whoLesen);
    },
    /** Welche Signale sind neu zu melden (Pause je Wirkstoff+Region)? Markiert sie. */
    zuMelden(signale) {
      const out = [];
      for (const s of signale || []) {
        const k = s.region + '|' + s.schluessel, t = gemeldet.get(k);
        if (t && jetzt() - t < ALARM_PAUSE_TAGE * 86_400_000) continue;
        gemeldet.set(k, jetzt()); out.push(s);
      }
      return out;
    },
    alarmAn: (userId) => !abbestellt.has(userId),
    alarmSetzen(userId, an) { if (an) abbestellt.delete(userId); else abbestellt.add(userId); return !abbestellt.has(userId); },
    nutzerEntfernen(userId) { abbestellt.delete(userId); },
    status: () => who.status(),
    __dump: () => ({ gemeldet: [...gemeldet], abbestellt: [...abbestellt] }),
    __load(d) {
      gemeldet.clear(); abbestellt.clear();
      const g = Array.isArray(d) ? d : (d && Array.isArray(d.gemeldet) ? d.gemeldet : []); // alte Sicherung: nur die Liste
      for (const e of g) if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number') gemeldet.set(e[0], e[1]);
      for (const u of (d && Array.isArray(d.abbestellt) ? d.abbestellt : [])) if (typeof u === 'string') abbestellt.add(u);
    },
  };
}
