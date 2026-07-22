import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  defaultHomepageContent,
  normalizeHomepageContent,
} from '@/lib/homepage-content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_ID = 'main';

async function ensureHomepageContentTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomepageContent" (
      "id" TEXT PRIMARY KEY,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function GET() {
  try {
    await ensureHomepageContentTable();

    const rows = await prisma.$queryRaw<{ content: string }[]>`
      SELECT "content" FROM "HomepageContent" WHERE "id" = ${CONTENT_ID} LIMIT 1
    `;

    if (!rows[0]?.content) {
      return NextResponse.json(
        { content: defaultHomepageContent },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    return NextResponse.json(
      { content: normalizeHomepageContent(JSON.parse(rows[0].content)) },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Homepage content fetch error:', error);
    return NextResponse.json({ content: defaultHomepageContent });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  try {
    await ensureHomepageContentTable();

    const body = await request.json();
    const content = normalizeHomepageContent(body?.content || body);
    const serialized = JSON.stringify(content);

    await prisma.$executeRaw`
      INSERT INTO "HomepageContent" ("id", "content", "updatedAt")
      VALUES (${CONTENT_ID}, ${serialized}, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET
        "content" = EXCLUDED."content",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      content,
      message: 'Homepage content saved.',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Homepage content save error:', error);
    return NextResponse.json(
      { error: 'Homepage content could not be saved.' },
      { status: 500 },
    );
  }
}
