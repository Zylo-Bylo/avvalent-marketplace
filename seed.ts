import { prisma } from './lib/prisma';

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@zylo-buylo.com' },
    update: {
      role: 'ADMIN',
      emailVerified: true,
    },
    create: {
      email: 'admin@zylo-buylo.com',
      name: 'Zylo Admin',
      password: '$2b$12$6Hmw14A9D2oQblC/1Q9rFu4bZN9QVesvD8lYPS7uh0IKn7yl5lvdi', // 'password123'
      role: 'ADMIN',
      emailVerified: true,
    },
  });

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

  // Create a sample vendor
  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@zylo-buylo.com' },
    update: {
      emailVerified: true,
      vendorProfile: {
        update: {
          status: 'APPROVED',
          kycStatus: 'APPROVED',
          approvedAt: new Date(),
        },
      },
    },
    create: {
      email: 'vendor@zylo-buylo.com',
      name: 'Sample Vendor',
      password: '$2b$12$6Hmw14A9D2oQblC/1Q9rFu4bZN9QVesvD8lYPS7uh0IKn7yl5lvdi', // 'password123'
      role: 'VENDOR',
      emailVerified: true,
      vendorProfile: {
        create: {
          storeName: 'Sample Store',
          description: 'A sample vendor store for testing',
          status: 'APPROVED',
          kycStatus: 'APPROVED',
          approvedAt: new Date(),
        },
      },
    },
    include: { vendorProfile: true },
  });

  const vendorProfile = vendor.vendorProfile!;

  // Create sample products
  const products = [
    {
      name: 'Stylish T-Shirt',
      slug: 'stylish-t-shirt',
      description: 'A comfortable and stylish t-shirt perfect for everyday wear.',
      price: 499,
      images: ['https://via.placeholder.com/600x600/FFB6C1/000000?text=T-Shirt'],
      inventory: 50,
      categoryId: fashionCategory.id,
      vendorId: vendorProfile.id,
    },
    {
      name: 'Blue Jeans',
      slug: 'blue-jeans',
      description: 'Classic blue jeans with a perfect fit for all occasions.',
      price: 1299,
      images: ['https://via.placeholder.com/600x600/1E40AF/FFFFFF?text=Jeans'],
      inventory: 30,
      categoryId: fashionCategory.id,
      vendorId: vendorProfile.id,
    },
    {
      name: 'Smart Watch',
      slug: 'smart-watch',
      description: 'Feature-packed smart watch with health tracking and notifications.',
      price: 1499,
      images: ['https://via.placeholder.com/600x600/0F766E/FFFFFF?text=Watch'],
      inventory: 20,
      categoryId: electronicsCategory.id,
      vendorId: vendorProfile.id,
    },
    {
      name: 'Bluetooth Earbuds',
      slug: 'bluetooth-earbuds',
      description: 'Wireless earbuds with excellent sound quality and noise cancellation.',
      price: 1299,
      images: ['https://via.placeholder.com/600x600/9333EA/FFFFFF?text=Earbuds'],
      inventory: 25,
      categoryId: electronicsCategory.id,
      vendorId: vendorProfile.id,
    },
  ];

  for (const productData of products) {
    await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: productData,
    });
  }

  console.log('Sample data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
