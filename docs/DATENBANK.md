# Datenbank — PostgreSQL, Schema und Betrieb

Diese Datei erklärt drei Dinge: **was** in der Datenbank liegt, **welche sechs
Stellen** vom Entwurf des Owners abweichen (mit Begründung und Rückbau), und
**wie** das Ganze auf Render betrieben wird.

---

## 1. Was die Datenbank heute tut — und was nicht

**Sie ist ein Spiegel, noch keine Lesequelle.** Das ist eine ehrliche und
wichtige Einschränkung:

- Die automatisch geholten Live-Daten (Behörden-News alle 5 Minuten,
  Engpässe alle 4 Stunden) werden **zusätzlich** nach PostgreSQL geschrieben.
- Der Feed, die Profile, Nachrichten, Bestellungen usw. werden weiterhin aus
  den In-Memory-Repos gerendert (`src/repo/*.js`, Snapshot in
  `APOPULSE_DATA_FILE`).

**Warum dieser Zuschnitt?** Die Repos tragen den kompletten Funktionsumfang der
Plattform. Sie in einem Zug auf eine Datenbank umzuhängen, wäre ein Umbau mit
hohem Risiko für eine laufende App. Der akute Nutzen liegt woanders: Auf dem
kostenlosen Render-Tarif ist das Dateisystem flüchtig — der JSON-Snapshot
**überlebt kein Deploy**. Alles, was die Automatik über Tage gesammelt hat, war
nach jedem Deploy weg. Der Spiegel hält es dauerhaft.

**Ohne `DATABASE_URL` ändert sich nichts.** Die App läuft vollständig weiter,
`GET /api/live/status` meldet dann `"database": null`. Das ist ein gültiger
Betriebszustand, kein Fehler.

**Gelesen wird inzwischen auch** — über zwei eigene Ansichten:

```
GET /api/db/news?country=DE&limit=50        (angemeldet)
GET /api/db/shortages?country=AT            (angemeldet)
```

Beide filtern optional nach Land, deckeln die Menge (News max. 200, Engpässe
max. 500) und weisen einen unbekannten Ländercode mit `400 unknown_country` ab,
statt kommentarlos eine leere Liste zu liefern — sonst hielte man einen
Tippfehler für „keine Meldungen". Ohne `DATABASE_URL` antworten sie mit
`503 db_not_configured`, bei unerreichbarer Datenbank mit `503 db_unavailable`.

### Eine Falle bei der Sortierung

`publishedAt` ist nullbar, und PostgreSQL stellt NULL bei `ORDER BY … DESC`
**nach vorn**. Gegen die echte Datenbank nachgestellt:

```
 title      |      publishedAt
------------+------------------------
 OHNE DATUM |                              <- steht oben
 NEU        | 2026-08-20 00:00:00+00
```

Ein schlichtes `orderBy: { publishedAt: 'desc' }` hätte also ausgerechnet die
Meldungen **ohne** Datum dauerhaft an die Spitze des Feeds gesetzt. Die
erfundene Aktualität, die beim Schreiben vermieden wird (§2.3), käme beim Lesen
durch die Hintertür zurück. Deshalb `nulls: 'last'` plus `fetchedAt` als
Zweitschlüssel — ohne den wäre die Reihenfolge der undatierten Meldungen
untereinander beliebig und änderte sich bei jedem Abruf.

Nächster sinnvoller Schritt (noch nicht gemacht): den Haupt-Feed selbst aus
diesen Ansichten speisen, statt sie nebenher anzubieten.

---

## 2. Die sechs Abweichungen vom Entwurf

Grundlage ist der Entwurf des Owners, unverändert abgelegt unter
`server/prisma/schema.v1-owner.prisma`. Die Arbeitsfassung ist
`server/prisma/schema.prisma`. Nichts davon ist Geschmack — es sind Punkte, an
denen der Entwurf mit der laufenden Anwendung kollidiert oder Daten verliert.

### 2.1 `enum Provenance` (neu)

**Grund.** Die gesamte Anwendung kennzeichnet, woher eine Zahl stammt:
`verified` (amtliche Quelle), `reference` (kuratiert), `self_reported`
(Eigenangabe eines Betriebs), `simulated` (Demodaten). Ohne dieses Feld sieht
eine erfundene Demo-Aktion in der Datenbank **exakt aus wie ein echtes Angebot
eines echten Großhändlers**. CLAUDE.md verlangt für sicherheitsrelevante
Aussagen eine Quelle; das hier ist die Umsetzung davon im Schema.

