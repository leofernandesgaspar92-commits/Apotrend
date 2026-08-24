-- ============================================================================
--  Apotrend B2C — Compliance-Constraints (Schritt 2/3) · ENTWURF
-- ============================================================================
--  Gehört zum Greenfield-Track (docs/architecture/design-system.md).
--  Anzuwenden als eigene Prisma-Migration NACH `prisma migrate` des Schemas.
--
--  Zweck: Die rechtlich kritischen Regeln liegen nicht nur in TypeScript und im
--  Service-Layer, sondern auch in der Datenbank. Drei Ebenen = Defense in Depth.
--  Selbst ein fehlerhafter Service oder ein manueller SQL-Eingriff kann damit
--  keinen rechtswidrigen Zustand erzeugen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Verschreibungspflichtige Arzneimittel dürfen NIE verkauft werden
--    (§ 43 AMG Apothekenpflicht / § 48 AMG Verschreibungspflicht)
-- ----------------------------------------------------------------------------

ALTER TABLE core."PharmacyListing"
  ADD CONSTRAINT listing_no_rx
  CHECK ("productClass" <> 'RX_ARZNEIMITTEL');

ALTER TABLE core."CartItem"
  ADD CONSTRAINT cartitem_no_rx
  CHECK ("productClass" <> 'RX_ARZNEIMITTEL');

ALTER TABLE core."OrderItem"
  ADD CONSTRAINT orderitem_no_rx
  CHECK ("productClass" <> 'RX_ARZNEIMITTEL');

-- ----------------------------------------------------------------------------
-- 2. Keine Publikumswerbung für verschreibungspflichtige Arzneimittel
--    (§ 10 HWG) — ein Shoppable Tag auf ein Rx-Produkt ist unzulässig
-- ----------------------------------------------------------------------------

ALTER TABLE core."PostProductTag"
  ADD CONSTRAINT posttag_no_rx
  CHECK ("productClass" <> 'RX_ARZNEIMITTEL');

-- ----------------------------------------------------------------------------
-- 3. Denormalisierung muss konsistent bleiben
--    Trigger hält CartItem/OrderItem/PostProductTag.productClass mit
--    Product.productClass synchron — sonst wäre der CHECK oben aushebelbar.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION core.sync_product_class_from_listing()
RETURNS TRIGGER AS $$
BEGIN
  SELECT l."productClass" INTO NEW."productClass"
  FROM core."PharmacyListing" l
  WHERE l.id = NEW."listingId";

  IF NEW."productClass" IS NULL THEN
    RAISE EXCEPTION 'Listing % nicht gefunden — productClass nicht ableitbar', NEW."listingId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cartitem_sync_class
  BEFORE INSERT OR UPDATE ON core."CartItem"
  FOR EACH ROW EXECUTE FUNCTION core.sync_product_class_from_listing();

CREATE TRIGGER orderitem_sync_class
  BEFORE INSERT OR UPDATE ON core."OrderItem"
  FOR EACH ROW EXECUTE FUNCTION core.sync_product_class_from_listing();

CREATE OR REPLACE FUNCTION core.sync_product_class_from_variant()
RETURNS TRIGGER AS $$
BEGIN
  SELECT p."productClass" INTO NEW."productClass"
  FROM core."ProductVariant" v
  JOIN core."Product" p ON p.id = v."productId"
  WHERE v.id = NEW."variantId";

  IF NEW."productClass" IS NULL THEN
    RAISE EXCEPTION 'Variante % nicht gefunden — productClass nicht ableitbar', NEW."variantId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_sync_class
  BEFORE INSERT OR UPDATE ON core."PharmacyListing"
  FOR EACH ROW EXECUTE FUNCTION core.sync_product_class_from_variant();

CREATE TRIGGER posttag_sync_class
  BEFORE INSERT OR UPDATE ON core."PostProductTag"
  FOR EACH ROW EXECUTE FUNCTION core.sync_product_class_from_variant();

-- Ändert sich die Klasse eines Produkts nachträglich (z. B. OTC -> Rx durch
-- Verordnungsänderung), müssen abhängige Zeilen mitziehen bzw. blockieren.
CREATE OR REPLACE FUNCTION core.propagate_product_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."productClass" IS DISTINCT FROM OLD."productClass" THEN
    -- Listings/Tags werden deaktiviert bzw. entfernt, bevor der CHECK greift
    IF NEW."productClass" = 'RX_ARZNEIMITTEL' THEN
      DELETE FROM core."PostProductTag" t
        USING core."ProductVariant" v
        WHERE t."variantId" = v.id AND v."productId" = NEW.id;

      DELETE FROM core."CartItem" ci
        USING core."PharmacyListing" l, core."ProductVariant" v
        WHERE ci."listingId" = l.id AND l."variantId" = v.id AND v."productId" = NEW.id;

      DELETE FROM core."PharmacyListing" l
        USING core."ProductVariant" v
        WHERE l."variantId" = v.id AND v."productId" = NEW.id;
    ELSE
      UPDATE core."PharmacyListing" l
        SET "productClass" = NEW."productClass"
        FROM core."ProductVariant" v
        WHERE l."variantId" = v.id AND v."productId" = NEW.id;

      UPDATE core."PostProductTag" t
        SET "productClass" = NEW."productClass"
        FROM core."ProductVariant" v
        WHERE t."variantId" = v.id AND v."productId" = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_class_propagate
  AFTER UPDATE ON core."Product"
  FOR EACH ROW EXECUTE FUNCTION core.propagate_product_class();

