import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const verifyOtpBodySchema = z.object({
  email: z.string().email().optional(),
  mobile: z
    .string()
    .min(6)
    .max(20)
    .optional(),
  otp: z.string().min(4).max(10),
}).refine(
  (value) => Boolean(value.email || value.mobile),
  { message: 'Either email or mobile is required' },
);

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

export const config: ApiRouteConfig = {
  name: 'VerifyOtp',
  type: 'api',
  path: '/auth/otp/verify',
  method: 'POST',
  description: 'Verifies OTP with Auth service and returns user session',
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
  },
};

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

  const { email, mobile, otp } = parsed.data;

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

  let authResponse: Response;

  try {
    authResponse = await fetch(`${authServiceUrl}/otp/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, mobile, otp }),
    });
  } catch (error) {
    logger.error('Failed to call Auth service for OTP verification', { error });
    return {
      status: 502,
      body: {
        error: 'Failed to reach auth service',
      },
    };
  }

  if (authResponse.status === 401) {
    return {
      status: 401,
      body: {
        error: 'Invalid or expired OTP',
      },
    };
  }

  if (!authResponse.ok) {
    logger.error('Auth service returned unexpected status for OTP verification', {
      status: authResponse.status,
    });
    return {
      status: 502,
      body: {
        error: 'Auth service error',
      },
    };
  }

  type AuthVerifyResponse = {
    token: string;
    user: z.infer<typeof userSchema>;
  };

  let parsedAuthBody: AuthVerifyResponse;

  try {
    parsedAuthBody = await authResponse.json();
  } catch (error) {
    logger.error('Failed to parse Auth service response for OTP verification', { error });
    return {
      status: 502,
      body: {
        error: 'Invalid auth service response',
      },
    };
  }

  const userResult = userSchema.safeParse(parsedAuthBody.user);
  if (!userResult.success) {
    logger.error('Auth service returned user with invalid shape', {
      issues: userResult.error.issues,
    });
    return {
      status: 502,
      body: {
        error: 'Auth service user payload invalid',
      },
    };
  }

  // Emit event to signal that OTP login was successful
  await emit({
    topic: 'auth.otp_login_succeeded',
    data: {
      userId: userResult.data.id,
      email: userResult.data.email,
      mobile: userResult.data.mobile,
      verifiedAt: new Date().toISOString(),
    },
  });

  return {
    status: 200,
    body: {
      status: 'authenticated',
      token: parsedAuthBody.token,
      user: userResult.data,
    },
  };
};


