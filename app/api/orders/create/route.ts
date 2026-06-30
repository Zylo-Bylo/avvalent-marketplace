import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { verifyCheckoutAuthToken } from '@/lib/checkout-auth-token';
import { signOrderAccessToken } from '@/lib/order-access-token';
import { notifyOrderPlaced } from '@/lib/order-notifications';
import { getMarketplaceUpiId } from '@/lib/payment-settings';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  releaseReservedStockForOrder,
  reduceStockForOrder,
  reserveStockForOrder,
  validateCartStock,
} from '@/lib/inventory';
import {
  getVariantsForProducts,
  validateVariantCartStock,
  ensureVariantSchema,
} from '@/lib/variants';

interface CartItem {
  id: string;
  productId?: string;
  variantId?: string | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  color?: string | null;
  sku?: string | null;
  name: string;
  price: number;
  quantity: number;
}

const PAYMENT_METHODS = ['COD', 'UPI', 'RAZORPAY', 'STRIPE'] as const;
const DEFAULT_MAX_COD_AMOUNT = 10000;

function isPaymentMethod(value: string): value is (typeof PAYMENT_METHODS)[number] {
  return PAYMENT_METHODS.includes(value as (typeof PAYMENT_METHODS)[number]);
}

function getMaxCodAmount() {
  const value = Number(process.env.MAX_COD_AMOUNT || DEFAULT_MAX_COD_AMOUNT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_COD_AMOUNT;
}

function hasValidIndianPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 12;
}

async function cancelPendingOnlineOrders(orderIds: string[], reason: string) {
  if (!orderIds.length) {
    return;
  }

  await prisma.order.updateMany({
    where: {
      id: { in: orderIds },
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
      statusNote: reason,
    },
  });

  await Promise.all(
    orderIds.map((orderId) =>
      releaseReservedStockForOrder(orderId, {
        reason,
      }),
    ),
  );
}

