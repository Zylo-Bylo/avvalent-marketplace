begin read only;

set local statement_timeout = '30s';

with required_tables(tablename) as (
  values
    ('Category'),
    ('Subcategory'),
    ('ProductType'),
    ('HomepageContent'),
    ('CategoryUploadTemplate'),
    ('CategoryAuditLog'),
    ('ProductVariant'),
    ('VendorWallet'),
    ('VendorBankAccount'),
    ('VendorPayout'),
    ('VendorPayoutSettlement'),
    ('VendorLedger'),
    ('CommissionRule'),
    ('SettlementReport'),
    ('RefundAdjustment'),
    ('Inventory'),
    ('StockMovement'),
    ('StockReservation'),
    ('AdminBusinessProfile'),
    ('ReturnRefundRequest'),
    ('size_charts'),
    ('size_chart_items'),
    ('order_verification'),
    ('dispatch_images'),
    ('delivery_otp'),
    ('open_box_verification'),
    ('return_requests'),
    ('return_evidence'),
    ('risk_assessment'),
    ('vendor_protection_logs'),
    ('vendor_mobile_otp')
),
financial_tables(tablename) as (
  values
    ('VendorBankAccount'),
    ('VendorPayout'),
    ('VendorPayoutSettlement'),
    ('VendorWallet'),
    ('VendorLedger'),
    ('CommissionRule'),
    ('SettlementReport'),
    ('RefundAdjustment')
),
table_security as (
  select t.tablename, p.rowsecurity
  from required_tables t
  left join pg_tables p
    on p.schemaname = 'public'
   and p.tablename = t.tablename
),
all_policies as (
  select schemaname, tablename, policyname, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
),
zylo_functions as (
  select n.nspname as schema_name,
         p.proname as function_name,
         p.prosecdef as security_definer,
         p.proconfig as function_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname like 'zylo_%'
),
routine_privileges as (
  select routine_schema, routine_name, grantee, privilege_type
  from information_schema.routine_privileges
  where routine_name like 'zylo_%'
),
variant_view as (
  select v.schemaname, v.viewname, v.definition, c.reloptions
  from pg_views v
  join pg_class c on c.relname = v.viewname
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = v.schemaname
  where v.schemaname = 'public'
    and v.viewname = 'public_product_variants'
),
otp_grants as (
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('delivery_otp', 'vendor_mobile_otp')
    and grantee in ('anon', 'authenticated')
),
financial_write_policies as (
  select p.*
  from all_policies p
  join financial_tables f on f.tablename = p.tablename
  where p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
),
unsafe_financial_write_policies as (
  select *
  from financial_write_policies
  where coalesce(qual, '') || ' ' || coalesce(with_check, '') not like '%private.zylo_is_admin()%'
),
unsafe_true_write_policies as (
  select *
  from all_policies
  where cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (coalesce(qual, '') ~* '\mtrue\M' or coalesce(with_check, '') ~* '\mtrue\M')
)
select jsonb_pretty(jsonb_build_object(
  'migrationsApplied', (
    select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations
    where version in ('20260714000000', '20260715000100')
  ),
  'rls', jsonb_build_object(
    'requiredTableCount', (select count(*) from required_tables),
    'checkedTableCount', (select count(*) from table_security where rowsecurity is not null),
    'missingTables', (select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb) from table_security where rowsecurity is null),
    'disabledTables', (select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb) from table_security where rowsecurity is false)
  ),
  'otpProtection', jsonb_build_object(
    'anonAuthenticatedGrantCount', (select count(*) from otp_grants),
    'directPolicyCount', (select count(*) from all_policies where tablename in ('delivery_otp', 'vendor_mobile_otp'))
  ),
  'financialProtection', jsonb_build_object(
    'writePolicyCount', (select count(*) from financial_write_policies),
    'unsafeWritePolicies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'cmd', cmd) order by tablename, policyname), '[]'::jsonb) from unsafe_financial_write_policies)
  ),
  'viewFunctionSecurity', jsonb_build_object(
    'publicProductVariantsPresent', exists(select 1 from variant_view),
    'publicProductVariantsSecurityInvoker', coalesce((select reloptions @> array['security_invoker=true'] from variant_view limit 1), false),
    'publicProductVariantsUnsafeColumns', (
      select coalesce(jsonb_agg(column_name), '[]'::jsonb)
      from (values ('vendorPrice'), ('stockQuantity'), ('barcode'), ('weight'), ('otpHash')) as unsafe(column_name)
      where exists(select 1 from variant_view where definition like '%' || unsafe.column_name || '%')
    ),
    'zyloFunctionCount', (select count(*) from zylo_functions),
    'zyloFunctionIssues', (
      select coalesce(jsonb_agg(jsonb_build_object('schema', schema_name, 'function', function_name, 'securityDefiner', security_definer, 'config', function_config) order by schema_name, function_name), '[]'::jsonb)
      from zylo_functions
      where schema_name <> 'private'
         or security_definer is not true
         or not exists (
           select 1
           from unnest(function_config) as config(setting)
           where setting in ('search_path=', 'search_path=""')
         )
    ),
    'routinePrivilegeCount', (select count(*) from routine_privileges)
  ),
  'policySafety', jsonb_build_object(
    'unsafeTrueWritePolicies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'cmd', cmd) order by tablename, policyname), '[]'::jsonb) from unsafe_true_write_policies)
  )
)) as verification_result;

commit;
