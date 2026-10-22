// ============================================================================
//  Eine Sprache je Datei: /i18n/<sprache>.js
// ============================================================================
//  public/i18n.js enthält alle Sprachen der App (de, en, pt, fr, ar) — mit
//  Brotli 147 KB, mehr als die halbe Erstladung. Jede Nutzerin braucht EINE
//  davon: 35 KB. Auf einem Prepaid-Handy in Dakar oder Kampala ist der
//  Unterschied (rund 112 KB bei jedem ersten Besuch) bares Geld.
//
//  public/i18n.js bleibt die eine Quelle (Tests, Audit, Paritätsprüfung lesen
//  sie). Der Server schneidet daraus je Sprache eine Datei — neu, sobald sich
//  i18n.js ändert. Sie hängt die Sprache an ein gemeinsames Objekt an, damit
//  die App eine zweite Sprache nachladen kann (Sprachwahl, Länderwechsel):
//      (self.I18N = self.I18N || {}).fr = { … };
//
//  Ausgewertet wird nur die eigene Datei aus public/ — kein Fremdinhalt.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export function createSprachdateien({ datei, sprachen }) {
  let stand = null; // { mtimeMs, size, je: Map(sprache -> { roh, etag, br?, gzip? }) }

  function aktuell() {
    const st = fs.statSync(datei);
    if (stand && stand.mtimeMs === st.mtimeMs && stand.size === st.size) return stand;
    const ctx = {};
    vm.runInNewContext(fs.readFileSync(datei, 'utf8') + '\n;this.__I18N = I18N;', ctx, { timeout: 5000 });
    const je = new Map();
    for (const sp of sprachen) {
      if (!ctx.__I18N || !ctx.__I18N[sp]) continue;
      const roh = Buffer.from(`(self.I18N = self.I18N || {}).${sp} = ${JSON.stringify(ctx.__I18N[sp])};\n`);
      je.set(sp, { roh, etag: `"i18n-${sp}-${crypto.createHash('sha256').update(roh).digest('hex').slice(0, 20)}"` });
    }
    stand = { mtimeMs: st.mtimeMs, size: st.size, je };
    return stand;
  }

  /** { etag, body } in der gewünschten Kodierung ('br' | 'gzip' | null) — oder null (unbekannte Sprache). */
  function holen(sprache, kodierung = null) {
    const e = aktuell().je.get(sprache);
    if (!e) return null;
    if (kodierung && !e[kodierung]) {
      e[kodierung] = kodierung === 'br'
        ? zlib.brotliCompressSync(e.roh, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: e.roh.length } })
        : zlib.gzipSync(e.roh, { level: 9 });
    }
    return { etag: e.etag, body: kodierung ? e[kodierung] : e.roh };
  }
  return { holen };
}
