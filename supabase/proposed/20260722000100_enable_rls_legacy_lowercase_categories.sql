-- Proposed production fix for legacy lowercase category tables.
-- Do not apply without production approval.

begin;

revoke all on table public.categories from public, anon, authenticated;
revoke all on table public.subcategories from public, anon, authenticated;

grant select on table public.categories to anon, authenticated;
grant select on table public.subcategories to anon, authenticated;

drop policy if exists "Anyone can read categories" on public.categories;
drop policy if exists "categories_manage_admin" on public.categories;

drop policy if exists "Anyone can read subcategories" on public.subcategories;
drop policy if exists "Public can view active subcategories" on public.subcategories;
drop policy if exists "subcategories_manage_admin" on public.subcategories;
drop policy if exists "subcategories_select_active" on public.subcategories;

create policy "categories_select_active_public"
  on public.categories
  for select
  to anon, authenticated
  using (is_active is true);

create policy "subcategories_select_active_public"
  on public.subcategories
  for select
  to anon, authenticated
  using (is_active is true);

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;

commit;
