// ============================================================================
//  Fehler auf den Geräten: Was bricht bei Nutzer:innen ab?
// ============================================================================
//  Bis 10/2026 erfuhr niemand, wenn die App auf einem Handy mit einem Skript-
//  Fehler abbrach — gerade auf älteren Android-Geräten in den Zielmärkten. Jetzt
//  meldet die Seite unerwartete Fehler (kein Netz-, kein Server-Fehler) an
//  /api/fehlerbericht; das Betriebs-Cockpit zeigt die häufigsten.
//
//  DATENSPARSAM: keine IP, kein Konto, kein Cookie. Gespeichert werden je
//  Fehlerart nur Meldung, Ort im Code, Ausschnitt des Stapels, Anzahl, erstes
//  und letztes Auftreten und grobe Geräteklasse (Android/iPhone/Rechner,
//  Browser-Familie). E-Mail-Adressen, lange Ziffernfolgen (Telefon), lange
//  Zeichenketten (Schlüssel) und alles hinter „?" in Adressen werden VOR dem
//  Speichern unkenntlich gemacht — Fehlermeldungen können Eingaben enthalten.
//
//  Grenzen: höchstens MAX_ARTEN Fehlerarten (die am längsten ruhige fällt
//  weg), Texte gekürzt, nach AUFBEWAHREN_TAGE ohne Auftreten gelöscht.
// ============================================================================

export const MAX_ARTEN = 50;
export const MAX_MELDUNG = 300;
export const MAX_STAPEL = 1200;
export const AUFBEWAHREN_TAGE = 30;

/** Text kürzen und von möglichen persönlichen Angaben befreien. */
export function bereinige(text, max = MAX_MELDUNG) {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/https?:\/\/[^/\s)]+/gi, '') // eigene Herkunft weglassen: /app.js:12:3 genügt
    .replace(/\?[^\s):]*/g, '') // Abfrageteil von Adressen (Token, Suchbegriffe)
    .replace(/[^\s@()<>"']+@[^\s@()<>"']+\.[a-z]{2,}/gi, '[E-Mail]')
    .replace(/\+?\d[\d\s\-/]{5,}\d/g, (z) => (z.replace(/\D/g, '').length >= 6 ? '[Zahl]' : z))
    .replace(/[A-Za-z0-9_\-.+/=]{32,}/g, '[…]')
    .replace(/\s+\n/g, '\n').trim()
    .slice(0, max);
}

/** Grobe Geräteklasse aus dem User-Agent — nie der User-Agent selbst. */
export function geraeteKlasse(userAgent) {
  const ua = String(userAgent || '');
  const android = ua.match(/Android (\d+)/);
  const ios = ua.match(/(?:iPhone|iPad)[^)]*OS (\d+)/);
  const geraet = android ? `Android ${android[1]}` : ios ? `iOS ${ios[1]}` : /Mobile/i.test(ua) ? 'Handy' : 'Rechner';
  const browser = /OPR\/|Opera Mini|OPiOS/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari' : 'anderer Browser';
  return `${geraet} · ${browser}`;
}

const ORT_RE = /^\/?[a-z0-9_\-/]{1,40}\.js$/i;

export function createGeraeteFehler({ jetzt = () => Date.now() } = {}) {
  /** schluessel -> { meldung, ort, stapel, anzahl, erst, zuletzt, geraete: { klasse: n } } */
  const arten = new Map();

  function aufraeumen() {
    const grenze = jetzt() - AUFBEWAHREN_TAGE * 86400000;
    for (const [k, a] of arten) if (a.zuletzt < grenze) arten.delete(k);
  }

  /** Eine Meldung verbuchen. Liefert true, wenn gezählt (sonst unbrauchbar). */
  function melde(roh, userAgent) {
    const r = roh && typeof roh === 'object' ? roh : {};
    const meldung = bereinige(r.meldung);
    if (!meldung) return false;
    const datei = String(r.datei || '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    const ort = ORT_RE.test(datei) ? `${datei.replace(/^\/?/, '/')}:${Math.max(0, Math.trunc(Number(r.zeile) || 0))}:${Math.max(0, Math.trunc(Number(r.spalte) || 0))}` : '';
    const schluessel = meldung + '|' + ort;
    const t = jetzt();
    aufraeumen();
    let a = arten.get(schluessel);
    if (!a) {
      if (arten.size >= MAX_ARTEN) {
        let aeltester = null;
        for (const [k, x] of arten) if (!aeltester || x.zuletzt < arten.get(aeltester).zuletzt) aeltester = k;
        arten.delete(aeltester);
      }
      a = { meldung, ort, stapel: bereinige(r.stapel, MAX_STAPEL), anzahl: 0, erst: t, zuletzt: t, geraete: {} };
      arten.set(schluessel, a);
    }
    a.anzahl += 1; a.zuletzt = t;
    const kl = geraeteKlasse(userAgent);
    if (a.geraete[kl] || Object.keys(a.geraete).length < 10) a.geraete[kl] = (a.geraete[kl] || 0) + 1;
    return true;
  }

  /** Häufigste Fehlerarten der letzten `tage` Tage. */
  function bericht({ tage = 7, anzahl = 10 } = {}) {
    aufraeumen();
    const ab = jetzt() - tage * 86400000;
    const liste = [...arten.values()].filter((a) => a.zuletzt >= ab)
      .sort((x, y) => y.anzahl - x.anzahl || y.zuletzt - x.zuletzt);
    return {
      arten: liste.length,
      meldungen: liste.reduce((n, a) => n + a.anzahl, 0),
      liste: liste.slice(0, anzahl).map((a) => ({
        meldung: a.meldung, ort: a.ort, stapel: a.stapel, anzahl: a.anzahl,
        erst: new Date(a.erst).toISOString(), zuletzt: new Date(a.zuletzt).toISOString(),
        geraete: Object.entries(a.geraete).sort((x, y) => y[1] - x[1]).map(([klasse, n]) => ({ klasse, n })),
      })),
    };
  }

  return {
    melde, bericht,
    __dump: () => [...arten.values()],
    __load: (snap) => {
      arten.clear();
      for (const a of Array.isArray(snap) ? snap : []) {
        if (!a || typeof a.meldung !== 'string' || !a.meldung) continue;
        const x = { meldung: bereinige(a.meldung), ort: String(a.ort || '').slice(0, 80), stapel: bereinige(a.stapel, MAX_STAPEL),
          anzahl: Math.max(1, Math.trunc(Number(a.anzahl) || 1)), erst: Number(a.erst) || jetzt(), zuletzt: Number(a.zuletzt) || jetzt(), geraete: {} };
        for (const [k, n] of Object.entries(a.geraete && typeof a.geraete === 'object' ? a.geraete : {}).slice(0, 10)) x.geraete[String(k).slice(0, 40)] = Math.max(0, Math.trunc(Number(n) || 0));
        arten.set(x.meldung + '|' + x.ort, x);
        if (arten.size >= MAX_ARTEN) break;
      }
      aufraeumen();
    },
  };
}
