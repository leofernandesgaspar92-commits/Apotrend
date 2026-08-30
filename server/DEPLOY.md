# ApoPulse Feed-App — live schalten (Deployment)

Diese App (grüne, personenzentrierte Feed-Plattform: Feed, Engpässe, Preise,
Rabatte, News, Profile, Suche) ist ein **Node-Server** — sie kann **nicht** auf
GitHub Pages laufen (Pages liefert nur statische Dateien aus). Sie braucht einen
**Node-fähigen Host**. Unten die einfachste Variante plus Alternativen.

## 🚀 Schnellster Weg: 1-Klick auf Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leofernandesgaspar92-commits/ApoPulse/tree/feed-first)

Auf den Button klicken → bei Render mit GitHub anmelden → Render liest die
`render.yaml` und richtet den Dienst ein → **Apply**. Nach ~1–2 Minuten bekommst
du eine Live-URL wie `https://apopulse-feed.onrender.com`.
(Beim Deploy fragt Render nach `APOPULSE_ADMIN_PASSWORD` — ein Passwort deiner
Wahl für den Redaktions-/Moderations-Login setzen.)

> **Wo liegt die App?** Branch `feed-first`, Unterordner `server/`.
> Start: `npm start` (= `node src/http/server.js`), Port über `process.env.PORT`.
> Keine externen npm-Pakete, keine Datenbank nötig — nur Node 22+.

---

## Option A — Render.com (empfohlen, kostenloser Tarif)

Am einfachsten, weil im Repo bereits eine `render.yaml` (Blueprint) liegt.

1. Konto auf **https://render.com** anlegen (mit GitHub anmelden).
2. Oben rechts **New +** → **Blueprint**.
3. Das Repo **`leofernandesgaspar92-commits/ApoPulse`** auswählen.
4. Render liest `render.yaml` automatisch (Branch `feed-first`, Ordner `server/`,
   `npm start`). **Apply** klicken.
5. Nach 1–2 Minuten bekommst du eine URL wie
   `https://apopulse-feed.onrender.com` — **das ist die neue App**.

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
docker build -t apopulse-feed .
docker run -p 4000:4000 apopulse-feed
# → http://localhost:4000
```

Für Fly.io: `fly launch` im Ordner `server/` (nutzt das Dockerfile), dann `fly deploy`.

---

## Datenspeicherung (Persistenz)

Der Server kann seinen kompletten Zustand als **JSON-Snapshot** auf die Platte
schreiben und beim Start zurückladen — Beiträge, Profile, Follows, Nachrichten
usw. überleben dann einen Neustart.

Aktiviert wird das über eine Umgebungsvariable:

```bash
APOPULSE_DATA_FILE=/pfad/zu/apopulse.json npm start
```

- **Ohne** die Variable läuft alles rein **In-Memory** (Neustart = leer). Gut für Tests.
- **Mit** der Variable wird nach jeder Schreiboperation (gedrosselt, atomar) und
  beim sauberen Herunterfahren gespeichert.

**Wichtig je nach Host:**
- **Render (kostenlos):** Das Dateisystem ist *flüchtig*. Daten überleben einen
  Prozess-Neustart innerhalb derselben Instanz, aber **nicht ein neues Deploy**.
  Für dauerhafte Speicherung eine **Render-Disk** anlegen (Bezahltarif) und den
  Mountpfad als `APOPULSE_DATA_FILE` verwenden (in `render.yaml` vorbereitet).
- **Railway / Fly.io / eigener Server:** ein persistentes Volume mounten und
  `APOPULSE_DATA_FILE` daraufsetzen.

**Ehrlicher Ausblick:** Der JSON-Snapshot ist ideal für Einzelinstanz + Ausprobieren.
Für **echten Mehr-Instanz-Betrieb in der EU** kommt später **Postgres** hinter
denselben Repository-Seam (die `db/*.sql`-Schemata liegen bereit). Der Umstieg
berührt nur die Repo-Schicht, nicht die Services/UI.

---

## Redaktions-/Moderations-Login

Ein Konto mit dem Profil-Flag `is_editorial` ist zugleich **Moderation** (sieht
die 🛡️-Queue gemeldeter Beiträge). Zugangsdaten über Umgebungsvariablen:

```bash
APOPULSE_ADMIN_EMAIL=redaktion@apopulse.at
APOPULSE_ADMIN_PASSWORD=<sicheres-passwort>
```

Ohne gesetztes Passwort erzeugt der Server beim Frischstart ein zufälliges und
**loggt es einmalig** in die Server-Konsole (`ℹ️ Redaktions-/Moderations-Login: …`).
Für den echten Betrieb immer `APOPULSE_ADMIN_PASSWORD` setzen.

## Lokal testen (ohne Host)

```bash
cd server
npm start
# → http://localhost:4000  (registrieren, posten, Tabs durchklicken)
npm test   # 60 automatisierte Tests
```
