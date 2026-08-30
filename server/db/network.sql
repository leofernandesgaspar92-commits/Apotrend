-- ApoPulse Plattform — network-Modul (Facebook-artig, ZWISCHEN Organisationen).
-- Hier verlassen Daten bewusst die eigene Apotheke — nur ueber kontrollierte
-- Flaechen (Profil / Feed / Direktnachricht) mit EXPLIZITER Sichtbarkeit.
-- Kein Like/Kommentar-Wettrennen: Interaktion ist fachlich (Antwort auf Frage,
-- Bestand anbieten/gesucht -> Direktnachricht).

-- Netzwerk-Kontakt zwischen zwei Organisationen (B2B, "Kammer-Verbund").
create table connections (
  id                 uuid primary key default gen_random_uuid(),
  requester_org_id   uuid not null references organizations(id) on delete cascade,
  addressee_org_id   uuid not null references organizations(id) on delete cascade,
  status             text not null default 'pending'
                       check (status in ('pending','accepted','blocked')),
  created_at         timestamptz not null default now(),
  responded_at       timestamptz,
  check (requester_org_id <> addressee_org_id),
  unique (requester_org_id, addressee_org_id)
);

-- Beitrag, den eine ORGANISATION teilt (nicht eine Einzelperson).
create table feed_posts (
  id             uuid primary key default gen_random_uuid(),
  author_org_id  uuid not null references organizations(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  kind           text not null
                   check (kind in ('frage','bestand_angebot','bestand_gesucht','news_geteilt','ankuendigung')),
  title          text,
  body           text not null,
  visibility     text not null default 'network'
                   check (visibility in ('network','contacts_only')),
  created_at     timestamptz not null default now()
);
create index on feed_posts (created_at);

-- Fachliche Antwort auf einen Beitrag (v.a. auf 'frage'). KEINE Like-Zaehler.
create table post_responses (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references feed_posts(id) on delete cascade,
  author_org_id uuid not null references organizations(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index on post_responses (post_id, created_at);

-- 1:1-Konversation zwischen zwei Organisationen.
create table direct_threads (
  id        uuid primary key default gen_random_uuid(),
  org_a_id  uuid not null references organizations(id) on delete cascade,
  org_b_id  uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (org_a_id <> org_b_id),
  unique (org_a_id, org_b_id)
);

create table direct_messages (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references direct_threads(id) on delete cascade,
  sender_org_id  uuid not null references organizations(id) on delete cascade,
  sender_user_id uuid references users(id) on delete set null,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index on direct_messages (thread_id, created_at);
