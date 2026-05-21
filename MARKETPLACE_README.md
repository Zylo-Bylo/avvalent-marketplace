# ZYLO-Buylo: Multi-Vendor Marketplace

A production-ready multi-vendor e-commerce marketplace built with Next.js 16, TypeScript, PostgreSQL, and Prisma.

## 🚀 Features

### Core Marketplace Features
- **Multi-Vendor Support**: Multiple vendors can register and sell products
- **Product Management**: Vendors can upload, edit, and delete products
- **Shopping Cart**: Persistent cart using Zustand state management
- **Checkout Flow**: Complete order checkout with shipping address
- **Order Management**: Track orders and view order history

### User Features
- **Authentication**: JWT-based authentication with secure password hashing
- **User Roles**: Support for CUSTOMER, VENDOR, and ADMIN roles
- **Order Tracking**: Customers can view their order history and status
- **Vendor Dashboard**: Vendors can manage their store and products
- **Admin Panel**: Administrative dashboard with marketplace statistics

### Technical Features
- **Type-Safe**: Built with TypeScript for type safety
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with secure cookie storage
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Performance**: Next.js App Router with server and client components
- **SEO**: Optimized for search engines

## 📁 Project Structure

```
zylo-buylo/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── products/          # Product management
│   │   ├── orders/            # Order management
│   │   ├── vendor/            # Vendor endpoints
│   │   ├── customer/          # Customer endpoints
│   │   └── admin/             # Admin endpoints
│   ├── vendor/                # Vendor pages
│   │   └── dashboard/         # Vendor dashboard
│   ├── admin/                 # Admin pages
│   │   └── dashboard/         # Admin dashboard
│   ├── checkout/              # Checkout page
│   ├── orders/                # Customer orders page
│   ├── cart/                  # Shopping cart page
│   ├── products/              # Product listing
│   ├── login/                 # Login page
│   ├── signup/                # Signup page
│   └── page.tsx               # Home page
├── components/
│   ├── navbar/               # Navigation component
│   ├── home/                 # Home page components
│   └── ui/                   # Reusable UI components
├── lib/
│   ├── auth.ts              # Authentication utilities
│   └── prisma.ts            # Prisma client
├── store/
│   └── cart-store.ts        # Zustand cart store
├── types/
│   └── index.ts             # Type definitions
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## 🗄️ Database Schema

### Models
- **User**: Store user accounts with roles (CUSTOMER, VENDOR, ADMIN)
- **Vendor**: Vendor store information linked to User
- **Product**: Products with inventory, pricing, and images
- **Order**: Customer orders with payment status
- **OrderItem**: Individual items in orders
- **Category**: Product categories
- **Review**: Product reviews and ratings
- **Wishlist**: Customer wishlists
- **Notification**: System notifications

## 🔐 Authentication Flow

1. User registers via `/signup` endpoint
2. Password is hashed with bcryptjs (12 rounds)
3. JWT token is created and stored in HTTP-only cookie
4. Token is verified on protected routes
5. User can logout to clear authentication

## 🛒 Checkout Flow

1. Customer adds items to cart (stored in Zustand)
2. Navigates to `/checkout`
3. Enters shipping address and selects payment method
4. Order is created and grouped by vendor
5. Order status is set to PENDING (awaiting payment)
6. Can integrate with Razorpay/Stripe for payment

## 👥 User Roles

### Customer
- Browse and search products
- Add items to cart
- Checkout and place orders
- View order history and status
- Leave reviews

### Vendor
- Register store
- Upload and manage products
- View sales and orders
- Track inventory
- Access vendor dashboard

### Admin
- View marketplace statistics
- Manage users and vendors
- Review and moderate content
- Manage categories
- View system activity

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Products
- `POST /api/products/create` - Create product (vendor only)
- `PUT /api/products/[id]` - Update product (vendor only)
- `DELETE /api/products/[id]` - Delete product (vendor only)

### Vendor
- `POST /api/vendor/register` - Register as vendor
- `GET /api/vendor/products` - Get vendor's products

### Orders
- `POST /api/orders/create` - Create new order
- `GET /api/orders/[id]` - Get order details
- `GET /api/customer/orders` - Get customer's orders

### Admin
- `GET /api/admin/stats` - Get marketplace statistics

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and secrets

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev

# Build for production
npm run build
npm run start
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/zylo_buylo"
JWT_SECRET="your-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret"
STRIPE_SECRET_KEY="sk_test_..."
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Authentication**: JWT + bcryptjs
- **Icons**: Emoji (can be replaced with icon library)

## 📝 Notes

- The project uses Prisma 7 with the new driver adapter pattern
- Authentication tokens are stored in HTTP-only cookies for security
- Cart state is persisted to localStorage via Zustand
- Payment gateway integration (Razorpay/Stripe) can be added by implementing payment route handlers

## 🔄 Future Enhancements

- [ ] Payment gateway integration (Razorpay/Stripe)
- [ ] Advanced search and filters
- [ ] Product reviews and ratings
- [ ] Wishlist functionality
- [ ] Email notifications
- [ ] Analytics dashboard
- [ ] Seller ratings and reviews
- [ ] Bulk product upload
- [ ] Inventory alerts
- [ ] Return management system

## 📄 License

This project is open source and available under the MIT License.
