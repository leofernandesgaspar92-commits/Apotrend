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
