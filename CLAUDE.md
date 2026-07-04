# Apotrend — Repo-weite Arbeitsanweisungen

Diese Datei gilt für das **gesamte Repo**. Für den AI-Coach-/AI-Assistant-Workstream
zusätzlich `coach/CLAUDE.md` lesen.

## Workflow-Präferenzen (vom Owner festgelegt)

- **PRs automatisch mergen.** Sobald ein von mir erstellter Pull Request grün ist
  (alle Checks/CI bestanden, keine offenen Review-Kommentare), **automatisch mergen** —
  nicht auf manuelles Mergen durch den Owner warten. Standard-Merge-Methode: **squash**.
  Ausnahme: Bei rotem CI, offenen Review-Fragen oder architektonisch bedeutsamen Änderungen
  erst zurückfragen (nicht blind mergen). Gilt bis der Owner es widerruft.

- Entwicklung/Push auf der jeweils zugewiesenen Feature-Branch; PR gegen `main`.

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
