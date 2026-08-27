-- ===========================================================================
--  Apotrend — Constraints für Medien, Reaktionen und Threads
-- ===========================================================================
--  Ergänzt compliance-constraints.sql. Dieselbe Begründung wie dort: Ein
--  Import-Skript, eine Migration oder eine psql-Sitzung umgeht jede
--  Anwendungslogik. Was nicht in der Datenbank steht, gilt nicht.
--
--  Reihenfolge: erst CHECKs (billig, sofort wirksam), dann Trigger.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  1. Barrierefreiheit ist ein Constraint, keine Bitte
-- ---------------------------------------------------------------------------

--  alt IS NOT NULL für Bild und GIF. Ein LEERER String bleibt erlaubt: er
--  bedeutet „bewusst dekorativ". NULL bedeutet „vergessen" — und genau das
--  wird hier unmöglich. Der Unterschied ist der ganze Punkt.
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_alt_required
  CHECK (type NOT IN ('IMAGE', 'GIF') OR alt IS NOT NULL);

ALTER TABLE core."CommentMedia"
  ADD CONSTRAINT commentmedia_alt_required
  CHECK (alt IS NOT NULL);

--  WCAG 1.2.2/1.2.3: Ein öffentliches Video braucht Untertitel ODER eine
--  vollständige Abschrift. Ohne beides ist es für Gehörlose leer.
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_video_needs_captions
  CHECK (
    type <> 'VIDEO'
    OR "captionsUrl" IS NOT NULL
    OR (transcript IS NOT NULL AND length(transcript) > 0)
  );

--  Ein Video ohne Standbild ist eine schwarze Fläche; ohne posterAlt ist das
--  Standbild wiederum unbeschrieben.
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_video_needs_poster
  CHECK (
    type <> 'VIDEO'
    OR ("posterUrl" IS NOT NULL AND "posterAlt" IS NOT NULL AND length("posterAlt") > 0)
  );

--  Kurzvideo-Format: höchstens 90 Sekunden.
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_video_length
  CHECK (type <> 'VIDEO' OR ("durationMs" IS NOT NULL AND "durationMs" <= 90000));

--  Maße sind Pflicht, damit das Layout vor dem Laden steht (CLS).
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_dimensions
  CHECK (type = 'AUDIO' OR (width > 0 AND height > 0));

--  Im Kommentar nur Standbilder — kein Video (siehe Modellkommentar).
ALTER TABLE core."CommentMedia"
  ADD CONSTRAINT commentmedia_no_video
  CHECK (type IN ('IMAGE', 'GIF'));

--  Lizenzbedingung von Tenor/Giphy: Anbieter muss genannt werden.
ALTER TABLE core."PostMedia"
  ADD CONSTRAINT postmedia_gif_attribution
  CHECK (
    type <> 'GIF'
    OR "gifProvider" = 'OWN_LIBRARY'
    OR ("gifAttribution" IS NOT NULL AND length("gifAttribution") > 0)
  );

-- ---------------------------------------------------------------------------
--  2. Mengen- und Mischungsregeln
-- ---------------------------------------------------------------------------
--  „Höchstens 10 Bilder" lässt sich nicht als CHECK über eine Zeile ausdrücken.
--  Deshalb Trigger — aber mit derselben Verbindlichkeit.

CREATE OR REPLACE FUNCTION core.enforce_post_media_limits()
RETURNS TRIGGER AS $$
DECLARE
  picture_count INT;
  video_count   INT;
BEGIN
  SELECT
    count(*) FILTER (WHERE type IN ('IMAGE', 'GIF')),
    count(*) FILTER (WHERE type = 'VIDEO')
  INTO picture_count, video_count
  FROM core."PostMedia"
  WHERE "postId" = NEW."postId";

  IF video_count > 1 THEN
    RAISE EXCEPTION 'Höchstens ein Video pro Beitrag (Beitrag %).', NEW."postId"
      USING ERRCODE = 'check_violation';
  END IF;

  IF picture_count > 10 THEN
    RAISE EXCEPTION 'Höchstens 10 Bilder pro Beitrag (Beitrag %).', NEW."postId"
      USING ERRCODE = 'check_violation';
  END IF;

  -- Video UND Bildergalerie ergeben zwei konkurrierende Blickfänge.
  IF video_count > 0 AND picture_count > 0 THEN
    RAISE EXCEPTION 'Entweder Video oder Bildergalerie, nicht beides (Beitrag %).', NEW."postId"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_post_media_limits
  AFTER INSERT OR UPDATE ON core."PostMedia"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.enforce_post_media_limits();

CREATE OR REPLACE FUNCTION core.enforce_comment_media_limits()
RETURNS TRIGGER AS $$
DECLARE
  picture_count INT;
BEGIN
  SELECT count(*) INTO picture_count
  FROM core."CommentMedia" WHERE "commentId" = NEW."commentId";

  IF picture_count > 4 THEN
    RAISE EXCEPTION 'Höchstens 4 Anhänge pro Kommentar (Kommentar %).', NEW."commentId"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_comment_media_limits
  AFTER INSERT OR UPDATE ON core."CommentMedia"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.enforce_comment_media_limits();

