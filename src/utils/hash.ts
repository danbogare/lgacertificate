import { hash as bcryptHash, compare as bcryptCompare, genSalt as bcryptGenSalt } from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/app';

export const hash = async (value: string): Promise<string> => {
    const salt = await bcryptGenSalt(10);
    return bcryptHash(value, salt);
}

export const compareHash = (value: string, hash: string): Promise<boolean> => {
    return bcryptCompare(value, hash);
}

export const generateRandomString = (length: number): string => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const generateTransactionRef = (): string => {
  const currentDate = new Date();
  const stringDate = currentDate.toISOString();
  const formatString = stringDate.replace(/[-:.]/g, '');
  const transactionRef = `TXN${generateRandomString(6)}${formatString}`;
  return transactionRef;
};

export const generateRandomPassword = (length: number = 8): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export const generateCertificateRef = (length: number): string => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return `OGLGA${result}`;
};

// Validate date format YYYY-MM-DD
export const isValidDateFormat = (dateStr: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateStr);
}

export const formatDateTimeForFilename = (date: Date): string => {
  if (!date) return "N/A";

  const iso = date.toISOString().replace("Z", "");
  const [datePart, timePart] = iso.split("T");

  return `${datePart}_${timePart.split(".")[0].replace(/:/g, "-")}`;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const generateCertificateHash = (payload: {
  certificateRef: string;
  applicationId: string;
  userId: string;
}): string => {
  const data = `${payload.certificateRef}|${payload.applicationId}|${payload.userId}`;
  const secret = config.app.CERTIFICATE_SECRET ?? "";
  if (secret === "") {
    throw new Error("Certificate secret is not set");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
};