import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Create categories
    const fashionCategory = await prisma.category.upsert({
      where: { name: 'Fashion' },
      update: {},
      create: { name: 'Fashion', slug: 'fashion' },
    });

    const electronicsCategory = await prisma.category.upsert({
      where: { name: 'Electronics' },
      update: {},
      create: { name: 'Electronics', slug: 'electronics' },
    });

    const homeCategory = await prisma.category.upsert({
      where: { name: 'Home & Garden' },
      update: {},
      create: { name: 'Home & Garden', slug: 'home-garden' },
    });

    // Create vendor
    const vendor = await prisma.user.upsert({
      where: { email: 'vendor@example.com' },
      update: {},
      create: {
        email: 'vendor@example.com',
        name: 'Sample Vendor',
        password: '$2a$10$hashedpassword', // dummy hash
        role: 'VENDOR',
        vendorProfile: {
          create: {
            storeName: 'Test Store',
            description: 'A test vendor store',
          },
        },
      },
      include: { vendorProfile: true },
    });

    // Create products
    const products = [
      {
        name: 'Stylish T-Shirt',
        slug: 'stylish-t-shirt',
        description: 'A comfortable and stylish t-shirt perfect for everyday wear.',
        price: 29.99,
        images: ['https://via.placeholder.com/400x400?text=Stylish+T-Shirt'],
        inventory: 50,
        vendorId: vendor.vendorProfile!.id,
        categoryId: fashionCategory.id,
      },
      {
        name: 'Wireless Headphones',
        slug: 'wireless-headphones',
        description: 'High-quality wireless headphones with noise cancellation.',
        price: 199.99,
        images: ['https://via.placeholder.com/400x400?text=Headphones'],
        inventory: 25,
        vendorId: vendor.vendorProfile!.id,
        categoryId: electronicsCategory.id,
      },
      {
        name: 'Garden Tools Set',
        slug: 'garden-tools-set',
        description: 'Complete set of essential garden tools for your gardening needs.',
        price: 79.99,
        images: ['https://via.placeholder.com/400x400?text=Garden+Tools'],
        inventory: 15,
        vendorId: vendor.vendorProfile!.id,
        categoryId: homeCategory.id,
      },
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: product,
      });
    }

    return NextResponse.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}