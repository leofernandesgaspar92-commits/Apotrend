# Priorität 1 — Nachrichten/Feed zwischen Apothekern (Datenmodell, Freigabe)

> **Status: ENTWURF zur Freigabe.** Keine Implementierung, bevor du dieses Modell
> freigibst. Offene Entscheidungen am Ende.

## 0. Wichtige Weichenstellung vorweg (bitte zuerst lesen)

Bisher hatte ich das Vernetzungs-Modul **organisationszentriert** gebaut
(Apotheke↔Apotheke: `connections`, `feed_posts` je Org, Org-Direktnachrichten —
`server/src/services/network.js`). Deine neue Priorität ist aber **personen­zentriert**:
Apotheker als **Einzelpersonen mit Fachprofil**, die posten, folgen, kommentieren
(Twitter/X + Facebook).

**Das sind zwei unterschiedliche soziale Graphen.** Zwei parallele Feed-Systeme
wären ein Fehler. Mein Vorschlag:

- **Neu = Kern:** personenzentrierter Social-Layer (dieses Dokument).
- **Bestehendes org-`network.js` wird stillgelegt/entfernt** (sein Feed/DM/Kontakte
  werden durch Personen-Posts/Follows/Personen-DMs ersetzt).
- **Bleibt erhalten & wird wiederverwendet:** das Fundament (`users`, `organizations`,
  `memberships`, echte Auth mit scrypt) und `collab` (interne Team-Kanäle). Die
  **Apotheke bleibt als Affiliation** am Personenprofil sichtbar.

→ **Offene Entscheidung #1:** Org-`network.js` stilllegen — einverstanden?

---

## 1. Datenmodell (skaliert ausgelegt)

Legende: 🌍 öffentlich (alle verifizierten Apotheker) · 👥 nur Follower · 🔒 privat (1:1)

### `profiles` — das Fachprofil einer Person (1:1 zu `users`)
| Feld | Typ | Hinweis |
|---|---|---|
| user_id | uuid PK → users | |
| handle | citext unique | @-Name, z. B. `@apo_huber` |
| display_name | text | Anzeigename |
| title | text | z. B. „Apotheker", „PTA" |
| pharmacy_org_id | uuid? → organizations | Affiliation (aus Fundament), am Profil sichtbar |
| bio | text | Kurzbeschreibung |
| specializations | text[] | Fachgebiete |
| avatar_url | text | |
| verified | boolean default false | **verifizierter Apotheker** (gegen Impersonation) |
| visibility | enum(public, network) default network | Profil auffindbar für … |
| created_at | timestamptz | |

