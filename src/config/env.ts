import dotenv from "dotenv";

dotenv.config();

export interface ISuperAdminSeedConfig {
  name?: string;
  email?: string;
  password?: string;
}

export interface ISMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
}

export interface ISmtp2goConfig {
  apiKey: string;
  apiUrl: string;
  // Must be a sender verified on the SMTP2GO account
  senderEmail: string;
  fromName: string;
}

export interface ICloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface IFlutterwaveConfig {
  uri: string;
  secret: string;
}

// Processing charge passed on to the payer. rate and vat are fractions (0.02 = 2%).
// cap limits the charge before VAT, if set; vat is charged on top of the gateway's fee.
export interface IProcessingChargeConfig {
  rate: number;
  flat: number;
  cap?: number;
  vat: number;
}

export interface IPartnerConfig {
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  webhookSecret: string;
  // How long a dynamic account stays payable (the partner gives 5 hours), plus extra time for a late webhook
  paymentWindowMinutes: number;
  paymentGraceMinutes: number;
}

interface EnvConfig {
  nodeEnv: string;
  port: number;
  apiUrl: string;
  frontendUrl: string;
  mongoUri: string;
  jwtSecret: string;
  certificateSecret: string;
  trustProxy: number;
  applicationAmount: number;
  certificateAmount: number;
  processingCharges: {
    flutterwave: IProcessingChargeConfig;
    partner: IProcessingChargeConfig;
  };
  superAdmin: ISuperAdminSeedConfig;
  smtp: ISMTPConfig;
  smtp2go: ISmtp2goConfig;
  cloudinary: ICloudinaryConfig;
  flutterwave: IFlutterwaveConfig;
  partner: IPartnerConfig;
}

// Hop count of trusted proxies; falls back to the default when unset or not a non-negative integer.
function parseTrustProxy(value: string | undefined, fallback: number): number {
  const hops = Number(value);
  return value !== undefined && Number.isInteger(hops) && hops >= 0 ? hops : fallback;
}

// Non-negative number from the env, or the fallback when unset or invalid.
function parseNonNegative(value: string | undefined, fallback: number): number;
function parseNonNegative(value: string | undefined, fallback: undefined): number | undefined;
function parseNonNegative(value: string | undefined, fallback: number | undefined): number | undefined {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// Reads a required env var or throws immediately.
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiUrl: process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  frontendUrl: process.env.FRONT_END_URL ?? "",
  mongoUri: requireEnv("MONGO_URI"),
  jwtSecret: requireEnv("JWT_SECRET"),
  // Checked when a certificate hash is generated, so a missing value fails approvals rather than boot
  certificateSecret: process.env.CERTIFICATE_SECRET ?? "",
  // Number of reverse proxies in front of the app. Heroku sets DYNO and always routes through one proxy.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, process.env.DYNO || process.env.NODE_ENV === "production" ? 1 : 0),
  applicationAmount: 2000,
  certificateAmount: 500,
  // Gateway charges are added on top of the amounts above so the payer bears them
  processingCharges: {
    flutterwave: {
      rate: parseNonNegative(process.env.FLW_CHARGE_PERCENT, 2) / 100,
      flat: parseNonNegative(process.env.FLW_CHARGE_FLAT, 0),
      cap: parseNonNegative(process.env.FLW_CHARGE_CAP, 2000),
      vat: parseNonNegative(process.env.FLW_CHARGE_VAT_PERCENT, 7.5) / 100,
    },
    partner: {
      rate: parseNonNegative(process.env.PARTNER_CHARGE_PERCENT, 0) / 100,
      flat: parseNonNegative(process.env.PARTNER_CHARGE_FLAT, 15),
      cap: parseNonNegative(process.env.PARTNER_CHARGE_CAP, undefined),
      vat: parseNonNegative(process.env.PARTNER_CHARGE_VAT_PERCENT, 0) / 100,
    },
  },
  superAdmin: {
    name: process.env.APP_ADMIN_NAME,
    email: process.env.APP_ADMIN_EMAIL,
    password: process.env.APP_ADMIN_PASSWORD,
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: 465,
    user: process.env.SMTP_USER_EMAIL ?? "",
    pass: process.env.SMTP_PASSWORD ?? "",
    fromName: process.env.SMTP_FROM_NAME ?? "",
  },
  // Preferred over SMTP whenever the API key is set
  smtp2go: {
    apiKey: process.env.SMTP2GO_KEY ?? "",
    apiUrl: process.env.SMTP2GO_API_URL || "https://api.smtp2go.com/v3",
    senderEmail: process.env.SMTP2GO_SENDER_EMAIL || process.env.SMTP_USER_EMAIL || "",
    fromName: process.env.SMTP_FROM_NAME ?? "",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  flutterwave: {
    uri: process.env.FLW_URI ?? "",
    secret: process.env.FLW_SECRET ?? "",
  },
  partner: {
    baseUrl: process.env.PARTNER_BASE_URL ?? "",
    apiKey: process.env.PARTNER_API_KEY ?? "",
    merchantId: process.env.PARTNER_MERCHANT_ID ?? "",
    webhookSecret: process.env.PARTNER_API_SECRET ?? "",
    paymentWindowMinutes: parseNonNegative(process.env.PARTNER_PAYMENT_WINDOW_MINUTES, 300),
    paymentGraceMinutes: parseNonNegative(process.env.PARTNER_PAYMENT_GRACE_MINUTES, 2),
  },
};
