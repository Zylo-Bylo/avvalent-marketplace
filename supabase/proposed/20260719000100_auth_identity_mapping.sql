-- Proposed production Auth-to-app-user mapping table.
-- Do not run without a separate approval. This file is intentionally outside
-- supabase/migrations so the current production RLS dry-run remains unchanged.

begin;

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

create unique index if not exists "AuthIdentityMapping_userId_key"
  on public."AuthIdentityMapping" ("userId");

create unique index if not exists "AuthIdentityMapping_authUserId_key"
  on public."AuthIdentityMapping" ("authUserId");

create index if not exists "AuthIdentityMapping_provider_idx"
  on public."AuthIdentityMapping" ("provider");

alter table public."AuthIdentityMapping" enable row level security;

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
