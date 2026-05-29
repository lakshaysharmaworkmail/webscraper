import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

interface UserInfo {
  email: string;
  displayName?: string;
  approvalToken?: string;
  createdAt: Date;
  _id?: { toString: () => string };
}

export async function sendAdminNotification(user: UserInfo): Promise<void> {
  const approvalUrl = `${config.server.frontendUrl}/admin/approve/${user.approvalToken}`;
  const rejectUrl = `${config.server.frontendUrl}/admin/reject/${user.approvalToken}`;

  const mailOptions = {
    from: config.smtp.adminEmail,
    to: config.smtp.adminEmail,
    subject: 'New User Registration - Approval Required',
    html: `
      <h2>New User Registration</h2>
      <p>A new user has registered and requires approval:</p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>Display Name:</strong> ${user.displayName || 'Not provided'}</li>
        <li><strong>Registered:</strong> ${user.createdAt.toISOString()}</li>
      </ul>
      <p>
        <a href="${approvalUrl}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
        <a href="${rejectUrl}" style="background: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
      </p>
      <p>Or copy these links:</p>
      <p>Approve: ${approvalUrl}</p>
      <p>Reject: ${rejectUrl}</p>
    `,
  };

  if (config.server.nodeEnv === 'production' && config.smtp.user) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  } else {
    console.log('📧 Admin notification (dev mode):', mailOptions);
  }
}

export async function sendApprovalEmail(user: UserInfo): Promise<void> {
  const mailOptions = {
    from: config.smtp.adminEmail,
    to: user.email,
    subject: 'Your Antigravity Account Approved',
    html: `
      <h2>Welcome to Antigravity!</h2>
      <p>Great news! Your account has been approved. You can now access the platform.</p>
      <p><a href="${config.server.frontendUrl}/login" style="background: #476800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Login to Antigravity</a></p>
    `,
  };

  if (config.server.nodeEnv === 'production' && config.smtp.user) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  } else {
    console.log('📧 Approval email (dev mode):', mailOptions);
  }
}

export async function sendRejectionEmail(user: UserInfo): Promise<void> {
  const mailOptions = {
    from: config.smtp.adminEmail,
    to: user.email,
    subject: 'Your Antigravity Registration Update',
    html: `
      <h2>Registration Update</h2>
      <p>Unfortunately, your registration has not been approved at this time.</p>
      <p>If you believe this is an error, please contact the administrator.</p>
    `,
  };

  if (config.server.nodeEnv === 'production' && config.smtp.user) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  } else {
    console.log('📧 Rejection email (dev mode):', mailOptions);
  }
}

export async function sendPasswordResetEmail(user: UserInfo, resetToken: string): Promise<void> {
  const resetUrl = `${config.server.frontendUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: config.smtp.adminEmail,
    to: user.email,
    subject: 'Password Reset - Scraper Dashboard',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="background: #476800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  };

  if (config.server.nodeEnv === 'production' && config.smtp.user) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  } else {
    console.log('📧 Password reset email (dev mode):', mailOptions);
  }
}