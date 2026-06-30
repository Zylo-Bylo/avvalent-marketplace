type SmsResult = {
  sent: boolean;
  provider: string | null;
  error?: string;
};

function cleanMobile(value: string) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function getSmsProvider() {
  return String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
}

export function hasSmsProvider() {
  const provider = getSmsProvider();
  if (provider === 'fast2sms') {
    return Boolean(process.env.FAST2SMS_API_KEY);
  }
  if (provider === 'twilio') {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER,
    );
  }
  if (provider === 'generic') {
    return Boolean(process.env.SMS_WEBHOOK_URL);
  }
  return false;
}

export async function sendSms(input: {
  to: string;
  message: string;
  otp?: string;
  purpose?: string;
}): Promise<SmsResult> {
  const mobile = cleanMobile(input.to);
  const provider = getSmsProvider();

  if (!mobile || mobile.length !== 10) {
    return { sent: false, provider: provider || null, error: 'Invalid mobile number.' };
  }

  if (!hasSmsProvider()) {
    return { sent: false, provider: provider || null, error: 'SMS gateway is not configured.' };
  }

  if (provider === 'fast2sms') {
    const route = String(process.env.FAST2SMS_ROUTE || 'otp').trim() || 'otp';
    const payload =
      route === 'otp'
        ? {
            route,
            variables_values: input.otp || '',
            numbers: mobile,
          }
        : {
            route,
            message: input.message,
            language: 'english',
            flash: 0,
            numbers: mobile,
          };
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: process.env.FAST2SMS_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        sent: false,
        provider,
        error: `Fast2SMS failed with status ${response.status}: ${responseText.slice(0, 180)}`,
      };
    }

    try {
      const data = JSON.parse(responseText) as { return?: boolean; message?: string | string[] };
      if (data.return === false) {
        const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        return {
          sent: false,
          provider,
          error: message || 'Fast2SMS did not accept the SMS request.',
        };
      }
    } catch {
      // Some providers return plain text on success.
    }

    return { sent: true, provider };
  }

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const from = process.env.TWILIO_FROM_NUMBER || '';
    const body = new URLSearchParams({
      To: `+91${mobile}`,
      From: from,
      Body: input.message,
    });
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      return {
        sent: false,
        provider,
        error: `Twilio failed with status ${response.status}.`,
      };
    }

    return { sent: true, provider };
  }

  const response = await fetch(process.env.SMS_WEBHOOK_URL || '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SMS_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify({
      to: `+91${mobile}`,
      message: input.message,
      purpose: input.purpose || 'otp',
    }),
  });

  if (!response.ok) {
    return {
      sent: false,
      provider: 'generic',
      error: `SMS webhook failed with status ${response.status}.`,
    };
  }

  return { sent: true, provider: 'generic' };
}
