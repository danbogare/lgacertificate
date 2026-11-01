import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ITokenPayload } from "../interfaces/auth.interface";

export interface ICertificateHashPayload {
  certificateRef: string;
  applicationId: string;
  userId: string;
}

export interface ICryptoService {
  hash(value: string): Promise<string>;
  compareHash(value: string, hash: string): Promise<boolean>;
  generateToken(payload: ITokenPayload): string;
  verifyToken(token: string): ITokenPayload;
  generateOTP(): string;
  generateRandomString(length: number): string;
  generateRandomPassword(length?: number): string;
  generateTransactionRef(): string;
  generateCertificateHash(payload: ICertificateHashPayload): string;
}

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PASSWORD_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";

export class CryptoService implements ICryptoService {
  private readonly saltRounds = 10;

  constructor(
    private readonly jwtSecret: string,
    private readonly certificateSecret: string
  ) {}

  public async hash(value: string): Promise<string> {
    return await bcrypt.hash(value, this.saltRounds);
  }

  public async compareHash(value: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(value, hash);
  }

  public generateToken(payload: ITokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: "7d" });
  }

  public verifyToken(token: string): ITokenPayload {
    return jwt.verify(token, this.jwtSecret) as ITokenPayload;
  }

  public generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  public generateRandomString(length: number): string {
    return this.randomFrom(ALPHANUMERIC, length);
  }

  public generateRandomPassword(length: number = 8): string {
    return this.randomFrom(PASSWORD_CHARSET, length);
  }

  // e.g. TXNa1B2c320261101T134509123Z
  public generateTransactionRef(): string {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    return `TXN${this.generateRandomString(6)}${timestamp}`;
  }

  public generateCertificateHash(payload: ICertificateHashPayload): string {
    if (!this.certificateSecret) {
      throw new Error("Certificate secret is not set");
    }
    const data = `${payload.certificateRef}|${payload.applicationId}|${payload.userId}`;
    return crypto.createHmac("sha256", this.certificateSecret).update(data).digest("hex");
  }

  private randomFrom(charset: string, length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset.charAt(crypto.randomInt(charset.length));
    }
    return result;
  }
}
