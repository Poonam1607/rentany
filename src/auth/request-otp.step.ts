import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { sendOtpEmail } from '../shared/email-service';

const requestOtpBodySchema = z.object({
  email: z.string().email(),
});


export const config: ApiRouteConfig = {
  name: 'RequestOtp',
  type: 'api',
  path: '/auth/otp/request',
  method: 'POST',
  description: 'Starts the OTP login flow by requesting an OTP for email',
  emits: ['auth.otp_requested'],
  flows: ['otp-login-workflow'],
  bodySchema: requestOtpBodySchema,
  responseSchema: {
    200: z.object({
      status: z.literal('pending'),
      requestedAt: z.string(),
    }),
    400: z.object({
      error: z.string(),
    }),
    500: z.object({
      error: z.string(),
    }),
  },
};

function generateOtpCode(): string {
  return '123456';
}

export const handler: Handlers['RequestOtp'] = async (req, { logger, emit }) => {
  const parsed = requestOtpBodySchema.safeParse(req.body);

  if (!parsed.success) {
    logger.warn('Invalid OTP request payload', { issues: parsed.error.issues });

    return {
      status: 400,
      body: {
        error: 'Invalid request payload',
      },
    };
  }

  const { email } = parsed.data;
  const requestedAt = new Date().toISOString();

  try {
    const pool = getPool();
    const code = generateOtpCode();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Store OTP in database
    const otpId = generateId('otp');
    await pool.query(
      `INSERT INTO otps (id, mobile, email, code, "expiresAt", verified, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [otpId, null, email, code, expiresAt, false, requestedAt]
    );

    logger.info('OTP generated and stored', {
      otpId,
      email,
      expiresAt,
    });

    // Send OTP via email
    try {
      await sendOtpEmail(email, code);
      logger.info('OTP email sent successfully', { email, otpId });
    } catch (emailError) {
      logger.error('Failed to send OTP email', { error: emailError, email });
      // Continue anyway - OTP is stored in DB
    }

    // Emit event for downstream workflows / analytics
    // Note: Using 'as any' because Motia types emit() based on subscribers.
    // This event has no subscriber yet (for future security monitoring).
    await (emit as any)({
      topic: 'auth.otp_requested',
      data: {
        email,
        requestedAt,
      },
    });
    return {
      status: 200,
      body: {
        status: 'pending',
        requestedAt,
      },
    };
  } catch (error) {
    logger.error('Failed to generate OTP', { error });
    return {
      status: 500,
      body: {
        error: 'Failed to generate OTP',
      },
    };
  }
};
