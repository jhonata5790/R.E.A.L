create table if not exists public.user_libraries (
    owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint user_libraries_payload_object check (jsonb_typeof(payload) = 'object'),
    constraint user_libraries_payload_size check (pg_column_size(payload) <= 8388608)
);

alter table public.user_libraries enable row level security;

revoke all on table public.user_libraries from anon;
grant select, insert, update, delete on table public.user_libraries to authenticated;
grant all on table public.user_libraries to service_role;

create policy "Users can read their own library"
on public.user_libraries
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own library"
on public.user_libraries
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own library"
on public.user_libraries
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own library"
on public.user_libraries
for delete
to authenticated
using ((select auth.uid()) = owner_id);
