-- Rollback for 20260715000100_policy_first_rls.sql.
-- Drops only objects created by this migration. It does not disable RLS and
-- does not restore broad grants on sensitive tables.

begin;

drop view if exists public.public_product_variants;

do $$
declare
  table_name text;
  policy_names text[];
  policy_name text;
begin
  foreach table_name in array array[
    '"Category"',
    '"Subcategory"',
    '"ProductType"',
    '"HomepageContent"',
    '"CategoryUploadTemplate"',
    '"CategoryAuditLog"',
    '"ProductVariant"',
    'size_charts',
    'size_chart_items'
  ] loop
    policy_names := case table_name
      when '"Category"' then array['category_select_public_active','category_insert_admin','category_update_admin','category_delete_admin']
      when '"Subcategory"' then array['subcategory_select_public_active','subcategory_insert_admin','subcategory_update_admin','subcategory_delete_admin']
      when '"ProductType"' then array['product_type_select_public_active','product_type_insert_admin','product_type_update_admin','product_type_delete_admin']
      when '"HomepageContent"' then array['homepage_content_select_public','homepage_content_insert_admin','homepage_content_update_admin','homepage_content_delete_admin']
      when '"CategoryUploadTemplate"' then array['category_upload_template_select_admin','category_upload_template_insert_admin','category_upload_template_update_admin','category_upload_template_delete_admin']
      when '"CategoryAuditLog"' then array['category_audit_log_select_admin','category_audit_log_insert_admin']
      when '"ProductVariant"' then array['product_variant_select_public_approved','product_variant_select_admin','product_variant_insert_admin','product_variant_update_admin','product_variant_delete_admin']
      when 'size_charts' then array['size_charts_select_public_active','size_charts_insert_admin','size_charts_update_admin','size_charts_delete_admin']
      when 'size_chart_items' then array['size_chart_items_select_public_active_parent','size_chart_items_insert_admin','size_chart_items_update_admin','size_chart_items_delete_admin']
    end;

    foreach policy_name in array policy_names loop
      execute format('drop policy if exists %I on public.%s', policy_name, table_name);
    end loop;
  end loop;

  foreach table_name in array array[
    '"VendorWallet"',
    '"VendorBankAccount"',
    '"VendorPayout"',
    '"VendorPayoutSettlement"',
    '"VendorLedger"',
    '"CommissionRule"',
    '"SettlementReport"',
    '"RefundAdjustment"',
    '"Inventory"',
    '"StockMovement"',
    '"StockReservation"',
    '"AdminBusinessProfile"',
    '"ReturnRefundRequest"',
    'order_verification',
    'dispatch_images',
    'open_box_verification',
    'return_requests',
    'return_evidence',
    'risk_assessment',
    'vendor_protection_logs'
  ] loop
    foreach policy_name in array array[
      replace(replace(replace(lower(table_name), '"', ''), '_', ''), '.', '') || '_select_admin',
      replace(replace(replace(lower(table_name), '"', ''), '_', ''), '.', '') || '_insert_admin',
      replace(replace(replace(lower(table_name), '"', ''), '_', ''), '.', '') || '_update_admin',
      replace(replace(replace(lower(table_name), '"', ''), '_', ''), '.', '') || '_delete_admin'
    ] loop
      execute format('drop policy if exists %I on public.%s', policy_name, table_name);
    end loop;
  end loop;

  foreach table_name in array array['delivery_otp', 'vendor_mobile_otp'] loop
    foreach policy_name in array array[
      table_name || '_select_admin',
      table_name || '_insert_admin',
      table_name || '_update_admin',
      table_name || '_delete_admin'
    ] loop
      execute format('drop policy if exists %I on public.%s', policy_name, table_name);
    end loop;
  end loop;
end $$;

revoke all on function private.zylo_approved_catalog_product(text) from public, anon, authenticated;
revoke all on function private.zylo_active_subcategory(text) from public, anon, authenticated;
revoke all on function private.zylo_active_category(text) from public, anon, authenticated;
revoke all on function private.zylo_is_admin() from public, anon, authenticated;

drop function if exists private.zylo_approved_catalog_product(text);
drop function if exists private.zylo_active_subcategory(text);
drop function if exists private.zylo_active_category(text);
drop function if exists private.zylo_is_admin();

drop schema if exists private;

commit;
