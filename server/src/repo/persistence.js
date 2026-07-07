// Snapshot-Persistenz mit Node-Built-ins (fs). Schreibt den kompletten
// Repository-Zustand als JSON auf die Platte und lädt ihn beim Start zurück —
// so überleben Daten (Beiträge, Profile, Follows, Nachrichten …) einen Neustart.
//
// Bewusst einfach und Seam-neutral: die Repos liefern __dump()/__load(), dieses
// Modul kümmert sich nur um Datei-I/O. Für Mehr-Instanz-Betrieb / EU-Hosting
// kommt später Postgres hinter denselben Seam — dann wird dieses Modul überflüssig.
//
// Aktiviert über die Umgebungsvariable APOTREND_DATA_FILE (Pfad zur JSON-Datei).
// Ohne die Variable bleibt alles reines In-Memory (z.B. in Tests).
import fs from 'node:fs';
import path from 'node:path';

export function createPersistence(filePath) {
  if (!filePath) return null;

  const dir = path.dirname(filePath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* egal */ }

  return {
    filePath,
    load() {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null; // Datei fehlt/kaputt -> Frischstart
      }
    },
    // Atomar schreiben: erst temp, dann umbenennen (kein halb geschriebener Stand).
    save(data) {
      const tmp = filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, filePath);
    },
  };
}
