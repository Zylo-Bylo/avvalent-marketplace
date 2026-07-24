import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isVendorKycDocumentType,
  maskDocumentNumber,
  requireVendorProfile,
  safeKycDocument,
  toNullableString,
  uploadPrivateKycDocument,
} from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return { body: await request.json().catch(() => ({})), file: undefined as File | undefined };
  }

  const formData = await request.formData();
  const fileValue = formData.get('file');
  return {
    body: {
      type: formString(formData, 'type'),
      documentNumber: formString(formData, 'documentNumber'),
      documentNumberMasked: formString(formData, 'documentNumberMasked'),
      mimeType: formString(formData, 'mimeType'),
      expiresAt: formString(formData, 'expiresAt'),
    },
    file: fileValue instanceof File && fileValue.size > 0 ? fileValue : undefined,
  };
}

export async function GET() {
  const auth = await requireVendorProfile();
  if ('response' in auth) return auth.response;

  const documents = await prisma.vendorKycDocument.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({
    documents: documents.map((document) => safeKycDocument(document)),
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVendorProfile();
    if ('response' in auth) return auth.response;

    const { body, file } = await parseRequest(request);
    if (!isVendorKycDocumentType(body.type)) {
      return NextResponse.json({ error: 'Valid KYC document type is required.' }, { status: 400 });
    }

    const storagePath = file
      ? await uploadPrivateKycDocument({
          vendorId: auth.vendor.id,
          documentType: body.type,
          file,
        })
      : null;
    const documentNumberMasked =
      maskDocumentNumber(body.documentNumber) || toNullableString(body.documentNumberMasked);
    const expiresAt = toNullableString(body.expiresAt);

    const document = await prisma.vendorKycDocument.create({
      data: {
        vendorId: auth.vendor.id,
        type: body.type,
        documentNumberMasked,
        storagePath,
        mimeType: file?.type || toNullableString(body.mimeType),
        status: 'PENDING',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await prisma.vendor.update({
      where: { id: auth.vendor.id },
      data: { kycStatus: 'SUBMITTED' },
    });

    return NextResponse.json({ document: safeKycDocument(document) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'KYC document upload failed.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireVendorProfile();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
  }

  const document = await prisma.vendorKycDocument.findFirst({
    where: { id, vendorId: auth.vendor.id },
    select: { id: true, status: true },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  if (!['PENDING', 'REJECTED'].includes(document.status)) {
    return NextResponse.json(
      { error: 'Only pending or rejected document metadata can be deleted.' },
      { status: 400 },
    );
  }

  await prisma.vendorKycDocument.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
