#!/usr/bin/env node
// ============================================================================
//  QR-Encoder gegen unabhängige Referenzen prüfen
// ============================================================================
//  Ein selbstgeschriebener QR-Encoder, der nur „sieht aus wie ein QR-Code"
//  liefert, ist gefährlicher als gar keiner: Bei einer Krypto-Zahlung führt ein
//  falsch decodierter Code zu einer Überweisung an eine fremde Adresse.
//
//  Geprüft wird deshalb nicht das Aussehen, sondern die Modul-Matrix Zelle für
//  Zelle gegen `python-qrcode` — über mehrere echte Nutzlasten und ALLE ACHT
//  Masken, damit Format-Bits, Verschränkung, Reed-Solomon und Maskenlogik
//  abgedeckt sind und nicht nur ein Zufallstreffer.
//
//  ── Warum python-qrcode und nicht segno ──────────────────────────────────
//  Beide wurden verglichen. Bei Nutzlasten, die eine Version EXAKT ausfüllen
//  (keine Auffüll-Codewörter), stimmen alle drei Implementierungen Byte für
//  Byte überein — einschließlich der Fehlerkorrektur-Codewörter. Sobald
//  aufgefüllt werden muss, schiebt `segno` ein zusätzliches 0x00 vor die
//  Auffüllfolge EC/11 ein; dieser Encoder und `python-qrcode` tun das nicht.
//
//  Beide Ergebnisse decodieren zum selben Text (Auffüllbytes liegen hinter dem
//  Zeichenzähler und werden von jedem Decoder ignoriert), die Matrizen
//  unterscheiden sich aber. Als Referenz dient deshalb python-qrcode, das mit
//  dieser Implementierung übereinstimmt; segno wird zusätzlich auf einer
//  exakt füllenden Nutzlast geprüft, damit die zweite unabhängige Meinung
//  nicht verlorengeht.
//
//  Voraussetzung:  pip install qrcode segno
//  Aufruf:         node tools/verify-qr.mjs
// ============================================================================

import { spawnSync } from 'node:child_process';
import { encodeQr } from '../src/domain/qr.js';

const PAYLOADS = [
  'bitcoin:bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46',
  'bitcoin:bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46?amount=0.00123456',
  'ethereum:0x5f50991186014eDcbDE301467bE7a20C6CCc179B@1?value=125000000000000000',
  'tron:TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE?amount=149.00',
  'solana:Egbc7cfzHLj5dkgnR4E7Xk3MfDNrA5imqKJ1FV1n1DW?amount=1.25&label=Apotrend',
  // Lang genug für Version 7+ — deckt zusätzlich die Versionsinformation ab.
  'wc:8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@2?relay-protocol=irn&symKey=' +
    'c9e6d30fb34afe70a15c14e9337ba8e4d5a35dd695c39b94884b0ee60c69d168',
  // Umlaute und Sonderzeichen: prüft die UTF-8-Kodierung.
  'Apotrend Lizenz · Österreich · 149,00 €',
];

/** Nutzlast, die Version 1 exakt ausfüllt — dort sind sich alle einig. */
const EXACT_FIT = 'APOTREND-DEMO1';

const PY_REFERENCE = `
import sys, json
import qrcode
from qrcode.util import QRData, MODE_8BIT_BYTE
import qrcode.constants as C

p = json.loads(sys.stdin.readline())
qr = qrcode.QRCode(error_correction=C.ERROR_CORRECT_M, border=0,
                   mask_pattern=p["mask"])
qr.add_data(QRData(p["text"].encode("utf-8"), mode=MODE_8BIT_BYTE))
qr.make(fit=True)
matrix = [[1 if cell else 0 for cell in row] for row in qr.get_matrix()]
print(json.dumps({"version": qr.version, "matrix": matrix}))
`;

