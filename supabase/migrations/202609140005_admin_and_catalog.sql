create function public.admin_members(query text default '',page_number int default 1)
returns table(user_id uuid,email text,display_name text,status text,role text,directory_visible boolean,total bigint)
language sql stable security definer set search_path='' as $$
 select m.user_id,u.email,p.display_name,m.status,m.role,p.directory_visible,count(*) over()
 from public.memberships m join auth.users u on u.id=m.user_id join public.member_profiles p on p.user_id=m.user_id
 where public.is_admin() and (query='' or concat_ws(' ',p.display_name,u.email,m.user_id::text) ilike '%'||left(query,200)||'%')
 order by m.created_at desc,m.user_id limit 24 offset (greatest(1,least(page_number,1000))-1)*24;
$$;
revoke all on function public.admin_members(text,int) from public;
grant execute on function public.admin_members(text,int) to authenticated;

create or replace function public.directory_search(query text default '',filters uuid[] default '{}',location_query text default '',page_number int default 1)
returns table(user_id uuid,display_name text,title text,company text,city text,region text,country text,avatar_path text,tags jsonb,total bigint)
language sql stable security invoker set search_path='' as $$
 select p.user_id,p.display_name,p.title,p.company,p.city,p.region,p.country,p.avatar_path,
 coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'kind',t.kind)) from public.member_taxonomy_terms mt join public.taxonomy_terms t on t.id=mt.term_id where mt.member_id=p.user_id),'[]'),count(*) over()
 from public.member_profiles p where p.directory_visible and p.onboarding_complete
 and (query='' or concat_ws(' ',p.display_name,p.title,p.company,p.bio,p.city,p.region,p.country) ilike '%'||left(query,200)||'%' or exists(select 1 from public.member_taxonomy_terms mt join public.taxonomy_terms t on t.id=mt.term_id where mt.member_id=p.user_id and t.label ilike '%'||left(query,200)||'%'))
 and (location_query='' or concat_ws(' ',p.city,p.region,p.country) ilike '%'||left(location_query,100)||'%')
 and not exists(select 1 from public.taxonomy_terms selected where selected.id=any(filters)
 group by case when selected.kind in ('institution','education_group') then 'education' else selected.kind end having not exists(
 select 1 from public.member_taxonomy_terms mt join public.taxonomy_terms actual on actual.id=mt.term_id
 where mt.member_id=p.user_id and (actual.id=any(array_agg(selected.id)) or actual.parent_id=any(array_agg(selected.id)))))
 order by p.display_name,p.user_id limit 24 offset (greatest(1,least(page_number,1000))-1)*24;
$$;

create function private.event_type_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.type<>old.type then raise exception 'Create a new Event ID when changing between a board and a private dinner'; end if;
 return new;
end; $$;
create trigger event_type_immutable before update on public.events for each row execute function private.event_type_immutable();
update storage.buckets set file_size_limit=3145728 where id in ('member-avatars','member-resources');

alter table public.saved_resources add column saved_title text not null default '';
update public.saved_resources s set saved_title=r.title from public.resources r where r.id=s.resource_id;
create function private.bookmark_title() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select title into new.saved_title from public.resources where id=new.resource_id;
 return new;
end; $$;
create trigger bookmark_title before insert on public.saved_resources for each row execute function private.bookmark_title();
