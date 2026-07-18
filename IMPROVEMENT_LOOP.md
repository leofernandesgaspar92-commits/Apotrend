# ApoTrend — Selbstverbesserungs-Loop (Autopilot)

Dies ist das **dauerhafte Gedächtnis** des kontinuierlichen Verbesserungs-Loops für die
ApoTrend-App/Website. Eine Session ist flüchtig — diese Datei nicht. Jeder Loop-Durchlauf
liest sie, handelt, und schreibt das Ergebnis zurück. So läuft der Loop weiter, auch wenn
die Session neu startet.

> **Ehrliche Grenze:** Dieser Loop verbessert das, was hier tatsächlich messbar ist — den
> **Code, die UX, i18n, Barrierefreiheit, Tests, Robustheit**. Er erfindet **keine**
> Business-Zahlen (Follower/Umsatz/Reichweite), weil dafür keine Datenquellen angebunden
> sind. Sobald echte Analytics-Daten fließen, wird der GATHER-Schritt darum erweitert.

## Der Loop (6 Schritte, auf den Code adaptiert)

| Schritt | Was hier passiert | Werkzeug |
|--------|-------------------|----------|
| **GATHER** | Messbare Ist-Signale sammeln | `node server/tools/loop-audit.mjs` |
| **THINK** | Was sagen die Zahlen? Trend seit letztem Snapshot? Echt vs. Messrauschen? | Vergleich mit letztem Cycle-Log-Eintrag |
| **ANALYSE** | Größte Hebelwirkung finden: welche EINE Änderung bringt am meisten? | Backlog unten priorisieren |
| **WORK** | **Eine** präzise, verifizierte Verbesserung umsetzen | Edit → `node --test` → Browser-Check (Playwright, Hell+Dunkel, 1280+390) |
| **CHECK** | Tests grün? Screenshot belegt es? Kein Regress? | `node --test` + Screenshots |
| **REPEAT** | Cycle-Log unten fortschreiben, nächsten Durchlauf planen | diese Datei + Commit |

### Spielregeln (aus der CEO-Vorgabe)
- **Autonom**, eine Verbesserung pro Durchlauf, verifiziert und committet.
- **Nie erfundene Daten.** Rauschen im GATHER-Signal wird untersucht, nicht „behoben".
- **Zurückfragen nur** bei: Budget > 100 €, oder architektonisch bedeutsamer Richtungswechsel
  (z. B. Monolith `index.html` aufteilen, echtes DB-Backend, neues Framework).
- **Squash-Merge** grüner PRs (siehe `CLAUDE.md`).

## Letzter GATHER-Snapshot

_Cycle #5 · 2026-07-18_
```
Tests:            216/216 grün
i18n de/en/pt:    546/546/546  · 0 Lücken  ✓ perfekte Parität
Hartkod. Dialoge: 0  ·  TODO/FIXME: 0  ·  console.* (FE): 0  ·  !important (CSS): 3
index.html:       ~3700 Zeilen · 264 KB   ← größtes Struktur-Signal (Monolith)
```
Beobachtung: 5 Zyklen „Klartext-Zähler" abgeschlossen — das Zähler-Thema ist damit
weitgehend abgearbeitet. Nächste Zyklen sollten neue Signal-Bereiche adressieren
(Empty-States, a11y-Fokus, CSS-Schuld) statt weiter Zähler zu suchen.

## Priorisierter Backlog (Kandidaten für WORK)

Reihenfolge = grob nach Hebelwirkung. Der Loop nimmt sich pro Durchlauf **einen** Punkt,
prüft ihn erst (echt oder Rauschen?), setzt ihn dann um.

**P1 — echter Nutzerwert, bounded**
- [x] ~~Kommentar-Zähler: Klartext-CTA + Singular-Grammatik~~ → Cycle #2 erledigt.
- [ ] Reaktionen-Aktiv-Zustand in Kommentar-Detailansicht (Feed + Kommentare bereits getestet — vermutlich schon ok, kurz gegenprüfen).
- [ ] Leere Zustände (empty states) je Reiter auf Klartext/Handlungsaufforderung prüfen.
- [x] ~~„0 Apotheker haben dazu gepostet"-Zähler auf Engpass-Karten~~ → Cycle #3 erledigt.
- [x] ~~„{n} Beiträge dazu" (pg_posts) Singular~~ → Cycle #4 (generischer `nlabel`-Helper).
- [x] ~~Profil-Kopf-Zähler (pf_posts/pf_best/pf_followers) Singular~~ → Cycle #5.
- [ ] Empty-States je Reiter: Klartext + klare Handlungsaufforderung (neuer Bereich).
- [ ] Preise/Rabatte: Tastatur-Bedienbarkeit der Sortier-/Filter-Chips prüfen (Fokusreihenfolge).

**P2 — Robustheit / Qualität**
- [ ] `!important` (3×) prüfen: lassen sie sich sauber ohne auflösen? (CSS-Schuld abbauen)
- [ ] Weitere Mobil-Audits bei neuen Views (Audit-Skript um Playwright-Overflow-Check erweitern).
- [ ] Fehlermeldungen des Backends sind Deutsch — für echte Mehrsprachigkeit i18n-Fehlercodes.

