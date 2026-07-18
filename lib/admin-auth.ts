import { getAuthSession } from '@/lib/session-cookies';
import {
  getLocalUserRole,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { prisma } from '@/lib/prisma';

type AdminAuthState =
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; userId: string }
  | { status: 'authorized'; user: { id: string; role: 'ADMIN' } };

type ProtectedAdminRecord = {
  user_id: string;
  app_role: string | null;
  protected_role: string | null;
};

export async function getAdminAuthState(): Promise<AdminAuthState> {
  const session = await getAuthSession();

  if (!session) {
    return { status: 'unauthenticated' };
  }

  if (shouldUseLocalSqliteAuth()) {
    return getLocalUserRole(session.userId) === 'ADMIN'
      ? { status: 'authorized', user: { id: session.userId, role: 'ADMIN' } }
      : { status: 'forbidden', userId: session.userId };
  }

  const records = await prisma.$queryRaw<ProtectedAdminRecord[]>`
    select
      auth_user.id::text as user_id,
      app_user.role::text as app_role,
      auth_user.raw_app_meta_data ->> 'role' as protected_role
    from auth.users auth_user
    inner join public."User" app_user on app_user.id = auth_user.id::text
    where auth_user.id::text = ${session.userId}
    limit 1
  `;

  const record = records[0];
  if (record?.protected_role === 'ADMIN' && record.app_role === 'ADMIN') {
    return { status: 'authorized', user: { id: record.user_id, role: 'ADMIN' } };
  }

  return { status: 'forbidden', userId: session.userId };
}

export async function requireAdminUser() {
  const state = await getAdminAuthState();
  return state.status === 'authorized' ? state.user : null;
}
