-- FLIX2WATCH V34 — ratings + forum/community

create table if not exists public.user_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id bigint not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null,
  poster_path text,
  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5.0 and mod((rating*10)::int,5)=0),
  review text check (char_length(coalesce(review,'')) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, media_type, media_id)
);

alter table public.user_ratings enable row level security;
drop policy if exists "ratings public read" on public.user_ratings;
create policy "ratings public read" on public.user_ratings for select using(true);
drop policy if exists "ratings own insert" on public.user_ratings;
create policy "ratings own insert" on public.user_ratings for insert to authenticated with check(auth.uid()=user_id and not public.account_is_banned(auth.uid()));
drop policy if exists "ratings own update" on public.user_ratings;
create policy "ratings own update" on public.user_ratings for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id and not public.account_is_banned(auth.uid()));
drop policy if exists "ratings own delete" on public.user_ratings;
create policy "ratings own delete" on public.user_ratings for delete to authenticated using(auth.uid()=user_id);
grant select on public.user_ratings to anon, authenticated;
grant insert,update,delete on public.user_ratings to authenticated;

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(title) between 3 and 120),
  body text not null check(char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.forum_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check(target_type in ('thread','post')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,target_type,target_id)
);

alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_likes enable row level security;

drop policy if exists "forum threads public read" on public.forum_threads;
create policy "forum threads public read" on public.forum_threads for select using(true);
drop policy if exists "forum threads own insert" on public.forum_threads;
create policy "forum threads own insert" on public.forum_threads for insert to authenticated with check(auth.uid()=author_id and not public.account_is_banned(auth.uid()));
drop policy if exists "forum threads own update" on public.forum_threads;
create policy "forum threads own update" on public.forum_threads for update to authenticated using(auth.uid()=author_id) with check(auth.uid()=author_id);
drop policy if exists "forum threads own delete" on public.forum_threads;
create policy "forum threads own delete" on public.forum_threads for delete to authenticated using(auth.uid()=author_id);

drop policy if exists "forum posts public read" on public.forum_posts;
create policy "forum posts public read" on public.forum_posts for select using(true);
drop policy if exists "forum posts own insert" on public.forum_posts;
create policy "forum posts own insert" on public.forum_posts for insert to authenticated with check(auth.uid()=author_id and not public.account_is_banned(auth.uid()));
drop policy if exists "forum posts own update" on public.forum_posts;
create policy "forum posts own update" on public.forum_posts for update to authenticated using(auth.uid()=author_id) with check(auth.uid()=author_id);
drop policy if exists "forum posts own delete" on public.forum_posts;
create policy "forum posts own delete" on public.forum_posts for delete to authenticated using(auth.uid()=author_id);

drop policy if exists "forum likes public read" on public.forum_likes;
create policy "forum likes public read" on public.forum_likes for select using(true);
drop policy if exists "forum likes own insert" on public.forum_likes;
create policy "forum likes own insert" on public.forum_likes for insert to authenticated with check(auth.uid()=user_id and not public.account_is_banned(auth.uid()));
drop policy if exists "forum likes own delete" on public.forum_likes;
create policy "forum likes own delete" on public.forum_likes for delete to authenticated using(auth.uid()=user_id);

grant select on public.forum_threads,public.forum_posts,public.forum_likes to anon,authenticated;
grant insert,update,delete on public.forum_threads,public.forum_posts,public.forum_likes to authenticated;
