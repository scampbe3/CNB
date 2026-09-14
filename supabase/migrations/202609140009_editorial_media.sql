alter policy content_read on public.portal_content using(public.is_active() and (section not like 'page-sections:%' or fields->>'status'='published'));
create table public.editorial_media (
 id uuid primary key default gen_random_uuid(),
 path text not null unique,
 name text not null check(length(name)<=180),
 alt text not null check(length(alt) between 1 and 500),
 focal_x integer not null default 50 check(focal_x between 0 and 100),
 focal_y integer not null default 50 check(focal_y between 0 and 100),
 bytes integer not null check(bytes between 1 and 3145728),
 width integer not null check(width>0), height integer not null check(height>0),
 archived boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.editorial_media enable row level security;
grant select,insert,update on public.editorial_media to authenticated;
grant all on public.editorial_media to service_role;
create policy editorial_admin on public.editorial_media for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
create policy editorial_member on public.editorial_media for select to authenticated
 using(public.is_active() and not archived and exists(
  select 1 from public.portal_content c where c.section like 'page-sections:%'
  and c.fields->>'status'='published' and c.fields->>'imageAssetId'=editorial_media.id::text
 ));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('editorial-images','editorial-images',false,3145728,array['image/webp']);
create policy editorial_storage_admin on storage.objects for all to authenticated
using(bucket_id='editorial-images' and public.is_admin())
with check(bucket_id='editorial-images' and public.is_admin());

create function private.check_section_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.section like 'page-sections:%' and new.fields->>'status'='published' and coalesce(new.fields->>'imageAssetId','')<>'' then
  perform 1 from public.editorial_media where id=(new.fields->>'imageAssetId')::uuid and not archived for share;
  if not found then raise exception 'A published section references a missing or archived image'; end if;
 end if;
 return new;
end; $$;
create trigger check_section_media before insert or update on public.portal_content for each row execute function private.check_section_media();
create function private.check_media_archive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.archived and exists(select 1 from public.portal_content where section like 'page-sections:%' and fields->>'status'='published' and fields->>'imageAssetId'=new.id::text) then
  raise exception 'Remove this image from published sections before archiving it';
 end if;
 return new;
end; $$;
create trigger check_media_archive before update on public.editorial_media for each row execute function private.check_media_archive();
-- Downloads go through the authorized media route, including publication checks.
