import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = (await request.json()) as {
      items: CartItem[];
      address: string;
      city: string;
      state: string;
      zipCode: string;
      phone: string;
      paymentMethod: 'RAZORPAY' | 'STRIPE' | string;
      totalAmount?: number;
    };

    const { items, address, city, state, zipCode, phone, paymentMethod, totalAmount } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }

    if (!address || !city || !state || !zipCode || !phone) {
      return NextResponse.json({ error: 'Missing shipping information' }, { status: 400 });
    }

    const productIds = Array.from(new Set(items.map((item) => item.id)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { vendor: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Some products not found' }, { status: 400 });
    }

    const vendorGroups = new Map<string, CartItem[]>();
    items.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        if (!vendorGroups.has(product.vendorId)) {
          vendorGroups.set(product.vendorId, []);
        }
        vendorGroups.get(product.vendorId)!.push(item);
      }
    });

    const createdOrders = [];
    for (const [vendorId, vendorItems] of vendorGroups) {
      const vendorTotal = vendorItems.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
      const order = await prisma.order.create({
        data: {
          userId: String(data.userId),
          vendorId,
          totalAmount: vendorTotal,
          paymentMethod: paymentMethod as any,
          status: 'PENDING',
          items: {
            create: vendorItems.map((item: CartItem) => {
              const product = products.find((p) => p.id === item.id);
              return {
                productId: item.id,
                quantity: item.quantity,
                price: product?.price || 0,
              };
            }),
          },
        },
        include: { items: true },
      });
      createdOrders.push(order);
    }

    const order = createdOrders[0];
    const amountInPaise = Math.round((totalAmount || order.totalAmount) * 100);

    if (paymentMethod === 'RAZORPAY') {
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpayKeyId || !razorpaySecret) {
        return NextResponse.json({ error: 'Razorpay credentials are not configured' }, { status: 500 });
      }

      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpaySecret,
      });

      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.id,
        payment_capture: true,
        notes: {
          orderId: order.id,
        },
      });

      return NextResponse.json(
        {
          orderId: order.id,
          paymentMethod,
          razorpayOrderId: razorpayOrder.id,
          razorpayKeyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },
        { status: 201 }
      );
    }

    if (paymentMethod === 'STRIPE') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return NextResponse.json({ error: 'Stripe credentials are not configured' }, { status: 500 });
      }
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: `${baseUrl}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          orderId: order.id,
        },
        line_items: items.map((item: CartItem) => ({
          price_data: {
            currency: 'INR',
            product_data: {
              name: item.name,
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
      });

      return NextResponse.json(
        {
          orderId: order.id,
          paymentMethod,
          paymentUrl: session.url,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        orderId: order.id,
        paymentMethod,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
