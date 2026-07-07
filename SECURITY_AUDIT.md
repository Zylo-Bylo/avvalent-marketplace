# Security Audit

No live secret values are shown in this report.

## Summary

- Hardcoded live API keys: Not found in application source
- Hardcoded live passwords: Not found in application source
- Public secrets: No server secrets found in `NEXT_PUBLIC_` variables
- Env files ignored by Git: Yes
- Local database files ignored by Git: Yes
- Local auth state ignored by Git: Yes
- Missing production env variables: Yes, most production variables are missing locally

## Findings

| Area | Finding | Risk | Recommendation |
| --- | --- | --- | --- |
| JWT | `lib/auth.ts` falls back to `change-me-to-a-secure-secret` when `JWT_SECRET` is absent | High in production | Set strong `JWT_SECRET` in Vercel before launch |
| Database | Production requires `DATABASE_URL`; local fallback uses SQLite `dev.db` | High in production | Set Supabase Postgres pooled `DATABASE_URL` in Vercel |
| Uploads | Supabase server upload vars are missing locally | Medium | Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and bucket in Vercel |
| Email | Resend vars are missing locally | Medium | Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for OTP/password/order email |
| Payments | Razorpay/Stripe secrets are missing locally | Medium | Configure only payment gateways intended for launch |
| Webhooks | Razorpay/Stripe webhook secrets missing locally | Medium | Add webhook secrets and dashboard webhook URLs before enabling live payments |
| Seed API | `app/api/seed/route.ts` can seed demo data without explicit admin guard | Medium | Remove, protect, or disable this route before production launch |
| Seed data | `seed.ts` contains development password hashes and comments for `password123` | Low if never deployed as live credentials | Use only for local seed data; rotate/delete seed users in production |
| Local auth | `.local-auth.json` stores local auth/password-reset state | Medium if leaked | Keep ignored; never upload or share |
| Local DB | `dev.db` and backups may contain user/order data | Medium if leaked | Keep ignored; back up securely if needed |
| Password reset | `PASSWORD_RESET_LINK_RESPONSE=true` can expose reset links in API response | High if enabled in production | Keep unset in production except tightly controlled emergency recovery |

## Git Ignore Coverage

The `.gitignore` includes:

- `node_modules`
- `.next`
- `coverage`
- `.eslintcache`
- `build`
- `backup`
- `prisma/.generated`
- `build-output.txt`
- `dev.db`
- `dev.db.backup-*`
- `*.db`
- `*.db-journal`
- `.local-auth.json`
- `.npm-cache`
- `.tmp`
- `*.log`
- `.env*` except examples
- `.vercel`
- `*.tsbuildinfo`
- `next-env.d.ts`

## Missing Environment Variables

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured locally. Production readiness depends on adding required variables in Vercel, especially:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- Payment gateway variables if Razorpay/Stripe are enabled
- Email variables if OTP/password/order email must work
- Supabase service variables if uploads must work

## Sensitive Values

Sensitive values were not printed. Any values found in local env files were treated as hidden.

