import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  getUploadClient,
  hasUploadProvider,
  isAllowedUploadType,
  sanitizeFileName,
  UPLOAD_BUCKET,
} from '@/lib/uploads';
import {
  metadataImageStorageFolder,
  type CategoryMetadataImageField,
} from '@/lib/category-metadata-images';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_HOMEPAGE_BANNER_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_PURPOSES = new Set([
  'product',
  'dispatch-proof',
  'delivery-proof',
  'return-evidence',
  'vendor-logo',
  'kyc',
  'profile',
  'homepage-banner',
  'category-asset',
]);

async function getUploadUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return { id: String(data.userId), role: data.role || 'VENDOR' };
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
    select: { id: true, role: true },
  });

  return user;
}

async function ensureBucket() {
  const supabase = getUploadClient();

  if (!supabase) {
    return { supabase: null, error: 'Upload storage is not configured.' };
  }

  const { data: bucket } = await supabase.storage.getBucket(UPLOAD_BUCKET);
  const bucketOptions = {
    public: true,
    fileSizeLimit: MAX_HOMEPAGE_BANNER_UPLOAD_BYTES,
    allowedMimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
  };

  if (!bucket) {
    const { error } = await supabase.storage.createBucket(UPLOAD_BUCKET, bucketOptions);

    if (error && !error.message.toLowerCase().includes('already exists')) {
      return { supabase, error: error.message };
    }
  } else {
    const { error } = await supabase.storage.updateBucket(UPLOAD_BUCKET, bucketOptions);

    if (error) {
      return { supabase, error: error.message };
    }
  }

  return { supabase, error: null };
}

export async function POST(request: NextRequest) {
  if (!hasUploadProvider()) {
    return NextResponse.json(
      {
        error:
          'Upload storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName || '');
  const mimeType = String(body?.mimeType || '');
  const size = Number(body?.size || 0);
  const purposeValue = String(body?.purpose || 'product');
  const purpose = ALLOWED_PURPOSES.has(purposeValue) ? purposeValue : 'product';
  const scopeType = String(body?.scopeType || '');
  const scopeId = String(body?.scopeId || '');
  const assetField = String(body?.assetField || '') as CategoryMetadataImageField;

  const user = await getUploadUser();
  const role = String(user?.role || '');
  const customerAllowedPurpose = purpose === 'return-evidence';
  if (
    !user ||
    (!['VENDOR', 'ADMIN'].includes(role) &&
      !(role === 'CUSTOMER' && customerAllowedPurpose))
  ) {
    return NextResponse.json(
      { error: 'Login with a permitted account to upload this file.' },
      { status: 401 },
    );
  }

  if (!fileName || !mimeType || !size) {
    return NextResponse.json(
      { error: 'File name, type and size are required.' },
      { status: 400 },
    );
  }

  if (!isAllowedUploadType(mimeType)) {
    return NextResponse.json(
      { error: 'Only JPG, PNG, WebP, GIF, MP4, WebM, MOV and PDF files are allowed.' },
      { status: 400 },
    );
  }

  const maxUploadBytes =
    purpose === 'homepage-banner' ? MAX_HOMEPAGE_BANNER_UPLOAD_BYTES : MAX_UPLOAD_BYTES;

  if (size > maxUploadBytes) {
    const maxUploadMB = Math.floor(maxUploadBytes / (1024 * 1024));
    return NextResponse.json(
      { error: `File must be ${maxUploadMB}MB or smaller.` },
      { status: 400 },
    );
  }

  const { supabase, error: bucketError } = await ensureBucket();
  if (!supabase || bucketError) {
    return NextResponse.json(
      { error: bucketError || 'Upload storage is not available.' },
      { status: 503 },
    );
  }

  const safeFileName = sanitizeFileName(fileName);
  let path = `${purpose}/${user.id}/${Date.now()}-${safeFileName}`;
  if (purpose === 'category-asset') {
    const validScopeType = scopeType === 'category' || scopeType === 'subcategory' || scopeType === 'productType';
    const validAssetField =
      assetField === 'homepageIcon' ||
      assetField === 'categoryImage' ||
      assetField === 'desktopBanner' ||
      assetField === 'mobileBanner';

    if (role !== 'ADMIN' || !validScopeType || !scopeId || !validAssetField) {
      return NextResponse.json(
        { error: 'Valid admin category asset scope is required.' },
        { status: 400 },
      );
    }

    path = `${metadataImageStorageFolder(scopeType, scopeId, assetField)}/${Date.now()}-${safeFileName}`;
  }
  const { data: signedUpload, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !signedUpload?.signedUrl || !signedUpload.token) {
    return NextResponse.json(
      { error: error?.message || 'Could not create signed upload URL.' },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);

  return NextResponse.json({
    path,
    signedUrl: signedUpload.signedUrl,
    token: signedUpload.token,
    url: publicUrlData.publicUrl,
  });
}
