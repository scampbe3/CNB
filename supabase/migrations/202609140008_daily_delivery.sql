-- One leased worker, durable payloads and a rolling allowance for event mail.
alter table public.email_outbox
 add column delivery_payload jsonb,
 add column first_attempt_at timestamptz,
 add column next_attempt_at timestamptz not null default now(),
 add column delivery_unknown boolean not null default false,
 add column needs_review boolean not null default false,
 add column skipped_at timestamptz;
create table private.mail_worker (singleton boolean primary key default true check(singleton), token uuid, expires_at timestamptz);
insert into private.mail_worker values(true,null,null);
create table private.mail_attempts (created_at timestamptz not null default now());
create index on private.mail_attempts(created_at);
create function public.start_mail_worker(worker uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update private.mail_worker set token=worker,expires_at=now()+interval '65 seconds'
 where singleton and (expires_at is null or expires_at<now());
 return found;
end; $$;
create function public.stop_mail_worker(worker uuid) returns void
language sql security definer set search_path='' as $$
 update private.mail_worker set token=null,expires_at=null where token=worker;
$$;
create function public.claim_portal_email(worker uuid) returns setof public.email_outbox
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform 1 from private.mail_worker where token=worker and expires_at>now() for update;
 if not found then return; end if;
 delete from private.mail_attempts where created_at<now()-interval '2 days';
 update public.email_outbox set needs_review=true,last_error='Delivery uncertain: check provider before retrying'
 where sent_at is null and skipped_at is null and delivery_unknown and first_attempt_at<now()-interval '23 hours';
 if (select count(*) from private.mail_attempts where created_at>now()-interval '24 hours')>=80 then return; end if;
 select id into target from public.email_outbox
 where sent_at is null and skipped_at is null and not needs_review and attempts<5
 and next_attempt_at<=now() and (locked_until is null or locked_until<now())
 order by case when kind='event-reminder' then 1 else 0 end,created_at
 for update skip locked limit 1;
 if target is null then return; end if;
 insert into private.mail_attempts default values;
 return query update public.email_outbox set attempts=attempts+1,locked_until=now()+interval '2 minutes'
 where id=target returning *;
end; $$;
revoke all on function public.start_mail_worker(uuid),public.stop_mail_worker(uuid),public.claim_portal_email(uuid) from public,anon,authenticated;
grant execute on function public.start_mail_worker(uuid),public.stop_mail_worker(uuid),public.claim_portal_email(uuid) to service_role;
revoke execute on function public.claim_emails() from service_role;

alter table public.audit_events add column details jsonb not null default '{}';
create function public.review_portal_email(target uuid,decision text,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare message public.email_outbox;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if length(trim(reason))<10 or length(reason)>1000 or decision not in ('sent','retry','skip') then raise exception 'A provider check and valid decision are required'; end if;
 select * into message from public.email_outbox where id=target for update;
 if not found or not message.needs_review or message.sent_at is not null or message.skipped_at is not null
   or message.locked_until>now() then raise exception 'This email is not available for review'; end if;
 if decision='sent' then
  update public.email_outbox set sent_at=now(),needs_review=false,delivery_unknown=false,last_error=null where id=target;
 elsif decision='skip' then
  update public.email_outbox set skipped_at=now(),needs_review=false,last_error='Closed after administrator review' where id=target;
 else
  -- Never overwrite an uncertain provider request; a reviewed retry gets a new key.
  update public.email_outbox set skipped_at=now(),needs_review=false,last_error='Replaced after administrator review' where id=target;
  insert into public.email_outbox(recipient_id,kind,event_id,dedupe_key)
  values(message.recipient_id,message.kind,message.event_id,'review:'||target::text);
 end if;
 insert into public.audit_events(actor_id,action,target,details)
 values(auth.uid(),'email-review-'||decision,target::text,jsonb_build_object('reason',reason));
end; $$;
revoke all on function public.review_portal_email(uuid,text,text) from public,anon;
grant execute on function public.review_portal_email(uuid,text,text) to authenticated;
