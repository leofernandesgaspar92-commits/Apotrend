// ============================================================================
//  Daten-Schnittstelle (Business): Engpassdaten direkt in die Warenwirtschaft
// ============================================================================
//  Wer bezahlt dafür? Großhandel, Apothekenketten, Klinik-Einkauf. Sie wollen
//  nicht täglich eine Webseite öffnen, sondern dass ihr System selbst fragt:
//  „Welche Wirkstoffe aus meiner Bestellliste sind gerade knapp?" — und dass
//  eine Excel-Tabelle sich jeden Morgen selbst aktualisiert.
//
//  Regeln:
//   - Schlüssel werden nur EINMAL im Klartext gezeigt; gespeichert ist der
//     SHA-256-Hash. Wer die Sicherung liest, kann keinen Schlüssel benutzen.
//   - Jede Antwort trägt Herkunft und Quelle je Zeile (Behörde oder Meldung
//     aus Apotheken) — sicherheitsrelevante Aussagen nur mit Quelle, auch
//     maschinenlesbar.
//   - Läuft der Business-Tarif ab, antworten die Schlüssel mit 402 und einer
//     Klartext-Meldung, statt still leere Listen zu liefern.
//   - Höchstens 120 Anfragen je Schlüssel und Minute; höchstens 5 Schlüssel.
// ============================================================================
import crypto from 'node:crypto';
import { AppError } from '../domain/errors.js';

export const MAX_SCHLUESSEL = 5;
export const ANFRAGEN_JE_MINUTE = 120;
const PRAEFIX = 'apk_';

const hash = (roh) => crypto.createHash('sha256').update(String(roh)).digest('hex');

export function createDatenApi({ uhr = () => Date.now() } = {}) {
  const schluessel = new Map(); // id -> { id, user_id, name, hash, anzeige, angelegt, zuletzt, anfragen, widerrufen }
  const nachHash = new Map();   // hash -> id
  const fenster = new Map();    // id -> Zeitstempel der Anfragen in der letzten Minute

  const oeffentlich = (k) => ({ id: k.id, name: k.name, anzeige: k.anzeige, angelegt: k.angelegt, zuletzt: k.zuletzt, anfragen: k.anfragen });

  return {
    /** Neuen Schlüssel anlegen. Der Klartext steht NUR in dieser Antwort. */
    anlegen(userId, name) {
      const aktiv = [...schluessel.values()].filter((k) => k.user_id === userId && !k.widerrufen);
      if (aktiv.length >= MAX_SCHLUESSEL) throw new AppError('api_zu_viele', `Höchstens ${MAX_SCHLUESSEL} Schlüssel. Bitte zuerst einen nicht mehr benötigten löschen.`);
      const bez = String(name || '').trim().slice(0, 60) || 'Schlüssel';
      const roh = PRAEFIX + crypto.randomBytes(24).toString('base64url');
      const id = crypto.randomBytes(6).toString('hex');
      const k = { id, user_id: userId, name: bez, hash: hash(roh), anzeige: roh.slice(0, PRAEFIX.length + 4) + '…' + roh.slice(-4), angelegt: new Date(uhr()).toISOString(), zuletzt: null, anfragen: 0, widerrufen: false };
      schluessel.set(id, k); nachHash.set(k.hash, id);
      return { ...oeffentlich(k), schluessel: roh };
    },
    liste(userId) {
      return [...schluessel.values()].filter((k) => k.user_id === userId && !k.widerrufen)
        .sort((a, b) => a.angelegt.localeCompare(b.angelegt)).map(oeffentlich);
    },
    widerrufen(userId, id) {
      const k = schluessel.get(id);
      if (!k || k.user_id !== userId || k.widerrufen) throw new AppError('api_unbekannt', 'Schlüssel nicht gefunden.', 404);
      k.widerrufen = true; nachHash.delete(k.hash);
      return { ok: true };
    },
    /** Konto gelöscht: alle Schlüssel weg. */
    nutzerEntfernen(userId) {
      for (const k of [...schluessel.values()]) if (k.user_id === userId) { nachHash.delete(k.hash); schluessel.delete(k.id); }
    },
    /**
     * Schlüssel aus der Anfrage prüfen und die Anfrage zählen.
     * Liefert { userId, id } oder wirft 401/429.
     */
    pruefen(roh) {
      const s = String(roh || '').trim();
      const id = s.startsWith(PRAEFIX) ? nachHash.get(hash(s)) : null;
      const k = id && schluessel.get(id);
      if (!k || k.widerrufen) throw new AppError('api_schluessel', 'Ungültiger oder gelöschter Schlüssel.', 401);
      const t = uhr();
      const f = (fenster.get(k.id) || []).filter((x) => x > t - 60000);
      if (f.length >= ANFRAGEN_JE_MINUTE) {
        const e = new AppError('api_limit', `Zu viele Anfragen (höchstens ${ANFRAGEN_JE_MINUTE} je Minute).`, 429);
        e.retryAfterS = Math.ceil((f[0] + 60000 - t) / 1000);
        throw e;
      }
      f.push(t); fenster.set(k.id, f);
      k.anfragen += 1; k.zuletzt = new Date(t).toISOString();
      return { userId: k.user_id, id: k.id };
    },
    __dump() { return { schluessel: [...schluessel.values()].filter((k) => !k.widerrufen) }; },
    __load(d) {
      schluessel.clear(); nachHash.clear(); fenster.clear();
      for (const k of (d && d.schluessel) || []) { schluessel.set(k.id, { ...k }); nachHash.set(k.hash, k.id); }
    },
  };
}