Das ist der eine Zusatz, auf dem ich bestehen würde.

**Rückbau.** `provenance` aus `Shortage` und `Discount` entfernen, Enum löschen.
Dann geht die Unterscheidung Demo/Echt in der Datenbank verloren — die
Anwendung müsste sie anderweitig führen.

### 2.2 `enum ShortageStatus` statt `String @default("LIMITED")`

**Grund.** Als freier String hätte jeder Tippfehler eine neue Statusklasse
erzeugt (`"kritsch"` wäre eine eigene Kategorie), und die deutschen Werte der
Anwendung (`kritisch`/`eingeschraenkt`/`verfuegbar`) hätten nicht zur Vorgabe
`"LIMITED"` gepasst. Die Abbildung liegt in `src/repo/prismaStore.js`
(`toShortageStatus`) und ist getestet.

**Rückbau.** Spalte auf `String` zurückstellen; die Migration
`20260828190000_reconcile_with_app` zeigt den Weg (dort in die andere Richtung).

### 2.3 `NewsPost.publishedAt` ist **nullbar**

**Grund.** Viele Behörden-Feeds liefern kein Datum. Der Parser
(`services/feedParsers.js`) gibt dann bewusst `null` zurück statt „jetzt"
einzusetzen. Mit einem Pflichtfeld müsste die Aufnahme einen Zeitstempel
**erfinden** — und die Meldung rutschte im Feed nach oben, ohne dass es dafür
einen Beleg gibt.

**Rückbau.** Feld auf `DateTime` (nicht optional) setzen. Dann braucht die
Aufnahme eine Regel, welches Datum sie einsetzt, wenn die Quelle keins liefert.

### 2.4 `Discount`: Preise als `Decimal`, plus `validUntil`

**Grund, zwei Teile.**

1. Der Entwurf speicherte ausschließlich `discountPct` (Float). Damit lässt sich
   „2,35 € → 1,65 €" nicht mehr anzeigen, die Ersparnis je Packung nicht
   berechnen und die Angabe nicht überprüfen. Jetzt: `listPrice`, `dealPrice`,
   `currency`, `minQuantity` — `discountPct` bleibt als abgeleiteter Wert für
   Sortierung und Anzeige.
2. `Decimal(10,2)` statt `Float`: Float rechnet `1.1 + 2.2` zu
   `3.3000000000000003`. Bei Geldbeträgen ist das keine Kleinigkeit.
3. `validUntil`: Ohne Enddatum ist nicht feststellbar, ob eine Aktion noch
   läuft — die Top-10-Ansicht der Anwendung zeigt ausschließlich laufende
   (`services/deals.js`, `seedDemoDealsIfNoneRunning`).

**Rückbau.** Die vier Spalten entfernen. Die Preisanzeige und die
Laufzeit-Prüfung fallen damit weg.

### 2.5 Alle `DateTime` als `@db.Timestamptz(3)`

