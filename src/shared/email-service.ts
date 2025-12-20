import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Get or create the nodemailer transporter
 */
function getTransporter(): Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    return transporter;
}

/**
 * Send OTP code via email
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || 'noreply@rentany.com';

    await transporter.sendMail({
        from,
        to: email,
        subject: 'Your RentAny OTP Code',
        text: `Your OTP code is: ${code}\n\nThis code will expire in ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.\n\nIf you didn't request this code, please ignore this email.`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your RentAny OTP Code</h2>
        <p style="font-size: 16px; color: #666;">
          Use the following code to complete your login:
        </p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
            ${code}
          </span>
        </div>
        <p style="font-size: 14px; color: #999;">
          This code will expire in ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.
        </p>
        <p style="font-size: 14px; color: #999;">
          If you didn't request this code, please ignore this email.
        </p>
      </div>
    `,
    });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
    email: string,
    subject: string,
    content: string
): Promise<void> {
    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || 'noreply@rentany.com';

    await transporter.sendMail({
        from,
        to: email,
        subject,
        text: content,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${subject}</h2>
        <div style="font-size: 16px; color: #666; line-height: 1.6;">
          ${content.replace(/\n/g, '<br>')}
        </div>
      </div>
    `,
    });
}

/**
 * Close the transporter connection
 */
export function closeEmailTransporter(): void {
    if (transporter) {
        transporter.close();
        transporter = null;
    }
}
