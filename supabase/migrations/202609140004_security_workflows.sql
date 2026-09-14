-- Check the Auth session as well as the JWT so sign-out revokes API access now.
create function public.has_session() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.user_id=auth.uid()
 and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function public.has_session() from public;
grant execute on function public.has_session() to anon,authenticated,service_role;
create or replace function public.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select public.has_session() and exists(select 1 from public.memberships where user_id=auth.uid() and status='active'
 and valid_after<=to_timestamp(coalesce((auth.jwt()->>'iat')::bigint,0)));
$$;
drop policy profiles_read on public.member_profiles;
create policy profiles_read on public.member_profiles for select to authenticated using(
 (public.is_active() and directory_visible and public.visible_member(user_id)) or
 (public.has_session() and user_id=auth.uid() and exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','invited'))));
drop policy terms_read on public.taxonomy_terms;
create policy terms_read on public.taxonomy_terms for select to authenticated using(active and public.has_session()
 and exists(select 1 from public.memberships where user_id=auth.uid() and status in ('active','invited')));

create table public.member_consents (
 member_id uuid primary key references public.memberships(user_id) on delete cascade,
 policy_version text not null, accepted_at timestamptz not null
);
insert into public.member_consents select user_id,policy_version,accepted_policy_at from public.member_profiles where policy_version is not null and accepted_policy_at is not null;
alter table public.member_profiles drop column policy_version, drop column accepted_policy_at;
alter table public.member_consents enable row level security;
revoke all on public.member_consents from anon,authenticated;
grant select on public.member_consents to authenticated;
grant all on public.member_consents to service_role;
create policy consent_read on public.member_consents for select to authenticated using(public.is_admin() or (public.is_active() and member_id=auth.uid()));

alter table public.member_invitations add column auth_user_id uuid references auth.users(id);
update public.member_invitations i set auth_user_id=u.id from auth.users u where lower(u.email)=i.email;
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.member_invitations where email=lower(new.email) and accepted_at is null and expires_at>now()) then
  insert into public.memberships(user_id) values(new.id);
  insert into public.member_profiles(user_id) values(new.id);
  update public.member_invitations set auth_user_id=new.id where email=lower(new.email);
 end if;
 return new;
end; $$;
create or replace function public.finish_onboarding(profile jsonb, terms uuid[], policy text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); email_address text; member_status text;
begin
 if not public.has_session() then raise exception 'Session required'; end if;
 select email into email_address from auth.users where id=uid and email_confirmed_at is not null and length(encrypted_password)>0;
 select status into member_status from public.memberships where user_id=uid for update;
 if email_address is null or member_status is distinct from 'invited' or coalesce(length(policy),0)<1 then raise exception 'Verified invitation and password required'; end if;
 update public.member_invitations set accepted_by=uid,accepted_at=now() where email=lower(email_address) and accepted_at is null and expires_at>now();
 if not found then raise exception 'Invitation expired'; end if;
 if coalesce(length(trim(profile->>'display_name')),0)<2 then raise exception 'Name required'; end if;
 update public.member_profiles set display_name=trim(profile->>'display_name'),title=coalesce(profile->>'title',''),company=coalesce(profile->>'company',''),
 bio=coalesce(profile->>'bio',''),city=coalesce(profile->>'city',''),region=coalesce(profile->>'region',''),country=coalesce(profile->>'country',''),
 directory_visible=coalesce((profile->>'directory_visible')::boolean,false),onboarding_complete=true,updated_at=now() where user_id=uid;
 insert into public.member_consents values(uid,policy,now());
 insert into public.member_taxonomy_terms select uid,id from public.taxonomy_terms where id=any(terms) and active on conflict do nothing;
 update public.memberships set status='active' where user_id=uid;
 insert into public.audit_events(actor_id,action,target) values(uid,'invitation.accepted',uid::text);
end; $$;

create or replace function public.admin_member(target uuid,new_status text,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or target=auth.uid() or coalesce(length(trim(reason)),0)<3 then raise exception 'Administrator and reason required'; end if;
 if new_status not in ('active','suspended','revoked') then raise exception 'Invalid status'; end if;
 if new_status='active' and not exists(select 1 from public.member_profiles where user_id=target and onboarding_complete) then raise exception 'Onboarding incomplete'; end if;
 update public.memberships set status=new_status where user_id=target;
 if not found then raise exception 'Member not found'; end if;
 if new_status in ('suspended','revoked') then delete from auth.sessions where user_id=target; end if;
 insert into public.admin_notes(target_type,target_id,body) values('member',target,reason);
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),'member.'||new_status,target::text);
end; $$;

-- Abuse limits also apply to callers bypassing the Next.js forms.
create function private.limit_member_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  if not public.is_active() then raise exception 'Membership required'; end if;
  if not public.check_rate_limit('write:'||tg_table_name||':'||auth.uid()::text,40,3600) then raise exception 'Please wait before posting again'; end if;
  if tg_table_name in ('discussion_threads','discussion_comments') and not exists(
   select 1 from public.portal_content where section='Portal Settings:community' and fields->>'Guidelines URL' like 'https://%'
  ) then raise exception 'Community guidelines must be published before posting'; end if;
 end if;
 return new;
end; $$;
create trigger discussion_rate before insert on public.discussion_threads for each row execute function private.limit_member_write();
create trigger comment_rate before insert on public.discussion_comments for each row execute function private.limit_member_write();
create trigger report_rate before insert on public.discussion_reports for each row execute function private.limit_member_write();
create trigger intro_rate before insert on public.introduction_requests for each row execute function private.limit_member_write();

alter table public.discussion_threads add column edited_at timestamptz;
alter table public.discussion_comments add column edited_at timestamptz;
create function public.edit_discussion(kind text,target uuid,body_text text,heading text default null,remove boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active() then raise exception 'Membership required'; end if;
 if not public.check_rate_limit('edit:'||auth.uid()::text,40,3600) then raise exception 'Please wait before editing again'; end if;
 if kind='thread' then
  update public.discussion_threads set body=case when remove then body else body_text end,
   title=case when remove then title else heading end,status=case when remove then 'hidden' else status end,edited_at=now()
   where id=target and author_id=auth.uid() and status='open';
 elsif kind='comment' then
  update public.discussion_comments c set body=case when remove then body else body_text end,hidden=remove,edited_at=now()
   where c.id=target and c.author_id=auth.uid() and not c.hidden and exists(select 1 from public.discussion_threads t where t.id=c.thread_id and t.status='open');
 else raise exception 'Unknown contribution type';
 end if;
 if not found then raise exception 'Only your own open contributions can be changed'; end if;
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),case when remove then 'discussion.removed' else 'discussion.edited' end,target::text);
end; $$;
revoke all on function public.edit_discussion(text,uuid,text,text,boolean) from public;
grant execute on function public.edit_discussion(text,uuid,text,text,boolean) to authenticated;

-- PostgreSQL requires immutable functions for generated search columns.
create function public.search_topics(text[]) returns text language sql immutable set search_path='' as $$ select array_to_string($1,' '); $$;
alter table public.resources drop column search_document;
alter table public.resources add column search_document tsvector generated always as (
 to_tsvector('english',title||' '||summary||' '||body||' '||author||' '||public.search_topics(topics))) stored;
create index resources_search on public.resources using gin(search_document);
revoke all on function public.search_topics(text[]) from public;
grant execute on function public.search_topics(text[]) to authenticated,service_role;
