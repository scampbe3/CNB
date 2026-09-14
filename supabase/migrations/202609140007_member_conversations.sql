-- Conversation and profile-discovery structures adapted from the proven forum
-- prototype while preserving this portal's Supabase/RLS security boundary.
alter table public.discussion_comments
  add column parent_id uuid references public.discussion_comments(id) on delete set null;

create index discussion_comment_parents
  on public.discussion_comments(thread_id,parent_id,created_at);

create function private.valid_comment_parent() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.parent_id is not null and not exists(
    select 1 from public.discussion_comments p
    where p.id=new.parent_id and p.thread_id=new.thread_id and not p.hidden
  ) then
    raise exception 'Choose a visible response from this conversation';
  end if;
  return new;
end; $$;

create trigger valid_comment_parent
before insert or update of parent_id,thread_id on public.discussion_comments
for each row execute function private.valid_comment_parent();

create table public.discussion_saves (
  member_id uuid references public.memberships(user_id) on delete cascade,
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(member_id,thread_id)
);

create table public.discussion_appreciations (
  member_id uuid references public.memberships(user_id) on delete cascade,
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(member_id,thread_id)
);

alter table public.discussion_saves enable row level security;
alter table public.discussion_appreciations enable row level security;

grant select,insert,delete on public.discussion_saves,public.discussion_appreciations to authenticated;

create policy discussion_saves_own on public.discussion_saves
for all to authenticated
using(public.is_active() and member_id=auth.uid())
with check(public.is_active() and member_id=auth.uid() and exists(
  select 1 from public.discussion_threads t where t.id=thread_id and t.status<>'hidden'
));

-- Individual appreciation records remain private. Counts are exposed only by the
-- audience-shaped conversation functions below.
create policy discussion_appreciations_own on public.discussion_appreciations
for all to authenticated
using(public.is_active() and member_id=auth.uid())
with check(public.is_active() and member_id=auth.uid() and exists(
  select 1 from public.discussion_threads t where t.id=thread_id and t.status<>'hidden'
));

create function public.discussion_feed(
  search_query text default '',
  saved_only boolean default false,
  target_author uuid default null,
  page_number int default 1
)
returns table(
  id uuid,author_id uuid,author_name text,author_avatar_path text,title text,body text,
  status text,pinned boolean,created_at timestamptz,reply_count bigint,
  appreciation_count bigint,saved boolean,appreciated boolean,total bigint
)
language sql stable security definer set search_path='' as $$
  select t.id,t.author_id,
    case when p.directory_visible or t.author_id=auth.uid() or public.is_admin()
      then p.display_name else 'A member' end,
    case when p.directory_visible or t.author_id=auth.uid() or public.is_admin()
      then p.avatar_path else null end,
    t.title,t.body,t.status,t.pinned,t.created_at,
    (select count(*) from public.discussion_comments c where c.thread_id=t.id and not c.hidden),
    (select count(*) from public.discussion_appreciations a where a.thread_id=t.id),
    exists(select 1 from public.discussion_saves s where s.thread_id=t.id and s.member_id=auth.uid()),
    exists(select 1 from public.discussion_appreciations a where a.thread_id=t.id and a.member_id=auth.uid()),
    count(*) over()
  from public.discussion_threads t
  join public.member_profiles p on p.user_id=t.author_id
  join public.memberships m on m.user_id=t.author_id
  where public.is_active() and t.status<>'hidden' and m.status='active'
    and (target_author is null or t.author_id=target_author)
    and (not saved_only or exists(
      select 1 from public.discussion_saves s where s.thread_id=t.id and s.member_id=auth.uid()
    ))
    and (search_query='' or concat_ws(' ',t.title,t.body,p.display_name) ilike '%'||left(search_query,200)||'%')
  order by t.pinned desc,t.created_at desc,t.id
  limit 24 offset (greatest(1,least(page_number,1000))-1)*24;
$$;

create function public.discussion_detail(target uuid)
returns table(
  id uuid,author_id uuid,author_name text,author_avatar_path text,title text,body text,
  status text,pinned boolean,created_at timestamptz,reply_count bigint,
  appreciation_count bigint,saved boolean,appreciated boolean,total bigint
)
language sql stable security definer set search_path='' as $$
  select t.id,t.author_id,
    case when p.directory_visible or t.author_id=auth.uid() or public.is_admin()
      then p.display_name else 'A member' end,
    case when p.directory_visible or t.author_id=auth.uid() or public.is_admin()
      then p.avatar_path else null end,
    t.title,t.body,t.status,t.pinned,t.created_at,
    (select count(*) from public.discussion_comments c where c.thread_id=t.id and not c.hidden),
    (select count(*) from public.discussion_appreciations a where a.thread_id=t.id),
    exists(select 1 from public.discussion_saves s where s.thread_id=t.id and s.member_id=auth.uid()),
    exists(select 1 from public.discussion_appreciations a where a.thread_id=t.id and a.member_id=auth.uid()),
    1::bigint
  from public.discussion_threads t
  join public.member_profiles p on p.user_id=t.author_id
  join public.memberships m on m.user_id=t.author_id
  where public.is_active() and t.id=target and t.status<>'hidden' and m.status='active';
$$;

create function public.discussion_replies(target uuid)
returns table(
  id uuid,thread_id uuid,author_id uuid,author_name text,author_avatar_path text,
  body text,parent_id uuid,created_at timestamptz,edited_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select c.id,c.thread_id,c.author_id,
    case when p.directory_visible or c.author_id=auth.uid() or public.is_admin()
      then p.display_name else 'A member' end,
    case when p.directory_visible or c.author_id=auth.uid() or public.is_admin()
      then p.avatar_path else null end,
    c.body,c.parent_id,c.created_at,c.edited_at
  from public.discussion_comments c
  join public.discussion_threads t on t.id=c.thread_id
  join public.member_profiles p on p.user_id=c.author_id
  join public.memberships m on m.user_id=c.author_id
  where public.is_active() and c.thread_id=target and not c.hidden
    and t.status<>'hidden' and m.status='active'
  order by c.created_at,c.id;
$$;

revoke all on function public.discussion_feed(text,boolean,uuid,integer),
  public.discussion_detail(uuid),public.discussion_replies(uuid) from public;
grant execute on function public.discussion_feed(text,boolean,uuid,integer),
  public.discussion_detail(uuid),public.discussion_replies(uuid) to authenticated;
