create or replace function public.publish_content(payload jsonb, hash text, actor uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare revision uuid;
begin
 perform pg_advisory_xact_lock(62061401);
 if actor is not null and not exists(select 1 from public.memberships where user_id=actor and role='admin' and status='active') then raise exception 'Administrator required'; end if;
 if jsonb_typeof(payload->'resources') is distinct from 'array' or jsonb_typeof(payload->'terms') is distinct from 'array' or jsonb_typeof(payload->'events') is distinct from 'array' or jsonb_typeof(payload->'content') is distinct from 'array' then raise exception 'Complete snapshot required'; end if;
 insert into public.cms_revisions(source_hash,snapshot,actor_id) values(hash,payload,actor) returning id into revision;
 insert into public.taxonomy_terms(id,kind,label,parent_id,active,display_order)
 select id,kind,label,parent_id,active,display_order from jsonb_to_recordset(payload->'terms') as x(id uuid,kind text,label text,parent_id uuid,active boolean,display_order int)
 on conflict(id) do update set kind=excluded.kind,label=excluded.label,parent_id=excluded.parent_id,active=excluded.active,display_order=excluded.display_order;
 insert into public.resources(id,slug,title,summary,body,type,access,status,author,topics,published_at,image,image_alt,file_asset_id,external_url,display_order)
 select id,slug,title,summary,body,type,access,status,author,topics,published_at,image,image_alt,file_asset_id,external_url,display_order
 from jsonb_to_recordset(payload->'resources') as x(id uuid,slug text,title text,summary text,body text,type text,access text,status text,author text,topics text[],published_at timestamptz,image text,image_alt text,file_asset_id uuid,external_url text,display_order int)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,body=excluded.body,type=excluded.type,access=excluded.access,status=excluded.status,author=excluded.author,topics=excluded.topics,published_at=excluded.published_at,image=excluded.image,image_alt=excluded.image_alt,file_asset_id=excluded.file_asset_id,external_url=excluded.external_url,display_order=excluded.display_order,updated_at=now();
 update public.resources set status='archived' where id not in(select (value->>'id')::uuid from jsonb_array_elements(payload->'resources'));
 update public.taxonomy_terms set active=false where id not in(select (value->>'id')::uuid from jsonb_array_elements(payload->'terms'));
 insert into public.events(id,type,title,description,starts_at,ends_at,timezone,capacity,status,location_label,image)
 select id,type,title,description,starts_at,ends_at,timezone,capacity,status,location_label,image
 from jsonb_to_recordset(payload->'events') as x(id uuid,type text,title text,description text,starts_at timestamptz,ends_at timestamptz,timezone text,capacity int,status text,location_label text,image text)
 on conflict(id) do update set type=excluded.type,title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,capacity=excluded.capacity,status=excluded.status,location_label=excluded.location_label,image=excluded.image,updated_at=now();
 update public.events set status='archived' where id not in(select (value->>'id')::uuid from jsonb_array_elements(payload->'events'));
 -- The explicit predicate satisfies hosted safe-update enforcement; section is a non-null primary key.
 delete from public.portal_content where section is not null;
 insert into public.portal_content(section,fields) select section,fields from jsonb_to_recordset(payload->'content') as x(section text,fields jsonb);
 insert into public.audit_events(actor_id,action,target) values(actor,'cms.published',revision::text);
 return revision;
end; $$;
revoke execute on function public.publish_content(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_content(jsonb,text,uuid) to service_role;
