// Snapshot-Persistenz mit Node-Built-ins (fs). Schreibt den kompletten
// Repository-Zustand als JSON auf die Platte und lädt ihn beim Start zurück —
// so überleben Daten (Beiträge, Profile, Follows, Nachrichten …) einen Neustart.
//
// Bewusst einfach und Seam-neutral: die Repos liefern __dump()/__load(), dieses
// Modul kümmert sich nur um Datei-I/O. Für Mehr-Instanz-Betrieb / EU-Hosting
// kommt später Postgres hinter denselben Seam — dann wird dieses Modul überflüssig.
//
// Aktiviert über die Umgebungsvariable APOPULSE_DATA_FILE (Pfad zur JSON-Datei).
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
    // Atomar + dauerhaft schreiben: temp-Datei schreiben, per fsync auf die Platte
    // zwingen, dann umbenennen (kein halb geschriebener Stand), dann das Verzeichnis
    // fsyncen (damit der Rename einen Absturz überlebt). Ohne fsync könnte ein Crash
    // direkt nach dem Schreiben trotz „erfolgreichem" write den letzten Stand verlieren.
    save(data) {
      const tmp = filePath + '.tmp';
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeFileSync(fd, JSON.stringify(data));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, filePath);
      // Verzeichnis-Eintrag des Renames dauerhaft machen (best effort; auf manchen
      // Plattformen/Dateisystemen nicht unterstützt — dann einfach überspringen).
      try {
        const dfd = fs.openSync(dir, 'r');
        try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
      } catch { /* Verzeichnis-fsync nicht verfügbar -> ok */ }
    },
  };
}
