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
import { verifyVendorMobileOtpToken } from '@/lib/mobile-otp';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  getUploadClient,
  hasUploadProvider,
  isAllowedUploadType,
  sanitizeFileName,
  UPLOAD_BUCKET,
} from '@/lib/uploads';

const MAX_KYC_UPLOAD_BYTES = 10 * 1024 * 1024;

type VendorRegisterBody = Record<string, string | boolean | undefined>;
type VendorRegisterFiles = {
  panCardFile?: File;
  aadhaarFile?: File;
  gstCertificateFile?: File;
  bankProofFile?: File;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === 'true' || value === 'on' || value === '1';
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : undefined;
}

function bodyText(value: VendorRegisterBody[string]) {
  return typeof value === 'string' ? value.trim() : '';
}

function bodyBoolean(value: VendorRegisterBody[string]) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

async function parseVendorRegisterRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    const body = (await request.json()) as VendorRegisterBody;
    return { body, files: {} as VendorRegisterFiles };
  }

  const formData = await request.formData();
  const body: VendorRegisterBody = {
    name: formValue(formData, 'name'),
    email: formValue(formData, 'email'),
    password: formValue(formData, 'password'),
    storeName: formValue(formData, 'storeName'),
    description: formValue(formData, 'description'),
    mobile: formValue(formData, 'mobile'),
    mobileVerified: formBoolean(formData, 'mobileVerified'),
    mobileOtpToken: formValue(formData, 'mobileOtpToken'),
    businessCategory: formValue(formData, 'businessCategory'),
    categoryId: formValue(formData, 'categoryId'),
    subcategoryId: formValue(formData, 'subcategoryId'),
    businessAddress: formValue(formData, 'businessAddress'),
    gstNumber: formValue(formData, 'gstNumber'),
    panNumber: formValue(formData, 'panNumber'),
    aadhaarNumber: formValue(formData, 'aadhaarNumber'),
    bankDetails: formValue(formData, 'bankDetails'),
    upiId: formValue(formData, 'upiId'),
    panCardUrl: formValue(formData, 'panCardUrl'),
    aadhaarUrl: formValue(formData, 'aadhaarUrl'),
    gstCertificateUrl: formValue(formData, 'gstCertificateUrl'),
    bankProofUrl: formValue(formData, 'bankProofUrl'),
    vendorAgreementAccepted: formBoolean(formData, 'vendorAgreementAccepted'),
  };

  return {
    body,
    files: {
      panCardFile: formFile(formData, 'panCardFile'),
      aadhaarFile: formFile(formData, 'aadhaarFile'),
      gstCertificateFile: formFile(formData, 'gstCertificateFile'),
      bankProofFile: formFile(formData, 'bankProofFile'),
    },
  };
}

async function ensureUploadBucket() {
  const supabase = getUploadClient();

  if (!supabase) {
    return { supabase: null, error: 'Upload storage is not configured.' };
  }

  const bucketOptions = {
    public: true,
    fileSizeLimit: MAX_KYC_UPLOAD_BYTES,
    allowedMimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
  };
  const { data: bucket } = await supabase.storage.getBucket(UPLOAD_BUCKET);

  if (!bucket) {
    const { error } = await supabase.storage.createBucket(UPLOAD_BUCKET, bucketOptions);

    if (error && !error.message.toLowerCase().includes('already exists')) {
      return { supabase, error: error.message };
    }
  }

  return { supabase, error: null };
}

