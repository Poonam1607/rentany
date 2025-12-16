import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const requestOtpBodySchema = z.object({
  email: z.string().email().optional(),
  mobile: z
    .string()
    .min(6)
    .max(20)
    .optional(),
}).refine(
  (value) => Boolean(value.email || value.mobile),
  { message: 'Either email or mobile is required' },
);

export const config: ApiRouteConfig = {
  name: 'RequestOtp',
  type: 'api',
  path: '/auth/otp/request',
  method: 'POST',
  description: 'Starts the OTP login flow by requesting an OTP for email or mobile',
  emits: ['auth.otp_requested'],
  flows: ['otp-login-workflow'],
  bodySchema: requestOtpBodySchema,
  responseSchema: {
    200: z.object({
      status: z.literal('pending'),
      channel: z.enum(['email', 'mobile']),
      requestedAt: z.string(),
    }),
    400: z.object({
      error: z.string(),
    }),
  },
};

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

  const { email, mobile } = parsed.data;

  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  if (!authServiceUrl) {
    logger.error('AUTH_SERVICE_URL is not configured');
    return {
      status: 500,
      body: {
        error: 'Auth service not configured',
      },
    };
  }

  const channel = email ? 'email' as const : 'mobile' as const;
  const requestedAt = new Date().toISOString();

  try {
    // Delegate OTP generation + delivery to the Auth service
    await fetch(`${authServiceUrl}/otp/request`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, mobile }),
    });
  } catch (error) {
    logger.error('Failed to call Auth service for OTP request', { error });
    return {
      status: 502,
      body: {
        error: 'Failed to reach auth service',
      },
    };
  }

  // Emit event for downstream workflows / analytics
  await emit({
    topic: 'auth.otp_requested',
    data: {
      email,
      mobile,
      channel,
      requestedAt,
    },
  });

  return {
    status: 200,
    body: {
      status: 'pending',
      channel,
      requestedAt,
    },
  };
};


