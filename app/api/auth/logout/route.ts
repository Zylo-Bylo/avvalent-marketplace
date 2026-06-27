import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/session-cookies';

function buildLogoutResponse(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/login';
  const redirectUrl = new URL(next, url.origin);
  const response = NextResponse.redirect(redirectUrl, 303);
  clearAuthCookies(response, url.hostname);
  return response;
}

export async function GET(request: Request) {
  return buildLogoutResponse(request);
}

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response, new URL(request.url).hostname);
  return response;
}
