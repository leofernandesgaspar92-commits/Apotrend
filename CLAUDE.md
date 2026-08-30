# ApoPulse — Repo-weite Arbeitsanweisungen

Diese Datei gilt für das **gesamte Repo**. Für den AI-Coach-/AI-Assistant-Workstream
zusätzlich `coach/CLAUDE.md` lesen.

## Workflow-Präferenzen (vom Owner festgelegt)

- **PRs automatisch mergen.** Sobald ein von mir erstellter Pull Request grün ist
  (alle Checks/CI bestanden, keine offenen Review-Kommentare), **automatisch mergen** —
  nicht auf manuelles Mergen durch den Owner warten. Standard-Merge-Methode: **squash**.
  Ausnahme: Bei rotem CI, offenen Review-Fragen oder architektonisch bedeutsamen Änderungen
  erst zurückfragen (nicht blind mergen). Gilt bis der Owner es widerruft.

- Entwicklung/Push auf der jeweils zugewiesenen Feature-Branch; PR gegen `main`.

- **⚠️ Live-Deploy läuft über Branch `feed-first`** (siehe `render.yaml`: `branch: feed-first`).
  Render deployt NUR diesen Branch — Änderungen auf einer Feature-Branch sind NICHT live,
  solange sie nicht auch auf `feed-first` liegen. **Regel: Jede fertige, mit `npm run verify`
  grüne Änderung MUSS zusätzlich auf `feed-first` landen** (i. d. R. sauberer Fast-Forward:
  `git push origin HEAD:feed-first`), sonst sieht der Owner nichts. Nach dem Push ggf. in
  Render „Manual Deploy → Deploy latest commit", falls Auto-Deploy nicht greift.
  Diese Regel existiert, weil genau diese Diskrepanz (Feature-Branch ≠ Deploy-Branch) einmal
  dazu führte, dass ~20 fertige Features nie live gingen. Nie wieder.

## Zielgruppe & UX-Prinzipien (vom Owner festgelegt)

Die Plattform nutzen **Apotheker:innen, Ärzt:innen, Einkauf, Großhandel und Logistiker** —
überwiegend **nicht-technische, zeitknappe** Fachleute. Deshalb gilt **extreme
Benutzerfreundlichkeit vor Optik/Dichte**:

- **Gut lesbar** vor maximaler Dichte: keine Winzig-Schrift, hoher Kontrast.
- **Offensichtliche Bedienung**: Buttons/Klick-Elemente müssen als solche erkennbar sein
  (klare Beschriftung, sichtbare Affordanz), keine versteckten Gesten.
- **Klartext statt Kürzel** (z. B. „30 Tage" statt „30T"), Fachjargon vermeiden/erklären.
- **Große, eindeutige Primär-Aktionen**; konsistente Farb-Semantik (rot = kritischer Engpass).
- **Weniger Scrollen / auf einen Screen** bleibt Ziel — hilft allen.
- Sicherheitsrelevante Aussagen (Engpass/Rückruf/Substitution) nur mit Quelle.
