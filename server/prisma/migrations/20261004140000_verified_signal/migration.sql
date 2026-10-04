-- VerifiedSignal: das universelle Modell fuer alle eingehenden Live-Meldungen
-- (Engpass, Rueckruf, Regulatorik, Nachricht). Begruendung im Schema.
--
-- HANDGESCHRIEBEN, und warum: `prisma migrate diff` braucht eine
-- Shadow-Datenbank. In dieser Bauumgebung laeuft kein Postgres, der Befehl
-- bricht mit „make sure your database server is running" ab. Die Tabelle ist
-- neu und haengt an keiner anderen — eine reine CREATE TABLE plus Indizes,
-- bei der das Risiko einer Handschrift ueberschaubar ist.
--
-- Geprueft wurde stattdessen das SCHEMA (`prisma validate` → gueltig) und die
-- Spaltenliste gegen das Modell. Beim naechsten Lauf auf Render zeigt
-- `prisma migrate deploy`, ob die Migration zum Schema passt: Weicht sie ab,
-- meldet Prisma einen Drift und der Build faellt — laut, nicht still.

CREATE TABLE "VerifiedSignal" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,

    "title" TEXT NOT NULL,
    "summary" TEXT,

    -- Herkunfts-Proof. Kommt mechanisch aus dem Abruf, NIE aus der KI.
    "originalUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceId" TEXT,

    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "category" TEXT NOT NULL,

    -- Von der KI vorgeschlagen; NULL heisst „keine KI gelaufen".
    "wirkstoff" TEXT,
    "handelsname" TEXT,
    "schweregrad" TEXT,
    "ursache" TEXT,
    "gueltigVon" TIMESTAMPTZ(3),
    "gueltigBis" TIMESTAMPTZ(3),

    "summaryDe" TEXT,
    "summaryEn" TEXT,
    "summaryPt" TEXT,

    "rawPayload" TEXT,

    -- 0.0-1.0, ausschliesslich fuer die KI-Extraktion. 0 = keine KI gelaufen.
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VerifiedSignal_pkey" PRIMARY KEY ("id")
);

-- Doppelerkennung: Quelle + Original-Adresse. Ein erneuter Durchlauf
-- derselben Meldung aktualisiert die Zeile, statt eine zweite anzulegen —
-- sonst waechst der Feed bei jedem Abruf um denselben Inhalt.
CREATE UNIQUE INDEX "VerifiedSignal_dedupeKey_key" ON "VerifiedSignal"("dedupeKey");

-- Die Hauptabfrage des Frontends: „Was gibt es fuer MEIN Land in DIESER
-- Kategorie, neueste zuerst." Alle drei Spalten in dieser Reihenfolge, damit
-- sie vollstaendig aus dem Index bedient wird.
CREATE INDEX "VerifiedSignal_country_category_verifiedAt_idx"
    ON "VerifiedSignal"("country", "category", "verifiedAt" DESC);

-- Zweithaeufigste Frage: „Alles zu diesem Wirkstoff", ueber Laendergrenzen.
CREATE INDEX "VerifiedSignal_wirkstoff_verifiedAt_idx"
    ON "VerifiedSignal"("wirkstoff", "verifiedAt" DESC);

-- Statusanzeige je Land ohne Kategoriefilter.
CREATE INDEX "VerifiedSignal_country_verifiedAt_idx"
    ON "VerifiedSignal"("country", "verifiedAt" DESC);
