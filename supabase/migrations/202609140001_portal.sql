create schema if not exists private;
revoke all on schema private from public;

create table public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
 role text not null default 'member' check (role in ('member','admin')),
 valid_after timestamptz not null default '1970-01-01', created_at timestamptz not null default now()
);
create function public.is_active() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where user_id=auth.uid() and status='active'
 and valid_after <= to_timestamp(coalesce((auth.jwt()->>'iat')::bigint,0)));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_active() and exists(select 1 from public.memberships where user_id=auth.uid() and role='admin');
$$;

create table public.member_invitations (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email)),
 invited_by uuid references auth.users(id), expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users(id), accepted_at timestamptz, created_at timestamptz not null default now()
);
create table public.member_profiles (
 user_id uuid primary key references public.memberships(user_id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 title text not null default '' check(length(title)<=120), company text not null default '' check(length(company)<=160),
 bio text not null default '' check(length(bio)<=3000),
 city text not null default '' check(length(city)<=100), region text not null default '' check(length(region)<=100),
 country text not null default '' check(length(country)<=100), avatar_path text,
 directory_visible boolean not null default false, onboarding_complete boolean not null default false,
 policy_version text, accepted_policy_at timestamptz, updated_at timestamptz not null default now()
);
create table public.taxonomy_terms (
 id uuid primary key, kind text not null check(kind in ('profession','expertise','education_group','institution','sorority','military_service','topic')),
 label text not null check(length(label) between 1 and 160), parent_id uuid references public.taxonomy_terms(id) deferrable initially deferred,
 active boolean not null default true, display_order int not null default 10, unique(kind,label)
);
create table public.member_taxonomy_terms (
 member_id uuid references public.member_profiles(user_id) on delete cascade,
 term_id uuid references public.taxonomy_terms(id), primary key(member_id,term_id)
);
create table public.file_assets (
 id uuid primary key default gen_random_uuid(), path text not null unique,
 name text not null, mime text not null, bytes bigint not null check(bytes>0), checksum text not null,
 created_at timestamptz not null default now()
);
create table public.resources (
 id uuid primary key, slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check(length(title) between 1 and 240), summary text not null default '', body text not null default '',
 type text not null check(type in ('Essay','AI Prompt','Decision Brief','Business Case')),
 access text not null default 'member' check(access in ('public','member')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 author text not null default '', topics text[] not null default '{}', published_at timestamptz,
 image text, image_alt text not null default '', file_asset_id uuid references public.file_assets(id), external_url text,
 display_order int not null default 10,
 search_document tsvector generated always as (to_tsvector('english', title || ' ' || summary || ' ' || body || ' ' || author)) stored,
 updated_at timestamptz not null default now()
);
create index resources_search on public.resources using gin(search_document);
create table public.saved_resources (
 member_id uuid references public.memberships(user_id) on delete cascade,
 resource_id uuid references public.resources(id), saved_at timestamptz not null default now(), primary key(member_id,resource_id)
);
create table public.events (
 id uuid primary key, type text not null check(type in ('board','dinner')), title text not null,
 description text not null default '', starts_at timestamptz not null, ends_at timestamptz not null,
 timezone text not null default 'America/New_York', capacity int not null check(capacity between 1 and 10000),
 status text not null default 'draft' check(status in ('draft','published','cancelled','archived')),
 location_label text not null default '', image text, updated_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table public.event_details (
 event_id uuid primary key references public.events(id) on delete cascade,
 instructions text not null default '', meeting_url text, materials_resource_id uuid references public.resources(id)
);
create table public.event_invitations (
 event_id uuid references public.events(id) on delete cascade, member_id uuid references public.memberships(user_id) on delete cascade,
 created_at timestamptz not null default now(), primary key(event_id,member_id)
);
create function public.can_view_event(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (public.is_active() and exists(select 1 from public.events e where e.id=target
 and e.status in ('published','cancelled') and (e.type='board' or exists(select 1 from public.event_invitations i where i.event_id=e.id and i.member_id=auth.uid()))));
$$;
create table public.event_rsvps (
 event_id uuid references public.events(id) on delete cascade, member_id uuid references public.memberships(user_id) on delete cascade,
 response text not null check(response in ('yes','no','waitlist')), dietary_note text not null default '' check(length(dietary_note)<=500),
 updated_at timestamptz not null default now(), primary key(event_id,member_id)
);
create table public.discussion_threads (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.memberships(user_id),
 title text not null check(length(title) between 3 and 200), body text not null check(length(body) between 1 and 10000),
 status text not null default 'open' check(status in ('open','locked','hidden')), pinned boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.discussion_comments (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.discussion_threads(id),
 author_id uuid not null references public.memberships(user_id), body text not null check(length(body) between 1 and 5000),
 hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.discussion_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.memberships(user_id),
 thread_id uuid not null references public.discussion_threads(id), comment_id uuid references public.discussion_comments(id),
 reason text not null check(length(reason) between 3 and 1000), resolved boolean not null default false, created_at timestamptz not null default now()
);
create table public.introduction_requests (
 id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.memberships(user_id),
 target_id uuid not null references public.memberships(user_id), context text not null check(length(context) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','accepted','declined','completed')),
 created_at timestamptz not null default now(), check(requester_id<>target_id)
);
create unique index one_pending_introduction on public.introduction_requests(requester_id,target_id) where status='pending';
create table public.admin_notes (id uuid primary key default gen_random_uuid(), target_type text not null, target_id uuid not null, body text not null, created_at timestamptz not null default now());
create table public.portal_content (section text primary key, fields jsonb not null default '{}');
create table public.cms_revisions (id uuid primary key default gen_random_uuid(), source_hash text not null, snapshot jsonb not null, actor_id uuid, created_at timestamptz not null default now());
create table public.audit_events (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, target text, created_at timestamptz not null default now());
create table private.rate_limits (key text primary key, count int not null, expires_at timestamptz not null);
create table private.publish_nonces (nonce text primary key, created_at timestamptz not null default now());
create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), recipient_id uuid references auth.users(id), kind text not null,
 event_id uuid references public.events(id), dedupe_key text not null unique, sent_at timestamptz,
 attempts int not null default 0, last_error text, created_at timestamptz not null default now()
);

create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.member_invitations where email=lower(new.email) and accepted_at is null and expires_at>now()) then
  insert into public.memberships(user_id) values(new.id);
  insert into public.member_profiles(user_id) values(new.id);
 end if;
 return new;
end; $$;
create trigger portal_new_user after insert on auth.users for each row execute function private.new_user();

create function public.finish_onboarding(profile jsonb, terms uuid[], policy text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); email_address text; member_status text;
begin
 select email into email_address from auth.users where id=uid and email_confirmed_at is not null;
 select status into member_status from public.memberships where user_id=uid for update;
 if email_address is null or member_status is distinct from 'invited' or length(policy)<1 then raise exception 'Invitation required'; end if;
 update public.member_invitations set accepted_by=uid, accepted_at=now() where email=lower(email_address) and accepted_at is null and expires_at>now();
 if not found then raise exception 'Invitation expired'; end if;
 if length(trim(profile->>'display_name'))<2 then raise exception 'Name required'; end if;
 update public.member_profiles set display_name=trim(profile->>'display_name'), title=coalesce(profile->>'title',''), company=coalesce(profile->>'company',''),
 bio=coalesce(profile->>'bio',''), city=coalesce(profile->>'city',''), region=coalesce(profile->>'region',''), country=coalesce(profile->>'country',''),
 directory_visible=coalesce((profile->>'directory_visible')::boolean,false), onboarding_complete=true, policy_version=policy, accepted_policy_at=now(), updated_at=now() where user_id=uid;
 insert into public.member_taxonomy_terms select uid,id from public.taxonomy_terms where id=any(terms) and active on conflict do nothing;
 update public.memberships set status='active' where user_id=uid;
 insert into public.audit_events(actor_id,action,target) values(uid,'invitation.accepted',uid::text);
end; $$;

create function public.update_profile(profile jsonb, terms uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active() then raise exception 'Membership required'; end if;
 if length(trim(profile->>'display_name'))<2 then raise exception 'Name required'; end if;
 update public.member_profiles set display_name=trim(profile->>'display_name'), title=coalesce(profile->>'title',''), company=coalesce(profile->>'company',''),
 bio=coalesce(profile->>'bio',''), city=coalesce(profile->>'city',''), region=coalesce(profile->>'region',''), country=coalesce(profile->>'country',''),
 directory_visible=coalesce((profile->>'directory_visible')::boolean,false), updated_at=now() where user_id=auth.uid();
 delete from public.member_taxonomy_terms where member_id=auth.uid();
 insert into public.member_taxonomy_terms select auth.uid(),id from public.taxonomy_terms where id=any(terms) and active;
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),'profile.updated',auth.uid()::text);
end; $$;

create function public.directory_search(query text default '', filters uuid[] default '{}', location_query text default '', page_number int default 1)
returns table(user_id uuid,display_name text,title text,company text,city text,region text,country text,avatar_path text,tags jsonb,total bigint)
language sql stable security invoker set search_path='' as $$
 select p.user_id,p.display_name,p.title,p.company,p.city,p.region,p.country,p.avatar_path,
 coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'kind',t.kind)) from public.member_taxonomy_terms mt join public.taxonomy_terms t on t.id=mt.term_id where mt.member_id=p.user_id),'[]'), count(*) over()
 from public.member_profiles p where p.directory_visible and p.onboarding_complete
 and (query='' or concat_ws(' ',p.display_name,p.title,p.company,p.bio,p.city,p.region,p.country) ilike '%'||query||'%' or exists(select 1 from public.member_taxonomy_terms mt join public.taxonomy_terms t on t.id=mt.term_id where mt.member_id=p.user_id and t.label ilike '%'||query||'%'))
 and (location_query='' or concat_ws(' ',p.city,p.region,p.country) ilike '%'||location_query||'%')
 and not exists(select 1 from public.taxonomy_terms selected where selected.id=any(filters) group by selected.kind having not exists(
 select 1 from public.member_taxonomy_terms mt join public.taxonomy_terms actual on actual.id=mt.term_id
 where mt.member_id=p.user_id and (actual.id=any(array_agg(selected.id)) or actual.parent_id=any(array_agg(selected.id)))))
 order by p.display_name,p.user_id limit 24 offset (greatest(1,least(page_number,1000))-1)*24;