**P3 — architektonisch bedeutsam → ERST CEO fragen**
- [ ] `index.html` (3684 Zeilen) modularisieren — großer Umbau, Risiko, Freigabe nötig.
- [ ] Echtes relationales DB-Backend (`node:sqlite`) hinter dem `__dump/__load`-Seam.
- [ ] Länder-Währung: braucht Datenstrategie (AT-Referenzdaten vs. echte Länderpreise).

**Erledigt (Auszug letzte 24 h)** — Kontotyp-Modell (Anzeige + Rechte-Durchsetzung),
Reaktions-/Folgen-Status, volle i18n DE/EN/PT (inkl. aria/title/Dialoge/Pre-Login),
a11y-Formular-Labels, Mobil-Robustheit, Backend-Persistenz gehärtet. Details: `server/README.md`.

## Cycle-Log

### Cycle #5 — 2026-07-18 — Profil-Kopf-Zähler Singular
- **WORK:** pf_posts/pf_followers/pf_best via nlabel + _one-Varianten (DE/EN/PT). „1 Beitrag"
  statt „1 Beiträge", „1 follower" statt „1 followers".
- **CHECK:** Profil mit 1 Beitrag/1 Follower → „1 Beitrag  1 Follower"; 216 grün; Parität 546.
- **REPEAT:** Zähler-Thema abgeschlossen → nächste Zyklen: Empty-States / a11y / CSS-Schuld.

### Cycle #4 — 2026-07-18 — Generischer nlabel-Helper + „Beiträge dazu"-Singular
- **GATHER:** 216/216 grün, i18n 542/542/542.
- **ANALYSE:** Wiederkehrendes Muster (Singular/Plural-Zähler) → statt Einzellösung ein
  generischer Helper `nlabel(n, oneKey, manyKey)`, der künftige Zähler absichert.
- **WORK:** „{n} Beiträge dazu" (pg_posts) bei n=1 korrigiert; beide Nutzungsstellen auf nlabel.
- **CHECK:** DE/EN/PT „1 Beitrag / 2 Beiträge" usw.; 216 grün; Parität 543.
- **REPEAT:** Profil-Kopf-Zähler als nächster nlabel-Kandidat notiert.

### Cycle #3 — 2026-07-18 — Engpass-Diskussions-Zähler: Klartext + Singular
- **GATHER:** 216/216 grün, i18n 540/540/540, Sauber-Signale bei 0.
- **THINK/ANALYSE:** Gleiche Zähler-Klasse wie Cycle #2, diesmal Engpass-Karten:
  „💬 {n} Apotheker haben dazu gepostet" — 0 flach, 1 falsch („haben"), zudem ungenau
  (gezählt werden Beiträge, nicht Personen).
- **WORK:** `shortagePostsLabel(n)` — 0 → „Noch keine Beiträge", 1 → „1 Beitrag dazu",
  ≥2 → Plural. sc_posted → sc_posts_zero/one/many (DE/EN/PT), semantisch als Beiträge.
- **CHECK:** Browser 0 → „Noch keine Beiträge", 1 → „1 Beitrag dazu"; 216 Tests grün; Parität 542.
- **REPEAT:** Backlog abgehakt; Folge-Punkt (Profil-„X Beiträge") ergänzt.

### Cycle #2 — 2026-07-18 — Kommentar-Button: Klartext-CTA + Singular
- **GATHER:** 216/216 grün, i18n 538/538/538, alle Sauber-Signale bei 0.
- **THINK/ANALYSE:** Kein akuter Defekt. Größter kleiner Nutzerhebel: der Kommentar-Button
  zeigte immer „{n} Kommentare" → bei 1 grammatisch falsch, bei 0 flache Deko-Null.
- **WORK:** `commentLabel(n)` — 0 → „💬 Kommentieren" (Engagement-CTA), 1 → Singular, ≥2 → Plural.
  Zwei neue Schlüssel je Sprache; Feed-Button + Post-Detail nutzen den Helper.
- **CHECK:** Browser DE/EN/PT alle drei Zustände korrekt; 216 Tests grün; kein Regress.
- **REPEAT:** Backlog-Punkt abgehakt; Snapshot auf 540/540/540 aktualisiert.

### Cycle #1 — 2026-07-17 — Loop-Fundament + GATHER-Instrument
- **GATHER:** Audit-Skript `server/tools/loop-audit.mjs` gebaut (Tests, i18n-Parität,
  Dialog-/TODO-/console-/!important-Zähler, index.html-Größe — alles echt, Node-Built-ins).
- **THINK/ANALYSE:** Erstes Signal meldete i18n-„Drift" (de≠en≠pt). Untersuchung ergab:
  **Messrauschen** — der Regex zählte Wörter in String-Werten als Schlüssel; an Apostrophen
  in Werten zerbrach das String-Stripping. **Kein echter Defekt.**
- **WORK:** Statt Phantom-Übersetzungen zu „fixen", das **Instrument** gehärtet: I18N-Objekt
  wird jetzt mit dem JS-Parser ausgewertet (100 % exakt) statt per Regex geraten.
- **CHECK:** Ergebnis vertrauenswürdig — **de/en/pt = 538/538/538, 0 Lücken**. 216 Tests grün.
- **REPEAT:** Backlog oben angelegt. Nächster Durchlauf nimmt einen P1-Punkt.
- **Lektion:** Bevor man auf ein Signal handelt, prüfen ob es echt ist. Ein Loop auf
  falschen Daten verstärkt Fehler — genau das soll dieser Loop nicht tun.