const PY_SEGNO = `
import sys, json, segno
p = json.loads(sys.stdin.readline())
# micro=False ist zwingend: sonst wählt segno bei kurzen Nutzlasten still einen
# Micro-QR (Version M3, 15x15) — ein anderes Format, das nichts belegt.
qr = segno.make(p["text"], error="m", mask=p["mask"], mode="byte",
                boost_error=False, micro=False)
print(json.dumps({"version": qr.version,
                  "matrix": [[int(c) for c in row] for row in qr.matrix]}))
`;

function runPython(script, payload) {
  const res = spawnSync('python3', ['-c', script], {
    input: JSON.stringify(payload) + '\n',
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    throw new Error((res.stderr || '').trim().split('\n').pop() || 'unbekannter Fehler');
  }
  return JSON.parse(res.stdout);
}

function compare(mine, reference, label) {
  if (mine.size !== reference.matrix.length) {
    return `Größe ${mine.size} statt ${reference.matrix.length}`;
  }
  let diffs = 0;
  let first = null;
  for (let r = 0; r < mine.size; r++) {
    for (let c = 0; c < mine.size; c++) {
      const a = mine.modules[r][c] ? 1 : 0;
      const b = reference.matrix[r][c];
      if (a !== b) {
        diffs++;
        if (!first) first = `Zeile ${r}, Spalte ${c}: ${a} statt ${b}`;
      }
    }
  }
  return diffs === 0 ? null : `${diffs} abweichende Module (zuerst ${first})`;
}

function haveModule(name) {
  return spawnSync('python3', ['-c', `import ${name}`], { encoding: 'utf8' }).status === 0;
}

function main() {
  if (!haveModule('qrcode')) {
    console.error('✗ python-qrcode fehlt. Installieren mit:  pip install qrcode');
    process.exit(2);
  }

  let compared = 0;
  let failures = 0;

  for (const text of PAYLOADS) {
    const label = text.length > 46 ? text.slice(0, 43) + '…' : text;
    const problems = [];

    for (let mask = 0; mask < 8; mask++) {
      try {
        const mine = encodeQr(text, { mask });
        const reference = runPython(PY_REFERENCE, { text, mask });
        if (mine.version !== reference.version) {
          problems.push(`Maske ${mask}: Version ${mine.version} statt ${reference.version}`);
        } else {
          const diff = compare(mine, reference, label);
          if (diff) problems.push(`Maske ${mask}: ${diff}`);
        }
        compared++;
      } catch (e) {
        problems.push(`Maske ${mask}: ${e.message}`);
        failures++;
      }
    }

    if (problems.length === 0) {
      const { version } = encodeQr(text, { mask: 0 });
      console.log(`✓ ${label}  (Version ${version}, alle 8 Masken identisch)`);
    } else {
      failures += problems.length;
      for (const p of problems) console.log(`✗ ${label}  ${p}`);
    }
  }

  // Zweite, unabhängige Meinung auf der exakt füllenden Nutzlast.
  if (haveModule('segno')) {
    let segnoFailures = 0;
    for (let mask = 0; mask < 8; mask++) {
      const mine = encodeQr(EXACT_FIT, { mask });
      const diff = compare(mine, runPython(PY_SEGNO, { text: EXACT_FIT, mask }), EXACT_FIT);
      if (diff) {
        console.log(`✗ segno-Gegenprobe „${EXACT_FIT}"  Maske ${mask}: ${diff}`);
        segnoFailures++;
      }
      compared++;
    }
    failures += segnoFailures;
    if (segnoFailures === 0) {
      console.log(`✓ segno-Gegenprobe „${EXACT_FIT}"  (alle 8 Masken identisch)`);
    }
  } else {
    console.log('… segno nicht installiert — Gegenprobe übersprungen.');
  }

  console.log('');
  if (failures === 0) {
    console.log(`✓ ${compared} Matrizen geprüft — jede Zelle identisch zur Referenz.`);
    process.exit(0);
  }
  console.log(`✗ ${failures} Abweichungen bei ${compared} Vergleichen.`);
  process.exit(1);
}

main();
