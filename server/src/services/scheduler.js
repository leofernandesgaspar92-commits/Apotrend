// ============================================================================
//  Hintergrund-Planer
// ============================================================================
//  Ersetzt den einen 15-Minuten-Takt aus liveData.js durch benannte Aufgaben
//  mit eigenem Intervall. Vorgabe des Owners:
//    · News      alle  5 Minuten
//    · Engpässe  alle  4 Stunden
//
//  Vier Eigenschaften, die auf Render zählen:
//
//  1. NICHT BLOCKIEREND. Alle Zeitgeber sind `unref()`-t; ein hängender Abruf
//     hält weder Anfragen auf noch den Prozess-Exit.
//  2. KEINE ÜBERLAPPUNG. Läuft eine Aufgabe noch, wird der nächste Takt
//     übersprungen statt aufgestaut. Ein langsamer Behörden-Server darf keine
//     Warteschlange erzeugen, die dann alle gleichzeitig losrennt.
//  3. VERSETZTER START. Beim Hochfahren laufen nicht alle Aufgaben gleichzeitig
//     los — sonst kämpft der erste Request mit vier Netzabrufen um dieselbe
//     CPU. Render startet die Instanz bei jedem Deploy neu; das ist genau der
//     Moment, in dem die App schnell antworten muss.
//  4. NACHVOLLZIEHBAR. Jede Aufgabe führt Buch (letzter Lauf, Dauer, Ergebnis,
//     Fehler). `GET /api/live/status` liest das aus — sonst weiß niemand, ob
//     die Automatik überhaupt läuft.
// ============================================================================

export const INTERVALS = {
  news: 5 * 60 * 1000,        // 5 Minuten
  shortages: 4 * 60 * 60 * 1000, // 4 Stunden
};

/**
 * Streuung, damit mehrere Instanzen nicht im Gleichtakt auf dieselbe
 * Behörden-URL gehen. ±10 % genügt und ist deterministisch testbar.
 */
function withJitter(ms, random = Math.random) {
  const spread = ms * 0.1;
  return Math.round(ms - spread + random() * spread * 2);
}

export function createScheduler({ log = console, random = Math.random, timers = null } = {}) {
  const setT = (timers && timers.setTimeout) || setTimeout;
  const clearT = (timers && timers.clearTimeout) || clearTimeout;

  const jobs = new Map();
  let stopped = false;

  function record(job, patch) {
    Object.assign(job.status, patch);
  }

  async function runOnce(job, { manual = false } = {}) {
    if (job.running) {
      record(job, { skipped: (job.status.skipped || 0) + 1 });
      return { ok: false, skipped: true, reason: 'läuft bereits' };
    }
    job.running = true;
    const startedAt = Date.now();
    try {
      const result = await job.run();
      record(job, {
        lastRunAt: new Date(startedAt).toISOString(),
        lastDurationMs: Date.now() - startedAt,
        lastOk: true,
        lastResult: result ?? null,
        lastError: null,
        runs: (job.status.runs || 0) + 1,
        manualRuns: (job.status.manualRuns || 0) + (manual ? 1 : 0),
      });
      return { ok: true, result };
    } catch (e) {
      const message = (e && e.message) || String(e);
      record(job, {
        lastRunAt: new Date(startedAt).toISOString(),
        lastDurationMs: Date.now() - startedAt,
        lastOk: false,
        lastError: message,
        runs: (job.status.runs || 0) + 1,
        failures: (job.status.failures || 0) + 1,
      });
      // Ein fehlgeschlagener Hintergrund-Lauf darf den Server nie mitreißen.
      log.warn?.(`ApoPulse Planer: ${job.name} fehlgeschlagen — ${message}`);
      return { ok: false, error: message };
    } finally {
      job.running = false;
    }
  }

  function schedule(job) {
    if (stopped) return;
    const delay = withJitter(job.intervalMs, random);
    job.status.nextRunAt = new Date(Date.now() + delay).toISOString();
    job.timer = setT(async () => {
      await runOnce(job);
      schedule(job); // erst nach dem Lauf neu planen -> nie überlappend
    }, delay);
    if (job.timer && job.timer.unref) job.timer.unref();
  }

  return {
    /**
     * Aufgabe anmelden.
     * `startDelayMs` versetzt den ersten Lauf — siehe Punkt 3 oben.
     */
    add(name, { run, intervalMs, startDelayMs = 0 }) {
      if (jobs.has(name)) throw new Error(`Aufgabe "${name}" ist bereits angemeldet.`);
      const job = {
        name, run, intervalMs, running: false, timer: null,
        status: { name, intervalMs, runs: 0, failures: 0, skipped: 0, lastRunAt: null, lastOk: null, lastError: null, nextRunAt: null },
      };
      jobs.set(name, job);

      const first = setT(async () => {
        await runOnce(job);
        schedule(job);
      }, Math.max(0, startDelayMs));
      if (first && first.unref) first.unref();
      job.timer = first;
      return job;
    },

    /** Aufgabe sofort ausführen (Betreiber-Knopf, Tests). */
    async runNow(name) {
      const job = jobs.get(name);
      if (!job) return { ok: false, error: `Aufgabe "${name}" unbekannt` };
      return runOnce(job, { manual: true });
    },

    status() {
      return [...jobs.values()].map((j) => ({ ...j.status, running: j.running }));
    },

    stop() {
      stopped = true;
      for (const job of jobs.values()) if (job.timer) clearT(job.timer);
      jobs.clear();
    },

    get size() { return jobs.size; },
  };
}
