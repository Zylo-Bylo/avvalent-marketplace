-- Rollback for Phase 1 Vendor Operations profile + KYC extension.
-- Removes only objects created by 20260724000100_vendor_profile_kyc_phase1.sql.

begin;

drop table if exists public."VendorSuspensionEvent";
drop table if exists public."VendorVerificationEvent";
drop table if exists public."VendorKycDocument";
drop table if exists public."VendorAddress";
drop table if exists public."VendorContactPerson";

drop function if exists private.zylo_auth_owns_vendor(text);

commit;
