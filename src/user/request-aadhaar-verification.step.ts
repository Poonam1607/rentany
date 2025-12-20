import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

const requestAadhaarBodySchema = z.object({
    aadhaarNumber: z.string().length(12).regex(/^\d{12}$/, 'Must be 12 digits'),
});

export const config: ApiRouteConfig = {
    name: 'RequestAadhaarVerification',
    type: 'api',
    path: '/user/aadhaar/verify/request',
    method: 'POST',
    description: 'Initiates optional Aadhaar verification for KYC',
    emits: ['user.aadhaar_verification_requested'],
    flows: ['kyc-workflow'],
    bodySchema: requestAadhaarBodySchema,
    responseSchema: {
        200: z.object({
            status: z.literal('otp_sent'),
            requestId: z.string(),
            message: z.string(),
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

export const handler: Handlers['RequestAadhaarVerification'] = async (req, { logger, emit }) => {
    const parsed = requestAadhaarBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid Aadhaar verification request', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid Aadhaar number',
            },
        };
    }

    const userId = getUserIdFromHeader(req.headers);
    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

    try {
        const pool = getPool();

        // 1. Get user's mobile to simulate sending OTP to linked mobile
        const userResult = await pool.query(
            'SELECT mobile FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0] as { mobile: string };
        if (!user || !user.mobile) {
            return {
                status: 400,
                body: {
                    error: 'User mobile number not found for verification',
                },
            };
        }

        // 2. Generate OTP (Simulated external service call)
        const otp = '123456'; // Fixed for demo/testing, or use Math.random()
        const requestId = generateId('req');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

        // 3. Store in verification_codes
        await pool.query(
            `INSERT INTO verification_codes (mobile, code, type, "expiresAt", "createdAt")
            VALUES ($1, $2, 'AADHAAR', $3, $4)`,
            [user.mobile, otp, expiresAt, new Date().toISOString()]
        );

        // 4. Log the OTP (since we can't actually SMS)
        logger.info(`[SIMULATION] Aadhaar OTP for ${user.mobile}: ${otp}`);

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'user.aadhaar_verification_requested',
            data: {
                requestId,
                aadhaarNumber: parsed.data.aadhaarNumber.substring(0, 4) + '****' + parsed.data.aadhaarNumber.substring(8),
                requestedAt: new Date().toISOString(),
            },
        });

        return {
            status: 200,
            body: {
                status: 'otp_sent',
                requestId,
                message: 'OTP sent to mobile number linked with Aadhaar (Simulated: 123456)',
            },
        };
    } catch (error) {
        logger.error('Failed to request Aadhaar verification', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to initiate Aadhaar verification',
            },
        };
    }
};