$$;

create function public.rsvp(target uuid, answer text, note text default '') returns text language plpgsql security definer set search_path='' as $$
declare capacity_limit int; final_answer text:=answer; promoted uuid;
begin
 if not public.can_view_event(target) or not public.is_active() then raise exception 'Invitation required'; end if;
 if answer not in ('yes','no') or length(note)>500 then raise exception 'Invalid RSVP'; end if;
 select capacity into capacity_limit from public.events where id=target and status='published' and starts_at>now() for update;
 if not found then raise exception 'Event closed'; end if;
 if answer='yes' and (select count(*) from public.event_rsvps where event_id=target and response='yes' and member_id<>auth.uid())>=capacity_limit then final_answer:='waitlist'; end if;
 insert into public.event_rsvps(event_id,member_id,response,dietary_note) values(target,auth.uid(),final_answer,note)
 on conflict(event_id,member_id) do update set response=excluded.response,dietary_note=excluded.dietary_note,updated_at=now();
 if answer='no' and (select count(*) from public.event_rsvps where event_id=target and response='yes')<capacity_limit then
  select r.member_id into promoted from public.event_rsvps r join public.memberships m on m.user_id=r.member_id where r.event_id=target and r.response='waitlist' and m.status='active'
  and exists(select 1 from public.events e where e.id=target and (e.type='board' or exists(select 1 from public.event_invitations i where i.event_id=target and i.member_id=r.member_id)))
  order by r.updated_at limit 1;
  if promoted is not null then
   update public.event_rsvps set response='yes',updated_at=now() where event_id=target and member_id=promoted;
   insert into public.email_outbox(recipient_id,kind,event_id,dedupe_key) values(promoted,'waitlist-promoted',target,gen_random_uuid()::text);
  end if;
 end if;
 return final_answer;
