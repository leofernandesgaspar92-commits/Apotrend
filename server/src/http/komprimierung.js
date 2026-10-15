// ============================================================================
//  Kompression: Brotli vor gzip, statische Dateien nur einmal je Version
// ============================================================================
//  In Uganda oder Kenia kostet jedes Megabyte mobile Daten spürbar Geld, und
//  die Leitung ist oft langsam. Beim ersten Öffnen lud ein Handy rund 320 KB
//  (gzip). Mit Brotli (höchste Stufe) sind es rund 245 KB — ohne eine Zeile an
//  der App zu ändern. Alle heutigen Browser verstehen Brotli; wer es nicht
//  ankündigt, bekommt weiter gzip oder die Datei unkomprimiert.
//
//  Höchste Stufe braucht für app.js gut eine Sekunde Rechenzeit. Darum wird
//  jede Datei nur EINMAL je Version (ETag) komprimiert, im Hintergrund
//  (Thread-Pool, blockiert keine anderen Anfragen), und dann aus dem Speicher
//  ausgeliefert. Bisher wurde app.js bei JEDER Anfrage neu gezippt.
// ============================================================================

import fs from 'node:fs';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/** Beste Kodierung aus Accept-Encoding: 'br', 'gzip' oder null (unkomprimiert). q=0 heißt „nicht". */
export function kodierungWaehlen(acceptEncoding) {
  const q = new Map();
  for (const teil of String(acceptEncoding || '').toLowerCase().split(',')) {
    const [name, ...param] = teil.split(';').map((x) => x.trim());
    if (!name) continue;
    const qp = param.find((p) => p.startsWith('q='));
    q.set(name, qp ? Number(qp.slice(2)) || 0 : 1);
  }
  const erlaubt = (n) => (q.has(n) ? q.get(n) > 0 : q.has('*') && q.get('*') > 0);
  if (erlaubt('br')) return 'br';
  if (erlaubt('gzip')) return 'gzip';
  return null;
}

/** Sofort komprimieren (kleine, je Anfrage erzeugte Antworten: JSON, Startseite). */
export function kodierenSync(buf, kodierung) {
  if (kodierung === 'br') return zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
  if (kodierung === 'gzip') return zlib.gzipSync(buf);
  return buf;
}

// ── Versionskennung (ETag) aus dem INHALT ───────────────────────────────────
//  Vorher: Größe + Änderungszeit. Render baut jedes Deploy aus einem frischen
//  Git-Klon — alle Dateien bekommen eine neue Änderungszeit. Folge: nach JEDEM
//  Deploy lud jedes Handy die ganze App neu (~245 KB), auch unveränderte
//  Dateien. Jetzt eine Prüfsumme des Inhalts: Unverändertes bleibt beim kurzen
//  „304 unverändert". Gerechnet wird nur, wenn sich Größe/Änderungszeit ändern.
export function createVersionsKennung({ maxDateien = 256 } = {}) {
  const speicher = new Map(); // Pfad -> { schluessel, hash }
  return function etag(datei, stat, zusatz = null) {
    const schluessel = stat.size + ':' + stat.mtimeMs;
    let e = speicher.get(datei);
    if (!e || e.schluessel !== schluessel) {
      e = { schluessel, hash: createHash('sha256').update(fs.readFileSync(datei)).digest('base64url').slice(0, 22) };
      speicher.delete(datei);
      speicher.set(datei, e);
      if (speicher.size > maxDateien) speicher.delete(speicher.keys().next().value);
    }
    return 'W/"' + e.hash + (zusatz ? '-' + zusatz : '') + '"';
  };
}

/** Speicher für komprimierte statische Dateien: je Pfad nur die aktuelle Version.
 *  umformen(datei, buf) -> buf: optional vor dem Komprimieren (schlanke Skripte);
 *  einmal je Version, gemeinsam für alle Kodierungen. Kodierung 'roh' = unkomprimiert. */
export function createKompressionsSpeicher({ maxDateien = 64, umformen = null } = {}) {
  const speicher = new Map(); // Pfad -> { etag, roh?: Promise<Buffer>, br?: Promise<Buffer>, gzip?: Promise<Buffer> }
  function holen(datei, etag, kodierung = 'roh') {
    let e = speicher.get(datei);
    if (!e || e.etag !== etag) {
      e = { etag };
      speicher.delete(datei);
      speicher.set(datei, e);
      if (speicher.size > maxDateien) speicher.delete(speicher.keys().next().value);
    }
    if (!e[kodierung]) {
      let p;
      if (kodierung === 'roh') p = fs.promises.readFile(datei).then((b) => (umformen ? umformen(datei, b) : b));
      else p = holen(datei, etag, 'roh').then((b) => (kodierung === 'br'
        ? brotli(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } })
        : gzip(b, { level: 9 })));
      // Fehlschlag nicht festhalten: nächste Anfrage versucht es neu.
      p.catch(() => { if (e[kodierung] === p) delete e[kodierung]; });
      e[kodierung] = p;
    }
    return e[kodierung];
  }
  return { holen, groesse: () => speicher.size };
}
