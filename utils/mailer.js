import nodemailer from 'nodemailer';

// Create a transporter object with SMTP configuration
const transporter = nodemailer.createTransport({
    
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

/**
 * Send a 6-digit verification code email to a user
 */
const sendVerificationCodeEmail = (email, code) => {
  const mailOptions = {
    from: process.env.MAIL_USER || 'no-reply@universal-admin',
    to: email,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Verify Your Email</h2>
        <p style="color: #64748b; font-size: 14px;">Use the code below to verify your account:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Send a verification link email to a user
 */
const sendVerificationLinkEmail = (email, verificationLink) => {
  const mailOptions = {
    from: process.env.MAIL_USER || 'no-reply@universal-admin',
    to: email,
    subject: 'Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Verify Your Email</h2>
        <p style="color: #64748b; font-size: 14px;">Click the button below to verify your account:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verificationLink}" 
             style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Verify My Email
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">Or copy and paste this link into your browser:</p>
        <p style="color: #6366f1; font-size: 12px; word-break: break-all;">${verificationLink}</p>
        <p style="color: #94a3b8; font-size: 12px;">This link will expire in 24 hours. If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export default transporter;
export { sendVerificationCodeEmail, sendVerificationLinkEmail };