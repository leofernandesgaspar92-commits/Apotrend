-- Jurisdiction-Guard: Rechtsraum und Verifizierungsstufe am Konto.
--
-- Die DURCHSETZUNG der Fachkreis-Schranke liegt in domain/jurisdiction.js und
-- laeuft bereits — sie leitet die Stufe heute aus `account_type` plus dem von
-- der Moderation bestaetigten `verified` ab, weil die Konten noch nicht
-- relational liegen. Diese Spalten sind der Platz, an den die Angaben
-- gehoeren, sobald sie es tun.
--
-- Dass die Schranke NICHT auf diese Migration wartet, ist Absicht: Eine
-- Sperre, die erst mit einer kuenftigen Datenmigration greift, ist keine.
-- Der Befund, der sie ausgeloest hat, war akut — GET /api/exchange war
-- angemeldet, aber nicht auf Fachkreise beschraenkt, und damit waren
-- Rx-Angebote praktisch oeffentlich lesbar.
--
-- HANDGESCHRIEBEN (keine Shadow-Datenbank in dieser Bauumgebung), aber nicht
-- frei formuliert: Das DDL ist die Ausgabe von
--   prisma migrate diff --from-empty --to-schema-datamodel … --script
-- fuer die neuen Objekte, uebernommen samt Prismas Namensgebung. Ergaenzt
-- wurden nur die Kommentare und IF NOT EXISTS.

-- VERIFIED_LOGISTICS gehoert ausdruecklich NICHT zum Rx-Fachkreis: Ein
-- Transportunternehmen befoerdert Arzneimittel, es erwirbt sie nicht. Die
-- Stufe existiert, weil Logistiker eigene Funktionen brauchen — nur eben
-- keinen Rx-Einblick (RX_FACHKREIS_STATUS in domain/jurisdiction.js).
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED_PHARMACY', 'VERIFIED_WHOLESALE', 'VERIFIED_MANUFACTURER', 'VERIFIED_LOGISTICS');

-- ISO-3166-1 alpha-2. Ohne Rechtsraum laesst sich die Zulaessigkeit nicht
-- pruefen — die Schranke behandelt ein fehlendes Land deshalb wie „nicht
-- berechtigt", nicht wie „ueberall berechtigt".
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- Betriebserlaubnis-/Lizenznummer.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT;

-- Darf verschreibungspflichtige Angebote SEHEN.
--
-- DEFAULT false, und das ist die wichtigste Zeile dieser Migration: Ein
-- bestehendes Konto bekommt den Einblick NICHT geschenkt. Ein
-- `DEFAULT true` haette die Schranke im Moment ihrer Einfuehrung fuer jeden
-- Altbestand geoeffnet — eine Sperre, die beim Einbau durchlaessig ist.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isRxAllowed" BOOLEAN NOT NULL DEFAULT false;
