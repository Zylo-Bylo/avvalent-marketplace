import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  getCategoryUploadTemplate,
  getResolvedCategorySpecifications,
  saveCategoryUploadTemplate,
} from '@/lib/category-upload-templates';
import { SpecificationInheritanceError } from '@/lib/category-specification-inheritance';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const requestStartedAt = performance.now();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const productTypeId = searchParams.get('productTypeId');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 },
      );
    }

    const resolved = searchParams.get('mode') === 'resolved-specifications';
    const payload = resolved
      ? await getResolvedCategorySpecifications({ categoryId, subcategoryId, productTypeId })
      : { template: await getCategoryUploadTemplate(categoryId, subcategoryId, productTypeId) };
    const queryFinishedAt = performance.now();
    const body = JSON.stringify(payload);
    const serializationFinishedAt = performance.now();
    const forceFresh = searchParams.get('fresh') === '1';

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': forceFresh || resolved
          ? 'private, no-store'
          : 'public, max-age=30, s-maxage=120, stale-while-revalidate=60',
        'Server-Timing': [
          `db;dur=${(queryFinishedAt - requestStartedAt).toFixed(1)}`,
          `serialize;dur=${(serializationFinishedAt - queryFinishedAt).toFixed(1)}`,
        ].join(', '),
        'X-Catalogue-Payload-Bytes': String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    if (error instanceof SpecificationInheritanceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'PUBLISHED_SPECIFICATIONS_UNAVAILABLE' ? 409 : 400 });
    }
    console.error('Category template fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category template' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminApiUser();
    if (auth.response) return auth.response;

    const body = await request.json();
    if (body.specificationView === 'resolved-specifications' || body.resolution?.inheritanceApplied) {
      throw new SpecificationInheritanceError('Resolved specifications are read-only. Save child-local definitions instead.');
    }
    if (!body.categoryId || typeof body.categoryId !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 },
      );
    }

    const template = await saveCategoryUploadTemplate({
      categoryId: body.categoryId,
      subcategoryId: body.subcategoryId || null,
      productTypeId: body.productTypeId || null,
      productTypes: Array.isArray(body.productTypes) ? body.productTypes : [],
      specTemplate: body.specTemplate || {
        title: 'Category Specifications',
        helpText: 'Add category-specific product details.',
        fields: [],
      },
      variantConfig: body.variantConfig || {
        title: 'Variant, Option & Stock Rows',
        note: 'Add rows for selectable options and stock differences.',
        selectedStyle: 'Managed category template',
        sizeLabelHeading: 'Option Label',
        sizeLabelPlaceholder: 'Standard / Pack of 2',
        numericSizeHeading: 'Option Detail',
        numericSizePlaceholder: '1 piece / 500 g',
        colorHeading: 'Color / Type',
        colorPlaceholder: 'Default',
        skuHeading: 'Variant SKU',
        skuPlaceholder: 'STD-1',
        defaultSizePlaceholder: 'Default size / capacity / option',
        availableSizesPlaceholder: 'Available options, e.g. Standard, Pack of 2',
        brandMappingPlaceholder: 'Brand option mapping if applicable',
        examples: [],
      },
      sizeChart: typeof body.sizeChart === 'string' ? body.sizeChart : '',
      requiredFields: Array.isArray(body.requiredFields) ? body.requiredFields : [],
    });

    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof SpecificationInheritanceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('Category template save error:', error);
    return NextResponse.json(
      { error: 'Category template could not be saved' },
      { status: 500 },
    );
  }
}
