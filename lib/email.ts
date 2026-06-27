type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

type OtpEmailInput = {
  to: string;
  otp: string;
  purpose?: string;
};

type VendorStatusEmailInput = {
  to: string;
  storeName: string;
  status: 'APPROVED' | 'REJECTED' | 'INACTIVE' | 'PENDING';
  rejectionReason?: string | null;
};

type OrderEmailItem = {
  name: string;
  quantity: number;
  price: number;
};

type OrderConfirmationEmailInput = {
  to: string;
  customerName?: string | null;
  orderId: string;
  totalAmount: number;
  paymentMethod: string;
  orderUrl: string;
  items: OrderEmailItem[];
  status?: string;
};

export function hasPasswordResetEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}

export const hasEmailProvider = hasPasswordResetEmailProvider;

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!hasPasswordResetEmailProvider()) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed: ${errorText}`);
  }

  return true;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: PasswordResetEmailInput) {
  return sendEmail({
    to,
    subject: "Reset your Zylo-Buylo password",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1 style="font-size:20px">Reset your password</h1>
        <p>Use the secure link below to reset your Zylo-Buylo password. This link expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#db2777;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">Reset password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendOtpEmail({
  to,
  otp,
  purpose = 'verify your Zylo-Buylo account',
}: OtpEmailInput) {
  return sendEmail({
    to,
    subject: "Your Zylo-Buylo OTP",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1 style="font-size:20px">Your verification code</h1>
        <p>Use this OTP to ${purpose}. It expires in 15 minutes.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendVendorStatusEmail({
  to,
  storeName,
  status,
  rejectionReason,
}: VendorStatusEmailInput) {
  const approved = status === 'APPROVED';
  const rejected = status === 'REJECTED';
  const subject = approved
    ? "Your Zylo-Buylo vendor account is approved"
    : rejected
      ? "Your Zylo-Buylo vendor account needs attention"
      : "Your Zylo-Buylo vendor account status changed";

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1 style="font-size:20px">Vendor status updated</h1>
        <p>Your vendor store <strong>${storeName}</strong> is now <strong>${status}</strong>.</p>
        ${
          rejectionReason
            ? `<p><strong>Reason:</strong> ${rejectionReason}</p>`
            : ''
        }
        ${
          approved
            ? '<p>You can now login and upload products from your vendor dashboard.</p>'
            : ''
        }
      </div>
    `,
  });
}

export async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderId,
  totalAmount,
  paymentMethod,
  orderUrl,
  items,
  status = 'PENDING',
}: OrderConfirmationEmailInput) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb">${item.name}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `,
    )
    .join('');

  return sendEmail({
    to,
    subject: `Your Zylo-Buylo order #${orderId.slice(-8)} is confirmed`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1 style="font-size:22px;margin-bottom:8px">Thank you for shopping with Zylo-Buylo</h1>
        <p>Hello ${customerName || 'Customer'}, your order has been placed successfully.</p>
        <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:10px;padding:14px;margin:18px 0">
          <p style="margin:0"><strong>Order:</strong> #${orderId.slice(-8)}</p>
          <p style="margin:6px 0 0"><strong>Status:</strong> ${status}</p>
          <p style="margin:6px 0 0"><strong>Payment:</strong> ${paymentMethod}</p>
          <p style="margin:6px 0 0"><strong>Total:</strong> Rs. ${Number(totalAmount || 0).toFixed(2)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px;text-align:left">Product</th>
              <th style="padding:10px;text-align:center">Qty</th>
              <th style="padding:10px;text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p><a href="${orderUrl}" style="display:inline-block;background:#db2777;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">Track your order</a></p>
        <p style="color:#6b7280;font-size:13px">We will update your order page when the vendor ships and delivers your order.</p>
      </div>
    `,
  });
}
