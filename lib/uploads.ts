import { createClient } from '@supabase/supabase-js';

export const UPLOAD_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'zylo-buylo-uploads';

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
];

export function hasUploadProvider() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getUploadClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

export function sanitizeFileName(fileName: string) {
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  const baseName = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `${baseName || 'upload'}${extension ? `.${extension.toLowerCase()}` : ''}`;
}

export function isAllowedUploadType(mimeType: string) {
  return ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType);
}
