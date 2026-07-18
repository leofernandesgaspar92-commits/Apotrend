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
| **GATHER** | Messbare Ist-Signale (statisch) | `npm run audit` (in `server/`) |
| **GATHER+** | Mobil-Querscroll + JS-Fehler (Browser) | `npm run audit:browser` (Server muss laufen) |
| **SMOKE** | Frontend-Happy-Path + Sprachwechsel | `npm run smoke` (Server muss laufen) |
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

_Cycle #26 · 2026-07-18_
```
Tests:            219/219 grün  ·  Browser-Audit: 0 Querscroll / 0 JS-Fehler  ·  Smoke: 7/7 grün
i18n de/en/pt:    590/590/590  · 0 Lücken  ✓ perfekte Parität
Hartkod. Dialoge: 0  ·  Hartkod. UI-DE: 0  ·  TODO/FIXME: 0  ·  console: 0  ·  !important: 3 (legitim)
Backend-Fehler:   alltags-relevante Fehler mehrsprachig (Codes), Fallback = DE-message
index.html:       ~3720 Zeilen · 267 KB   ← größtes Struktur-Signal (Monolith)
```
Fortschritt: 26 Zyklen. Frontend-i18n lückenlos + dreifach bewacht; Backend-Fehler-i18n
für alle Alltagsfälle; Kontotyp-Rechte doppelt getestet. Offene P3: Monolith, DB, Währung
(je architektonisch bedeutsam → CEO-Freigabe).

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
- [x] ~~Empty-States i18n (Feed)~~ → Cycle #6. ~~GATHER-Wächter dafür~~ → Cycle #7.
- [x] ~~News-Formular i18n~~ → Cycle #8.
- [x] ~~Verifizierungs-Karte i18n~~ → Cycle #9.
- [x] ~~Schriftgröße-Button-Title~~ → Cycle #10.
- [x] ~~GATHER-Wächter für label/placeholder erweitern~~ → Cycle #11. ~~errorState i18n~~ → Cycle #12.
- [ ] Meta-Description (`<meta name=description>`) ist DE — optional lokalisieren (SEO, niedrige Prio).
- [ ] a11y: Tastatur-Fokusreihenfolge der Sortier-/Filter-Chips (Preise/Rabatte/Engpässe).

