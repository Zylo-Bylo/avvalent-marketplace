import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, signToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password, storeName, description } = body;

  if (!name || !email || !password || !storeName) {
    return NextResponse.json({ error: 'Missing required vendor registration fields' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'VENDOR',
      vendorProfile: {
        create: {
          storeName,
          description: description || '',
        },
      },
    },
    include: {
      vendorProfile: true,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, vendorProfile: user.vendorProfile } });
  response.cookies.set({
    name: 'auth_token',
    value: token,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
