alter table public.email_outbox add column locked_until timestamptz;
create function public.prepare_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.email_outbox(recipient_id,kind,event_id,dedupe_key)
 select r.member_id,'event-reminder',e.id,'reminder:'||e.id::text||':'||r.member_id::text||':'||e.starts_at::text
 from public.event_rsvps r join public.events e on e.id=r.event_id join public.memberships m on m.user_id=r.member_id
 where r.response='yes' and m.status='active' and e.status='published' and e.starts_at>now() and e.starts_at<now()+interval '25 hours'
 on conflict(dedupe_key) do nothing;
 delete from private.rate_limits where expires_at<now()-interval '1 day';
end; $$;
create function public.claim_emails() returns setof public.email_outbox language plpgsql security definer set search_path='' as $$
begin
 return query update public.email_outbox set attempts=attempts+1,locked_until=now()+interval '5 minutes'
 where id in(select id from public.email_outbox where sent_at is null and attempts<5 and (locked_until is null or locked_until<now()) order by created_at for update skip locked limit 20)
 returning *;
end; $$;
create function private.event_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='published' and (new.status='cancelled' or old.starts_at<>new.starts_at or old.ends_at<>new.ends_at) then
  insert into public.email_outbox(recipient_id,kind,event_id,dedupe_key)
  select member_id,case when new.status='cancelled' then 'event-cancelled' else 'event-updated' end,new.id,gen_random_uuid()::text
  from public.event_rsvps where event_id=new.id and response in ('yes','waitlist');
 end if;
 return new;
end; $$;
create trigger event_notifications after update on public.events for each row execute function private.event_notifications();
revoke execute on function public.prepare_reminders(),public.claim_emails() from public,anon,authenticated;
grant execute on function public.prepare_reminders(),public.claim_emails() to service_role;