**P2 — Robustheit / Qualität**
- [x] ~~`!important` (3×) prüfen~~ → Cycle #12: alle legitim (Inline-Override + Druck), kein Handlungsbedarf.
- [ ] Weitere Mobil-Audits bei neuen Views (Audit-Skript um Playwright-Overflow-Check erweitern).
- [x] Backend-Fehler i18n via Codes → **Fundament (#22) + alltags-relevante Fehler migriert (#23–26)**; seltene Edge-Cases (Dropdown-verhindert) bleiben DE-Fallback.

**P3 — architektonisch bedeutsam → ERST CEO fragen**
- [ ] `index.html` (3684 Zeilen) modularisieren — großer Umbau, Risiko, Freigabe nötig.
- [ ] Echtes relationales DB-Backend (`node:sqlite`) hinter dem `__dump/__load`-Seam.
- [ ] Länder-Währung: braucht Datenstrategie (AT-Referenzdaten vs. echte Länderpreise).
- [ ] Zentrale `fmtMoney(v)`-Hilfe (locale-korrektes Dezimaltrennzeichen via `_bcp47`) über ~17 €-Stellen — sicherheitsnah (Preise), daher Freigabe/sorgfältige Verifikation nötig.

**Erledigt (Auszug letzte 24 h)** — Kontotyp-Modell (Anzeige + Rechte-Durchsetzung),
Reaktions-/Folgen-Status, volle i18n DE/EN/PT (inkl. aria/title/Dialoge/Pre-Login),
a11y-Formular-Labels, Mobil-Robustheit, Backend-Persistenz gehärtet. Details: `server/README.md`.

## Cycle-Log

### Cycle #50 — 2026-07-18 — Test für gzip/ETag/304 (schützt den Perf-Gewinn)
- **WORK:** HTTP-Integrationstest (roh via `node:http`, da fetch gzip transparent auspackt): Accept-Encoding: gzip → `content-encoding: gzip`, ETag+no-cache gesetzt, ohne Accept-Encoding unkomprimiert, `If-None-Match` → 304.
- **CHECK:** 219 → 220 grün.

### Cycle #49 — 2026-07-18 — Performance: gzip + ETag/304 für statische Assets
- **THINK:** app.js (~276 KB) ging unkomprimiert & ohne Cache-Header raus — spürbar auf langsamen Apotheken-Leitungen (Zielgruppe: zeitknapp, mobil).
- **WORK:** Statik-Handler mit `node:zlib`-gzip für Textassets (nur wenn Client es kann) + ETag (Größe+mtime) → `If-None-Match` liefert 304; `Cache-Control: no-cache` (immer revalidieren, nie veraltet). Nur Built-ins.
- **CHECK:** app.js **276 KB → 73 KB** (−73 %); 304 real bestätigt; App bootet mit gzip, 0 JS-Fehler; `npm run verify` grün (219, Smoke 11/11, Browser-Audit).

### Cycle #48 — 2026-07-18 — Ein-Kommando-CHECK: `npm run verify`
- **THINK:** Der Loop-CHECK lief bisher als 3–4 Einzel-Kommandos — fehleranfällig, leicht was zu vergessen.
- **WORK:** `npm run verify` kettet Tests → Smoke → Browser-Audit → Static-Audit-Snapshot (gatend, wo sinnvoll). Ende-zu-Ende-Deutsch-Leck-Scan (EN+PT, 8 Reiter) einmalig gefahren: 0 Lecks.
- **CHECK:** `verify` grün: 219 Tests, Smoke 11/11, Browser-Audit sauber, Parität 642/642/642, alle 4 Static-Wächter 0.

### Cycle #47 — 2026-07-18 — Wächter gegen hartkodiertes Deutsch in JS-DOM-Zuweisungen
- **THINK:** Die #46-Strings fing kein Wächter (kein Markup, kein t()). „Instrument schärfen".
- **WORK:** Neuer Static-Audit-Detektor `hardcoded_js_de`: `.textContent/.title/.placeholder = '…ä…'` + `setAttribute('aria-label'|'title'|'placeholder'|'alt', '…ä…')` in app.js. Regex gegengeprüft.
- **CHECK:** 0 ✓ (bestätigt #46 vollständig); 219 grün.

### Cycle #46 — 2026-07-18 — 2 hartkodierte deutsche JS-Strings i18n'd (News-Validierung, Folgen-Status)
- **THINK:** Sweep über JS-DOM-Zuweisungen (`.textContent=`) fand 2 user-sichtbare deutsche Literale, die kein Wächter fängt: News-Leervalidierung + „✓ Folgst"-Button.
- **WORK:** Keys `news_empty`/`sg_followed` (DE/EN/PT); lokale `t`-Variable in News-Handler zu `ta` umbenannt (globales `t()` war verdeckt).
- **CHECK:** EN real „Text or image required."; Parität 642/642/642; 219 grün, Smoke 11/11.

### Cycle #45 — 2026-07-18 — Sparkline-Vorlese-Text (aria) mehrsprachig
- **THINK:** Die Preis-Sparkline hatte ein hart deutsches `aria-label` („Preisverlauf steigend/fallend … Euro") — EN/PT-Screenreader hörten Deutsch. Kein Wächter fängt JS-String-Zuweisungen.
- **WORK:** 5 Keys (spark_label/rising/falling/stable/eur) in DE/EN/PT; `sparkline()` nutzt `ti()`/`t()`.
- **CHECK:** EN real „Price trend falling: 3.10 euros, …"; Parität 640/640/640; 219 grün, Smoke 11/11.

### Cycle #44 — 2026-07-18 — Monolith entflochten: CSS + JS extern (P3, freigegeben) [3/3]
- **THINK:** Die Single-File-SPA (~3860 Z) war schwer navigierbar. Ohne Build-Step: klassische externe Dateien (Globals bleiben, keine ES-Modul-Umverdrahtung, semantisch identisch).
- **WORK:** `<style>`→`public/app.css` (132 Z), Haupt-`<script>`→`public/app.js` (3693 Z); `index.html` ist jetzt **37 Z** reines Markup + `<link>` + `<script src>`. Loop-Audit auf die 3 Quellen umgestellt (i18n/Dialoge/UI-DE/light-bg/console/!important lesen jetzt app.js/app.css/frontend).
- **CHECK:** App bootet & funktioniert aus app.js (Übersicht, Preise „€ 1,34"), 0 JS-Fehler; 219 grün, Smoke 11/11, Browser-Audit grün, Parität 635/635/635.

### Cycle #43 — 2026-07-18 — Zentrale Geld-Formatierung (P3, freigegeben) [2/3]
- **THINK:** Bildschirm-Preise zeigten überall Punkt-Dezimal (€ 1.34) — für den DACH-Hauptmarkt ist Komma korrekt. Preisnah → sorgfältig.
- **WORK:** Helfer `fmtMoney(v)` (de/pt: Komma, en: Punkt, 2 Nachkomma, kein Tausender-Trenner); ~17 €-Anzeigestellen darauf umgestellt; `csvNum` dedupliziert (delegiert an fmtMoney). €-Symbol bleibt Präfix.
- **CHECK:** Real: AT/PT „€ 1,34", GB „€ 1.34", 0 JS-Fehler; CSV weiterhin korrekt; Parität 635/635/635; 219 grün, Smoke 11/11.

### Cycle #42 — 2026-07-18 — CSV-Export mehrsprachig (P3, CEO-freigegeben) [1/3]
- **THINK:** Einkauf/Großhandel exportieren CSV — die 3 Exporte waren fest deutsch (Köpfe + ja/nein + Zahlenformat). Wand für EN/PT-Profis.
- **WORK:** Format folgt der Sprache als kohärente Einheit: de/pt = Semikolon+Komma-Dezimal (Europa-Excel), en = Komma+Punkt. 31 `csv_*`-Keys (DE/EN/PT), Helfer `csvSep/csvNum/csvYesNo`, Trennzeichen-abhängiges Cell-Escaping. Alle 3 Exporte (Preise/Rabatte/Engpässe) umgestellt.
- **CHECK:** Echte Blobs erfasst — AT `Präparat;3,01;ja` / GB `Product,3.01,yes` / PT `Produto;3,01;sim`; Parität 635/635/635; 219 grün, Smoke 11/11.

### Cycle #41 — 2026-07-18 — Backend-Längen-Fehler mehrsprachig (Beitrag/Kommentar/Bio)
- **THINK:** Textfelder haben KEIN client-seitiges maxlength → >1000 Zeichen erreichbar → Server warf deutsches `new Error` (untranslatiert für EN/PT). Lücke aus der #22–26-Klasse.
- **WORK:** 3 Fehler auf `AppError`+Code migriert (post_too_long/comment_too_long/bio_too_long), `e_<code>`-Keys in DE/EN/PT; HTTP-Test um post_too_long-Assertion erweitert.
- **CHECK:** Server liefert `code: post_too_long` real; EN→„Post too long (max. 1000 characters)."; Parität 604/604/604; 219 grün.

### Cycle #40 — 2026-07-18 — Browser-Audit prüft jetzt auch A11y (Wächter gegen #39-Klasse)
- **THINK:** Die a11y-Lücken aus #39 fing kein Wächter — „Instrument schärfen".
- **WORK:** `loop-browser-audit.mjs` prüft pro Reiter (einmal, themenunabhängig) Formularelemente ohne zugänglichen Namen + Bilder ohne `alt`.
- **CHECK:** Audit grün — „Kein Querscroll, keine JS-Fehler, keine a11y-Lücken auf 8 Reitern".

### Cycle #39 — 2026-07-18 — A11y: alle Formular-Selects & Bildvorschauen mit zugänglichem Namen
- **CHECK:** Eigener a11y-Audit (Playwright) über 8 Reiter fand: Buttons/Links durchweg benannt ✓, aber Selects (`pv`, `ex_kind`, `ex_bl`, `ex_blf`, Status) ohne Namen + Bildvorschauen ohne `alt`. (Wickel-`<label>` waren False Positives — Logik korrigiert.)
- **WORK:** `applyI18n` um `data-i18n-alt` erweitert; 3 neue Schlüssel (a11y_img_preview, co_vis_aria, ex_kind_aria); alle Selects mit `data-i18n-aria` (Reuse vorhandener Keys wo möglich), 4 Bildvorschauen mit `data-i18n-alt`, Datums-Feld zusätzlich mit aria-label.
- **CHECK:** a11y-Audit jetzt 0 Lücken auf 8 Reitern; EN real „Post visibility"/„Image preview"; Parität 601/601/601; 219 grün, Smoke 11/11.

### Cycle #38 — 2026-07-18 — Alle Kern-Screens visuell verifiziert + `<html lang>`-Wächter
- **CHECK:** Preise & Biete/Suche (bisher nur code-geprüft) real gescreenshottet (Desktop+Mobil): professionell, korrekte Farb-Semantik, gute Leerzustände, datenschutzbewusst — kein Defekt. Damit sind ALLE 8 Reiter + Onboarding + Willkommen + DM + Suche + Kontotyp-Sperren verifiziert.
- **WORK:** Smoke-Test um `<html lang>`-Prüfung erweitert (GB→„en") — schützt den #34-Fix dauerhaft.
- **CHECK:** Smoke 11/11 grün.

### Cycle #37 — 2026-07-18 — Wächter gegen helle Inline-Hintergründe (Dark-Mode-Schutz)
- **THINK:** Cycle #36 rutschte durch alle Wächter — der Browser-Audit prüft Overflow/JS-Fehler, nicht Kontrast. „Instrument schärfen" statt nur den Einzelfall fixen.
- **WORK:** Neuer Static-Audit-Detektor `hardcoded_light_bg`: helle Hex-Hintergründe (`#[def]xxxxx`) in Inline-Styles außerhalb `<style>` (wo Dark-Mode sie nicht erreicht). Regex real gegengeprüft (fängt #eef6f1/#fdece9, ignoriert dunkle).
- **CHECK:** Aktuell 0 ✓ (bestätigt #36-Fixes vollständig); 219 grün.

### Cycle #36 — 2026-07-18 — Dark-Mode-Kontrast: 3 hartkodierte helle Flächen behoben
- **CHECK:** Computed-Styles im echten Browser deckten auf: Willkommens-Tipp-Box (`#eef6f1`), ungelesene Meldungs-Zeile (`#eef6f1`) und „Rosé"-Preis-Pille (`#fdece9`) behielten im Dark-Mode helle Hintergründe → heller Text auf hellem Grund (~1,1:1, unlesbar).
- **WORK:** Auf theme-aware Variablen umgestellt (`--ok-bg/--ok-bd`, `--crit-bg/--crit-bd`). Hell unverändert, Dunkel jetzt ~10:1.
- **CHECK:** Tipp-Box dunkel `rgb(18,51,30)`/hell-Text real; 219 grün, Browser-Audit sauber (hell+dunkel), Smoke 10/10.

### Cycle #35 — 2026-07-18 — Patienteninfo-Druck: Titel folgt der Patientensprache
- **THINK:** `printPatientInfo` betitelte gedruckte Blätter hart deutsch („Antibiotika – Patienteninformation"), obwohl der Karteninhalt engl./türk. war — verwirrend für Patient:innen.
- **WORK:** Helfer `patientInfoHeading(lang)` (de/en/tr) extrahiert; in Druck-`<title>`, Druck-`<h1>` und im Zettel-Druck (vorher dupliziertes Ternär) genutzt.
- **CHECK:** EN-Druck real: `<html lang="en">`, Titel/H1 „Antibiotics – Patient information"; 219 grün.

### Cycle #34 — 2026-07-18 — `<html lang>` folgt der Sprache (a11y)
- **THINK/CHECK:** Reales Browser-Testen zeigte: returning EN-Nutzer bootet mit engl. UI, aber `<html lang="de">` — Screenreader sprechen engl./pt. Inhalte deutsch aus.
- **WORK:** Beim Laden `document.documentElement.setAttribute('lang', LOCALE)` (setLocale tat es schon bei Wechsel, nur der Erst-Boot fehlte).
- **CHECK:** en→„en", pt→„pt", de→„de" real bestätigt; 219 grün, Smoke 10/10.

### Cycle #33 — 2026-07-18 — Preis-Formatierung konsistent (erzwungenes Komma entfernt)
- **THINK:** Der Sparkline-Tooltip erzwang als EINZIGE Stelle ein deutsches Komma (`.replace('.',',')`) — inkonsistent zu den 16 anderen €-Stellen (Punkt) und falsch für en-GB.
- **WORK:** Ausreißer entfernt → app-weit einheitliches Format. Volle locale-Money-Hilfe (~17 Stellen) als P3 vermerkt (preisnah → CEO-Freigabe).
- **CHECK:** 0 erzwungene-Komma-Stellen; 219 grün.

### Cycle #32 — 2026-07-18 — Druck-Kopf der Engpassliste folgt Sprache & Datumsformat
- **THINK:** Der Druck-Header war hart deutsch („Stand: ") + Datum immer `de-AT` — englische/portugiesische Nutzer:innen druckten einen deutschen Kopf. Währung (€) bleibt bewusst unangetastet: alle Zahlen sind offengelegt österreichische Daten, eine £-Umrechnung ohne echte FX wäre irreführend.
- **WORK:** 3 i18n-Schlüssel (sh_print_asof/filter/query) + `toLocaleString(t('_bcp47'))` statt hartem `de-AT`.
- **CHECK:** EN-Druckkopf real „As of: 18/07/2026, …" (en-GB); Parität 598/598/598; 219 grün, Smoke 10/10.

### Cycle #31 — 2026-07-18 — Smoke-Test schützt das klickbare Logo (Home) dauerhaft
- **THINK:** Das klickbare Logo (grüner Punkt → Startseite) ist eine Kern-Anforderung ohne automatisierte Abdeckung — eine stille Regression wäre möglich.
- **WORK:** Smoke-Test um 2 Schritte erweitert: ausgeloggt → Logo → Länderauswahl (12); eingeloggt → anderer Reiter → Logo → Übersicht + scrollY==0.
- **CHECK:** End-to-end im Browser real bestätigt (beide Pfade), Smoke 10/10 grün.

### Cycle #30 — 2026-07-18 — E-Mail-Platzhalter folgt der Landessprache
- **CHECK:** Auth-Screenshot (GB) zeigte den Platzhalter „name@apotheke.at" — eine österreichische Domain für eine UK-Apotheke wirkt fremd/unprofessionell.
- **WORK:** Neuer i18n-Schlüssel `au_email_ph` (de: name@apotheke.at, en: name@pharmacy.com, pt: nome@farmacia.pt); beide E-Mail-Felder (Login + Registrierung) nutzen ihn.
- **CHECK:** GB→name@pharmacy.com, PT→nome@farmacia.pt real bestätigt; Parität 595/595/595; 219 grün.

### Cycle #29 — 2026-07-18 — Länderauswahl: Ländernamen brechen nicht mehr mitten im Wort (Mobil)
- **THINK/CHECK:** Echte Screenshots (390px) zeigten „Deutschla nd" / „Moçambiq ue" — `.card { overflow-wrap:anywhere }` vererbte sich in die Länder-Buttons und zerlegte Eigennamen.
- **WORK:** `.country-pick { overflow-wrap:normal; word-break:keep-all }` + einspaltiges Raster < 460px → volle, gut lesbare Tap-Ziele.
- **CHECK:** 4 Screenshots (Hell/Dunkel × Desktop/Mobil) sauber; Desktop behält 3-Spalten-Raster; 219 grün, Smoke 8/8.

### Cycle #28 — 2026-07-18 — Länder-zuerst-Flow + klickbares Logo (Home) + Render
- **WORK:** Onboarding umgestellt: erst Land wählen → Login → länderspezifische Sicht. Grüner Punkt oben links ist jetzt das klickbare ApoTrend-Logo (SVG) → Startseite. Auf Render (feed-first) deployt.
- **CHECK:** Smoke-Test prüft Länder-zuerst (12 Länder, AT→Anmelden/GB→Log in); 219 grün.

### Cycle #27 — 2026-07-18 — Länderauswahl-Kopf mehrsprachig (VOR der Sprachwahl)
- **THINK:** Der Länderauswahl-Screen steht VOR der Sprachwahl — ein brasilianischer Erstbesucher sähe sonst nur Deutsch.
- **WORK:** `csOtherLangs(key)` zeigt den Titel zusätzlich in den anderen beiden Sprachen als dezenten Untertitel.
- **CHECK:** Kopf rendert „Wähle dein Land · Choose your country · Escolha o seu país"; 219 grün, Parität 594.

### Cycle #26 — 2026-07-18 — Backend-Fehler-i18n: Batch (Anzeigename/Kommentar/Passwort/…)
- **WORK:** 9 nutzer-erreichbare Fehler migriert (6 neue Codes, post_empty wiederverwendet), DE/EN/PT.
- **CHECK:** en/pt korrekt; 219 grün (2 Tests wg. verfehltem AppError-Import + Meldungsänderung gefixt); Parität 590.
- **Ergebnis:** praktisch alle alltäglich erreichbaren Backend-Fehler sind mehrsprachig.

### Cycle #25 — 2026-07-18 — Test: Fehler-Codes am HTTP-Layer
- **WORK/CHECK:** Integrationstest prüft code-Felder (post_empty/login_failed/shortage_*) + message-Fallback. 218→219 grün.

### Cycle #24 — 2026-07-18 — Backend-Fehler-i18n: Login + Handle-vergeben
- **WORK:** login_failed (Route) + handle_taken (Repo) via e.code migriert (DE/EN/PT).
- **CHECK:** Browser en/pt korrekt; 218 grün; Parität 584. Insg. 8 Fehler migriert (#22–24).

### Cycle #23 — 2026-07-18 — Backend-Fehler-i18n: 4 häufige Validierungsfehler
- **WORK:** profile_handle_format, post_empty, shortage_wirkstoff_missing, shortage_duplicate migriert (DE/EN/PT).
- **CHECK:** Browser en/pt korrekt; 218 grün; Parität 582.

### Cycle #22 — 2026-07-18 — Backend-Fehler-i18n: Fundament + erste 2 Fehler
- **P3 (CEO-freigegeben).** AppError(code) + Server liefert `code` + api() übersetzt via `e_<code>`
  (Fallback = Server-message). Damit werden alle e.message-Stellen automatisch mehrsprachig.
- **WORK:** Mechanismus + shortage_pro_only/exchange_pro_only migriert (DE/EN/PT).
- **CHECK:** End-to-End privat→Engpass-Meldung: de/en/pt korrekt. 218 grün, Parität 578, additiv/rückwärtskompatibel.
- **REPEAT:** Weitere Fehler (Validierung: Wirkstoff fehlt, Handle-Format, …) inkrementell migrieren.

### Cycle #21 — 2026-07-18 — Browser-Werkzeuge mit Server-Auto-Start
- **ANALYSE:** Tägliche Routine = frische Session ohne Server → audit:browser/smoke liefen nicht.
- **WORK:** `_ensure-server.mjs` — nutzt laufenden Server oder startet/beendet einen selbst.
- **CHECK:** Server gestoppt → `npm run smoke` startet selbst, 7/7 grün, danach sauber beendet.

### Cycle #20 — 2026-07-18 — npm-Scripts für die Loop-Werkzeuge
- **WORK/CHECK:** `npm run audit` / `audit:browser` / `smoke` in package.json. Verifiziert: 218 grün, Smoke 7/7.

### Cycle #19 — 2026-07-18 — Smoke-Test deckt Sprachumschalter ab
- **WORK/CHECK:** Ausgeloggter Auth-Sprachwechsel DE→EN→PT im Smoke-Test (Anmelden/Log in/Entrar). 7/7 grün.

### Cycle #18 — 2026-07-18 — Frontend-Smoke-Test
- **ANALYSE:** Frontend = größte ungetestete Fläche (0 automatisierte Tests).
- **WORK:** `loop-smoke.mjs` — Happy-Path im Browser (Feed/Beitrag/Reaktion+Toggle/Kommentar/JS-Fehler).
- **CHECK:** 6/6 grün. Frontend hat jetzt echte Regressions-Abdeckung.

### Cycle #17 — 2026-07-18 — Browser-Audit: Langinhalt-Härtetest
- **GATHER+/WORK:** Pathologischer Inhalt (200-Zeichen-Token + lange URL) in den Browser-Audit
  eingebaut — deckt overflow-wrap-Regressionen ab. Verifiziert: App robust (0 Querscroll).

### Cycle #16 — 2026-07-18 — Test: is_following im Feed-Payload
- **WORK/CHECK:** Unit-Test für author.is_following (vor/nach follow, eigener Beitrag). 217→218 grün.

### Cycle #15 — 2026-07-18 — HTTP-Layer-Tests für Kontotyp-Rechte
- **ANALYSE:** Enforcement nur service-getestet → 403-Pfade am HTTP-Layer ungetestet.
- **WORK:** Integrationstest: Privat→403 (report/confirm/exchange), Fachkonto→200, Lesen ok.
- **CHECK:** 216→217 Tests grün. Sicherheitsrelevantes Verhalten jetzt zweifach abgesichert.

### Cycle #14 — 2026-07-18 — Clientseitige Bild-Fehler i18n
- **WORK:** 3 frontend-geworfene Bild-Fehler via t() (img_err_*, DE/EN/PT).
- **CHECK:** en/pt korrekt; 216 grün; Parität 576; UI-DE 0.
- **Hinweis:** Backend-Fehlermeldungen bleiben DE — echte i18n bräuchte Fehler-Codes (P3, größer).

### Cycle #13 — 2026-07-18 — Browser-GATHER (Mobil-Querscroll + JS-Fehler)
- **ANALYSE:** a11y-Foundation ist top (Enter/Space-Handler, MutationObserver) — kein Fix nötig.
  Höherer Hebel: die manuellen Mobil-Checks automatisieren.
- **WORK:** `loop-browser-audit.mjs` — 8 Reiter × 390px × hell/dunkel: Querscroll + JS-Fehler.
- **CHECK:** Aktueller Stand sauber (0 Overflow, 0 Fehler). GATHER hat jetzt einen UX-Regressionswächter.

### Cycle #12 — 2026-07-18 — errorState-Helper i18n
- **GATHER:** a11y-Bereich geprüft (focus-visible + skip-link + tabindex-Helper schon vorhanden ✓);
  3 !important alle legitim. Fund: errorState fest DE (keine Umlaute → Wächter-Lücke).
- **WORK:** errorState via t() (err_*, DE/EN/PT).
- **CHECK:** de/en/pt korrekt; 216 grün; Parität 573; UI-DE 0.

### Cycle #11 — 2026-07-18 — UI-DE-Wächter deckt label/placeholder ab
- **WORK:** hardcoded_ui_de erkennt jetzt auch `<label>`/`placeholder` mit Umlaut OHNE data-i18n.
- **CHECK:** Baseline 0; Positiv-Kontrollen bestätigen Erkennung + korrekte Fallback-Ignoranz.
- **Lektion (Fortsetzung #7):** Instrument iterativ schärfen, wenn ein Sweep etwas findet, das
  das Instrument nicht sah. Der Wächter ist jetzt umfassend.

### Cycle #10 — 2026-07-18 — Schriftgröße-Tooltip i18n + folgt Sprachwechsel
- **WORK:** applyFontScale-Titel via t() (font_*); applyFontScale bei Sprachwechsel mitaufgerufen.
- **CHECK:** Sprachumschalter live de→en→pt korrekt; 216 grün; Parität 570; UI-DE 0.

### Cycle #9 — 2026-07-18 — Verifizierungs-Karte i18n
- **WORK:** Verifizierungs-Karte (offen/abgelehnt/beantragen) via t() (vf_*, DE/EN/PT).
- **CHECK:** en „Get verified", pt „Obter verificação"; 216 grün; Parität 565; UI-DE 0.

### Cycle #8 — 2026-07-18 — News-Formular i18n (Umlaut-Sweep)
- **GATHER+:** Manueller Umlaut-Sweep außerhalb der Wörterbücher fand 3 echte hartkodierte
  DE-Bereiche (News-Formular, Schriftgröße-Title, Verifizierungs-Karte).
- **WORK:** News-Formular vollständig übersetzt (nb_*-Schlüssel, DE/EN/PT).
- **CHECK:** EN „Share news / Share as news" verifiziert; 216 grün; Parität 558; UI-DE-Wächter 0.
- **REPEAT:** Restliche 2 DE-Bereiche + Wächter-Erweiterung (label/placeholder) in Backlog.

### Cycle #7 — 2026-07-18 — GATHER-Wächter für hartkodierte UI-Texte
- **ANALYSE:** #6-Bug blieb unentdeckt → Instrument-Lücke ist selbst das wichtigste Signal.
- **WORK:** Neues Audit-Signal `hardcoded_ui_de` (UI-Property mit Mehrwort-Literal statt t(),
  Wörterbuch-Regionen I18N/ZETTEL_L ausgeblendet).
- **CHECK:** Baseline 0 (keine Fehlalarme); Positiv-Kontrolle fängt den #6-Fall. Tests unberührt (216).
- **Lektion:** Wenn ein Bug durchrutscht, ist die beste nächste Aktion oft, das Messgerät zu schärfen.

### Cycle #6 — 2026-07-18 — Hartkodierte Empty-States übersetzt
- **WORK:** 3 Feed-Empty-States (home/questions/new) waren fest Deutsch → t() (fe_*-Schlüssel, DE/EN/PT + CTAs).
- **CHECK:** Schlüssel lösen de/en/pt korrekt auf; 216 grün; Parität 554.
- **Wichtig:** GATHER hat das NICHT erkannt (prüft nur Dialoge/Attribute) → Instrument-Lücke, Cycle #7.

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
