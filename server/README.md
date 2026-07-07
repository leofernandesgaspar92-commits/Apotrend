# ApoTrend Plattform-Backend

Neuer, **zustandsbehafteter** Backend-Pfeiler für die Hybrid-Plattform
(Collab / Market / Network). Getrennt vom bestehenden `backend/` (das sind
zustandslose Vercel-Daten-Fetcher — Engpass/News/Preise) und von `frontend/`
(PWA/Desktop).

> **Status (Neu-Priorisierung: Social-Feed = Kern):**
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
