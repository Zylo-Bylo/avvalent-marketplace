-- Break-glass rollback for 20260718000100_restrict_rls_auto_enable_execute.sql.
-- This restores the previous callable grants for public.rls_auto_enable().
-- Do not run unless the production migration is proven to break automatic RLS
-- event-trigger behavior and the operator accepts that Supabase Advisor warnings
-- for this SECURITY DEFINER function will return.

begin;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'grant execute on function public.rls_auto_enable() to public';
    execute
      'grant execute on function public.rls_auto_enable() to anon';
    execute
      'grant execute on function public.rls_auto_enable() to authenticated';
  end if;
end
$$;

commit;
