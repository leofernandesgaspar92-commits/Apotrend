// ============================================================================
//  Kolleg:innen einladen — und um Bestätigung einer Meldung bitten
// ============================================================================
//  In den meisten afrikanischen Ländern gibt es keine Behördenliste. Die Lage
//  dort entsteht aus Meldungen von Apotheken, und „bestätigt" ist eine
//  Meldung erst ab BESTAETIGT_AB_APOTHEKEN Apotheken. Eine einzelne Apotheke
//  in Kampala bleibt sonst allein mit ihrer Meldung.
//
//  Darum: jede:r hat einen persönlichen Einladungs-Code. Er hängt an geteilten
//  Links (WhatsApp ist dort der Hauptkanal). Wer darüber ein Konto anlegt,
//  wird der einladenden Person zugeordnet; sie erfährt es und sieht, wie viele
//  über ihren Link dazugekommen sind.
//
//  Bewusst OHNE Belohnung: Wer für Einladungen etwas bekäme, hätte einen
//  Grund, Schein-Apotheken anzulegen — und Schein-Apotheken könnten Meldungen
//  „bestätigen". Eine Einladung zählt nichts in der Vertrauensstufe.
//
//  Zufällige, gespeicherte Codes (nicht aus dem Token-Geheimnis abgeleitet):
//  Ein geteilter Link muss auch nach einem Schlüsselwechsel weiter gelten.
// ============================================================================
import crypto from 'node:crypto';

export const CODE_RE = /^[A-Za-z0-9_-]{8}$/;

export function createEinladungen({ uhr = () => Date.now() } = {}) {
  const codeVon = new Map();   // userId -> code
  const nachCode = new Map();  // code -> userId
  const eingeladen = new Map(); // neue userId -> { von, am }

  return {
    /** Persönlicher Code; wird beim ersten Abruf angelegt. */
    code(userId) {
      let c = codeVon.get(userId);
      if (!c) {
        do { c = crypto.randomBytes(6).toString('base64url'); } while (nachCode.has(c));
        codeVon.set(userId, c); nachCode.set(c, userId);
      }
      return c;
    },
    /** Code -> einladende userId oder null. */
    aufloesen(code) {
      return typeof code === 'string' && CODE_RE.test(code) ? (nachCode.get(code) || null) : null;
    },
    /** Neues Konto der einladenden Person zuordnen. Einmal, nie sich selbst. */
    zuordnen(neuId, code) {
      const von = this.aufloesen(code);
      if (!von || von === neuId || eingeladen.has(neuId)) return null;
      eingeladen.set(neuId, { von, am: new Date(uhr()).toISOString() });
      return von;
    },
    /** Wer hat dieses Konto eingeladen? (Moderation: Prüfliste der Meldungen) */
    vonWem(userId) { const e = eingeladen.get(userId); return e ? e.von : null; },
    anzahl(userId) {
      let n = 0;
      for (const e of eingeladen.values()) if (e.von === userId) n += 1;
      return n;
    },
    /** Konto gelöscht: Code und alle Zuordnungen von und zu diesem Konto weg. */
    nutzerEntfernen(userId) {
      const c = codeVon.get(userId);
      if (c) { codeVon.delete(userId); nachCode.delete(c); }
      eingeladen.delete(userId);
      for (const [neu, e] of [...eingeladen]) if (e.von === userId) eingeladen.delete(neu);
    },
    __dump() { return { codes: [...codeVon], eingeladen: [...eingeladen] }; },
    __load(d) {
      codeVon.clear(); nachCode.clear(); eingeladen.clear();
      for (const [u, c] of (d && d.codes) || []) { codeVon.set(u, c); nachCode.set(c, u); }
      for (const [u, e] of (d && d.eingeladen) || []) eingeladen.set(u, e);
    },
  };
}
