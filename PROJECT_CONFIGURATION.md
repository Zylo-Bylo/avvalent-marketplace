# Zylo-Buylo Project Configuration

## Project

- Project name: Zylo-Buylo
- Package name: `zylo-buylo`
- Website/domain: `zylo-buylo.com`
- Application type: multivendor e-commerce marketplace

## Framework

- Framework: Next.js `16.2.4`
- UI runtime: React `19.2.4`
- Language: TypeScript
- Styling: Tailwind CSS `4`
- App router: Yes, `app/` directory

## Runtime

- Runtime: Node.js
- Local Node version observed: `v24.15.0`
- Vercel Node version: Vercel default LTS, not pinned in repo
- Server runtime: Next.js server routes, Node.js runtime for selected API routes

## Package Manager

- Package manager: npm
- Local npm version observed: `11.12.1`
- Lockfile: `package-lock.json`

## Main Commands

- Development: `npm run dev`
- Build: `npm run build`
- Production start: `npm run start`
- Lint: `npm run lint`
- Test: `npm run test`
- Coverage: `npm run test:coverage`
- Full local check: `npm run test:all`
- Prisma generate: `npm run prisma:generate`
- Prisma database push: `npm run prisma:db:push`
- Seed database: `npm run seed`

## Build Commands

- Local build command: `npm run build`
- Vercel build command: `npm run vercel-build`
- Vercel install command: `npm ci`

The build commands run `node scripts/prisma-schema.mjs generate` before `next build`.

## Deploy Commands

- Vercel deploy is expected through connected GitHub repository pushes.
- Manual Vercel build command: `npm run vercel-build`
- Production database setup command, after securely setting `DATABASE_URL`: `npm run prisma:db:push`

## Important Config Files

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `vercel.json`
- `prisma.config.ts`
- `prisma/schema.prisma`
- `scripts/prisma-schema.mjs`
- `tsconfig.json`
- `eslint.config.mjs`
- `vitest.config.mts`
- `.env.example`
- `.env.production.example`

