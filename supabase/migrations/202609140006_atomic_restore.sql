create function public.restore_revision(target uuid,actor uuid,reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior public.cms_revisions; result uuid;
begin
 if actor is null or coalesce(length(trim(reason)),0)<3 then raise exception 'Administrator and reason required'; end if;
 select * into prior from public.cms_revisions where id=target;
 if not found then raise exception 'Revision not found'; end if;
 result:=public.publish_content(prior.snapshot,prior.source_hash,actor);
 insert into public.admin_notes(target_type,target_id,body) values('revision',result,reason);
 insert into public.audit_events(actor_id,action,target) values(actor,'cms.restored',target::text);
 return result;
end; $$;
revoke all on function public.restore_revision(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.restore_revision(uuid,uuid,text) to service_role;
