export function buildUpiPaymentUri(input: {
  upiId: string;
  payeeName?: string | null;
  amount?: number | null;
  note?: string | null;
}) {
  const params = new URLSearchParams({
    pa: input.upiId.trim(),
    pn: input.payeeName?.trim() || 'Zylo-Buylo',
    cu: 'INR',
  });

  if (typeof input.amount === 'number' && Number.isFinite(input.amount) && input.amount > 0) {
    params.set('am', input.amount.toFixed(2));
  }

  if (input.note?.trim()) {
    params.set('tn', input.note.trim());
  }

  return `upi://pay?${params.toString()}`;
}

export function qrCodeUrl(value: string, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&ecc=M&data=${encodeURIComponent(value)}`;
}
