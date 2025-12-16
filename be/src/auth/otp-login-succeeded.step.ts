import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const otpLoginSucceededInput = z.object({
  userId: z.string(),
  email: z.string().email().nullable().optional(),
  mobile: z.string().nullable().optional(),
  verifiedAt: z.string(),
});

export const config: EventConfig = {
  name: 'OtpLoginSucceeded',
  type: 'event',
  description: 'Handles post-login side effects after a successful OTP login',
  subscribes: ['auth.otp_login_succeeded'],
  emits: [],
  flows: ['otp-login-workflow'],
  input: otpLoginSucceededInput,
};

export const handler: Handlers['OtpLoginSucceeded'] = async (input, { logger }) => {
  const data = otpLoginSucceededInput.parse(input);

  logger.info('OTP login succeeded, handling side effects', {
    userId: data.userId,
    verifiedAt: data.verifiedAt,
  });

  // This is the right place to trigger non-CRUD side effects that still go through services.
  // For example, you might:
  // - Call the User service to update lastLoginAt
  // - Call the Notification service to send a "welcome back" message
  //
  // These calls should go through HTTP APIs, not direct DB/Redis access.
};