**Grund.** Prisma legt sonst `timestamp without time zone` an. Die Plattform
bedient AT/DE/PT — bei Sommerzeitwechsel und mehreren Zeitzonen ist ein
Zeitstempel ohne Zone eine Zahl, deren Bedeutung davon abhängt, wer sie liest.
Bei einer Engpassmeldung („seit wann?") ist das nicht egal.

**Rückbau.** `@db.Timestamptz(3)` streichen. Bestehende Werte müssten dabei
bewusst in eine Zone umgerechnet werden.

### 2.6 `enum TradeType` statt Kommentar

**Grund.** Im Entwurf stand `tradeType String // OFFER oder REQUEST`. Als freier
String wären `"Offer"`, `"offer"` und `"ANGEBOT"` derselbe Fachbegriff in drei
Schreibweisen — und keine Abfrage fände alle.

**Rückbau.** Auf `String` zurückstellen.

### Unverändert übernommen

`@@unique([drugName, country])` auf `Shortage` und `@unique` auf `NewsPost.link`
stammen aus dem Entwurf des Owners. Sie sind die eigentliche Duplikatsprüfung
und wurden gegen eine laufende Datenbank geprüft (siehe unten).

`User.role` wurde beibehalten. Der Kommentar im Schema erklärt die Trennung:
`role` ist der **Kontotyp** (Apotheke/Großhandel/Pharma/Behörde), die
**Team-Rolle** innerhalb eines Betriebs (admin/apotheker/pta/…) liegt separat in
`domain/roles.js`. Ein einziges Feld würde beide Achsen vermischen.

---

## 3. Migrationen

```
server/prisma/migrations/
  20260828181604_init/                  # Schema des Owners, unverändert
  20260828190000_reconcile_with_app/    # die sechs Abweichungen
```

Die zweite Migration ist **von Hand nachbearbeitet**. `prisma migrate diff`
hätte für den Statuswechsel `String → ShortageStatus` die Spalte gelöscht und
neu angelegt — **auf Render wären damit alle vorhandenen Engpassmeldungen weg
gewesen**. Stattdessen wird umgewandelt:

```sql
ALTER TABLE "Shortage"
  ALTER COLUMN "status" TYPE "ShortageStatus"
  USING (CASE lower(btrim("status"))
    WHEN 'kritisch' THEN 'CRITICAL' … ELSE 'LIMITED' END)::"ShortageStatus";
```

**Geprüft, nicht behauptet.** Gegen ein laufendes PostgreSQL 16.13:

- Eine Zeile `Amoxicillin 1000 mg | kritisch` vor der Migration lag danach als
  `CRITICAL` vor — die Daten haben den Typwechsel überlebt.
- Ein zweiter Einfügeversuch mit demselben `NewsPost.link` wurde mit
  `duplicate key value violates unique constraint` abgewiesen.
- Ein zweiter `Shortage`-Upsert erzeugte **eine** Zeile mit aktualisiertem
  Status (LIMITED → CRITICAL) statt einer Kopie.
- Alle Zeitstempel liegen als `timestamp with time zone` vor, Geldspalten als
  `numeric(10,2)`, und die Enums weisen ungültige Werte ab.

Beim Durchlauf gegen dieselbe Datenbank fiel außerdem ein echter Fehler auf: Ein
zweiter Feed-Lauf **ohne** Meldedatum überschrieb das bereits gespeicherte
Meldedatum mit `null`. `null` heißt in diesen Daten „nicht geliefert", nicht
„nachweislich leer". Seitdem lässt `withoutNulls()` beim Update leere Felder
weg; ein Test hält den Fall fest.

---

## 3b. Indizes — und ein Index, der nichts brachte

Auf `NewsPost` liegen drei Indizes. Der interessante Teil ist, warum es nicht
die sind, die Prisma von allein erzeugt hätte.

**Der Befund.** Die Leseabfrage sortiert `publishedAt DESC NULLS LAST` — sonst
stünden Meldungen ohne Datum ganz oben (§2.3). Prismas
`@@index([country, publishedAt(sort: Desc)])` erzeugt aber schlichtes `DESC`,
und `DESC` heißt in PostgreSQL **NULLS FIRST**. Die Reihenfolgen passen nicht
zueinander. Ergebnis, mit `EXPLAIN ANALYZE` an 5.000 Zeilen nachgestellt:

```
->  Sort  (Sort Key: "publishedAt" DESC NULLS LAST, "fetchedAt" DESC)
      ->  Bitmap Index Scan on "NewsPost_country_publishedAt_idx" (rows=1251)
```

Der Index bediente nur den Länderfilter; sortiert wurde anschließend die ganze
Treffermenge. Mit einem Index in der passenden Reihenfolge:

```
->  Index Scan using "NewsPost_country_publishedAt_nullslast_idx" (rows=50)
```

Kein Sort-Schritt, 50 gelesene Zeilen statt 1.251 sortierter.

Prismas `@@index` kennt keine NULLS-Angabe, deshalb steht dieser Index als rohes
SQL in der Migration. Der ursprüngliche wurde entfernt: Ein Index, den niemand
liest, kostet bei jedem `INSERT` trotzdem Zeit — und die News-Aufnahme schreibt
alle fünf Minuten.

| Index | Wofür |
|---|---|
| `NewsPost_country_publishedAt_nullslast_idx` | die Feed-Abfrage (roh-SQL, NULLS LAST) |
| `NewsPost_country_createdAt_idx` | „was kam seit gestern für DE dazu" — `createdAt` ist immer gesetzt |
| `NewsPost_sourceId_idx` | eine ausgefallene Quelle im Bestand wiederfinden |

**Ein Fehler dabei, der erwähnt gehört:** Der `DROP INDEX` landete zunächst
angehängt an eine **bereits angewandte** Migration. Prisma führt die nicht
erneut aus — der Index blieb stehen, und es fiel nur auf, weil danach in
`pg_indexes` nachgesehen wurde. Das ist die gefährlichere Variante: Auf einer
frischen Datenbank wäre die geänderte Fassung mitgelaufen, auf der bestehenden
nie. Zwei Umgebungen mit demselben Migrationsstand hätten verschiedene
Schemata. Der `DROP` liegt jetzt in einer eigenen Migration.

## 4. Betrieb auf Render

**Build:** `npm install --include=dev && npm run db:setup`

`tools/db-setup.mjs` hat genau eine heikle Eigenschaft, und deshalb ist es ein
Skript statt einer Befehlskette:

| Lage | Verhalten |
|---|---|
| keine `DATABASE_URL` | `prisma generate` läuft, Migrationen werden übersprungen, **Build bleibt grün** |
| `DATABASE_URL` gesetzt, Migration klappt | Schema wird aktualisiert |
| `DATABASE_URL` gesetzt, Migration scheitert | **Build bricht ab** |

Der erste Fall ist der Grund für das Skript: `prisma migrate deploy` bricht ohne
`DATABASE_URL` ab. In einer Befehlskette wäre damit das **gesamte** Deploy
gescheitert — die App wäre offline, nur weil noch keine Datenbank angehängt ist.
Der dritte Fall ist Absicht: Eine App gegen ein halb migriertes Schema zu
starten ist schlimmer als ein fehlgeschlagenes Deploy.

**Datenbank anhängen:** In Render eine PostgreSQL-Instanz anlegen, den
*Internal Database URL* kopieren und beim Service als `DATABASE_URL` eintragen
(in `render.yaml` als `sync: false` deklariert, Render fragt beim Deploy danach).

> **Achtung Freitarif:** Rendes kostenlose PostgreSQL-Instanzen laufen nach
> einer befristeten Zeit ab. Läuft sie ab, schaltet sich der Spiegel selbst ab
> (`GET /api/live/status` → `database.state: "disabled"`) und die App läuft
> unverändert weiter. Sie steht dann aber wieder ohne dauerhaften Speicher da.

**Prüfen, ob es läuft:**

```
GET /api/live/status
```

```jsonc
"database": {
  "state": "ready",        // oder "disabled" (+ "reason"), oder null = nicht konfiguriert
  "newsUpserts": 42,       // in dieser Laufzeit geschrieben
  "shortageUpserts": 118,
  "newsRows": 260,         // tatsächlich in Postgres
  "shortageRows": 96
}
```

**Lokal entwickeln:**

```bash
cd server
export DATABASE_URL="postgresql://user@localhost:5432/apopulse"
npm run db:setup     # Client erzeugen + Migrationen einspielen
npm run db:studio    # Daten ansehen
```

---

## 5. Warum der Spiegel den Server nicht mitreißen kann

Drei Riegel, alle getestet (`test/prisma-store.test.js`):

1. **Der Import ist dynamisch.** `@prisma/client` wirft beim Laden, solange
   `prisma generate` nicht lief. Ein statischer Import würde damit den
   Serverstart verhindern — auf einem Tarif ohne Datenbank wäre die ganze App
   wegen eines optionalen Zusatzes tot.
2. **Jeder Schreibvorgang ist gekapselt.** Ein Datenbankfehler beendet den
   Hintergrundlauf nicht; die übrigen Meldungen werden weiter verarbeitet.
3. **Ein Verbindungsabbruch schaltet den Spiegel ab.** Sonst liefe jede einzelne
   von 50 Zeilen in denselben Zeitablauf. Der Test prüft, dass nach dem
   Abbruch **kein** weiterer Schreibversuch folgt.

Die Reihenfolge ist ebenfalls Absicht: Der Feed-Beitrag wird **zuerst** angelegt,
der Datenbankschreibvorgang folgt. Was die Nutzer:innen sehen, hängt nicht an
der Datenbank.
