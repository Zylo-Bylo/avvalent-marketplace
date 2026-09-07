# Supabase database trust

`supabase-root-2021.crt` is public CA trust material downloaded from the official
Supabase dashboard certificate source:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Only Preview's database URLs opt in, using `sslmode=verify-full` and
`sslrootcert=./certificates/supabase-root-2021.crt`. The existing pg driver reads
this file into its connection-level `ssl.ca` option. Next.js output tracing
includes the file in server bundles; run from the application root, as on Vercel.

Production URLs and trust behavior are unchanged. Do not disable certificate or
hostname verification. No private key or database credentials belong here.
