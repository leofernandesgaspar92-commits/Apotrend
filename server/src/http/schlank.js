// ============================================================================
//  Schlanke Auslieferung von JavaScript: Kommentare und Einrückung weg
// ============================================================================
//  app.js ist bewusst ausführlich kommentiert (warum etwas so ist, steht direkt
//  am Code). Das Handy braucht davon nichts: ohne Kommentare und Einrückung
//  sind es 110 statt 144 KB (Brotli) — weitere 24 % weniger beim ersten Öffnen
//  und nach jedem App-Update. Die Quelldatei im Repo bleibt unverändert.
//
//  Kein Build-Werkzeug (die Plattform läuft nur mit Node selbst), darum ein
//  kleiner Zerleger, der Zeichenketten, Vorlagen (`…${…}…`) und reguläre
//  Ausdrücke erkennt und NUR außerhalb davon Kommentare und Leerraum entfernt.
//  Zeilenumbrüche bleiben (je einer), damit die automatische Semikolon-Regel
//  von JavaScript genau wie im Original greift.
//
//  Absicherung: schlankSicher() übersetzt das Ergebnis probeweise (vm.Script);
//  scheitert das oder irgendetwas anderes, geht das Original hinaus. Der Test
//  vergleicht zusätzlich Token für Token mit einem echten Parser, und der
//  Browser-Audit läuft komplett auf der schlanken Fassung.
//  Abschalten: APOPULSE_SCHLANK=aus.
// ============================================================================

import vm from 'node:vm';

const SCHLUESSELWOERTER_VOR_AUSDRUCK = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const istWortzeichen = (c) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

/** JavaScript-Quelltext ohne Kommentare, Einrückung, Leerzeilen und doppelte Leerzeichen. */
export function schlankJs(src) {
  const n = src.length;
  const out = [];
  let i = 0;
  let zeilenAnfang = true;   // am Zeilenanfang: Einrückung überspringen
  let leerOffen = false;     // ein Leerzeichen steht aus (nur vor dem nächsten Token)
  let zuletzt = '';          // letztes bedeutsames Token: Wort, Schlüsselwort oder Satzzeichen
  let letztesZeichen = '\n'; // zuletzt ausgegebenes Zeichen
  let klammerTiefe = 0;      // geschweifte Klammern außerhalb von Vorlagen
  const vorlagen = [];       // klammerTiefe beim Öffnen von `${`

  const gib = (s) => {
    if (leerOffen && letztesZeichen !== '\n' && letztesZeichen !== ' ') out.push(' ');
    leerOffen = false;
    out.push(s);
    letztesZeichen = s[s.length - 1];
  };
  const umbruch = () => {
    leerOffen = false;
    if (letztesZeichen !== '\n') { out.push('\n'); letztesZeichen = '\n'; }
    zeilenAnfang = true;
  };
  // Zeichenkette '…' oder "…" ab i (öffnendes Zeichen) — unverändert kopieren.
  const zeichenkette = () => {
    const q = src[i]; let j = i + 1;
    while (j < n && src[j] !== q) { if (src[j] === '\\') j++; else if (src[j] === '\n') throw new SyntaxError('Zeilenumbruch in Zeichenkette'); j++; }
    if (j >= n) throw new SyntaxError('Zeichenkette ohne Ende');
    gib(src.slice(i, j + 1)); i = j + 1; zuletzt = 'wert';
  };
  // Vorlagentext ab i (direkt nach ` oder nach dem } eines ${…}) bis ` oder ${.
  const vorlagenText = () => {
    let j = i;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`') { gib(src.slice(i, j + 1)); i = j + 1; zuletzt = 'wert'; return; }
      if (src[j] === '$' && src[j + 1] === '{') { gib(src.slice(i, j + 2)); i = j + 2; vorlagen.push(klammerTiefe); zuletzt = '{'; return; }
      j++;
    }
    throw new SyntaxError('Vorlage ohne Ende');
  };
  // Regulärer Ausdruck /…/flags ab i.
  const regAusdruck = () => {
    let j = i + 1; let inKlasse = false;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '\n') throw new SyntaxError('Zeilenumbruch in regulärem Ausdruck');
      if (inKlasse) { if (c === ']') inKlasse = false; } else if (c === '[') inKlasse = true; else if (c === '/') break;
      j++;
    }
    j++;
    while (j < n && /[a-z]/i.test(src[j])) j++;
    gib(src.slice(i, j)); i = j; zuletzt = 'wert';
  };
  const regexErlaubt = () => {
    if (zuletzt === '' || SCHLUESSELWOERTER_VOR_AUSDRUCK.has(zuletzt)) return true;
    if (zuletzt === 'wort' || zuletzt === 'wert') return false;
    return !(zuletzt === ')' || zuletzt === ']' || zuletzt === '}');
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n' || c === '\r') { umbruch(); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') {
      if (!zeilenAnfang) leerOffen = true;
      i++; continue;
    }
    zeilenAnfang = false;
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new SyntaxError('Kommentar ohne Ende');
      const mitUmbruch = src.slice(i, e).includes('\n');
      i = e + 2;
      if (mitUmbruch) umbruch(); else leerOffen = true;
      continue;
    }
    if (c === '"' || c === "'") { zeichenkette(); continue; }
    if (c === '`') { gib('`'); i++; vorlagenText(); continue; }
    if (c === '}' && vorlagen.length && vorlagen[vorlagen.length - 1] === klammerTiefe) {
      vorlagen.pop(); gib('}'); i++; vorlagenText(); continue;
    }
    if (c === '/' && regexErlaubt()) { regAusdruck(); continue; }
    if (istWortzeichen(c)) {
      let j = i + 1;
      // Zahlen mit Exponent/Punkt (1.5e-3) zusammenhalten.
      if (/[0-9]/.test(c)) { while (j < n && (istWortzeichen(src[j]) || src[j] === '.' || ((src[j] === '-' || src[j] === '+') && /[eE]/.test(src[j - 1]) && !/^0[xX]/.test(src.slice(i, j))))) j++; }
      else while (j < n && istWortzeichen(src[j])) j++;
      const wort = src.slice(i, j);
      // Zwei Wörter brauchen ein Leerzeichen dazwischen (auch wenn es aussteht).
      if (istWortzeichen(letztesZeichen) && !leerOffen) out.push(' ');
      gib(wort); i = j;
      zuletzt = SCHLUESSELWOERTER_VOR_AUSDRUCK.has(wort) ? wort : 'wort';
      continue;
    }
    if (c === '{') klammerTiefe++;
    else if (c === '}') klammerTiefe--;
    gib(c); i++;
    zuletzt = c;
  }
  if (vorlagen.length) throw new SyntaxError('Vorlage nicht geschlossen');
  return out.join('');
}

let gewarnt = false;
/** Schlanke Fassung, wenn sie sich fehlerfrei übersetzen lässt — sonst das Original. */
export function schlankSicher(buf, { name = 'Skript' } = {}) {
  try {
    const roh = buf.toString('utf8');
    const schlank = schlankJs(roh);
    new vm.Script(schlank, { filename: name }); // nur übersetzen, nicht ausführen
    return Buffer.from(schlank);
  } catch (e) {
    if (!gewarnt) { gewarnt = true; console.warn(`ApoPulse: ${name} wird unverändert ausgeliefert (schlanke Fassung nicht sicher: ${e.message})`); }
    return buf;
  }
}
