# ApoTrend Plattform-Backend

Neuer, **zustandsbehafteter** Backend-Pfeiler für die Hybrid-Plattform
(Collab / Market / Network). Getrennt vom bestehenden `backend/` (das sind
zustandslose Vercel-Daten-Fetcher — Engpass/News/Preise) und von `frontend/`
(PWA/Desktop).

> **Status (Neu-Priorisierung: Social-Feed = Kern):**
> - ✅ **Preisverlauf-Sparkline:** jede Lieferanten-Zeile im Preisvergleich zeigt eine
>   kompakte Trendlinie aus den letzten Preisen (steigend rot / fallend grün / gleich
>   grau) — die Richtung steht zusätzlich als ▲/▼-Prozent daneben, also nie nur über
>   Farbe (barrierefrei). Einzelserie, dünne 2px-Linie, dezent. (Frontend-SVG aus dem
>   `series`-Feld; im Browser verifiziert.)
> - ✅ **Beobachtungsliste — Schnell-Vorschläge:** die Beobachtungsliste auf „Für dich"
>   schlägt aktuell kritische Wirkstoffe als Ein-Klick-Chips vor („🔴 Amoxicillin +"),
>   solange sie noch nicht beobachtet werden — neue Nutzer:innen kommen sofort zum
>   Nutzen, ohne Tippen. (Frontend, aus `overview.shortages.top`; im Browser verifiziert.)
> - ✅ **Engpässe filtern & suchen:** der Engpässe-Reiter hat eine Such- und Filterleiste
>   (Alle / 🔴 Nur kritisch / ⭐ Beobachtet / 👥 Community) plus Textsuche nach
>   Wirkstoff/Präparat. Filterung ohne Neu-Laden (Suchfokus bleibt erhalten) — wichtig,
>   da die Liste mit Community-Meldungen wächst. (Frontend-Filter über die vorhandenen
>   Felder; 160 Tests grün, im Browser verifiziert.)
> - ✅ **Aktionen zu beobachteten Wirkstoffen (Beobachtungsliste ↔ Rabatte):** läuft für
>   einen Wirkstoff, den die Apotheke beobachtet, gerade eine Rabatt-Aktion, erscheint sie
>   auf „Für dich" als eigene Karte („🏷️ Aktionen zu deinen Wirkstoffen" — beste Aktion je
>   Wirkstoff, mit Ablaufhinweis). Verbindet Engpass-Beobachtung und Einkaufs-Vorteil.
>   (`overview.watch_deals`; 160 Tests grün, API/Browser verifiziert.)
> - ✅ **Rabatt-Ablaufwarnung:** laufende Aktionen tragen die Restlaufzeit; endet eine
>   Aktion in ≤14 Tagen, zeigt der Rabatt-Reiter ein „⏳ nur noch X Tage"-Badge
>   (≤3 Tage rot, sonst orange). Die Startübersicht „Für dich" warnt zusätzlich
>   („N Aktionen laufen bald ab" + dringendste Aktion) — kein verpasstes Angebot mehr.
>   (`rabatteRepo.listTop10` liefert `days_left`/`expiring_soon`, Overview `rabatte_expiring`;
>   158 Tests grün, im Browser verifiziert.)
> - ✅ **Preisvergleich mit Sparpotenzial:** der Preis-Reiter zeigt oben, wie viel bei
>   optimaler Großhändler-Wahl je Packung frei wird („💶 Sparpotenzial: bis zu € X pro
>   Packung" + Top-3-Präparate); jede Vergleichsgruppe trägt ein Ersparnis-Badge
>   („💰 −€ X günstiger bei …"), der günstigste Anbieter ist hervorgehoben. Konkreter
>   Marge-Vorteil auf einen Blick. (`GET /api/prices` liefert `savings`; 154 Tests grün,
>   im Browser verifiziert.)
> - ✅ **Community-Engpassmeldung („Frühwarnnetz"):** Apotheker:innen melden selbst
>   beobachtete Lieferengpässe („➕ Engpass melden" auf dem Engpässe-Reiter) — oft weiß
>   die Frontline früher Bescheid als offizielle BASG-Daten. Herkunft klar als
>   👥 Community-Meldung gekennzeichnet (nicht offiziell verifiziert), mit Melder-Handle.
>   Beobachter:innen des Wirkstoffs werden sofort benachrichtigt. Andere Apotheken
>   bestätigen mit „➕ Auch bei uns" (Zähler „N weitere Apotheken bestätigt", Melder wird
>   informiert). Doppel-/Fehlklick-Schutz, Melder-Identität DSGVO-anonymisierbar.
>   Die meldende Apotheke (oder Moderation) schließt die Meldung mit „✓ Wieder lieferbar";
>   Beobachter:innen **und** Bestätiger:innen werden informiert, danach ist der Wirkstoff
>   wieder frei meldbar. (`POST /api/shortages/report|:id/confirm|:id/resolve`; 149 Tests
>   grün, end-to-end im Browser verifiziert.)
> - ✅ **Engpass-Status-Alarm für beobachtete Wirkstoffe:** ändert die Redaktion/
>   Moderation den Status eines Engpasses (nur mit **Pflicht-Quelle**, http[s]-Link —
>   sicherheitsrelevant lt. CLAUDE.md), werden alle Apotheker:innen benachrichtigt,
>   die diesen Wirkstoff beobachten („⭐ Neuer Status bei deinem beobachteten
>   Wirkstoff: Amoxicillin · Wieder verfügbar"). Klick springt zu den Engpässen.
>   Redaktions-Editor direkt an jeder Engpass-Karte. (`POST /api/shortages/:id/status`;
>   136 Tests grün, end-to-end im Browser verifiziert.)
> - ✅ **Beobachtungsliste (Wirkstoffe im Blick):** Apotheker:innen merken sich die
>   Wirkstoffe, die sie regelmäßig führen (☆ Beobachten an jedem Engpass **oder**
>   Eingabefeld auf „Für dich"); der aktuelle Engpass-Status steht dann oben auf der
>   Startübersicht — kritische zuerst (Farb-Semantik rot = kritisch), mit Quelle/Herkunft.
>   Kein Engpass = „Aktuell keine Meldung". In Snapshot-Persistenz + DSGVO-Löschung
>   eingebunden. (`GET/POST /api/watchlist`, `DELETE /api/watchlist/:wirkstoff`;
>   129 Tests grün, im Browser verifiziert.)
> - ✅ **Feed-Sortierung (Öffentlich):** Umschalter „🕒 Neueste / 🔥 Beliebteste"
>   über dem öffentlichen Feed — Beliebteste zeigt die meist-reagierten Beiträge
>   zuerst (Summe aller Reaktionen), damit wichtige Fach-Diskussionen nicht
>   untergehen. (`GET /api/feed/public?sort=top|neu`; 119 Tests grün, im Browser verifiziert.)
> - ✅ **@Erwähnungs-Autovervollständigung:** beim Tippen von `@…` im Compose-/News-Feld
>   werden passende Handles vorgeschlagen (Präfix zuerst), Auswahl fügt `@handle` ein.
>   (`GET /api/handles?q=`; 118 Tests grün, im Browser verifiziert.)
> - ✅ **Bilder in Kommentaren:** Foto an einen Kommentar anhängen (📷 am Kommentarfeld,
>   Client-Verkleinerung + gemeinsame Media-Validierung), Bild-only-Kommentar erlaubt.
>   (117 Tests grün, im Browser verifiziert.)
> - ✅ **Folge-Vorschläge:** leerer „Mein Feed" zeigt „👥 Vorschläge zum Folgen"
>   (Profile, denen man noch nicht folgt, aktivste zuerst) mit „+ Folgen" — hilft
>   neuen Nutzer:innen, das Netzwerk aufzubauen. (`GET /api/suggestions/follow`;
>   115 Tests grün, im Browser verifiziert.)
> - ✅ **Beitrag teilen (Direktlink):** „🔗 Teilen" kopiert einen Link (`/?post=ID`);
>   beim Öffnen springt die App direkt zum Beitrag (Deep-Link, Sichtbarkeit erzwungen).
>   (114 Tests grün, im Browser verifiziert.)
> - ✅ **Einzelne Benachrichtigung als gelesen** beim Anklicken (`/api/notifications/:id/read`).
> - ✅ **Konto löschen (DSGVO — Recht auf Löschung):** mit Passwort-Bestätigung; purge
>   über alle Repos (Profil, Beiträge, Kommentare, Reaktionen, Follows, DMs, Merkliste,
>   Verifizierung, Austausch-Einträge, Nutzer + Login). (`POST /api/me/delete`; 114 Tests
>   grün, end-to-end verifiziert: Login danach unmöglich, andere Daten unberührt.)
> - ✅ **Passwort ändern:** altes Passwort prüfen (scrypt), neues (≥8) setzen
>   (`POST /api/me/password`, `orgAuth.changePassword`). UI in der Konto-Karte am
>   eigenen Profil. (113 Tests grün, end-to-end per API verifiziert.)
> - ✅ **DSGVO-Datenexport (Datenübertragbarkeit):** „⬇️ Meine Daten exportieren" auf
>   dem eigenen Profil lädt alle eigenen Daten als JSON (Profil, Beiträge, Kommentare,
>   Merkliste, Direktnachrichten, Verifizierung, Austausch-Einträge; `GET /api/me/export`).
>   (110 Tests grün, Endpoint verifiziert.)
> - ✅ **Kommentare melden:** 🚩 an fremden Kommentaren → Moderations-Queue (mit
>   Kommentartext + „💬 Kommentar"-Kennzeichnung); „Kommentar entfernen" löscht ihn.
>   Schließt die Moderations-Lücke (bisher nur Beiträge). (`POST /api/comments/:id/report`;
>   109 Tests grün, im Browser verifiziert.)
> - ✅ **Lesezeichen / „Merken":** Beiträge für später merken (🔖 an jedem Beitrag,
>   Status in der App gespiegelt), Merkliste über „Für dich" öffnen. Sichtbarkeit
>   erzwungen, gelöschte Beiträge fallen raus, in Snapshot-Persistenz. (`/api/posts/:id/bookmark`,
>   `/api/bookmarks`; 108 Tests grün, im Browser verifiziert.)
> - ✅ **Austausch-Historie („Meine Einträge") + Wieder öffnen:** eigene Biete/Suche-
>   Einträge inkl. erledigter einsehen (`GET /api/exchange/mine`), erledigte
>   wieder öffnen (`/:id/reopen`, nur Ersteller, löst erneut Matching aus). Reiter-Filter
>   „🗂️ Meine". (105 Tests grün, im Browser verifiziert.)
> - ✅ **Dunkelmodus:** augenschonender Hell/Dunkel-Umschalter (🌙/☀️) im Header, in
>   localStorage gemerkt, per CSS-Variablen (Karten/Eingaben/Kontrast angepasst,
>   theme-color aktualisiert). (Im Browser verifiziert.)
> - ✅ **Profil-Verifizierung (Apotheken-Nachweis):** Nutzer beantragen Verifizierung
>   (Hinweis mit Konzession/Apotheke), Redaktion/Moderation genehmigt oder lehnt ab;
>   Genehmigung setzt `verified` → „✔ verifiziert"-Badge an Profil und Beiträgen, plus
>   Benachrichtigung. Nur-Moderator-Queue, in Snapshot-Persistenz eingebunden.
>   (`/api/verify/*`; 104 Tests grün, im Browser verifiziert.)
> - ✅ **Barrierefreiheit / Feinschliff (Owner-UX-Vorgabe):** Schriftgrößen-Umschalter
>   A / A⁺ / A⁺⁺ (16/19/22px, in localStorage gespeichert; zentrale Textgrößen auf `em`
>   umgestellt, damit sie mitskalieren), sichtbarer Tastatur-Fokus, größere Klickflächen
>   (Buttons ≥44px, Eingaben ≥46px, Touch-Ziele), höherer Kontrast (dunkleres Grau),
>   aria-labels auf Icon-Buttons, Kopfzeile auf schmalen Screens entlastet. (Im Browser verifiziert.)
> - ✅ **Startübersicht „Für dich":** neuer Standard-Reiter mit dem Wichtigsten auf
>   einen Blick — Kennzahlen (kritische Engpässe, Angebote/Gesuche, neue
>   Benachrichtigungen), Top-3 kritische Engpässe, zuletzt im Austausch, Top-Rabatt;
>   alles anklickbar zum jeweiligen Bereich (`GET /api/overview`, `overviewService`
>   komponiert getestete Dienste). (100 Tests grün, im Browser verifiziert.)
> - ✅ **Aktives Matching (Biete ↔ Suche):** legt jemand ein Angebot an, das zu einer
>   offenen Suche passt (gemeinsames Wirkstoff-Wort), wird die suchende Person automatisch
>   benachrichtigt — und umgekehrt. Kein ständiges Nachschauen. Benachrichtigung mit Label,
>   Klick öffnet den Austausch gefiltert. (`social.pushNotification`, Notif-Feld `label`;
>   99 Tests grün, im Browser verifiziert.)
> - ✅ **Standort-Filter im Bestandsaustausch:** Einträge tragen ein Bundesland (AT,
>   9 Länder, serverseitig validiert); im Reiter nach Bundesland filterbar — Ware in
>   der Nähe finden. (`GET /api/exchange?bundesland=`; 98 Tests grün, im Browser verifiziert.)
> - ✅ **Fotos im Bestandsaustausch:** Biete/Suche-Einträge können ein Foto tragen
>   (z.B. Charge/Ablaufdatum) — schafft Vertrauen beim Tausch. Bild-/Quellen-Validierung
>   in gemeinsames Modul `domain/media.js` ausgelagert (von Social + Austausch genutzt).
>   (96 Tests grün, im Browser verifiziert.)
> - ✅ **Engpass ↔ Bestandsaustausch verknüpft:** an jedem Engpass ein Button
>   „🔄 Biete/Suche" → springt in den Austausch, vorgefiltert auf den Wirkstoff
>   (zeigt sofort, wer ihn bietet/sucht). Austausch-Reiter zusätzlich mit Textsuche
>   nach Präparat (`GET /api/exchange?q=`). (95 Tests grün, im Browser verifiziert.)
> - ✅ **Bilder & Quellen in Beiträgen/News:** Bild posten (Client verkleinert auf
>   ~1200px/JPEG → kleine `data:image`-URL, serverseitig auf Format/Größe geprüft, nur
>   `data:image`, kein Fremd-Host/Skript), Quelle als http(s)-Link (`🔗 Quelle`,
>   javascript:/data:-URLs abgelehnt). News zeigen Quellenangabe (Seed-News mit
>   BASG/Kammer/Gehaltskasse verlinkt) — passt zur Regel „Aussagen nur mit Quelle".
>   Body-Limit auf 2 MB erhöht. (94 Tests grün, im Browser verifiziert.)
> - ✅ **Bestandsaustausch (Biete & Suche):** löst das tägliche Engpass-Problem —
>   Apotheke mit Überbestand findet die, die sucht. Eigenes Modul (`db/exchange.sql`,
>   Repo/Service/Tests), Reiter „🔄 Biete/Suche" mit Formular, Filter (Angebote/Gesuche),
>   „✉️ Kontaktieren" (startet Direktnachricht — **keine öffentlichen Kontaktdaten**),
>   eigene Einträge als erledigt markieren/löschen. In Snapshot-Persistenz eingebunden.
>   (`GET/POST /api/exchange`, `/:id/resolve`, `/:id/delete`; 89 Tests grün, im Browser verifiziert.)
> - ✅ **Benachrichtigungen: informativ + anklickbar:** zeigen jetzt Wer (Akteur-Name),
>   Was (kommentiert/reagiert/gefolgt/erwähnt/DM) und Wann (relTime); Klick springt zum
>   Ziel — Follow → Profil, DM → Konversation, Kommentar/Reaktion/Erwähnung → **Einzelbeitrag-
>   Ansicht** (neu, `GET /api/posts/:id`) mit aufgeklappten Kommentaren. Ungelesene
>   hervorgehoben. (85 Tests grün, im Browser verifiziert.)
> - ✅ **Zeitstempel (Klartext):** Beiträge und Kommentare zeigen „vor 3 Stunden" /
>   „gerade eben" / Datum (relTime, de-AT), Tooltip mit exaktem Zeitpunkt. Wichtig für
>   zeitkritische Themen (Engpässe/News). (Frontend; im Browser verifiziert.)
> - ✅ **Onboarding/Willkommen:** beim ersten Login ein kurzer, freundlicher Overlay
>   („So funktioniert ApoTrend": posten, folgen, Marktdaten, DMs, Suche/Themen) plus
>   „Als App installieren"-Tipp; per ❓ jederzeit wieder aufrufbar, Merker in
>   localStorage. (Frontend; im Browser verifiziert.)
> - ✅ **PWA (installierbar auf allen Geräten):** `manifest.webmanifest`, App-Icons
>   (Pharma-Kreuz), Theme-Farbe, Apple-Touch-Icon und minimaler Service Worker
>   (`sw.js`, netzwerk-durchreichend → keine veralteten Stände). App lässt sich auf
>   Handy-Startbildschirm/Desktop „installieren" und öffnet im Vollbild — eine
>   Codebasis für Computer/Laptop/Tablet/Smartphone, kein App-Store nötig. Statische
>   Auslieferung um PNG/SVG/Manifest-MIME-Typen erweitert. (Im Browser verifiziert:
>   Manifest erkannt, SW registriert.)
> - ✅ **Priorität 1 — Social-Feed (Kern, personenzentriert), KOMPLETT:** Fachprofile ·
>   kurze Posts (public/followers) · Kommentar-Threads · typisierte Reaktionen ·
>   gerichtete Follows · Home-/Öffentlich-Feed · **Direktnachrichten (1:1)** ·
>   **Benachrichtigungen** (Follow/Kommentar/Reaktion/@Mention/DM) · **Melden/Moderation** ·
>   DSGVO-Hard-Delete. (35 Tests grün.)
> - ✅ **Priorität 2 — Lieferengpässe (mit Feed verknüpft):** Engpass-Liste mit
>   **Herkunfts-Flag** (verifiziert/Referenz/simuliert), „Dazu posten" aus dem
>   Engpass heraus, „X Apotheker haben dazu gepostet", Engpass-Chip am Beitrag im
>   Feed (`posts.ref_type='shortage'`). (40 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 3 — Preise (mit Feed verknüpft):** Preisvergleich je Präparat
>   (mehrere Lieferanten, günstigster oben), Trend (▲/▼ %), Herkunfts-Flag,
>   „Dazu posten" + Preis-Chip am Beitrag (`posts.ref_type='price'`). (43 Tests grün.)
> - ✅ **Priorität 4 — News (im selben Feed-System):** News = Beiträge mit `kind='news'` —
>   kuratierte Redaktions-Beiträge (Account `@apotrend`, `is_editorial`, 📰-Badge) **plus**
>   von Nutzern geteilte News. Eigene News-Ansicht (`GET /api/news`), Sichtbarkeit
>   (public/followers) wird respektiert, News erscheinen auch im normalen Feed. (47 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 5 — Top-10-Rabatte (mit Feed verknüpft):** befristete Aktionsangebote
>   je Präparat, **Ranking nach Rabatt-Höhe** (höchster zuerst, max. 10), nur laufende
>   Aktionen (abgelaufene ausgeblendet), Listenpreis→Aktionspreis + Ersparnis + Gültigkeit,
>   Herkunfts-Flag, „Dazu posten" + Aktions-Chip am Beitrag (`posts.ref_type='rabatt'`).
>   (51 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 6 — Profil-Detailseite:** Klick auf @Handle/Name → Profilseite mit
>   Avatar, Fachgebieten, Zählern (Beiträge/Follower/folgt), Folgen/Entfolgen und den
>   sichtbaren Beiträgen der Person (`GET /api/profiles/:handle/page`, Sichtbarkeit
>   erzwungen). (55 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 7 — Übergreifende Suche:** ein Suchbegriff, gebündelte Treffer aus
>   allen Modulen — Personen (Handle/Name/Fachgebiet), Beiträge (sichtbarkeitsgefiltert),
>   Engpässe, Preise, Rabatte (`GET /api/search?q=`). Ergebnisseite gruppiert nach Typ.
>   (60 Tests grün, im Browser verifiziert.)
> - ✅ **Moderation in der UI (Löschen/Melden):** eigene Beiträge löschen (🗑,
>   nur der Autor, serverseitig erzwungen), fremde Beiträge melden (🚩 →
>   `POST /api/posts/:id/report`, Moderations-Queue). Erfüllt die Owner-Vorgabe
>   „Beiträge löschen/melden". (Im Browser verifiziert.)
> - ✅ **#Hashtags / Themen:** `#tag` in Beiträgen/Kommentaren wird verlinkt; Klick
>   öffnet eine Themen-Ansicht mit allen sichtbaren Beiträgen dazu (`GET /api/hashtag/:tag`,
>   exaktes Tag, kein Präfix-Treffer, Sichtbarkeit erzwungen). (82 Tests grün, im Browser verifiziert.)
> - ✅ **@Erwähnungen anklickbar:** `@handle` in Beiträgen und Kommentaren wird
>   grün hervorgehoben und verlinkt aufs Profil (E-Mails werden nicht fälschlich
>   als Erwähnung erkannt). Mention-Benachrichtigung existierte schon. (Frontend;
>   im Browser verifiziert.)
> - ✅ **Reaktionen auf Kommentare:** dieselben typisierten Reaktionen (hilfreich/
>   danke/bestätigt/interessant) auch je Kommentar, Zähler in `listComments`,
>   eine Reaktion je Nutzer+Ziel (umschaltbar). (`POST /api/comments/:id/react`;
>   78 Tests grün, im Browser verifiziert.)
> - ✅ **Verschachtelte Antworten (Kommentar-Threads):** Antworten auf Kommentare
>   werden als eingerückter Baum dargestellt (`parent_comment_id`), „↩ Antworten" je
>   Kommentar, Eltern-Autor:in wird benachrichtigt. (Frontend-Baum aus flacher Liste;
>   im Browser verifiziert.)
> - ✅ **Kommentare bearbeiten/löschen + Autor sichtbar:** Kommentare zeigen jetzt
>   Verfasser:in (anklickbar → Profil); eigene Kommentare inline bearbeiten (✏️,
>   `edited_at`) oder löschen (🗑), nur der Autor (serverseitig erzwungen). Thread
>   bleibt beim Posten offen, Zähler aktualisiert lokal. (`POST /api/comments/:id/edit`,
>   `/delete`; 76 Tests grün, im Browser verifiziert.)
> - ✅ **Beitrag bearbeiten:** eigene Posts nachträglich korrigieren (inline, `✏️
>   Bearbeiten`), `edited_at` wird gesetzt und als „✏️ bearbeitet" angezeigt. Nur der
>   Autor (serverseitig erzwungen), gelöschte Beiträge nicht editierbar.
>   (`POST /api/posts/:id/edit`; 72 Tests grün, im Browser verifiziert.)
> - ✅ **Profil bearbeiten:** eigenes Profil pflegen — Anzeigename, Titel/Funktion,
>   Bio (max. 500), Fachgebiete (Komma-getrennt). „✏️ Profil bearbeiten" auf dem
>   eigenen Profil (`POST /api/profile`, nur eigenes; Handle bleibt unveränderlich).
>   (68 Tests grün, im Browser verifiziert.)
> - ✅ **Moderations-Ansicht (nur Redaktions-/Admin-Konto):** 🛡️-Queue der offenen
>   Meldungen mit Beitrag, Melder:in und Grund; „Beitrag entfernen" oder „In Ordnung".
>   Moderator = Konto mit `is_editorial` (Login über `APOTREND_ADMIN_EMAIL/PASSWORD`).
>   Zugriff für Nicht-Moderator:innen serverseitig geblockt (403). (`GET /api/reports`,
>   `POST /api/reports/:id/resolve`; im Browser + per API verifiziert.)
> - ✅ **Priorität 8 — Direktnachrichten-Oberfläche (Kern-Feature komplett):** 1:1-Chat
>   zwischen Apotheker:innen — Posteingang mit letzter Nachricht + Ungelesen-Zähler,
>   Konversationsansicht (eigene/fremde Bubbles), „✉️ Nachricht" vom Profil aus,
>   ✉️-Badge in der Kopfzeile, Öffnen markiert als gelesen. Fremde können Threads nicht
>   lesen (serverseitig erzwungen). (`GET /api/dm`, `/api/dm/:id`, `POST /api/dm/start`.)
>   (64 Tests grün, im Browser verifiziert.)
> - ✅ **Deployment-fähig gemacht:** `/api/health`-Endpunkt, `Dockerfile`,
>   `render.yaml` (Render-Blueprint) und **`DEPLOY.md`** (Schritt-für-Schritt für
>   Render/Railway/Docker). App braucht einen Node-Host (nicht GitHub Pages!).
> - ✅ **Persistenz (Snapshot, Built-ins-only):** kompletter Zustand als JSON
>   auf Platte (`APOTREND_DATA_FILE`), Laden beim Start, Speichern nach jeder
>   Schreiboperation + beim Herunterfahren (atomar). Daten überleben Neustart —
>   **im echten Server-Neustart verifiziert**. Ohne die ENV-Variable: reines
>   In-Memory (Tests unverändert). Postgres/EU bleibt der Cloud-Zielschritt
>   hinter demselben Repository-Seam.
> - ✅ **Baustein 1 — Fundament:** Organisationen · Nutzer · Mitgliedschaften ·
>   echte Auth (scrypt) · Mandanten-Isolation + RBAC.
> - ✅ **Baustein 2 — collab (Teams-artig):** Kanäle · Nachrichten · Notizen ·
>   Aufgaben — alles apothekenintern gescoped, RBAC + Isolation erzwungen.
> - ✅ **Baustein 3 — network (Phase 4):** Profile · Kontakte · Feed · Direktnachrichten
>   — org-übergreifend, aber mit expliziter Sichtbarkeit (network / nur-Kontakte).
> - ⏳ **Baustein 4 — market (Phase 3):** Integration des bestehenden Kerns + Herkunfts-Flag.
> - ⏳ **HTTP-/Echtzeit-Schicht** (Framework + WebSocket) — Tech-Stack-Entscheidung Phase 6.

## Prinzipien
- **Repository-Seam:** Die Service-Schicht kennt nur ein Repository-Interface
  (`src/repo/`). Heute läuft eine **In-Memory-Umsetzung** (lauffähig & testbar
  ohne externen Dienst); Ziel-Persistenz ist **PostgreSQL, EU-gehostet**
  (`db/schema.sql`) — dieselbe Philosophie wie im bestehenden `assistant/`.
- **Keine Klartext-Passwörter:** nur scrypt-Hash (Node-Built-in, kein Dependency).
- **Mandanten-Grenze = Apotheke:** jede geschützte Aktion läuft über
  `assertCan(userId, organizationId, capability)` — Zugriff über Apotheken-Grenzen
  hinweg ist damit strukturell ausgeschlossen (serverseitig, nicht im Client).
- **Pharmareferent** gehört zu einer `supplier`-Organisation, nie in eine Apotheke.

## Struktur
```
server/
  db/schema.sql              Postgres-Zielschema (Fundament)
  src/domain/password.js     scrypt-Hashing (hash/verify, timing-safe)
  src/domain/roles.js        Org-Typen, Rollen, RBAC-Fähigkeiten
  src/repo/memoryRepo.js     Repository-Interface + In-Memory-Umsetzung
  src/services/orgAuth.js    Registrierung, Login, Mitgliedschaften, Isolation
  src/services/collab.js     Kanäle · Nachrichten · Notizen · Aufgaben (RBAC + Isolation)
  src/services/network.js    (org-zentriert; wird vom Social-Layer abgelöst)
  src/repo/socialRepo.js     Social-Store (Profile/Posts/Kommentare/Reaktionen/Follows)
  src/services/social.js     Prio-1-Feed: Posts · Kommentare · Reaktionen · Follows · Feed
  db/collab.sql              Postgres-Schema des collab-Moduls
  db/network.sql             Postgres-Schema des (abgelösten) org-network-Moduls
  db/social.sql              Postgres-Schema des Social-Layers (Prio 1)
  test/                      node --test (ohne externe Abhängigkeiten)
```

## Lauffähige App (Feed, klickbar)
```bash
cd server
npm start                 # startet http://localhost:4000
```
Öffnen im Browser → registrieren → posten, folgen, kommentieren, reagieren.
HTTP-API (Node-Built-ins, kein Framework) in `src/http/`, Oberfläche in `public/`.
Persistenz derzeit **In-Memory** (Neustart = leer) — Postgres kommt hinter denselben
Repository-Seam.

## Tests
```bash
cd server
npm test          # node --test (35 grün)
```

## Nächste Bausteine (Phase 2/4)
1. **collab**: Channel · Message · Note · Task (+ HTTP-API, Echtzeit-Transport).
2. **network**: PharmacyProfile · Connection · FeedPost · DirectMessage.
3. **Postgres-Repo** hinter demselben Interface (Deployment/Phase 6).
4. **HTTP-/Echtzeit-Schicht** (Framework + WebSocket) — Tech-Stack-Entscheidung Phase 6.
