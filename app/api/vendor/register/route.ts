import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createOtp,
  hashToken,
  minutesFromNow,
  normalizeEmail,
  validateStrongPassword,
} from '@/lib/security';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    name,
    email,
    password,
    storeName,
    description,
    mobile,
    businessCategory,
    businessAddress,
    gstNumber,
    panNumber,
    aadhaarNumber,
    bankDetails,
    upiId,
    panCardUrl,
    aadhaarUrl,
    gstCertificateUrl,
    bankProofUrl,
  } = body;

  if (!name || !email || !password || !storeName) {
    return NextResponse.json({ error: 'Missing required vendor registration fields' }, { status: 400 });
  }

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hasKycDocuments = Boolean(panCardUrl || aadhaarUrl || gstCertificateUrl || bankProofUrl);
  const otp = createOtp();
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'VENDOR',
      emailVerified: false,
      emailOtpHash: hashToken(otp),
      emailOtpExpiresAt: minutesFromNow(15),
      vendorProfile: {
        create: {
          storeName,
          description: description || '',
          mobile: mobile || null,
          businessCategory: businessCategory || null,
          businessAddress: businessAddress || null,
          gstNumber: gstNumber || null,
          panNumber: panNumber || null,
          aadhaarNumber: aadhaarNumber || null,
          bankDetails: bankDetails || null,
          upiId: upiId || null,
          panCardUrl: panCardUrl || null,
          aadhaarUrl: aadhaarUrl || null,
          gstCertificateUrl: gstCertificateUrl || null,
          bankProofUrl: bankProofUrl || null,
          documentsKyc: [panCardUrl, aadhaarUrl, gstCertificateUrl, bankProofUrl]
            .filter(Boolean)
            .join('\n') || null,
          status: 'PENDING',
          kycStatus: hasKycDocuments ? 'SUBMITTED' : 'NOT_SUBMITTED',
        },
      },
    },
    include: {
      vendorProfile: true,
    },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, vendorProfile: user.vendorProfile },
    requiresVerification: true,
    message: 'Vendor account created. Verify email, then wait for admin approval.',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  }, { status: 201 });
}
