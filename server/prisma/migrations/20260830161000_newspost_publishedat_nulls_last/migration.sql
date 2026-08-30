-- Index passend zur TATSAECHLICHEN Sortierung der Anwendung.
--
-- Der Befund, der dazu gefuehrt hat: Die Leseabfrage in repo/prismaStore.js
-- sortiert `publishedAt DESC NULLS LAST` (sonst stuenden Meldungen OHNE Datum
-- ganz oben, siehe docs/DATENBANK.md). Der von Prisma erzeugte Index
-- NewsPost_country_publishedAt_idx steht dagegen auf schlichtem DESC -- und
-- DESC heisst in PostgreSQL NULLS FIRST. Die Reihenfolgen passen nicht
-- zueinander, also konnte der Index nur den Laenderfilter bedienen und
-- PostgreSQL sortierte anschliessend die gesamte Treffermenge nach.
--
-- Mit EXPLAIN ANALYZE an 5.000 Zeilen nachgestellt:
--   vorher:  Bitmap Index Scan + Sort (top-N heapsort ueber 1.251 Zeilen)
--   nachher: Index Scan, kein Sort-Schritt
--
-- Prismas @@index kennt keine NULLS-Angabe, deshalb steht dieser Index als
-- rohes SQL hier statt im Schema. Fuer `migrate deploy` (der Weg auf Render)
-- ist das unproblematisch; `migrate dev` wuerde ihn als Abweichung melden.
CREATE INDEX "NewsPost_country_publishedAt_nullslast_idx"
  ON "NewsPost"("country", "publishedAt" DESC NULLS LAST, "fetchedAt" DESC);
