import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  getUploadClient,
  hasUploadProvider,
  isAllowedUploadType,
  sanitizeFileName,
} from '@/lib/uploads';

export const VENDOR_ADDRESS_TYPES = ['REGISTERED', 'PICKUP', 'RETURN', 'OTHER'] as const;
export const VENDOR_KYC_DOCUMENT_TYPES = [
  'GST',
  'PAN',
  'AADHAAR',
  'BUSINESS_REGISTRATION',
  'BANK_PROOF',
  'ADDRESS_PROOF',
  'OTHER',
] as const;
export const VENDOR_KYC_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;

export const KYC_DOCUMENT_BUCKET =
  process.env.SUPABASE_KYC_DOCUMENT_BUCKET || 'zylo-buylo-kyc-documents';
export const MAX_KYC_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const KYC_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

type VendorAuthResult =
  | { vendor: { id: string; userId: string; status: string; kycStatus: string }; userId: string }
  | { response: NextResponse };

export function toNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function toRequiredString(value: unknown, field: string) {
  const text = toNullableString(value);
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
}

export function isVendorAddressType(value: unknown): value is (typeof VENDOR_ADDRESS_TYPES)[number] {
  return typeof value === 'string' && VENDOR_ADDRESS_TYPES.includes(value as any);
}

export function isVendorKycDocumentType(value: unknown): value is (typeof VENDOR_KYC_DOCUMENT_TYPES)[number] {
  return typeof value === 'string' && VENDOR_KYC_DOCUMENT_TYPES.includes(value as any);
}

export function maskDocumentNumber(value: unknown) {
  const text = toNullableString(value)?.replace(/\s+/g, '').toUpperCase();
  if (!text) return null;
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(text)) {
    return `PAN-*****${text.slice(-4)}`;
  }
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `****${digits.slice(-4)}`;
  }
  return text.length > 4 ? `****${text.slice(-4)}` : '****';
}

export async function requireVendorProfile(): Promise<VendorAuthResult> {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      vendorProfile: {
        select: { id: true, userId: true, status: true, kycStatus: true },
      },
    },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return { response: NextResponse.json({ error: 'Vendor access required' }, { status: 403 }) };
  }

  return { vendor: user.vendorProfile, userId: user.id };
}

export function safeKycDocument<T extends {
  storagePath?: string | null;
  documentNumberMasked?: string | null;
}>(document: T, signedUrl?: string | null) {
  const { storagePath: _storagePath, ...rest } = document;
  return {
    ...rest,
    hasFile: Boolean(_storagePath),
    ...(signedUrl ? { signedUrl } : {}),
  };
}

async function ensurePrivateKycBucket() {
  const supabase = getUploadClient();
  if (!supabase) {
    throw new Error('KYC document storage is not configured.');
  }

  const { data: bucket } = await supabase.storage.getBucket(KYC_DOCUMENT_BUCKET);
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(KYC_DOCUMENT_BUCKET, {
      public: false,
      fileSizeLimit: MAX_KYC_DOCUMENT_BYTES,
      allowedMimeTypes: [...KYC_UPLOAD_MIME_TYPES],
    });

    if (error && !error.message.toLowerCase().includes('already exists')) {
      throw new Error(error.message);
    }
  }

  return supabase;
}

export async function uploadPrivateKycDocument(input: {
  vendorId: string;
  documentType: string;
  file: File;
}) {
  if (!hasUploadProvider()) {
    throw new Error('KYC document storage is not configured.');
  }

  if (!KYC_UPLOAD_MIME_TYPES.includes(input.file.type as any) || !isAllowedUploadType(input.file.type)) {
    throw new Error('Only JPG, PNG, WebP and PDF KYC documents are allowed.');
  }

  if (input.file.size > MAX_KYC_DOCUMENT_BYTES) {
    throw new Error('KYC document must be 10MB or smaller.');
  }

  const safeFileName = sanitizeFileName(input.file.name);
  if (safeFileName.endsWith('.exe') || safeFileName.endsWith('.js') || safeFileName.endsWith('.html')) {
    throw new Error('Executable KYC uploads are not allowed.');
  }

  const supabase = await ensurePrivateKycBucket();
  const storagePath = [
    'vendors',
    input.vendorId,
    input.documentType.toLowerCase(),
    `${Date.now()}-${randomUUID()}-${safeFileName}`,
  ].join('/');
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage
    .from(KYC_DOCUMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: input.file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function createKycSignedUrl(storagePath: string | null | undefined) {
  if (!storagePath || !hasUploadProvider()) return null;
  const supabase = getUploadClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(KYC_DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, 300);
  if (error) return null;
  return data.signedUrl;
}

export async function createVendorEvent(input: {
  vendorId: string;
  actorUserId?: string | null;
  previousStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.vendorVerificationEvent.create({
    data: {
      vendorId: input.vendorId,
      actorUserId: input.actorUserId || null,
      previousStatus: input.previousStatus || null,
      newStatus: input.newStatus,
      reason: input.reason || null,
      metadata: input.metadata ? (input.metadata as any) : undefined,
    },
  });
}
