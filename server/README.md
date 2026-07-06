# ApoTrend Plattform-Backend

Neuer, **zustandsbehafteter** Backend-Pfeiler für die Hybrid-Plattform
(Collab / Market / Network). Getrennt vom bestehenden `backend/` (das sind
zustandslose Vercel-Daten-Fetcher — Engpass/News/Preise) und von `frontend/`
(PWA/Desktop).

> **Status:**
> - ✅ **Baustein 1 — Fundament:** Organisationen · Nutzer · Mitgliedschaften ·
>   echte Auth (scrypt) · Mandanten-Isolation + RBAC.
> - ✅ **Baustein 2 — collab (Teams-artig):** Kanäle · Nachrichten · Notizen ·
>   Aufgaben — alles apothekenintern gescoped, RBAC + Isolation erzwungen.
> - ⏳ **Baustein 3 — network (Phase 4):** Profile · Kontakte · Feed · Direktnachrichten.
> - ⏳ **Baustein 4 — market (Phase 3):** Integration des bestehenden Kerns + Herkunfts-Flag.

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
  db/collab.sql              Postgres-Schema des collab-Moduls
  test/                      node --test (ohne externe Abhängigkeiten)
```

## Tests
```bash
cd server
npm test          # node --test
```

## Nächste Bausteine (Phase 2/4)
1. **collab**: Channel · Message · Note · Task (+ HTTP-API, Echtzeit-Transport).
2. **network**: PharmacyProfile · Connection · FeedPost · DirectMessage.
3. **Postgres-Repo** hinter demselben Interface (Deployment/Phase 6).
4. **HTTP-/Echtzeit-Schicht** (Framework + WebSocket) — Tech-Stack-Entscheidung Phase 6.
