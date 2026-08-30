-- Gesamtzustand als gepackte Sicherung.
--
-- Siehe Modellkommentar im Schema: Zwischenschritt, damit ein Deploy nicht
-- mehr saemtliche Konten loescht. Eine einzige Zeile ('main'), die
-- ueberschrieben wird.
CREATE TABLE "AppSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "data" BYTEA NOT NULL,
    "rawSize" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppSnapshot_pkey" PRIMARY KEY ("id")
);

-- ACHTUNG: `prisma migrate diff` erzeugt an dieser Stelle zusaetzlich ein
--   DROP INDEX "NewsPost_country_publishedAt_nullslast_idx";
-- Das ist FALSCH und wurde hier entfernt. Der Index steht bewusst als rohes
-- SQL in der Migration 20260830161000 und nicht im Schema, weil Prismas
-- @@index keine NULLS-Angabe kennt. Fuer `migrate diff` sieht er deshalb wie
-- eine Abweichung aus, die es aufzuraeumen gilt — er ist aber genau der Index,
-- den die Feed-Abfrage braucht. Ohne ihn faellt sie auf Bitmap-Scan plus Sort
-- zurueck (siehe docs/DATENBANK.md, Abschnitt 3b).
--
-- Bei kuenftigen `migrate diff`-Laeufen dasselbe pruefen: Ein DROP INDEX auf
-- einen der roh angelegten Indizes gehoert NICHT in die Migration.
