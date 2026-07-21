-- Production prerequisite for Auth-to-app-user admin mapping.
-- Safe order:
-- 1. Create mapping table.
-- 2. Revoke direct anon/authenticated privileges.
-- 3. Enable RLS before any mapping row is inserted.
-- 4. Create the private admin helper required by mapping policies.
-- 5. Create narrowly scoped admin-only policies.
--
-- This migration intentionally does not insert mapping rows and does not update
-- auth.users app_metadata. Those remain separate one-time approved operations.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public."AuthIdentityMapping" (
  "id" text primary key,
  "userId" text not null,
  "authUserId" uuid not null,
  "provider" text not null default 'supabase',
  "createdAt" timestamp(6) without time zone default current_timestamp,
  "updatedAt" timestamp(6) without time zone default current_timestamp,
  constraint "AuthIdentityMapping_userId_fkey"
    foreign key ("userId") references public."User"(id)
    on update cascade on delete cascade
);

revoke all on table public."AuthIdentityMapping" from public, anon, authenticated;

alter table public."AuthIdentityMapping" enable row level security;

create unique index if not exists "AuthIdentityMapping_userId_key"
  on public."AuthIdentityMapping" ("userId");

create unique index if not exists "AuthIdentityMapping_authUserId_key"
  on public."AuthIdentityMapping" ("authUserId");

create index if not exists "AuthIdentityMapping_provider_idx"
  on public."AuthIdentityMapping" ("provider");

create or replace function private.zylo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'ADMIN', false)
$$;

revoke all on function private.zylo_is_admin() from public, anon, authenticated;
grant execute on function private.zylo_is_admin() to authenticated;

drop policy if exists "auth_identity_mapping_select_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_insert_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_update_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_delete_admin" on public."AuthIdentityMapping";

create policy "auth_identity_mapping_select_admin" on public."AuthIdentityMapping"
  for select to authenticated
  using (private.zylo_is_admin());

create policy "auth_identity_mapping_insert_admin" on public."AuthIdentityMapping"
  for insert to authenticated
  with check (private.zylo_is_admin());

create policy "auth_identity_mapping_update_admin" on public."AuthIdentityMapping"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

create policy "auth_identity_mapping_delete_admin" on public."AuthIdentityMapping"
  for delete to authenticated
  using (private.zylo_is_admin());

commit;
