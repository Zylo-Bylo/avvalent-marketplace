import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function collectSourceFiles(dir: string): string[] {
  const absolute = join(root, dir);
  return readdirSync(absolute).flatMap((entry) => {
    const path = join(absolute, entry);
    const relative = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return collectSourceFiles(relative);
    }
    return /\.(ts|tsx)$/.test(entry) ? [relative] : [];
  });
}

describe("Supabase service-role key usage", () => {
  it("keeps the browser Supabase client on public anon env vars", () => {
    const source = read("lib/supabase.ts");

    expect(source).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not define a public service-role variable in env examples", () => {
    const envExamples = [
      read(".env.example"),
      read(".env.production.example"),
    ].join("\n");

    expect(envExamples).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("uses the service-role key only in the server upload helper", () => {
    const uploads = read("lib/uploads.ts");

    expect(uploads).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(uploads).toContain("persistSession: false");
  });

  it("does not expose raw OTP setup fields or log OTP values", () => {
    const source = [...collectSourceFiles("app"), ...collectSourceFiles("lib")]
      .map((path) => read(path))
      .join("\n");

    expect(source).not.toMatch(/\bdevOtp\b/);
    expect(source).not.toMatch(/SELECT\s+"otp"/i);
    expect(source).not.toMatch(/otpRecord\.otp(?!Hash)|record\.otp(?!Hash)/);
    expect(source).not.toMatch(/deliveryOtp\??\.otp/);
    expect(source).not.toMatch(/Customer OTP:\s*\{/);
    expect(source).not.toMatch(/console\.(log|error|warn).*otp/i);
    expect(source).not.toMatch(/otp.*console\.(log|error|warn)/i);
  });
});
