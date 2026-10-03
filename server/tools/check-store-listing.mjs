// ============================================================================
//  Store-Texte gegen die Play-Grenzen prüfen
// ============================================================================
//  Die Play Console schneidet zu lange Texte nicht ab — sie verweigert das
//  Speichern. Wer das erst dort merkt, sitzt mit einem halb ausgefüllten
//  Formular da und kürzt unter Zeitdruck.
//
//  Anlass ist handfest: Die erste Fassung von android/store-listing.md nannte
//  vier falsche Zeichenzahlen (geschätzt statt gezählt) und lag bei der
//  deutschen Kurzbeschreibung exakt auf 80/80. Exakt auf der Grenze ist nicht
//  „gerade noch" — Play zählt Emoji, Gedankenstriche und Umlaute nicht
//  zwangsläufig so wie JavaScript.
//
//  Geprüft wird deshalb die DATEI, nicht ein Gedächtnisprotokoll: Was in
//  store-listing.md steht, muss passen, und die danebenstehende Zahl muss
//  stimmen.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const DATEI = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'android', 'store-listing.md');

/** Play-Grenzen (Stand 10/2026). */
export const GRENZEN = { titel: 30, kurz: 80, voll: 4000 };

/** Sicherheitsabstand bei den kurzen Feldern: exakt auf der Grenze ist zu knapp. */
export const PUFFER = 2;

/**
 * Die Blöcke aus der Datei lesen.
 * Form: `### <Beschriftung> (<n> <Einheit>)` gefolgt von einem ```-Block.
 */
export function leseBloecke(markdown) {
  const out = [];
  const rx = /^### ([^\n(]+?)\s*\((\d+)\s+\S+\)\s*\n```\n([\s\S]*?)\n```/gm;
  for (const m of markdown.matchAll(rx)) {
    out.push({ beschriftung: m[1].trim(), angegeben: Number(m[2]), text: m[3] });
  }
  // Vollbeschreibungen tragen keine Zahl in der Überschrift.
  const rxVoll = /^### (Vollständige Beschreibung|Full description|Descrição completa)\s*\n```\n([\s\S]*?)\n```/gm;
  for (const m of markdown.matchAll(rxVoll)) {
    out.push({ beschriftung: m[1].trim(), angegeben: null, text: m[2] });
  }
  return out;
}

/** Welche Grenze gilt für eine Beschriftung? */
export function grenzeFuer(beschriftung) {
  const b = beschriftung.toLowerCase();
  if (/^titel|^title|^título/.test(b)) return { name: 'Titel', max: GRENZEN.titel, puffer: PUFFER };
  if (/kurzbeschreibung|short description|descrição breve/.test(b)) return { name: 'Kurzbeschreibung', max: GRENZEN.kurz, puffer: PUFFER };
  return { name: 'Vollbeschreibung', max: GRENZEN.voll, puffer: 0 };
}

export function pruefe(markdown) {
  const befunde = [];
  const bloecke = leseBloecke(markdown);
  if (bloecke.length < 6) {
    befunde.push(`Nur ${bloecke.length} Textblöcke gefunden — erwartet mindestens 6 (Titel/Kurz/Voll × 3 Sprachen). `
      + 'Hat sich das Format der Datei geändert? Dann prüft dieser Test nichts mehr.');
  }
  for (const b of bloecke) {
    const g = grenzeFuer(b.beschriftung);
    const n = [...b.text].length; // Codepoints, nicht UTF-16-Einheiten
    if (n > g.max) {
      befunde.push(`„${b.beschriftung}": ${n} Zeichen, erlaubt sind ${g.max}. Play verweigert das Speichern.`);
    } else if (g.puffer && n > g.max - g.puffer) {
      befunde.push(`„${b.beschriftung}": ${n}/${g.max} — zu knapp. Play zählt Gedankenstriche und Umlaute `
        + `nicht zwangsläufig wie JavaScript; mindestens ${g.puffer} Zeichen Luft lassen.`);
    }
    if (b.angegeben != null && b.angegeben !== n) {
      befunde.push(`„${b.beschriftung}": Überschrift sagt ${b.angegeben} Zeichen, tatsächlich sind es ${n}. `
        + 'Eine falsche Zahl neben dem Text ist schlimmer als keine.');
    }
  }
  return { bloecke: bloecke.length, befunde };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!fs.existsSync(DATEI)) {
    console.error(`❌ ${DATEI} fehlt — ohne Store-Texte keine Veröffentlichung.`);
    process.exit(1);
  }
  const { bloecke, befunde } = pruefe(fs.readFileSync(DATEI, 'utf8'));
  if (befunde.length) {
    console.log(`⚠️ Store-Texte: ${befunde.length} Befund(e):`);
    befunde.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log(`✓ Store-Texte: ${bloecke} Blöcke, alle innerhalb der Play-Grenzen.`);
}
