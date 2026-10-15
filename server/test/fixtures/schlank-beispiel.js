// Kommentar am Anfang — Beispiel für test/komprimierung.test.js (schlank.js).
// Jede Zeile prüft eine Falle: Kommentarzeichen, die KEINE Kommentare sind.
    const a = "// kein Kommentar", b = '/* auch keiner */';
    /* Block-Kommentar
       über zwei Zeilen */
    const r = /\/\/[a-z]*/g, k = /[/]+x/;
    const ersetzt = "it's".replace(/'/g, '"'), doppelt = /[//]+/.test('//');
    const innen = 7;
    const t = `Anfang ${ { x: innen }.x } // bleibt
        eingerückt bleibt ${ innen > 1 ? `verschachtelt ${ innen } /* auch */` : '' } Ende`;
    let z = 10
    let w = z
    ++z
    const geteilt = z / 2 / 1
    function f() { return /* x */ 1 }
    const ergebnis = [ersetzt, doppelt, a, b, r.test('//abc'), k.test('//x'), t, w, z, geteilt, f(), typeof /a/, 1.5e-3 + 0x1e - 1, 'a' + + '2'];
