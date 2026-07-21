import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("admin Auth identity mapping", () => {
  it("adds a unique app-user to Supabase Auth mapping without changing User.id", () => {
    const schema = read("prisma/schema.prisma");

    expect(schema).toContain("model AuthIdentityMapping");
    expect(schema).toContain("userId     String   @unique");
    expect(schema).toContain("authUserId String   @unique");
    expect(schema).toContain("authIdentityMapping AuthIdentityMapping?");
    expect(schema).toMatch(/model User \{[\s\S]*id\s+String\s+@id\s+@default\(cuid\(\)\)/);
  });

  it("requires protected Auth metadata and trusted mapping in the admin guard", () => {
    const adminAuth = read("lib/admin-auth.ts");

    expect(adminAuth).toContain('auth_user.raw_app_meta_data ->> \'role\' as protected_role');
    expect(adminAuth).toContain('inner join public."AuthIdentityMapping" auth_mapping');
    expect(adminAuth).toContain('auth_mapping."authUserId"::text = auth_user.id::text');
    expect(adminAuth).toContain('app_user.id = auth_mapping."userId"');
    expect(adminAuth).toContain('where app_user.id = ${session.userId}');
    expect(adminAuth).toContain("maybeError.code === '42P01'");
    expect(adminAuth).toContain("return { status: 'forbidden', userId: session.userId }");
    expect(adminAuth).not.toContain('app_user.id = auth_user.id::text');
  });

  it("keeps the proposed SQL outside active Supabase migrations with RLS and rollback", () => {
    const sql = read("supabase/proposed/20260719000100_auth_identity_mapping.sql");
    const rollback = read("supabase/proposed/20260719000100_auth_identity_mapping_rollback.sql");

    expect(sql).toContain('create table if not exists public."AuthIdentityMapping"');
    expect(sql).toContain('"authUserId" uuid not null');
    expect(sql).toContain('alter table public."AuthIdentityMapping" enable row level security');
    expect(sql).toContain("private.zylo_is_admin()");
    expect(rollback).toContain('drop table if exists public."AuthIdentityMapping"');
  });

  it("defines a self-contained production prerequisite without inserting mappings", () => {
    const sql = read("supabase/proposed/20260720000100_auth_identity_mapping_prerequisite.sql");
    const rollback = read("supabase/proposed/20260720000100_auth_identity_mapping_prerequisite_rollback.sql");

    const tableIndex = sql.indexOf('create table if not exists public."AuthIdentityMapping"');
    const revokeIndex = sql.indexOf('revoke all on table public."AuthIdentityMapping" from public, anon, authenticated');
    const rlsIndex = sql.indexOf('alter table public."AuthIdentityMapping" enable row level security');
    const helperIndex = sql.indexOf("create or replace function private.zylo_is_admin()");
    const policyIndex = sql.indexOf('create policy "auth_identity_mapping_select_admin"');

    expect(tableIndex).toBeGreaterThan(-1);
    expect(revokeIndex).toBeGreaterThan(tableIndex);
    expect(rlsIndex).toBeGreaterThan(revokeIndex);
    expect(helperIndex).toBeGreaterThan(rlsIndex);
    expect(policyIndex).toBeGreaterThan(helperIndex);
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("revoke all on function private.zylo_is_admin() from public, anon, authenticated");
    expect(sql).toContain("grant execute on function private.zylo_is_admin() to authenticated");
    expect(sql).not.toMatch(/insert\s+into\s+public\."AuthIdentityMapping"/i);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(rollback).toContain('drop table if exists public."AuthIdentityMapping"');
    expect(rollback).toContain("drop function if exists private.zylo_is_admin()");
    expect(rollback).not.toMatch(/grant\s+.*public|grant\s+.*anon|grant\s+.*authenticated/i);
  });

  it("makes the production mapping script explicit and non-leaky", () => {
    const script = read("scripts/prepare-production-admin-identity-mapping.mjs");

    expect(script).toContain("PRODUCTION_ADMIN_AUTH_USER_ID");
    expect(script).toContain("SUPABASE_SERVICE_ROLE_KEY is required for --apply");
    expect(script).toContain("uuidPrinted: false");
    expect(script).toContain("metadataPrinted: false");
    expect(script).not.toMatch(/console\.log\(.*targetAuthUserId/);
  });
});
