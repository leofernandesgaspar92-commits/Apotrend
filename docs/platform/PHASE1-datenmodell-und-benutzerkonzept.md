# Phase 1 — Datenmodell & Benutzerkonzept (Vorschlag zur Freigabe)

> **Status: ENTWURF zur Freigabe.** Es wird **nichts** an einer Datenbank gebaut,
> bevor du dieses Dokument freigibst. Offene Entscheidungen am Ende.

---

## 0. Bestandsaufnahme (Ist-Zustand, faktenbasiert)

| Bereich | Ist-Zustand |
|---|---|
| **Frontend** | Eine einzige `frontend/index.html` (~11.000 Zeilen). PWA + Desktop-Hülle laden dieselbe Datei. |
| **Datenspeicherung** | **Ausschließlich `localStorage` im Browser** (115 Zugriffe). Nichts verlässt das Gerät. |
| **Benutzerkonten** | In `localStorage` (`apotrend_accounts`, `apotrend_role`). **Passwörter im Klartext**, kein Hashing (kein `crypto.subtle`/bcrypt gefunden). „Erstes Konto = Admin." |
| **2FA / E-Mail / Sync** | Laut README **Simulationen** (Demo-2FA-Code `123456`). |
| **„Social"-Features heute** | Community-Tab & Chat existieren, sind aber **`localStorage`-Attrappen** — Beiträge werden nicht geteilt, andere Apotheken sehen sie **nicht**. |
| **Backend** | `backend/api/*` = **zustandslose** Vercel-Functions, die echte Fremddaten holen (BASG, openFDA, Yahoo, RSS). **Keine Datenbank, keine Nutzerdaten, keine Auth.** |
| **Echtzeit** | **Keine** (kein WebSocket/SSE irgendwo). |
| **DB-Skelett** | Nur ein Platzhalter-Kommentar in `assistant/src/sources/dbSource.js` („z. B. Postgres"), nirgends verdrahtet. |

### ⚠️ Der zentrale Befund
**Die Grundvoraussetzung für Teams / Feed / Direktnachrichten existiert heute nicht.**
Alles ist eine **Ein-Geräte-Simulation** in `localStorage`. Zwei verschiedene Apotheken
teilen sich **keinerlei** Daten. Für „echte" Zusammenarbeit und Vernetzung braucht es
einen **echten Backend-Pfeiler**: Datenbank + serverseitige Auth + Echtzeit-Transport.

Das ist **kein** Anbau an die HTML-Datei, sondern eine neue Architektur-Säule. Das passt
zu deiner Vorgabe „saubere Trennung in Module/Services statt Monolith".

---

## 1. Architektur-Richtung (damit das Datenmodell echt wird)

Ein Backend, klar getrennte **Domänen-Module**:

```
                    ┌──────────────────────────────────────┐
   PWA (Handy) ────►│           API-Backend (neu)          │
   Desktop     ────►│                                       │
   (beide = dünne   │  auth │ orgs │ collab │ network │     │
    Clients)        │                        market        │
                    └───────┬───────────────┬──────────────┘
                       Postgres (EU)   Echtzeit (WebSocket)
```

- **auth** — Konten, Login, Sessions, Passwort-Hashing, 2FA (echt).
- **orgs** — Apotheken, Nutzer, Mitgliedschaften/Rollen.
- **collab** (Teams-artig, **privat**) — Kanäle, Nachrichten, Notizen, Aufgaben.
- **network** (Facebook-artig, **netzwerkweit**) — Profile, Kontakte, Feed, Direktnachrichten.
- **market** (Bloomberg-artig) — der bestehende ApoTrend-Kern; Datenherkunft klar
  gekennzeichnet (echt/verifiziert vs. simuliert).

Desktop (Electron) und Mobile (PWA) bleiben **dieselbe Web-App**, werden aber zu dünnen
Clients gegen dieses Backend. Eine Plattform, zwei Hüllen. (Tech-Stack-Details = Phase 6.)

---

## 2. Datenmodell (Entitäten)

Legende: 🔒 privat (nur eigene Apotheke) · 🌐 netzwerkweit sichtbar · 🌍 global (alle, read-only)

### 2.1 Kern: Organisation & Identität

**`Pharmacy`** (Organisation, = Mandanten-Grenze) 🌐(Profil-Teil)
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid | |
| name | text | „Apotheke am Markt" |
| ort, plz, bundesland | text | Standort |
| konzessionsnr | text? | optionale Verifizierung als echte Apotheke |
| spezialisierungen | text[] | z. B. Magistrale Rezeptur, Reiseimpfung |
| profil_beschreibung | text | öffentlicher Profiltext |
| sichtbarkeit_profil | enum(netzwerk, nur_kontakte) | |
| created_at | timestamptz | |

**`User`** (natürliche Person) 🔒
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid | |
| email | citext (unique) | Login |
| password_hash | text | **bcrypt/argon2**, nie Klartext |
| name | text | |
| status | enum(eingeladen, aktiv, deaktiviert) | |
| twofa_secret | text? | echtes TOTP |
| created_at | timestamptz | |

**`Membership`** (verbindet User ↔ Pharmacy, trägt die **Rolle**) 🔒
| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid | |
| user_id | uuid → User | |
| pharmacy_id | uuid → Pharmacy | |
| role | enum(admin, apotheker, pta, lehrling) | siehe Rollen unten |
| created_at | timestamptz | |

> Warum eine eigene `Membership`-Tabelle statt `role` direkt am User? → Trennt Identität
> von Org-Rolle und lässt später **Ketten/Filialen** (ein User in mehreren Apotheken) zu,
> ohne Umbau. Für den Start: genau **eine** Mitgliedschaft pro User.
>
> **Sonderfall `Pharmareferent`:** Ein Pharmareferent ist **kein Apotheken-Mitarbeiter**,
> sondern gehört zu Hersteller/Großhandel. Modelliere ich sauber über einen **Org-Typ**
> (`Pharmacy` vs. `SupplierOrg`) — der Referent ist Mitglied einer `SupplierOrg` und
> vernetzt sich ins Netzwerk, hat aber **nie** Zugriff auf Apotheken-Internes. → **offene
> Entscheidung #2.**

### 2.2 collab-Modul (Teams-artig, 🔒 immer apothekenintern)

**`Channel`** — Arbeitsbereich/Kanal innerhalb einer Apotheke
`(id, pharmacy_id, name, typ[team|kanal], sichtbarkeit[alle_mitglieder|privat], created_at)`

**`ChannelMember`** (nur für private Kanäle) `(channel_id, user_id)`

**`Message`** — interne Textnachricht (Echtzeit)
`(id, channel_id, author_user_id, body, created_at, edited_at, deleted_at)`

**`Note`** — angeheftete Info / Dokument-Referenz
`(id, pharmacy_id, channel_id?, title, body, pinned bool, doc_url?, created_by, created_at)`

**`Task`** — To-Do mit Zuweisung
`(id, pharmacy_id, channel_id?, title, description, assignee_user_id?, status[offen|in_arbeit|erledigt], due_date?, created_by, created_at)`

Alles hier ist **hart auf `pharmacy_id` gescoped** und verlässt die Apotheke nie.

### 2.3 network-Modul (Facebook-artig, 🌐 zwischen Apotheken)

**`PharmacyProfile`** 🌐 — öffentlicher Teil von `Pharmacy` (Name, Ort, Spezialisierungen,
Beschreibung). Kein eigenes Objekt nötig — eine **Sicht** auf `Pharmacy` mit den 🌐-Feldern.

**`Connection`** — Netzwerk-Kontakt zwischen zwei Apotheken (B2B, „Kammer-Verbund")
`(id, requester_pharmacy_id, addressee_pharmacy_id, status[angefragt|bestätigt|blockiert], created_at, responded_at)`

**`FeedPost`** 🌐 — Beitrag, den eine **Apotheke als Organisation** teilt
`(id, author_pharmacy_id, author_user_id, kind[frage|bestand_angebot|bestand_gesucht|news_geteilt|ankündigung], title, body, sichtbarkeit[netzwerk|nur_kontakte], created_at)`

> **Kein Like/Kommentar-Wettrennen.** Interaktion ist **fachlich**:
> - `PostResponse` — eine Antwort auf eine `frage` (Text).
> - Strukturierte Aktion bei `bestand_angebot`/`bestand_gesucht` → führt in einen
>   **Direktnachrichten-Thread** (Verhandlung 1:1), nicht in eine öffentliche Kommentarspalte.
> - Keine öffentlichen Zähler/„Gefällt mir". Höchstens ein neutrales „gespeichert/relevant"
>   **privat** für die eigene Apotheke.

**`DirectThread`** + **`DirectMessage`** 🌐(nur die 2 Parteien) — Apotheke↔Apotheke
`DirectThread(id, pharmacy_a_id, pharmacy_b_id, created_at)`
`DirectMessage(id, thread_id, sender_pharmacy_id, sender_user_id, body, created_at)`
Use-Case: „Apotheke A fragt B nach Lagerbestand-Austausch." Getrennt von internen `Message`.

### 2.4 market-Modul (Bloomberg-artig, 🌍 global read-only + 🔒 persönliche Auswahl)

- **Referenzdaten** (Engpässe, Rückrufe, Preise, News) bleiben wie heute: aus den
  Vercel-Functions. **Jedes Item bekommt ein Herkunfts-Flag:**
  `provenance: 'verified' | 'reference' | 'simulated'` + Quelle/Stand.
- **`Watchlist`** 🔒 — jetzt **serverseitig** je Nutzer/Apotheke persistiert
  `(id, pharmacy_id, user_id?, pzn, note, created_at)`.
- **Eigen-Bestand** (falls später via WWS-Export) 🔒 streng apothekenintern.

---

## 3. Sichtbarkeits-/Datenschutz-Klassifikation (zentrale Regel)

**Die Apotheke ist die Mandanten-Grenze.** Serverseitig erzwungen (nicht im Client geprüft):

| Sichtbarkeit | Enthält |
|---|---|
| 🔒 **Apotheken-intern** | User, Membership, Channel, Message, Note, Task, Watchlist, Eigen-Bestand |
| 🌐 **Netzwerkweit / Kontakte** | PharmacyProfile, FeedPost, Connection, DirectMessage (nur die 2 Parteien) |
| 🌍 **Global read-only** | Marktreferenzdaten (BASG-Engpässe etc.) — für alle gleich |

Grundsatz: Internes **leakt nie** nach außen. Cross-Apotheke nur über die **expliziten
Flächen** Profil / Feed / Direktnachricht, jeweils mit **expliziter** Sichtbarkeit.

---

## 4. Rollen & Zugriffsmatrix (RBAC, Entwurf)

| Aktion | Admin | Apotheker | PTA | Lehrling | Pharmareferent* |
|---|:--:|:--:|:--:|:--:|:--:|
| Nutzer/Rollen der Apotheke verwalten | ✅ | – | – | – | – |
| Interne Kanäle lesen/schreiben | ✅ | ✅ | ✅ | ✅ (nur zugewiesene) | ❌ |
| Aufgaben zuweisen | ✅ | ✅ | ✅ | – (nur eigene erledigen) | ❌ |
| Marktdaten ansehen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Im Netzwerk als Apotheke posten | ✅ | ✅ | ⚙️ konfigurierbar | ❌ | ✅ (als Firma) |
| Direktnachricht an andere Apotheke | ✅ | ✅ | ⚙️ | ❌ | ✅ |
| Apotheken-Profil/Kontakte verwalten | ✅ | ✅ | – | – | – (eigenes Firmenprofil) |

*Pharmareferent = externe Firmenrolle, **nie** Zugriff auf Apotheken-Internes. Least-Privilege
für Lehrling. ⚙️ = per Apotheken-Einstellung schaltbar.

---

## 5. DSGVO / Sicherheit — von Anfang an mitgedacht (Phase 5)

- **Echte Auth:** serverseitig, **Passwort-Hashing** (argon2/bcrypt), Sessions/Tokens.
  Der heutige Klartext-`localStorage`-Ansatz **muss** ersetzt werden (aktuell ein Risiko).
- **Mandanten-Isolation serverseitig** erzwingen (jede Query auf `pharmacy_id`/Membership
  gescoped, idealerweise Row-Level-Security) — **nicht** im Client.
- **EU-Datenresidenz** (passt zur früheren Entscheidung D-006): DB + Hosting in der EU;
  Auftragsverarbeitungsvertrag mit dem Hoster.
- **Betroffenenrechte:** Auskunft/Export & Löschung von Personendaten (User) technisch
  vorsehen; Aufbewahrungs-/Löschfristen für Nachrichten/Feed.
- **Rollen-Zugriff** wie oben = Datenminimierung (Lehrling sieht nicht alles).

### Nicht-technische Risiken, die ich ausdrücklich flagge (kein Jurist!)
1. **Kartell-/Wettbewerbsrecht:** Ein Feature, bei dem Apotheken **Bestände/Preise
   austauschen oder koordinieren**, kann wettbewerbsrechtlich heikel sein — unabhängig von
   der DSGVO. Bitte im Compliance-Check mitprüfen lassen.
2. **Direktnachrichten zwischen Firmen** können Personendaten enthalten → Aufbewahrung/Audit.
3. **Rolle Pharmareferent im Apotheken-Netzwerk:** Interessenkonflikt/Transparenz — Industrie
   klar als solche kennzeichnen.

Architektur ist so entworfen, dass diese Punkte **von Beginn an** umsetzbar sind, nicht
nachträglich repariert werden müssen.

---

## 6. Offene Entscheidungen (brauche dein OK, bevor ich weiterbaue)

1. **Echter Backend-Pfeiler bestätigt?** Teams/Feed/DM „echt" ⇒ DB + serverseitige Auth +
   Echtzeit sind zwingend. Das ist der große Schritt weg von der reinen `localStorage`-App.
   → Gehen wir den? (Alternative wäre, es weiter zu simulieren — dann sind die drei Bereiche
   aber nicht real nutzbar.)
2. **Pharmareferent-Modellierung:** als Mitglied einer separaten `SupplierOrg` (sauber,
   empfohlen) — einverstanden?
3. **Frontend-Struktur:** Die drei Domänen in die bestehende 11k-Zeilen-`index.html`
   quetschen skaliert nicht. Ich empfehle, das Frontend in **Module** aufzuteilen (Market =
   bestehender Kern bleibt, Collab & Network als neue Module). Das ist ein größerer Umbau —
   in Ordnung, oder erst minimal-invasiv?
4. **Bestehende Auth ablösen:** Der jetzige Klartext-Login wird durch echte Auth ersetzt.
   Migrieren wir bestehende Demo-Konten (verwerfen) oder Neustart bei Auth?
5. **Reihenfolge:** Vorschlag = Phase 2 (Collab, intern, geringstes Datenschutzrisiko)
   zuerst, dann Phase 4 (Network), Phase 3 (Market-Integration) parallel/dazwischen.
   Passt die Reihenfolge?

Sobald du 1–5 beantwortest (oder anpasst), gehe ich in Phase 2 — und **erst dann** entstehen
DB-Schema/Migrationen.
