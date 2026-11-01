export const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export const otpExpiryDate = (): Date => new Date(Date.now() + OTP_TTL_MS);

// The OTP was sent OTP_TTL_MS before it expires, so the expiry date tells us when it went out
export const isWithinResendCooldown = (expiresAt?: Date | null): boolean => {
  if (!expiresAt) return false;
  const sentAt = expiresAt.getTime() - OTP_TTL_MS;
  return Date.now() - sentAt < RESEND_COOLDOWN_MS;
};

export const isOtpExpired = (expiresAt?: Date | null): boolean => !expiresAt || expiresAt < new Date();
