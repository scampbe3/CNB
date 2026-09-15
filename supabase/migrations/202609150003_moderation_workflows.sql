alter table public.discussion_reports alter column thread_id drop not null;
alter table public.discussion_reports add column reported_member_id uuid references public.memberships(user_id);
alter table public.discussion_reports add constraint discussion_report_target check (
 (thread_id is not null and comment_id is null and reported_member_id is null) or
 (thread_id is not null and comment_id is not null and reported_member_id is null) or
 (thread_id is null and comment_id is null and reported_member_id is not null)
);
create unique index one_open_discussion_report on public.discussion_reports(
 reporter_id,coalesce(thread_id,'00000000-0000-0000-0000-000000000000'::uuid),
 coalesce(comment_id,'00000000-0000-0000-0000-000000000000'::uuid),
 coalesce(reported_member_id,'00000000-0000-0000-0000-000000000000'::uuid)
) where not resolved;

create table public.member_warnings (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.memberships(user_id),
 issued_by uuid not null references public.memberships(user_id),
 message text not null check(length(trim(message)) between 10 and 2000),
 reason text not null check(length(trim(reason)) between 3 and 1000),
 acknowledged_at timestamptz,
 withdrawn_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.member_warnings enable row level security;
revoke all on public.member_warnings from anon,authenticated;
grant all on public.member_warnings to service_role;
grant select on public.member_warnings to authenticated;
create policy warning_admin_all on public.member_warnings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy warning_recipient_read on public.member_warnings for select to authenticated using(public.is_active() and member_id=auth.uid());

drop policy reports_add on public.discussion_reports;
create policy reports_add on public.discussion_reports for insert to authenticated with check(
 public.is_active() and reporter_id=auth.uid() and not resolved and (
  (thread_id is not null and comment_id is null and reported_member_id is null and exists(select 1 from public.discussion_threads where id=thread_id and status<>'hidden')) or
  (thread_id is not null and comment_id is not null and reported_member_id is null and exists(select 1 from public.discussion_comments where id=comment_id and thread_id=discussion_reports.thread_id and not hidden)) or
  (thread_id is null and comment_id is null and reported_member_id is not null and reported_member_id<>auth.uid() and public.visible_member(reported_member_id))
 )
);

create function public.issue_member_warning(target uuid,message text,reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or target=auth.uid() or coalesce(length(trim(message)),0)<10 or coalesce(length(trim(reason)),0)<3 then raise exception 'Administrator, message, and reason required'; end if;
 if not exists(select 1 from public.memberships where user_id=target) then raise exception 'Member not found'; end if;
 insert into public.member_warnings(member_id,issued_by,message,reason) values(target,auth.uid(),trim(message),trim(reason));
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),'member.warned',target::text);
end; $$;
revoke all on function public.issue_member_warning(uuid,text,text) from public;
grant execute on function public.issue_member_warning(uuid,text,text) to authenticated;

create function public.moderate_comment(target uuid,hide boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 update public.discussion_comments set hidden=hide where id=target;
 if not found then raise exception 'Comment not found'; end if;
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),case when hide then 'comment.hidden' else 'comment.restored' end,target::text);
end; $$;
revoke all on function public.moderate_comment(uuid,boolean) from public;
grant execute on function public.moderate_comment(uuid,boolean) to authenticated;

create function public.moderate_thread(target uuid,new_status text,pin boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or new_status not in ('open','locked','hidden') then raise exception 'Administrator and valid status required'; end if;
 update public.discussion_threads set status=new_status,pinned=pin where id=target;
 if not found then raise exception 'Conversation not found'; end if;
 insert into public.audit_events(actor_id,action,target) values(auth.uid(),'thread.'||new_status,target::text);
end; $$;
revoke all on function public.moderate_thread(uuid,text,boolean) from public;
grant execute on function public.moderate_thread(uuid,text,boolean) to authenticated;