### `posts` — kurzer Beitrag (Tweet-artig)
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| author_user_id | uuid → users | **Person**, nicht Org |
| body | text (max ~1000) | kurzer Fachbeitrag |
| visibility | enum(public, followers) default **public** | pro Post einstellbar (siehe #2) |
| ref_type | enum(none, shortage, price, news)? | **Andockpunkt für Prio 2–5** (Engpass/Preis/News verlinken) |
| ref_id | text? | ID des verknüpften Objekts |
| created_at, edited_at | timestamptz | |
| deleted_at | timestamptz? | **Soft-Delete** (Moderation/DSGVO) |
Index: `(author_user_id, created_at)`, `(visibility, created_at)`

### `comments` — Antwort-Thread (Twitter/X-artig, verschachtelt)
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| post_id | uuid → posts | |
| parent_comment_id | uuid? → comments | verschachtelte Threads |
| author_user_id | uuid → users | |
| body | text | |
| created_at | timestamptz | |
| deleted_at | timestamptz? | Soft-Delete |
Index: `(post_id, created_at)`

### `reactions` — typisierte Reaktion (kein reines „Like")
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → users | |
| target_type | enum(post, comment) | |
| target_id | uuid | |
| type | enum(hilfreich, danke, bestaetigt, interessant) | **fachlich**, kein Engagement-Zähler-Rennen |
| created_at | timestamptz | |
Constraint: `unique(user_id, target_type, target_id)` — eine Reaktion je Ziel (umschaltbar)

### `follows` — gerichtet (Twitter-artig, keine Zustimmung nötig)
| Feld | Typ |
|---|---|
| follower_user_id | uuid → users |
| followee_user_id | uuid → users |
| created_at | timestamptz |
PK: `(follower_user_id, followee_user_id)` · Index: `(followee_user_id)`

### `notifications`
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → users | Empfänger |
| type | enum(follow, comment, reaction, mention, dm) | |
| actor_user_id | uuid → users | wer es ausgelöst hat |
| ref_type, ref_id | text | Post/Comment/Thread |
| read | boolean default false | |
| created_at | timestamptz | |
Index: `(user_id, read, created_at)`

### `dm_threads` + `dm_messages` — private 1:1-Direktnachrichten 🔒
`dm_threads(id, user_a_id, user_b_id, created_at, unique(user_a,user_b))`
`dm_messages(id, thread_id, sender_user_id, body, created_at, read_at)`
Getrennt vom öffentlichen Feed. Nur die zwei Personen sehen den Thread.

### `reports` — Moderation
`reports(id, reporter_user_id, target_type[post|comment|profile], target_id, reason, status[offen|geprüft|entfernt], created_at)`

---

## 2. Sichtbarkeit pro Post — Vorschlag

**Standard = `public` (öffentlich, netzwerkweit)** — wie Twitter/X. Grund: der
Kernwert ist Reichweite („Wer hat Amoxicillin?" soll möglichst viele erreichen).
**Pro Post umschaltbar auf `followers`** (nur eigene Follower, Facebook-artiger,
privater). Profile default `network` (nur eingeloggte, verifizierte Apotheker),
optional `public`.

**Feed-Zusammensetzung:**
- **Home-Feed:** Beiträge von Personen, denen ich folge (`public` + `followers`) + eigene.
- **Entdecken/Öffentlich:** alle `public`-Beiträge (netzwerkweit) — für Reichweite neuer Themen.
- Sichtbarkeitsregel: `followers`-Post nur für Follower des Autors (+ Autor); `public` für alle verifizierten.

Skalierung: vorerst **Fan-out-on-read** (Feed = Query „Posts von gefolgten IDs");
bei Wachstum später Fan-out-on-write/Caching. Indizes oben sind darauf ausgelegt.

---

## 3. Anschluss an Priorität 2–5 (damit es nicht isoliert steht)
`posts.ref_type/ref_id` ist der generische Andockpunkt: ein Beitrag kann einen
**Engpass** (Prio 2), einen **Preis** (Prio 3) oder eine **News** (Prio 4)
referenzieren. Damit lässt sich „3 Apotheker haben zu diesem Engpass gepostet"
später als Query `posts where ref_type='shortage' and ref_id=…` umsetzen — ohne
das Feed-System umzubauen. News (Prio 4) = kuratierte Posts eines
Redaktions-/System-Accounts im **selben** `posts`-Modell (kein getrenntes System).

---

## 4. Sicherheit / Datenschutz (von Anfang an)
- **Auth:** bereits echt (scrypt-Hashing, serverseitig) — kein Klartext.
- **Sichtbarkeit pro Post/Profil:** eingebaut (siehe #2).
- **Löschen/Melden:** Soft-Delete (`deleted_at`) + `reports`-Tabelle.
- **Verifizierte Apotheker** (`profiles.verified`): reduziert Impersonation; klärt,
  wer überhaupt posten darf.

**Ausdrücklich geflaggte Risiken (kein Jurist):**
1. Öffentliche Fachbeiträge = **personenbezogene Daten** identifizierbarer Apotheker →
   ToS/Einwilligung, Recht auf Löschung (Hard-Delete-Pfad zusätzlich zum Soft-Delete).
2. Beiträge **über Dritte** („Lieferant Y ist unzuverlässig", „Preis bei Z gestiegen")
   können **Persönlichkeitsrecht/Wettbewerbsrecht/üble Nachrede** berühren → Melde-/
   Moderationspflicht ernst nehmen; im Compliance-Check prüfen.
3. **Follower-Sichtbarkeit ≠ Geheimhaltung:** Nutzern klar kommunizieren, dass auch
   „followers"-Posts von realen Personen gelesen/kopiert werden können.

---

## 5. Offene Entscheidungen (brauche dein OK)
1. **Org-`network.js` stilllegen** zugunsten des personenzentrierten Layers? (empfohlen)
2. **Post-Standard = öffentlich**, pro Post auf „nur Follower" umschaltbar — passt das?
3. **Reaktionstypen:** `hilfreich / danke / bestaetigt / interessant` — passend, oder
   lieber nur „hilfreich" + Kommentare?
4. **Verifizierung:** Dürfen anfangs alle registrierten Nutzer posten, oder nur als
   `verified` markierte Apotheker (Freischaltung durch Admin)?
5. **Follow-Modell:** gerichtet & ohne Zustimmung (Twitter) — oder Bestätigung nötig
   (Facebook-Freundschaft)? Ich empfehle **gerichtet/ohne Zustimmung** für Reichweite.

Sag mir zu 1–5 dein Ja/Anpassung — **dann** implementiere ich Priorität 1
(Profile, Posts, Kommentare, Reaktionen, Follows, Feed, DMs) Schritt für Schritt mit Tests.
