import { signToken, verifyToken } from '@/lib/auth';

type CheckoutAuthPayload = {
  type: 'checkout_auth';
  userId: string;
  role: string | null;
};

export function signCheckoutAuthToken(payload: CheckoutAuthPayload) {
  return signToken(payload);
}

export function verifyCheckoutAuthToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const data = verifyToken(token);
  if (
    !data ||
    typeof data !== 'object' ||
    data.type !== 'checkout_auth' ||
    typeof data.userId !== 'string'
  ) {
    return null;
  }

  return {
    userId: data.userId,
    role: typeof data.role === 'string' ? data.role : null,
  };
}