-- ---------------------------------------------------------------------------
--  3. Reaktionen: genau ein Ziel, eine Person eine Stimme
-- ---------------------------------------------------------------------------

ALTER TABLE core."Reaction"
  ADD CONSTRAINT reaction_exactly_one_target
  CHECK (num_nonnulls("postId", "commentId") = 1);

--  WICHTIG: Ein zusammengesetzter UNIQUE-Index über ("postId","commentId","userId")
--  würde hier NICHT wirken, weil NULL in PostgreSQL nie gleich NULL ist —
--  dieselbe Person könnte beliebig oft reagieren. Deshalb zwei PARTIELLE
--  Indizes, je einer für die tatsächlich gesetzte Ziel-Spalte.
CREATE UNIQUE INDEX reaction_one_per_user_post
  ON core."Reaction" ("postId", "userId") WHERE "postId" IS NOT NULL;

CREATE UNIQUE INDEX reaction_one_per_user_comment
  ON core."Reaction" ("commentId", "userId") WHERE "commentId" IS NOT NULL;

ALTER TABLE core."ReactionTally"
  ADD CONSTRAINT tally_exactly_one_target
  CHECK (num_nonnulls("postId", "commentId") = 1);

--  Zähler per Trigger, nicht aus der Anwendung: sonst driften Anzeige und
--  Wahrheit auseinander, sobald irgendein Pfad das Mitzählen vergisst.
CREATE OR REPLACE FUNCTION core.sync_reaction_tally()
RETURNS TRIGGER AS $$
DECLARE
  target_post    TEXT;
  target_comment TEXT;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO core."ReactionTally" (id, "postId", "commentId", kind, count)
    VALUES (gen_random_uuid()::text, NEW."postId", NEW."commentId", NEW.kind, 1)
    ON CONFLICT DO NOTHING;
  END IF;

  target_post    := COALESCE(NEW."postId", OLD."postId");
  target_comment := COALESCE(NEW."commentId", OLD."commentId");

  -- Vollständig neu zählen statt inkrementell: bei einem Reaktionswechsel
  -- (UPDATE der Spalte kind) wäre inkrementelles Rechnen fehleranfällig, und
  -- die Zeilenzahl je Ziel ist klein genug.
  UPDATE core."ReactionTally" t
  SET count = sub.c
  FROM (
    SELECT kind, count(*) AS c
    FROM core."Reaction"
    WHERE ("postId" IS NOT DISTINCT FROM target_post)
      AND ("commentId" IS NOT DISTINCT FROM target_comment)
    GROUP BY kind
  ) sub
  WHERE t.kind = sub.kind
    AND (t."postId" IS NOT DISTINCT FROM target_post)
    AND (t."commentId" IS NOT DISTINCT FROM target_comment);

  DELETE FROM core."ReactionTally" t
  WHERE (t."postId" IS NOT DISTINCT FROM target_post)
    AND (t."commentId" IS NOT DISTINCT FROM target_comment)
    AND NOT EXISTS (
      SELECT 1 FROM core."Reaction" r
      WHERE r.kind = t.kind
        AND (r."postId" IS NOT DISTINCT FROM target_post)
        AND (r."commentId" IS NOT DISTINCT FROM target_comment)
    );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reaction_tally
  AFTER INSERT OR UPDATE OR DELETE ON core."Reaction"
  FOR EACH ROW EXECUTE FUNCTION core.sync_reaction_tally();

-- ---------------------------------------------------------------------------
--  4. Kommentar-Verschachtelung
-- ---------------------------------------------------------------------------

ALTER TABLE core."Comment"
  ADD CONSTRAINT comment_depth_cap
  CHECK (depth >= 0 AND depth <= 3);

--  Tiefe wird BERECHNET, nie vom Aufrufer übernommen. Ohne das könnte ein
--  manipulierter Client depth=0 schicken und die Einrückung aushebeln.
CREATE OR REPLACE FUNCTION core.set_comment_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth  INT;
  parent_parent TEXT;
  parent_author TEXT;
BEGIN
  IF NEW."parentId" IS NULL THEN
    NEW.depth := 0;
    NEW."replyToUserId" := NULL;
    RETURN NEW;
  END IF;

  SELECT depth, "parentId", "authorId"
  INTO parent_depth, parent_parent, parent_author
  FROM core."Comment" WHERE id = NEW."parentId";

  IF parent_depth IS NULL THEN
    RAISE EXCEPTION 'Elternkommentar % existiert nicht.', NEW."parentId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW."replyToUserId" := parent_author;

  IF parent_depth + 1 > 3 THEN
    -- Deckel: eine Ebene höher einhängen, Bezug über replyToUserId erhalten.
    NEW.depth := parent_depth;
    NEW."parentId" := parent_parent;
  ELSE
    NEW.depth := parent_depth + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_depth
  BEFORE INSERT ON core."Comment"
  FOR EACH ROW EXECUTE FUNCTION core.set_comment_depth();

