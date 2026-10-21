# ApoPulse — Selbstverbesserungs-Loop (Autopilot)

Dies ist das **dauerhafte Gedächtnis** des kontinuierlichen Verbesserungs-Loops für die
ApoPulse-App/Website. Eine Session ist flüchtig — diese Datei nicht. Jeder Loop-Durchlauf
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

_Aktualisiert 2026-08-28_
```
Tests:            485/485 grün (63 Dateien)  ·  Browser-Audit: 0 Querscroll / 0 JS-Fehler / 0 a11y  ·  Smoke: 19/19 grün
i18n de/en/pt:    1375/1375/1375 — 0 Lücken ✓ (Guard prüft bei jedem `verify`)
Hartkod. Dialoge: 0  ·  Hartkod. UI-DE: 0  ·  Hartkod. JS-DE: 0  ·  Helle Inline-BGs: 0  ·  !important: 3 (legitim)
Checkout-Demo:    54/54 Browser-Prüfungen (Länder-Compliance, Zahlwege, QR)
QR-Encoder:       64/64 Matrizen zellgenau identisch zu python-qrcode + segno
Monolith:         server/public/app.js ~7910 Zeilen  ← größtes Struktur-Signal (P3, CEO-Freigabe)
```
Seit dem letzten Snapshot dazugekommen: **Länder-Compliance-Engine** (`domain/compliance.js`,
16 Länderprofile, Handels-Modus SAAS_ONLY vs. MARKETPLACE_FEES, Gebührenmodell, Pflichtfelder
je Land, Krypto-Gebot dreifach abgesichert), **Mehrwährungs-Abo-Katalog** (`data/plans.js`),
**Krypto-Empfangswege aus den echten Wallets** (`paymentRoutes()`, inkl. beider Solana-Wallets),
**eigener QR-Encoder** mit Nachweis gegen zwei unabhängige Referenzen, **Checkout-Demo**
(live unter `/checkout-demo.html`), und **Premium-Preis in der Landeswährung** (siehe unten).

Offene P3 unverändert: Monolith (app.js), echtes DB-Backend. Der einzige große offene
NUTZEN-Hebel bleibt: **Live-Engpassdaten** (sicherheitsrelevant → mit Owner klären).

## Priorisierter Backlog (Kandidaten für WORK)

Reihenfolge = grob nach Hebelwirkung. Der Loop nimmt sich pro Durchlauf **einen** Punkt,
prüft ihn erst (echt oder Rauschen?), setzt ihn dann um.

**P1 — echter Nutzerwert, bounded**
- [x] ~~Kommentar-Zähler: Klartext-CTA + Singular-Grammatik~~ → Cycle #2 erledigt.
- [ ] Reaktionen-Aktiv-Zustand in Kommentar-Detailansicht (Feed + Kommentare bereits getestet — vermutlich schon ok, kurz gegenprüfen).
- [x] ~~Leere Zustände (empty states) je Reiter auf Klartext/Handlungsaufforderung prüfen~~ → Session 2026-08-18: filterbare Daten-Reiter (Engpässe/Preise/Rabatte/Biete-Suche) mit sichtbarem „Filter zurücksetzen" (`filteredEmptyCard`).
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

### Session 2026-08-18 — 2. Hälfte (Fortschreibung, mit Commit belegt)
> Nach der ersten Hälfte (unten) folgte eine gezielte Richtung, vom Owner delegiert
> („entscheide du"): **Beschaffungs-/ROI-Nutzen vertiefen** — plus Navigations- und
> i18n-Härtung. Alle Änderungen: `npm run verify` grün, Playwright-Check + Temp-Werkzeug
> gelöscht, Push auf `claude/next-steps-w6tymp` UND `feed-first`.
>
> **ROI/Beschaffung (für die zahlende Einkaufs-Zielgruppe):**
> - `90c8793` druckbarer **Beschaffungs-Report** (KPIs, je Lieferant, Top-Präparate).
> - `a50a90e` **Zeitraum-Auswahl** (Alle/Jahr/90/30 Tage) skaliert Statistik + Report.
> - `c84df36` **Ersparnis-Verlauf pro Monat** (Bildschirm-Balken) · `7907918` derselbe
>   auch im Druck-Report · `5b84672` **Ersparnis je Lieferant** im Report.
> - `36c73cc` realisierte **Beschaffungs-Ersparnis auf „Für dich"** (Report entdeckbar,
>   Backend `overview.procurement`, +1 Test → 434).
>
> **Navigation/a11y:** `cdc62b3` Suche, `2223104` Beitrag, `7a1fab7` Hashtag/Profil +
> DRY-Helfer `startDetailView` — alle Detailseiten starten oben + fokussieren die
> Überschrift (SPA-a11y, Ring nur bei Tastatur via `:focus-visible`).
>
> **i18n-Härtung (Instrument geschärft, #7/#11-Disziplin):** `265a490`/`5f84c35`
> Quell-**Domain** überall bei Beiträgen/Engpass-Quellen + hartkodiertes „Quelle"
> lokalisiert · `f19876c` Patienteninfo-Druck-Quelle in Patientensprache · `a3723ab`
> **Audit-Wächter (c)**: fängt jetzt hartkodiertes Deutsch als HTML-Textinhalt (`>Wort`)
> — genau die Klasse, die zwei Hand-Sweeps fanden. Positiv-/Negativ-Kontrolle grün.
>
> **Konsistenz-Fixes:** `9585677` Engpass-Verlauf gleiche Reihenfolge · `9697a81`
> Aufgaben nach Dringlichkeit · `00821d6` Termine „nächster zuerst" · `ba970e4`
> Verzeichnis-Reset · `43d078e` Engpass-Quelle auf Detailseite · `3fc68ee` offene
> Fragen ohne Antwort hervorgehoben.
>
> **Stand danach:** Jeder Funktionsbereich durchgesehen und ausgereift. Verbleibender
> großer Hebel = **Live-Engpassdaten** (sicherheitsrelevant → mit Owner, nicht im
> Autopilot). Weitere Zyklen sind Feinschliff.

### Session 2026-08-18 — Nachtrag (Log war hinter der Realität zurück)
> **Ehrlichkeits-Hinweis:** Zwischen #147 und dieser Session liefen Zyklen, die NICHT
> hier protokolliert wurden (u. a. Design-Auffrischung, Monetarisierungs-Vertiefung,
> Barrierefreiheit große Schrift — sichtbar in der Git-Historie, z. B. `2edfc28`,
> `9f7c318`, `cbab1e6`, `c50e5f9`, `287ea45`). Deren genaue Zyklus-Nummern sind nicht
> mehr rekonstruierbar, daher hier bewusst KEINE erfundene Nummerierung. Nachfolgend die
> mit Commit belegten Verbesserungen dieser Session (jeweils `npm run verify` grün,
> Playwright-Check gemacht + Temp-Werkzeug gelöscht, Push auf `claude/next-steps-w6tymp`
> UND `feed-first`):
>
> - `0a78113` **Engpass-Wochenrückblick** — kompakte „was änderte sich bei meinen
>   beobachteten Wirkstoffen (7 Tage)"-Karte auf „Für dich"; abgeleitet aus dem
>   vorhandenen Statusverlauf (`weeklyChange` in shortages.js, `week_review` in overview.js),
>   druckbar. Tests + Overview/Watchlist-Integration.
> - `b06d7ce` **Statusverlauf auf der Wirkstoff-Seite** — „seit {Datum}" + aufklappbarer
>   Verlauf ab 2 Schritten; nebenbei Kopf-Button-Überlauf (390px) behoben; Audit prüft jetzt
>   die Wirkstoff-Detailseite dauerhaft mit.
> - `7916736` / `0deeae3` / `7133168` **Leerzustände mit „Filter zurücksetzen"** —
>   sichtbarer Reset-Knopf in Engpässe, Preise, Rabatte und Biete/Suche (statt nur Text);
>   gemeinsamer Helfer `filteredEmptyCard`; Biete/Suche trennt „gefiltert leer" ehrlich von
>   „Netzwerk leer".
> - `57c67b0` **Reiterwechsel startet oben** — `loadTab()` scrollt nach oben (nur Navigation,
>   nicht In-Place-Aktualisierungen).
> - `8d300cb` **Wirkstoff-Detailseite: oben + Fokus auf Überschrift** (SPA-a11y; nutzt
>   `:focus-visible`, kein Maus-Ring).
> - `a6133a9` **Engpass-CSV: Spalte „Tage gemeldet"** — Dauer fertig berechnet für die
>   Excel-Auswertung.
> - `d3777a9` **Engpass-Karte: Quelle direkt anklickbar** — „🔗 Quelle" für den aktuellen
>   Status bei URL-Quelle (Owner-Prinzip Sourcing), nicht bei Community/Referenz.
>
> Erledigte Backlog-Punkte dadurch: „Leere Zustände je Reiter" (P1) — für die filterbaren
> Daten-Reiter umgesetzt.

### Cycle #147 — 2026-07-20 — Tastatur-Kürzel „/" fokussiert die Suche
- **THINK:** Kleiner Alltags-Komfort für tägliche Nutzer:innen (Standard-Pattern à la GitHub): „/" springt zur Suche. Unsichtbar/unschädlich für alle anderen; greift nie, während man tippt.
- **WORK:** Globaler `keydown`-Listener: „/" (ohne Ctrl/Meta/Alt) fokussiert `#sq` und markiert den Text — außer der Fokus liegt bereits in `input`/`textarea`/`select`/contenteditable (dann normales Zeichen).
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser:** „/" außerhalb eines Feldes fokussiert die Suche (ohne „/" einzufügen); „/" innerhalb des Feldes wird normal getippt; 0 JS-Fehler.

### Cycle #146 — 2026-07-20 — Bestandsaustausch: Beruhigung bei „noch kein Treffer" (Erwartungs-Management)
- **THINK:** Gegenstück zu #116: Bei einem Treffer gibt es den Erfolgs-Banner, aber bei KEINEM Treffer passierte sichtbar nichts — Nutzer:in unsicher, ob es geklappt hat. Ein Hinweis „veröffentlicht, noch kein Treffer — du wirst benachrichtigt" beruhigt und hebt das Frühwarnnetz hervor.
- **WORK:** Anlege-Handler setzt bei `match_count === 0` ebenfalls einen Flash (`count: 0`). Rendering zeigt dann einen Info-Banner „📣 Angebot/Gesuch veröffentlicht. Noch kein passendes … — du wirst benachrichtigt, sobald jemand …". i18n `ex_flash_none_biete/_suche` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 808/808/808, Guards 0. **Browser:** Suche nach seltenem Wirkstoff (kein Biete) → Info-Banner erscheint, 0 JS-Fehler.

### Cycle #145 — 2026-07-20 — Code-Qualität: Druck-Reports auf gemeinsame Helfer (DRY)
- **THINK:** Über die Zyklen sind 5 window.open-Druck-Reports (Merkliste, Preise, Rabatte, Wirkstoff-Dossier, Patienteninfo) entstanden, die Fenster-Guard, Datum-/Geld-Formatierung und das HTML-Gerüst duplizierten. Konsolidieren senkt künftige Fehlerfläche — ohne Verhalten zu ändern.
- **WORK:** Helfer extrahiert: `openPrintDoc(title, css, body, lang=LOCALE)` (Popup-Guard + `<head>`/`<body>` + Auto-Print), `printDate()`, `printMoney(v)`. Alle 5 Reports darauf umgestellt; jede CSS bleibt **byte-identisch** (keine visuelle Änderung), Patienteninfo behält ihre eigene Sprache via `lang`-Parameter.
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser (Regressionstest aller Reports):** Merkliste/Preise/Rabatte/Dossier erzeugen valide Dokumente mit korrekten Titeln, 0 JS-Fehler. ~60 Zeilen Duplikat entfernt.

