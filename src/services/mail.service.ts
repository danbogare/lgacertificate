import nodemailer, { Transporter } from "nodemailer";
import { ISMTPConfig } from "../config/env";
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

export class MailService implements IMailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ISMTPConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: false },
    });
    this.from = `${config.fromName} <${config.user}>`;
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
      .then(({ html, attachments }) =>
        this.transporter.sendMail({ from: this.from, to, subject, text: html, html, attachments })
      )
      .then((info) => console.info("Message sent: %s", info.response))
      .catch((error) => console.error(`Failed to send "${subject}" email:`, error));
  }
}
