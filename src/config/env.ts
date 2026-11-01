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

export interface ICloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface IFlutterwaveConfig {
  uri: string;
  secret: string;
}

export interface IPartnerConfig {
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  webhookSecret: string;
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
  superAdmin: ISuperAdminSeedConfig;
  smtp: ISMTPConfig;
  cloudinary: ICloudinaryConfig;
  flutterwave: IFlutterwaveConfig;
  partner: IPartnerConfig;
}

// Hop count of trusted proxies; falls back to the default when unset or not a non-negative integer.
function parseTrustProxy(value: string | undefined, fallback: number): number {
  const hops = Number(value);
  return value !== undefined && Number.isInteger(hops) && hops >= 0 ? hops : fallback;
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
  applicationAmount: 10000,
  certificateAmount: 500,
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
    webhookSecret: process.env.PARTNER_SECRET ?? "",
  },
};
