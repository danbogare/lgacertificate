import EventEmitter from 'events';
import { sendEmail } from './emailSender';
import { forgotPasswordTemp } from '../templates/forgotPasswordTemp';
import { createAdminTemp } from '../templates/createAdminTemp';
import { verifyEmailTemp } from '../templates/verifyEmailTemp';
import { successfulApplicationTemp } from '../templates/successfulApplicationTemp';
import { applicationApprovedTemp } from '../templates/applicationApprovedTemp';
import { applicationRejectedTemp } from '../templates/applicationRejectedTemp';
import { certificateVerificationCodeTemp } from '../templates/certificateVerificationCodeTemp';
import { generateCSVApplicationReport } from './generateCSVApplicationReport';
import { IApplication } from '../../models/applicationModel';
import { reportTemp } from '../templates/reportTemp';

const emitter = new EventEmitter();

emitter.on('forgot-password', async (data: { email: string; otp: string; name: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Forgot Password',
    message: await forgotPasswordTemp(data.email, data.otp, data.name),
  });
});

emitter.on('verify-email', async (data: { email: string; otp: string; name: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Email Verification',
    message: await verifyEmailTemp(data.otp, data.name),
  });
});

emitter.on('send-admin-invitation', async (data: { email: string; name: string, password: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Invitation to join LGA Certificate Proj',
    message: await createAdminTemp(data.email, data.name, data.password),
  });
});

emitter.on('application-awaiting-approval', async (data: { email: string; name: string, applicationID: string }) => {  
  await sendEmail({
    email: data.email,
    subject: 'Application Awaiting Approval',
    message: await successfulApplicationTemp(data.name, data.applicationID),
  });
});

emitter.on('application-approved', async (data: { email: string; name: string, applicationID: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Application Approved',
    message: await applicationApprovedTemp(data.name, data.applicationID),
  });
});

emitter.on('application-rejected', async (data: { email: string; name: string, applicationID: string, rejectionReason: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Application Rejected',
    message: await applicationRejectedTemp(data.name, data.applicationID, data.rejectionReason),
  });
});

emitter.on('certificate-verification', async (data: { email: string; name: string, verificationCode: string }) => {
  await sendEmail({
    email: data.email,
    subject: 'Cerificate Verification Code Generated',
    message: await certificateVerificationCodeTemp(data.name, data.verificationCode),
  });
});

emitter.on(
  "send-application-report",
  async (data: {
    email: string;
    applications: IApplication[];
    nameOfFile: string;
  }) => {

    const csvBuffer = await generateCSVApplicationReport(data.applications);
    const fileName = `${data.nameOfFile}.csv`;

    await sendEmail({
      email: data.email,
      subject: "Application Report",
      message: await reportTemp(),
      attachments: [
        {
          filename: fileName,
          content: csvBuffer,
          type: "text/csv",
          disposition: "attachment",
        },
      ],
    });
  }
);


export default emitter;