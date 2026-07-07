-- ApoTrend Plattform — Social-Layer (Priorität 1): Apotheker als PERSON.
-- Twitter/X + Facebook: Fachprofile, kurze Posts, Kommentar-Threads, typisierte
-- Reaktionen, gerichtete Follows, Benachrichtigungen, private 1:1-DMs, Moderation.
-- Baut auf users/organizations (db/schema.sql) auf. Loest den org-zentrierten
-- network-Layer (db/network.sql) als sozialen Kern ab.

-- Fachprofil (1:1 zu users)
create table profiles (
  user_id         uuid primary key references users(id) on delete cascade,
  handle          citext unique not null,          -- @-Name
  display_name    text not null,
  title           text,                            -- z.B. "Apotheker", "PTA"
  pharmacy_org_id uuid references organizations(id) on delete set null,
  bio             text,
  specializations text[] not null default '{}',
  avatar_url      text,
  verified        boolean not null default false,  -- verifizierter Apotheker
  visibility      text not null default 'network'
                    check (visibility in ('public','network')),
  created_at      timestamptz not null default now()
);

-- Kurzer Beitrag (Tweet-artig)
create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references users(id) on delete cascade,
  body           text not null check (char_length(body) <= 1000),
  visibility     text not null default 'public' check (visibility in ('public','followers')),
  ref_type       text check (ref_type in ('shortage','price','news')),  -- Andockpunkt Prio 2-5
  ref_id         text,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  deleted_at     timestamptz
);
create index on posts (author_user_id, created_at desc);
create index on posts (visibility, created_at desc);
create index on posts (ref_type, ref_id);

-- Kommentar-Thread (verschachtelt)
create table comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references posts(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete cascade,
  author_user_id    uuid not null references users(id) on delete cascade,
  body              text not null,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on comments (post_id, created_at);

-- Typisierte Reaktion (kein reines Like)
create table reactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id   uuid not null,
  type        text not null check (type in ('hilfreich','danke','bestaetigt','interessant')),
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

-- Gerichteter Follow (ohne Zustimmung, Twitter-artig)
create table follows (
  follower_user_id uuid not null references users(id) on delete cascade,
  followee_user_id uuid not null references users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (follower_user_id, followee_user_id),
  check (follower_user_id <> followee_user_id)
);
create index on follows (followee_user_id);

-- Benachrichtigungen
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,  -- Empfaenger
  type          text not null check (type in ('follow','comment','reaction','mention','dm')),
  actor_user_id uuid references users(id) on delete set null,
  ref_type      text,
  ref_id        text,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on notifications (user_id, read, created_at desc);

-- Private 1:1-Direktnachrichten (getrennt vom oeffentlichen Feed)
create table dm_threads (
  id         uuid primary key default gen_random_uuid(),
  user_a_id  uuid not null references users(id) on delete cascade,
  user_b_id  uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a_id <> user_b_id),
  unique (user_a_id, user_b_id)
);
create table dm_messages (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references dm_threads(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index on dm_messages (thread_id, created_at);

-- Moderation
create table reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_user_id  uuid not null references users(id) on delete set null,
  target_type       text not null check (target_type in ('post','comment','profile')),
  target_id         uuid not null,
  reason            text,
  status            text not null default 'offen' check (status in ('offen','geprueft','entfernt')),
  created_at        timestamptz not null default now()
);
