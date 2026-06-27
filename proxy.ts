import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === 'www.zylo-buylo.com') {
    const url = request.nextUrl.clone();
    url.hostname = 'zylo-buylo.com';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
