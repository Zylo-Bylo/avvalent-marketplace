type WhatsAppOrderInput = {
  to: string;
  customerName?: string | null;
  orderId: string;
  totalAmount: number;
};

function normalizeIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

export function hasWhatsAppProvider() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ORDER_TEMPLATE,
  );
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
        to: normalizeIndianPhone(to),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_ORDER_TEMPLATE,
          language: {
            code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customerName || 'Customer' },
                { type: 'text', text: `#${orderId.slice(-8)}` },
                { type: 'text', text: `Rs. ${Number(totalAmount || 0).toFixed(2)}` },
              ],
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
