#!/usr/bin/env node
// ============================================================================
//  Datenbank-Schritt des Builds
// ============================================================================
//  Läuft auf Render im buildCommand. Er hat genau eine heikle Eigenschaft, und
//  deshalb gibt es dieses Skript statt einer Befehlskette in render.yaml:
//
//    `prisma migrate deploy` bricht ab, wenn DATABASE_URL fehlt.
//    In einer Befehlskette würde damit der GESAMTE Build scheitern — die App
//    wäre offline, nur weil noch keine Datenbank angehängt ist. Die Anwendung
//    läuft aber ohne Datenbank vollständig weiter (In-Memory + Snapshot).
//
//  Also:
//    · `prisma generate` läuft IMMER (braucht keine Datenbank).
//    · `prisma migrate deploy` läuft NUR mit DATABASE_URL.
//    · Fehlt die Variable: Hinweis ausgeben, Build gruen abschliessen.
//    · Ist eine Datenbank da und die Migration scheitert: LAUT scheitern.
//      Eine App gegen ein halb migriertes Schema zu starten ist schlimmer als
//      ein fehlgeschlagenes Deploy.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = path.join(serverDir, 'prisma', 'schema.prisma');

function run(args) {
  const res = spawnSync('npx', ['--no-install', 'prisma', ...args], {
    cwd: serverDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (res.error) return { ok: false, reason: res.error.message };
  if (res.status !== 0) return { ok: false, reason: `Exit-Code ${res.status}` };
  return { ok: true };
}

// Den ECHTEN Wert festhalten, bevor unten ggf. ein Platzhalter gesetzt wird.
const echteUrl = (process.env.DATABASE_URL || '').trim();

if (!existsSync(schema)) {
  console.log('ApoPulse DB: kein prisma/schema.prisma — nichts zu tun.');
  process.exit(0);
}

// 1. Client erzeugen. Ohne diesen Schritt wirft `import('@prisma/client')` zur
//    Laufzeit; der Store faengt das ab, aber dann liefe die Datenbank-Spiegelung
//    still nie an. Schlaegt der Schritt fehl, ist das kein Grund, das Deploy zu
//    stoppen — die App laeuft ohne Datenbank.
// Ohne DATABASE_URL kann `env("DATABASE_URL")` im Schema nicht aufgeloest
// werden. Manche Prisma-Befehle brechen deshalb mit P1012 ab, BEVOR sie
// ueberhaupt merken, dass sie gar keine Verbindung brauchen. Fuer das reine
// Erzeugen des Clients wird nie verbunden — ein Platzhalter genuegt und macht
// den Schritt unabhaengig davon, ob schon eine Datenbank angehaengt ist.
//
// Der Platzhalter gilt AUSSCHLIESSLICH hier. Fuer die Migrationen weiter unten
// wird die echte Variable geprueft; mit dem Platzhalter zu migrieren hiesse,
// gegen einen Rechner zu laufen, den es nicht gibt.
if (!(process.env.DATABASE_URL || '').trim()) {
  process.env.DATABASE_URL = 'postgresql://platzhalter:platzhalter@127.0.0.1:5432/platzhalter';
  console.log('ApoPulse DB: keine DATABASE_URL — Client wird mit Platzhalter erzeugt '
    + '(es wird dabei nichts verbunden).');
}

const gen = run(['generate', '--schema', schema]);
if (!gen.ok) {
  console.warn(`ApoPulse DB: "prisma generate" fehlgeschlagen (${gen.reason}). `
    + 'Die App startet trotzdem — ohne Datenbank-Spiegelung.');
}

// 2. Migrationen — nur mit ECHTER Datenbank. `echteUrl` wurde ganz oben
//    gemerkt, bevor der Platzhalter gesetzt wurde: Sonst hielte der Schritt
//    hier den Platzhalter fuer eine Datenbank und liefe in eine Verbindung,
//    die es nicht gibt.
const url = echteUrl;
if (!url) {
  console.log('ApoPulse DB: DATABASE_URL nicht gesetzt — Migrationen uebersprungen. '
    + 'Die App laeuft mit In-Memory-Speicher und JSON-Snapshot (siehe docs/DATENBANK.md).');
  process.exit(0);
}

const mig = run(['migrate', 'deploy', '--schema', schema]);
if (!mig.ok) {
  console.error(`ApoPulse DB: "prisma migrate deploy" fehlgeschlagen (${mig.reason}).`);
  console.error('Der Build wird abgebrochen: Eine angehaengte Datenbank mit unklarem '
    + 'Schemastand ist gefaehrlicher als ein fehlgeschlagenes Deploy.');
  process.exit(1);
}

console.log('ApoPulse DB: Schema aktuell.');
