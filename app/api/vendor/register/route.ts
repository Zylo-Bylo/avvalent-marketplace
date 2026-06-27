import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { hasEmailProvider, sendOtpEmail } from '@/lib/email';
import {
  createLocalVendorAccount,
  findLocalUserByEmail,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import {
  createOtp,
  hashToken,
  minutesFromNow,
  normalizeEmail,
  validateStrongPassword,
} from '@/lib/security';
import { getVendorAgreementMetadata } from '@/lib/legal-policy';

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
    categoryId,
    subcategoryId,
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
    vendorAgreementAccepted,
  } = body;

  if (!name || !email || !password || !storeName) {
    return NextResponse.json({ error: 'Missing required vendor registration fields' }, { status: 400 });
  }

  if (!vendorAgreementAccepted) {
    return NextResponse.json(
      { error: 'Vendor agreement must be accepted before registration.' },
      { status: 400 },
    );
  }

  const agreementAcceptedAt = new Date().toISOString();
  const agreementIpAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  const agreementUserAgent = request.headers.get('user-agent') || null;
  const agreementMetadata = getVendorAgreementMetadata({
    acceptedAt: agreementAcceptedAt,
    ipAddress: agreementIpAddress,
    userAgent: agreementUserAgent,
  });

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const localSqlite = shouldUseLocalSqliteAuth();
  const prismaModule = localSqlite ? null : await import('@/lib/prisma');
  const existingUser = localSqlite
    ? findLocalUserByEmail(normalizedEmail)
    : await prismaModule!.prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hasKycDocuments = Boolean(panCardUrl || aadhaarUrl || gstCertificateUrl || bankProofUrl);
  let businessCategoryName =
    typeof businessCategory === 'string' && businessCategory.trim()
      ? businessCategory.trim()
      : null;
  let selectedCategoryId =
    typeof categoryId === 'string' && categoryId.trim() ? categoryId.trim() : null;
  let selectedSubcategoryId =
    typeof subcategoryId === 'string' && subcategoryId.trim() ? subcategoryId.trim() : null;

  if (!localSqlite && selectedCategoryId) {
    const category = await prismaModule!.prisma.category.findUnique({
      where: { id: selectedCategoryId },
      select: {
        id: true,
        name: true,
        subcategories: selectedSubcategoryId
          ? {
              where: { id: selectedSubcategoryId },
              select: { id: true, name: true },
              take: 1,
            }
          : false,
      },
    });
    const subcategory = category?.subcategories?.[0];

    if (category) {
      businessCategoryName = subcategory
        ? `${category.name} > ${subcategory.name}`
        : category.name;
      selectedCategoryId = category.id;
      selectedSubcategoryId = subcategory?.id || null;
    }
  }

  const otp = createOtp();
  const shouldVerifyEmail = !localSqlite && hasEmailProvider();
  const hashedPassword = await hashPassword(password);
  const user = localSqlite
    ? createLocalVendorAccount({
        email: normalizedEmail,
        name,
        passwordHash: hashedPassword,
        storeName,
        description,
        mobile,
        businessCategory: businessCategoryName || undefined,
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
        metadata: {
          ...agreementMetadata,
        },
      })
    : await prismaModule!.prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          role: 'VENDOR',
          emailVerified: !shouldVerifyEmail,
          emailOtpHash: shouldVerifyEmail ? hashToken(otp) : null,
          emailOtpExpiresAt: shouldVerifyEmail ? minutesFromNow(15) : null,
          vendorProfile: {
            create: {
              storeName,
              description: description || '',
              mobile: mobile || null,
              businessCategory: businessCategoryName,
              metadata: {
                business_category: businessCategoryName,
                category_id: selectedCategoryId,
                subcategory_id: selectedSubcategoryId,
                ...agreementMetadata,
              },
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
              documentsKyc:
                [panCardUrl, aadhaarUrl, gstCertificateUrl, bankProofUrl]
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

  const emailSent = shouldVerifyEmail
    ? await sendOtpEmail({
        to: normalizedEmail,
        otp,
        purpose: 'verify your vendor account',
      })
    : false;

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, vendorProfile: user.vendorProfile },
    requiresVerification: shouldVerifyEmail,
    message: localSqlite
      ? 'Vendor account created. It is ready for admin approval.'
      : emailSent
        ? 'Vendor account created. Check your email for the OTP, then wait for admin approval.'
        : 'Vendor account created. Email verification is skipped until email delivery is configured. Wait for admin approval.',
    emailSent,
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  }, { status: 201 });
}
