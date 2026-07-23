-- Rollback for 20260722000100_enable_rls_legacy_lowercase_categories.sql.
-- Restores the previous legacy lowercase category table access model.
-- Do not apply without rollback approval.

begin;

drop policy if exists "categories_select_active_public" on public.categories;
drop policy if exists "subcategories_select_active_public" on public.subcategories;

alter table public.categories disable row level security;
alter table public.subcategories disable row level security;

grant all on table public.categories to anon, authenticated;
grant all on table public.subcategories to anon, authenticated;

create policy "Anyone can read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy "categories_manage_admin"
  on public.categories
  for all
  to public
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  );

create policy "Anyone can read subcategories"
  on public.subcategories
  for select
  to anon, authenticated
  using (true);

create policy "Public can view active subcategories"
  on public.subcategories
  for select
  to public
  using (is_active = true);

create policy "subcategories_manage_admin"
  on public.subcategories
  for all
  to public
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  );

create policy "subcategories_select_active"
  on public.subcategories
  for select
  to public
  using (is_active = true);

commit;
