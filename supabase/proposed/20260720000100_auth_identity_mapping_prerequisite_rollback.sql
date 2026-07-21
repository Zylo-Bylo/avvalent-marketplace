-- Rollback for the AuthIdentityMapping prerequisite.
-- Removes only objects created by the prerequisite and does not restore any
-- anon/authenticated access to the mapping table.

begin;

drop policy if exists "auth_identity_mapping_select_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_insert_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_update_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_delete_admin" on public."AuthIdentityMapping";

drop table if exists public."AuthIdentityMapping";

drop function if exists private.zylo_is_admin();

commit;
