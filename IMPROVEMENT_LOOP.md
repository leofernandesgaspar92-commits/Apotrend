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

### Cycle #106 — 2026-07-20 — Beide Solana-Wallets (Seeker + Phantom) + voller App-Durchlauf verifiziert
- **THINK:** Owner bestätigt: BEIDE SOL-Adressen gehören ihm (Seeker „leokennedy.skr" + Phantom, beide nur SOL). Beide einbauen; Kund:in wählt die Wallet. Danach die ganze App auf ein reibungsloses Kund:innen-Erlebnis prüfen.
- **WORK:** `cryptoWallets` von Map auf **Liste** umgestellt (mehrere Wallets je Coin, stabile `id` + `label`); zwei SOL-Wallets vorbelegt (ENV: `APOTREND_WALLET_SOL_SEEKER`/`_PHANTOM`). Service/Route/Frontend auf `walletId` umgestellt; Zahlungsdatensatz trägt jetzt `coin`/`wallet_id`/`address` für die Zuordnung. Premium-UI zeigt je Wallet Label (z. B. „SOL · Seeker · leokennedy.skr").
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
