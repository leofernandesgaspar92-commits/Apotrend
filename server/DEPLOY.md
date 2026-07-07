# ApoTrend Feed-App — live schalten (Deployment)

Diese App (grüne, personenzentrierte Feed-Plattform: Feed, Engpässe, Preise,
Rabatte, News, Profile, Suche) ist ein **Node-Server** — sie kann **nicht** auf
GitHub Pages laufen (Pages liefert nur statische Dateien aus). Sie braucht einen
**Node-fähigen Host**. Unten die einfachste Variante plus Alternativen.

> **Wo liegt die App?** Branch `feed-first`, Unterordner `server/`.
> Start: `npm start` (= `node src/http/server.js`), Port über `process.env.PORT`.
> Keine externen npm-Pakete, keine Datenbank nötig — nur Node 22+.

---

## Option A — Render.com (empfohlen, kostenloser Tarif)

Am einfachsten, weil im Repo bereits eine `render.yaml` (Blueprint) liegt.

1. Konto auf **https://render.com** anlegen (mit GitHub anmelden).
2. Oben rechts **New +** → **Blueprint**.
3. Das Repo **`leofernandesgaspar92-commits/Apotrend`** auswählen.
4. Render liest `render.yaml` automatisch (Branch `feed-first`, Ordner `server/`,
   `npm start`). **Apply** klicken.
5. Nach 1–2 Minuten bekommst du eine URL wie
   `https://apotrend-feed.onrender.com` — **das ist die neue App**.

Health-Check läuft gegen `/api/health`. PORT setzt Render selbst.

> Kostenloser Tarif: Der Dienst „schläft" nach Inaktivität ein und braucht beim
> ersten Aufruf ~30 s zum Aufwachen — normal, kein Fehler.

---

## Option B — Railway.app (auch sehr einfach)

1. Konto auf **https://railway.app** (mit GitHub).
2. **New Project** → **Deploy from GitHub repo** → dieses Repo.
3. In den Service-Settings setzen:
   - **Root Directory:** `server`
   - **Branch:** `feed-first`
   - **Start Command:** `npm start`
4. Railway vergibt automatisch eine öffentliche URL.

---

## Option C — beliebiger Docker-Host (Fly.io, VPS, …)

Im Ordner `server/` liegt ein fertiges **`Dockerfile`**.

```bash
cd server
docker build -t apotrend-feed .
docker run -p 4000:4000 apotrend-feed
# → http://localhost:4000
```

Für Fly.io: `fly launch` im Ordner `server/` (nutzt das Dockerfile), dann `fly deploy`.

---

## Wichtig: Datenspeicherung (ehrlicher Hinweis)

Aktuell liegen alle Daten **nur im Arbeitsspeicher** (In-Memory). Das heißt:

- Bei **jedem Neustart / neuen Deploy** sind Beiträge, Profile, Follows,
  Nachrichten usw. **wieder leer**. Nur die kuratierten Seed-Daten (Beispiel-
  Engpässe/Preise/Rabatte) und der Redaktions-Account laden automatisch neu.
- Zum **Ausprobieren/Zeigen** reicht das vollständig.
- Für den **echten Betrieb** kommt als nächster Schritt **Postgres (EU-Region)**
  hinter das bereits vorhandene Repository-Interface — dann überleben Daten den
  Neustart. Das ist bewusst noch offen (Kosten/Region/Anbieter = deine Entscheidung).

---

## Lokal testen (ohne Host)

```bash
cd server
npm start
# → http://localhost:4000  (registrieren, posten, Tabs durchklicken)
npm test   # 60 automatisierte Tests
```
