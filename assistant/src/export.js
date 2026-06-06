// Exportiert das Briefing als eingebettete Daten für die Standalone-Decision-Surface (web/index.html).
// Schreibt web/briefing.js (window.__BRIEFING__), damit die Seite OHNE Server per Doppelklick lädt
// (kein fetch/CORS-Problem). Quelle wählbar via APOTREND_SOURCE (file|db) wie bei der CLI.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadContext } from './data.js';
import { FileSource } from './sources/fileSource.js';
import { DbSource } from './sources/dbSource.js';
import { buildRecommendations } from './engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = process.env.APOTREND_SOURCE === 'db' ? new DbSource() : new FileSource();
const data = await loadContext(source);
const recs = buildRecommendations(data, new Date(data.inventory.stand));
const payload = {
  meta: { apotheke_name: data.inventory.apotheke_name, stand: data.inventory.stand },
  recs,
};
const out = join(__dirname, '..', 'web', 'briefing.js');
writeFileSync(out, `window.__BRIEFING__ = ${JSON.stringify(payload, null, 2)};\n`);
console.log(`✓ ${out} — ${recs.length} Empfehlungen exportiert.`);
