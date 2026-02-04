export const applicationRejectedTemp = async (name: string, applicationId: string, rejectionReason: string) => {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Rejected</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
              <td style="padding: 20px 0; text-align: center;">
                  <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-collapse: collapse;">
                      
                      <!-- Header with Ogun State Colors -->
                      <tr>
                          <td style="background: linear-gradient(135deg, #1a7f3e 0%, #0d5f2e 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; border-top: 4px solid #d4af37;">
                              <img src="cid:ogun_logo" alt="Ogun State Logo" style="width: 80px; height: 80px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Application Rejected!</h1>
                              <p style="margin: 10px 0 0; color: #d4af37; font-size: 14px; font-weight: 500;">Ogun State Government</p>
                          </td>
                      </tr>
                      
                      <!-- Success Icon -->
                      <tr>
                          <td style="padding: 30px 30px 20px; text-align: center;">
                              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #1a7f3e 0%, #0d5f2e 100%); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; border: 3px solid #d4af37;">
                                  <span style="color: #ffffff; font-size: 40px; line-height: 80px;">✓</span>
                              </div>
                          </td>
                      </tr>
                      
                      <!-- Main Content -->
                      <tr>
                          <td style="padding: 0 30px 30px;">
                              <h2 style="color: #1a7f3e; font-size: 24px; margin: 0 0 20px; text-align: center;">Your Application Has Been Rejected</h2>
                              
                              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                  Dear <strong>${name}</strong>,
                              </p>
                              
                              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                  Your application for <strong>LGA Certificate</strong> has been rejected and status has been changed to rejected, you can check on your dashboard.
                              </p>
                              
                              <!-- Application Details Box -->
                              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; border-collapse: collapse; margin: 20px 0; border-left: 4px solid #d4af37;">
                                  <tr>
                                      <td style="padding: 20px;">
                                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                              <tr>
                                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                                                      <strong>Application ID:</strong>
                                                  </td>
                                                  <td style="padding: 8px 0; color: #1a7f3e; font-size: 14px; text-align: right; font-weight: 600;">
                                                      ${applicationId}
                                                  </td>
                                              </tr>
                                              <tr>
                                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                                                      <strong>Certificate Type:</strong>
                                                  </td>
                                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">
                                                      LGA Certificate
                                                  </td>
                                              </tr>
                                              <tr>
                                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                                                      <strong>Rejection Date:</strong>
                                                  </td>
                                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">
                                                      ${new Date().toLocaleDateString("en-US", {year: "numeric", month: "long", day: "numeric", })}
                                                  </td>
                                              </tr>
                                              <tr>
                                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                                                      <strong>Rejection Time:</strong>
                                                  </td>
                                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">
                                                      ${new Date().toLocaleTimeString("en-US", {hour: "numeric", minute: "numeric", hour12: true, })}
                                                  </td>
                                              </tr>
                                              <tr>
                                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                                                      <strong>Status:</strong>
                                                  </td>
                                                  <td style="padding: 8px 0; text-align: right;">
                                                      <span style="display: inline-block; padding: 4px 12px; background-color: #fff4d4; color: #856404; border-radius: 12px; font-size: 13px; font-weight: 600;">Rejected</span>
                                                  </td>
                                              </tr>
                                          </table>
                                      </td>
                                  </tr>
                              </table>
                              
                              <!-- What's Next Section -->
                              <table role="presentation" style="width: 100%; background-color: #f0f8f4; border-left: 4px solid #1a7f3e; border-radius: 4px; border-collapse: collapse; margin: 25px 0;">
                                  <tr>
                                      <td style="padding: 20px;">
                                          <h3 style="color: #1a7f3e; font-size: 16px; margin: 0 0 10px;">📋 The Reason for Rejection:</h3>
                                          <p style="color: #0d5f2e; font-size: 14px; line-height: 1.6; margin: 0;">
                                              ${rejectionReason}
                                          </p>
                                      </td>
                                  </tr>
                              </table>
                              
                              <!-- Call to Action Button -->
                              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                  <tr>
                                      <td style="text-align: center;">
                                          <a href="{{trackingLink}}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #1a7f3e 0%, #0d5f2e 100%); color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: 600; border: 2px solid #d4af37;">Track Application Status</a>
                                      </td>
                                  </tr>
                              </table>
                              
                              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                                  Please keep your Application ID safe for future reference. If you have any questions about your application, feel free to contact our support team.
                              </p>
                          </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                          <td style="padding: 30px; background: linear-gradient(to right, #f8f9fa 0%, #f0f8f4 100%); border-radius: 0 0 8px 8px; text-align: center; border-top: 3px solid #d4af37;">
                              <p style="color: #1a7f3e; font-size: 14px; margin: 0 0 10px; line-height: 1.6; font-weight: 600;">
                                  Ogun State Government
                              </p>
                              <p style="color: #666666; font-size: 14px; margin: 0 0 10px; line-height: 1.6;">
                                  Need help? Contact us at<br>
                                  <a href="mailto:{{supportEmail}}" style="color: #1a7f3e; text-decoration: none; font-weight: 600;">supportEmail</a>
                              </p>
                              <p style="color: #999999; font-size: 12px; margin: 10px 0 0;">
                                  &copy; ${new Date().getFullYear()} Ogun State Government. All rights reserved.
                              </p>
                          </td>
                      </tr>
                      
                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>
      `;
  return html;
};