async function uploadRegistrationDocument(file: File, field: string) {
  if (!hasUploadProvider()) {
    throw new Error(
      'Upload storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    );
  }

  if (!isAllowedUploadType(file.type)) {
    throw new Error(`${field}: only JPG, PNG, WebP, GIF, MP4, WebM, MOV and PDF files are allowed.`);
  }

  if (file.size > MAX_KYC_UPLOAD_BYTES) {
    throw new Error(`${field}: file must be 10MB or smaller.`);
  }

  const { supabase, error: bucketError } = await ensureUploadBucket();
  if (!supabase || bucketError) {
    throw new Error(bucketError || 'Upload storage is not available.');
  }

  const safeFileName = sanitizeFileName(file.name);
  const path = `kyc/vendor-registration/${Date.now()}-${field}-${safeFileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`${field}: ${error.message}`);
  }

  const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadRegistrationDocuments(files: VendorRegisterFiles) {
  const uploads: Partial<Record<'panCardUrl' | 'aadhaarUrl' | 'gstCertificateUrl' | 'bankProofUrl', string>> = {};

  if (files.panCardFile) {
    uploads.panCardUrl = await uploadRegistrationDocument(files.panCardFile, 'pan-card');
  }

  if (files.aadhaarFile) {
    uploads.aadhaarUrl = await uploadRegistrationDocument(files.aadhaarFile, 'aadhaar');
  }

  if (files.gstCertificateFile) {
    uploads.gstCertificateUrl = await uploadRegistrationDocument(files.gstCertificateFile, 'gst-certificate');
  }

  if (files.bankProofFile) {
    uploads.bankProofUrl = await uploadRegistrationDocument(files.bankProofFile, 'bank-proof');
  }

  return uploads;
}

export async function POST(request: NextRequest) {
  const { body, files } = await parseVendorRegisterRequest(request);
  const name = bodyText(body.name);
  const email = bodyText(body.email);
  const password = bodyText(body.password);
  const storeName = bodyText(body.storeName);
  const description = bodyText(body.description);
  const mobile = bodyText(body.mobile);
  const mobileOtpToken = bodyText(body.mobileOtpToken);
  const businessCategory = bodyText(body.businessCategory);
  const categoryId = bodyText(body.categoryId);
  const subcategoryId = bodyText(body.subcategoryId);
  const businessAddress = bodyText(body.businessAddress);
  const gstNumber = bodyText(body.gstNumber).toUpperCase();
  const panNumber = bodyText(body.panNumber).toUpperCase();
  const aadhaarNumber = bodyText(body.aadhaarNumber);
  const bankDetails = bodyText(body.bankDetails);
  const upiId = bodyText(body.upiId);
  const panCardUrl = bodyText(body.panCardUrl);
  const aadhaarUrl = bodyText(body.aadhaarUrl);
  const gstCertificateUrl = bodyText(body.gstCertificateUrl);
  const bankProofUrl = bodyText(body.bankProofUrl);
  const mobileVerified =
    bodyBoolean(body.mobileVerified) &&
    verifyVendorMobileOtpToken(mobileOtpToken, mobile);
  const vendorAgreementAccepted = bodyBoolean(body.vendorAgreementAccepted);

  if (!name || !email || !password || !storeName) {
    return NextResponse.json({ error: 'Missing required vendor registration fields' }, { status: 400 });
  }

  if (!mobile || String(mobile).replace(/\D/g, '').length < 10 || mobileVerified !== true) {
    return NextResponse.json(
      { error: 'Mobile OTP verification is required before vendor registration.' },
      { status: 400 },
    );
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

  let uploadedDocuments: Awaited<ReturnType<typeof uploadRegistrationDocuments>> = {};

  try {
    uploadedDocuments = await uploadRegistrationDocuments(files);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not upload KYC documents.' },
      { status: 400 },
    );
  }

  const finalPanCardUrl = uploadedDocuments.panCardUrl || String(panCardUrl || '');
  const finalAadhaarUrl = uploadedDocuments.aadhaarUrl || String(aadhaarUrl || '');
  const finalGstCertificateUrl =
    uploadedDocuments.gstCertificateUrl || String(gstCertificateUrl || '');
  const finalBankProofUrl = uploadedDocuments.bankProofUrl || String(bankProofUrl || '');
  const hasKycDocuments = Boolean(
    finalPanCardUrl || finalAadhaarUrl || finalGstCertificateUrl || finalBankProofUrl,
  );

  if (!businessAddress || !panNumber || !aadhaarNumber || !bankDetails) {
    return NextResponse.json(
      { error: 'Business address, PAN, Aadhaar and bank details are required.' },
      { status: 400 },
    );
  }

  if (!finalPanCardUrl || !finalAadhaarUrl || !finalBankProofUrl) {
    return NextResponse.json(
      { error: 'PAN card, Aadhaar and bank proof document uploads are required.' },
      { status: 400 },
    );
  }

  if (gstNumber && !finalGstCertificateUrl) {
    return NextResponse.json(
      { error: 'GST certificate upload is required when GST number is provided.' },
      { status: 400 },
    );
  }

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
        panCardUrl: finalPanCardUrl,
        aadhaarUrl: finalAadhaarUrl,
        gstCertificateUrl: finalGstCertificateUrl,
        bankProofUrl: finalBankProofUrl,
        metadata: {
          mobile_otp_verified: true,
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
                mobile_otp_verified: true,
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
              panCardUrl: finalPanCardUrl || null,
              aadhaarUrl: finalAadhaarUrl || null,
              gstCertificateUrl: finalGstCertificateUrl || null,
              bankProofUrl: finalBankProofUrl || null,
              documentsKyc:
                [finalPanCardUrl, finalAadhaarUrl, finalGstCertificateUrl, finalBankProofUrl]
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
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      vendorProfile: 'vendorProfile' in user ? user.vendorProfile : null,
    },
    requiresVerification: shouldVerifyEmail,
    message: localSqlite
      ? 'Vendor account created. It is ready for admin approval.'
      : emailSent
        ? 'Vendor account created. Check your email for the OTP, then wait for admin approval.'
        : 'Vendor account created. Email verification is skipped until email delivery is configured. Wait for admin approval.',
    emailSent,
  }, { status: 201 });
}