-- ----------------------------------------------------------------------------
-- 4. Pflichtangaben nach § 4 HWG: Arzneimittel ohne Pflichttext dürfen nicht
--    veröffentlicht werden
-- ----------------------------------------------------------------------------

ALTER TABLE core."Product"
  ADD CONSTRAINT product_pflichttext_required
  CHECK (
    "status" <> 'PUBLISHED'
    OR "productClass" NOT IN ('OTC_ARZNEIMITTEL', 'RX_ARZNEIMITTEL')
    OR "pflichttextId" IS NOT NULL
  );

-- Medizinprodukt: CE-Kennzeichnung + Zweckbestimmung sind Pflicht (MDR)
ALTER TABLE core."Product"
  ADD CONSTRAINT product_ce_required
  CHECK (
    "status" <> 'PUBLISHED'
    OR "productClass" <> 'MEDIZINPRODUKT'
    OR ("ceMarking" IS NOT NULL AND "intendedUse" IS NOT NULL)
  );

-- ----------------------------------------------------------------------------
-- 5. Versandhandel nur mit Erlaubnis (§ 11a ApoG)
--    Aktive Listings setzen eine gültige Versandhandelserlaubnis voraus.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION core.enforce_mail_order_licence()
RETURNS TRIGGER AS $$
DECLARE
  has_licence BOOLEAN;
  valid_until TIMESTAMP;
  ph_status TEXT;
BEGIN
  IF NEW.active THEN
    SELECT p."mailOrderLicence", p."licenceValidUntil", p.status::TEXT
      INTO has_licence, valid_until, ph_status
      FROM core."Pharmacy" p WHERE p.id = NEW."pharmacyId";

    IF NOT COALESCE(has_licence, FALSE) THEN
      RAISE EXCEPTION 'Apotheke % hat keine Versandhandelserlaubnis (§ 11a ApoG)', NEW."pharmacyId";
    END IF;

    IF valid_until IS NOT NULL AND valid_until < NOW() THEN
      RAISE EXCEPTION 'Erlaubnis der Apotheke % ist abgelaufen', NEW."pharmacyId";
    END IF;

    IF ph_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Apotheke % ist nicht aktiv (Status %)', NEW."pharmacyId", ph_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_requires_licence
  BEFORE INSERT OR UPDATE ON core."PharmacyListing"
  FOR EACH ROW EXECUTE FUNCTION core.enforce_mail_order_licence();

-- ----------------------------------------------------------------------------
-- 6. Verifizierungs-Badge nur mit dokumentierter Prüfung und Ablaufdatum
-- ----------------------------------------------------------------------------

ALTER TABLE core."ProfessionalCredential"
  ADD CONSTRAINT credential_verified_needs_proof
  CHECK (
    "status" <> 'VERIFIED'
    OR ("verifiedById" IS NOT NULL
        AND "verifiedAt" IS NOT NULL
        AND "verifiedUntil" IS NOT NULL)
  );

-- ----------------------------------------------------------------------------
-- 7. Gesponserte Inhalte müssen als solche gekennzeichnet sein
--    Ein Post mit Produkt-Tag UND kommerziellem Bezug ist Werbung.
--    (Prüfung im Service; hier der Nachweis, dass isSponsored gesetzt werden kann)
-- ----------------------------------------------------------------------------

CREATE INDEX post_sponsored_idx ON core."Post" ("isSponsored") WHERE "isSponsored" = TRUE;

-- ----------------------------------------------------------------------------
-- 8. Art.-9-Schema abschotten: eigene Rolle mit minimalen Rechten
--    Der Web-Prozess erhält KEINEN Vollzugriff auf `health`.
-- ----------------------------------------------------------------------------

-- Rollen (einmalig, außerhalb der Migration mit Superuser anzulegen):
--   CREATE ROLE apotrend_app  LOGIN;   -- Next.js / Worker (core)
--   CREATE ROLE apotrend_care LOGIN;   -- Care-Service (health)

REVOKE ALL ON SCHEMA health FROM PUBLIC;
GRANT USAGE ON SCHEMA health TO apotrend_care;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA health TO apotrend_care;
-- Bewusst KEIN DELETE für den Dienst: Löschungen laufen ausschließlich über
-- den Retention-Job mit eigener Rolle und Protokollierung.

GRANT USAGE ON SCHEMA core TO apotrend_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO apotrend_app;

-- ----------------------------------------------------------------------------
-- 9. Aufbewahrungsfristen (werden vom Retention-Job ausgewertet)
-- ----------------------------------------------------------------------------

CREATE INDEX prescription_purge_idx
  ON health."Prescription" ("documentPurgeAt")
  WHERE "documentPurgedAt" IS NULL;

CREATE INDEX note_retention_idx
  ON health."ConsultationNote" ("retentionUntil");

CREATE INDEX consultation_recording_purge_idx
  ON health."Consultation" ("recordingPurgeAt")
  WHERE "recordingUrl" IS NOT NULL;
