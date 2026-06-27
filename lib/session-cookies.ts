import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const AUTH_COOKIE_NAME = 'auth_token';
const LOGOUT_MARKER_COOKIE_NAME = 'auth_logged_out';

type CookieResponse = {
  cookies: {
    set: (input: {
      name: string;
      value: string;
      path?: string;
      domain?: string;
      httpOnly?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      secure?: boolean;
      maxAge?: number;
      expires?: Date;
    }) => void;
  };
};

export function getCookieDomain(hostname: string) {
  return hostname === 'zylo-buylo.com' || hostname === 'www.zylo-buylo.com'
    ? '.zylo-buylo.com'
    : undefined;
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  const logoutMarkerTime = Math.max(
    0,
    ...cookieStore
    .getAll(LOGOUT_MARKER_COOKIE_NAME)
      .map((cookie) => Number(cookie.value))
      .filter((value) => Number.isFinite(value)),
  );

  const tokens = cookieStore
    .getAll(AUTH_COOKIE_NAME)
    .map((cookie) => cookie.value)
    .filter(Boolean);

  for (const token of tokens) {
    const data = verifyToken(token);
    if (data && typeof data === 'object' && data.userId) {
      const tokenIssuedAt = typeof data.iat === 'number' ? data.iat : 0;
      if (logoutMarkerTime > 0 && tokenIssuedAt < logoutMarkerTime) {
        continue;
      }

      return {
        token,
        userId: String(data.userId),
        role: typeof data.role === 'string' ? data.role : null,
      };
    }
  }

  return null;
}

export function setAuthCookies(response: CookieResponse, token: string, hostname: string) {
  clearLogoutMarkerCookies(response, hostname);
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookies(response: CookieResponse, hostname: string) {
  const baseCookie = {
    name: AUTH_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    expires: new Date(0),
  };
  const domains = Array.from(
    new Set(
      [
        undefined,
        hostname,
        hostname.startsWith('www.') ? hostname.slice(4) : undefined,
        getCookieDomain(hostname),
        '.zylo-buylo.com',
        'zylo-buylo.com',
        'www.zylo-buylo.com',
      ].filter((domain): domain is string | undefined => domain === undefined || domain.length > 0),
    ),
  );

  for (const domain of domains) {
    response.cookies.set({
      ...baseCookie,
      ...(domain ? { domain } : {}),
    });
  }

  setLogoutMarkerCookie(response, hostname);
}

function setLogoutMarkerCookie(response: CookieResponse, hostname: string) {
  const markerValue = String(Math.floor(Date.now() / 1000));

  response.cookies.set({
    name: LOGOUT_MARKER_COOKIE_NAME,
    value: markerValue,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });

  const domain = getCookieDomain(hostname);
  if (domain) {
    response.cookies.set({
      name: LOGOUT_MARKER_COOKIE_NAME,
      value: markerValue,
      path: '/',
      domain,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
}

function clearLogoutMarkerCookies(response: CookieResponse, hostname: string) {
  const domains = Array.from(
    new Set(
      [
        undefined,
        hostname,
        hostname.startsWith('www.') ? hostname.slice(4) : undefined,
        getCookieDomain(hostname),
        '.zylo-buylo.com',
        'zylo-buylo.com',
        'www.zylo-buylo.com',
      ].filter((domain): domain is string | undefined => domain === undefined || domain.length > 0),
    ),
  );

  for (const domain of domains) {
    response.cookies.set({
      name: LOGOUT_MARKER_COOKIE_NAME,
      value: '',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      expires: new Date(0),
      ...(domain ? { domain } : {}),
    });
  }
}
