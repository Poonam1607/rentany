import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId, type User } from '../shared/postgres';

const verifyOtpBodySchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(10),
});

const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  mobile: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
  mobileVerified: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN']),
  status: z.enum(['ACTIVE', 'BLOCKED']),
  createdAt: z.string(),
});

interface OtpRecord {
  id: string;
  mobile: string | null;
  email: string | null;
  code: string;
  verified: boolean;
  expiresAt: string;
  createdAt: string;
}

export const config: ApiRouteConfig = {
  name: 'VerifyOtp',
  type: 'api',
  path: '/auth/otp/verify',
  method: 'POST',
  description: 'Verifies OTP and returns user session',
  emits: ['auth.otp_login_succeeded'],
  flows: ['otp-login-workflow'],
  bodySchema: verifyOtpBodySchema,
  responseSchema: {
    200: z.object({
      status: z.literal('authenticated'),
      token: z.string(),
      user: userSchema,
    }),
    400: z.object({
      error: z.string(),
    }),
    401: z.object({
      error: z.string(),
    }),
    500: z.object({
      error: z.string(),
    }),
  },
};

function generateToken(userId: string): string {
  // In production, use proper JWT library with secret
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64');
  return `token_${payload}`;
}

export const handler: Handlers['VerifyOtp'] = async (req, { logger, emit }) => {
  const parsed = verifyOtpBodySchema.safeParse(req.body);

  if (!parsed.success) {
    logger.warn('Invalid OTP verification payload', { issues: parsed.error.issues });

    return {
      status: 400,
      body: {
        error: 'Invalid request payload',
      },
    };
  }

  const { email, otp } = parsed.data;

  try {
    const pool = getPool();

    // Find matching OTP
    const otpResult = await pool.query<OtpRecord>(
      `SELECT * FROM otps
       WHERE email = $1
         AND code = $2
         AND verified = FALSE
         AND "expiresAt" > $3
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [email, otp, new Date().toISOString()]
    );

    const otpRecord = otpResult.rows[0];

    if (!otpRecord) {
      return {
        status: 401,
        body: {
          error: 'Invalid or expired OTP',
        },
      };
    }

    // Mark OTP as verified
    await pool.query(
      'UPDATE otps SET verified = TRUE WHERE id = $1',
      [otpRecord.id]
    );

    // Find or create user
    const userResult = await pool.query<User>(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    let user = userResult.rows[0];

    const now = new Date().toISOString();

    if (!user) {
      // Create new user
      const userId = generateId('user');
      await pool.query(
        `INSERT INTO users (id, mobile, email, name, "emailVerified", "mobileVerified", role, status, "aadhaarVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [userId, null, email, null, true, false, 'USER', 'ACTIVE', false, now, now]
      );

      const newUserResult = await pool.query<User>(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      user = newUserResult.rows[0];

      logger.info('New user created via OTP', { userId });
    } else {
      // Update verification status if not already verified
      if (!user.emailVerified) {
        await pool.query(
          'UPDATE users SET "emailVerified" = TRUE, "updatedAt" = $1 WHERE id = $2',
          [now, user.id]
        );
        const updatedUserResult = await pool.query<User>(
          'SELECT * FROM users WHERE id = $1',
          [user.id]
        );
        user = updatedUserResult.rows[0];
      }

      logger.info('Existing user logged in via OTP', { userId: user.id });
    }

    // Generate token
    const token = generateToken(user.id);

    // Emit event to signal that OTP login was successful
    await emit({
      topic: 'auth.otp_login_succeeded',
      data: {
        userId: user.id,
        email: user.email,
        verifiedAt: now,
      },
    } as any);

    return {
      status: 200,
      body: {
        status: 'authenticated',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          emailVerified: Boolean(user.emailVerified),
          mobileVerified: Boolean(user.mobileVerified),
          role: user.role as 'USER' | 'ADMIN',
          status: user.status as 'ACTIVE' | 'BLOCKED',
          createdAt: user.createdAt,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to verify OTP', { error });
    return {
      status: 500,
      body: {
        error: 'Failed to verify OTP',
      },
    };
  }
};
