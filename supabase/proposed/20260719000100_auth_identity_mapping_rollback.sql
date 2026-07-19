-- Rollback for proposed Auth-to-app-user mapping table.
-- Do not run without a separate approval.

begin;

drop policy if exists "auth_identity_mapping_select_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_insert_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_update_admin" on public."AuthIdentityMapping";
drop policy if exists "auth_identity_mapping_delete_admin" on public."AuthIdentityMapping";

drop table if exists public."AuthIdentityMapping";

commit;