/**
 * Zugang für eine Abfrage: gültiger Schlüssel UND laufender Business-Tarif.
 * Abgelaufen -> 402 mit Datum in Klartext (nicht still leere Listen: Eine
 * Warenwirtschaft, die „keine Engpässe" liest, bestellt sorglos weiter).
 */
export function zugangPruefen(roh, { api, hatTarif, tarifBis }) {
  if (!roh) throw new AppError('api_schluessel', 'Schlüssel fehlt. Kopfzeile „Authorization: Bearer apk_…" oder „X-API-Key" setzen.', 401);
  const { userId } = api.pruefen(roh);
  if (!hatTarif(userId)) {
    const bis = tarifBis(userId);
    throw new AppError('api_tarif', bis ? `Der Business-Tarif ist am ${String(bis).slice(0, 10)} abgelaufen. Bitte in ApoPulse verlängern.` : 'Die Daten-Schnittstelle gehört zum Business-Tarif.', 402);
  }
  return userId;
}

// ── Ausgabe ─────────────────────────────────────────────────────────────────

/**
 * Eine Engpass-Zeile für die Schnittstelle: stabile, dokumentierte Felder.
 * Referenzdaten (Beispielzeilen ohne Live-Quelle) gehören NICHT hinein — eine
 * Warenwirtschaft würde danach umbestellen. Das filtert `ausgeben`.
 */
export function engpassZeile(z, wirkstoffSchluessel) {
  return {
    wirkstoff: z.wirkstoff || null,
    wirkstoff_schluessel: z.wirkstoff ? (wirkstoffSchluessel(z.wirkstoff) || null) : null,
    bezeichnung: z.bezeichnung || null,
    land: String(z.country || '').toUpperCase() || null,
    status: z.status,
    grund: z.grund || null,
    gemeldet_am: z.gemeldet_am || null,
    voraussichtlich_bis: z.voraussichtlich_bis || null,
    herkunft: z.provenance === 'verified' ? 'behoerde' : 'apotheken_meldung',
    // Apotheken-Meldung: wie viele Apotheken sie tragen (Meldende + Bestätigungen).
    bestaetigt_von: z.provenance === 'community' ? 1 + (z.confirmations || []).length : null,
    quelle: z.quelle || null,
  };
}

/** Nur Zeilen mit echter Herkunft (Behörde oder Meldung aus Apotheken). */
export const fuerSchnittstelle = (z) => z.provenance === 'verified' || z.provenance === 'community';

/**
 * CSV für Excel und Warenwirtschaft: Semikolon (deutsches Excel), UTF-8 mit
 * BOM (sonst Umlaute kaputt), Formel-Schutz (Zellen, die mit = + - @ beginnen,
 * würde Excel als Formel ausführen).
 */
export function alsCsv(zeilen, spalten) {
  const zelle = (v) => {
    let s = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [spalten.join(';'), ...zeilen.map((z) => spalten.map((c) => zelle(z[c])).join(';'))].join('\r\n') + '\r\n';
}
