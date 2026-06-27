import { signToken, verifyToken } from '@/lib/auth';

type OrderAccessPayload = {
  type: 'order_access';
  userId: string;
  orderIds: string[];
};

export function signOrderAccessToken(payload: OrderAccessPayload) {
  return signToken(payload);
}

export function verifyOrderAccessToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const data = verifyToken(token);
  if (
    !data ||
    typeof data !== 'object' ||
    data.type !== 'order_access' ||
    !Array.isArray(data.orderIds)
  ) {
    return null;
  }

  return {
    userId: typeof data.userId === 'string' ? data.userId : '',
    orderIds: data.orderIds.filter((id): id is string => typeof id === 'string'),
  };
}