### Cycle #144 — 2026-07-20 — „Nach oben"-Button für lange Listen (mobil, universell)
- **THINK:** Themenwechsel (universelle UX): lange Feeds/Engpass-Listen sind auf dem Handy mühsam zurückzuscrollen. Ein Standard-„nach oben"-Button hilft der zeitknappen, mobilen Zielgruppe — auf allen Seiten.
- **WORK:** Global einmal erzeugter runder Button (unten rechts), erscheint sanft ab ~600 px Scroll (`requestAnimationFrame`-gedrosselter passiver Scroll-Listener), scrollt smooth nach oben. `aria-label`/`title` über `data-i18n-aria` (Locale-Wechsel), `@media print` ausgeblendet, theme-aware. i18n `backtotop_aria` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 806/806/806, a11y-Audit sauber, Guards 0. **Browser:** oben versteckt → nach Scroll sichtbar (aria „Nach oben scrollen") → Klick scrollt hoch, 0 JS-Fehler.

### Cycle #143 — 2026-07-20 — Wirkstoff-Dossier drucken (Ein-Seiten-Kaufentscheidung)
- **THINK:** Die Wirkstoff-Detailseite ist der Ort der Kaufentscheidung. Ein druckbares Ein-Seiten-Dossier (Engpass-Status, günstigster Preis, beste Aktion, Bezugsquellen, eigene Notiz) bringt alles Relevante in eine Besprechung — echter Nutzen für den Einkauf.
- **WORK:** `printWirkstoff(d)` baut aus den bereits geladenen Detaildaten einen sauberen Report mit Sektionen (nur gefüllte werden gezeigt): Engpass-Status (farbig, mit Quelle) bzw. „keine Meldung", günstigster Preis über alle Angebote, beste laufende Aktion, offene Biete-Bezugsquellen, private Notiz. „🖨️"-Button im Detailkopf. i18n `wk_print_*` DE/EN/PT (Sektionstitel teils aus bestehenden Schlüsseln).
- **CHECK:** 320 grün, Smoke 19/19, Parität 805/805/805, Guards 0. **Browser:** Amoxicillin-Detail → Druck zeigt Titel, „🔴 Kritisch", günstigster Preis und die Bezugsquelle (Graz), 0 JS-Fehler.

### Cycle #142 — 2026-07-20 — Bestandsaustausch: Frische-Hinweis für alte eigene Einträge (Datenqualität)
- **THINK:** Marktplatz-Qualität: alte, offene Biete/Suche-Einträge veralten und verzerren den Netzwerk-Überblick. Eigene, lange offene Einträge dezent zum Aufräumen anregen — hält Angebot/Nachfrage aktuell, ohne zu drängen.
- **WORK:** In `exchangeCard` bei eigenem, offenem Eintrag ab **21 Tagen** Alter ein Hinweis „⏳ Dieser Eintrag ist {d} Tage alt — noch aktuell?" + „Als erledigt markieren" (löst `resolve` aus). Alter aus `created_at`. i18n `ex_stale`/`ex_stale_done` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 799/799/799, Guards 0. **Browser (Date.now +30 T simuliert):** Banner erscheint, Klick markiert erledigt; bei echter Zeit (frisch) kein Banner; 0 JS-Fehler.

### Cycle #141 — 2026-07-20 — Bestandsaustausch: CSV-Export (Export-Abdeckung komplett)
- **THINK:** Der einzige Daten-Reiter ohne Export war Biete/Suche. Ein CSV der aktuellen Auswahl gibt Einkauf/Logistik einen Netzwerk-Überblick zu Angebot/Nachfrage. Nur öffentliche Angaben (Anbieter-Handle) — Kontakt bleibt über DM.
- **WORK:** `exportExchangeCsv(entries)` (Art · Präparat · Menge · Ort/Region · Anbieter · Handle · Erstellt · passende Treffer); Export-Karte mit „⬇️ CSV" im Biete/Suche-Reiter, exportiert die gerade gefilterte Auswahl. i18n `ex_csv_*` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 797/797/797, Guards 0. **Browser (Download-Capture):** Header + Datenzeile korrekt (📦 Biete; Amoxicillin …; @handle; Datum), 0 JS-Fehler. Damit haben alle Daten-Reiter Export.

### Cycle #140 — 2026-07-20 — Übersicht: konkrete €-Ersparnis bei Aktionen zu beobachteten Wirkstoffen
- **THINK:** Für die zahlende Zielgruppe (Einkauf) ist die konkrete Ersparnis in € greifbarer als nur „−X %". Die Aktionen-Karte auf der Übersicht zeigte Rabatt-% und Aktionspreis, aber nicht die €-Ersparnis pro Packung.
- **WORK:** Overview-Service liefert `ersparnis` (+`min_menge`) je watch_deal; Frontend zeigt zusätzlich „spare € {x}/Pkg" (grün) in der „Aktionen zu deinen Wirkstoffen"-Karte. i18n `wd_saving` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 789/789/789, Guards 0. **Browser:** beobachtetes Ibuprofen → Karte zeigt „spare € 0,70/Pkg", API liefert `ersparnis`, 0 JS-Fehler.

### Cycle #139 — 2026-07-20 — Benachrichtigungen: Filter „⭐ Engpässe & Beschaffung" / „💬 Sozial"
- **THINK:** An vollen Tagen mischen sich kritische Frühwarnungen mit sozialen Meldungen (Likes/Follows). Ein Filter, um sich aufs Beschaffungs-Relevante zu konzentrieren, spart Zeit. Rein Anzeige-seitig (kein Backend, keine Zähler-Desync).
- **WORK:** `showNotifications` in `drawNotifs()` refaktoriert; Filter-Chips „Alle / ⭐ Engpässe & Beschaffung / 💬 Sozial" erscheinen nur, wenn es sich lohnt (≥5 Meldungen und beide Kategorien vertreten). Beschaffungs-Kategorie = `watch_alert, shortage_confirm, watch_offer, exchange_offer, exchange_want`. i18n `nf_*` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 788/788/788, Guards 0. **Browser (5 gemischte Meldungen):** Filter sichtbar → „Engpässe" zeigt 1, „Sozial" zeigt 4, 0 JS-Fehler.

### Cycle #138 — 2026-07-20 — Rabatte als druckbarer Aushang (Export-Symmetrie komplett)
- **THINK:** Konsistenz + Einkaufs-Nutzen: Rabatte hatten CSV, aber keinen Druck-Report — wie jetzt Preise (#137) und Merkliste (#109). Ein „laufende Aktionen"-Aushang hilft dem Einkauf am Bestelltisch.
- **WORK:** `printRabatte(list)` öffnet einen formatierten Report (Präparat/Wirkstoff · Lieferant · Aktionspreis · Rabatt% · Ersparnis · Mindestmenge · gültig bis, ⏳ bei baldigem Ablauf). „🖨️ Drucken"-Button neben CSV im Rabatte-Reiter; beide respektieren die aktuelle Filter-/Suchauswahl. i18n `rb_print_t`/`rb_print_title` DE/EN/PT (übrige Spalten aus bestehenden `csv_*`/`pr_print_*`).
- **CHECK:** 320 grün, Smoke 19/19, Parität 785/785/785, Guards 0. **Browser:** Druckfenster mit Titel, Spalten und 10 Aktionen, 0 JS-Fehler.

### Cycle #137 — 2026-07-20 — Preisvergleich als druckbarer Einkaufs-Report
- **THINK:** Einkaufs-Nutzen: der Preisvergleich hatte CSV, aber keinen lesbaren Ausdruck für Besprechung/Aushang. Ein formatierter Report (günstigster Lieferant, Ersparnis, beste Aktion je Präparat) hilft nicht-technischen Einkäufer:innen direkt.
- **WORK:** `printPrices(comparisons)` öffnet einen sauberen Druck-Report (Titel, Datum locale-korrekt, Tabelle Präparat/Wirkstoff · günstigster Lieferant · AEP · Ersparnis · beste Aktion, Fußzeile mit Gewähr-Hinweis). „🖨️ Drucken"-Button neben CSV; beide respektieren jetzt die aktuelle Filter-/Suchauswahl (`shownPrices`). i18n DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 783/783/783, Guards 0. **Browser:** Klick öffnet Druckfenster mit Titel, allen Spalten und Präparaten (4), 0 JS-Fehler.

### Cycle #136 — 2026-07-20 — Umfragen: Stimmenzahl neben Prozent (Datenklarheit)
- **THINK:** Themenwechsel (Feed/Umfragen): Umfrage-Optionen zeigten nur %. 40 % von 5 Stimmen ≠ 40 % von 200 — bei kleinen Fach-Umfragen irreführend. Rohzahl dazu = ehrliche Einordnung (Klartext/Transparenz, CLAUDE.md).
- **WORK:** `pollHtml` zeigt je Option „n · pct%" (statt nur „pct%"), plus Tooltip mit „n Stimmen" (bestehende `pl_total`/`pl_total_one` wiederverwendet). Keine neuen i18n-Schlüssel; `poll-pct` mit tabular-nums fasst die Zahl sauber.
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser:** Umfrage nach Stimme zeigt „1 · 100%" / „0 · 0%", 0 JS-Fehler.

### Cycle #135 — 2026-07-20 — Profil teilen + Deep-Link (`?profile=`)
- **THINK:** Themenwechsel (professionelles Netzwerk): Beiträge (`?post=`) und Wirkstoffe (`?wirkstoff=`) waren teil-/deeplinkbar, Profile nicht — man konnte ein Kolleg:innen-Profil nicht verlinken.
- **WORK:** Deep-Link `/?profile=<Handle>` → `openProfile`. „🔗 Teilen"-Button im Profilkopf kopiert den Link (Clipboard, Fallback `prompt`), gleiche Mechanik wie Wirkstoff-/Beitrag-Teilen. Bestehende i18n (`pc_share`/`pc_copied`/`copy_link_fb`) wiederverwendet — keine neuen Schlüssel.
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser:** Teilen-Button liefert `…/?profile=<Handle>`; Aufruf des Deep-Links öffnet das Profil (Name sichtbar), 0 JS-Fehler.

### Cycle #134 — 2026-07-20 — Engpass-Meldung: Duplikat-Hinweis (Datenqualität)
- **THINK:** Themenwechsel: Meldet jemand einen Wirkstoff, für den bereits eine offene Meldung existiert, entstehen doppelte Einträge. Beim Tippen dezent darauf hinweisen und zum Ansehen/Bestätigen führen — bessere Datenqualität, ohne zu blockieren (Backend erlaubt weiter, andere sollen bestätigen).
- **WORK:** `reportShortageCard(existing)` bekommt die aktuelle Engpassliste; beim Tippen im Wirkstoff-Feld (debounced) prüft es offene Meldungen (Status ≠ verfügbar) und zeigt „Für „{w}" gibt es bereits eine offene Meldung — Ansehen & bestätigen" → öffnet die Detailseite (mit Bestätigen-Button). i18n `sh_rep_exists`/`sh_rep_exists_view` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 777/777/777, Guards 0 (auch „Helle Inline-BGs 0" dank CSS-Var-Fallback). **Browser:** Hinweis bei „Amoxicillin" (Seed), keiner bei neuem Namen, Klick → Detailseite, 0 JS-Fehler.

### Cycle #133 — 2026-07-20 — Suche: „Letzte Suchen" als Schnell-Chips
- **THINK:** Themenwechsel: Suchen wiederholen sich oft (dieselben Wirkstoffe/Lieferanten/Personen). Lokale „Letzte Suchen" als Ein-Klick-Chips sparen Tipparbeit — konkreter Komfort, keine Server-Änderung, kein Datenschutz-Thema (nur lokal).
- **WORK:** `getRecentSearches`/`recordRecentSearch` (localStorage, max 6, dedupe). `renderSearch` merkt jede Suche und zeigt oben eine „🕘 Letzte Suchen"-Chip-Reihe (ohne die aktuelle Suche); Klick wiederholt die Suche. i18n `search_recent` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 775/775/775, Guards 0. **Browser:** nach zwei Suchen erscheint die frühere als Chip (aktuelle ausgeschlossen), Klick wechselt die Suche, 0 JS-Fehler.

### Cycle #132 — 2026-07-20 — Willkommens-Dialog barrierefrei (role/aria/Escape/Fokus)
- **THINK:** Themenwechsel: der Onboarding-Overlay (einziges Modal der App) hatte keine Dialog-Semantik — für Tastatur-/Screenreader-Nutzer:innen eine echte Lücke (wichtig auf einer Fachplattform).
- **WORK:** Inneres Panel bekommt `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (Titel-`id`); **Escape** schließt (Listener sauber wieder entfernt); Fokus wandert beim Öffnen auf den „Los geht's"-Button. Verhalten (Backdrop-Klick schließt, `apo_welcome_seen`) unverändert.
- **CHECK:** 320 grün, Smoke 19/19, Browser-a11y-Audit sauber. **Browser-e2e:** neuer Nutzer sieht Dialog (role/aria/Titel korrekt), Close-Button fokussiert, Escape schließt, bleibt nach Reload zu, 0 JS-Fehler.

### Cycle #131 — 2026-07-20 — Preise-Reiter: Filter „⭐ Nur beobachtete" + i18n-Fix (Tooltip)
- **THINK:** „Fokus auf meine Wirkstoffe" über die Reiter konsistent machen (Engpässe: Beobachten-Button, Rabatte #129, jetzt Preise). Zusätzlich echter i18n-Bug gefunden: Wirkstoff-Tooltip im Preisvergleich war hartkodiert deutsch.
- **WORK:** `loadPrices` lädt die Beobachtungsliste; Filter-Button „⭐ Nur beobachtete" (nur bei ≥1 beobachtetem Wirkstoff), filtert Preisgruppen auf `watched.has(wirkstoff)`, Zustandssync. Tooltip `title="Alles zu {w}"` → i18n `pg_all_about` DE/EN/PT (bestehender `rb_watched_only` wiederverwendet).
- **CHECK:** 320 grün, Smoke 19/19, Parität 774/774/774, Guards 0. **Browser:** 4 Preisgruppen → nach Filter 1 (Metformin = beobachtet), 0 JS-Fehler.

### Cycle #130 — 2026-07-20 — Frühwarnung führt direkt zum betroffenen Wirkstoff
- **THINK:** Ein `watch_alert` (beobachteter Wirkstoff wurde kritisch/geändert) sprang bisher nur auf den ganzen Engpass-Reiter. Direkt auf die Detailseite des betroffenen Wirkstoffs zu springen (mit Status, Bezugsquellen, Aktionen, Diskussion) spart Sucherei — genau im Alarmfall.
- **WORK:** Klick-Routing für `watch_alert` öffnet `openWirkstoff(<Wirkstoff>)`. Der Wirkstoff wird aus dem Meldungs-Label geparst (Format durchgängig „<Wirkstoff> · <Status> …" an allen drei Alarm-Stellen); Fallback auf den Engpass-Reiter, wenn kein Name ableitbar.
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser-Ende-zu-Ende:** Apotheke A beobachtet Wirkstoff → Apotheke B meldet Engpass → A erhält Frühwarnung → Klick landet auf der Detailseite des Wirkstoffs, 0 JS-Fehler.

### Cycle #129 — 2026-07-20 — Rabatte-Reiter: Filter „⭐ Nur beobachtete" (Einkaufs-Nutzen)
- **THINK:** Für den Einkauf/Großhandel: aus vielen laufenden Aktionen schnell die zu den selbst beobachteten Wirkstoffen sehen. Verbindet Merkliste ↔ Rabatte, konkreter Zeitgewinn.
- **WORK:** `loadRabatte` lädt zusätzlich die Beobachtungsliste; neuer Filter-Button „⭐ Nur beobachtete" (nur sichtbar, wenn überhaupt Wirkstoffe beobachtet werden), filtert Aktionen auf `watched.has(wirkstoff)`; Zustandssync + CSV-Export respektiert die Auswahl. i18n `rb_watched_only` DE/EN/PT.
- **CHECK:** 320 grün, Smoke 19/19, Parität 773/773/773, Guards 0. **Browser:** 10 Aktionen → nach Filter 2 (beide Ibuprofen = beobachtet), 0 JS-Fehler.

### Cycle #128 — 2026-07-20 — Ein-Klick-Beobachten auch aus „zuletzt angesehen" (Konsistenz)
- **THINK:** Konsistenz-Lücke: In der Suche kann man Wirkstoffe mit einem Klick beobachten (#111), bei den „zuletzt angesehen"-Chips auf der Übersicht nicht. Sichtbarer, universeller Nutzen; Wiederverwendung statt Duplikat.
- **WORK:** Wiederverwendbaren Helper `substanceWatchChip(w, watched)` extrahiert (💊 Wirkstoff öffnet Detail + „+ Beobachten"/„✓ Beobachtet", optimistisch, grüne Aktiv-Kennzeichnung). Recents nutzen ihn jetzt; beobachtete Wirkstoffe aus `d.watchlist.items` vormarkiert. Keine neuen i18n-Schlüssel (bestehende `search_watch*`).
- **CHECK:** 320 grün, Smoke 19/19, Guards 0. **Browser:** Recents-Chip „+ Beobachten" → „✓ Beobachtet" (grün) → landet in der Merkliste, 0 JS-Fehler.

### Cycle #127 — 2026-07-20 — Live-Daten-Anschluss komplett: Rabatte (3. Datentyp) — Kern-Trio auto-connect
- **THINK:** Die Auto-Connect-Datenschicht abrunden: nach Engpässen (#118) und Preisen (#126) jetzt **Rabatte** — dann ziehen alle drei Kern-Datentypen automatisch echte Daten, sobald angeschlossen.
- **WORK:** `liveData.js` um `validateRabattePayload`/`refreshRabatte`/`isRabatteLive`/`liveRabatteSources` erweitert; `startLiveRefresh` nimmt jetzt auch `rabatteRepo`. `rabatteRepo.replaceFeed`. Env `APOPULSE_LIVE_RABATTE_<CC>`; `/api/data-status` liefert `rabatte.live`; Server-Start refresht alle drei Typen. `rabatt_pct`/`ersparnis` werden serverseitig berechnet. Doku `LIVE_DATA.md` erweitert.
- **CHECK:** 319 → 320 grün (+1: Pflichtfelder inkl. gueltig_bis/Preise>0, Übernahme+verified+Rabatt-Berechnung, Fehler-Fallback, isRabatteLive), Smoke 19/19, Guards 0. Anschließen = ENV-Variable, kein Code-Deploy.

### Cycle #126 — 2026-07-20 — Live-Daten-Anschluss auf Preise ausgeweitet (2. Datentyp)
- **THINK:** Owner-Vision „sobald angeschlossen, holt sich alles automatisch echte Daten" weiter tragen: die bewährte Anschlussstelle (#118, Engpässe) auf **Preise** übertragen — gleiche Env-Gating-/Validierungs-/Fallback-Logik, ruht bis angeschlossen.
- **WORK:** `liveData.js` um `validatePricePayload`/`refreshPrices`/`isPriceLive`/`livePriceSources` erweitert; `startLiveRefresh` generalisiert (Engpässe + Preise als Tasks). `pricesRepo.replaceFeed` (Feed komplett ersetzen). Env `APOPULSE_LIVE_PRICES_<CC>`; `/api/data-status` liefert jetzt auch `prices.live`; Server-Start startet Auto-Refresh für beide Typen. Doku `LIVE_DATA.md` erweitert (Preis-Vertrag).
- **CHECK:** 317 → 319 grün (+2: Preis-Validierung inkl. aep>0/Pflichtfelder, refreshPrices Übernahme+Fehler-Fallback+isPriceLive), Smoke 19/19, Guards 0. Anschließen = ENV-Variable, kein Code-Deploy.

### Cycle #125 — 2026-07-20 — News-Reiter: Beitrags-Composer einklappbar (News zuerst)
- **THINK:** Im News-Reiter stand der Schreib-Composer immer offen ganz oben und drückte die eigentlichen News nach unten — die meisten wollen News LESEN. Content-first, weniger Scrollen (CLAUDE.md).
- **WORK:** Composer in eine einklappbare Karte (standardmäßig zu) mit Toggle „✏️ Eigene News teilen" (aria-expanded + Chevron, Fokus aufs Textfeld beim Öffnen); Feld-IDs unverändert, Post-/Bild-/Quelle-Logik unangetastet. i18n `news_compose` DE/EN/PT.
- **CHECK:** 317 grün, Smoke 19/19, Parität 772/772/772, Guards 0. **Browser:** Composer standardmäßig zu (News zuerst) → Klick öffnet → News posten funktioniert, 0 JS-Fehler.

### Cycle #124 — 2026-07-20 — Bestandsaustausch: Kontakt-DM mit Kontext-Entwurf
- **THINK:** Beim „Kontaktieren" aus einem Biete/Suche-Eintrag öffnete sich ein leerer DM — der/die Empfänger:in wusste nicht, worum es geht. Ein vorbelegter, editierbarer Entwurf mit Eintrags-Kontext macht die Kontaktaufnahme sofort verständlich (Klartext, Zeitersparnis).
- **WORK:** `openDmThread(threadId, prefill)` belegt das Eingabefeld nur vor, wenn der Verlauf noch leer ist (kein Überschreiben laufender Gespräche). Exchange-„Kontaktieren" übergibt einen Entwurf „Hallo! Zu deinem Eintrag „📦 Biete: {Präparat}" — ist das noch aktuell?". i18n `ex_dm_draft` DE/EN/PT.
- **CHECK:** 317 grün, Smoke 19/19, Parität 771/771/771, Guards 0. **Browser:** Kontakt aus Biete-Eintrag → DM mit vorbelegtem Entwurf inkl. Präparat + „Biete", editierbar, 0 JS-Fehler.

### Cycle #123 — 2026-07-20 — Übersicht entlasten: Umrechner einklappbar + lazy (weniger Scrollen)
- **THINK:** Selbstkorrektur: die letzten Zyklen haben die Übersicht voller gemacht — gegen CLAUDE.md „weniger Scrollen / auf einen Screen". Der Umrechner ist Nischen-Werkzeug (Import) → einklappen, standardmäßig zu; Kurse erst beim Öffnen laden (spart einen oft langsamen/geblockten FX-Abruf pro Laden).
- **WORK:** `renderCurrencyConverter` in eine einklappbare Karte + `buildCurrencyConverter` (lazy) aufgeteilt; Toggle mit `aria-expanded` + Chevron, Untertitel-Hinweis auch im geschlossenen Zustand. i18n `cc_hint` DE/EN/PT.
- **CHECK:** 317 grün, Smoke 19/19, Parität 770/770/770, Guards 0. **Browser:** standardmäßig zu, **0 FX-Abrufe vor Öffnen**, nach Klick gebaut + rechnet (110 USD→100,00 EUR), 0 JS-Fehler.

### Cycle #122 — 2026-07-20 — Offline-fähig für schwaches Netz (Service Worker, sicher)
- **THINK:** Universeller Nutzen + Matrix-Ziel (Low-Connectivity-Märkte): App soll bei schwacher/unterbrochener Verbindung noch laden. Bisheriger SW war bewusst no-cache (kein Offline). Jetzt Offline-Hülle — OHNE Update-Staus und OHNE je Sicherheits-/Engpassdaten zu cachen.
- **WORK:** `sw.js` auf **Network-First mit Cache-Fallback** umgestellt: App-Hülle (`/`, index, app.js/css, Icons, Manifest) beim Install vorgecacht (best-effort), versionierter Cache (`v2`, alte werden gelöscht). Online immer frisch + Cache aktualisiert; offline aus dem Cache (Navigation → Hülle). **`/api/*` wird NIE gecacht** (keine veralteten Daten), nur GET, nur eigene Herkunft.
- **CHECK:** 317 grün, Smoke 19/19, Audit sauber. **Browser:** online Header da + SW steuert Seite; **offline neu geladen → Hülle aus Cache**, API scheitert korrekt (nicht gecacht), 0 JS-Fehler.

### Cycle #121 — 2026-07-20 — Länder-Feature-Konfiguration (Framework-Schema `active_features`)
- **THINK:** Owner-Spec verlangt ausdrücklich das `active_features`-JSON „für das Backend". Umgesetzt — aber EHRLICH: `enabled=true` nur für real existierende Funktionen; sicherheits-/datenabhängige Module (Echtheitsprüfung, Rückrufe) `enabled=false`+`planned` (schalten erst mit echter Quelle frei). Keine Scheinfunktionen.
- **WORK:** `data/countryFeatures.js` → `countryConfig(code)` liefert `{ country, language, currency, regulator, active_features[] }`. Kernfunktionen aktiv; `regulator_source` aktiv nur mit verifizierter URL (sonst geplant); gruppenspezifische Roadmap-Module je Sprachgruppe (DACH/Lusophonie/Anglophonie); `recall_tracking` überall geplant. Endpoint `GET /api/country-config`. Doku `docs/COUNTRY_CONFIG.md`.
- **CHECK:** 312 → 317 grün (+5: Schema/Kernfunktionen, regulator_source URL-abhängig, geplante Module ehrlich false, Fallback unbekannter Code, HTTP-Endpoint), Smoke 19/19, Guards 0.

### Cycle #120 — 2026-07-20 — Währungsumrechner mit echten Live-Kursen (Import-/Einkaufs-Nutzen)
- **THINK:** Aus der Länder-Matrix: Import-Märkte (NG/BR/AO …) brauchen Umrechnung Landeswährung ↔ EUR/USD. Echte Kurse (nichts erfunden), wiederverwendet das bewährte Rates-Muster (public API, Cache, Fallback).
- **WORK:** `services/fxRates.js` (open.er-api.com, EUR-Basis, 1 h Cache, injizierbarer Fetch, `convert` über EUR-Kreuzrate, Fallback letzter Stand/null). Endpoint `GET /api/fx-rates`. Übersicht: Umrechner-Karte (Betrag · Von → In · Swap), Währungen aus dem Länder-Register mit vorhandenem Kurs, Standard = Landeswährung → EUR; bei fehlenden Kursen ehrlicher Hinweis statt Zahlen. i18n DE/EN/PT.
- **CHECK:** 308 → 312 grün (+4: Parsing/Cache, convert-Mathe, Fehler-Fallback, ungültige API → null), Smoke 19/19, Parität 769/769/769, Guards 0. **Browser (Kurse gestubbt):** 110 USD → 100,00 EUR, Swap, NG-Standard NGN→EUR, 0 JS-Fehler. (FX-API in der Sandbox geblockt → in Prod live, sonst ehrlicher Fallback.)

### Cycle #119 — 2026-07-20 — Daten-Herkunft sichtbar: „🟢 Live-Daten" vs „🟡 Referenzdaten (im Aufbau)"
- **THINK:** #118 sichtbar & vertrauensbildend abschließen: Nutzer:innen sollen auf einen Blick sehen, ob echte Live-Daten angeschlossen sind oder (noch) kuratierte Referenzdaten laufen. Quellen-/Transparenzpflicht (CLAUDE.md).
- **WORK:** Übersicht-Route liefert `data_live` (aus `isLive(aktives Land)`); Behörden-Karte zeigt eine Status-Pille (grün live / gelb Referenz) mit erklärendem Titel; theme-aware CSS, i18n DE/EN/PT.
- **CHECK:** 308 grün, Smoke 19/19, Parität 762/762/762, Guards 0. **Echter Netzwerk-Pfad e2e** (ohne injizierten Fetch): lokaler Feed-Server → `refreshShortages`/`fetchJsonDefault` → Abruf+Validierung+Übernahme (Seed ersetzt, provenance=verified, Quelle BASG). **Browser:** NG-Nutzer sieht „🟡 Reference data (in progress)", 0 JS-Fehler.

### Cycle #118 — 2026-07-20 — Live-Daten-Anschlussstelle: Auto-Refresh, sobald ein Server angeschlossen wird
- **THINK:** Owner-Vorgabe: echte Daten kommen, sobald die Website an einen Server angeschlossen ist; bis dahin bauen. Also die „Anschluss-Stelle" bauen — ein klarer Vertrag + Ingestion, per ENV scharf geschaltet, die sich dann automatisch aktualisiert. Bis dahin unveränderte Referenzdaten.
- **WORK:** Neues Modul `services/liveData.js`: definierter JSON-Vertrag, `validateShortagePayload` (streng), `refreshShortages` (Abruf→Validierung→Übernahme, fehlersicher: bei Fehler bleibt der Bestand), `startLiveRefresh` (ruht ohne Quelle, sofort+alle 15 min sobald `APOPULSE_LIVE_SHORTAGES_<CC>` gesetzt; `unref`). Repo: `replaceFeed` ersetzt Seed/Live, **erhält Community-Meldungen**. Endpoint `GET /api/data-status`. Server-Start startet Auto-Refresh nur bei konfigurierter Quelle (in Tests aus). Doku `docs/LIVE_DATA.md` (Vertrag + ENV + Verhalten).
- **CHECK:** 301 → 308 grün (+7: Validierung, Ingestion mit Community-Schutz, Fehler-/Abruf-Sicherheit, Skip ohne Quelle, startLiveRefresh dormant→ingest, /api/data-status), Smoke 19/19, Guards 0. Anschließen = eine ENV-Variable setzen, **kein Code-Deploy**.

### Cycle #117 — 2026-07-20 — Länder-Framework Schritt 1: offizielle Regulierungs-Quelle je Land (echte Links)
- **THINK:** Auftakt zum landesspezifischen Feature-Framework (Owner-Vorgabe: NAFDAC/BfArM/ANVISA … pro Land). WICHTIG: sicherheitskritische Alerts/Recalls/„Fake-Drug-Checks" NICHT erfinden (CLAUDE.md-Quellenpflicht). Ehrlicher, sofort nützlicher erster Baustein: die OFFIZIELLE Behörde je Land als belegte Quelle verlinken.
- **WORK:** Länder-Register (`countries.js`) um `regulator_url` erweitert — echte, verifizierte offizielle URLs (BASG, BfArM, Swissmedic, INFARMED, ANVISA, MHRA, FDA, **NAFDAC**, PPB, FDA Ghana, Health Canada, TGA, SAHPRA); wo Domain nicht sicher belegt (AO/MZ/LI) bewusst `null` (kein falscher Link). Neue Karte „🏛️ Offizielle Arzneimittelbehörde: {reg}" auf der Übersicht, folgt der Länder-Ansicht; öffnet die echte Behörden-Website. i18n DE/EN/PT.
- **CHECK:** 301 grün (HTTP-Test erweitert: echte https-URLs für DE/NG/US, null für AO/MZ/LI, jede gesetzte URL valide), Smoke 19/19, Parität 758/758/758, Guards 0. **Browser:** Nigeria → NAFDAC-Karte mit `nafdac.gov.ng`; Österreich → BASG mit `basg.gv.at`, 0 JS-Fehler.
- **NEXT:** Währungs-Umrechner (echte Kurse), landesspezifische Feature-Flags/Config-Endpoint, Quell-Links in News/Engpass-Karten je Land — schrittweise, immer mit belegten Quellen.

### Cycle #116 — 2026-07-20 — Bestandsaustausch: Treffer im Moment der Absicht (nach dem Anlegen)
- **THINK:** Direkte Fortsetzung von #115: Der wertvollste Moment ist genau nach dem Anlegen eines Eintrags — wer gerade eine „Suche" postet, will sofort sehen, wer das anbietet. Das schließt den Matchmaking-Kreis am Punkt der höchsten Absicht.
- **WORK:** Der Anlege-Handler liest `match_count` der Antwort; bei ≥1 wird automatisch auf die passenden Gegenstücke gefiltert (gegenteilige Art + erstes Wirkstoff-Wort) und ein einmaliger Erfolgs-Banner gezeigt („✅ N passende Angebote/Gesuche gefunden — hier deine Treffer."). i18n DE/EN/PT (Singular/Plural).
- **CHECK:** 301 grün, Smoke 19/19, Parität 754/754/754, Guards 0. **Browser:** Suche anlegen mit vorhandenem Biete → Banner „1 passendes Angebot gefunden" + Liste auf den Treffer gefiltert, 0 JS-Fehler.

### Cycle #115 — 2026-07-20 — Bestandsaustausch: sichtbares Matchmaking („N passende Angebote/Gesuche")
- **THINK:** Kernnutzen des Biete/Suche-Tauschs sichtbar machen: bisher wurden Treffer nur als Benachrichtigung gepusht (`notifyMatches`). Am Eintrag selbst zeigen, dass es passende Gegenstücke gibt → schnellerer Kontakt bei Engpässen. Echte Daten, wiederverwendet die vorhandene Wort-Matching-Logik.
- **WORK:** `decorate` liefert `match_count` = Anzahl passender offener Gegen-Einträge je Autor:in (Selbst-Ausschluss, nur offene). Exchange-Karte: grüner Klick-Chip „🔗 N passende Gesuche/Angebote" (Singular/Plural), Klick filtert auf die gegenteilige Art + erstes Wirkstoff-Wort. i18n DE/EN/PT.
- **CHECK:** 300 → 301 grün (+1 Service-Test: 0/1/Selbst-Ausschluss/kein-Match), Smoke 19/19, Parität 750/750/750, Guards 0. **Browser:** Biete-Eintrag zeigt „1 passendes Gesuch" → Klick filtert korrekt auf das Gesuch, 0 JS-Fehler.

### Cycle #114 — 2026-07-20 — Community-Signal: „Auch von N Kolleg:innen beobachtet" (echte Daten)
- **THINK:** Universeller Nutzen aus vorhandenen, ECHTEN Daten (`usersWatching`): auf der Wirkstoff-Detailseite zeigen, wie viele andere denselben Wirkstoff beobachten. Relevanz-/Nachfrage-Signal, das zum Melden/Beobachten ermutigt. Datenschutz-sicher (nur Zahl, keine Identitäten), erscheint nur wenn ≥1.
- **WORK:** `/api/wirkstoff/:name` liefert `also_watching` = Anzahl beobachtender Nutzer:innen OHNE sich selbst. Detailseite: dezente Zeile „👀 Auch von N Kolleg:innen beobachtet" (Singular/Plural), nur bei ≥1. i18n DE/EN/PT.
- **CHECK:** 299 → 300 grün (+1 HTTP-Test: Selbst-Ausschluss, 0/2/1-Szenario), Smoke 19/19, Parität 746/746/746, Guards 0.

### Cycle #113 — 2026-07-20 — Premium-Entdeckung: dezenter Hinweis für Gratis-Nutzer:innen (Conversion)
- **THINK:** Gap im Geschäftsmodell: Gratis-Nutzer:innen konnten die Premium-Zusatzfunktionen (Notizen, Aushang) gar nicht entdecken → keine Conversion, das ganze Bezahl-System liefe ins Leere. Ehrlicher, dezenter Hinweis an der Stelle, wo der Mehrwert entsteht (Merkliste). Kein Sperren von Kern-Funktionen.
- **WORK:** In der Merklisten-Karte für Gratis-Nutzer:innen eine einzeilige, unaufdringliche Zeile „📝 Private Notizen & druckbarer Team-Aushang gibt es mit Premium" + „⭐ Freischalten" → öffnet den Premium-Screen. Für Premium ausgeblendet. i18n DE/EN/PT.
- **CHECK:** 299 grün, Smoke 19/19, Parität 744/744/744, Guards 0. **Browser:** Gratis sieht Hinweis + Klick öffnet Premium; Premium sieht ihn nicht; 0 JS-Fehler.

### Cycle #112 — 2026-07-20 — Premium: Notiz auch auf der Wirkstoff-Detailseite (autonomer Loop, 1. Durchlauf)
- **THINK:** Erster Durchlauf des autonomen Selbstverbesserungs-Loops. Die private Notiz (#108) war nur in der Merklisten-Karte editierbar — konsequent auch dort, wo Nutzer:innen einen Wirkstoff wirklich ansehen: auf der Detailseite (`openWirkstoff`).
- **WORK:** `/api/wirkstoff/:name` liefert jetzt `premium` + `note`. Detailseite: für Premium eine Notiz-Karte, die erscheint, sobald der Wirkstoff beobachtet wird (das Notiz-Setzen setzt Beobachtung voraus); anzeigen + inline bearbeiten (📝), Toggle mit dem Beobachten-Button synchron. i18n `wk_note_title` DE/EN/PT.
- **CHECK:** 299 grün, Smoke 19/19, Parität 742/742/742, Guards 0. **Browser:** vor Beobachten versteckt → nach Beobachten Notiz-UI → gespeichert (UI + serverseitig), 0 JS-Fehler.

### Cycle #111 — 2026-07-20 — Aus der Suche direkt beobachten (universell, ein Klick)
- **THINK:** Universeller Nutzen für alle (nicht nur Premium): Suche und Beobachtungsliste verzahnen. Wer einen Wirkstoff sucht, soll ihn mit einem Klick beobachten können — ohne Umweg über die Detailseite. Treibt die Watchlist-Nutzung (und damit den Premium-Mehrwert) an.
- **WORK:** In den Wirkstoff-Chips der Suchtreffer je Treffer ein Toggle-Button „+ Beobachten" / „✓ Beobachtet". Lädt die aktuelle Beobachtungsliste zum Markieren; Klick beobachtet bzw. entfernt (optimistisch, mit grüner Aktiv-Kennzeichnung `.watched-on`). i18n DE/EN/PT.
- **CHECK:** 299 grün, Smoke 19/19, Parität 741/741/741, Guards 0. **Browser-Toggle:** „+ Beobachten" → „✓ Beobachtet" (grün) → landet in der Watchlist → 2. Klick entfernt wieder, 0 JS-Fehler.

### Cycle #110 — 2026-07-20 — Premium: Notizen auch im CSV/Excel-Export
- **THINK:** Die Wirkstoff-Notizen (#108) fließen in den Druck-Aushang (#109) — konsequenterweise auch in den CSV/Excel-Export, damit Premium die Annotationen auch in der Tabelle nutzen kann. Additiv, kein Nachteil für Gratis.
- **WORK:** CSV-Export der Merkliste erhält für Premium eine zusätzliche Spalte „Notiz" (Header + Wert); Gratis-Export unverändert (3 Spalten).
- **CHECK:** 299 grün, Smoke 19/19, Guards 0. **Browser (Download-Capture):** Premium-CSV = `…;Präparat;Notiz` inkl. Notizwert; Gratis-CSV ohne Notiz-Spalte.

### Cycle #109 — 2026-07-20 — Premium: Beobachtungsliste als druckbarer Team-Aushang (mit Notizen)
- **THINK:** Additiver Premium-Nutzen, der auf #108 aufbaut: die Merkliste als sauberer, druckbarer **Aushang** (Status + Notizen) zum Aushängen am Handverkaufstisch — nützlich gerade für nicht-technische, zeitknappe Teams.
- **WORK:** `printWatchlist(items)` öffnet einen formatierten Druck-Aushang (Titel, Datum locale-korrekt, Tabelle Wirkstoff/Präparat · Status farbig · Notiz, Fußzeile mit Gewähr-Hinweis). Button „🖨️ Aushang" nur für Premium in der Merklisten-Karte; Sichtbarkeit folgt der Liste. i18n DE/EN/PT inkl. Singular/Plural („1 Wirkstoff").
- **CHECK:** 299 grün, Parität 738/738/738, Smoke 19/19, Guards 0. **Browser-Ende-zu-Ende:** Premium-Kunde → Button sichtbar → Klick öffnet Druckfenster mit Wirkstoff + Notiz + Titel + Datum, 0 JS-Fehler.

### Cycle #108 — 2026-07-20 — Premium-Feature: private Notizen an beobachteten Wirkstoffen
- **THINK:** „Worth the money"-Feature, ethisch & additiv: Gratis-Nutzer:innen verlieren nichts, Premium bekommt echten Alltagsnutzen — private Notizen je beobachtetem Wirkstoff (Lieferant, Meldebestand …). Keine Paywall auf sicherheitskritische Engpass-Infos.
- **WORK:** shortagesRepo: `watchNotes` (userId→Wirkstoff→Notiz) + `setWatchNote`/`getWatchNote`, Persistenz + DSGVO-Purge; `myWatchlist` liefert `note`. Service: `setWatchNote` premium-gated (injiziertes `hasPremium` = `payments.hasFeature('premium')`), nur für beobachtete Wirkstoffe. Route `POST /api/watchlist/:w/note`; Overview liefert `premium`. Frontend: für Premium je Merklisten-Eintrag Notiz anzeigen + inline bearbeiten (📝), i18n DE/EN/PT.
- **CHECK:** 298 → 299 grün (+1: gate/not_watched/setzen/leeren/Persistenz), Smoke 19/19, Parität 726/726/726, Guards 0. **End-to-end im Browser:** Krypto-Zahlung → Admin bestätigt → Premium frei → Notiz-UI erscheint → Notiz gespeichert + übersteht Reload, 0 JS-Fehler.

### Cycle #107 — 2026-07-20 — Erster Premium-Vorteil: sichtbares „⭐ Premium"-Abzeichen
- **THINK:** Owner will Features, „die das Geld wert sind". Erster ehrlicher, ethischer Vorteil: sichtbarer Premium-Status — OHNE sicherheitskritische Engpass-Infos hinter eine Paywall zu stellen (das bleibt auf einer Gesundheitsplattform frei). Nutzt das bestehende Entitlement aus dem Zahlungs-System.
- **WORK:** `decorate` liefert `author.premium` (aus `foundationRepo.hasEntitlement`), `profilePage` liefert `profile.premium`. Frontend: goldenes „⭐ Premium"-Abzeichen an der Autor:innen-Zeile im Feed **und** im Profilkopf; theme-aware CSS (hell/dunkel), i18n `pc_premium` (DE/EN/PT).
- **CHECK:** 297 → 298 grün (+1: Premium-Flag ohne/mit Entitlement + im Profil), Parität 723/723/723, Smoke 19/19, Browser-Audit sauber, Guards 0.

### Cycle #106 — 2026-07-20 — Beide Solana-Wallets (Seeker + Phantom) + voller App-Durchlauf verifiziert
- **THINK:** Owner bestätigt: BEIDE SOL-Adressen gehören ihm (Seeker „leokennedy.skr" + Phantom, beide nur SOL). Beide einbauen; Kund:in wählt die Wallet. Danach die ganze App auf ein reibungsloses Kund:innen-Erlebnis prüfen.
- **WORK:** `cryptoWallets` von Map auf **Liste** umgestellt (mehrere Wallets je Coin, stabile `id` + `label`); zwei SOL-Wallets vorbelegt (ENV: `APOPULSE_WALLET_SOL_SEEKER`/`_PHANTOM`). Service/Route/Frontend auf `walletId` umgestellt; Zahlungsdatensatz trägt jetzt `coin`/`wallet_id`/`address` für die Zuordnung. Premium-UI zeigt je Wallet Label (z. B. „SOL · Seeker · leokennedy.skr").
- **CHECK:** 297 Tests grün (Payment-Tests auf Liste + 2× SOL angepasst), Smoke 19/19, Browser-Audit sauber, Parität 722/722/722, Guards 0. **Voller Kund:innen-Durchlauf** (hell+dunkel): alle 8 Reiter, Premium mit **4 Wallets** (BTC/ETH/2× SOL) inkl. echter Seeker- & Phantom-Adressen als Wallet-URIs, „Zahlung melden" bestätigt, **0 JS-Fehler**.

### Cycle #105 — 2026-07-20 — Direkt-in-Wallet Krypto-Zahlung (einfach, an die eigenen Adressen)
- **THINK:** Owner will den einfachen Direkt-Weg: Kund:innen klicken einen Coin und senden Krypto **direkt** an seine eigenen Wallets (per Screenshots als seine belegt — Empfangsadressen sind öffentlich). Zwei ehrliche Grenzen gehalten: (1) Solana-Adresse doppeldeutig (EMSJTk…pamWFM vs. Egbc…n1DW) → nicht geraten, SOL bleibt bis Klärung leer; (2) statische Adressen erlauben keine zuverlässige Auto-Zuordnung → **kein** Fake-Auto-Verifizierer, sondern Tx-ID-Meldung + manuelle Freigabe.
- **WORK:** `cryptoWallets.js` (BTC+ETH vorbelegt, ENV-überschreibbar; `walletUri` → `bitcoin:`/`ethereum:`/`solana:`), `cryptoRates.js` (EUR→Coin via CoinGecko, gecacht, `fetch` injizierbar, Fallback = nur €-Betrag). Service: `cryptoOptions`/`startCryptoPayment`/`claimCryptoPayment`/`confirmPayment`(Moderation)/`listPendingReview`. Routen `/api/payments/crypto[...]`. Frontend: „⭐ Premium"-Screen (Konto) mit Coin-Karten: Betrag, Adresse (kopieren), **„📲 In Wallet-App öffnen"**, Tx-ID melden; theme-aware, a11y-clean.
- **CHECK:** 292 → 297 grün (+ Wallets/URI, Rates-Cache/Fallback, cryptoOptions, kompletter start→claim→confirm-Flow als Unit **und** HTTP inkl. Admin-Bestätigung → Premium frei), Parität 722/722/722, Smoke 19/19, Guards 0. Browser (Hell+Dunkel): BTC/ETH-Karten mit **echten** Adressen + Wallet-URIs, 0 JS-Fehler.

### Cycle #104 — 2026-07-20 — Zahlungs-/Premium-Fundament (sicher, gehostet, env-gated) + Doku
- **THINK:** Owner-Wunsch: Premium-Freischaltung per Karte/PayPal/Wallet **und** Krypto. Rohe Wallets aus einem WhatsApp-Chat einzubetten + „1-Bestätigung"-Chain-Prüfung wären unsicher/Betrugsvektor → abgelehnt. Sicherer Weg (wie Social-Login): nur über LIZENZIERTE, gehostete Anbieter, deren eigener KYC die Sicherheitshürde ist; env-gated, inaktiv ohne eigene Schlüssel.
- **WORK:** `products.js` (EUR-Preise in Cent); Repo: Entitlements + Zahlungs-Audit (KEINE Karten-/Wallet-Rohdaten) + Persistenz + DSGVO-Purge; `payments.js` provider-agnostisch mit Stripe- (Karte/PayPal) & Coinbase-Commerce-Adapter (Krypto), Netz über `fetch`, Webhook-Signaturen via Node-`crypto` (HMAC-SHA256, konstante Zeit); Freischaltung **nur** über signierten Webhook, idempotent. Routen `/api/payments/{products,methods,checkout}`, `/api/me/premium`, plus Roh-Body-Webhook `/api/payments/webhook/:provider` (vor dem JSON-Router). `docs/PAYMENTS.md` (Übersicht, Setup, Endpunkte, Compliance, Krypto/Wallet-Realität = BTCPay für Direkt-in-Wallet, Test).
- **BEWUSST NICHT:** rohe Wallets im Code, eigene Chain-Prüfung, eigene Kursabfrage, Fake-Mailversand. Krypto-Prozessor rechnet EUR live um.
- **CHECK:** 282 → 292 grün (+9 Service/Adapter-Unit inkl. echter HMAC-Signaturen & Idempotenz, +1 HTTP inkl. Roh-Body-Webhook-Pfad), Smoke 19/19, Guards 0. Inaktiv ohne eigene, verifizierte Anbieter-Schlüssel.

### Cycle #103 — 2026-07-20 — Eigene Regression behoben: Tastatur-Aktivierung löste .clickable DOPPELT aus
- **THINK:** Beim Weitersuchen nach dem DM-Bug entdeckt: es gab bereits VOR #94 ein vollständiges Tastatur-System (`makeClickableAccessible` + debounced Observer + keydown-Handler mit `data-kbd`, das sogar Container mit verschachtelten Buttons korrekt überspringt). Mein #94 fügte ein ZWEITES, redundantes System hinzu → auf einem fokussierten `.clickable` feuerten beide keydown-Handler `click()` → **Doppel-Aktivierung** (harmlos bei Navigation, aber falsch bei Umschaltern).
- **WORK:** Das redundante #94-IIFE (eigener MutationObserver + keydown-Handler) entfernt; das bestehende, bessere System übernimmt weiterhin alles. #96/#97 (`.clickable` an Kacheln/Liste) bleiben wertvoll und funktionieren jetzt korrekt (einfach). Smoke-Guard ergänzt.
- **CHECK:** Probe vor Fix: 1× Enter → 2 Klicks; nach Fix: genau 1. Smoke-Schritt „Enter auf .clickable löst genau einmal aus" (18 → 19/19). Browser-Audit (alle 4 a11y-Prüfungen) weiterhin sauber — das bestehende System erfüllt sie. 282 Tests grün, Guards 0.

### Cycle #102 — 2026-07-20 — Echter Bug behoben: Direktnachricht wurde bei Enter DOPPELT gesendet
- **THINK:** Beim Durchsehen des DM-Codes fielen ZWEI keydown-Handler auf `#dmbody` auf (`onkeydown` + `addEventListener`), beide riefen `send()`. Reproduziert: eine per Enter gesendete Nachricht kam **zweimal** an (das zweite `send()` liest das Feld, bevor das erste `await` es leert).
- **WORK:** Redundanten zweiten Handler entfernt (nur `onkeydown` mit Shift-Enter-Ausnahme bleibt). Zusätzlich `send()` gehärtet: Text erst erfassen, Feld sofort leeren (ein paralleler Aufruf liest leer → bricht ab), bei Fehler Text wiederherstellen. Smoke-Guard ergänzt.
- **CHECK:** Repro vor dem Fix: 2 Nachrichten; nach dem Fix: genau 1. Smoke-Schritt 8 „Enter sendet genau eine Nachricht" (Empfänger+Thread per API, Senden im Browser) → 17 → 18/18 grün. 282 Tests grün, Guards 0.

### Cycle #101 — 2026-07-20 — Übergreifende Suche im Smoke-Test abgesichert
- **THINK:** Screenshot-Review bestätigte: die modulübergreifende Suche (Personen/Beiträge/Engpässe/Preise/Rabatte/Austausch, mit Wirkstoff-Schnellchips) funktioniert einwandfrei — hatte aber KEINEN Frontend-Guard. Eine der wertvollsten Funktionen der App war ungeschützt gegen stille Regression.
- **WORK:** Smoke-Schritt: „Amoxicillin" suchen → Ergebnis-Kopf erscheint, ≥2 Trefferkarten, Wirkstoff-Schnellchip vorhanden; danach „zurück" in den Feed (Folgeschritte laufen weiter).
- **CHECK:** Smoke 16 → 17/17 grün (Such-Schritt + unveränderte Folgeschritte), 282 Tests grün, Browser-Audit sauber, Guards 0.

### Cycle #100 — 2026-07-20 — Entwurf-Schutz: halbfertige Beiträge überstehen Neuladen/Weg-Navigieren
- **THINK:** Zielgruppe ist zeitknapp und wird oft unterbrochen. Wer einen längeren Beitrag/eine Fachfrage tippt und versehentlich neu lädt oder weg-navigiert, verliert alles — echter Datenverlust-Frust ohne jeden Schutz.
- **WORK:** Der Beitrags-Composer (`#pb`) sichert seinen Text pro Konto in `localStorage`. Beim Öffnen wird ein vorhandener Entwurf wiederhergestellt und dezent angezeigt („✎ Entwurf wiederhergestellt · verwerfen"); eigenes Tippen ersetzt den Hinweis, „verwerfen" leert ihn, erfolgreiches Posten löscht ihn. i18n `dr_restored`/`dr_discard` (DE/EN/PT).
- **CHECK:** Echter Browser: Text tippen → Reload → Entwurf + Hinweis wieder da; „verwerfen" → leer, Hinweis weg, localStorage leer; nach Posten+Reload → leer; 0 JS-Fehler. 282 Tests grün, Parität 700/700/700, Smoke 16/16, Guards 0.

### Cycle #99 — 2026-07-20 — Weicher Zeichenzähler an den Composern (kein „zu lang"-Fehler nach dem Absenden)
- **THINK:** Beitrag/News haben 1000-Zeichen-Limit, aber Feedback kam erst als Server-Fehler NACH „Posten". Für längere Fragen/News frustrierend — man merkt zu spät, dass gekürzt werden muss.
- **WORK:** Wiederverwendbarer `attachCharCounter(input, max)`: erscheint dezent erst ab 80 % (nicht ablenkend), zeigt „noch {n} Zeichen", wird bei Überschreitung rot „{n} Zeichen zu viel" (`aria-live` für Screenreader). An Beitrags- (`#pb`) und News-Composer (`#nb`) gehängt; Server erzwingt die Grenze weiterhin. i18n `cc_remaining`/`cc_over` (DE/EN/PT).
- **CHECK:** Echter Browser: kurz → kein Zähler; 850 Z. → „noch 150 Zeichen"; 1005 Z. → „5 Zeichen zu viel" (rot); 0 JS-Fehler. 282 Tests grün, Parität 698/698/698, Smoke 16/16, Guards 0.

### Cycle #98 — 2026-07-20 — a11y-Sicherheitsnetz verstärkt: JEDES onclick-Element muss tastaturbedienbar sein
- **THINK:** In #96/#97 waren interaktive `<div>`+`onclick` OHNE `.clickable` das Problem — der `.clickable`-Guard erfasste sie nicht. Statt sie einzeln zu finden: systematisch prüfen. Ein Probe-Durchlauf über alle 8 Reiter + Detail zeigte **0** solche Elemente (aktuelle Screens sind sauber) — also fehlt nur der dauerhafte Guard.
- **WORK:** Browser-Audit erweitert: `el.onclick`-Handler sind zur Laufzeit lesbar → jedes Nicht-Button-Element mit onclick, das `tabindex`+`role` fehlt, wird gemeldet (umfassender als der `.clickable`-Guard, fängt auch nicht-`.clickable` Interaktionen).
- **CHECK:** Probe bestätigt 0 Verstöße auf allen Reitern; Guard hat Zähne (ein `<div onclick>` ohne Tastaturzugang schlägt an, da der #94-Mechanismus nur `.clickable` versorgt). 282 Tests grün, Browser-Audit (mit neuer 4. a11y-Prüfung) sauber, Smoke 16/16, Guards 0.

### Cycle #97 — 2026-07-20 — „Kritische Engpässe"-Liste auf der Startseite ist klick-/tastaturbedienbar
- **THINK:** Screenshot-Rundgang (Preise/Rabatte/Biete/News/Detail alle sauber): Auf „Für dich" listet die Karte „🔴 Kritische Engpässe" die Top-3-Wirkstoffe — aber als reiner Text. Eine zeitknappe Apotheker:in sieht „Amoxicillin kritisch" und will tippen, um Details/Angebote zu sehen; nichts passierte (nur „Alle ansehen" führte weiter).
- **WORK:** Jeder Listeneintrag ist jetzt `.clickable` (tabindex+role via zentralem a11y-Mechanismus) mit grünem „›"-Chevron und öffnet per Klick/Enter direkt das Wirkstoff-Detail (`openWirkstoff`).
- **CHECK:** Echter Browser: Eintrag „Amoxicillin" trägt `tabindex=0`/`role=button`, Fokus + Enter öffnet das Detail (zeigt „Amoxicillin"/Engpass-Status), 0 JS-Fehler. 282 Tests grün, Browser-Audit sauber, Smoke 16/16, Guards 0.

### Cycle #96 — 2026-07-20 — Übersichts-Kacheln: klar als Buttons erkennbar + tastaturbedienbar (Screenshot-Review)
- **THINK:** Screenshot-Rundgang (Hell/Dunkel × Desktop/Mobil): die Kennzahl-Kacheln auf „Für dich" (z. B. „3 kritische Engpässe") sind Navigations-Shortcuts, sahen aber passiv aus (schwache Affordanz). Schwerwiegender: `<div>`+`onclick` OHNE `.clickable` → mein #94-Tastaturmechanismus erreichte sie NICHT; die wichtigsten Sprungziele der Startseite waren nicht tastaturbedienbar (und rutschten am Audit vorbei).
- **WORK:** Kacheln als `.ovtile clickable` (tabindex+role via zentralem a11y-Mechanismus, Enter/Space löst aus), sichtbare Affordanz: grüner „›"-Chevron je Kachel + Hover/Fokus-Rahmen wird grün (ohne Link-Unterstreichung). Kachel-Optik von Inline-Styles in die `.ovtile`-Klasse überführt.
- **CHECK:** Screenshots (Hell/Dunkel, Desktop/Mobil): Chevron sichtbar, Karten-Optik erhalten. Browser-Audit (prüft `.clickable` auf Tastaturbedienbarkeit) bestätigt jetzt auch die Kacheln. 282 Tests grün, Smoke 16/16, Guards 0.

### Cycle #95 — 2026-07-20 — a11y-Folgefehler behoben: keine verschachtelten Klick-Elemente in der Repost-Einbettung
- **THINK:** Die Tastatur-Bedienbarkeit aus #94 machte jedes `.clickable` zu `role=button`. Die Repost-Einbettung ist selbst `.clickable`, enthielt aber über `linkifyMentions` @-Mentions/#Hashtags als eigene `.clickable`-Spans → nach #94 „Button im Button" (ungültiges ARIA). Ehrliche Selbstkontrolle der letzten Änderung.
- **WORK:** Die Einbettung rendert den Vorschau-Text jetzt als reinen Text (`esc`, kein `linkifyMentions`) — die ganze Karte bleibt EIN anklickbares/tastaturbedienbares Element ohne verschachtelte Interaktionen. Das Original behält seine klickbaren Mention-Links. Browser-Audit um die Prüfung „verschachtelte Klick-Elemente (`.clickable .clickable`)" erweitert.
- **CHECK:** Echter Browser: Repost eines Beitrags mit @Mention + #Hashtag → Einbettung hat 0 verschachtelte Klick-Elemente, bleibt `role=button`/`tabindex=0`, Original behält Mention-Links; 0 JS-Fehler. 282 Tests grün, Audit sauber, Smoke 16/16, Guards 0.

### Cycle #94 — 2026-07-20 — Barrierefreiheit: anklickbare Elemente per Tastatur bedienbar
- **THINK:** 34 `.clickable`-Elemente (Autor-Namen, Wirkstoffe, Repost-Einbettung …) sind Spans/Divs mit `onclick` — für Tastatur-/Screenreader-Nutzer:innen unerreichbar (kein Fokus, kein Enter/Space). Für eine Fachplattform mit Sorgfaltsanspruch eine echte Lücke; die Browser-Audit-a11y-Prüfung erfasste sie bisher nicht.
- **WORK:** Ein zentraler Mechanismus (MutationObserver + delegierter keydown) versorgt alle aktuellen UND künftig gerenderten `.clickable`-Nicht-Buttons mit `tabindex=0`+`role=button` und löst bei Enter/Leertaste den Klick aus — ohne 34 Einzelstellen anzufassen. Browser-Audit um die Prüfung „anklickbar, aber nicht tastaturbedienbar" erweitert (guard mit Zähnen: ohne den Fix schlägt sie an).
- **CHECK:** Echter Browser: `.clickable[data-openprofile]` trägt `tabindex=0`/`role=button`, Fokus + Enter öffnet das Profil, 0 JS-Fehler. 282 Tests grün, Browser-Audit (inkl. neuer Prüfung) sauber, Smoke 16/16, Guards 0.

### Cycle #93 — 2026-07-20 — Eigene Entscheidung hinterfragt: Umfrage-Optionen entfernbar
- **THINK:** In #82 hatte der Umfrage-Composer nur „+ Option hinzufügen", aber kein Entfernen — wer versehentlich eine Option zu viel anlegt, bleibt mit einem leeren Feld hängen. Für zeitknappe Nutzer:innen schlechte Bedienung; eine selbst getroffene Entscheidung zum Nachbessern.
- **WORK:** Je Optionsfeld ein ✕-Button (nur wenn > 2 Optionen — das Minimum bleibt geschützt), Klick entfernt genau diese Zeile und erhält die übrigen Eingaben; `aria-label`/`title` `co_poll_del` (DE/EN/PT).
- **CHECK:** Echter Browser (1280): bei 2 Optionen kein ✕ (Minimum), nach 2× Hinzufügen 4 Felder mit ✕, „Opt2" entfernt → 3 Felder mit „Opt1/Opt3/Opt4" (Werte erhalten), 0 JS-Fehler. 282 Tests grün, Parität 696/696/696, Smoke 16/16, Guards 0.

### Cycle #92 — 2026-07-20 — Repost: Umschalter (kein Doppel-Teilen) + sichtbarer Zähler
- **THINK:** #90 erlaubte, denselben Beitrag mehrfach zu teilen (Spam) und zeigte keine Traktion. Beides schwächt das Feature.
- **WORK:** Repo `countReposts`/`findUserRepost`; `repost()` ist jetzt ein Umschalter (erneut = Teilen zurücknehmen, kein Doppel). `decorate` liefert `repost_count` + `reposted_by_me` (auf das Original bezogen, auch bei Repost-Karten). Frontend: Button spiegelt den Zustand (aktiv „🔁 Geteilt" + Zähler, `aria-pressed`), Ein-Klick schaltet um. Rückgabe vereinheitlicht `{reposted, post}`.
- **CHECK:** 281 → 282 grün (+1 Umschalt-Test; HTTP-Test um Toggle erweitert), Parität 695/695/695, Smoke 16/16, Guards 0.

### Cycle #91 — 2026-07-20 — Repost testgesichert (HTTP-Route + Smoke-Composer)
- **THINK:** #90 lieferte Repost mit Service-Tests; nach dem bewährten Muster (Polls #83→#84→#85) fehlten noch der HTTP-Wiring-Test und der Frontend-Smoke-Guard.
- **WORK:** HTTP-Test (`http-integration`): teilen → 200/`kind:repost`/`repost_of`, Original im `/api/feed/public` eingebettet, Original-Autor bekommt `repost`-Benachrichtigung, Repost eines gelöschten Originals → 400 `post_not_found`. Smoke-Schritt: fremden Beitrag über `[data-repost]` teilen → `.repost-embed` erscheint.
- **CHECK:** 280 → 281 grün (+1 HTTP), Smoke 15 → 16/16, Browser-Audit sauber, Guards 0.

### Cycle #90 — 2026-07-20 — Social: Beiträge im Feed teilen (Repost)
- **THINK:** Der „Teilen"-Button kopierte nur einen Link — echtes „Facebook für Apotheker" braucht das Weiterreichen an die eigenen Follower (z. B. eine Engpass-Warnung verstärken). Klassisches Repost-Feature, voll in-constraint.
- **WORK:** `repost_of`-Feld am Post; Service `repost(actor, postId)` (Sichtbarkeit geprüft, Repost-eines-Reposts auf Original geflacht, benachrichtigt Original-Autor:in, nie sich selbst); Enrichment `repost_of_post` bettet das dekorierte Original ein (oder `{deleted:true}`). Route `POST /api/posts/:id/repost`. Frontend: Ein-Klick „🔁 Teilen im Feed"-Button (nur bei fremden Beiträgen), Repost-Karte mit „hat einen Beitrag geteilt" + eingebettetem, anklickbarem Original; i18n DE/EN/PT, 🔁-Benachrichtigungs-Icon, theme-aware CSS.
- **CHECK:** 274 → 280 grün (+6 Service-Tests: Einbettung, Flachung, Benachrichtigung, Sichtbarkeit, gelöschtes Original), Parität 694/694/694, Smoke 15/15, Guards 0. Browser (Hell+Dunkel): Repost per UI erstellt, Original eingebettet, 0 JS-Fehler.

### Cycle #89 — 2026-07-20 — Social-Login-Fundament (OAuth, provider-agnostisch, env-gated) + Design-Doc
- **THINK:** OAuth braucht zwingend externe Anbieter + Secrets (Spannung zum „nur Built-ins"-Constraint). Statt toter Gerüste: den provider-AGNOSTISCHEN Kern voll bauen + testen (Fake-Provider), Provider-Kommunikation hinter injizierbarem Adapter, aktiv nur mit ENV-Zugangsdaten. Nebenbei entdeckt & behoben: `/api/me` gab den Passwort-Hash preis.
- **WORK:** Datenmodell `identities` (link/find/list/unlink, Persistenz-Roundtrip, DSGVO-Purge). `src/services/oauth.js`: `loginOrRegister` (Identität→Login / E-Mail→Kopplung / sonst neues Konto+Profil+Handle), `configuredProviders`, `authorizeUrl`, `linkedIdentities`/`unlink`; Google-Adapter (`authorizeUrl` + `exchange`, `fetch` injizierbar). Endpunkte `/api/auth/providers` (mit Authorize-URL), `/api/auth/oauth/:provider`, `/api/auth/identities[/:p/unlink]`. **Sicherheit:** `safeUser()` entfernt Passwort-/2FA-/Recovery-Hashes aus `/api/me` + OAuth-Antwort. Frontend: dormante „Anmelden mit …"-Buttons (nur bei konfiguriertem Provider) + OAuth-Callback-Handling; i18n `au_or`/`au_oauth_with`. `docs/SOCIAL_LOGIN.md` (Modell, Fluss, Provider-Vertrag, Aktivierung, offene Härtung).
- **CHECK:** 262 → 274 grün (+10 Service/Adapter-Unit inkl. gemocktem Google-`exchange`, +2 HTTP inkl. Hash-Leak-Regression), Parität 688/688/688, Smoke 15/15 (Auth-Flow bestätigt dormante OAuth-Render ohne JS-Fehler), Guards 0.

### Cycle #88 — 2026-07-20 — Passwort-Reset per Wiederherstellungscodes (ohne E-Mail-Dienst)
- **THINK:** „Passwort vergessen" fehlte komplett — Nutzer:innen waren bei Passwortverlust ausgesperrt. Der klassische E-Mail-Link-Weg braucht einen externen Anbieter (verletzt „nur Built-ins"). Sichere, vollständig eigenständige Alternative: Einmal-Wiederherstellungscodes (wie 2FA-Backup-Codes).
- **WORK:** `src/domain/recoveryCodes.js` (8 Codes, verwechslungsarmes Alphabet, scrypt-Hashes, konstante-Zeit-Match). Registrierung erzeugt Codes und zeigt sie EINMAL (nur Hashes gespeichert). `POST /api/password/reset` (E-Mail+Code+neues PW, rate-limitiert, generischer Fehler gegen Enumeration, Code einmalig gültig). Eingeloggt: verbleibende Codes anzeigen + neu erzeugen (`/api/recovery-codes[/regenerate]`). Frontend: Codes-Screen nach Registrierung (Kopieren/Download/Weiter), „Passwort vergessen?"-Link → Reset-Screen, Konto-Sektion mit Rest-Anzahl + Neu-Erzeugung; i18n DE/EN/PT.
- **CHECK:** 254 → 262 grün (+7 Domain/Service-Unit, +1 HTTP-End-to-End), Parität 686/686/686, Smoke 15/15, Guards 0. Echter Browser (1280): Registrierung → Codes-Screen (8 Codes, Screenshot), Ausloggen → „Passwort vergessen" → Reset mit Code → Login mit neuem Passwort, 0 JS-Fehler.

### Cycle #87 — 2026-07-20 — Social: Umfrage-Abstimmung benachrichtigt die Autor:in
- **THINK:** Umfragen liefen still — die Ersteller:in erfuhr nichts von Engagement. „Facebook für Apotheker" lebt von Rückkopplung; eine Abstimm-Benachrichtigung schließt die Umfrage-Schleife.
- **WORK:** `votePoll` benachrichtigt die Autor:in (`poll_vote`) — aber nur bei einer **neuen** Stimme (nicht bei Wechsel/Rückzug), nie sich selbst (spamfrei). Frontend: Verb `nv_poll_vote` (DE/EN/PT) + 📊-Icon; Klick springt über den bestehenden `post_id`-Pfad zum Beitrag.
- **CHECK:** 253 → 254 grün (+1 Service-Test: neue Stimme → 1 Benachrichtigung, Wechsel → keine zweite, Rückzug+neu → wieder eine, Selbst-Stimme → keine), Parität 665/665/665, Smoke 15/15, Guards 0.

### Cycle #86 — 2026-07-20 — Login-Brute-Force-Schutz (Rate-Limiting, in-memory)
- **THINK:** Der Login hatte keinerlei Bremse gegen automatisiertes Passwort-Raten — die einzige echte Sicherheitslücke im Auth-Fluss. Lösbar ohne externen Dienst (Constraint: nur Built-ins).
- **WORK:** `src/domain/rateLimiter.js` (gleitendes Zeitfenster, `check`/`fail`/`reset`); Login sperrt nach 5 Fehlversuchen je (IP+E-Mail) für 15 min → 429 `too_many_attempts` (+`retry_after_s` fürs Frontend), erfolgreicher Login setzt zurück. Client-IP aus `x-forwarded-for` (Render-Proxy). i18n `e_too_many_attempts` (DE/EN/PT).
- **CHECK:** 248 → 253 grün (+4 Limiter-Unit, +1 HTTP-Lockout), Parität 664/664/664, Smoke 15/15, Guards 0. HTTP-Test belegt: 5×401 → 429 (auch mit richtigem Passwort gesperrt), anderes Konto unbetroffen.

### Cycle #85 — 2026-07-20 — Smoke-Test schützt den Umfrage-Composer (Frontend-Guard)
- **THINK:** #83/#84 sichern das Backend; die Composer-UI (📊-Toggle, dynamische Optionsfelder, Abstimm-Klick im Feed) war nur einmal manuell im Browser geprüft. Muster #81: Smoke schützt Headline-Features gegen stille Frontend-Regression.
- **WORK:** 2 Smoke-Schritte in `loop-smoke.mjs`: Umfrage über den echten Composer anlegen (Toggle zeigt Box, 3. Option per „+"-Button, Posten) → Umfrage mit 3 `.poll-opt` erscheint im Feed; Klick auf eine Option → `aria-pressed="true"` (eigene Stimme markiert).
- **CHECK:** Smoke 13 → 15/15 grün, 248 Tests grün, Browser-Audit sauber, alle Guards 0.

### Cycle #84 — 2026-07-20 — Umfrage-Route über HTTP getestet (Wiring/Auth/Fehlercodes)
- **THINK:** #83 sicherte die Service-Ebene, aber die HTTP-Route `POST /api/polls/:id/vote`, die Feed-Anreicherung über den echten Server und die Auth-Pflicht waren ungetestet — genau das Muster aus #67–#78 („X über HTTP getestet").
- **WORK:** Test in `http-integration.test.js`: Umfrage per POST /api/posts anlegen, über die dedizierte Vote-Route abstimmen (Tally 200), Anreicherung im `/api/feed/public` (my_vote aus Betrachtersicht), Stimme zurückziehen, Fehlercodes `poll_not_a_poll`/`poll_bad_option`/`poll_options_missing` (400), Abstimmen ohne Token → 401.
- **CHECK:** 247 → 248 grün (+1 HTTP-Test), Smoke 13/13, Browser-Audit sauber, alle Guards 0.

### Cycle #83 — 2026-07-20 — Umfragen dauerhaft testgesichert (9 Regressionstests)
- **THINK:** Cycle #82 lieferte die Umfragen, war aber nur manuell (Browser/API) verifiziert — ohne permanenten Guard bricht das Feature still bei künftigen Änderungen. Muster aus #67–#81: neues Feature → dauerhafter Test.
- **WORK:** `test/poll.test.js` (Service-Ebene wie `social.test.js`): Optionen-Normalisierung + 6er-Kappung, Validierung (Frage/≥2 Optionen), Abstimmen/Zähler, Stimme-ändern hält Summe stabil, Stimme-zurückziehen, `poll_not_a_poll`/`poll_bad_option`, Feed-Enrichment (counts/total/my_vote, poll:null bei Nicht-Umfragen), Persistenz-Roundtrip, purgeUser entfernt eigene Stimmen.
- **CHECK:** 238 → 247 grün (+9), Parität 663/663/663, Smoke 13/13, Browser-Audit sauber, alle Guards 0.

### Cycle #82 — 2026-07-20 — Roadmap Phase 2: Umfragen („Facebook für Apotheker")
- **THINK:** Der Feed konnte Beiträge und Fachfragen, aber keine schnelle Meinungsabfrage — für zeitknappe Apotheker:innen ist „kurz abstimmen" (Welcher Wirkstoff ist bei euch knapp?) niedrigschwelliger als ein Kommentar. Erstes echtes Social-Feature aus dem Architektur-Dossier.
- **WORK:** Voller Stack — Repo (`pollVotes`-Map, `setPollVote`/`pollTally`, Persistenz-Roundtrip + purgeUser), Service (`createPost` validiert Umfragen: Frage nötig, ≥2 Optionen; `votePoll` mit Stimme-ändern/-zurückziehen; Enrichment liefert `counts/total/my_vote`), Route `POST /api/polls/:id/vote`, Frontend-Composer (📊-Umfrage-Toggle mit dynamischen Optionsfeldern 2–6, gegenseitig exklusiv zur Fachfrage) + `pollHtml`-Ergebnisbalken, i18n (co_poll*/pl_*, 4 Fehlercodes; DE/EN/PT), theme-aware CSS.
- **CHECK:** Real im Browser (1280): Umfrage per UI erstellt (3 Optionen), abgestimmt → `aria-pressed`, 100 %-Balken, „✓ deine Stimme", „1 Stimme"; Ergebnis-Karte in Hell **und** Dunkel geprüft (hoher Kontrast, Klartext). 238 grün, Parität 663/663/663, Smoke 13/13, Browser-Audit sauber, alle statischen Guards 0.

### Cycle #81 — 2026-07-18 — Smoke-Test schützt den nicht-destruktiven Switcher
- **WORK:** 2 Smoke-Schritte: fremdes Land besuchen → Besuchs-Kontext erscheint (Switcher=GB, Heimat bleibt); „Zurück" beendet den Besuch.
- **CHECK:** Smoke 11 → 13/13 grün. Das Headline-Feature „Land = Sicht" ist damit gegen stille Regression gesichert.

### Cycle #80 — 2026-07-18 — Roadmap Phase 1: nicht-destruktiver Länder-Switcher („Land = Sicht")
- **THINK:** Der bisherige Switcher schrieb bei jedem Wechsel das PROFIL-Land um — die Vision will aber „Account bleibt derselbe, nur die Inhalte wechseln". Backend unterstützt das schon via `?country=` / `activeCountry()`.
- **WORK:** Client-Zustand `ACTIVE_COUNTRY` + `viewCountry()`; Switcher setzt nur die Besuchs-Ansicht (kein Profil-Write), Sprache folgt dem besuchten Land, `?country=` an feed/public (×2) + news angehängt. Sichtbarer Info-Balken „Du besuchst {Land}" + 1-Klick-Zurück; i18n (vc_visiting/vc_back, DE/EN/PT); theme-aware CSS (Info-Blau, nicht Rot/Orange).
- **CHECK:** Real: AT-Konto → GB besuchen zeigt GB-Beiträge in EN, ATMARK verschwindet, **Heimatland bleibt AT**, Zurück-Button stellt DE/AT wieder her; 0 JS-Fehler; 238 grün, Parität 650/650/650, Smoke 11/11, Browser-Audit sauber.

### Cycle #79 — 2026-07-18 — Roadmap Phase 1: 4 fehlende Länder ergänzt (12 → 16)
- **THINK:** Aus der Ziel-Matrix des Architektur-Dossiers fehlten Liechtenstein (de) sowie Kanada, Australien, Südafrika (en) — „ein Land = ein Objekt".
- **WORK:** 4 Einträge in `COUNTRIES` (Flagge, Sprache, Währung, Zeitzone, Regulator: Amt für Gesundheit / Health Canada / TGA / SAHPRA). Deutschsprachige Gruppe damit komplett (AT·DE·CH·LI). Tests selbstkonsistent gemacht (API == Register, statt hartkodierter 12) + die 4 Neuen geprüft; Smoke vergleicht gegen API-Anzahl.
- **CHECK:** Landing rendert 16 Länder sauber (Reihenfolge korrekt, kein Overflow); 238 grün, Smoke „16/16", Browser-Audit sauber.

### Cycle #78 — 2026-07-18 — Login-Sicherheit: keine E-Mail-Enumeration (verifiziert + getestet)
- **CHECK (Sicherheit):** Login liefert für unbekannte E-Mail und falsches Passwort die IDENTISCHE Antwort (401, „E-Mail oder Passwort falsch.", login_failed) — Angreifer können gültige E-Mails nicht erkennen. Korrekt implementiert.
- **WORK:** HTTP-Test sichert diese subtile Eigenschaft gegen Regression (falls jemand „Nutzer nicht gefunden" ergänzt).
- **CHECK:** 237 → 238 grün.

### Cycle #77 — 2026-07-18 — Bild-Fehler mehrsprachig (image_invalid/image_too_large) — Backend-i18n komplett
- **THINK:** Letzte code-losen deutschen Fehler auf erreichbaren Pfaden (Bild-Upload beim Posten/Austausch): `media.js` warf Format-/Größen-Fehler ohne Code.
- **WORK:** `e.code = 'image_invalid'`/`'image_too_large'`; Keys in DE/EN/PT. Damit sind alle erreichbaren Backend-Fehler (Service + Repo + Domain) mehrsprachig.
- **CHECK:** code image_invalid real (lehnt auch Nicht-Bild-data-URI ab); Parität 648/648/648; 237 grün.

### Cycle #76 — 2026-07-18 — Registrierungs-Passwortfehler mehrsprachig (pw_too_short)
- **THINK:** `hashPassword` (bei Registrierung) warf den „mind. 8 Zeichen"-Fehler ohne Code (nur changePassword hatte new_pw_short) → EN/PT sahen Deutsch bei zu kurzem Passwort. Passwort-Policy selbst ist konsistent (Registrierung & Änderung fordern 8).
- **WORK:** `e.code = 'pw_too_short'` in password.js; `e_pw_too_short`-Keys (DE/EN/PT); HTTP-Test-Assertion.
- **CHECK:** code pw_too_short real; Parität 646/646/646; 237 grün.

### Cycle #75 — 2026-07-18 — Doppelte-E-Mail-Fehler mehrsprachig (email_taken)
- **THINK:** Doppelte Registrierung: Handle-Fehler hatte `handle_taken` (übersetzbar), der E-Mail-Fehler aber keinen Code → EN/PT sahen Deutsch bei einem häufigen Registrierungsfehler.
- **WORK:** memoryRepo setzt jetzt `e.code = 'email_taken'`; `e_email_taken`-Keys (DE/EN/PT). HTTP-Test um email_taken-Assertion ergänzt.
- **CHECK:** code email_taken real; Parität 645/645/645; 237 grün.

### Cycle #74 — 2026-07-18 — DM-Privatsphäre über HTTP getestet
- **CHECK (Sicherheit):** Dritte:r kann einen fremden A↔B-Thread weder lesen (403, kein Nachrichten-Leak) noch beschreiben (403). Privatsphäre sensibler Direktnachrichten korrekt.
- **WORK:** HTTP-Test für DM-Isolation gegen Dritte.
- **CHECK:** 236 → 237 grün.

### Cycle #73 — 2026-07-18 — Sichtbarkeit/Privatsphäre über HTTP getestet
- **CHECK:** Selbst-Folgen → 400 abgelehnt. „Nur Follower"-Beitrag: Follower sieht ihn, Nicht-Follower weder im Home- noch im öffentlichen Feed (Privatsphäre-Isolation korrekt).
- **WORK:** HTTP-Test für Selbst-Follow-Ablehnung + followers-only-Sichtbarkeit (positiv + zwei negative).
- **CHECK:** 235 → 236 grün.

### Cycle #72 — 2026-07-18 — Autorisierung (fremde vs. eigene Inhalte) über HTTP getestet
- **CHECK (Sicherheit):** Fremde:r kann Beitrag/Kommentar NICHT bearbeiten/löschen (alle 4 Aktionen → 403), Inhalt bleibt unangetastet; Eigentümer:in darf beides. Kein Loch.
- **WORK:** HTTP-Test für Cross-User-Autorisierung (Negativ + Positiv).
- **CHECK:** 234 → 235 grün.

### Cycle #71 — 2026-07-18 — Reaktionen (Toggle + Zähler) über HTTP getestet
- **CHECK:** Reaktion real: setzen → my_reaction='hilfreich' + reaction_counts.hilfreich=1; erneut → my_reaction=null + Zähler=0. Kein Defekt.
- **WORK:** HTTP-Test für Reaktions-Toggle mit Zähler-Prüfung via GET /api/posts/:id.
- **CHECK:** 233 → 234 grün. (Damit sind auch die letzten Kern-Interaktionen — Reaktion/Kommentar-Threading — HTTP-abgedeckt.)

### Cycle #70 — 2026-07-18 — Kommentar-Antworten (Threading) über HTTP getestet
- **CHECK:** Antwort auf Kommentar (parentCommentId) real: Antwort trägt korrekt parent_comment_id, erscheint threaded in der Liste.
- **WORK:** HTTP-Test für Threading.
- **CHECK:** 232 → 233 grün.

### Cycle #69 — 2026-07-18 — Persistenz-Integration mit echten Daten getestet (Daten-Verlust-Schutz)
- **CHECK:** Voller Server-Restart-Roundtrip manuell verifiziert (Beitrag überlebt Neustart). Lücke: die Repo-`__dump`/`__load` mit echten Daten (statt generischem Snapshot) waren ungetestet.
- **WORK:** Persistenz-Integrationstest: echte Social-Daten (Nutzer/Profil/Beitrag/Follow/Bookmark) → `__dump` → JSON → `__load` in FRISCHE Repos → alles intakt. Fängt Feld-Verluste in einzelnen Repos.
- **CHECK:** 231 → 232 grün. (Frühere rote Läufe = Test-API-Verwechslungen, kein App-Bug.)

### Cycle #68 — 2026-07-18 — Fachfrage/beste Antwort über HTTP getestet
- **CHECK:** Q&A-Kernmechanik real: Frage (kind=frage) → Antwort (Kommentar) → nur Fragesteller:in darf beste Antwort setzen (sonst 403), dann accepted_comment_id gesetzt. Kein Defekt.
- **WORK:** HTTP-Test inkl. Autor-Gate (403 für Fremde).
- **CHECK:** 230 → 231 grün.

### Cycle #67 — 2026-07-18 — Verifizierungs-Flow über HTTP getestet
- **CHECK:** Fluss real: beantragen → Queue (nur Mods, sonst 403) → Redaktion genehmigt → Profil verifiziert. Kein Defekt (Antrag ist per user_id referenziert, nicht per eigener id — API-Eigenheit, kein Bug).
- **WORK:** HTTP-Test für request → mod-gated queue → resolve(approve) → profile.verified.
- **CHECK:** 229 → 230 grün.

### Cycle #66 — 2026-07-18 — Moderations-Flow über HTTP getestet
- **CHECK:** Sicherheitsrelevanter Fluss real: melden → Queue (nur Mods, sonst 403) → Redaktion löst mit Entfernen auf → Beitrag verschwindet aus dem Feed + aus der offenen Queue. Kein Defekt.
- **WORK:** HTTP-Test nutzt das Seed-Redaktionskonto (Test-Setup) als Moderator; deckt Melden, Mod-Gating, Auflösen+Entfernen ab.
- **CHECK:** 228 → 229 grün.

### Cycle #65 — 2026-07-18 — Konto-Löschung (DSGVO Art. 17) + Auth-Bug behoben
- **CHECK:** Löschfluss real: falsches PW→401, korrektes→200, Daten ge-purge-t. Dabei echten Bug gefunden: nach Löschung dekodierte der Token weiter zu einer userId → Auth-Guard ließ durch → 400 (Folgefehler) statt sauberem 401.
- **WORK:** Auth-Guard prüft jetzt Nutzer-Existenz (`repo.getUserById`) — Token für gelöschte/nicht existente Nutzer → 401 `not_authenticated` (sauberer Logout-Redirect via #54). HTTP-Test für den kompletten Löschfluss inkl. Token-Entwertung + Beitrags-Purge.
- **CHECK:** Token nach Löschung real 401 not_authenticated; 227 → 228 grün, `verify` komplett grün.

### Cycle #64 — 2026-07-18 — Profilseite verifiziert + DSGVO-Export getestet
- **CHECK:** Profil-/Konto-Seite visuell geprüft — professionell & vollständig: Verifizierung beantragen, DSGVO-Datenexport, Passwort ändern, Konto löschen (rot/unwiderruflich). Kein Defekt.
- **WORK:** HTTP-Test für `/api/me/export` (Auskunftsrecht Art. 15/20): Struktur vollständig (profile/posts/comments/bookmarks/DMs/exchange) + eigener Beitrag enthalten.
- **CHECK:** 226 → 227 grün.

### Cycle #63 — 2026-07-18 — i18n exhaustiv verifiziert (auch Modals/Overlays)
- **CHECK:** Dynamischen Deutsch-Leck-Scan (EN) auf die bisher un-getriggerten Zustände ausgeweitet: Profilseite (Bearbeiten-Formular + Konto-Einstellungen/Passwort/Löschen), Willkommens-Modal, DM-Ansicht — **0 Lecks** (Text + Platzhalter).
- **Ergebnis:** i18n gilt jetzt als erschöpfend geprüft: 8 Reiter (EN+PT) + alle Modals/Overlays (EN) + 4 statische Wächter (0). Merknotiz für Folge-Sessions: nicht erneut prüfen, nur bei neuen dynamischen Zuständen.

### Cycle #62 — 2026-07-18 — Wächter fängt jetzt umlautloses Deutsch (Ternäre) + 2. Bug gefunden
- **THINK:** Der #61-Bug (umlautloses Deutsch in Ternär-Zuweisung) zeigte eine Blindstelle im JS-DE-Wächter.
- **WORK:** Detektor betrachtet jetzt den GANZEN Ausdruck bis `;` (auch `a?'X':'Y'`), löst t()/ti()/getAttribute() heraus und meldet UI-Text-Literale (Großbuchstabe/Leerzeichen/Nicht-ASCII). Fand prompt einen 2. echten Bug: Merkliste-Toggle setzte „🔖 gemerkt"/„🔖 Merken" hart → jetzt `t('pc_saved')`/`t('pc_save')`.
- **CHECK:** EN real „🔖 saved"; Detektor fängt alle 4 Ternär-Strings, keine `data-i18n`-Fehlalarme; 0 ✓; 226 grün, Smoke 11/11.

### Cycle #61 — 2026-07-18 — Teilen-Button auf Engpass-Listenkarten + i18n-Bug (Beobachten-Toggle)
- **THINK:** Teilen gab es auf Posts + Wirkstoff-Detail, aber NICHT auf den Engpass-Listenkarten — man musste erst reinklicken, um einen kritischen Engpass an Kolleg:innen zu teilen.
- **WORK:** „🔗 Teilen"-Button auf Listenkarten (Deep-Link `?wirkstoff=`, wie Detailseite). Dabei echten i18n-Bug gefunden & behoben: der Beobachten-Toggle setzte den Button-Text hart deutsch („⭐ Beobachtet") — rutschte durch beide Wächter (keine Umlaute).
- **CHECK:** EN real: Teilen-Button vorhanden, Toggle-Label „⭐ Watched"; Parität 644/644/644; 226 grün, Smoke 11/11, Browser-Audit grün.

### Cycle #60 — 2026-07-18 — Merkliste (Bookmarks) über HTTP getestet
- **CHECK:** Merk-Fluss real via API: merken → erscheint in Merkliste + ids → erneutes Tippen entfernt (Toggle).
- **WORK:** HTTP-Integrationstest für bookmark → /bookmarks + /bookmarks/ids → un-toggle.
- **CHECK:** 225 → 226 grün.

### Cycle #59 — 2026-07-18 — Engpass-Bestätigung über HTTP getestet (rundet Frühwarnnetz ab)
- **CHECK:** Sicherheitsrelevanter Fluss „Auch bei uns" real via API: Bestätigung erhöht Zähler + benachrichtigt den Melder (shortage_confirm).
- **WORK:** HTTP-Integrationstest für report → confirm → confirm_count + Melder-Benachrichtigung. Damit ist das Frühwarnnetz (melden/beobachten/bestätigen) end-to-end HTTP-abgedeckt.
- **CHECK:** 224 → 225 grün.

### Cycle #58 — 2026-07-18 — Direktnachricht-Flow über HTTP getestet (inkl. Lese-Tracking)
- **CHECK:** DM real via API verifiziert: Thread starten → senden → Empfänger unread=1 → nach Öffnen unread=0. Service-Layer testete Privatsphäre (nur 2 Parteien); der HTTP-Lese-Tracking-Fluss fehlte.
- **WORK:** HTTP-Integrationstest für start → send → inbox(unread) → read → unread 0.
- **CHECK:** 223 → 224 grün.

### Cycle #57 — 2026-07-18 — Folgen→„Mein Feed" über HTTP getestet (mit Isolation)
- **CHECK:** Kern-Social-Mechanik real verifiziert: A folgt B → B postet → A sieht es im Home-Feed, ein Nicht-Follower nicht.
- **WORK:** HTTP-Integrationstest inkl. Negativfall (Isolation).
- **CHECK:** 222 → 223 grün; `verify` komplett grün.

### Cycle #56 — 2026-07-18 — Bestandsaustausch-Happy-Path über HTTP getestet
- **CHECK:** B2B-Kernfluss (anlegen → offen gelistet → erledigt → verschwindet) real via API verifiziert; bisher war nur die Rechte-Verweigerung (Privat→403) HTTP-getestet, nicht der Happy-Path.
- **WORK:** HTTP-Integrationstest für create → list(offen) → resolve → nicht mehr offen.
- **CHECK:** 221 → 222 grün.

### Cycle #55 — 2026-07-18 — Frühwarnnetz (Kern-Wertversprechen) über HTTP getestet
- **CHECK:** Kernfluss „Wirkstoff beobachten → Benachrichtigung bei fremder Engpass-Meldung" real via API end-to-end verifiziert (funktioniert). Service-Layer war getestet, HTTP-Layer (Routen-Verdrahtung, z. B. Pfad `/api/watchlist`) nicht.
- **WORK:** HTTP-Integrationstest: Beobachter beobachtet → Reporter meldet → Beobachter erhält `watch_alert`, Melder nicht.
- **CHECK:** 220 → 221 grün.

### Cycle #54 — 2026-07-18 — Abgelaufene Sitzung führt sauber zum Login
- **THINK:** Lief mitten in der Nutzung der Token ab, gab es an jeder Aktion „Nicht angemeldet"-Fehler — 401 ist aber nicht eindeutig (auch Login-/Passwort-Fehler sind 401).
- **WORK:** Auth-Guard-401 bekommt eigenen `code: not_authenticated`; `api()` verwirft bei diesem Code (und vorhandenem Token) das Token und zeigt Login-/Länder-Screen (kein Reload-Loop). Login-Fehler (`login_failed`) bleiben inline.
- **CHECK:** Ungültiger Token → Login gezeigt + Token gelöscht, 0 JS-Fehler; HTTP-Test für not_authenticated; 220 grün, Smoke 11/11, `verify` grün.

### Cycle #53 — 2026-07-18 — Freundliche, lokalisierte Netzwerk-Fehlermeldung
- **THINK:** Bei Verbindungsverlust warf `fetch` ein technisches „Failed to fetch", das ungefiltert bei nicht-technischen Nutzer:innen landete.
- **WORK:** `api()` fängt den fetch-Reject ab → freundliche Meldung `e_network` (DE/EN/PT); lokale `t`-Variable (Token) zu `tok` umbenannt, damit i18n-`t()` erreichbar ist.
- **CHECK:** Offline real: EN „Connection problem — please check your internet and try again."; Parität 644/644/644; 220 grün, Smoke 11/11.

### Cycle #52 — 2026-07-18 — Offline-Hinweis (Verbindungsstatus)
- **THINK:** Bricht die Leitung weg (mobil, Apotheke), gab es nur stille Fehler. Offline-Caching wäre riskant (Sicherheit: keine veralteten Engpass-/Preisdaten) — der bewusste Netzwerk-Passthrough bleibt; stattdessen ein klarer Hinweis.
- **WORK:** Bernstein-Balken (nicht Rot — Rot bleibt kritischem Engpass vorbehalten) oben, folgt `online`/`offline`-Events; `role=status`/`aria-live`; i18n `offline_banner` (DE/EN/PT).
- **CHECK:** Playwright-Offline-Emulation: online versteckt → offline sichtbar (EN „No internet connection…") → wieder online versteckt; Parität 643/643/643; 220 grün, Smoke 11/11, Browser-Audit grün.

### Cycle #51 — 2026-07-18 — gzip auch für API-JSON-Antworten
- **THINK:** Nach den statischen Assets war der zweite Payload-Treiber das API-JSON (Feed/Preise) bei jeder Navigation.
- **WORK:** `json()`-Helfer nimmt jetzt `req`, gzip-komprimiert Antworten > 512 B (kleine lohnen die CPU nicht); 4 Aufrufstellen angepasst. Test erweitert (API-gzip).
- **CHECK:** Feed real 3201 → 949 B (−70 %), Health (64 B) unkomprimiert; 220 grün, Smoke 11/11.

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
- **WORK:** Onboarding umgestellt: erst Land wählen → Login → länderspezifische Sicht. Grüner Punkt oben links ist jetzt das klickbare ApoPulse-Logo (SVG) → Startseite. Auf Render (feed-first) deployt.
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

---

### Cycle · Premium-Preis in der Landeswährung (2026-08-28)

**GATHER/ANALYSE.** Die App hat einen Länder-Schalter für 16 Währungen — der Premium-Preis
stand aber fest in EUR, und in `app.js` hing ein **hartkodiertes „€"** am Betrag:
```js
<span style="color:var(--green)">${fmtMoney(opt.amount_eur)} €</span>
```
Eine Apotheke in Luanda oder Zürich sah „9,99 €" und musste selbst umrechnen. Dieselbe
Sorte Fehler, die der i18n-Wächter für Text längst abfängt — nur für Währung gab es keinen.

**WORK.** Kein zweiter Preis wurde erfunden: Abgerechnet wird weiter in der Produktwährung,
angezeigt wird zusätzlich eine Näherung zum **echten Tageskurs** über den bereits
vorhandenen FX-Dienst (`services/fxRates.js`, open.er-api.com, gecacht).

- `payments.js` → `cryptoOptions(id, { currency })` liefert `local: { currency, amount, updated_at }`
  oder `null`. Neue Hilfsfunktion `localApproximation()`.
- `server.js` → `/api/payments/crypto?country=…` steuert nur die Anzeige-Währung.
- `app.js` → neues `fmtCurrency(v, currency)` über `Intl.NumberFormat`; Währungen ohne
  Cent-Konvention im Handel (AOA, NGN, KES, MZN) werden gerundet.
- i18n: `pr_amount_na` enthielt in **allen drei** Wörterbüchern ein hartkodiertes „€" —
  ersetzt durch `{amount}` (fertig formatiert). Neuer Schlüssel `pr_local_approx`.

**Ergebnis:** „≈ 9.495 AOA in deiner Landeswährung · abgerechnet wird 9,99 €".
Ohne erreichbaren Kurs steht dort **nichts** — kein geschätzter Betrag.

**CHECK.** 8 neue Unit-Tests (u. a. „ohne Kurs wird nichts erfunden", FX-Cache wird nur
einmal abgerufen), 14 Browser-Prüfungen über vier Währungen; volle Kette grün
(485 Tests, Smoke 19/19, i18n 0 Lücken).

**Zwei eigene Fehler unterwegs:**
1. Die drei i18n-Einfügungen landeten alle im **deutschen** Wörterbuch, weil der Suchtext
   ein Präfix des Ergebnisses ist. Der Paritäts-Wächter hat es sofort rot gemeldet
   (1375/1374/1374) — behoben durch sprachspezifische Anker.
2. Der erste Browser-Check prüfte nur, ob „9,99" irgendwo steht — er hätte die eigentliche
   Neuerung gar nicht erfasst. Ersetzt durch einen Check, der `fmtCurrency` direkt aufruft
   und die API-Antwort mit `local` einspeist.

**Offen für den Owner:** Ob Premium echte lokale Festpreise bekommen soll (statt Umrechnung).
`data/plans.js` zeigt die Bauart bereits — es wäre eine Preisliste je Währung, also eine
kaufmännische Entscheidung, keine technische.

### Cycle · FIAT-Zahlungen: PayPal direkt, Klarna, Buchungszeile (2026-10-04)

**Auftrag des Owners:** Karte, Apple Pay, Google Pay, Klarna und PayPal **zusätzlich**
zur bestehenden Krypto-Zahlung.

**GATHER.** Erst nachgesehen, was schon da ist — und Stripe war es: Karte, Geldbörsen
und PayPal **über** Stripe, mit HMAC-Webhook-Prüfung. Wirklich gefehlt haben:
PayPal **direkt**, Klarna, eine Buchungszeile in PostgreSQL, eine `.env.example` und
eine Oberfläche, über die man überhaupt mit Karte zahlen kann. Letzteres war der
größte Befund: Der Server konnte es, die Premium-Seite bot nur Krypto an.

**ACT.**
- `services/payments.js` → `createPayPalAdapter` (REST, **kein SDK**), `PROVIDER_VORRANG`
  (direkt vor Stripe bei `paypal`), `configuredMethods()` liefert je Methode genau einen
  Eintrag, `handleWebhook` kennt den Zustand `approved`.
- `domain/compliance.js` → `klarna` + `KLARNA_COUNTRIES` (nur AT/DE/PT, Begründung unten).
- `prisma/schema.prisma` + Migration `20261004170000_fiat_payments` → `model Transaction`,
  drei Enums, `User.stripeCustomerId`/`paypalPayerId`.
- `repo/prismaStore.js` → `saveTransaction` als Spiegel; unbekannte Werte werden **nicht
  geraten**, die Zeile entfällt mit Warnung.
- `public/app.js` + `i18n.js` → Fiat-Knöpfe auf der Premium-Seite, 11 neue Schlüssel ×3.
- `/api/payments/methods?country=XX` → Schnittmenge aus „Anbieter konfiguriert" und
  „im Land zulässig", plus `pending_setup` für die Wege, denen nur ein Schlüssel fehlt.
- `.env.example` → alle Variablen, kommentiert; `.env` jetzt tatsächlich in `.gitignore`.

**Drei echte Fehler gefunden — zwei davon meine eigenen:**
1. **`handleWebhook` awaitete `verifyWebhook` nicht.** Stripe und Coinbase prüfen synchron,
   mein PayPal-Adapter nicht. Ein Promise ist truthy, `evt.type` wäre `undefined` gewesen:
   **jeder** PayPal-Webhook wäre stillschweigend als „ignoriert" durchgelaufen, keine
   PayPal-Zahlung je freigeschaltet, und eine abgelehnte Signatur hätte eine unbehandelte
   Promise-Ablehnung ausgelöst statt einer 400.
2. **`CHECKOUT.ORDER.APPROVED` als „bezahlt" gelesen.** Genehmigt heißt: Die Kundin hat
   die Belastung *erlaubt*. Das Geld bewegt sich erst beim Einzug. Mein erster Entwurf
   hätte Premium verschenkt. Jetzt: `approved` → einziehen → nur ein abgeschlossener
   Einzug schaltet frei.
3. **Capture-ID als Referenz.** Bei `PAYMENT.CAPTURE.COMPLETED` ist `resource.id` die
   **Belastungs**-ID, nicht unsere. Sie trifft keine Zahlung — jede Belastung wäre als
   „unmatched" ins Leere gelaufen. Jetzt über `supplementary_data.related_ids.order_id`,
   ersatzweise `custom_id`, und dort **mit** Anbieter-Prüfung, damit eine fremde Kennung
   keine Krypto-Zahlung trifft.

**CHECK.** 26 neue Tests (`test/payments-fiat.test.js` + einer am HTTP-Layer); volle Kette
grün (810 Tests, Store-Texte, Smoke 19/19, Browser-Audit, Checkout-Demo 62/62, Audit).
Drei Wächter einmal **absichtlich gebrochen**, um zu belegen, dass sie anschlagen:
„approved → paid" (4 rote Tests), Anbieter-Prüfung entfernt (1), Capture-ID als Referenz (1).

**Ein vierter Befund, den `verify` nicht gesehen hat:** `public/checkout-demo.html` ist ein
**erzeugtes** Artefakt, das `compliance.js` einbettet. Nach dem Hinzufügen von Klarna war es
veraltet — und `verify` blieb grün, weil nur `check:checkout` den Bau prüft, nicht `verify`.
Neu gebaut, und `check-checkout-demo.mjs` prüft jetzt mit Bordmitteln, dass jede
Methoden-Kennung der Engine in der Seite vorkommt (der Bau-Vergleich selbst braucht die
Tailwind-CLI, die in einem frischen Klon fehlt — `verify` muss überall laufen).

**Warum Klarna nur AT/DE/PT:** Klarna rechnet in der Währung des Käuferlandes ab, unsere
Preise stehen in EUR. In CH, GB, US, AU, CA fehlt also keine Klarna-Verfügbarkeit, sondern
eine lokale Preisliste — ein Knopf dort würde mit einem Währungsfehler abbrechen. Ein Test
prüft, dass jedes Klarna-Land ein EUR-Profil hat.

**Krypto unberührt.** Die Krypto-Schiene hängt an einem anderen Endpunkt und kann durch den
neuen Länderfilter nicht verschwinden; ein HTTP-Test prüft das über AT/KE/NG/AO/ZZ.

**Offen für den Owner:** Stripe- und PayPal-Konten verifizieren und die Schlüssel in Render
setzen (`server/.env.example` nennt jeden). Bei PayPal **beide** Webhook-Ereignisse
abonnieren, bei Stripe Klarna im Dashboard aktivieren. Solange nichts hinterlegt ist, zeigt
die Premium-Seite offen „Karte/PayPal folgt" — kein Knopf, der ins Leere führt.

### Cycle · Live-Signale dauerhaft + Signal-Feed im Frontend (2026-10-04)

**Auftrag des Owners:** VerifiedSignals fest an PostgreSQL binden (mit Dedupe),
`VerifiedSignalFeed` im Frontend bauen, `/api/live/status` für alle 22 Quellen
saubere Telemetrie liefern lassen.

**GATHER — zwei Befunde, bevor eine Zeile Code entstand:**
1. Die Signale lagen **ausschließlich** im Arbeitsspeicher. `collectSnapshot()`
   kannte sie nicht, `__dump`/`__load` des Stores wurde **nirgends aufgerufen**.
   Nach jedem Deploy war alles weg — und weil die KI-Anreicherung je Meldung
   genau einmal läuft, kam das Verlorene nur gegen erneute Kosten zurück.
2. `/api/signals` existierte und lieferte, aber **keine Ansicht rief es auf**.
   Der Signal-Weg war vollständig gebaut und für Nutzer:innen unsichtbar.

**ACT.**
- `repo/prismaStore.js` → `saveSignal` (Upsert auf `dedupeKey` =
  `sourceId:originalUrl`, `@unique`), `listSignals`, `signalRows`/`signalUpserts`
  in der Telemetrie.
- `services/signals.js` → `createSignalStore({ mirror })` schreibt durch;
  neues `uebernehmen(rows)` für den Start; `jeLand()` für die Diagnose.
- `http/server.js` → `restoreSignalsFromDb()` in der Startkette; `signals`-Block
  in `/api/live/status`.
- `public/app.js` → Reiter **„⚠️ Live-Warnungen"** mit `signalCard()`:
  Titel, KI-Zusammenfassung in der Anzeigesprache, Wirkstoff (INN),
  Handelsname, Grund, Zeitraum, Herkunfts-Abzeichen mit Direktlink, Land +
  Flagge, farbcodierter Schweregrad, Vertrauenswert. Kategorie-Filter in
  Klartext, Wirkstoff-Suche, Einstieg vom Dashboard. 33 i18n-Schlüssel ×3.

**Die Architektur-Entscheidung, die ich gegen den Wortlaut des Auftrags
getroffen habe:** „Fest verbinden" heißt hier **nicht** „Datenbank als einzige
Quelle". Zwei Schichten — Speicher liest, Datenbank hält. Begründung: Ein
Datenbankausfall hätte sonst den Signal-Feed abgeschaltet, und zwar **stumm**,
mit leerer Liste, die wie „keine Warnungen" aussieht. In einer Apotheke ist das
die teuerste Fehlanzeige, die es gibt.

**Ein eigener Fehler, den erst die Gegenprobe gezeigt hat:** Mein neuer
Browser-Prüfpunkt für die Signal-Karte war **vakuant**. Ich habe die
Wirkstoff-Zeile aus der Karte entfernt — der Audit blieb grün, weil der
Prüfwert `amoxicillin` auch im Titel stand („Lieferengpass Amoxicillin 1000
mg"). Dasselbe für die Kategorie („Lieferengpass"). Zwei Haken, die nichts
belegten. Behoben durch Prüfwerte, die **genau einmal** auf der Karte
vorkommen (`pruefomycin`, Titel ohne Wirkstoff und ohne Kategoriewort); danach
schlagen alle drei Gegenproben an.

**Zweiter Befund derselben Klasse, systematisch behoben:** Die Reiter-Liste im
Browser-Audit war **hartkodiert** und per deutschem Beschriftungstext geklickt.
Folge: Ein neuer Reiter wurde nie geprüft (genau das wäre „Live-Warnungen"
passiert), und in einem englischsprachigen Land trafen die Klicks nichts — die
Prüfpunkte liefen still ins Leere. Jetzt wird die Leiste **aus dem DOM gelesen**
und über `data-tab` geklickt, mit Untergrenze als Riegel gegen die leise
Variante (Gegenprobe: kaputter Selektor → 5 Befunde statt grün).

**CHECK.** 15 neue Tests (`test/signals-persistence.test.js` + Telemetrie-Test
am HTTP-Layer), Browser-Audit um die Signal-Karte erweitert. Fünf Wächter
einmal absichtlich gebrochen: `verifiedAt` im Update, `null` überschreibt,
eingehender statt gespeicherter Stand, `uebernehmen` schreibt zurück,
Telemetrie-Feld entfernt — jeder schlägt an.

**Offen:** Ein **Gesehen-Stand** je Nutzer:in. Dann wird aus dem Dashboard-Knopf
eine Kachel „neu seit deinem letzten Besuch" — heute wäre jede Zahl dort
entweder nicht handlungsleitend oder ein zweiter roter Zähler neben dem
Engpass-Zähler mit anderer Bedeutung.

### Cycle · Reparatur der stummen Quellen (2026-10-04)

**Auftrag des Owners:** EMA 429, BASG `fetch failed`, PEI/Swissmedic 404, TGA
Zeitüberschreitung, openFDA-Rückrufe „keine verwertbar".

**Die Arbeit bestand zur Hälfte darin, Fehlerbild und Gegenmittel richtig
zuzuordnen.** Vier der fünf vorgeschlagenen Maßnahmen hätten nichts bewirkt
oder geschadet:

| Vorschlag | Befund | Stattdessen |
|---|---|---|
| EMA: Browser-Kennung + Retry-Delay | 429 ist eine Bitte, langsamer zu sein — eine andere Kennung umgeht eine Schutzmaßnahme, und die Behörde kann uns dann nicht freischalten | `minHostGapMs: 2000` **pro Host** (beide EMA-Quellen liegen auf demselben) + `Retry-After` wird beachtet |
| BASG: Header oder Proxy-Fallback | `fetch failed` liegt **unterhalb von HTTP** — es gibt keinen Statuscode, auf den ein Kopf wirkt | `Accept: application/json` (richtig, aber nicht die Reparatur) + offene Benennung der drei möglichen Ursachen. **Kein Proxy:** ein Drittanbieter im Pfad behördlicher Arzneimitteldaten könnte Inhalte ändern, ohne dass es auffällt — die ganze Herkunfts-Zusicherung hängt daran |
| PEI/Swissmedic: `.html`-Adressen als `url` | Das sind **Übersichtsseiten**, keine Feeds. Als `url` gelingt der Abruf mit HTTP 200, der Parser findet null Meldungen, **im Protokoll steht kein Fehler** — schlechter als die heutige 404, weil es nach Erfolg aussieht | beide in `homepage`, wo die Selbstfindung die echte Feed-Adresse ausliest. Test verbietet `.html` in `url` |
| TGA: Timeout auf 15 000 ms | Dort standen schon **30 000**, und das Protokoll belegt, dass selbst 30 s abliefen. 15 000 wäre eine Halbierung gewesen | hoch auf 45 000. Die Gegenprobe mit 15 000 lässt zwei Tests rot werden |

**Der fünfte war echte Parser-Arbeit — mit einem zweiten Boden darunter.**
`openfda_recalls` meldete „100 Zeilen empfangen, keine verwertbar". Ursache 1
waren die Spaltennamen (`product_description`, und der Wirkstoff verschachtelt
als Array unter `openfda.generic_name`). Ursache 2 war schwerer: openFDA
liefert `status: "Ongoing"` — den Stand des **Rückrufverfahrens**, nicht die
Lieferfähigkeit. Nur die Spalten nachzutragen und „Ongoing" auf „kritisch"
abzubilden hätte aus 100 verworfenen Zeilen **100 Engpassmeldungen gemacht, die
es nicht gibt**. Dazu der Zusammenstoß im Schema: `Shortage` ist über
`[drugName, country]` eindeutig — Rückruf und echter Engpass desselben
Präparats hätten sich um eine Zeile gestritten.

Deshalb neu: `newsFromJson` als dritter Weg (strukturierter Export → Meldung,
mit **benannter** Feldzuordnung, nichts aus Fließtext geschnitten), und
`openfda_recalls` als `kind: 'news'`. Der Link zeigt auf den Datensatz bei der
Behörde, abgefragt über die Rückrufnummer — bewusst die Schnittstelle, weil es
keine amtliche HTML-Seite je Rückruf gibt und ein erfundener Pfad genau der
Fehler wäre, der PEI und Swissmedic auf 404 gesetzt hat.

**Zwei eigene Tests korrigiert, weil sie die falsche Sache zusicherten:**
- `sourcesByKind('news').every(format === 'rss')` war eine **Näherung** der
  Regel, nicht die Regel. Die Regel lautet: Engpass-*Datensätze* nur aus
  strukturierten Exporten. Umgekehrt ist der Meldeweg die **vorsichtigere**
  Richtung. Ersetzt durch die echte Zusicherung: eine JSON-Meldequelle muss
  ihre Felder benennen.
- Mein eigener Telemetrie-Test vom Vortag forderte „mindestens 3
  Engpassquellen" — eine Momentaufnahme, die eine bewusste Umstufung bestraft.
  Ersetzt durch: Gesamtzahl bleibt 22, und AT **und** US haben einen
  strukturierten Export.

**CHECK.** 29 neue Tests (`test/sources-repair.test.js`). Sieben Wächter einmal
absichtlich gebrochen — `Retry-After` ignorieren, Mindestabstand aus,
quellenspezifische Kopfzeilen verlieren, Punktpfad nicht auflösen, TGA auf 15 s,
HTML-Seite als Feed-Adresse, Rückrufe zurück in den Engpassweg — jeder schlägt
an.

**Ehrliche Grenze, unverändert:** Diese Bauumgebung hat keinen Netzzugang. Ob
die Adressen stimmen, zeigt erst der Lauf auf Render. 20 von 22 Quellen stehen
weiter auf `verified: false`, und das bleibt so, bis ein echter Abruf sie
bestätigt.

### Cycle · Wirkstoff-Alarm bei Behördenmeldungen (2026-10-04)

**GATHER.** Die Plattform hatte seit gestern einen Signal-Feed und eine
Beobachtungsliste — aber keine Verbindung zwischen beidem. Die Liste wurde nur
beim Öffnen der Seite ausgewertet; eine Rückrufmeldung um 3 Uhr nachts
erreichte niemanden. Damit war ApoPulse ein Portal, in das man schauen muss,
und nicht ein System, das sich meldet. Das ist der Unterschied, der entscheidet,
ob eine Apotheke es täglich nutzt.

**ACT.** Neues `services/signalAlerts.js` (rein, ohne Repo-Zugriff — die
Entscheidung „wer, warum, warum nicht" ist vollständig testbar), plus
`listWatchers()` im Engpass-Repo und die Verdrahtung im Aufnahme-Durchlauf.
Benachrichtigungstyp `signal_alert` in der bestehenden Kategorie `watch`
(abschaltbar), Klick führt in die Live-Warnungen auf den Wirkstoff gefiltert.

**Die Leitfrage war nicht „wie löse ich aus", sondern „wie löse ich NICHT
aus".** Der teuerste Fehler hier ist ein Alarm zu viel: Wer dreimal am Tag eine
Pressemitteilung als Warnung bekommt, schaltet die Kategorie ab — und verpasst
dann auch den Chargenrückruf. Ein stummer Melder ist schlimmer als gar keiner.
Drei Bremsen: Wortgrenzen (im Fließtext erst ab 4 Zeichen), ein Alarm je
Meldung, ein Alarm je Wirkstoff und Tag. Die Dedupe-Schlüssel liegen im bereits
persistierten Alarm-Gedächtnis — ohne das würde **jeder Deploy** jede bekannte
Meldung erneut melden.

**Der Befund, auf den ich am meisten halte, kam aus einer FEHLGESCHLAGENEN
Gegenprobe.** Ich habe die Unicode-Wortgrenze gegen das einfachere `\b`
getauscht, um zu belegen, dass die Tests den Unterschied merken — und **alle
blieben grün**. Kein Fall hatte einen Umlaut direkt am Treffer, und genau dort
liegt der einzige Unterschied: `\b` ist in JavaScript ASCII-basiert und hält
„ä" für ein Trennzeichen. Zwei echte Fehler steckten dahinter:
- Fehlalarm: `\bIbuprofen\b` trifft in „Ibuprofenähnliche Wirkstoffe".
- **Verpasster Alarm:** `\bÖstrogen\b` trifft *nie* — am Wortanfang steht kein
  ASCII-Wortzeichen, an dem die Grenze ansetzen könnte. Wer „Östrogen"
  beobachtet, hätte nie einen Hinweis bekommen, und niemandem wäre es
  aufgefallen.
Test nachgezogen, Gegenprobe schlägt jetzt an. Das ist der Grund, warum eine
Gegenprobe kein Ritual ist: Sie hat hier eine vakuante Zusicherung gefunden,
die ich selbst für belastbar gehalten hatte.

**Eine bewusste Einschränkung:** Der Titel-Treffer ist nötig, nicht bequem —
ohne `APOPULSE_AI_API_KEY` ist `wirkstoff` immer `null`, ein Alarm nur auf dem
KI-Feld würde beim Owner heute nie auslösen. Zulässig ist er, weil der Alarm
**keinen Status behauptet**: „eine Behörde hat etwas gemeldet, in dem dein
Wirkstoff vorkommt, hier ist der Link". Eine Meldung mit Link ist überprüfbar,
ein geratener Statuswert nicht.

**Nicht geändert, aber gefunden:** `shortagesRepo.watchersForText()` (für die
Austausch-Benachrichtigungen) vergleicht mit `includes`, also ohne Wortgrenzen —
dort trifft ein beobachtetes „ASS" in „KLASSE". Für kurze Produktbezeichnungen
tragbar, aber dieselbe Fehlerklasse. Nicht in diesem Zyklus angefasst, weil es
bestehendes Benachrichtigungsverhalten ändert; als nächster Kandidat vermerkt.

**CHECK.** 30 neue Tests (`test/signal-alerts.test.js`), sieben Wächter einmal
absichtlich gebrochen — davon einer, der zunächst NICHT ansprang (siehe oben).

**Offen:** `watchersForText` auf Wortgrenzen umstellen; Gesehen-Stand für die
Signal-Ansicht (dann wird aus dem Dashboard-Knopf eine Kachel „neu seit deinem
letzten Besuch").

### Cycle · Jurisdiction-Guard: Fachkreis-Schranke für Rx (2026-10-04)

**Auftrag des Owners:** fünf Säulen (weltweite Quellen, Rechts-/Compliance-System,
B2B-Mehrwert für vier Branchen, KI-Übersetzung, Deploy).

**GATHER — was davon schon da war, und was wirklich fehlte:**
- **Säule 1 ist weitgehend erledigt.** Alle 18 im Auftrag genannten Behörden
  sind registriert (BfArM, PEI, BASG, Swissmedic, EMA ×2, openFDA ×2, MHRA,
  Health Canada, TGA, SAHPRA, NAFDAC, PPB, FDA Ghana, INFARMED, ANVISA, ARMED,
  ANARME) — 22 Quellen. Offen bleibt RxNorm und das Abfrage-Modul auf Zuruf.
- **Säule 2 war der eigentliche Befund, und er war akut.** `GET /api/exchange`
  war angemeldet, aber NICHT auf Fachkreise beschränkt. Im Code stand
  ausdrücklich „Privatnutzer:innen können Einträge lesen" — und da die
  Registrierung Selbstbedienung ist, waren Rx-Angebote praktisch öffentlich
  lesbar. In DACH ist Publikumswerbung für Rx-Arzneimittel untersagt (HWG § 10).
  `data/accountTypes.js` nannte die Rechte-Durchsetzung selbst einen „bewusst
  getrennten Folgeschritt" — dieser Zyklus ist dieser Schritt.

**Zwei Lecks, nicht eines.** Neben `list()` war `byAuthor()` offen — die
Profilansicht einer Apotheke, kommentiert als „öffentlich lesbar wie die
Liste", ohne jeden Betrachter-Parameter. Die Liste zu schützen und das Profil
offen zu lassen hätte die Schranke wertlos gemacht. Dieselbe Prüfung greift
jetzt zusätzlich in `search.js` und `overview.js` — die übergreifende Suche
wäre sonst die dritte Hintertür gewesen.

**ACT.** Neues `domain/jurisdiction.js` (rein, testbar ohne Server):
Verifizierungsstufen, `rxErlaubt`, `rxSichtbar`, `rxGrund`, `filterRx` mit
Zähler. Rx-Kennzeichnung am Angebot (`otc` / `rx` / unbestimmt), Prisma-Felder
`jurisdiction`/`verificationStatus`/`licenseNumber`/`isRxAllowed` + Migration,
zwei neue Kontotypen (`wholesale`, `logistics`), Oberfläche mit Pflichtangabe
beim Einstellen und ehrlicher Meldung bei verborgenen Einträgen. 15 i18n-Keys ×3.

**Drei Entscheidungen, die den Unterschied machen:**
1. **FAIL CLOSED.** `rx: e.rx ?? null` und nicht `?? false`. Ein `false` als
   Standard hätte jeden Altbestand im Moment des Einbaus öffentlich gestellt —
   eine Sperre, die bei ihrer Einführung durchlässig ist.
2. **`verified` statt Kontotyp.** Den Kontotyp wählt man selbst; eine Schranke,
   die nur darauf prüft, ist mit einem Klick im Anmeldeformular umgangen.
3. **Logistik gehört NICHT zum Rx-Fachkreis.** Ein Transportunternehmen
   befördert Arzneimittel, es erwirbt sie nicht.

**Der interessanteste Konflikt: zwei Länder-Mechanismen.** Der Anzeigefilter
`country` folgt dem Länder-Umschalter („eine Berliner Apotheke darf sich
ansehen, was in Wien los ist"), die Rx-Schranke folgt dem Heimatland („sie ist
in Österreich nicht erwerbsberechtigt"). Ein bestehender Test erwartete, dass
ein DE-Betrachter AT-Einträge sieht — mit der Schranke zu Recht nicht mehr für
Rx. Statt die Erwartung zu senken, trennt jetzt ein neuer Test die beiden
Mechanismen und hält fest, dass der Länder-Umschalter **keine** fremden
Rx-Angebote öffnet. Dieselbe Falle hatte das Rechts-Gate schon einmal.

**Vier eigene Tests korrigiert, jeder mit Begründung im Code:** die feste Zahl
„4 Kontotypen" (bestrafte eine begründete Erweiterung), zwei
Verrohrungs-Tests (brauchen `rx: 'otc'`, um ihr eigentliches Thema zu messen —
mit ausdrücklichem Hinweis, dass das eine Testvorgabe und keine Aussage zur
Verschreibungspflicht ist), und der DSGVO-Löschtest, der jetzt auch prüft, dass
kein **verborgener** Rest bleibt — sonst könnte eine nicht gelöschte Zeile als
„verborgen" durchgehen und die Löschung sähe vollständig aus.

**CHECK.** 48 neue Tests (`test/rx-schranke.test.js` + Endpunkt-Test), 907 Tests
gesamt grün. Sechs Umgehungswege einmal absichtlich geöffnet — unbestimmt gilt
als OTC, Kontotyp statt Verifizierung, Logistik im Fachkreis, Jurisdiktion weg,
`byAuthor` ungeschützt, Repo-Standard `false` — jeder wird erkannt.

**Nicht gebaut, und warum (Säule 3):** Kühlketten-Meldungen,
Zoll-Verzögerungen, Kapazitäten-Börse, Rote-Hand-Kanal und Jobmarkt wären fünf
neue, zunächst LEERE Bereiche. Das Audit vom 06.09.2026 hat genau deshalb acht
Bereiche geparkt, und die eiserne Regel verbietet Platzhalter-Inhalte. Sie
gehören gebaut, wenn es Teilnehmer gibt, die sie füllen — die Kontotypen
`wholesale`/`logistics` und ihre Verifizierungsstufen sind der Unterbau dafür
und liegen jetzt.

**Offen:** RxNorm-Anbindung (Säule 1), KI-Übersetzung auf Zuruf (Säule 4),
`watchersForText` auf Wortgrenzen (aus dem letzten Zyklus).

### Cycle · Verifizierungs-Durchlauf + Übersetzen auf Zuruf (2026-10-04)

**Auftrag des Owners:** den Verifizierungs-Prozess im Frontend nutzbar machen,
danach Säule 4 (KI-Übersetzung per Klick).

**Warum das die richtige Reihenfolge war:** Ohne Verifizierung war die
Fachkreis-Schranke aus dem letzten Zyklus eine geschlossene Tür ohne Schlüssel.
Die Mechanik gab es (`/api/verify/*`), aber kein Betrieb hatte sie je benutzt —
die Tauschbörse war damit nicht leer, sondern verschlossen.

**TEIL 1 — Verifizierung.** Die Lizenznummer ist jetzt Pflichtangabe (außer für
Behörden, die sich anders legitimieren), Privatnutzer:innen bekommen das
Formular gar nicht zu sehen. Die Moderations-Ansicht zeigt Lizenznummer,
Kontotyp, Land und — das Wichtigste — **`would_allow_rx`**: Vor dem Klick steht
da, ob eine Freigabe Einblick in verschreibungspflichtige Angebote schafft.
Vorher stand dort nur Freitext.

Drei Entscheidungen, die den Unterschied machen:
1. **Kontotyp wird MIT DEM ANTRAG festgehalten.** Das Profil lässt sich
   dazwischen ändern — wer als Logistik beantragt und vor der Freigabe auf
   Apotheke umstellt, bekäme sonst eine Stufe, die nie geprüft wurde.
2. **`isRxAllowed` nach Kontotyp, nicht pauschal `true`.** Logistik und Behörde
   werden verifiziert, bekommen aber keinen Rx-Einblick.
3. **Entziehen ohne Entverifizieren.** Eine erloschene Betriebserlaubnis muss
   sich sperren lassen, ohne die Historie zu verlieren.

Und: Die Verifizierungs-Karte im Profil **bleibt stehen**, wenn man verifiziert
ist (vorher verschwand sie). Sie beantwortet damit die Frage, die dann aufkommt:
„Ich bin verifiziert, warum sehe ich trotzdem keine Rx-Angebote?"

**TEIL 2 — Übersetzen.** Die wichtigste Eigenschaft ist eine negative: Der
Dienst bekommt **nur Text**. Keine Adresse, kein Behördenname. Die Herkunft
kann nicht verändert werden, weil sie nie hereinkommt — strukturell gelöst,
nicht per Bitte im Prompt. Ein Prompt lässt sich umgehen, eine fehlende Eingabe
nicht. Zwei Tests schieben genau das hinein, was nicht durchkommen darf; einer
davon liest im Browser die echte Netzanfrage mit.

Kostenbremsen, weil jeder Aufruf gegen die Abrechnung des Owners geht: auf
Zuruf statt automatisch, Zwischenspeicher je Zielsprache + Texthash, 60
Anbieter-Aufrufe je Stunde und Konto, und eine gescheiterte Übersetzung landet
**nicht** im Speicher (sonst wäre ein einmaliger Netzfehler für immer als
Ergebnis verbucht).

Drei Regeln für den Knopf: Er erscheint nur mit KI-Schlüssel (ohne ihn wäre er
eine Fehlermeldung mit Rahmen), er ersetzt nur den Text (Herkunfts-Link bleibt),
und das Original ist per zweitem Klick zurück — mit dem ursprünglichen HTML,
damit verlinkte @Handles nicht verloren gehen.

**Ein eigener Testfehler, gefunden durch das Fehlschlagen des Tests selbst:**
Mein Prüffall „eine leere Antwort gilt nicht als Übersetzung" lief über einen
Testhelfer mit Vorgabewert. Bei `antwort: undefined` griff die Vorgabe
(„Supply shortage") — der Test prüfte damit das Gegenteil von dem, was dastand,
und wäre grün geblieben. Vorgabewerte in Testhelfern verschlucken genau den
interessanten Fall.

**CHECK.** 30 neue Tests (`test/ai-translate.test.js`, `verification.test.js`
neu geschrieben) plus zwei HTTP-Tests und ein Browser-Prüfpunkt; 934 Tests
gesamt grün. Zehn Wächter einmal absichtlich gebrochen — sieben im Dienst
(Original als Übersetzung ausgeben, Zwischenspeicher ohne Zielsprache,
Fehlschlag speichern, Lizenz nicht verlangen, pauschal Rx freischalten,
Kontotyp zur Freigabezeit, Entzug nimmt die Verifizierung) und drei im Browser
(Knopf ohne KI, Herkunft mitschicken, Zurückschalten entfernt) — jeder schlägt
an.

**Offen:** RxNorm-Anbindung (Säule 1), Säule 3 (B2B-Bereiche — jetzt möglich,
weil Verifizierung funktioniert), `watchersForText` auf Wortgrenzen.

### Cycle · Säule 3: Ausweichpräparate, Kühlkette, Sicherheitsmeldungen (2026-10-05)

**GATHER.** Die Verifizierungsstufen stehen seit dem letzten Zyklus — damit war
Säule 3 erst möglich: B2B-Bereiche brauchen ein Konto, das nachweislich ein
Betrieb ist. Der Auftrag nannte drei Teile: Wirkstoff-Alternativen über RxNorm,
eine Kühlketten-/Zoll-Statusanzeige für Großhandel und Logistik, und
Fachkreis-Kommunikation für Hersteller.

**WORK — Teil 1: Ausweichpräparate.** Der Auftrag sagte „baugleich". **Genau
diese Aussage macht der Dienst nicht**, und das ist die Hauptarbeit dieses
Teils: RxNorm sagt „gleicher Wirkstoff" und nichts weiter. Austauschbarkeit
hängt an Darreichungsform, Stärke, Hilfsstoffen und nationaler Zulassung —
keines davon steht in RxNorm. `SUBSTITUTIONS_HINWEIS` fährt in jeder Antwort
mit, die Oberfläche zeigt ihn **vor** der Liste, und „bioäquivalent" kommt
nirgends vor. Wer die Liste liest, hat die Einordnung dann schon gelesen.

Der nützliche Teil ist der **INN**, nicht das Präparat: Ein US-Handelsname aus
RxNorm ist für eine Apotheke in Wien nicht bestellbar. Also stehen die
Wirkstoffe oben, sind klickbar, und `eigene_engpaesse` reicht nach, was zu dem
Wirkstoff in **unseren** Daten liegt. Fünf Gründe (`zu_kurz`, `unbekannt`,
`kein_wirkstoff`, `keine_praeparate`, `nicht_erreichbar`) sehen unterschiedlich
aus — „RxNorm kennt den Begriff nicht" ist ein Ergebnis, „RxNav antwortet
nicht" ein Ausfall, und letzterer wird nicht zwischengespeichert.

**WORK — Teil 2: Kühlkette & Zoll.** Hier gibt es **keine
Behördenschnittstelle**, für kein Geld. Diese Information entsteht bei
Spedition, Großhandel und Apotheke und sonst nirgends. Also: ehrliche
Leermeldung **plus Meldeweg**, jede Zeile `provenance: 'self_reported'` mit dem
Namen des Betriebs. Beispielzeilen wären hier besonders schädlich — an einer
Kühlketten-Meldung entscheidet, ob eine Charge vernichtet wird.

`logistikErlaubt` ist dabei **absichtlich ein anderes Prädikat** als
`rxErlaubt`: Eine Spedition hat keinen Grund, Rx-Angebote zu sehen (sie
transportiert, sie beschafft nicht), ist beim Kühlketten-Bruch aber die
wichtigste Gruppe — sie merkt ihn zuerst. Und das `isRxAllowed`-Veto der
Redaktion sperrt den Rx-Einblick, nicht den Meldeweg.

`list()` gibt `{ meldungen, erlaubt, grund }` zurück: **gesperrt ist nicht
leer**. „Hier ist nichts" wäre einem unverifizierten Konto gegenüber eine
Falschaussage und verschweigt den einen Schritt, der hilft.

**WORK — Teil 3: Fachkreis-Kommunikation.** Umgesetzt ist die *Leserichtung* —
`/api/sicherheitsmeldungen` bündelt Rückrufe und Rote-Hand-Briefe serverseitig.
**Bewusst ohne Fachkreis-Schranke:** Ein Rote-Hand-Brief des BfArM steht
öffentlich auf bfarm.de; ihn zu verstecken wäre eine Sperre, die nichts
schützt. Die Schranke gilt für *Angebote* zu Rx-Ware, nicht für *Warnungen*
über sie. Ein **Sendeweg** für herstellereigene Mitteilungen wäre Werbung an
Fachkreise, bräuchte Schranke und Moderation — und hätte ohne ersten Hersteller
einen leeren Bereich ergeben. Nicht angelegt; die eiserne Regel verbietet
Platzhalter, und fünf leere Kacheln sind fünf Platzhalter.

**Ein eigener Prüffehler, gefunden beim Gegenprobieren:** Mein Browser-Check
für die Logistik-Sperre suchte das Wort „verifizierte Betriebe" im Seitentext.
Auf Deutsch war er zufällig scharf (der Untertitel sagt „verifizier**ten**
Betrie**ben**" — andere Deklination), auf Englisch und Portugiesisch aber
**vakuant**: dort steht die Wendung wortgleich im Untertitel, der Check wäre
also auch ohne Sperrkarte grün gewesen. Jetzt prüft er das Kennzeichen
`data-lglocked` **und** die genannte Stufe. Nebenbei: `public/app.js` enthielt
drei **literale NUL-Bytes** (Sortier-Sentinel im Warenkorb), weshalb `grep` die
größte Frontend-Datei als Binärdatei behandelte und jede Suche darin
fehlschlug — jetzt `'\u0000'`, derselbe Wert, lesbar.

**CHECK.** 977 Tests grün (+43: `test/logistik.test.js`,
`test/rxnorm-alternativen.test.js`, HTTP-Tests), i18n-Parität 1497/1497/1497.
Elf Wächter einmal absichtlich gebrochen — acht im Dienst (Hinweis aus der
leeren Antwort entfernen, `unbekannt` als „keine" melden, Netzfehler
zwischenspeichern, PIN statt IN führen lassen, Logistik in den Rx-Fachkreis
aufnehmen, Rx-Entzug auf das Melden ausweiten, „gesperrt" als leer ausgeben,
unbekannte Dringlichkeit auf `kritisch` hochrunden) und drei im Browser
(Hinweis unter die Liste, Sperrkarte weg, Sicherheits-Knopf filtert nur lokal)
— jeder schlägt an.

**Offen:** `watchersForText` auf Wortgrenzen (gleiche Fehlerklasse wie im
Wirkstoff-Alarm, dort behoben); Gelesen-Zustand für den Warnungs-Feed; der
Sendeweg für Hersteller-Mitteilungen, sobald ein Hersteller verifiziert ist.

### Cycle · Wortgrenzen auch in der Tauschbörse (2026-10-11)

**GATHER.** Seit dem Wirkstoff-Alarm stand ein Befund offen, den ich selbst
notiert hatte: `shortagesRepo.watchersForText()` verglich mit `includes`, also
ohne jede Wortgrenze. Mein damaliger Kommentar nannte das „für eine kurze
Austausch-Bezeichnung tragbar". Das war die falsche Einschätzung — nachgesehen,
was dort tatsächlich hereinkommt: eine frei getippte Packungsaufschrift. Ein
beobachtetes **„ASS"** (Acetylsalicylsäure, eine der häufigsten Beobachtungen
in einer deutschen Apotheke) meldete damit jede **„Kassenpackung"** und jede
**„Massagecreme"**. Zwei Fehlalarme, und die Benachrichtigung ist abgeschaltet
— dann fehlt auch der echte Hinweis.

**WORK.** Nicht einfach `wortTreffer` aus dem Behörden-Alarm übernommen: Dessen
beidseitige Grenze hätte hier den **häufigsten** Fall verpasst. „ASS100 Hexal"
ist keine Nachlässigkeit, so steht es auf der Packung; „Ibuprofenlysinat" und
„Eisentabletten" sind Komposita mit dem Wirkstoff als Wortanfang. Mit
`(?![\p{L}\p{N}])` auf der rechten Seite wäre keines davon ein Treffer.

Deshalb **zwei Regeln** in einer neuen Datei `domain/wirkstoffTreffer.js`, mit
dem Unterschied als Kommentar statt als Zufall:

- `wortTreffer` (Behördenmeldung = Satz) grenzt **links und rechts** ab.
  „Paracetamolhaltige Präparate" ist dort bewusst kein Treffer: eine
  Wirkstoffklasse, keine Meldung zum beobachteten Präparat.
- `praeparatTreffer` (Packungsaufschrift = zusammengesetzter Name) grenzt nur
  **links** ab. Die gefährlichen Fälle liegen alle rechts vom Wortanfang:
  „K-assenpackung", „M-assage", „Gl-assplitter" — die linke Grenze allein hält
  sie draußen.

`signalAlerts.js` exportiert `wortTreffer` weiter, weil der Alarm die Regel
benennen soll, die er anwendet; die Definition liegt jetzt aber an einer Stelle.

**CHECK.** 982 Tests grün (+5), `npm run verify` komplett. Drei Gegenproben,
jede schlägt an: zurück auf `includes` (Kassenpackung trifft), beidseitige
Grenze (ASS100 und Ibuprofenlysinat treffen nicht mehr), `\b` statt Unicode
(Östrogen am Textanfang trifft nicht mehr — dieselbe Falle wie im Alarm).

**Nebenbei geklärt:** `exchange.notifyMatches` hat diese Fehlerklasse **nicht**
— es tokenisiert in ganze Wörter und filtert Füllwörter. Dort ist dafür etwas
anderes auffällig: Das Token-Muster `[a-zäöüß0-9]{4,}` kennt nur deutsche
Umlaute, portugiesische Namen („Solução") zerfallen daran. Eigene Baustelle,
notiert statt mitgeändert.

**Offen:** Gelesen-Zustand für den Warnungs-Feed; Sendeweg für
Hersteller-Mitteilungen, sobald ein Hersteller verifiziert ist; das
Token-Muster in `notifyMatches` auf `\p{L}` umstellen.

### Cycle · Die Glocke lief an der Fachkreis-Schranke vorbei (2026-10-11)

**GATHER.** Geplant war ein kleiner Fix am Token-Muster von
`exchange.notifyMatches` (kennt nur deutsche Umlaute). Beim Lesen der Funktion
fiel Wichtigeres auf: Sie iteriert `exchangeRepo.list()` **roh** — ohne
Länderfilter, ohne Rx-Schranke — und schreibt die Bezeichnung des Eintrags in
die Benachrichtigung. Die Schranke vom 04.10. sitzt in `list()` und
`byAuthor()`; die Glocke war ein dritter Ausgang, den niemand bewacht hat.

**Erst bewiesen, dann geändert.** 12 Tests geschrieben, gegen den alten Code
laufen lassen: **7 rot**, und zwar genau die Leck-Fälle; die fünf
„muss weiter funktionieren"-Fälle grün. Drei Wege:

- `exchange_offer`/`exchange_want`: Name des Rx-Angebots an unverifizierte
  Konten und über die Landesgrenze.
- `watch_offer`: dass und von wem ein Rx-Präparat angeboten wird.
- `match_count`: „3 passende Angebote" am Gesuch, Klick, leere Liste — die Zahl
  verriet, was die Liste verbarg, und sah dabei aus wie ein Fehler.

**WORK.** Alle drei mit `rxSichtbar` — demselben Prädikat wie die Liste, damit
beide nicht auseinanderlaufen können. `decorate` kennt jetzt die Betrachterin
(ohne Betrachterin: fail closed). Die Prüfung sitzt **in** `notifyMatches`,
nicht in `create`: Das Matching löst auch bei Umbenennen und Wiederöffnen aus,
und sonst wäre Umbenennen der Weg drumherum.

Nebenbei die Dashboard-Kachel `watch_offers` auf `praeparatTreffer` gestellt:
Sie zählte mit `includes` weiter jede Kassenpackung zu „ASS", die die Glocke
seit dem letzten Zyklus nicht mehr meldete — zwei Aussagen zum selben Angebot.

**Acht ältere Tests liefen danach rot** — sie legten Einträge ohne Rx-Angabe von
unverifizierten Konten an und erwarteten Glocke und Zählung. Ohne Rx-Angabe ist
ein Eintrag geschützt, die Liste verbarg ihn diesen Konten längst; nur Glocke
und Zahl hatten es noch nicht gewusst. Die Fixtures sagen jetzt ausdrücklich
`rx: 'otc'` — **und das war nicht kosmetisch**: In `exchange-watchoffer.test.js`
liefen die Negativ-Tests („ASS trifft keine Kassenpackung") nach dem Fix weiter
**grün, aber vakuant** — die Schranke blockierte ohnehin jede Glocke. Erst mit
OTC-Fixtures prüfen sie wieder die Vergleichsregel; eine Gegenprobe
(`includes` zurück) bestätigt es.

**CHECK.** 996 Tests grün (+14), `npm run verify` komplett. Sechs Gegenproben.
**Eine eigene Fehlmessung dabei:** Die ersten drei Gegenproben meldeten
„fail 0" — nicht weil die Tests versagten, sondern weil der Bruch nie
angewandt wurde (`\n` kam als Backslash-n an, die Ersetzung fand nichts). Ein
„grün" aus einer Gegenprobe ist nur etwas wert, wenn feststeht, dass der Bruch
stattgefunden hat. Die Wiederholung lief mit einer Bestätigung je Bruch
(„Bruch angewandt") — das war ein Sitzungs-Hilfsskript, nicht Teil des Repos. Eine vierte
Gegenprobe war falsch gebaut (sie schaltete die Schranke überall ab statt nur
beim Umbenennen) und wurde neu gebaut — jetzt schlägt genau der eine Test an,
den sie prüfen soll.

**Für den Owner:** Solange kein Betrieb verifiziert ist, lösen Einträge ohne
Rx-Angabe keine Tausch-Glocke mehr aus. Das ist dieselbe Regel, die die Liste
seit dem 04.10. zeigt. Der erste verifizierte Betrieb ändert das.

**Offen:** Token-Muster in `notifyMatches`/`countMatches` und im Frontend
(`[a-zäöüß0-9]`) auf Unicode — der ursprüngliche Plan dieses Zyklus;
Gelesen-Zustand für den Warnungs-Feed.

### Cycle · Tausch-Matching in drei Sprachen; Zahl und Klick stimmen überein (2026-10-11)

**GATHER — erst gemessen.** 12 realistische Biete/Suche-Paare durch den echten
Dienst: **10 falsch.** Nicht nur Portugiesisch/Englisch („Comprimidos",
„tablets", „Solução" zerfiel zu „solu"), sondern auch **Deutsch**:
„Augentropfen", „Nasenspray", „Lösung zum Einnehmen" verbanden fremde
Wirkstoffe. Und „Ácido acetilsalicílico" fand „Acido acetilsalicilico" nicht.

Beim Lesen der Klickwege ein zweiter Fehler derselben Wurzel: **Zahl und
Klick widersprachen sich.** Das Frontend riet den Suchbegriff für „passende
anzeigen" selbst (erstes Wort, eigenes deutsches Muster, ohne Formwörter —
bei „Lösung zum Einnehmen Metformin" also „lösung"), und die Dashboard-Kachel
setzte die **ganze** Bezeichnung ein: „Salbutamol Dosieraerosol — 1 passendes
Angebot" führte auf eine leere Liste, weil „Dosieraerosol" im Angebot nicht
steht. Ein Test belegt den alten Fehler ausdrücklich.

**WORK.** `domain/bezeichnung.js`: Falten (Akzente weg), Unicode-Wörter,
Formwörter DE/PT/EN plus Komposita über die Wortendung, Stärken („500mg")
zählen nicht. Die Kompositum-Regel ist ein Verdacht über Wortenden — ein Test
prüft sie gegen rund 300 verbreitete Wirkstoffnamen; keiner wird verschluckt.
Der Server liefert zur Zahl den **Schlüssel** (`match_key`: das Wort mit den
meisten sichtbaren Gegenstücken, in der Schreibweise des Eintrags); alle drei
Klickwege nutzen ihn, das Frontend rät nicht mehr. Die Suche faltet Akzente,
sonst träfe der Schlüssel das Angebot ohne Akzent nicht. **Ehrliche Grenze:**
Kommen Treffer über verschiedene Wörter, zeigt der Klick die größte Gruppe,
nicht alle — ein Suchbegriff ist ein Wort. Steht so im Test.

**Ein wackliger Test, unterwegs.** Ein Suite-Lauf meldete 5 Fehler in
`reference-data.test.js` — einzeln grün, im nächsten Lauf grün. Fünf weitere
Läufe: grün; **die Ursache ließ sich nicht reproduzieren.** Zwei Kandidaten,
beide belegt vorhanden: (1) Die Portbereiche von `features-http` (4600–4899)
und `reference-data` (4800–5099) **überschneiden sich**, `node --test` läuft
parallel, und `listen()` hatte keinen `'error'`-Handler — eine Kollision
brach die ganze Datei ab. (2) Der Start wartete nur 30 × 50 ms. Beides an der
Wurzel behoben statt einen Bereich zu verschieben: Port 0 (das
Betriebssystem vergibt) in den beiden Dateien, Warten auf das
`listening`-Ereignis in allen drei. `http-integration` behält seinen Bereich
— es nutzt `PORT` 143-mal als Handle-Suffix (max. 30 Zeichen). Eine
erzwungene Kollision meldet jetzt `Testserver startet nicht: EADDRINUSE`
statt abzustürzen; vorher hing derselbe Versuch.

**CHECK.** 1022 Tests grün (+26), `npm run verify` komplett, neuer
Browser-Prüfpunkt (liest die tatsächliche Anfrage mit). Sieben Gegenproben,
jede mit Bestätigung, dass der Bruch angewandt wurde: alter Tokenizer, Suche
ohne Faltung, Kompositum-Regel aus, Schlüssel = erstes Wort, Schlüssel ohne
Schranke, Kompositum-Schwelle 3, Frontend rät wieder — jede schlägt an.

**Korrektur zum letzten Zyklus:** Die Tauschbörse **ruht** in der
Voreinstellung. Das Rx-Leck über die Glocke war im Code real, im Betrieb aber
nur offen, wo `APOPULSE_FEATURE_TAUSCHBOERSE=an` gesetzt ist. Das hatte ich
beim Melden nicht dazugesagt.

**Offen:** Gelesen-Zustand für den Warnungs-Feed.

### Cycle · Jedes Land seine eigene Lage: Trennung, Presse, KI-Lagebild (2026-10-11)

**Anlass (Owner):** Nach dem Wechsel auf Portugal erschienen weiter Infos von
Herba Chemosan. Gewünscht: Jedes Land zeigt seine eigene Realität — Angola
anklicken und alles zu Angola sehen, Nigeria und warum es Engpässe hat, Schweiz
und was Roche Neues hat, Kanada und wie Hormus die Produktion trifft — „via KI".

**GATHER.** Zwei getrennte Ursachen:
1. **„Herba Chemosan" steht in der Live-App gar nicht** — nur in der ALTEN App
   (`frontend/index.html`, fest eingebaut, samt erfundener Ansprechperson und
   Telefonnummer bei einer echten Firma). Die liefert GitHub Pages weiter aus:
   `pages.yml` veröffentlicht `frontend/` bei jedem Push auf `main`.
2. **Die Live-App trennte Länder nur in den Listen-Reitern.** Übersicht,
   Wirkstoff-Seite und Suche fragten ohne Land ab („alle Länder"),
   Beobachtungsliste und alle fünf Engpass-Alarmwege ebenso, Rabatt-Alarme
   kamen aus allen Ländern. Und ein Hinweis auf jeder Seite sagte „die Zahlen
   stammen aus Österreich".

**Erst bewiesen:** sechs HTTP-Tests, alle rot gegen den alten Code — jeder an
seiner Leck-Aussage, jede Gegenprobe („in Österreich vorhanden") grün.

**WORK.**
- **Trennung:** Anzeige folgt dem angesehenen Land, Benachrichtigung dem
  Heimatland (`domain/land.js`). Der Österreich-Hinweis ist entfernt — er war
  nach der Behebung falsch.
- **Pages:** `pages.yml` veröffentlicht nur noch eine Weiterleitung (`pages/`,
  inkl. 404 für alte Pfade). **Wirkt erst auf `main`** — Entscheidung des Owners.
- **Presse je Land** über GDELT, getrennt von Behörden-Feed und Signalen, als
  Presse gekennzeichnet. Ungeprüft gegen das echte GDELT (kein Netz hier);
  daher je Land per Umgebungsvariable ersetzbar.
- **KI-Lagebild** je Land: nur aus nummerierten Belegen, Server verwirft
  unbelegte Punkte, Quellen unter jedem Punkt, Hinweis davor.

**Zwei eigene Fehler, beide von Prüfungen gefunden:**
- Die neuen Sprachschlüssel `pr_title`/`pr_empty` gab es schon (Premium-Titel,
  Preis-Leermeldung). Ein doppelter Schlüssel überschreibt still; die
  Paritätsprüfung sieht das nicht. Umbenannt und **neuer Test** gegen doppelte
  Schlüssel je Sprache — mit Gegenprobe.
- Ein Presse-Test („kein `javascript:`-Link") war **vakuant**: Gleiche Titel
  ließen die Dublettenprüfung den gültigen Artikel entfernen, die Zahl blieb 1.
  Erst die Gegenprobe zeigte es; der Test prüft jetzt, WELCHER Artikel bleibt.
  Eine Frontend-Gegenprobe war falsch gebaut (Hinweis zusätzlich statt
  verschoben) und wurde neu gebaut.

**CHECK.** 1056 Tests grün (+34), i18n 1511/1511/1511, `npm run verify`
komplett. 19 Gegenproben (7 Trennung, 8 Presse/Lagebild-Dienst, 3 Oberfläche
Lagebild, 1 doppelte Schlüssel) — jede schlägt an, zwei davon erst nach
Nachbesserung (s. o.).

**Für den Owner:** `APOPULSE_AI_API_KEY` setzen (ohne ihn kein Lagebild);
`/api/presse?country=NG` einmal aufrufen und melden, ob Artikel kommen oder
welcher `fehler`; Pages-Weiterleitung auf `main` bringen oder Pages abschalten.
Preise und Rabatte je Land gibt es nur, wo eine Quelle angebunden ist — für
Großhandelspreise existiert keine freie Quelle; ohne Quelle bleibt der Bereich
leer, statt österreichische Zahlen zu zeigen.

**Offen:** Gelesen-Zustand für den Warnungs-Feed.

### Cycle · Krypto-Zahlung Afrika: Die Meldung kam bei niemandem an (2026-10-12)

**Owner-Frage:** „Funktioniert das Krypto-Zahlsystem für unsere Kunden in Afrika?"

**GATHER — im Code nachgesehen, nicht aus dem Gedächtnis.** Der Geldweg funktioniert
(Premium-Seite → Coin/Wallet → Betrag zum Tageskurs → Zahlung direkt in die eigene Wallet →
Transaktions-ID melden). Die Freischaltung nicht: Nach der Meldung stand bei der Kundin
„wird nach Prüfung freigeschaltet" — **aber niemand erfuhr davon**. Keine Benachrichtigung,
keine Prüfliste in der App; Bestätigen ging nur per API-Aufruf, den die Oberfläche nirgends
machte. Eine Apotheke in Lagos hätte gezahlt und ewig gewartet. Dazu: USDT über Tron (der
günstige Weg in NG/KE/GH) ist ohne Adresse abgeschaltet.

**WORK.** Meldung an alle Redaktionskonten; Prüfliste ganz oben im Redaktions-Dashboard;
Bestätigen und Ablehnen (nur mit Grund), beides mit Benachrichtigung an die Kundin;
Premium-Seite zeigt den eigenen Prüfstand („nicht erneut zahlen").

**Eine Lücke, die erst beim Bauen auffiel:** Transaktions-IDs sind öffentlich. Eine
abgeschriebene fremde Zahlung bestünde „gibt es, geht an unsere Adresse". Darum hält der
Start den erwarteten Betrag zum Kurs dieses Moments fest, die Prüfliste zeigt Start- und
Meldezeit mit einer Prüfanleitung VOR dem Bestätigen-Knopf, und eine ID lässt sich nur
einmal melden. Formprüfung je Kette schon beim Melden; Explorer-Link nur aus geprüfter ID.

**Drei Gegenproben, die NICHT anschlugen — alle drei lehrreich:**
- „Ablehnung gibt Tx-ID frei" blieb grün, weil der Mechanismus **redundant** war: Die
  Dublettenprüfung zählt ohnehin nur offene oder bezahlte Meldungen. Statt den Test zu
  verschärfen, die überflüssige Freigabe entfernt und den Kommentar berichtigt — Code, der
  wie ein Schutz aussieht und keiner ist, ist schlimmer als keiner.
- Zwei Browser-Gegenproben waren **falsch gebaut** (`order:-1` in einem Nicht-Flex-Container
  verschiebt nichts; die Anleitung zusätzlich statt verschoben). Neu gebaut, beide schlagen an.
- Eine weitere (Ablehnen ohne Grund) ließ das Audit **abstürzen** statt melden: Die Liste
  zeichnete neu, der nächste Schritt lief in eine Zeitüberschreitung. `verify` wäre rot
  gewesen, aber mit falscher Ursache. Prüfpunkt umgebaut: Er meldet jetzt den Befund.

**Kleiner Fund im Screenshot:** „≈ 0.0666 SOLANA" statt „≈ 0,0666 SOL" — Kürzel und
deutsches Zahlenformat nachgezogen. Außerdem in `docs/PAYMENTS.md` die veraltete Aussage
„Solana ist bewusst leer" berichtigt (zwei Solana-Wallets sind seit Längerem aktiv).

**CHECK.** 1066 Tests grün (+10), i18n 1540/1540/1540, `npm run verify` komplett.
12 Gegenproben (8 Dienst, 4 Oberfläche), jede schlägt an — drei davon erst nach Nachbesserung.

**Für den Owner:** Tron-Adresse als `APOPULSE_WALLET_TRON` in Render eintragen. Krypto-
Einnahmen steuerlich erfassen lassen. Die Prüfung bleibt Handarbeit — das ist bei festen
Wallet-Adressen der ehrliche Stand; automatisch ginge es nur über einen Zahlungsdienstleister.

### Cycle · Aktuelle Daten zeigen, ehrlich sagen wie alt — und eine lesbare Navigation (2026-10-12)

**Owner-Auftrag:** „Das Wichtigste ist, dass die Seite jetzt schon reale Infos gibt und immer
auf dem neuesten Stand ist — ich will Informationen verkaufen … und arbeite am Webdesign:
Farbe, Tools, Größe."

**GATHER — Aktualität.** Die Abrufe laufen im Takt (News 5 Min., Engpässe 4 Std.), aber auf
dem kostenlosen Render-Tarif schläft der Dienst ohne Besucher ein — dann läuft nichts, und
die Daten werden still alt. Niemand sah das: weder die Nutzerin noch die Redaktion.

**WORK — Aktualität.**
- `abrufStand()` (coverage.js): „aktuell" heißt innerhalb von drei Takten. `/api/coverage/:land`
  liefert den Stand mit; jede Datenansicht zeigt oben „Live, vor 3 Min." oder warnt bei
  altem Abruf. Ein verpasster Takt ist normal, drei sind es nicht.
- **Datenquellen-Seite** im Redaktions-Dashboard: jede Quelle je Land, Probleme zuerst, mit
  Grund und Meldungszahl; „Bericht kopieren" als Klartext für den Owner.
- **Erfundene Startmeldungen entfernt.** Beim Frischstart legte der Server sechs „News" an
  (AT/DE/BR), z. B. „BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika
  betroffen", mit der Behörden-Startseite als „Quelle". Keine davon war echt; nach jedem
  Neustart ohne Datenbank standen sie im News-Livestream als „vor 9 Minuten". Aufgefallen
  erst im Desktop-Screenshot dieses Zyklus. Ein Test (reference-data) hält den Livestream
  nach dem Start leer; der Länder-Trennungstest legt seine Beiträge jetzt selbst an.
- **Auch aus gesicherten Beständen:** Wer die sechs Meldungen schon in Datei oder Datenbank
  hat, trüge sie weiter. `services/startbereinigung.js` entfernt beim Wiederherstellen genau
  diese sechs Texte — nur Art „news", nur von Redaktionskonten (Test + 2 Gegenproben).
  Durchgespielt: alter Server schreibt Datei mit Meldungen → neuer Server lädt sie →
  „6 erfundene Startmeldung(en) entfernt", News AT/DE/BR leer, Konto noch da.
- **Dabei gefunden — Absturz beim Neustart mit Datei.** Der Durchlauf oben brach zuerst ab:
  „Cannot access 'logistikRepo' before initialization". Seit Säule 3 (3a434d2) wurde der
  Logistik-Bestand in `applySnapshot()` geladen, aber erst ~400 Zeilen tiefer angelegt.
  Jeder Start mit gespeicherter Datei stürzte ab; kein Test sah es, weil alle frisch
  starten. Getroffen hätte es genau den Betrieb mit dauerhafter Platte — den Bezahltarif,
  den dieser Zyklus empfiehlt. Behoben (Anlage vor dem Wiederherstellen) und mit
  `test/neustart-mit-datei.test.js` abgesichert: zwei echte Prozesse auf derselben Datei.
  Gegenprobe (alte Stelle) → Test rot mit genau dieser Meldung.
- `DEPLOY.md`: Warnung, dass im Schlaf keine Abrufe laufen, mit beiden Auswegen.

**GATHER — Design (Screenshots 390/1024/1280/1500, hell und dunkel).**
- Handy: Reiter brachen mitten im Wort („Vertriebse|inschränk|ungen", „Live-Warnung|en"),
  zwei hohe Kachelreihen, dazu die Kopfzeile angeheftet — zusammen ~300 px fester Kopf.
- Kopf-Werkzeuge unter 1180 px nur als Symbol (🌙 A ❓ 🔔 🚪) — wer nicht weiß, dass die
  Tür „Abmelden" heißt, rät.
- Dunkelmodus: Weiß auf Grün 2,1 : 1 (WCAG verlangt 4,5). Der Audit prüfte Kontrast gar nicht.
- Desktop: drei ungleich lange Reiterreihen; Spalte 640 px auch dort, wo Platz für mehr war.

**WORK — Design.**
- Reiter-Reihenfolge nach Informationswert: Für dich, Live-Warnungen, Engpässe, News, Preise,
  Top-Rabatte, (Biete/Suche), Öffentlich, Mein Feed.
- Reiter tragen das kurze Alltagswort („Engpässe"); der Amtsbegriff („Vertriebs-
  einschränkungen", „Ruturas de abastecimento") steht als Überschrift der Engpass-Seite und
  als Tooltip — dort, wo man ihn zum Nachschlagen im Register braucht.
- Handy: Symbol über dem Wort, Umbruch nur an Wortgrenzen; Kopfzeile scrollt mit, angeheftet
  bleibt nur die Reiterleiste (158 statt ~300 px).
- Kopf-Werkzeuge mit Wort unter dem Symbol auf eigener Zeile; bei acht Knöpfen (Moderation)
  eine zweite Reihe statt abgeschnittener Wörter; 360-px-Handys eigens geprüft.
- Kontrast: `--on-green` (dunkel #04170a), `--handle`, `--warn-fg` und Badge-Gelb angehoben;
  zehn feste `color:#fff` auf das Token umgestellt. Audit prüft jetzt Kontrast je Reiter in
  beiden Themen.
- Spalte 720 px, wo die Seitenleisten es zulassen (unter 1240 px und ab 1460 px).
- Kleinigkeiten: Kennzahl-Kacheln gleich hoch, „neue Meldungen" statt „neue Benachrichtigun|gen",
  kürzerer Such-Platzhalter (wurde am Handy abgeschnitten).

**Neuer Audit-Prüfpunkt „Navigation lesbar"** (360/390/1024 px × AT/GB/PT, volle Knopf-
ausstattung): jedes Wort einzeln vermessen — liegt es auf zwei Zeilen, ist es zerbrochen; dazu
abgeschnittene oder unsichtbare Werkzeug-Wörter. Der Querscroll-Check sah davon nichts, denn
ein mitten im Wort umbrochenes Label ragt nirgends hinaus.

**Gegenproben (Bruch angewandt, jeweils geprüft):** Amtsbegriff wieder in den Reiter plus
`overflow-wrap:anywhere` → 6 × „zerbrochen" + „Reiter trägt nicht das Alltagswort"; Werkzeug-
Wörter versteckt → „ohne sichtbares Wort" je Sprache; Überschrift ohne Amtsbegriff → AT-Befund;
alte server.js mit Startmeldungen → reference-data-Test rot mit den drei erfundenen Texten.
Kontrast-Gegenprobe (Weiß auf Grün zurück) schlägt an. Ein Folgefund der Gegenproben: Die
Überschrift „📦 Vertriebseinschränkungen" erzeugte bei großer Schrift Querscroll → `hyphens`.

**CHECK.** 1076 Tests grün (+10), Smoke 19/19 (Reiter jetzt über `data-tab` statt Text
angesteuert — Symbol und Wort stehen getrennt), Browser-Audit ohne Befund, `npm run verify` komplett.

**Für den Owner:** Render auf „Starter" umstellen oder einen Uptime-Ping einrichten (DEPLOY.md),
sonst sind die Daten nach jeder ruhigen Viertelstunde nicht mehr aktuell. Danach im
Redaktions-Dashboard „📡 Datenquellen → Bericht kopieren" und mir den Bericht schicken.

### Cycle · Engpass-Chronik: das Gedächtnis, das keine Behördenliste hat (2026-10-12)

**Warum.** Owner-Ziel: Informationen verkaufen, dafür ein Informationsvorsprung. Behörden-
listen zeigen nur das Heute — ein beendeter Engpass verschwindet samt der Tatsache, dass es
ihn gab. ApoPulse machte es genauso (`replaceFeed` ersetzt bei jedem Abruf). Was niemand
sonst hat: die Geschichte. „Amoxicillin war seit September dreimal knapp, im Schnitt 20 Tage."

**WORK.** `services/chronik.js` schreibt bei jedem Engpass-Abruf Episoden je Land und
Wirkstoff mit; `/api/shortages` (Kurzform je Zeile) und `/api/wirkstoff` (alle Episoden).
Oberfläche: Karte „📈 Engpass-Verlauf" auf der Wirkstoff-Seite; in der Engpassliste
„🔁 Wiederkehrend: seit … schon 3× knapp" ab der zweiten Episode. Gesichert im Snapshot.

**Sechs Ehrlichkeitsregeln**, jede mit eigenem Test und Gegenprobe: nur Behördendaten; nur
Länder mit Lieferung (ein Ausfall ist kein Ende); Verdacht auf abgeschnittene Antwort hält
Schließungen zurück; Lücke ≤ 7 Tage = derselbe Engpass; Beginn mit Herkunft (Behörde/
beobachtet), Ende als „spätestens"; jede Zahl unter dem Aufzeichnungsbeginn, und für ein
nie abgerufenes Land gar keine Aussage statt „0× knapp".

**Beim Bau gefunden — vier Fehler im bestehenden Abruf:**
- `replaceFeed` löschte ALLE Länder: Lieferte nur die US-Quelle, verschwand der letzte
  österreichische Stand — entgegen der Anzeige „angezeigt wird der letzte bekannte Stand".
- Der Länder-Feed schrieb Zeilen mit `country: null` („gilt überall"): eine deutsche Meldung
  erschien in Österreich. Dieselbe Fehlerklasse wie der Länder-Leck-Befund des Owners.
- Bei zwei Behörden in einem Lauf stand an jeder Zeile „BASG, openFDA" statt der einen Quelle.
- „eingeschränkt lieferbar" (mit Umlaut) wurde verworfen, „eingeschraenkt lieferbar" nicht —
  eine echte Behördenzeile verschwand an einem Umlaut.

**Design-Nachtrag.** Status-Farben als Schrift: Rot auf dunkler Karte 2,9 : 1 → Tokens
(`statusFg`), jetzt 5,4 (hell) / 6,2 (dunkel). Pille „eingeschränkt": Weiß auf #c77700 3,5 : 1
→ #945900, 5,7 : 1. Episoden am Handy in drei kurzen Zeilen statt einer umbrechenden;
Meldedatum der Engpass-Karte im Landesformat statt „2026-10-05".

**Gegenproben (alle mit „Bruch angewandt" geprüft, jede schlägt an):** 6 Regeln + 3 Abruf-
Fehler + Umlaut (Unit), 3 Verdrahtungen (Ende-zu-Ende: zwei echte Abrufe gegen einen
nachgestellten BASG-Feed), 4 Oberfläche (Schwelle „wiederkehrend", Zahl ohne Zeitraum,
Karte für nie abgerufenes Land, Herkunft des Beginns).

**CHECK.** 1092 Tests grün (+16), Smoke 19/19, Browser-Audit ohne Befund (neuer Prüfpunkt
„Chronik"), `npm run verify` komplett.

**Für den Owner:** Die Chronik beginnt heute bei null und wird mit jedem Tag wertvoller —
aber nur, wenn der Dienst durchläuft (Render „Starter" oder Uptime-Ping). Sie ist der
naheliegende Kern eines Bezahlangebots (Verlauf, Muster, Export) — das ist eine
Produktentscheidung; im Moment ist sie für alle sichtbar.

### Cycle · Chronik als Premium-Kern; CSV-Formelschutz für alle Exporte (2026-10-12)

**Anlass.** Owner: bezahlter Render-Tarif aktiv (Screenshot: 0.5c-512mb, Live auf d2ca055) und
„mach das, was du für richtig hältst" zur Frage, ob die Chronik Premium wird.

**Entscheidung.** Zusammenfassung frei, Episodenliste und Export Premium. Begründung: „Wie oft
und wie lange war das knapp, läuft es gerade?" hilft bei einer Umbestellung — das gehört
nicht hinter eine Bezahlschranke (Sicherheitsbezug). Die vollständige Liste mit Zeiträumen,
Präparaten, Quellen und der Excel-Export sind das Analysewerkzeug für Einkauf und Großhandel.
Schranke auf dem Server (`chronikFuerBetrachter`, `GET /api/chronik` → 403 ohne Premium).

**Beim Bau gefunden:** `downloadCsv` (alle Exporte der App) hatte keinen Formelschutz.
Präparatnamen und Gründe kommen auch aus Community-Meldungen; ein „=HYPERLINK(…)" wäre
beim Öffnen in Excel ausgeführt worden. Jetzt werden Zellen mit = + @ (und - vor einem
Nicht-Ziffer-Zeichen) mit ' entschärft; „-1,50" bleibt eine Zahl.

**`render.yaml`:** `plan: free` → `plan: starter` (der echte Tarif), damit ein Blueprint-Abgleich
den Dienst nicht zurückstuft.

**Gegenproben (Bruch angewandt, jede schlägt an):** Server gibt allen Premium → Ende-zu-Ende-
Test rot („Episodenliste ging ohne Premium über die Leitung"); Export ohne Premium-Prüfung →
200 statt 403; Formelschutz entfernt → Audit „Formel nicht entschärft"; Export-Knopf trotz
Sperre → Audit „gesperrte Ansicht falsch". Ende-zu-Ende jetzt mit echtem Premium-Weg
(Krypto-Zahlung melden, Redaktion bestätigt). **CHECK:** 1093 Tests grün, Smoke 19/19, Audit ohne Befund.

### Cycle · Frühwarnung aus dem Ausland — und 22 tote Klickwege (2026-10-12)

**Anlass.** Owner: Datenbank eingetragen (Chronik überlebt Deploys), „weiter mit dem nächsten
Schritt". Nächster Informationsvorsprung auf der Chronik: Engpässe wandern zwischen Märkten.
Wer weiß, dass ein beobachteter Wirkstoff in den USA neu knapp ist, kann vorher einkaufen.

**WORK.** `services/fruehwarnung.js`: Wirkstoff-Seite „im Ausland gerade knapp", Übersicht
„🌍 Frühwarnung" (beobachtet, anderswo knapp, hier nicht), Push `shortage_abroad` für Premium.
Chronik meldet neue Episoden mit Kennzeichen „erster Lauf des Landes".

**Gegenproben:** fünf von sechs Regel-Brüchen schlugen an. Der sechste („nicht fürs eigene
Land") blieb stumm — die Prüfung war **doppelt**: Eine neue Episode im Heimatland ist ein
heimischer Engpass, das fängt schon „nicht, wenn es bei dir knapp ist". Entfernt statt
Test verbogen. Verdrahtung Ende-zu-Ende mit zwei nachgestellten Behörden (BASG + FDA):
Altfall beim ersten Lauf → kein Alarm; Neuzugang → genau ein Alarm. Oberfläche: vier Brüche
(Premium-Hinweis, leere Karte, Landeskürzel, Absturz), alle gemeldet.

**Dabei gefunden — schwerer Altfehler:** Ein Klick auf eine Benachrichtigung („Neuer Status
bei deinem beobachteten Wirkstoff", jetzt auch die Frühwarnung) öffnete NICHTS und warf einen
JS-Fehler. Ursache: Ruhende Bereiche entfernen ihre Kopf-Knöpfe (Direktnachrichten,
Einkaufsliste) aus der Seite; beim zweiten `mainScreen()` griff der Code auf den fehlenden
Knopf zu (`null.onclick`). 22 Aufrufwege hängen an `mainScreen()`. Seit der Ruhend-Schaltung
im Live-Betrieb, von keinem Test gesehen — der Audit klickte nie eine Benachrichtigung an.
Jetzt tut er es.

**CHECK.** 1101 Tests grün (+8), Smoke 19/19, Browser-Audit ohne Befund, `npm run verify` komplett.

### Cycle · Mehr Quellen: Deutschland dazu, die USA endlich vollständig (2026-10-13)

**Anlass.** Owner: „ja mach weiter" — nächster Schritt war mehr Behördenquellen.

**GATHER — ohne direkten Zugang.** Die Bauumgebung erreicht die Behörden nicht (Proxy 403).
Formate deshalb über Websuche nachgelesen, statt aus dem Gedächtnis angenommen. Ergebnis:
drei Fehler an der US-Quelle, die seit ihrem Anschluss bestanden.

1. **Nur 1000 von ~1700 US-Einträgen** (`limit=1000`, keine Folgeseiten). Schlimmer als die
   Lücke: Ohne zugesicherte Reihenfolge rutschen Einträge zwischen Abrufen aus dem Fenster —
   die Chronik hätte daraus Enden und Neuanfänge gemacht, die Frühwarnung falsche Alarme.
   → alle Seiten; eine ausgefallene Folgeseite lässt den GANZEN Abruf ausfallen.
2. **„Current" unbekannt.** Laut mehreren unabhängigen Abnehmern ist das der Rohstatus
   laufender Engpässe. Jeder laufende US-Engpass wäre als „Status unbekannt" verworfen
   worden; durch kamen nur auslaufende Präparate.
3. **Hersteller als Präparat:** Ohne Handelsnamen griff `company_name` als Bezeichnung.

**Deutschland (BfArM):** öffentliche CSV, vom BfArM selbst als automatisch abrufbar genannt.
Sie hat KEINE Statusspalte (jede Zeile ist ein Engpass) — ohne Anpassung wäre jede Zeile
verworfen worden. Dazu Windows-1252 statt UTF-8, deutsche Datumsangaben und die Spalte
„Arzneimittlbezeichnung" mit Tippfehler der Behörde. Alles abgebildet; „eingeschränkt" als
Standard (BfArM-Engpass = Unterbrechung der üblichen Auslieferung, nicht zwingend „nicht
lieferbar"), Ende vorbei → verfügbar.

**Gegenproben (Bruch angewandt):** 5 openFDA (Seiten, Teilbestand, Deckel, Status, Hersteller),
1 Verdrahtung (Server ohne Seitenlogik → Ende-zu-Ende „Frühwarnung kam nicht an"),
5 BfArM (Standardstatus nicht durchgereicht, Kodierung, Datum, Statusspalte vorhanden aber
unbekannt, Ende vorbei) — jede von mindestens einem Test erkannt; die Kodierung nur vom
Ende-zu-Ende-Test, weil nur er den echten Abrufweg geht.

**CHECK.** 1113 Tests grün (+12), Smoke 19/19, Audit ohne Befund. Zwei Alt-Tests angepasst, weil
sie den alten Zustand festschrieben (Quellenzahl 22; Deutschland als „Land ohne Engpass-Quelle").

**Für den Owner:** Nach dem Deploy auf der Datenquellen-Seite prüfen, ob „bfarm_shortages" und
„openfda_shortages" Zeilen liefern oder verwerfen — die Gründe stehen dort. Den Bericht bitte
schicken; dann ziehe ich Spaltennamen oder Statuswerte nach, falls die Wirklichkeit abweicht.

### Cycle · Ein Wirkstoff, viele Namen — ohne Verschiedenes gleichzusetzen (2026-10-13)

**Warum.** Mit drei Ländern (AT, DE, US) traf die Frühwarnung kaum: Die BfArM schreibt
„Amoxicillin-Trihydrat", die BASG „Amoxicillin", die FDA „Albuterol Sulfate" statt
„Salbutamol". Wörtlich verglichen sind das verschiedene Wirkstoffe.

**WORK.** `domain/inn.js` bildet einen Vergleichsschlüssel (Salz/Hydrat weg, Schreib-
varianten gefaltet, belegte US/INN-Synonyme, Kombinationen sortiert). Genutzt von Chronik,
Frühwarnung (Beobachter:innen über den Schlüssel, Label mit dem beobachteten Namen) und den
Engpässen der Wirkstoff-Seite. Gespeicherte Chronik-Bestände werden beim Laden umgerechnet
und überlappende Episoden verschmolzen.

**Die Gegenrichtung zuerst.** Eine falsche Gleichsetzung wäre eine falsche Engpass-Warnung.
Deshalb neben 24 „gleich"-Paaren 14 „verschieden"-Paare (Kaliumchlorid/-citrat, Prednison/
Prednisolon, Salbutamol/Levosalbutamol …) und ein Breitentest über 256 gängige Wirkstoffe. **CHECK:** 1155 Tests grün (+42), Smoke 19/19, Audit ohne Befund.

**Gegenproben (Bruch angewandt):** Kation-Schutz weg → Kalium-Salze verschmelzen; Synonyme
weg → vier US-Namen fallen durch; Präfix-Vergleich → Prednison = Prednisolon (Breitentest
schlägt an); alte Schlüssel übernommen / nicht verschmolzen / alter Faltschlüssel → Migrations-
test rot; wörtlicher Beobachter-Abgleich → Frühwarnung verfehlt „Albuterol"; Wirkstoff-Seite
wörtlich → Ende-zu-Ende „Salzform fand den Engpass nicht". **Eine Gegenprobe war keine:**
„alle Vokale streichen" blieb grün — Konsonantengerüste sind eindeutig genug, das war keine
echte Schwächung. Ersetzt durch den Präfix-Vergleich, der anschlägt.

### Cycle · Wochenbericht per E-Mail — und ein Premium-Angebot, das hält, was es verspricht (2026-10-13)

**Warum.** Informationen verkaufen heißt: Die Lage kommt zur Kundin, sie muss nicht nachsehen.

**WORK.** `services/mailer.js` (Resend/Postmark per HTTP, aus ohne Schlüssel, Schlüssel nie in
Fehlermeldungen); `services/wochenbericht.js` (beobachtete Wirkstoffe mit Stand im Heimatland,
Frühwarnungen, neue/beendete Engpässe der Woche; de/en/pt; Ländernamen in der Sprache des
Berichts; montags ab 05:00 UTC, höchstens einmal je ISO-Woche, gemerkt im gesicherten Zustand;
Fehlversuch wird NICHT als gesendet gemerkt). Abmelden per Link mit Zweck-Token (eigener,
abgeleiteter Schlüssel — taugt nie als Sitzung) und per Schalter. Premium-Seite: Abschnitt
mit Vorschau in einer rechtlosen Box (`sandbox=""`), für alle sichtbar.

**Beim Bau gefunden:**
- **Die Premium-Seite verkaufte ruhende Funktionen.** Drei von vier Vorteilen (Werbung,
  Videosprechstunden, Live-Sessions) liegen in abgeschalteten Bereichen. Jetzt stehen dort die
  Informationsvorteile (Verlauf + Export, Frühwarnung, Wochenbericht, Notizen); die übrigen nur,
  solange ihr Bereich läuft.
- `wb_title`/`wb_sub` gab es schon (Werbung) — der Test gegen doppelte Sprachschlüssel schlug
  an, bevor die Werbe-Überschrift überschrieben wurde. Umbenannt in `wbr_*`.
- Im deutschen Bericht stand „United States" (die Länderliste führt Namen gemischt) → Ländernamen
  über `Intl.DisplayNames` in der Berichtssprache.
- Die Wochenbericht-Karte fehlte für Nicht-Premium — ausgerechnet dort, wo die Vorschau
  verkaufen soll. Der neue Audit-Prüfpunkt fand es.

**Gegenproben (Bruch angewandt, jede schlägt an):** Escaping aus, doppelter Versand, Fehlversuch
als gesendet, Abbestellung ignoriert, Zweck-Token = Sitzungs-Schlüssel, Altfälle als „neu", „keine
Daten" als ruhige Woche (Unit); Sitzungs-Token als Abmelde-Link (HTTP); ruhende Vorteile beworben,
Vorschau ohne Sandbox, Abmelde-Link nicht verarbeitet (Browser).

**CHECK.** 1164 Tests grün (+9), Smoke 19/19, Audit ohne Befund.

**Für den Owner:** Resend oder Postmark einrichten (DEPLOY.md, ~15 Min.). Bis dahin zeigt die
Premium-Seite „Versand startet, sobald der E-Mail-Dienst eingerichtet ist".

### Cycle · Quellen testen und eintragen — die Redaktion braucht mich nicht mehr dafür (2026-10-13)

**Warum.** Mein blinder Fleck: Die Bauumgebung erreicht keine Behörde. Ob BfArM und FDA live
liefern, sehe ich nicht; Exporte wie der der TGA haben eine Adresse, die nur auf deren Seite
steht. Render erreicht sie. Also gehört der Test dorthin — in die Hand der Redaktion.

**WORK.** „🔍 Jetzt testen" je Engpass-Quelle (derselbe Weg wie der Takt — ein gemeinsamer
`holeEngpassQuelle`, damit Test und Lauf nicht auseinanderlaufen), mit Beispielen, Gründen
und gefundenen Spalten. „➕ Engpass-Quelle hinzufügen" mit Spaltenzuordnung, gesichert im
Snapshot, im Takt mit abgerufen, auf der Datenquellen-Seite und in der Länderabdeckung.

**Sicherheit zuerst.** Eine frei eingetragene Adresse lässt den Server Dinge abrufen — die
klassische Umlenkung auf interne Dienste (Cloud-Metadaten 169.254.169.254). Nur https, keine
privaten Hosts, keine IP-Literale, nur Moderation. **Beim Testen gefunden:** IPv4 in IPv6
verpackt (`[::ffff:127.0.0.1]`) kam zunächst durch → IPv6-Literale ganz gesperrt.

**Gegenproben (Bruch angewandt, jede schlägt an):** Probe ohne Rollenprüfung, Takt ohne eigene
Quellen, Spaltenzuordnung ignoriert, Privat-IP-Prüfung weg, eigene Quellen nicht gesichert
(Neustart-Test mit zwei echten Prozessen); Oberfläche: Test-Knopf auch bei News-Quellen,
Spalten nicht angezeigt, „Entfernen" bei eingebauten Quellen.

**CHECK.** 1168 Tests grün (+4), Smoke 19/19, Audit ohne Befund.

**Für den Owner:** Redaktions-Dashboard → 📡 Datenquellen → bei „BfArM" und „FDA" auf „Jetzt
testen" — das Ergebnis zeigt sofort, ob die echten Dateien ankommen. Für Australien: den
TGA-Exportlink eintragen und testen (Anleitung in docs/LIVE_DATA.md, 3l).

### Cycle · „Premium (Monat)" lief nie ab (2026-10-13)

**GATHER.** Seit Chronik, Export, Frühwarnung und Wochenbericht an Premium hängen, ist Premium
das Produkt. Nachgesehen, ob es ABLÄUFT: nein. `grantEntitlement` kannte keine Frist; wer einmal
9,99 € zahlte, hatte Premium für immer. Jede Folgezahlung wäre ausgeblieben.

**WORK.** Frist je Freischaltung (`entitlementBis`), geprüft in `hasEntitlement` — damit gilt sie
überall, wo Premium abgefragt wird (Wochenbericht, Frühwarnung, Export, Social). Verlängern ab
altem Ablauf; Redaktions-Freischaltungen unbefristet; Umstellung des Altbestands mit 7 Tagen
Kulanz; Erinnerung 3 Tage vorher; Premium-Seite mit „Aktiv bis" und Verlängern.

**Beim Testen gefunden:** Das Repository stempelte Zahlungen mit der echten Uhr statt der
eingespeisten — Laufzeiten wären in Tests nicht prüfbar gewesen. Jetzt eine Uhr für beides.

**Gegenproben (Bruch angewandt, jede schlägt an):** Frist ignoriert; Verlängerung ab heute statt
ab Ablauf; Umstellung ohne Kulanz; Erinnerung ohne Dedup; Wochenbericht-Empfänger ohne
Fristprüfung; Umstellung beim Laden nicht aufgerufen (Neustart-Test mit nachgestelltem
Altbestand in der gespeicherten Datei); Premium-Seite ohne Verlängern (Browser).

**CHECK.** 1175 Tests grün (+7), Smoke 19/19, Audit ohne Befund.

**Für den Owner:** Bestehende Premium-Kund:innen behalten Premium bis Zahlungsdatum + gekaufte
Laufzeit, mindestens 7 Tage ab diesem Deploy, und werden 3 Tage vor Ablauf erinnert.

### Cycle · Das Jahresabo war nicht kaufbar (2026-10-13)

**GATHER.** `premium_yearly` (99 €) stand seit Langem im Code — die Premium-Seite fragte aber
fest `premium_monthly` ab, an drei Stellen (Betrag, Karte/PayPal, Krypto). Das Jahr war für
niemanden erreichbar. Für die Kundin günstiger (99 € statt 119,88 €), für den Betrieb Geld im
Voraus und ein Jahr Bindung.

**WORK.** Laufzeitwahl vor dem Preis („1 Monat" / „12 Monate", Ersparnis aus den Produkt-
preisen gerechnet: 20,88 €, ≈ 8,25 €/Monat); alle drei Kaufwege nehmen die gewählte Laufzeit.
Die Laufzeit selbst (12 Monate, Verlängerung ab altem Ablauf) war schon getestet.

**Gegenproben (Bruch angewandt, jede schlägt an):** Krypto-Kauf mit fest „Monat" → Audit
„gewähltes Jahr kam beim Kauf nicht an"; Ersparnis falsch gerechnet → Audit; Preisabfrage
fest „Monat" → Audit „Jahr gewählt, aber Preis zeigt Monat".

### Cycle · Startseite zeigt die Lage — und verspricht nur, was läuft (2026-10-13)

**GATHER.** Wer apopulse.com öffnet, sah vier Versprechen — zwei davon aus ruhenden Bereichen
(„Bestände tauschen", „Fachnetzwerk") — und nichts von dem, was die Plattform wirklich hat:
aktuelle Behördendaten. Dazu fehlte oben der Ländername (Länderliste vor der Anmeldung nicht
geladen).

**WORK.** Kasten „Lage jetzt in 🇦🇹 Österreich: 37 Wirkstoffe auf der Engpassliste · 5 neu in
7 Tagen · Quelle BASG · Stand vor 2 Std." aus `GET /api/lage/:land` (öffentlich, NUR Zahlen —
Namen und Verlauf gibt es nach der Anmeldung). Ohne Behördendaten erscheint der Kasten nicht.
Vorteile-Liste nach laufenden Bereichen (Frühwarnung und Verlauf neu). Ländername über
`Intl.DisplayNames` + Flagge aus dem Code, wenn die Liste noch fehlt.

**Gegenproben (Bruch angewandt):** ruhende Versprechen wieder in der Liste → Audit; Server
liefert „0" statt „keine Daten" → Ende-zu-Ende; Kasten mit Null-Zahlen ohne Daten → Audit.
Eine Gegenprobe war zuerst keine: Der Bruch stürzte selbst ab (fehlende Quellenliste), so
dass gar nichts erschien und der Test zufällig grün blieb — neu gebaut, schlägt an.

### Cycle · Betriebs-Cockpit — Geschäft und Datenlage auf einen Blick (2026-10-13)

**Warum.** Zwei Dinge sah der Owner nur, wenn er aktiv suchte: ob die Behördendaten liefern
(Datenquellen-Seite) und wie das Geschäft läuft (gar nicht). Beides entscheidet über
„Informationen verkaufen".

**WORK.** `services/betrieb.js` (reine Funktion, nur Summen — keine Namen, keine E-Mails):
Konten (gesamt, neu in 7 Tagen), Premium (aktiv, unbefristet, läuft in 7 Tagen ab, in 30
Tagen ausgelaufen), Einnahmen 30 Tage je Währung, offene Prüfungen, Engpass-Quellen (liefern /
Fehler mit Grund / noch nicht abgefragt), letzter Abruf, Mail und KI an/aus. `GET /api/betrieb`
nur Moderation. Karte oben im Dashboard; Klick auf „Quellen" öffnet die Datenquellen-Seite.
Auf „Für dich" sieht die Redaktion einen roten Hinweis, sobald eine Engpass-Quelle nicht
liefert — mit Name und Grund.

**Gegenproben (Bruch angewandt, jede schlägt an):** Hinweis nicht aufgerufen; Klick ohne Ziel
(Browser); Einnahmen ohne 30-Tage-Grenze und mit unbezahlten; „ausgelaufen" ohne Zeitgrenze
(Unit); Cockpit ohne Rollenprüfung (HTTP).


### Cycle · Design v2 — sieht nicht mehr aus wie ein Baukasten (2026-10-13)

**GATHER.** Owner: „sieht noch stark danach aus, als wäre es von KI gemacht". Am Bildschirm
nachgesehen, woran das liegt: 313 von 1667 Beschriftungen begannen mit einem Emoji (🔴 📦 💶
🖨️ 👥 …), acht umrandete Pillen-Reiter über dem Inhalt, ein Kopf mit sieben umrandeten
Knöpfen in zwei Zeilen, weich beschattete Karten, Chip-Wolken.

**WORK** (Vorbilder X, LinkedIn, Instagram):
- Ein Linien-Symbol-Set (`ICONS`/`ico()`, 24er-Raster, `currentColor`) statt Emojis in
  Navigation, Kopf, Kennzahlen, Daten-Stand-Zeile und Behördenkarte.
- Führende Emojis werden beim Laden der Texte entfernt (`ohneEmojiAnfang`), außer bei
  Reaktionen (👍 ist dort der Inhalt). „← Zurück" bleibt.
- Handy: Leiste unten mit fünf Zielen (Für dich, Live-Warnungen, Engpässe, News, Mehr); „Mehr"
  öffnet die übrigen Reiter als Liste darüber und ist markiert, wenn dort der aktive Reiter
  liegt. Desktop ab 1000px: Navigation links; ab 1280px drei Spalten (220 · 640 · 280) mit
  News rechts.
- Kopf: Logo, Land, „Meldungen", „Menü" (Symbol über dem Wort). Moderation, Nachrichten,
  Einkaufsliste, Hell/Dunkel, Schrift, Hilfe, Abmelden stehen im Menü; ein Punkt am
  Menü-Knopf zeigt Ungelesenes darin. Escape schließt und gibt den Fokus zurück.
- Flache Karten mit feiner Linie, Knöpfe als Pillen, Zweitaktionen neutral statt grün,
  Suche als Pille mit Lupe; neue, ruhigere Farbtöne (dunkel: #0f1419 / #16202a).
- Startseite: Kennzahlen mit Symbol im getönten Kreis; die Knopf-Wolke darunter wird eine
  Liste (Symbol · Wort · Pfeil).

**Dabei gefunden (echte Fehler):** Die Startseite bot Lesezeichen, Angebote, Live,
Verzeichnis und Team auch an, wenn der Bereich ruhte, dazu den ruhenden Währungsrechner —
Klick führte zu 404. Der Schnellzugriff band „Angebote" an `rabatte` statt an `werbung`.
Preise, Rabatte und die Startseite boten „In die Einkaufsliste" an, obwohl `bestellung` ruht
(Klick → /api/cart → 404). Alle jetzt an ihren Bereich gebunden; der Audit prüft die
Startseiten-Links und die Warenkorb-Knöpfe mit.

**Audit.** `reiterOeffnen` öffnet „Mehr", wenn der Reiter dort liegt (sonst lief der Klick
still in die Zeitüberschreitung, der Reiter blieb ungeprüft). Lesbarkeits-Check klappt Menü
und „Mehr" auf. Neuer Prüfpunkt Design v2: Leiste unten mit genau fünf Zielen (390px), links
plus rechte Spalte (1280px), keine Emojis in Navigation/Kopf/Startseiten-Liste, Menü auf/zu
mit Escape und Fokus, „Mehr" schließt nach der Wahl und markiert sich.

**Gegenproben (Bruch angewandt, jede schlägt an):** Startseiten-Liste ohne Bereichs-Filter →
fünf Befunde „Startseiten-Link … sichtbar, obwohl … ruht"; „Mehr" nie markiert → Befund;
Emoji-Entfernung aus → „Beschriftung beginnt mit Emoji" (390 + 1280); Warenkorb-Knopf in
Rabatten ungeschaltet → Befund. Diese letzte Gegenprobe war zuerst KEINE: Die Prüfumgebung
hat keine Rabatte, die Prüfung lief grün ins Leere. Jetzt mit nachgebildetem Eintrag und
eigenem Befund, wenn keine Karte erscheint. Ebenso aufgefallen: Der Tauschbörsen-Prüfpunkt
klickte einen Reiter, der jetzt im „Mehr"-Blatt liegt — alle Reiter-Klicks des Audits laufen
deshalb über `reiterOeffnen`.

### Cycle · Design v2, Teil 2 — Navigation bleibt, Startseite ohne Verlaufsblock (2026-10-13)

**GATHER.** Die restlichen Seiten am Bildschirm durchgesehen (ausgeloggt, Meldungen, Profil,
Live-Warnungen, Öffentlich, News — Handy und Desktop).

**Gefunden und behoben:**
- Ausgeloggt stand „Meldungen" im Kopf: `.kopf-btn { display:inline-flex }` überstimmte
  `.hidden`.
- Auf Unterseiten, die `#app` leeren (Meldungen, Nachrichten, Premium, Moderation,
  Datenquellen, Logistik), verschwand die Navigation — zurück ging es nur über „Zurück". Sie
  steht jetzt als `<nav id="hauptnav">` außerhalb von `#app` und bleibt auf jeder Seite.
- Dabei aufgefallen: Logo, „Zurück"-Knöpfe und Kachel-Links riefen `loadTab()` auch dann,
  wenn kein `#feed` mehr da war → `null.innerHTML`. `loadTab()` baut in dem Fall die
  Hauptansicht neu auf.
- Startseite: grüner Verlaufsblock mit „➕ ApoPulse" ersetzt durch große Aussage auf ruhiger
  Fläche, Häkchen-Liste, „Lage jetzt" als normale Karte (wie LinkedIn). Formular-Überschriften
  sind jetzt h2 (eine h1 je Seite); der Smoke-Test sucht „Anmelden" in h1 und h2.
- Letztes Emoji in einer Überschrift (News: „📰 Presse aus …") entfernt.

**Audit.** Neu im Prüfpunkt Design v2: Navigation sichtbar auf der Meldungen-Seite, Reiter-Klick
von dort baut die Ansicht auf, Logo führt zurück; ausgeloggt kein „Meldungen" und keine
Navigation.

**Gegenproben (Bruch angewandt, jede schlägt an):** Navigation wieder in `#app` → „Navigation
verschwindet auf der Meldungen-Seite" (390 + 1280); Wache in `loadTab()` aus → „Logo führt
nicht zurück" + JS-Fehler `null.innerHTML`; Regel `.kopf-btn.hidden` aus → „btnNotif sichtbar,
obwohl niemand angemeldet ist".

### Cycle · Registrierung: Tippfehler sperrte das Konto für immer (2026-10-13)

**GATHER.** Frage des Owners: „Wie kann man die Website verbessern?" Der Weg vom ersten Besuch
zum Konto entscheidet über alles Weitere — also nachgemessen. Am Handy zwei Formulare
untereinander (~1700px), sechs Felder, davon ein Pflicht-@Handle, den Fachleute nicht kennen,
und das Land ein zweites Mal (in Schritt 1 schon gewählt).

**Gefunden (echter Fehler, per curl nachgestellt):** `/api/register` legte Organisation und
Konto an und prüfte den Handle erst danach. Ein zu kurzer oder vergebener Handle (der
Platzhalter schlug „anna_huber" vor) hinterließ ein Konto OHNE Profil; jeder weitere Versuch
endete mit „E-Mail ist bereits vergeben". Anmelden ging, aber mit `profile: null` war die
Anwendung kaputt. Dazu: jede abgelehnte Registrierung hinterließ eine Organisation.

**WORK.**
- Server prüft zuerst (Name, Handle-Format, Handle frei, E-Mail frei, Passwortlänge) und
  legt erst dann an. Ohne Wunsch entsteht der Handle aus dem Namen (`domain/handle.js`:
  „Jürgen Müller" → `juergen_mueller`, Gleichnamige `_2`, `_3`).
- `POST /api/profil/nachholen` repariert Altbestand (Konto ohne Profil); die App ruft es beim
  Start, wenn `/api/me` kein Profil liefert. Idempotent, nur angemeldet.
- Formular: „Anmelden | Konto erstellen" als Umschalter, Neue sehen zuerst „Konto erstellen",
  wer schon einmal angemeldet war „Anmelden". Vier Felder (Name, E-Mail, Passwort, Kontotyp),
  großer Knopf, `autocomplete` für Passwort-Manager. Bekannte E-Mail → Wechsel zur Anmeldung,
  Adresse übernommen.
- `e_email_taken` sagt jetzt, was zu tun ist („bitte oben auf „Anmelden" tippen", de/en/pt).
  (Meine erste Annahme, die Übersetzungen fehlten, war falsch — der Test gegen doppelte
  Schlüssel hat die doppelt angelegten Texte sofort gemeldet.) Status bleibt 400 wie bisher.

**Tests.** `test/registrierung.test.js` (7): Handle aus Namen, freier Handle, ungültiger und
vergebener Handle verbrennen die E-Mail nicht, Fehler legen keine Organisation an, Altbestand
wird repariert (echter Neustart auf Datei mit entferntem Profil). Browser-Audit: Felderzahl,
nur ein Formular sichtbar, Registrierung per Klick mit Handle aus dem Namen, bekannte E-Mail
führt zur Anmeldung.

**Gegenproben (Bruch angewandt, jede schlägt an):** Format-Prüfung aus → 2 Tests rot;
E-Mail-Vorprüfung aus → „hinterließ Organisationen"; Handle-frei-Prüfung aus → „vergebener
Handle verbrennt die E-Mail" rot.

### Cycle · Aus Kundensicht: Heimat-Alarm und Sortiments-Check (2026-10-13)

**GATHER (Owner: „versetz dich in den Kunden — wofür würde ich zahlen?").** Eine Apotheke will
drei Dinge: (1) sofort wissen, wenn IHR Wirkstoff amtlich knapp wird, (2) ihre ganze Liste auf
einmal prüfen statt Wirkstoff für Wirkstoff zu suchen, (3) vorher wissen, was kommt. Beim
Nachsehen, ob (1) funktioniert, kam der wichtigste Befund dieses Zyklus:

**Befund 1 — der Kern-Alarm fehlte.** Führt die Behörde des EIGENEN Landes einen beobachteten
Wirkstoff neu als knapp, kam kein Hinweis. Die Frühwarnung übersprang das Heimatland bewusst
(„das meldet der normale Alarm"), der normale Alarm (`watch_alert`) feuerte aber nur bei
Community- und Redaktionsmeldungen — nie beim Abruf der Behördenliste. „Wieder lieferbar" gab
es gar nicht.

**Befund 2 — Schreibweisen.** Beobachtungsliste und Alarm verglichen Namen wortgenau: Wer
„Amoxicillin" beobachtet, sah das „Amoxicillin-Trihydrat" des BfArM nicht.

**WORK.**
- `chronik.beobachte()` liefert neben `neue` jetzt `beendete`; `fruehwarnung.meldeHeimat()`
  schickt `shortage_home` („Die Behörde meldet einen Engpass bei deinem Wirkstoff") und
  `shortage_ended` („Wieder lieferbar laut Behörde") an Beobachter:innen im jeweiligen Land.
  GRATIS (sicherheitsrelevant), nicht am ersten Lauf (Altfälle), kein „lieferbar" bei
  zurückgehaltener (abgeschnittener) Antwort.
- Beobachtungsliste und `beobachterImLand` über den Wirkstoff-Schlüssel (`domain/inn.js`).
- **Sortiments-Check** (`services/sortiment.js`, `POST /api/sortiment/pruefen`, Seite
  „Sortiment prüfen" oben auf „Für dich"): Liste einfügen oder CSV aus der Warenwirtschaft
  laden; je Zeile knapp / im Ausland knapp / früher schon knapp / unauffällig / keine Meldung,
  mit Land, Dauer, Quelle bzw. Herkunft (Behörde, Apotheken-Meldung, Referenzdaten).
  „Alle betroffenen beobachten" mit einem Klick. Gratis 15 Zeilen, Premium 500 + CSV.
  Die Antwort nennt die Länder, gegen deren Listen geprüft wurde.

**Dabei gefunden:** Kombinationen. „Amoxicillin + Clavulansäure 875/125 mg Filmtabletten"
wäre als reines Amoxicillin eingestuft worden. Erkennung: ganze Zeile, Text vor der Stärke,
dann Wortgruppen — längste zuerst. Eine Vereinfachung (Text vor der Stärke weg) sah in der
ersten Gegenprobe harmlos aus; erst ein schärferer Test zeigte, dass sie genau diesen Fall
braucht.

**Tests.** `heimat-alarm.test.js` (5), `sortiment.test.js` (6), `chronik-http.test.js`
erweitert (echter Abruf: Apotheke ohne Premium bekommt „knapp" und „wieder lieferbar"),
Browser-Audit „Sortiments-Check".

**Gegenproben (Bruch angewandt, jede schlägt an):** Verdrahtung im Server weg → Ende-zu-Ende
rot; Beobachtungsliste wieder wortgenau → rot; Altfälle am ersten Lauf → 2 rot; Gratis-Grenze
aus → rot; Doppelte nicht zusammengefasst → rot; Text vor der Stärke weg → Kombi-Test rot;
kürzeste Wortgruppe zuerst → Kombi-Test rot.

### Cycle · Vorrats-Radar und was eine echte Demo zeigte (2026-10-13)

**WORK.** `services/radar.js`, `GET /api/radar`, Karte „Vorrats-Radar" auf „Für dich": was im
Ausland amtlich knapp ist, im eigenen Land aber nicht — mit Ländern, Dauer und „war bei dir
schon N× knapp". Rangfolge erklärbar (mehr Länder, dann eigener Verlauf, dann frischeste
Meldung), keine Prognose, kein Risikowert. Gratis die ersten drei, Premium alles. Ohne
Behördenliste fürs eigene Land sagt die Karte genau das.

**Demo mit nachgestellten Behördenlisten (AT/DE/US, zwei Abrufe) — fünf Befunde:**
1. Englische FDA-Namen („Methylphenidate Hydrochloride") für eine Wiener Apotheke. Jetzt:
   Schreibweise des eigenen Landes, sonst eines Landes gleicher Sprache (`domain/anzeigename.js`),
   in Radar und Sortiments-Check.
2. „seit 0 Tagen", „seit 1 Tagen", „2 Land/Ländern" → „seit heute", „seit 1 Tag", Einzahl/Mehrzahl.
3. CSV aus der Warenwirtschaft („PZN;Artikel;Menge"): Kopfzeile wurde als Artikel geprüft, PZN
   und Menge standen im Namen. Jetzt Artikel-Spalte; sonst fallen Kopfzeile und Zahlenfelder weg.
4. „Cefuroxim Sandoz" → „keine Meldung, nie als knapp gemeldet", obwohl „Cefuroxim-Axetil" in DE
   und US knapp ist. Gleichsetzen bleibt verboten (Axetil-Tablette ≠ Natrium-Infusion), aber die
   Zeile nennt jetzt „ähnlicher Eintrag in Behördenlisten: …" mit Link — sonst wäre „nie gemeldet"
   irreführend.
5. „Alle 1 betroffenen beobachten" → Einzahl.

**Tests.** `radar.test.js` (5), Sortiment um Sprache/Ähnlich/CSV erweitert, Ende-zu-Ende: Radar
nach echtem Abruf (Cefalexin aus der eigenen TGA-Quelle, Cefuroxim und Lisinopril aus den USA;
Ibuprofen ist auch in AT knapp und fehlt zu Recht). Meine erste Erwartung hatte Cefalexin
vergessen — der Test hatte recht.

**Gegenproben (Bruch angewandt, jede schlägt an):** auch daheim knappe Wirkstoffe im Radar →
Ende-zu-Ende + 2 Unit rot; Gratis-Grenze aus → rot; Rangfolge aus → rot.

### Cycle · Mehrwert sichtbar machen — und nichts verkaufen, was nicht ankommt (2026-10-13)

**GATHER.** Die Premium-Seite zählte vier Punkte auf; der eigentliche Nutzen (Heimat-Alarm,
Sortiments-Check, Radar) stand nirgends. Den Wochenbericht bot sie an, obwohl kein E-Mail-Dienst
eingerichtet ist — gekauft hätte man etwas, das nie ankommt. Und niemand sah vor dem Kauf, aus
welchen Ländern überhaupt Behördendaten kommen.

**WORK.**
- `GET /api/abdeckung` (öffentlich): je Land Behörde, Zustand (liefert / stumm / angebunden,
  noch kein Abruf / keine Quelle), Zahl offener Engpässe, ob E-Mail-Versand läuft. Keine
  Wirkstoffnamen.
- Premium-Seite: Vergleich „Gratis | Premium" (Engpasslisten und Heimat-Alarm gratis;
  Sortiments-Check 15 vs. 500 Zeilen + Tabelle; Radar Top 3 vs. vollständig; Auslands-Hinweis,
  vollständiger Verlauf + Export, Notizen). Wochenbericht nur, wenn Mail läuft; die
  Wochenbericht-Karte sagt sonst vor dem Kauf „noch kein Versand". Darunter der Nutzen je
  Kundentyp (Apotheke, Großhandel/Einkauf, Ärzt:innen) — ohne erfundene Zahlen — und
  „Woher die Daten kommen".
- Startseite: „Behördendaten aus N Ländern: …" unter der Liste; neuer Punkt „Ganze
  Bestellliste auf einmal prüfen".
- Ländernamen im Fließtext in der Sprache der Oberfläche („Vereinigte Staaten" statt „United
  States"); die Länderauswahl zeigt weiter die Landesnamen.

**Dabei gefunden:** Die Premium-Seite war am Handy 65px breiter als der Bildschirm — der
Laufzeit-Knopf („12 Monate … spart € 20,88 gegenüber 12 Einzelmonaten") durfte nicht
umbrechen. Der Querscroll-Audit prüfte nur die Reiter, nie die Premium-Seite. Jetzt schon.

**Tests.** Ende-zu-Ende: Abdeckung nach echtem Abruf (AT/DE liefern, 16 Länder, keine
Wirkstoffnamen, `mail: false`). Audit: Vergleich nennt Sortiments-Check und Radar, kein
Wochenbericht ohne Mail, Premium-Seite ohne Querscroll.

**Gegenproben (Bruch angewandt):** Laufzeit-Knopf ohne Umbruch → „Premium-Seite 65px breiter
als der Bildschirm" ✓. Wochenbericht immer im Vergleich → blieb in der ersten Gegenprobe
UNBEMERKT: Die Prüfung las die Tabelle erst nach einem Seitenwechsel, also leeren Text. Jetzt
wird sie vorher gelesen (und fehlt sie, ist das ein eigener Befund) → schlägt an ✓.

### Cycle · Wirkstoff-Abgleich: mehrteilige Namen (2026-10-13)

**Gefunden in der Demo:** Der Radar führte „Cefuroxime Axetil" (FDA) und „Cefuroxim-Axetil"
(BfArM) als zwei Wirkstoffe. Ursache in `domain/inn.js`: Die Lautregeln (u. a. englischer
Endvokal „-e") liefen erst auf dem zusammengesetzten Namen — der Endvokal fiel nur am Ende des
GANZEN Namens weg, nicht am ersten Wort. Jetzt je Wort, Doppelbuchstaben an der Wortgrenze wie
bisher zusammengezogen; Synonyme werden gleich berechnet. Gespeicherte Chronik-Schlüssel werden
beim Start ohnehin neu berechnet (`chronik.__load`), überlappende Episoden verschmelzen.
Gegenrichtung unverändert: Cefuroxim ≠ Cefuroxim-Axetil, Prednison ≠ Prednisolon,
Kaliumchlorid bleibt.

**Gegenprobe (Bruch angewandt):** Lautregel wieder nach dem Zusammensetzen → neuer Test rot.
(Mein Test rief zuerst eine Funktion unter falschem Namen auf und war damit IMMER rot — das hätte
eine Gegenprobe vorgetäuscht. Vor dem Bruch muss der Test grün sein; erst dann zählt Rot.)

### Cycle · Anzeigen für Pharma, Großhandel und Logistik — ein Geschäftsfeld, kein Banner (2026-10-13)

**Auftrag (Owner):** Einnahmen aus Werbung von Pharma-Konzernen, Großhändlern und Logistikern —
„alles Nötige einbauen, damit es realistisch wird".

**Was „realistisch" in dieser Branche heißt:** Ein Konzern bucht nur, wenn (1) er sieht, wen er
erreicht und was es kostet, (2) er selbst buchen und per Rechnung zahlen kann, (3) er Zahlen
bekommt, und (4) die Plattform ihn nicht in rechtliche Risiken zieht (Rx-Publikumswerbung,
fehlende Pflichtangaben, Werbung neben Rückrufen).

**WORK.**
- `services/anzeigen.js`: Werbekunde (Firma/Rechnung), Kampagne Entwurf → Prüfung → Freigabe →
  Zahlung → läuft; Preis = Platz × Länder × Wochen (`data/werbeplaetze.js`, per Umgebung setzbar);
  Rx nur verifizierte Fachkreise, Pflichtangaben Pflicht, https-Ziele; Auslieferung nach Land und
  Berufsgruppe mit fairer Rotation, max. 3/Tag je Person; Klicks nur mit HMAC-Zeichen; Ausblenden,
  Melden, Notbremse; Rechnung `AP-<Jahr>-<Nr>` nur mit vollständigen Betreiberangaben; Sicherung.
- Zahlung: Krypto über die bestehende Strecke (neu: freier Betrag + `beiBezahlt`-Haken; der
  Premium-Ablauf ist unverändert) oder Rechnung/Überweisung (Redaktion verbucht).
- Oberfläche: Mediadaten (öffentlich, echte Kontenzahlen, „unter 10" bei kleinen Zahlen), Buchung
  mit Live-Preis, Cockpit mit Einblendungen/Klicks/Klickrate/Tagen/Berufsgruppen, druckbare
  Rechnung, Redaktions-Prüfung mit Checkliste, Anzeige-Karte mit „Anzeige · von Firma",
  „Warum sehe ich das?", Pflichtangaben aufklappbar, Ausblenden/Melden. Plätze: Startseite,
  News-Feed (nicht neben Engpass/Rückruf), rechte Spalte. Nie auf Engpass/Warnungen/Wirkstoff.
- Bereich `anzeigen` (aktiv). Der alte Bereich `werbung` ruht weiter; sein Einwand
  („Werbung neben einer Engpassmeldung verkauft das Vertrauen") ist hier eingebaut.
- `docs/WERBUNG.md` (Regeln, Rechtsrahmen — kein Rechtsrat —, Einrichtung), `DEPLOY.md`,
  `render.yaml`.

**Tests.** `anzeigen.test.js` (11 Regeln), `anzeigen-http.test.js` (echter Server: Mediadaten,
Buchung, Prüfung, Rechnung, Krypto mit Bestätigung, Auslieferung, 302-Klick, Statistik,
fremde Statistik 404), Browser-Audit „Anzeigen".

**Gegenproben (Bruch angewandt, jede schlägt an):** Rx-Schranke weg → rot; Zahlung vor der
Prüfung möglich → rot; Frequenzgrenze weg → rot; Klick ohne gültiges Zeichen zählt → rot; kleine
Kontenzahlen offengelegt → Ende-zu-Ende rot; Anzeige auf der Engpass-Seite → Audit-Befund;
Kennzeichnung entfernt → Audit-Befund. (Der Audit selbst hatte zuerst einen Fehler: Er suchte
„Anzeige", das Label steht per CSS in Großbuchstaben — jetzt ohne Groß-/Kleinschreibung.)

### Cycle · Teilen mit Vorschau: aus einem Link wird eine Nutzerin (2026-10-14)

**Warum jetzt:** Die Daten sind da, das Geschäft (Premium, Anzeigen) auch — es fehlt Reichweite.
In Apotheken und im Einkauf laufen Engpass-Nachrichten über WhatsApp. Ein geteilter App-Link war
dort eine nackte Adresse ohne Vorschau, weil Messenger kein JavaScript ausführen; und wer ihm
folgte, landete auf einer leeren Anmeldung und musste den Wirkstoff danach selbst suchen.

**WORK.**
- `http/teilseite.js` + Routen `/teilen/lage/:land` und `/teilen/w/:land/:wirkstoff`: fertiges
  HTML mit Open Graph (Titel, Text, `og-bild.png` 1200×630). Aussage aus derselben Quelle wie die
  App: „knapp seit N Tagen" mit Behörde und Stand; Apotheken-Meldungen als „nicht amtlich"; ohne
  Behördenliste NIE „nicht knapp", sondern „noch keine Behördenliste". Nur öffentliche Angaben.
- Knopf führt zu `/?land=AT&beobachten=Amoxicillin`: Land wird übernommen, die Anmeldung nennt den
  Wirkstoff, und nach dem Konto-Anlegen steht er schon auf der Beobachtungsliste.
- Teilen-Knöpfe (Wirkstoff-Seite, Engpass-Karte, neu „Lage teilen" auf „Für dich"): am Handy das
  System-Teilen-Menü, sonst ein Blatt mit WhatsApp, E-Mail, Link kopieren.
- Cockpit: „Aufrufe geteilter Links (7 Tage)" — zeigt, ob Teilen Leute bringt. `index.html` mit
  Vorschau-Angaben und aktueller Beschreibung.
- Härtung: Alles aus Adresse escaped; Host/Protokoll aus der Anfrage nur in harmloser Form
  (Seite wird 5 Min. zwischengespeichert).

**Tests.** `teilseite.test.js` (Seitenaussagen, Escaping; echter Server: vor dem Abruf „keine
Liste", nach dem Abruf „knapp, Quelle BASG", andere Schreibweise, Lage, Host-Kopf, 404, Zähler im
Cockpit), Browser-Audit „Teilen" (Blatt → WhatsApp-Link → Teilseite mit og:title; Link → Banner →
Konto → Wirkstoff beobachtet, Absicht danach gelöscht).

**Gegenproben (jede schlägt an):** Escaping weg → rot; „keine Liste" als „nicht knapp" → rot;
Protokoll ungeprüft übernommen → rot; Absicht nicht verarbeitet → zwei Audit-Befunde.

### Cycle · Business-Tarif: Daten-Schnittstelle für Warenwirtschaft und Excel (2026-10-14)

**Kundensicht:** Ein Großhändler oder Ketten-Einkauf zahlt nicht 9,99 € für eine Webseite, die
jemand täglich öffnen muss. Er zahlt dafür, dass seine Warenwirtschaft selbst fragt „Welche
Wirkstoffe meiner Bestellung sind knapp — laut wem?" und eine Excel-Tabelle sich selbst
aktualisiert. Das ist der direkteste Weg, den Informationsvorsprung zu verkaufen.

**WORK.**
- `services/datenApi.js`: Schlüssel `apk_…` (einmal Klartext, gespeichert als SHA-256), höchstens
  5 je Konto, 120 Anfragen/Minute, Nutzungszähler, Widerruf, Löschung mit dem Konto, Sicherung.
- `/api/v1/engpaesse`, `/api/v1/pruefen` (GET/POST, bis 500 Zeilen, nutzt den Sortiments-Check),
  `/api/v1/status`; JSON oder CSV (Semikolon, BOM, Formel-Schutz). Nur echte Herkunft
  (Behörde / Apotheken-Meldung), **nie Beispieldaten**; Tarif abgelaufen → 402 mit Datum.
- Tarif `business_monthly` (99 €) / `business_yearly` (990 €), per Umgebung änderbar; schaltet
  Premium für dieselbe Laufzeit mit frei (`zusatz`). Zahlung über die bestehende Strecke inkl.
  Krypto.
- Oberfläche „Daten-Schnittstelle" (Menü + Premium-Seite): Nutzen in Klartext, Preis, Buchen,
  Schlüssel anlegen/löschen, Excel-Anleitung in drei Schritten mit fertiger Adresse, IT-Teil
  aufklappbar. Bereich `daten_api` (aktiv). Doku `docs/DATEN_API.md`.

**Tests.** `daten-api.test.js` (Schlüssel/Hash/Sicherung, Grenzen, 402 bei Ablauf, CSV, Produkt;
echter Server: Krypto-Kauf → Premium mit frei → Schlüssel → vor dem Abruf 0 Zeilen trotz
Beispieldaten → nach dem Abruf Amoxicillin laut BASG → CSV mit BOM → Listenprüfung →
Widerruf → Kontolöschung). Browser-Audit „Daten-Schnittstelle" (Preis, Buchen → Business-Zahlung
mit Krypto, Schlüssel einmal sichtbar und in der Excel-Adresse, kein Querscrollen am Handy).

**Gegenproben (jede schlägt an):** Herkunftsfilter Engpässe weg; Herkunftsfilter Prüfung weg;
Tarifprüfung weg; Klartext statt Hash gespeichert; Schlüssel aus der Adresse auch bei POST;
Kontolöschung vergisst Schlüssel; Formel-Schutz weg; Schlüssel bleibt nach dem Verlassen
sichtbar. **Befund dabei:** Die ersten beiden Gegenproben blieben zunächst grün — der Testserver
lief ohne Beispieldaten, der Filter wurde also gar nicht geprüft. Jetzt laufen Beispieldaten im
Test mit, und ein Gegencheck stellt sicher, dass sie in der App wirklich da sind.

### Cycle · Rechnungen für Premium und Business (2026-10-14)

**Kundensicht:** Ein Großhändler zahlt 990 € nicht ohne Rechnung — auch nicht mit Krypto — und
viele Firmen zahlen nur per Überweisung. Rechnungen gab es bisher nur für Anzeigen.

**WORK.**
- `services/rechnungen.js`: Rechnungsangaben einmal erfassen; Rechnung zu bezahlter Zahlung
  (einmal ausgestellt, „bezahlt am … per Krypto (BTC)"); „Per Rechnung zahlen" → Rechnung sofort,
  Zahlung in der Prüfliste der Redaktion, Freischaltung nach verbuchtem Eingang. Empfänger und
  Beträge festgeschrieben; enthaltene USt ausgewiesen; Rechnungen bleiben bei Kontolöschung.
- `services/rechnungsnummern.js`: **eine** Nummernreihe für Anzeigen und Tarife, mitgesichert;
  alte Sicherungen der Anzeigen heben den Zähler an (keine doppelte Nummer).
- **Fehler behoben:** Die Krypto-Zahlung einer Anzeige verlangte nur den Nettopreis, die Rechnung
  aber Netto + USt. Jetzt Brutto.
- Oberfläche: „Per Rechnung zahlen" auf der Premium-Seite, Formular für Rechnungsangaben,
  druckbare Rechnung, „Ihre Rechnungen" (Premium- und Schnittstellen-Seite), Prüfkarte der
  Redaktion für Überweisungen (Kontoauszug-Hinweis mit Betrag und Verwendungszweck, Knopf
  „Zahlungseingang verbuchen"). `docs/RECHNUNGEN.md`.

**Tests.** `rechnungen.test.js` (gemeinsame Reihe inkl. alter Sicherung, Beträge, Festschreibung,
Grenzen, ohne Betreiber/IBAN; echter Server: Überweisung → Freischaltung erst nach Verbuchen,
Krypto-Beleg, Anzeigen-Rechnung in derselben Reihe, Neustart mit Fortsetzung der Reihe).
Browser-Audit „Rechnungen".

**Gegenproben (jede schlägt an):** getrennte Zähler; Empfänger nicht festgeschrieben; Beleg ohne
bestätigte Zahlung; Nummernreihe nicht gesichert; Anzeigen-Krypto wieder netto.

### Cycle · Sofort-Alarm aufs Handy (Web-Push) (2026-10-14)

**Kundensicht:** Der Alarm „Amoxicillin ist laut BASG knapp" war nur so schnell wie das nächste
Öffnen der App. Der Informationsvorsprung — vor allen anderen nachbestellen — braucht ein Handy,
das sich meldet, auch wenn ApoPulse zu ist.

**WORK.**
- `services/webPush.js` nur mit Node-Bordmitteln: VAPID (RFC 8292, ES256), Verschlüsselung
  RFC 8291 (aes128gcm), Abos mit Prüfung (nur https + bekannte Push-Dienste, gültige Schlüssel),
  Löschen bei 404/410, höchstens 10 Geräte, Gerät wandert beim Kontowechsel, Sicherung der
  Schlüssel (oder fest aus der Umgebung), Texte in der Sprache der Person.
- Haken `nachBenachrichtigung` in `social.js`: nur `shortage_home`, `shortage_ended`,
  `shortage_abroad`, `watch_alert` gehen als Push; abgeschaltete Kategorien bleiben still.
- Service Worker: `push` (Anzeige) und `notificationclick` (nur eigene Seite öffnen).
- Oberfläche: Karte „Sofort-Alarm aufs Handy" auf der Startseite (abweisbar) und unter Meldungen
  (Test senden, Ausschalten); iPhone ohne Home-Bildschirm-App bekommt die Anleitung statt eines
  Knopfs. `npm run vapid-schluessel`, `docs/PUSH.md`, Render-Variablen.

**Tests.** `web-push.test.js`: Verschlüsselung **gleich dem Prüfvektor aus RFC 8291**, Entschlüsselung
durch ein nachgebildetes Gerät, VAPID-Signatur mit dem öffentlichen Schlüssel geprüft, Abo-Regeln
(auch `https://evil.example/fcm.googleapis.com` und Metadaten-Adresse abgelehnt), Versand/410/
Gerätewechsel/Sicherung; echter Server mit nachgestelltem Push-Dienst: Test-Push, neuer
BASG-Engpass → verschlüsselter Push „Engpass: Amoxicillin … Österreich", 410 → Gerät entfernt.
Browser-Audit „Push".

**Gegenproben (jede schlägt an):** Dienst-Liste weg; abgelaufene Abos bleiben; Haken nicht
verdrahtet; falscher Info-Text der Verschlüsselung; Schlüssel nicht gesichert; iPhone ohne
Anleitung.

### Cycle · Bei Google gefunden werden: öffentliche Engpass-Seiten (2026-10-14)

**Warum:** Wer „Amoxicillin Lieferengpass" sucht, fand ApoPulse nicht — Single-Page-App, kein
`robots.txt`, keine Sitemap. Reichweite ohne Werbebudget kommt aus der Suche.

**WORK.** `services/oeffentlicheSeiten.js` + Routen vor dem SPA-Rückfall: `/engpaesse`,
`/engpaesse/:land`, `/engpaesse/:land/:wirkstoff` (Server-HTML, canonical, Open Graph,
JSON-LD), `/robots.txt`, `/sitemap.xml`. Nur amtliche Daten, Quelle + Stand, Hinweis „keine
Therapieempfehlung", 404 für Unbekanntes, Seite bleibt bei „wieder lieferbar". Knopf führt in
die Beobachtung nach dem Konto-Anlegen. Link „Aktuelle Lieferengpässe nach Land" auf der
Startseite ohne Konto und als `<noscript>`. Basis-Adresse gemeinsam mit den Teilseiten
(`oeffentlicheBasis`). Aufrufe im Betriebs-Cockpit. `docs/OEFFENTLICHE_SEITEN.md`.

**Tests.** `oeffentliche-seiten.test.js` (Adress-Bildung; echter Server: vor dem Abruf 404
trotz Beispieldaten, Apotheken-Meldung nicht öffentlich (mit Gegencheck, dass sie in der App
existiert), Wirkstoffe statt Präparate gezählt, Präparate mit „voraussichtlich bis", Escaping,
404 für Unbekanntes/Großschreibung/Meldungen, „wieder lieferbar" bleibt erreichbar und in der
Sitemap, robots.txt). Browser-Audit „Öffentliche Seiten" (Link ohne Konto, lesbar ohne
JavaScript, kein Querscrollen).

**Befund dabei:** Der Test schickte die Apotheken-Meldung zuerst an eine falsche Adresse — die
Prüfung „Meldungen bleiben draußen" lief dadurch ins Leere. Jetzt mit Statusprüfung und
Gegencheck.

**Gegenproben (jede schlägt an):** Apotheken-Meldungen zugelassen; Länder ohne Behördenliste
zugelassen; unbekannte Wirkstoffe als Seite; Escaping weg; App-Hülle statt 404.

### Cycle · Startklar-Check für den Betreiber (2026-10-14)

**Warum:** Fast jede neue Funktion hängt still an einer Einstellung in Render (Datenbank,
Domain, Betreiberangaben, Push-Schlüssel, Tron-Wallet …). Das stand verteilt in vielen
Dokumenten; der Owner sah nicht, was fehlt — und ein Teil wirkt deshalb live nicht.

**WORK.** `services/startklar.js` (reine Funktion, bekommt nur OB etwas gesetzt ist):
Datenbank, Anmeldung, Behördenlisten, Domain, E-Mail, Push-Schlüssel, Rechnungen, Überweisung,
Umsatzsteuer (nur wenn Rechnungen aktiv), Krypto inkl. USDT/Tron, Karte/PayPal — je mit
„Warum" und „So geht's", „fehlt" zuerst. `GET /api/startklar` nur Redaktion. Karte ganz oben im
Redaktions-Dashboard (aufklappbar, „fehlt" offen).

**Befund nach dem Screenshot:** „Nur Datei, keine Datenbank" stand zuerst als „empfohlen" — auf
Render ist die Datei nach dem nächsten Deploy weg. Jetzt „fehlt" mit genau dieser Begründung.

**Tests.** `startklar.test.js` (nichts/alles/teilweise eingerichtet, Reihenfolge, Umsatzsteuer
nur mit Rechnungen, **kein Geheimnis in der Antwort** — Token, IBAN, Mail-Schlüssel, Datenbank-
Passwort; echter Server: nur Redaktion, ohne Geheimnisse). Browser-Audit „Startklar".

**Gegenproben (jede schlägt an):** ohne Redaktions-Prüfung; Wert verraten; ohne Sortierung;
Datenspeicherung immer „ok".

### Cycle · Erste Schritte: in 30 Sekunden zum ersten Alarm (2026-10-14)

**Kundensicht:** Nach der Registrierung kam eine Lese-Tour mit acht Absätzen. Wer danach keinen
Wirkstoff beobachtet, bekommt nie einen Alarm, sieht keinen Nutzen und zahlt nie.

**WORK.** `services/ersteSchritte.js` + `GET /api/erste-schritte`: Vorschläge zum Antippen —
zuerst, was im Land amtlich knapp ist (mit Status und Quelle, „nicht lieferbar" vor
„eingeschränkt", ohne Doppelte), dann häufig benötigte Wirkstoffe in der Landessprache —
diese **ohne Status** (keine Engpass-Aussage ohne Quelle). Oberfläche: Schritt 1 große
Auswahl-Knöpfe + eigenes Feld, Zähler im Knopf, „Überspringen"; Schritt 2 Handy-Alarm
(dieselbe Karte wie unter Meldungen); Schritt 3 „Wir melden uns bei Ihren N Wirkstoffen" +
Tipp Sortiments-Check. Ersetzt die Tour für Neukunden (die Tour bleibt über „Hilfe").

**Tests.** `erste-schritte.test.js` (Reihenfolge, keine Doppelten, nur amtlich mit Status,
Sprache, schon Beobachtetes über Sprachen hinweg). Browser-Audit „Erste Schritte" als echter
Neukunde: Vorschläge antippen + eigener Wirkstoff → Zähler → Alarm → Abschluss → Liste hat genau
3 Wirkstoffe → kommt nicht wieder; Knöpfe ≥ 44 px, kein Querscrollen.

**Gegenproben (jede schlägt an):** Status ohne Quelle bei häufigen Wirkstoffen; alte Tour statt
erster Schritte.

### Cycle · Start im englischsprachigen Afrika: drei Ebenen Land / Afrika / Welt (2026-10-14)

**Auftrag (Owner):** Start im englischsprachigen Afrika; Nutzer:innen brauchen nationale,
afrikanische und weltweite Informationen.

**WORK.**
- 12 neue Länder (UG, TZ, ZM, ZW, RW, BW, NA, MW, ET, SL, LR, GM): Register mit Region, Behörde,
  Währung (UGX/RWF ohne Untereinheit, Simbabwe USD), konservative Rechts- und Zahlprofile (nur
  Software-Lizenzen, Krypto immer), Feature-Hinweise wie NG/KE/GH, Presse-Abfrage, je eine
  Behördenquelle mit Ministeriums-Rückfall (Startwerte, ungeprüft).
- Regionen im Datenmodell (`region`, `laenderInRegion`, `regionVon`) und Quell-Regionen `EU`,
  `AFR` (Africa CDC, WHO Afrika), `INT` (WHO) — neue Quellen.
- **Fehler behoben:** EMA-Meldungen (`EU`) wurden zu „AT" — erschienen als österreichische
  Behördenmeldungen. Ein Test schrieb das sogar als gewollt fest; korrigiert.
- `GET /api/news?ebene=land|region|welt` (Welt: WHO, EMA, Africa CDC + Behörden in der eigenen
  Sprache) und `GET /api/lage/ebene` (`services/regionLage.js`: je Land amtlich / nicht lieferbar
  / Apotheken-Meldungen getrennt, „keine amtliche Liste" ausdrücklich, in mehreren Ländern
  zugleich knapp über den Wirkstoff-Schlüssel mit Quelle je Land).
- Oberfläche: Umschalter „Land | Region | Welt" in News und Engpässe, Herkunft an jeder Meldung,
  Engpasslage je Land (antippen öffnet das Land). `docs/AFRIKA.md`.

**Tests.** `afrika-ebenen.test.js` (16 anglophone afrikanische Länder vollständig inkl. Krypto;
Engpasslage-Regeln; echter Server mit nachgestellten Feeds: Uganda sieht Land leer, Afrika =
NAFDAC + Africa CDC, Welt = + WHO, EMA, FDA ohne deutschsprachige Meldungen; Österreich ohne
EMA im Landesfeed; Mehrländer-Signal AT+US mit Quellen). Zählende Tests auf das Register
umgestellt. Browser-Audit „Afrika" (Uganda auf Englisch, Umschalter, 18 Länder, Land antippen).

**Gegenproben (jede schlägt an):** EMA-Fehler zurück; Region = alles; Welt ohne Sprachfilter;
Apotheken-Meldungen als amtlich; Mehrländer ohne Wirkstoff-Schlüssel.

**Ehrliche Lage:** „0 von 18 afrikanischen Ländern liefern eine amtliche Engpassliste" — die
Daten kommen dort aus Behördenmeldungen, Apotheken-Meldungen und kontinentalen Quellen.

### Cycle · Vertrauensstufen für Apotheken-Meldungen (2026-10-14)

**Warum:** Im englischsprachigen Afrika liefert keine Behörde eine auslesbare Engpassliste —
Meldungen aus Apotheken sind dort die schnellste Information. Eine einzelne Meldung und eine von
mehreren Apotheken getragene sahen aber fast gleich aus, und niemand erfuhr, wann aus einem
Hinweis ein bestätigter Engpass wurde.

**WORK.** `BESTAETIGT_AB_APOTHEKEN = 3` (Meldende + 2 Bestätigungen). `decorate` liefert
`apotheken` und `bestaetigt`; Schwelle erreicht → einmalig `shortage_bestaetigt` an
Beobachter:innen im selben Land und die Meldende (Kategorie „watch", Handy-Push mit Text in der
Landessprache, „nicht amtlich"). Karte zeigt gelb „noch nicht bestätigt" bzw. grün „Von 3
Apotheken bestätigt (nicht amtlich)". Engpasslage zählt `apotheken_bestaetigt`, Daten-Schnittstelle
liefert `bestaetigt_von`. Audit-Prüfpunkt Daten-Schnittstelle wartet jetzt gezielt statt fester
1,2 s (war ein Ausreißer).

**Tests.** `vertrauen.test.js` (Push-Text; echter Server: 1 → 2 → 3 Apotheken, Alarm genau einmal,
nur im Land, nicht für Kenia, Zurücknehmen/Neubestätigen ohne zweiten Alarm, Engpasslage zählt
getrennt). Browser-Audit „Vertrauen".

**Gegenproben (jede schlägt an):** Schwelle 2; ohne Einmal-Schutz; Alarm an alle Länder;
Bestätigte nicht getrennt gezählt.

### Cycle · Teilen in Afrika: Apotheken-Lage mit Vertrauensstufe (2026-10-14)

**Warum:** In Ländern ohne Behördenliste zeigte ein geteilter Link nur „noch keine Behördenliste"
— wertlos für WhatsApp-Gruppen. Und `wirkstoffLage` nahm den ersten Treffer egal welcher
Herkunft: Ein einzelner Apotheken-Hinweis hätte als „knapp in Uganda" im Titel gestanden
(Beispieldaten ebenso).

**WORK.** `wirkstoffLage` trennt amtlich (nur `verified`) und Apotheken (stärkste Meldung nach
Bestätigungen); Beispieldaten fallen weg. `lageDaten` zählt Apotheken-Meldungen und bestätigte
getrennt. Teilseite: „1 Apotheke meldet einen Engpass (noch nicht bestätigt)" bzw. „von 3
Apotheken als knapp gemeldet", Beschreibung „gemeldet aus Apotheken, nicht amtlich"; Lage ohne
Behördenliste mit Apotheken-Zahlen. de/en/pt.

**Tests.** `teilseite.test.js` (+2: Texte je Stufe; echter Server Uganda: keine Liste → Hinweis
→ bestätigt, Lage des Landes; nie „short in Uganda" für einen Hinweis).

**Gegenproben (jede schlägt an):** Apotheken als amtlich; Schwelle ignoriert; Lage ohne
Apotheken-Zahlen.

### Cycle · Aktualität von Apotheken-Meldungen (2026-10-14)

**Warum:** Eine Apotheken-Meldung blieb ewig „nicht lieferbar". In Ländern, die fast nur solche
Meldungen haben, sahen alte Meldungen aus wie neue — und niemand außer der Redaktion konnte
„wieder lieferbar" setzen.

**WORK.** `aktualitaet(s, heute)`: ab 14 Tagen ohne Bestätigung „pruefen", ab 30 „veraltet"
(amtliche Zeilen immer aktuell). Bestätigen und „Still short" frischen auf (`zuletzt_aktiv`).
Veraltete: nicht „bestätigt", nicht in Engpasslage, Daten-Schnittstelle, Teilseiten,
Sortiments-Check. `wiederLieferbar` nur für Meldende/Bestätigende/Redaktion, informiert
Beobachter:innen im Land. Job `aktualitaet` (6 h) erinnert die Meldende einmal je Runde
(`shortage_noch_aktuell`). Routen `/noch-aktuell`, `/wieder-lieferbar`. Karte zeigt Hinweis und
Knöpfe. Audit-Präfix „Meldungs-Aktualität" (kollidierte mit dem bestehenden „Aktualität").

**Tests.** `aktualitaet.test.js` (Stufen; Ablauf mit vorgespulter Uhr: Erinnerung einmal,
Still short frischt auf und zählt, nach 30 Tagen veraltet, nicht bestätigt, nicht in der
Engpasslage; Wieder lieferbar nur Beteiligte, Beobachter:innen informiert). Browser-Audit.

**Gegenproben (jede schlägt an):** Erinnerung ohne Merker; veraltet bleibt bestätigt; Lage
zählt veraltete; jeder darf „wieder lieferbar".

### Cycle · Afrika-Relevanz: Fälschungswarnungen und afrikatypische erste Schritte (2026-10-14)

**WORK.** `domain/warnung.js`: Stichwort-Erkennung „Fälschung" (Vorrang) und „Rückruf" in
Behördenmeldungen (en/de/pt; „fake" nur in fester Wendung). `/api/news` liefert `warnung`,
`nur=warnungen` filtert. Oberfläche: rotes/gelbes Etikett mit „automatisch erkannt — Einzelheiten
in der Quelle", Schalter „Nur Warnungen". Erste Schritte: afrikatypische Liste (Malaria,
Mutter-Kind, Kinder, Infektionen, HIV, TB) für Länder der Region Afrika (en/pt).

**Tests.** `warnungen.test.js` (Erkennung inkl. Fehlalarm-Fällen; Afrika-Liste vs. Europa; echter
Server: NAFDAC-Feed mit Warnung + Workshop → Filter zeigt nur die Warnung, Uganda bekommt
Artemether/Lumefantrin zuerst). Browser-Audit „Warnungen".

**Gegenproben (jede schlägt an):** „fake" allein; Filter ignoriert; Region nicht durchgereicht.

### Cycle · Offline lesbar für schwache Netze (2026-10-14)

**WORK.** Service Worker: Lese-Ansichten (Engpässe, Nachrichten, Beobachtung, Übersicht, Lage,
Wirkstoff, Konto, Länder) werden netz-zuerst geladen; bei Netzausfall kommt der letzte Stand mit
`x-apo-offline` und Zeitpunkt. Speicher-Schlüssel mit SHA-256 des Tokens (je Konto getrennt).
App: Hinweis „Offline — gespeicherter Stand von …"; Abmelden/Konto löschen/401 leeren den
Speicher. Server: `Cache-Control: no-store` auf allen API-JSON-Antworten (Befund unterwegs: der
Browser-HTTP-Cache war bisher nicht ausgeschlossen).

**Audit-Lehre.** Playwright `setOffline`/`route` erreichen Anfragen aus dem Service Worker nicht —
die erste Fassung der Offline-Prüfung lief gegen das Netz und bewies nichts. Jetzt: eigener
Prüfserver, der beendet wird. Außerdem laufen alle anderen Audit-Blöcke mit
`serviceWorkers: 'block'` (sonst umgehen SW-Anfragen die `page.route`-Nachbildungen von
Chronik/Frühwarnung).

**Tests.** `offline.test.js` (Liste der speicherbaren Pfade gegen private Pfade; Hash statt Token;
Abmelden leert; `no-store` auf Erfolg und Fehler).

**Gegenproben (jede schlägt an):** `no-store` entfernt; `/api/dm` in die Liste; Abmelden ohne
Leeren.

### Cycle · Datensparsam: Bilder per Adresse statt eingebettet (2026-10-14)

**Befund.** Bilder lagen als data:image-URL in jeder API-Antwort; `author.avatar_url` stand in
jedem Beitrag. Zehn Beiträge mit 60-KB-Profilfoto ≈ 660 KB je Feed-Laden. Kein Test prüfte das.

**WORK.** `domain/bilder.js`: Ersetzer für `JSON.stringify` (jede data:image → `/api/bild/<sha256>`),
Ablage hash→Bild (höchstens 5000, älteste zuerst raus; die nächste Antwort legt neu an).
`GET /api/bild/:hash` mit `private, immutable`, ETag/304, nosniff. `cleanImage` löst eigene
Adressen auf (Bearbeiten ohne neues Bild). Datenexport bettet weiter ein. App: `istBild()` statt
`/^data:image/`, `loading="lazy"`.

**Tests.** `bilder.test.js` (Adresse stabil, Bytes stimmen, fremde/unbekannte Adressen abgelehnt;
echter Server: Feed ohne data:image und < 30 KB, Bild 200 + immutable + 304, Profil mit Adresse
zurück speichern, Export mit Bild). Browser-Audit „Bilder" (Bild per Adresse sichtbar, lazy).

**Gegenproben (jede schlägt an):** ohne Ersetzer; Export ersetzt; keine Auflösung in `cleanImage`.

### Cycle · Datumsformat in Afrika + Datenmessung (2026-10-14)

**Messung.** Erster Besuch 306 KB (app.js 181, i18n.js 102 gzip), erneutes Öffnen 4 KB
(Service Worker + ETag). Bild-Uploads werden schon auf dem Gerät verkleinert. Nachrichten wurden
beim Start zweimal geladen → gemeinsame Abfrage (`newsKurz`, 10 s).

**Befund.** Die 12 neuen Länder fehlten in `REGIONAL_TAGS`. Schwerer: `en-ET` löst in ICU auf `en`
(USA) auf. Ein Eintrag „ET:'en-ET'" hätte Äthiopien Monat-vor-Tag gezeigt, und
`supportedLocalesOf` meldet die Kennung trotzdem als unterstützt.

**WORK.** Tabelle ergänzt (ET → en-GB). `bcp47()` nimmt eine Länderkennung nur, wenn
`resolvedOptions().locale` sie genau so auflöst. Zwei Stellen ohne Landesformat korrigiert.

**Tests.** `datumsformat.test.js` führt die echte `bcp47()` per vm aus: jedes Land in der Tabelle,
nur die USA mit Monat vor Tag. **Gegenproben:** ET='en-ET' ohne Sicherung → rot; GM vergessen → rot.

### Cycle · Kolleg:innen einladen und um Bestätigung bitten (2026-10-14)

**Warum.** In Afrika gibt es meist keine Behördenliste. „Bestätigt" braucht 3 Apotheken, und es gab
keinen Weg, Kolleg:innen gezielt dazuzuholen.

**WORK.** `services/einladungen.js`: zufällige, gespeicherte Codes; Zuordnung einmal, nie sich
selbst; ohne Belohnung. `GET /api/einladung`; Registrierung mit `einladung`; Benachrichtigung
„einladung". Teilseite: Code in den Knopf (nur bekannte), bei unbestätigter Apotheken-Meldung „Confirm
… in ApoPulse" + `bestaetigen=1`. App: Knopf „Ask colleagues to confirm" an eigener/bestätigter,
noch nicht bestätigter Meldung; Menüpunkt mit Zähler; nach der Registrierung direkt zur Meldung.
Nebenbei: doppelter „Available again"-Knopf für Meldende entfernt (`resolve` = `wieder-lieferbar`).

**Tests.** `einladungen.test.js` (Codes, Zuordnung, Löschen, Speichern; echter Server: Teilseite →
Registrierung → Benachrichtigung → nach 3 Apotheken keine Bitte mehr → Neustart behält Code).
Browser-Audit „Einladen": ganzer Weg bis zur Bestätigung.

**Gegenproben (jede schlägt an):** nicht gespeichert; keine Benachrichtigung; Bitte auch bei
bestätigter Meldung; fremder Code durchgereicht.

### Cycle · Schein-Konten bremsen + Login-Bremse je Konto (2026-10-14)

**Befund.** (1) Registrierungen sind unbegrenzt, Bestätigungen zählen sofort: zwei Schein-Apotheken
reichten für „von 3 Apotheken bestätigt". Die Einlade-Funktion macht das wichtiger. (2) Die Client-IP
kommt aus dem ERSTEN `X-Forwarded-For`-Eintrag (vom Client gesetzt); die Login-/Reset-Bremse
`ip|email` war mit wechselnder Angabe unbegrenzt umgehbar (Passwort- und Wiederherstellungscode-Raten).

**WORK.** `zaehlendeApotheken`/`istBestaetigt` in `shortages.js`: Konten unter 24 h zählen nicht zur
Schwelle; eine Stelle für Liste, Teilseite, `lageDaten`, `wirkstoffLage`, `regionLage`, Alarm.
`erinnern()` holt den „bestätigt"-Alarm nach, wenn Konten gealtert sind. UI: „3 pharmacies report —
confirmations from new accounts count after 24 hours". Login/Reset zusätzlich je Konto begrenzt.
IP-Grenze bei Registrierung erwogen und verworfen (Carrier-NAT; Proxy-Kette nicht prüfbar).

**Tests.** `schein-konten.test.js` (Uhr: frische Konten → nicht bestätigt, kein Alarm; +25 h →
bestätigt, Alarm genau einmal, Lage zählt; HTTP-Voreinstellung; 21 Fehlversuche mit wechselndem
XFF → 429). Bestehende HTTP-Tests und der Browser-Audit mit `APOPULSE_BESTAETIGUNG_AB_STUNDEN=0`.

**Gegenproben (jede schlägt an):** Alter ignoriert; kein Nachholen; Login nur je IP; Lage zählt alle.

### Cycle · Moderation: Apotheken-Meldungen prüfen (2026-10-14)

**Warum.** Die 24-Stunden-Regel verzögert Schein-Konten nur; die Doku versprach, dass die
Moderation in der Zeit sieht, was passiert, aber eine Ansicht dafür gab es nicht. Außerdem hätte das
vorhandene Moderations-„Auflösen" allen Beobachter:innen „wieder verfügbar" gemeldet.

**WORK.** `shortages.pruefliste` (nur Moderation): aktive Apotheken-Meldungen mit Signalen
`neue_konten`, `eingeladen` (Bestätigende von der Meldenden eingeladen, `einladungen.vonWem`) und
`kurz_nacheinander`; je Beteiligter Kontoalter, Verifizierung, Einladung.
`modBestaetigungEntfernen`, `modEntfernen` (Repo `remove`, Benachrichtigung `shortage_entfernt` an
die Meldende, kein „wieder verfügbar"). Routen `/api/mod/meldungen…`. Karte in der Moderation
(de/en/pt).

**Tests.** `meldungs-pruefung.test.js` (Uhr; auffällig vs. unauffällig, Signale exakt, 403 ohne
Moderation, Entfernen ohne Beobachter-Hinweis; HTTP mit frischen Konten). Browser-Audit
„Meldungsprüfung". **Gegenproben:** Entfernen über wieder-lieferbar; Einladungs-Signal fehlt; ohne
Moderations-Prüfung — jede schlägt an.

### Cycle · Moderation von selbst informiert + Startklar-Warnung Schein-Konten-Schutz (2026-10-14)

**WORK.** `pruefSignale` aus der Prüfliste gelöst (eine Logik für Liste und Hinweis).
`pruefungMelden`: Erreicht eine auffällige Apotheken-Meldung 3 Beteiligte, bekommen alle
Moderator:innen einmal `meldung_pruefen` (Klick öffnet die Moderation). Startklar: „Schutz vor
Schein-Konten ist abgeschaltet" (fehlt), wenn `APOPULSE_BESTAETIGUNG_AB_STUNDEN` < 24 gesetzt ist.
Interne Merker (`pruef_gemeldet`, `bestaetigt_gemeldet`) gehen nicht mehr in API-Antworten.

**Tests.** `meldungs-pruefung.test.js` erweitert (genau ein Hinweis, kein Doppel nach
Zurücknehmen/Neu-Bestätigen; Startklar 0 → fehlt, ungesetzt/48 → nichts). **Gegenproben:** ohne
Hinweis; ohne Einmal-Sperre; Startklar stumm — jede schlägt an.

### Cycle · Rundgang „neue Apotheke in Uganda" — erster Eindruck (2026-10-14)

**Methode.** Kompletter Weg im Browser (390 px, en-US, Africa/Kampala) mit Bildschirmfotos.

**Befunde → WORK.**
1. Länderwahl für alle auf Deutsch, Uganda an 17. Stelle → Sprache des Browsers, Vorschlag aus der
   Zeitzone (Vorrang vor Sprach-Region), Gruppen nach Region, alphabetisch.
2. „Compare prices & deals" versprochen ohne Preisdaten (live: nirgends) → `/api/countries.preise`,
   `landHatPreise()`.
3. Rabatt-Alarme an der Beobachtungsliste ohne Preise → ausgeblendet.
4. Wiederherstellungscodes umgebrochen („G96DD-" / „EZFW5") → `nowrap`, einspaltig unter 420 px.
5. Leere Engpassliste ohne Filter zeigte „Reset the filter" → Aufforderung zu melden + Knopf.

**Tests.** Browser-Audit „Erster Eindruck" (Liberia; Gegenprobe Österreich auf Deutsch).
`laenderwahl.test.js` (mit/ohne Beispieldaten). **Gegenproben:** Preise immer an, Sprache fest,
Zeitzone ohne Vorrang → fünf Befunde, wie erwartet.

### Cycle · Rundgang Uganda, Teil 2: Nachrichten und Afrika-Lage (2026-10-14)

**Befunde → WORK.**
1. „Affected: nda_ug_news" (interne Kennung) → `coverage.landStatus.stumm_namen` (Label der Quelle),
   App zeigt Namen.
2. Quellen-Ausfall rot, obwohl Rot „kritischer Engpass" heißt → gelb (`warn`). Von „veraltet" bleibt
   es über Symbol und Text unterscheidbar.
3. „Showing the last known state", auch wenn nie etwas ankam → „We keep retrying automatically".
4. Afrika-Lage: 18 gleiche Zeilen ohne Information → eine Sammelgruppe mit Länder-Knöpfen.

**Tests.** `coverage.test.js` (Name statt Kennung; Gegenprobe Kennung → rot). Browser-Audit
„Afrika": Uganda benennt die fehlende Liste auch in der Gruppe; keine informationslose Einzelzeile.

### Cycle · Rundgang Uganda, Teil 3: Melden und Premium (2026-10-14)

**Befunde → WORK.** Meldeformular in Ordnung; das Datumsfeld folgt der Gerätesprache, das ist von
der Seite aus nicht steuerbar. Premium: deutscher Produktname „ApoPulse Premium (Monat)" in der
englischen Oberfläche → `produktName()` mit `pn_*` (de/en/pt), auch in der Krypto-Prüfkarte.
„Amount at fetch time – please send €9.99" → Klartext, wenn der Kurs fehlt. Krypto-Ablauf unverändert.

**Tests.** Browser-Audit „Erster Eindruck" prüft die Premium-Zeile (Gegenprobe: alter Name → rot).

### Cycle · Rundgang Uganda, Teil 4: Wirkstoff-Seite, Live-Warnungen, Menü (2026-10-14)

**Befunde → WORK.** Wirkstoff-Seite zeigte in Ländern ohne Preise „Price comparison 0" und „Running
deals 0" → nur mit Preisen/Aktionen. Live-Warnungen zeigten Apotheken „AI enrichment is not
configured" (Betreiber-Angabe) → nur für die Moderation; Apotheken bekommen bei vorhandenen Meldungen
einen Klartext-Hinweis, die Sicherheits-Ansicht ihre Erklärung ohne „KI". Menü: „Invite colleagues"
vor „Advertise".

**Tests.** Browser-Audit „Erster Eindruck" (Wirkstoff-Seite, Live-Warnungen); Gegenprobe → beide rot.

### Cycle · Sprache: CSV-Kopf, Benachrichtigungen, Push-Inhalt (2026-10-14)

**Prüfung.** Schlüssel de/en/pt vollständig (0 fehlend); mutmaßlich unübersetzte Werte nur
internationale Wörter. Feste deutsche Texte im Code gesucht.

**Befunde → WORK.**
1. CSV der Beobachtungsliste mit festem Kopf „Wirkstoff;Aktueller Status;Präparat;Notiz" → i18n.
2. `watch_alert`-Labels vom Server deutsch („… · Kritischer Engpass (Community-Meldung)") → App
   übersetzt die festen Bausteine (`notifLabel`), auch für schon gespeicherte Benachrichtigungen.
3. **Inhaltlicher Fehler:** Push zu `watch_alert` sagte immer „meldet … als knapp", auch bei
   „wieder verfügbar" und bei Terminänderungen. Jetzt nach Inhalt: knapp / eingeschränkt / wieder
   verfügbar / neuer Termin (de/en/pt).

**Tests.** `benachrichtigung-sprache.test.js` (Push je Inhalt; echte `notifLabel` per vm; Bausteine
des Servers abgeglichen). Browser-Audit „Erster Eindruck": CSV-Kopf. **Gegenproben:** Push ohne
Inhaltsweiche; CSV-Kopf deutsch — beide rot.

### Cycle · Fehlermeldungen in der Sprache der Oberfläche (2026-10-14)

**Befund.** Die App übersetzt Fehler über `e_<code>`. 134 von 167 Codes hatten keine Übersetzung —
in Uganda erschienen sie deutsch („Wieder lieferbar melden kann, wer …"). Dynamische Meldungen
(Format der Transaktions-ID) verloren beim Übersetzen ihre Werte.

**WORK.** Alle 134 Codes in de/en/pt. Server schickt `params` mit (tx_format: Kette + Format,
api_limit/api_zu_viele: Zahl); die App füllt `{…}` und nimmt sonst lieber die Server-Meldung als
einen Text mit offenem Platzhalter. Neuer Fallback `e_unbekannt` statt „Fehler 400".
`shortages.js` (Melden, Bestätigen, Status — Kern für Afrika): alle Fehler mit Code statt
`new Error('…')`; sechs neue Codes übersetzt.

**Offen.** Etwa 170 weitere `new Error('…')` ohne Code in anderen Diensten (social, network, collab …)
— bleiben deutsch, bis sie Codes bekommen.

**Tests.** `fehler-sprache.test.js`: jeder Code des Servers in de/en/pt (schützt vor Rückfall);
tx_format über HTTP mit `params`. Browser-Audit „Erster Eindruck": Fehler beim Melden einer
Krypto-Zahlung erscheint englisch mit erwartetem Format. **Gegenproben:** ohne `params`;
Übersetzung entfernt; e_tx_format entfernt → jeweils rot.

**Nachtrag (Lehre).** 11 Codes hatten keine direkt auslesbare Meldung; ihre Bedeutung habe ich zuerst
aus dem Code-Namen geraten. Bei `link_invalid` falsch („gültigen Link angeben" statt „Abmelde-Link
ungültig") — der Browser-Audit „Wochenbericht" fing es. Danach alle 11 an der Fundstelle
abgeglichen; `quelle_ungueltig` reicht die genaue Begründung jetzt als `{detail}` durch. Regel:
Übersetzungen nur aus der Meldung an der Fundstelle, nie aus dem Code-Namen.

### Cycle · Fehler ohne Code: 103 Fundstellen nachgerüstet (2026-10-14)

**WORK.** Alle wörtlichen `new Error('…')` ohne Code gesammelt (67 verschiedene Meldungen). Code je
Meldung anhand des Meldungstexts zugeordnet, bestehende Codes gleicher Bedeutung wiederverwendet,
39 neue Codes in de/en/pt. Code per `Object.assign(new Error('…'), { code })` angehängt —
Meldungstext und Statuscode unverändert. 103 Fundstellen in 11 Dateien (social, network, collab,
exchange, orgAuth, server …). `bezeichnung_zu_lang` ohne Zahl (Austausch nutzt ihn mit anderer Grenze).

**Bleibt ohne Code (33).** Intern (Datenbank-Treiber, Kursabruf, Quellen-Parser, Signal-Pflichtfelder)
und Meldungen mit eingesetzten Werten.

**Tests.** `fehler-sprache.test.js` erkennt die neuen Codes und verlangt Übersetzungen; neuer Riegel:
höchstens 33 Fehler ohne Code (Gegenprobe: ein Code entfernt → rot).

### Cycle · Öffentliche Seiten: Landing für Länder ohne Behördenliste (2026-10-14)

**Befund.** `/engpaesse/ug` → 404 „Seite nicht gefunden" (deutsch); Übersicht immer deutsch.

**WORK.** `oeffentlicheSeiten`: `ohneQuelle(cc)` (keine Engpass-Quelle eingetragen) → Landing-Seite
ohne Daten mit Weg in die App; Länder mit Quelle ohne Daten bleiben 404. Index/404 nach
Accept-Language (Vary). Landing-Seiten in Sitemap und Übersicht.
Ehrlichkeit: zuerst „es gibt keine öffentliche amtliche Liste" formuliert — für Portugal womöglich
falsch. Jetzt: „ApoPulse erhält (noch) keine amtliche Engpassliste".

**Tests.** `oeffentliche-seiten.test.js` (PT/UG Landing ohne Engpass-Zeilen, englische Übersicht,
englische 404, Sitemap). Browser-Audit „Öffentliche Seiten" (en-UG). Gegenprobe: `ohneQuelle` aus → rot.

### Cycle · Startseite: Vorschau in der Sprache des Browsers (2026-10-14)

**Befund.** Geteilte Hauptadresse zeigte in WhatsApp & Co. immer „Lieferengpässe mit Quelle —
Behördenlisten aus Europa" (deutsch); Vorschaubild mit relativer Adresse.

**WORK.** `http/startseiteKopf.js`: Titel, Beschreibung, og:title/description nach Accept-Language
(de/en/pt, sonst Englisch), og:image absolut. „aus Europa" ersetzt durch „Behördenlisten und Meldungen
aus Apotheken". ETag je Sprache, `Vary: Accept-Language`. App-Inhalt unverändert.

**Tests.** `startseite-kopf.test.js` (Sprachwahl inkl. Suaheli → Englisch; HTTP: Kopf je Sprache,
absolutes Bild, eigener ETag, 304, Skripte unverändert). Gegenprobe: ohne Umbau → rot.

### Cycle · App-Manifest in der Sprache des Browsers (2026-10-14)

**Befund.** `manifest.webmanifest` nur deutsch („ApoPulse – Apotheker-Netzwerk", Schnellzugriffe
„Lieferengpässe/Für dich/News/Preise"); „Preise" führt ohne Preisdaten (live: überall) ins Leere.

**WORK.** `manifestSprache()` (http/startseiteKopf.js): Name, Beschreibung, lang, Schnellzugriffe und
Bildbeschriftungen nach Accept-Language; Schnellzugriff und Screenshot „Preise" entfallen.
Ausgeliefert wie die Startseite (ETag je Sprache, Vary).

**Tests.** `startseite-kopf.test.js`: Manifest en/pt, keine Preise, unlesbares JSON unverändert.

### Cycle · Regionale Premium-Preise mit einer Einstellung (2026-10-15)

**Befund.** Offener Owner-Punkt „Preis für Afrika": 9,99 € überall, keine Möglichkeit, Premium
für afrikanische Apotheken günstiger anzubieten, ohne Code zu ändern.

**WORK.** `domain/regionPreis.js` (`regionFaktoren`, `preisCents`), `payments.js` mit Option
`preisFuer` (Krypto-Anzeige und -Start, Überweisung/Rechnung, Checkout), `server.js` liest
`APOPULSE_PREISE_REGION`; Heimatland des Kontos entscheidet, ohne Anmeldung das angefragte Land.
`/api/payments/products` liefert die Regionalpreise; die Premium-Seite fragt sie mit dem
gewählten Land ab (sonst stünden ohne Anmeldung 3,00 € neben 9,99 €). Höhe = Owner-Entscheidung.

**Tests.** `region-preis.test.js` (3). Gegenproben: Ansichtsland zuerst → rot; Krypto-Start mit
Listenpreis → rot (999 ≠ 300); Rechnung mit Listenpreis → rot.

### Cycle · Brotli und Kompressions-Speicher für mobile Daten (2026-10-15)

**Befund.** Erstes Öffnen ≈ 320 KB gzip (app.js 189, i18n.js 116); app.js wurde bei jeder Anfrage
neu gezippt; kein Brotli; unkomprimierte Antworten ohne `Vary: Accept-Encoding`.

**WORK.** `http/komprimierung.js`: `kodierungWaehlen` (br vor gzip, q=0 = nein),
`kodierenSync` (JSON/Startseite, Brotli Stufe 5), `createKompressionsSpeicher` (Brotli 11 / gzip 9
je Pfad+ETag einmal, asynchron, begrenzt). server.js nutzt es für statische Dateien, Startseite,
Manifest und `json()`; Vorwärmen nach dem Start nur mit `NODE_ENV=production`. Ergebnis: app.js
144 KB, i18n.js 87 KB (−24 % gesamt); vorgewärmt in wenigen ms ausgeliefert.

**Tests.** `komprimierung.test.js` (3). Gegenproben: ETag ignoriert → rot (alte Version);
q=0 ignoriert → rot; kein Vary unkomprimiert → rot; Brotli Stufe 1 → rot (größer als gzip).
Nicht gemacht: i18n.js je Sprache aufteilen (weitere ~60 KB) — Länderwahl zeigt mehrere Sprachen
gleichzeitig und Rückfall auf Deutsch; eigener Schritt mit Offline-Cache-Umbau.

### Cycle · Versionskennung aus dem Inhalt: Deploy ≠ Neu-Download (2026-10-15)

**Befund.** ETag = Größe + mtime. Render (`runtime: node`) baut aus frischem Git-Klon → neue mtime
für alle Dateien → nach jedem Deploy lud jedes Gerät app.js, i18n.js, app.css, sw.js, Icons neu.

**WORK.** `createVersionsKennung()` (http/komprimierung.js): SHA-256 des Inhalts (22 Zeichen),
neu gerechnet nur bei geänderter Größe/mtime; Sprachzusatz für Startseite/Manifest wie bisher.
server.js nutzt sie für alle statischen Dateien (und als Schlüssel des Kompressions-Speichers).

**Tests.** `komprimierung.test.js` (+1, + Deploy-Fall über HTTP mit `utimes`). Gegenproben:
Kennung wieder aus Größe+Zeit → rot (Unit + HTTP 304); Inhalt nie neu prüfen → rot.

### Cycle · Schlanke Skripte: app.js 144 → 105 KB (2026-10-15)

**GATHER.** Messung Uganda-Rundgang (Playwright, übertragene Bytes): API-Anfragen ~16 KB, Neuladen
dank Inhalts-ETag 7 KB; Rest = app.js 145 KB + i18n.js 87 KB beim ersten Öffnen. app.js ohne
Zeilenkommentare/Einrückung: 110 KB.

**WORK.** `http/schlank.js`: Zerleger (Zeichenketten, Vorlagen mit `${}`-Verschachtelung,
reguläre Ausdrücke inkl. Klassen) entfernt Kommentare, Einrückung, Leerzeilen, doppelte
Leerzeichen; je Zeilenumbruch bleibt einer (Semikolon-Regel). `schlankSicher` mit vm.Script-Probe
und Rückfall. Kompressions-Speicher bekommt `umformen` und Kodierung `roh` (auch unkomprimiert
dieselbe Fassung, Content-Length). `APOPULSE_SCHLANK=aus` schaltet ab.

**Tests.** `komprimierung.test.js` +3 (Beispielprogramm mit Fallen in `test/fixtures/` — gleiches
Ergebnis ausgeführt; Rückfall; Token- und Umbruch-Abgleich mit acorn für app.js/i18n.js/sw.js,
übersprungen ohne acorn). Gegenproben: `${` ignoriert, Regex-Erkennung aus, Zeichenketten aus,
Umbrüche → Leerzeichen — alle rot. **Lehre:** Die Umbruch-Mutation ließ sich übersetzen (app.js
setzt Semikolons) → die vm-Probe ist kein Gleichheitsbeweis, der Token-Abgleich ist es. Und:
`deepEqual` auf 128 000 Einträge sprengte bei Abweichung den Speicher → erste Abweichung suchen.

### Cycle · Schmale Handys: Menü-Knopf ragte aus dem Bild (2026-10-15)

**GATHER.** Probe 320/360px (+ große Schrift) über alle Reiter, Konto UG/en: Querscroll und
`header .kopf-btn` „Menu" bei 290–354px (W=320) auf jedem Reiter; ebenso 360px mit großer Schrift.
„Unlock" 11,05px (button.small 0.85em in 13px-Hinweis). Audit prüfte alle Reiter erst ab 390px.

**Abgewogen, nicht gemacht:** i18n.js je Sprache (~58 KB einmalig) — sieben synchrone
`setLocale`-Stellen inkl. Ansicht anderer Länder und Offline-Wechsel; Risiko > Nutzen.

**WORK.** app.css: bis 380px nur Logo-Symbol (`.logo-txt` aus; aria-label bleibt);
`button.small` mindestens 13px. Audit-Block „Günstige Android-Handys": alle Reiter 320px und
360px+große Schrift, Uganda: Querscroll, Kopf-Knopf außerhalb, Schrift < 12px.

**Gegenprobe.** Audit mit altem app.css → meldet Querscroll, „Kopf-Knopf ragt aus dem Bild" und
„Unlock (11.05px)" je Reiter; mit neuem CSS sauber. Portugiesisch (MZ, „Alertas") geprüft.

### Cycle · Antibiotika-Hinweis passend zu Land und Sprache (2026-10-21)

**GATHER.** Live-Seite aus dieser Umgebung nicht erreichbar (Proxy 403). Sprach-Scan (Playwright,
Konto UG/en): alle Reiter, jeder Menü-Eintrag, Glocke, Wirkstoff-Seite → 3 Funde, alle im AMR-Panel
(services/amr.js: deutscher `note`/`disclaimer`, nur AT-Quellen). Erkennung nur deutsche INN-Formen.
MZ/pt-Scan: nur Fehlalarme („das" ist auch Portugiesisch).

**WORK.** amr.js: Erkennung über `wirkstoffSchluessel` (+ Teiltreffer ab 6 Zeichen, WHO-EML-Antibiotika
ergänzt); `forWirkstoff(name, { land })` → Quellen AT = AGES/AURES, sonst WHO (AWaRe-Buch per
Websuche bestätigt; Faktenblatt), Beschriftung nach `locale_default` des Landes. Text in i18n
(`wk_amr_note`, `wk_amr_disclaimer`, de/en/pt). Africa CDC bewusst nicht: keine offizielle Seite bestätigt.
Audit-Block „Deutsch in englischer Oberfläche" (Reiter + Wirkstoff-Seite, Konto UG).

**Tests.** `amr.test.js` (5): Erkennung de/en/pt, keine Fehltreffer (Penicillamin, Clavulansäure allein),
Quellen je Land, Sicherheitssatz in 3 Sprachen, HTTP UG/AT. Gegenproben: Land ignoriert, Erkennung
ohne Schlüssel, Teiltreffer jeder Länge, Oberfläche mit Server-Text → jeweils rot. Audit gegen alten
Stand meldet die drei Fundstellen.

### Cycle · Sackgassen zu ruhenden Bereichen; Patienten-Infokarten für Afrika (2026-10-21)

**GATHER.** Nach dem AMR-Fix die Knöpfe im Kasten angetippt: „Fachdiskussion", „Patienten-Infokarten"
und die Forum-Karte auf der ÜBERSICHT (alle Konten) → „That didn't work — Nicht gefunden". Ursache:
`social` und `patienteninfo` ruhen (404), Einstiege ungeprüft sichtbar; 404 ohne Code → Deutsch.
patientInfo.js: Sprachen de/en/tr, Standard 'de', Quelle nur AGES, „Reste in die Apotheke bringen".

**WORK.** app.js: Forum-Karte, `data-forum`, `data-pinfo` nur bei `featureAn(...)`; server.js: 404
mit `code: 'not_found'` (+ e_not_found de/en/pt). patientInfo.js: pt, Quelle je Land (AT AGES / sonst
WHO), Entsorgungs-Karte `welt`-Variante außerhalb AT; Route mit `activeCountry`. app.js: patientLang/
zettelLang null → Oberflächensprache, `&country=`, pt in Druckblatt und Einnahmeplan.
Audit-Block „Keine Sackgassen" (Übersicht-Karten, AMR-Knöpfe).

**Tests.** `patient-info-land.test.js` (5). Gegenproben: Entsorgung ohne Variante, Quelle immer AGES,
404 ohne Code → rot. Audit mit altem app.js meldet die Sackgassen (Forum auf Übersicht,
Patienten-Infokarten im Kasten).

