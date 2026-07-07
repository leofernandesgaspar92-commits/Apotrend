-- ApoTrend Plattform — Preise (Priorität 3). Großhandels-Einkaufspreise (AEP) je
-- Präparat und Lieferant, mit kurzer Preisentwicklung (series) und Trend.
-- HERKUNFTS-Flag wie bei Engpässen (verified/reference/simulated).
-- Feed-Andockpunkt: posts.ref_type='price' + posts.ref_id -> "Preis für X ist bei
-- Lieferant Z gestiegen" wird kommentier-/verknüpfbar.

create table prices (
  id          uuid primary key default gen_random_uuid(),
  bezeichnung text not null,               -- Präparat
  wirkstoff   text,
  supplier    text not null,               -- Großhändler/Hersteller
  aep         numeric(10,2) not null,       -- Apotheken-Einkaufspreis
  prev_aep    numeric(10,2),               -- vorheriger Preis (fuer Trend)
  currency    text not null default 'EUR',
  series      numeric(10,2)[] not null default '{}',  -- letzte Preise (Entwicklung)
  provenance  text not null default 'reference'
                check (provenance in ('verified','reference','simulated')),
  quelle      text,
  updated_at  timestamptz not null default now()
);
create index on prices (bezeichnung);
