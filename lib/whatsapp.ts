type WhatsAppOrderInput = {
  to: string;
  customerName?: string | null;
  orderId: string;
  totalAmount: number;
};

type WhatsAppVendorOrderInput = {
  to: string;
  vendorName?: string | null;
  orderId: string;
  totalAmount: number;
  itemSummary: string;
  orderUrl: string;
};

function normalizeIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function getWhatsAppProviderReady(templateName?: string) {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      templateName,
  );
}

async function sendWhatsAppTemplate(input: {
  to: string;
  templateName: string;
  parameters: string[];
}) {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeIndianPhone(input.to),
        type: 'template',
        template: {
          name: input.templateName,
          language: {
            code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: input.parameters.map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp notification failed: ${errorText}`);
  }

  return true;
}

export function hasWhatsAppProvider() {
  return getWhatsAppProviderReady(process.env.WHATSAPP_ORDER_TEMPLATE);
}

export function hasVendorWhatsAppProvider() {
  return getWhatsAppProviderReady(process.env.WHATSAPP_VENDOR_ORDER_TEMPLATE);
}

export async function sendOrderWhatsAppNotification({
  to,
  customerName,
  orderId,
  totalAmount,
}: WhatsAppOrderInput) {
  if (!hasWhatsAppProvider()) {
    return false;
  }

  return sendWhatsAppTemplate({
    to,
    templateName: process.env.WHATSAPP_ORDER_TEMPLATE as string,
    parameters: [
      customerName || 'Customer',
      `#${orderId.slice(-8)}`,
      `Rs. ${Number(totalAmount || 0).toFixed(2)}`,
    ],
  });
}

export async function sendVendorOrderWhatsAppNotification({
  to,
  vendorName,
  orderId,
  totalAmount,
  itemSummary,
  orderUrl,
}: WhatsAppVendorOrderInput) {
  const templateName = process.env.WHATSAPP_VENDOR_ORDER_TEMPLATE;

  if (!getWhatsAppProviderReady(templateName)) {
    return false;
  }

  return sendWhatsAppTemplate({
    to,
    templateName: templateName as string,
    parameters: [
      vendorName || 'Vendor',
      `#${orderId.slice(-8)}`,
      `Rs. ${Number(totalAmount || 0).toFixed(2)}`,
      itemSummary || 'New order items',
      orderUrl,
    ],
  });
}
