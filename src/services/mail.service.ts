import axios from "axios";
import nodemailer, { Transporter } from "nodemailer";
import { ISMTPConfig, ISmtp2goConfig } from "../config/env";
import { IApplication } from "../models/application.model";
import { generateApplicationReportCsv } from "../utils/csv-report";
import { forgotPasswordTemplate } from "../templates/forgot-password.template";
import { emailVerificationTemplate } from "../templates/email-verification.template";
import { adminInviteTemplate } from "../templates/admin-invite.template";
import { applicationAwaitingApprovalTemplate } from "../templates/application-awaiting-approval.template";
import { applicationApprovedTemplate } from "../templates/application-approved.template";
import { applicationRejectedTemplate } from "../templates/application-rejected.template";
import { certificateVerificationCodeTemplate } from "../templates/certificate-verification-code.template";
import { applicationReportTemplate } from "../templates/application-report.template";

interface IMailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  contentDisposition?: "attachment" | "inline";
}

interface IMailContent {
  html: string;
  attachments?: IMailAttachment[];
}

interface IOutgoingMail extends IMailContent {
  to: string;
  subject: string;
}

type MailSender = (mail: IOutgoingMail) => Promise<string>;

const SMTP2GO_TIMEOUT_MS = 15_000;
const MAIL_NOT_CONFIGURED =
  "Email is not configured: set SMTP2GO_KEY, or SMTP_HOST, SMTP_USER_EMAIL and SMTP_PASSWORD";

// Every method sends in the background and only logs failures, so a slow or broken
// mail server never fails or delays the request that triggered the email.
export interface IMailService {
  sendForgotPasswordEmail(email: string, otp: string, name: string): void;
  sendEmailVerificationEmail(email: string, otp: string, name: string): void;
  sendAdminInviteEmail(email: string, name: string, password: string): void;
  sendApplicationAwaitingApprovalEmail(email: string, name: string, applicationId: string): void;
  sendApplicationApprovedEmail(email: string, name: string, applicationId: string): void;
  sendApplicationRejectedEmail(email: string, name: string, applicationId: string, rejectionReason: string): void;
  sendCertificateVerificationEmail(email: string, name: string, verificationCode: string): void;
  sendApplicationReportEmail(email: string, applications: IApplication[], fileName: string): void;
}

// Sends through the SMTP2GO API when its key is set, otherwise through SMTP. With neither configured,
// every send fails with an error saying so.
export class MailService implements IMailService {
  private readonly send: MailSender;

  constructor(smtpConfig: ISMTPConfig, smtp2goConfig: ISmtp2goConfig) {
    if (smtp2goConfig.apiKey) {
      this.send = this.createSmtp2goSender(smtp2goConfig);
    } else if (smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
      this.send = this.createSmtpSender(smtpConfig);
    } else {
      console.warn(MAIL_NOT_CONFIGURED);
      this.send = async () => {
        throw new Error(MAIL_NOT_CONFIGURED);
      };
    }
  }

  public sendForgotPasswordEmail(email: string, otp: string, name: string): void {
    this.dispatch(email, "Forgot Password", async () => ({
      html: await forgotPasswordTemplate(email, otp, name),
    }));
  }

  public sendEmailVerificationEmail(email: string, otp: string, name: string): void {
    this.dispatch(email, "Email Verification", async () => ({
      html: await emailVerificationTemplate(otp, name),
    }));
  }

  public sendAdminInviteEmail(email: string, name: string, password: string): void {
    this.dispatch(email, "Invitation to join LGA Certificate Proj", async () => ({
      html: await adminInviteTemplate(email, name, password),
    }));
  }

  public sendApplicationAwaitingApprovalEmail(email: string, name: string, applicationId: string): void {
    this.dispatch(email, "Application Awaiting Approval", async () => ({
      html: await applicationAwaitingApprovalTemplate(name, applicationId),
    }));
  }

  public sendApplicationApprovedEmail(email: string, name: string, applicationId: string): void {
    this.dispatch(email, "Application Approved", async () => ({
      html: await applicationApprovedTemplate(name, applicationId),
    }));
  }

  public sendApplicationRejectedEmail(email: string, name: string, applicationId: string, rejectionReason: string): void {
    this.dispatch(email, "Application Rejected", async () => ({
      html: await applicationRejectedTemplate(name, applicationId, rejectionReason),
    }));
  }

  public sendCertificateVerificationEmail(email: string, name: string, verificationCode: string): void {
    this.dispatch(email, "Cerificate Verification Code Generated", async () => ({
      html: await certificateVerificationCodeTemplate(name, verificationCode),
    }));
  }

  public sendApplicationReportEmail(email: string, applications: IApplication[], fileName: string): void {
    this.dispatch(email, "Application Report", async () => ({
      html: await applicationReportTemplate(),
      attachments: [
        {
          filename: fileName,
          content: await generateApplicationReportCsv(applications),
          contentType: "text/csv",
          contentDisposition: "attachment",
        },
      ],
    }));
  }

  private dispatch(to: string, subject: string, buildContent: () => Promise<IMailContent>): void {
    buildContent()
      .then((content) => this.send({ ...content, to, subject }))
      .then((result) => console.info("Message sent: %s", result))
      .catch((error) => console.error(`Failed to send "${subject}" email:`, error));
  }

  private createSmtpSender(config: ISMTPConfig): MailSender {
    const transporter: Transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: false },
    });
    const from = `${config.fromName} <${config.user}>`;

    return async ({ to, subject, html, attachments }) => {
      const info = await transporter.sendMail({ from, to, subject, text: html, html, attachments });
      return info.response;
    };
  }

  // Called with axios directly rather than the shared HttpClient, which would store the email body
  // (OTPs, invite passwords) in request dumps.
  private createSmtp2goSender(config: ISmtp2goConfig): MailSender {
    const sender = config.fromName ? `${config.fromName} <${config.senderEmail}>` : config.senderEmail;

    return async ({ to, subject, html, attachments }) => {
      const payload = {
        sender,
        to: [to],
        subject,
        html_body: html,
        attachments: attachments?.map((attachment) => ({
          filename: attachment.filename,
          fileblob: attachment.content.toString("base64"),
          mimetype: attachment.contentType,
        })),
      };

      let data;
      try {
        const response = await axios.post(`${config.apiUrl}/email/send`, payload, {
          headers: { "X-Smtp2go-Api-Key": config.apiKey, "Content-Type": "application/json" },
          timeout: SMTP2GO_TIMEOUT_MS,
        });
        data = response.data?.data;
      } catch (error) {
        // Rethrown without the axios error, whose request config holds the API key
        const reason = axios.isAxiosError(error) ? (error.response?.data?.data?.error ?? error.message) : error;
        throw new Error(`SMTP2GO request failed: ${reason}`);
      }

      // SMTP2GO can answer 200 even when the email was not accepted
      if (!data?.succeeded) {
        throw new Error(`SMTP2GO did not accept the email: ${JSON.stringify(data?.failures ?? data)}`);
      }
      return `SMTP2GO email ${data.email_id}`;
    };
  }
}
