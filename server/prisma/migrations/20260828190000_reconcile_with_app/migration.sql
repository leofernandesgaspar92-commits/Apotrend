-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('VERIFIED', 'REFERENCE', 'SELF_REPORTED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ShortageStatus" AS ENUM ('CRITICAL', 'LIMITED', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('OFFER', 'REQUEST');

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "dealPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "listPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "minQuantity" INTEGER,
ADD COLUMN     "provenance" "Provenance" NOT NULL DEFAULT 'SELF_REPORTED',
ADD COLUMN     "validUntil" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sourceId" TEXT,
ALTER COLUMN "publishedAt" DROP NOT NULL,
ALTER COLUMN "publishedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Shortage" ADD COLUMN     "expectedEnd" TIMESTAMPTZ(3),
ADD COLUMN     "provenance" "Provenance" NOT NULL DEFAULT 'REFERENCE',
ADD COLUMN     "reportedAt" TIMESTAMPTZ(3),
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "TradeOffer" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ALTER COLUMN "pricePerUnit" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "tradeType",
ADD COLUMN     "tradeType" "TradeType" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Discount_country_validUntil_idx" ON "Discount"("country", "validUntil");

-- CreateIndex
CREATE INDEX "Discount_authorId_idx" ON "Discount"("authorId");

-- CreateIndex
CREATE INDEX "NewsPost_country_publishedAt_idx" ON "NewsPost"("country", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "NewsPost_sourceId_idx" ON "NewsPost"("sourceId");

-- CreateIndex
CREATE INDEX "Post_country_createdAt_idx" ON "Post"("country", "createdAt" DESC);

-- CreateIndex
-- ---------------------------------------------------------------------------
--  Status: datenerhaltend umwandeln statt Spalte neu anlegen
-- ---------------------------------------------------------------------------
--  Prisma hätte die Spalte gelöscht und neu erzeugt — auf Render mit echten
--  Zeilen wäre der gesamte Engpass-Status weg gewesen. Stattdessen wird in
--  place umgewandelt, mit ausdrücklicher Zuordnung BEIDER Vokabulare: das
--  englische aus dem Entwurf und das deutsche, das die Anwendung benutzt.
--  Unbekannte Werte landen auf LIMITED (die vorsichtigere Aussage) — nicht
--  auf AVAILABLE, denn „verfügbar" zu behaupten ist der teure Irrtum.
ALTER TABLE "Shortage"
  ALTER COLUMN "status" TYPE "ShortageStatus"
  USING (
    CASE lower(btrim("status"))
      WHEN 'critical'         THEN 'CRITICAL'
      WHEN 'kritisch'         THEN 'CRITICAL'
      WHEN 'nicht lieferbar'  THEN 'CRITICAL'
      WHEN 'available'        THEN 'AVAILABLE'
      WHEN 'verfuegbar'       THEN 'AVAILABLE'
      WHEN 'verfügbar'        THEN 'AVAILABLE'
      WHEN 'behoben'          THEN 'AVAILABLE'
      ELSE 'LIMITED'
    END
  )::"ShortageStatus";

ALTER TABLE "Shortage" ALTER COLUMN "status" SET DEFAULT 'LIMITED';

-- --------------------------------------------------------------------------
CREATE INDEX "Shortage_country_status_idx" ON "Shortage"("country", "status");

-- CreateIndex
CREATE INDEX "Shortage_activeSubst_idx" ON "Shortage"("activeSubst");

-- CreateIndex
CREATE INDEX "TradeOffer_country_tradeType_createdAt_idx" ON "TradeOffer"("country", "tradeType", "createdAt" DESC);

