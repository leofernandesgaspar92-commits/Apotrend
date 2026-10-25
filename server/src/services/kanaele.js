// ============================================================================
//  Herkunft messen: Woher kommen Besuche und neue Konten?
// ============================================================================
//  Für die Werbung auf TikTok & Co. soll der Owner sehen, ob sie wirkt:
//  „TikTok: 120 Besuche → 14 neue Konten". Der Link in der Bio lautet dafür
//  https://www.apopulse.com/?k=tiktok — der Kanal ist frei wählbar
//  (k=whatsapp, k=flyer-dakar …). Die Play-App (Start /?src=twa) zählt als „play".
//
//  DATENSPARSAM: Gespeichert werden NUR Summen je Tag und Kanal. Kein Konto
//  trägt seinen Kanal, keine IP, kein Cookie, kein Tracker. Wer kam, lässt
//  sich daraus nicht ablesen.
//
//  Grenzen: höchstens MAX_KANAELE verschiedene Namen (sonst „andere") — wer
//  zufällige ?k=… aufruft, kann die Liste nicht fluten; Tage älter als
//  AUFBEWAHREN_TAGE fallen weg.
// ============================================================================

export const KANAL_RE = /^[a-z0-9][a-z0-9-]{1,19}$/;
export const MAX_KANAELE = 30;
export const AUFBEWAHREN_TAGE = 120;
const ANDERE = 'andere';

/** Kanalname aus Link oder Formular — klein, 2–20 Zeichen a–z 0–9 -; sonst null. */
export function normalisiereKanal(k) {
  const s = String(k ?? '').trim().toLowerCase();
  return KANAL_RE.test(s) ? s : null;
}

/** Vorschau-Abrufer von Messengern und Suchmaschinen sind keine Besuche. */
export function istVorschauAbruf(userAgent) {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|tiktok|bytespider|headless/i.test(String(userAgent || ''));
}

const tagVon = (d) => new Date(d).toISOString().slice(0, 10);

export function createKanaele({ jetzt = () => new Date() } = {}) {
  /** 'YYYY-MM-DD' -> Map(kanal -> { besuche, konten }) */
  const tage = new Map();

  function aufraeumen() {
    const grenze = tagVon(jetzt().getTime() - AUFBEWAHREN_TAGE * 86400000);
    for (const t of tage.keys()) if (t < grenze) tage.delete(t);
  }
  function bekannte() {
    const s = new Set();
    for (const m of tage.values()) for (const k of m.keys()) s.add(k);
    return s;
  }

  /** art: 'besuche' | 'konten'. Liefert den gezählten Kanal oder null. */
  function zaehle(kanal, art) {
    let k = normalisiereKanal(kanal);
    if (!k || (art !== 'besuche' && art !== 'konten')) return null;
    const alle = bekannte();
    if (!alle.has(k) && alle.size >= MAX_KANAELE) k = ANDERE;
    const tag = tagVon(jetzt());
    if (!tage.has(tag)) { tage.set(tag, new Map()); aufraeumen(); }
    const m = tage.get(tag);
    const z = m.get(k) || { besuche: 0, konten: 0 };
    z[art] += 1;
    m.set(k, z);
    return k;
  }

  /** Summen der letzten `anzahlTage` Tage, meiste neue Konten zuerst. */
  function bericht(anzahlTage = 30) {
    const ab = tagVon(jetzt().getTime() - (anzahlTage - 1) * 86400000);
    const s = new Map();
    for (const [t, m] of tage) {
      if (t < ab) continue;
      for (const [k, z] of m) {
        const x = s.get(k) || { kanal: k, besuche: 0, konten: 0 };
        x.besuche += z.besuche; x.konten += z.konten;
        s.set(k, x);
      }
    }
    return [...s.values()].sort((a, b) => b.konten - a.konten || b.besuche - a.besuche || a.kanal.localeCompare(b.kanal));
  }

  return {
    zaehle, bericht,
    __dump: () => [...tage].map(([t, m]) => [t, [...m]]),
    __load: (snap) => {
      tage.clear();
      for (const [t, liste] of Array.isArray(snap) ? snap : []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t)) || !Array.isArray(liste)) continue;
        const m = new Map();
        for (const [k, z] of liste) {
          const kk = normalisiereKanal(k);
          if (kk && z) m.set(kk, { besuche: Math.max(0, Number(z.besuche) || 0), konten: Math.max(0, Number(z.konten) || 0) });
        }
        tage.set(t, m);
      }
      aufraeumen();
    },
  };
}
