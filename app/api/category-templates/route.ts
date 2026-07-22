import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  getCategoryUploadTemplate,
  saveCategoryUploadTemplate,
} from '@/lib/category-upload-templates';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
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

    const template = await getCategoryUploadTemplate(categoryId, subcategoryId, productTypeId);
    return NextResponse.json({ template });
  } catch (error) {
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
    console.error('Category template save error:', error);
    return NextResponse.json(
      { error: 'Category template could not be saved' },
      { status: 500 },
    );
  }
}
