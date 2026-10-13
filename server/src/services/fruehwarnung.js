// ============================================================================
//  Frühwarnung: Ein beobachteter Wirkstoff ist im AUSLAND neu knapp
// ============================================================================
//  Engpässe wandern. Viele Länder hängen an denselben Herstellern und
//  Wirkstoff-Lieferanten; was in einem Markt knapp wird, kommt oft Wochen
//  später im nächsten an. Wer das vorher weiß, kann vorher einkaufen. Diese
//  Auskunft steht in keiner einzelnen Behördenliste — sie entsteht erst, wenn
//  man mehrere Länder nebeneinander mitschreibt (services/chronik.js).
//
//  Ehrlichkeitsregeln:
//   1. KEINE PROGNOSE. Gemeldet wird eine Tatsache („in den USA seit 3 Tagen
//      auf der Engpassliste der FDA"), nicht „kommt bald zu Ihnen".
//   2. NICHT AM ERSTEN LAUF EINES LANDES. Beim ersten Abruf ist jede Zeile für
//      uns neu, obwohl die meisten Engpässe längst laufen. Meldungen darauf
//      wären eine Flut von Altfällen.
//   3. NICHT, WENN ES BEI DIR SCHON KNAPP IST. Dann ist es keine Frühwarnung
//      mehr, und die heimische Meldung kam schon über den normalen Weg.
//   4. NUR AUSLAND. Das eigene Land meldet der bestehende Engpass-Alarm.
//      (Folgt aus Regel 3: Neu im Heimatland heißt, dort ist es knapp.)
//   5. Namen über den Wirkstoff-Schlüssel (domain/inn.js): Salz- und Hydrat-
//      zusätze, Schreibvarianten und belegte US/INN-Namen fallen zusammen
//      („Amoxicilina" = „Amoxicillin", „Albuterol" = „Salbutamol"), Verschiedenes
//      nie (Prednison ≠ Prednisolon). Lieber eine Warnung zu wenig als eine falsche.
//
//  Anzeige auf der Wirkstoff-Seite und in der Übersicht: frei (Behörden-
//  tatsachen). Die Push-Benachrichtigung: Premium — bezahlt wird die
//  Rechtzeitigkeit, nicht die Information selbst.
// ============================================================================

import { wirkstoffSchluessel } from '../domain/inn.js';

export function createFruehwarnung({ chronik, shortagesRepo, social, istPremium, heimatVon }) {
  return {
    /** Wo ist dieser Wirkstoff gerade knapp, außer im angesehenen Land? */
    imAusland(wirkstoff, land) {
      return chronik.offenAnderswo(wirkstoff, land);
    },

    /**
     * Für die Übersicht: beobachtete Wirkstoffe, die im Ausland knapp sind,
     * im angesehenen Land aber nicht (Regel 3).
     */
    fuerBeobachtungsliste(userId, land) {
      const out = [];
      for (const w of shortagesRepo.listWatch(userId)) {
        if (chronik.offenIn(w, land)) continue;
        const laender = chronik.offenAnderswo(w, land);
        if (laender.length) out.push({ wirkstoff: w, laender });
      }
      return out.sort((a, b) => a.laender[0].dauer_tage - b.laender[0].dauer_tage);
    },

    /** Neue Episoden eines Abrufs (chronik.beobachte().neue) melden. */
    melde(neue = []) {
      let gesendet = 0;
      for (const n of neue) {
        if (n.erster_lauf) continue; // Regel 2
        // Beobachter:innen über den Wirkstoff-SCHLÜSSEL finden (domain/inn.js):
        // Wer „Salbutamol" beobachtet, meint auch „Albuterol Sulfate" der FDA.
        const key = wirkstoffSchluessel(n.wirkstoff);
        const beobachter = shortagesRepo.listWatchers()
          .filter((b) => b.wirkstoffe.some((w) => key && wirkstoffSchluessel(w) === key))
          .map((b) => ({ uid: b.userId, name: b.wirkstoffe.find((w) => wirkstoffSchluessel(w) === key) }));
        for (const { uid, name } of beobachter) {
          const heimat = String(heimatVon(uid) || '').toUpperCase();
          // Regel 3 — und damit auch Regel 4: Eine neue Episode im Heimatland
          // IST ein heimischer Engpass, offenIn() ist dann schon wahr. Eine eigene
          // Prüfung „heimat === n.land" wäre doppelt (Gegenprobe: blieb stumm).
          if (heimat && chronik.offenIn(n.wirkstoff, heimat)) continue;
          if (!istPremium(uid)) continue;
          // Im Label der Name, den die Person beobachtet — den kennt sie.
          const r = social.pushNotification({ userId: uid, type: 'shortage_abroad', refType: 'wirkstoff', refId: name, label: `${name} · ${n.land}` });
          if (r) gesendet++;
        }
      }
      return gesendet;
    },
  };
}
