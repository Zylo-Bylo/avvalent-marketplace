import crypto from 'crypto';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateStrongPassword(password: string) {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('one special character');
  }

  return {
    valid: errors.length === 0,
    message: errors.length
      ? `Password must contain ${errors.join(', ')}.`
      : '',
  };
}

export function createOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export function createSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
