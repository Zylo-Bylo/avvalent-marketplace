import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getLocalUserRole,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { prisma } from '@/lib/prisma';

export async function requireAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return null;
  }

  const userId = String(data.userId);

  if (shouldUseLocalSqliteAuth()) {
    return getLocalUserRole(userId) === 'ADMIN'
      ? { id: userId, role: 'ADMIN' as const }
      : null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  return user?.role === 'ADMIN' ? user : null;
}