end; $$;

create function public.admin_member(target uuid, new_status text, reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or target=auth.uid() or length(trim(reason))<3 then raise exception 'Administrator and reason required'; end if;
 if new_status not in ('active','suspended','revoked') then raise exception 'Invalid status'; end if;
 if new_status='active' and not exists(select 1 from public.member_profiles where user_id=target and onboarding_complete) then raise exception 'Onboarding incomplete'; end if;
 update public.memberships set status=new_status where user_id=target;
 insert into public.admin_notes(target_type,target_id,body) values('member',target,reason);
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),'member.'||new_status,target::text);
end; $$;

create function public.check_rate_limit(bucket text, maximum int, seconds int) returns boolean language plpgsql security definer set search_path='' as $$
declare attempts int;
begin
 insert into private.rate_limits(key,count,expires_at) values(bucket,1,now()+make_interval(secs=>seconds))
 on conflict(key) do update set count=case when private.rate_limits.expires_at<=now() then 1 else private.rate_limits.count+1 end,
 expires_at=case when private.rate_limits.expires_at<=now() then now()+make_interval(secs=>seconds) else private.rate_limits.expires_at end returning count into attempts;
 return attempts<=maximum;
end; $$;
create function public.claim_publish_nonce(value text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from private.publish_nonces where created_at<now()-interval '1 day';
 insert into private.publish_nonces(nonce) values(value) on conflict do nothing;
 return found;
end; $$;

-- Authorization is enforced for direct API calls as well as application requests.
do $$ declare t text; begin
 foreach t in array array['memberships','member_profiles','member_invitations','taxonomy_terms','member_taxonomy_terms','file_assets','resources','saved_resources','events','event_details','event_invitations','event_rsvps','discussion_threads','discussion_comments','discussion_reports','introduction_requests','admin_notes','portal_content','cms_revisions','audit_events','email_outbox'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy admin_all on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end; $$;
grant select on public.memberships,public.member_profiles,public.member_taxonomy_terms,public.taxonomy_terms,public.resources,public.saved_resources,public.events,public.event_details,public.event_invitations,public.event_rsvps,public.discussion_threads,public.discussion_comments,public.discussion_reports,public.introduction_requests,public.portal_content,public.cms_revisions,public.audit_events,public.file_assets,public.admin_notes,public.email_outbox to authenticated;
grant select on public.resources to anon;
grant select,insert,update,delete on public.member_invitations,public.event_details,public.event_invitations,public.admin_notes,public.file_assets to authenticated;
grant insert,delete on public.saved_resources to authenticated;
grant insert on public.discussion_threads,public.discussion_comments,public.discussion_reports,public.introduction_requests to authenticated;
grant update(status,pinned) on public.discussion_threads to authenticated;
grant update(hidden) on public.discussion_comments to authenticated;
grant update(resolved) on public.discussion_reports to authenticated;
grant update(status) on public.introduction_requests to authenticated;
grant update(avatar_path) on public.member_profiles to authenticated;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
create policy profiles_read on public.member_profiles for select to authenticated using((public.is_active() and directory_visible and exists(select 1 from public.memberships m where m.user_id=member_profiles.user_id and m.status='active')) or (user_id=auth.uid() and exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','invited'))));
-- The target membership check must not inherit the requesting member's membership policy.
create function public.visible_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships where user_id=target and status='active'); $$;
drop policy profiles_read on public.member_profiles;
create policy profiles_read on public.member_profiles for select to authenticated using((public.is_active() and directory_visible and public.visible_member(user_id)) or (user_id=auth.uid() and exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','invited'))));
create policy profile_avatar on public.member_profiles for update to authenticated using(public.is_active() and user_id=auth.uid()) with check(user_id=auth.uid() and (avatar_path is null or avatar_path like auth.uid()::text||'/%'));
create policy terms_read on public.taxonomy_terms for select to authenticated using(active and exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','invited')));
create policy profile_terms_read on public.member_taxonomy_terms for select to authenticated using(exists(select 1 from public.member_profiles p where p.user_id=member_id));
create policy resources_read on public.resources for select to anon,authenticated using(status='published' and (published_at is null or published_at<=now()) and (access='public' or public.is_active()));
create policy saved_read on public.saved_resources for select to authenticated using(public.is_active() and member_id=auth.uid());
create policy saved_add on public.saved_resources for insert to authenticated with check(public.is_active() and member_id=auth.uid() and exists(select 1 from public.resources where id=resource_id));
create policy saved_remove on public.saved_resources for delete to authenticated using(public.is_active() and member_id=auth.uid());
create policy events_read on public.events for select to authenticated using(public.can_view_event(id));
create policy event_details_read on public.event_details for select to authenticated using(public.can_view_event(event_id));
create policy event_invites_read on public.event_invitations for select to authenticated using(public.is_active() and member_id=auth.uid());
create policy rsvps_read on public.event_rsvps for select to authenticated using(public.is_active() and member_id=auth.uid());
create policy threads_read on public.discussion_threads for select to authenticated using(public.is_active() and status<>'hidden');
create policy threads_add on public.discussion_threads for insert to authenticated with check(public.is_active() and author_id=auth.uid() and status='open' and not pinned);
create policy comments_read on public.discussion_comments for select to authenticated using(public.is_active() and not hidden and exists(select 1 from public.discussion_threads where id=thread_id));
create policy comments_add on public.discussion_comments for insert to authenticated with check(public.is_active() and author_id=auth.uid() and not hidden and exists(select 1 from public.discussion_threads where id=thread_id and status='open'));
create policy reports_own on public.discussion_reports for select to authenticated using(public.is_active() and reporter_id=auth.uid());
create policy reports_add on public.discussion_reports for insert to authenticated with check(public.is_active() and reporter_id=auth.uid() and not resolved and exists(select 1 from public.discussion_threads where id=thread_id) and (comment_id is null or exists(select 1 from public.discussion_comments where id=comment_id and thread_id=discussion_reports.thread_id)));
create policy intro_read on public.introduction_requests for select to authenticated using(public.is_active() and requester_id=auth.uid());
create policy intro_add on public.introduction_requests for insert to authenticated with check(public.is_active() and requester_id=auth.uid() and status='pending' and exists(select 1 from public.member_profiles where user_id=target_id and directory_visible));
create policy content_read on public.portal_content for select to authenticated using(public.is_active());

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_active(),public.is_admin() to anon,authenticated,service_role;
grant execute on function public.visible_member(uuid),public.can_view_event(uuid),public.directory_search(text,uuid[],text,integer),public.finish_onboarding(jsonb,uuid[],text),public.update_profile(jsonb,uuid[]),public.rsvp(uuid,text,text),public.admin_member(uuid,text,text) to authenticated;
grant execute on function public.check_rate_limit(text,integer,integer),public.claim_publish_nonce(text) to service_role;
