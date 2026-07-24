-- Phase 1 Vendor Operations: vendor profile + KYC extension.
-- Staging first. Do not run on production until reviewed and approved.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"Vendor"',
    '"User"',
    '"AuthIdentityMapping"'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Vendor profile phase-1 migration aborted. Required tables are missing: %', missing_tables;
  end if;

  if to_regprocedure('private.zylo_is_admin()') is null then
    raise exception 'Vendor profile phase-1 migration aborted. Required admin helper private.zylo_is_admin() is missing.';
  end if;
end $$;

create or replace function private.zylo_auth_owns_vendor(p_vendor_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."AuthIdentityMapping" aim
    join public."Vendor" v on v."userId" = aim."userId"
    where aim."authUserId" = auth.uid()
      and v."id" = p_vendor_id
  );
$$;

revoke execute on function private.zylo_auth_owns_vendor(text) from public;
revoke execute on function private.zylo_auth_owns_vendor(text) from anon;
grant execute on function private.zylo_auth_owns_vendor(text) to authenticated;

create table if not exists public."VendorContactPerson" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "name" text not null,
  "designation" text,
  "phone" text,
  "email" text,
  "isPrimary" boolean not null default false,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."VendorAddress" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "type" text not null check ("type" in ('REGISTERED', 'PICKUP', 'RETURN', 'OTHER')),
  "addressLine1" text not null,
  "addressLine2" text,
  "landmark" text,
  "city" text not null,
  "state" text not null,
  "postalCode" text not null,
  "country" text not null default 'India',
  "contactName" text,
  "contactPhone" text,
  "isDefault" boolean not null default false,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."VendorKycDocument" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "type" text not null check ("type" in ('GST', 'PAN', 'AADHAAR', 'BUSINESS_REGISTRATION', 'BANK_PROOF', 'ADDRESS_PROOF', 'OTHER')),
  "documentNumberMasked" text,
  "storagePath" text,
  "mimeType" text,
  "status" text not null default 'PENDING' check ("status" in ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  "rejectionReason" text,
  "verifiedById" text references public."User"("id") on delete set null on update cascade,
  "verifiedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."VendorVerificationEvent" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "actorUserId" text references public."User"("id") on delete set null on update cascade,
  "previousStatus" text,
  "newStatus" text not null,
  "reason" text,
  "metadata" jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists public."VendorSuspensionEvent" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "actorUserId" text references public."User"("id") on delete set null on update cascade,
  "action" text not null check ("action" in ('SUSPENDED', 'REINSTATED')),
  "reason" text,
  "startsAt" timestamptz,
  "endsAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists "VendorContactPerson_vendorId_idx" on public."VendorContactPerson" ("vendorId");
create index if not exists "VendorContactPerson_vendorId_isPrimary_idx" on public."VendorContactPerson" ("vendorId", "isPrimary");
create index if not exists "VendorContactPerson_vendorId_isActive_idx" on public."VendorContactPerson" ("vendorId", "isActive");
create index if not exists "VendorContactPerson_createdAt_idx" on public."VendorContactPerson" ("createdAt");

create index if not exists "VendorAddress_vendorId_idx" on public."VendorAddress" ("vendorId");
create index if not exists "VendorAddress_vendorId_type_idx" on public."VendorAddress" ("vendorId", "type");
create index if not exists "VendorAddress_vendorId_type_isDefault_idx" on public."VendorAddress" ("vendorId", "type", "isDefault");
create index if not exists "VendorAddress_vendorId_isActive_idx" on public."VendorAddress" ("vendorId", "isActive");
create index if not exists "VendorAddress_createdAt_idx" on public."VendorAddress" ("createdAt");

create index if not exists "VendorKycDocument_vendorId_idx" on public."VendorKycDocument" ("vendorId");
create index if not exists "VendorKycDocument_vendorId_type_idx" on public."VendorKycDocument" ("vendorId", "type");
create index if not exists "VendorKycDocument_status_idx" on public."VendorKycDocument" ("status");
create index if not exists "VendorKycDocument_createdAt_idx" on public."VendorKycDocument" ("createdAt");

create index if not exists "VendorVerificationEvent_vendorId_idx" on public."VendorVerificationEvent" ("vendorId");
create index if not exists "VendorVerificationEvent_actorUserId_idx" on public."VendorVerificationEvent" ("actorUserId");
create index if not exists "VendorVerificationEvent_newStatus_idx" on public."VendorVerificationEvent" ("newStatus");
create index if not exists "VendorVerificationEvent_createdAt_idx" on public."VendorVerificationEvent" ("createdAt");

create index if not exists "VendorSuspensionEvent_vendorId_idx" on public."VendorSuspensionEvent" ("vendorId");
create index if not exists "VendorSuspensionEvent_actorUserId_idx" on public."VendorSuspensionEvent" ("actorUserId");
create index if not exists "VendorSuspensionEvent_action_idx" on public."VendorSuspensionEvent" ("action");
create index if not exists "VendorSuspensionEvent_createdAt_idx" on public."VendorSuspensionEvent" ("createdAt");

revoke all on table public."VendorContactPerson" from public, anon, authenticated;
revoke all on table public."VendorAddress" from public, anon, authenticated;
revoke all on table public."VendorKycDocument" from public, anon, authenticated;
revoke all on table public."VendorVerificationEvent" from public, anon, authenticated;
revoke all on table public."VendorSuspensionEvent" from public, anon, authenticated;

grant select, insert, update, delete on table public."VendorContactPerson" to authenticated;
grant select, insert, update, delete on table public."VendorAddress" to authenticated;
grant delete on table public."VendorKycDocument" to authenticated;
grant select (
  "id",
  "vendorId",
  "type",
  "documentNumberMasked",
  "mimeType",
  "status",
  "rejectionReason",
  "verifiedById",
  "verifiedAt",
  "expiresAt",
  "createdAt",
  "updatedAt"
) on table public."VendorKycDocument" to authenticated;
grant insert (
  "id",
  "vendorId",
  "type",
  "documentNumberMasked",
  "mimeType",
  "status",
  "rejectionReason",
  "verifiedById",
  "verifiedAt",
  "expiresAt",
  "createdAt",
  "updatedAt"
) on table public."VendorKycDocument" to authenticated;
grant select on table public."VendorVerificationEvent" to authenticated;
grant select on table public."VendorSuspensionEvent" to authenticated;

drop policy if exists "vendor_contact_person_select_own" on public."VendorContactPerson";
drop policy if exists "vendor_contact_person_insert_own" on public."VendorContactPerson";
drop policy if exists "vendor_contact_person_update_own" on public."VendorContactPerson";
drop policy if exists "vendor_contact_person_delete_own" on public."VendorContactPerson";
drop policy if exists "vendor_address_select_own" on public."VendorAddress";
drop policy if exists "vendor_address_insert_own" on public."VendorAddress";
drop policy if exists "vendor_address_update_own" on public."VendorAddress";
drop policy if exists "vendor_address_delete_own" on public."VendorAddress";
drop policy if exists "vendor_kyc_document_select_own" on public."VendorKycDocument";
drop policy if exists "vendor_kyc_document_insert_own_pending" on public."VendorKycDocument";
drop policy if exists "vendor_kyc_document_delete_own_pending_rejected" on public."VendorKycDocument";
drop policy if exists "vendor_verification_event_select_own" on public."VendorVerificationEvent";
drop policy if exists "vendor_suspension_event_select_own" on public."VendorSuspensionEvent";
drop policy if exists "admin_vendor_contact_person_all" on public."VendorContactPerson";
drop policy if exists "admin_vendor_address_all" on public."VendorAddress";
drop policy if exists "admin_vendor_kyc_document_all" on public."VendorKycDocument";
drop policy if exists "admin_vendor_verification_event_all" on public."VendorVerificationEvent";
drop policy if exists "admin_vendor_suspension_event_all" on public."VendorSuspensionEvent";

create policy "vendor_contact_person_select_own" on public."VendorContactPerson"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_contact_person_insert_own" on public."VendorContactPerson"
  for insert to authenticated
  with check (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_contact_person_update_own" on public."VendorContactPerson"
  for update to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"))
  with check (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_contact_person_delete_own" on public."VendorContactPerson"
  for delete to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_address_select_own" on public."VendorAddress"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_address_insert_own" on public."VendorAddress"
  for insert to authenticated
  with check (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_address_update_own" on public."VendorAddress"
  for update to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"))
  with check (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_address_delete_own" on public."VendorAddress"
  for delete to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_kyc_document_select_own" on public."VendorKycDocument"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_kyc_document_insert_own_pending" on public."VendorKycDocument"
  for insert to authenticated
  with check (
    "status" = 'PENDING'
    and "verifiedById" is null
    and "verifiedAt" is null
    and "rejectionReason" is null
    and private.zylo_auth_owns_vendor("vendorId")
  );

create policy "vendor_kyc_document_delete_own_pending_rejected" on public."VendorKycDocument"
  for delete to authenticated
  using (
    "status" in ('PENDING', 'REJECTED')
    and private.zylo_auth_owns_vendor("vendorId")
  );

create policy "vendor_verification_event_select_own" on public."VendorVerificationEvent"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_suspension_event_select_own" on public."VendorSuspensionEvent"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "admin_vendor_contact_person_all" on public."VendorContactPerson"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

create policy "admin_vendor_address_all" on public."VendorAddress"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

create policy "admin_vendor_kyc_document_all" on public."VendorKycDocument"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

create policy "admin_vendor_verification_event_all" on public."VendorVerificationEvent"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

create policy "admin_vendor_suspension_event_all" on public."VendorSuspensionEvent"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

alter table public."VendorContactPerson" enable row level security;
alter table public."VendorAddress" enable row level security;
alter table public."VendorKycDocument" enable row level security;
alter table public."VendorVerificationEvent" enable row level security;
alter table public."VendorSuspensionEvent" enable row level security;

commit;
