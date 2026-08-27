#!/usr/bin/env node
// ============================================================================
//  Server-Lebenszyklus für den e2e-Lauf
// ============================================================================
//  Startet den Produktions-Server, wartet bis er antwortet, führt den Check aus
//  und beendet ihn zuverlässig — auch bei Fehlschlag oder Abbruch (Ctrl-C).
//
//  Warum eigenständig: Während der Entwicklung dieser Strecke sind mehrfach
//  Server-Prozesse liegengeblieben und Ports kollidiert. Genau das soll niemand
//  von Hand verwalten müssen.
//
//  Der Schlüssel wird bewusst FRISCH erzeugt: das Modul crypto.ts verweigert in
//  Produktion den Entwicklungsschlüssel (siehe README) — der e2e-Lauf muss also
//  einen echten stellen, wie eine Umgebung auch.
//
//  Aufruf:  node tools/with-server.mjs
// ============================================================================

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'

/** Freien Port finden, statt einen festen zu belegen (keine Kollisionen). */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function waitForReady(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function main() {
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`

  const env = {
    ...process.env,
    PORT: String(port),
    APOTREND_HEALTH_KEY_V1: randomBytes(32).toString('base64'),
    APOTREND_HEALTH_KEY_CURRENT: '1',
    APOTREND_IP_SALT: randomBytes(16).toString('hex'),
  }

  console.log(`── e2e: Server startet auf Port ${port} ──`)
  // `detached: true` legt eine eigene Prozessgruppe an. Ohne das beendet
  // kill() nur den npx-Wrapper, während der eigentliche next-server-Kindprozess
  // weiterläuft und den Port belegt — genau dieser Fehler ist hier passiert.
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })

  const serverLog = []
  server.stdout.on('data', (d) => serverLog.push(String(d)))
  server.stderr.on('data', (d) => serverLog.push(String(d)))

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    // Negative PID = ganze Prozessgruppe (Wrapper UND next-server).
    try { process.kill(-server.pid, 'SIGTERM') } catch { /* schon beendet */ }
    // Nachfassen, falls ein Kind SIGTERM ignoriert.
    setTimeout(() => {
      try { process.kill(-server.pid, 'SIGKILL') } catch { /* schon weg */ }
    }, 1500).unref()
  }
  // Auch bei Abbruch oder unerwartetem Fehler aufräumen
  process.on('exit', stop)
  process.on('SIGINT', () => { stop(); process.exit(130) })
  process.on('SIGTERM', () => { stop(); process.exit(143) })

  const ready = await waitForReady(base + '/feed')
  if (!ready) {
    console.error('✗ Server wurde nicht bereit. Ausgabe:')
    console.error(serverLog.join('').slice(-2000))
    stop()
    process.exit(2)
  }

  // Beide Prüfdateien gegen DENSELBEN Server. Sie laufen nacheinander, weil
  // sie sich einen Zustand teilen (In-Memory-Speicher) und paralleles Schreiben
  // die Erwartungswerte gegenseitig verschöbe.
  const suites = ['tools/e2e-check.mjs', 'tools/e2e-social-check.mjs']
  let code = 0
  for (const suite of suites) {
    console.log(`\n── ${suite} ──`)
    const check = spawn('node', [suite, base], { stdio: 'inherit' })
    const result = await new Promise((resolve) => check.on('exit', resolve))
    if (result !== 0) code = result ?? 1
  }

  stop()
  // Auf den tatsächlichen Exit warten, nicht auf eine geschätzte Frist: ein
  // fester Kurz-Schlaf ließ den next-server bei der Messung noch laufen. Die
  // 5 s decken das SIGKILL-Nachfassen (1,5 s) mit ab.
  await Promise.race([
    new Promise((r) => server.on('exit', r)),
    new Promise((r) => setTimeout(r, 5000)),
  ])

  if (code !== 0) {
    console.error('\n── Server-Ausgabe (letzte Zeilen) ──')
    console.error(serverLog.join('').slice(-1500))
  }
  process.exit(code ?? 1)
}

main()