export async function POST(request: Request) {
  try {
    const session =
      (await getAuthSession()) ||
      verifyCheckoutAuthToken(request.headers.get('x-checkout-auth-token'));

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      items: CartItem[];
      address: string;
      city: string;
      state: string;
      zipCode: string;
      phone: string;
      paymentMethod: 'COD' | 'UPI' | 'RAZORPAY' | 'STRIPE' | string;
      termsAccepted?: boolean;
      codTermsAccepted?: boolean;
      totalAmount?: number;
    };

    const { items, address, city, state, zipCode, phone, paymentMethod } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }

    if (!isPaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
    }

    if (!address || !city || !state || !zipCode || !phone) {
      return NextResponse.json({ error: 'Missing shipping information' }, { status: 400 });
    }

    if (!hasValidIndianPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile number for order and delivery OTP updates.' },
        { status: 400 },
      );
    }

    if (!body.termsAccepted) {
      return NextResponse.json(
        { error: 'Please accept Zylo-Buylo terms and return policy before placing this order.' },
        { status: 400 },
      );
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const merchantUpiId = await getMarketplaceUpiId();

    if (paymentMethod === 'RAZORPAY' && (!razorpayKeyId || !razorpaySecret)) {
      return NextResponse.json({ error: 'Razorpay credentials are not configured' }, { status: 500 });
    }

    if (paymentMethod === 'STRIPE' && !stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe credentials are not configured' }, { status: 500 });
    }

    if (paymentMethod === 'UPI' && !merchantUpiId) {
      return NextResponse.json({ error: 'UPI payment is not configured' }, { status: 500 });
    }

    const maxCodAmount = getMaxCodAmount();
    if (paymentMethod === 'COD') {
      if (!body.codTermsAccepted) {
        return NextResponse.json(
          { error: 'Please accept Cash on Delivery terms before placing this order.' },
          { status: 400 },
        );
      }

      const requestedTotal = Number(body.totalAmount || 0);
      if (requestedTotal > maxCodAmount) {
        return NextResponse.json(
          {
            error: `COD is available up to Rs. ${maxCodAmount.toLocaleString('en-IN')}. Please use online payment for this order.`,
          },
          { status: 400 },
        );
      }
    }

    await ensureVariantSchema();

    const productIds = Array.from(
      new Set(items.map((item) => String(item.productId || item.id))),
    );
    const customer = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { vendor: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Some products not found' }, { status: 400 });
    }

    const variantStockValidation = await validateVariantCartStock(items);
    if (!variantStockValidation.ok) {
      return NextResponse.json(
        { error: variantStockValidation.error },
        { status: 400 },
      );
    }

    const stockValidation = await validateCartStock(
      items.map((item) => ({
        ...item,
        id: String(item.productId || item.id),
      })),
    );
    if (!stockValidation.ok) {
      return NextResponse.json(
        { error: stockValidation.error },
        { status: 400 },
      );
    }

    const vendorGroups = new Map<string, CartItem[]>();
    const variants = await getVariantsForProducts(productIds);

    items.forEach((item) => {
      const productId = String(item.productId || item.id);
      const product = products.find((p) => p.id === productId);
      if (product) {
        if (!vendorGroups.has(product.vendorId)) {
          vendorGroups.set(product.vendorId, []);
        }
        vendorGroups.get(product.vendorId)!.push(item);
      }
    });

    const createdOrders = [];
    for (const [vendorId, vendorItems] of vendorGroups) {
      const vendorTotal = vendorItems.reduce((sum: number, item: CartItem) => {
        const product = products.find((p) => p.id === String(item.productId || item.id));
        const variant = variants.find((entry) => entry.id === item.variantId);
        return sum + (variant?.price || product?.price || 0) * item.quantity;
      }, 0);
      const order = await prisma.order.create({
        data: {
          userId: session.userId,
          vendorId,
          totalAmount: vendorTotal,
          paymentMethod: paymentMethod as any,
          status: 'PENDING',
          shippingName: customer?.name || null,
          shippingPhone: phone,
          shippingAddress: address,
          shippingCity: city,
          shippingState: state,
          shippingZipCode: zipCode,
          statusNote:
            paymentMethod === 'COD'
              ? 'COD order placed. Customer accepted COD terms. Cash will be collected before OTP delivery confirmation.'
              : paymentMethod === 'UPI'
                ? 'Order placed. Waiting for UPI payment confirmation.'
                : 'Order placed. Waiting for payment confirmation.',
          items: {
            create: vendorItems.map((item: CartItem) => {
              const product = products.find((p) => p.id === String(item.productId || item.id));
              const variant = variants.find((entry) => entry.id === item.variantId);
              return {
                productId: String(item.productId || item.id),
                variantId: item.variantId || null,
                sizeLabel:
                  item.sizeLabel ||
                  variants.find((variant) => variant.id === item.variantId)
                    ?.sizeLabel ||
                  null,
                numericSize:
                  item.numericSize ||
                  variants.find((variant) => variant.id === item.variantId)
                    ?.numericSize ||
                  null,
                variantColor:
                  item.color ||
                  variants.find((variant) => variant.id === item.variantId)
                    ?.color ||
                  null,
                variantSku:
                  item.sku ||
                  variants.find((variant) => variant.id === item.variantId)
                    ?.sku ||
                  null,
                quantity: item.quantity,
                price:
                  variant?.price ||
                  product?.price ||
                  0,
                mrp:
                  variant?.mrp ||
                  product?.mrp ||
                  product?.price ||
                  0,
                vendorPrice: product?.vendorPrice || product?.price || 0,
                platformCommissionAmount:
                  product?.platformCommissionAmount || 0,
                packagingCharge: product?.packagingCharge || 0,
                shippingCharge: product?.shippingCharge || 0,
                vendorPayout: product?.vendorPayout || product?.vendorPrice || 0,
              };
            }),
          },
        },
        include: { items: true },
      });
      createdOrders.push(order);
    }

    for (const createdOrder of createdOrders) {
      if (paymentMethod === 'COD') {
        await reduceStockForOrder(createdOrder.id);
      } else {
        await reserveStockForOrder(createdOrder.id);
      }
    }

    const order = createdOrders[0];
    const orderIds = createdOrders.map((createdOrder) => createdOrder.id);
    const orderAccessToken = signOrderAccessToken({
      type: 'order_access',
      userId: session.userId,
      orderIds,
    });
    const totalOrderAmount = createdOrders.reduce(
      (sum, createdOrder) => sum + createdOrder.totalAmount,
      0
    );
    const amountInPaise = Math.round(totalOrderAmount * 100);

    if (paymentMethod === 'RAZORPAY' && amountInPaise < 100) {
      return NextResponse.json(
        { error: 'Razorpay minimum payment amount is Rs. 1.00.' },
        { status: 400 }
      );
    }

    if (paymentMethod === 'COD') {
      await notifyOrderPlaced(orderIds, 'COD order');

      return NextResponse.json(
        {
          orderId: order.id,
          orderIds,
          orderAccessToken,
          paymentMethod,
          orderPlaced: true,
          message: 'COD order placed. Payment will be collected on delivery.',
        },
        { status: 201 }
      );
    }

    if (paymentMethod === 'UPI') {
      await notifyOrderPlaced(orderIds, 'UPI order');

      return NextResponse.json(
        {
          orderId: order.id,
          orderIds,
          orderAccessToken,
          paymentMethod,
          orderPlaced: true,
          upiId: merchantUpiId,
          amount: totalOrderAmount,
          message: 'UPI order placed. Confirm payment from the order page after transfer.',
        },
        { status: 201 }
      );
    }

    if (paymentMethod === 'RAZORPAY') {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpaySecret,
      });

      let razorpayOrder;
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: order.id,
          payment_capture: true,
          notes: {
            orderId: order.id,
            orderIds: orderIds.join(','),
          },
        });
      } catch (error: any) {
        console.error('Razorpay order creation failed:', error);
        await cancelPendingOnlineOrders(
          orderIds,
          'Razorpay order could not be created. Stock reservation released.',
        );
        return NextResponse.json(
          {
            errorCode:
              error?.statusCode === 401
                ? 'RAZORPAY_AUTH_FAILED'
                : 'RAZORPAY_ORDER_CREATE_FAILED',
            error:
              error?.statusCode === 401
                ? 'Razorpay authentication failed. Please check key ID and secret.'
                : 'Could not create Razorpay order. Please try again.',
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          orderId: order.id,
          orderIds,
          orderAccessToken,
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
      if (!stripeSecretKey) {
        return NextResponse.json({ error: 'Stripe credentials are not configured' }, { status: 500 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });

      let session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          success_url: `${baseUrl}/order/${order.id}?placed=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/cart`,
          metadata: {
            orderId: order.id,
            orderIds: orderIds.join(','),
          },
          line_items: items.map((item: CartItem) => {
            const product = products.find((p) => p.id === String(item.productId || item.id));
            const variant = variants.find((entry) => entry.id === item.variantId);

            return {
              price_data: {
                currency: 'INR',
                product_data: {
                  name: product?.name || item.name,
                },
                unit_amount: Math.round((variant?.price || product?.price || 0) * 100),
              },
              quantity: item.quantity,
            };
          }),
        });
      } catch (error) {
        console.error('Stripe checkout session creation failed:', error);
        await cancelPendingOnlineOrders(
          orderIds,
          'Stripe checkout could not be created. Stock reservation released.',
        );
        return NextResponse.json(
          { error: 'Could not create Stripe checkout. Please try again.' },
          { status: 502 },
        );
      }

      return NextResponse.json(
        {
          orderId: order.id,
          orderIds,
          orderAccessToken,
          paymentMethod,
          paymentUrl: session.url,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderIds,
        orderAccessToken,
        paymentMethod,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
