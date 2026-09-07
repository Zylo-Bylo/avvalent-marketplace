import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import type { ConnectionOptions } from 'node:tls';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

describe('Preview database CA configuration', () => {
  const caPath = './certificates/supabase-root-2021.crt';

  it('bundles a public CA certificate, without a private key', () => {
    const pem = readFileSync(caPath, 'utf8');
    const certificate = new X509Certificate(pem);
    expect(certificate.ca).toBe(true);
    expect(certificate.subject).toContain('O=Supabase Inc');
    expect(pem).not.toContain('PRIVATE KEY');
  });

  it('passes the URL CA to pg while retaining chain and hostname verification', () => {
    const url = new URL('postgresql://test:unused@staging.example:5432/postgres');
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.set('sslrootcert', caPath);
    const client = new Client({ connectionString: url.href });
    const ssl = (client as unknown as { ssl: ConnectionOptions }).ssl;
    expect(ssl.ca).toBe(readFileSync(caPath, 'utf8'));
    // Undefined uses Node's secure defaults; no custom hostname callback is set.
    expect(ssl.rejectUnauthorized).not.toBe(false);
    expect(ssl.checkServerIdentity).toBeUndefined();
  });

  it('does not add the staging CA to connections that do not opt in', () => {
    const client = new Client({ connectionString: 'postgresql://test:unused@production.example:5432/postgres?sslmode=verify-full' });
    const ssl = (client as unknown as { ssl: ConnectionOptions }).ssl;
    expect(ssl.ca).toBeUndefined();
    expect(ssl.rejectUnauthorized).not.toBe(false);
  });
});
