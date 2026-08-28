-- ApoTrend — Automatische Aufnahme von Behörden-Meldungen
--
-- Zwei Tabellen, die zusammengehören:
--   quellen        = was abgerufen wird (BfArM, PEI, BASG, EMA, eigene)
--   news_gesehen   = welche Meldung schon zu einem Beitrag geworden ist
--
-- Warum die zweite Tabelle unverzichtbar ist: Ohne sie legt der Server nach
-- jedem Neustart dieselben Beiträge erneut an. Die Kennung stammt aus dem Feed
-- (guid/id), ersatzweise aus dem Link — beides ist über Abrufe hinweg stabil.

create table quellen (
  id           text primary key,           -- 'bfarm_news', 'basg_news', …
  art          text not null check (art in ('news','shortages')),
  land         char(2) not null,
  format       text not null check (format in ('rss','json','csv')),
  url          text not null,
  bezeichnung  text not null,
  -- amtlich = Behörde. Steuert die Kennzeichnung am Beitrag; eine
  -- Verbands-Meldung ist etwas anderes als eine Behörden-Meldung.
  amtlich      boolean not null default false,
  aktiv        boolean not null default true,
  -- Spaltenzuordnung für CSV-Register (Spaltennamen unterscheiden sich je Land)
  spalten      jsonb,
  letzter_lauf     timestamptz,
  letzter_erfolg   timestamptz,
  letzter_fehler   text,
  created_at   timestamptz not null default now()
);
create index on quellen (art, aktiv);

create table news_gesehen (
  -- '<quellen_id>:<guid|link>' — dieselbe Meldung bei zwei Quellen bleibt
  -- bewusst zwei Einträge: beide Behörden haben sie eigenständig gemeldet.
  schluessel   text primary key,
  quellen_id   text not null references quellen(id) on delete cascade,
  post_id      uuid references posts(id) on delete set null,
  titel        text not null,
  link         text not null,
  veroeffentlicht_am timestamptz,
  aufgenommen_am     timestamptz not null default now()
);
create index on news_gesehen (quellen_id, aufgenommen_am desc);

-- Aufräumen: Der Schlüsselbestand darf nicht unbegrenzt wachsen. Einträge
-- älter als ein Jahr können weg — so alte Meldungen tauchen in keinem Feed
-- mehr auf, können also auch nicht doppelt aufgenommen werden.
--   delete from news_gesehen where aufgenommen_am < now() - interval '1 year';

-- Protokoll der Hintergrund-Läufe. Ohne das ist nicht feststellbar, ob die
-- Automatik seit dem letzten Deploy überhaupt noch läuft.
create table ingest_laeufe (
  id           uuid primary key default gen_random_uuid(),
  aufgabe      text not null,              -- 'news' | 'shortages'
  gestartet_am timestamptz not null default now(),
  dauer_ms     integer,
  erfolg       boolean not null,
  ergebnis     jsonb,                      -- abgerufen/neu/angelegt je Quelle
  fehler       text
);
create index on ingest_laeufe (aufgabe, gestartet_am desc);