-- ---------------------------------------------------------------------------
--  5. Kennzeichnung bezahlter Inhalte (§ 6 TMG, § 22 MStV)
-- ---------------------------------------------------------------------------

ALTER TABLE core."PostSponsorship"
  ADD CONSTRAINT sponsorship_advertiser_named
  CHECK (length(btrim(advertiser)) >= 2 AND "advertiserUrl" ~ '^https?://');

--  `Post.isSponsored` wird aus der Existenz der Sponsoring-Zeile ABGELEITET.
--  Damit kann das Kennzeichen weder fälschlich gesetzt noch vergessen werden;
--  Feed-Abfragen dürfen weiterhin auf das billige Boolean filtern.
CREATE OR REPLACE FUNCTION core.sync_post_sponsored_flag()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core."Post" p
  SET "isSponsored" = EXISTS (
    SELECT 1 FROM core."PostSponsorship" s WHERE s."postId" = p.id
  )
  WHERE p.id = COALESCE(NEW."postId", OLD."postId");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_sponsored_flag
  AFTER INSERT OR UPDATE OR DELETE ON core."PostSponsorship"
  FOR EACH ROW EXECUTE FUNCTION core.sync_post_sponsored_flag();

--  Gegenrichtung: `isSponsored` lässt sich nicht von Hand setzen.
CREATE OR REPLACE FUNCTION core.guard_post_sponsored_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isSponsored" <> EXISTS (
    SELECT 1 FROM core."PostSponsorship" s WHERE s."postId" = NEW.id
  ) THEN
    RAISE EXCEPTION
      'isSponsored wird aus PostSponsorship abgeleitet und nicht direkt gesetzt (Beitrag %).',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_post_sponsored_guard
  AFTER INSERT OR UPDATE OF "isSponsored" ON core."Post"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.guard_post_sponsored_flag();

-- ---------------------------------------------------------------------------
--  6. Der wichtigste Constraint: kein Rx im Shoppable Tag
-- ---------------------------------------------------------------------------
--  Steht bereits in compliance-constraints.sql. Hier nur der Hinweis, warum er
--  durch Rich Media WICHTIGER wird: Ein Shoppable Overlay auf einem Video oder
--  Karussell ist visuell attraktiver als eine Textzeile — die Werbewirkung
--  eines versehentlich markierten Rx-Arzneimittels also größer.
--  (Zur Erinnerung, nicht erneut ausführen:)
--
--    ALTER TABLE core."PostProductTag"
--      ADD CONSTRAINT posttag_no_rx
--      CHECK ("productClass" <> 'RX_ARZNEIMITTEL');

--  Zusätzlich: Position eines Overlays muss innerhalb des Mediums liegen,
--  sonst hängt der Kauf-Punkt außerhalb des Bildes und ist unerreichbar.
ALTER TABLE core."PostProductTag"
  ADD CONSTRAINT posttag_position_in_bounds
  CHECK (
    (x IS NULL AND y IS NULL)
    OR (x >= 0 AND x <= 1 AND y >= 0 AND y <= 1)
  );

-- ---------------------------------------------------------------------------
--  7. Direktnachrichten: Gesundheitsdaten
-- ---------------------------------------------------------------------------

--  Klartext darf nicht vorkommen: entweder verschlüsselt oder gar kein Text.
ALTER TABLE core."Message"
  ADD CONSTRAINT message_body_encrypted_or_absent
  CHECK (
    ("bodyCipher" IS NULL AND "bodyNonce" IS NULL)
    OR ("bodyCipher" IS NOT NULL AND "bodyNonce" IS NOT NULL AND "keyVersion" >= 1)
  );

--  Eine Nachricht ohne Text UND ohne Anhang wäre eine leere Zeile.
--  (Als Trigger, weil der Anhang in einer anderen Tabelle steht.)
CREATE OR REPLACE FUNCTION core.enforce_message_has_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."bodyCipher" IS NULL
     AND NOT EXISTS (SELECT 1 FROM core."MessageMedia" m WHERE m."messageId" = NEW.id) THEN
    RAISE EXCEPTION 'Nachricht % hat weder Text noch Anhang.', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_message_has_content
  AFTER INSERT ON core."Message"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.enforce_message_has_content();

ALTER TABLE core."MessageMedia"
  ADD CONSTRAINT messagemedia_voice_note_length
  CHECK (type <> 'AUDIO' OR ("durationMs" IS NOT NULL AND "durationMs" <= 180000));

ALTER TABLE core."MessageMedia"
  ADD CONSTRAINT messagemedia_transcript_status
  CHECK ("transcriptStatus" IN ('none', 'requested', 'ready'));

--  Sichtbar machen, was fehlt, statt es zu verschweigen: „ready" ohne Text
--  wäre eine Falschaussage der Oberfläche.
ALTER TABLE core."MessageMedia"
  ADD CONSTRAINT messagemedia_transcript_consistent
  CHECK ("transcriptStatus" <> 'ready' OR (transcript IS NOT NULL AND length(transcript) > 0));
