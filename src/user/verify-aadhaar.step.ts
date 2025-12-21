import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

const verifyAadhaarBodySchema = z.object({
    requestId: z.string(),
    otp: z.string().length(6).regex(/^\d{6}$/, 'Must be 6 digits'),
});

export const config: ApiRouteConfig = {
    name: 'VerifyAadhaar',
    type: 'api',
    path: '/user/aadhaar/verify/confirm',
    method: 'POST',
    description: 'Completes Aadhaar verification with OTP',
    emits: ['user.kyc_completed'],
    flows: ['kyc-workflow'],
    bodySchema: verifyAadhaarBodySchema,
    responseSchema: {
        200: z.object({
            status: z.literal('verified'),
            kycStatus: z.literal('completed'),
            verifiedAt: z.string(),
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

export const handler: Handlers['VerifyAadhaar'] = async (req, { logger, emit }) => {
    const parsed = verifyAadhaarBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid Aadhaar OTP verification', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid verification data',
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

        const userResult = await pool.query(
            'SELECT mobile FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0] as { mobile: string };
        if (!user || !user.mobile) {
            return {
                status: 400,
                body: {
                    error: 'User mobile not found',
                },
            };
        }

        // Verify OTP
        const verificationResult = await pool.query(
            `SELECT * FROM verification_codes 
            WHERE mobile = $1 AND code = $2 AND type = 'AADHAAR' AND "expiresAt" > $3
            ORDER BY "createdAt" DESC LIMIT 1`,
            [user.mobile, parsed.data.otp, new Date().toISOString()]
        );
        const verification = verificationResult.rows[0];

        if (!verification) {
            return {
                status: 400, // Or 401
                body: {
                    error: 'Invalid or expired OTP',
                },
            };
        }

        // Mark Aadhaar as verified
        await pool.query(
            'UPDATE users SET "aadhaarVerified" = 1 WHERE id = $1',
            [userId]
        );

        // Delete used OTP (optional, or just leave it)
        await pool.query(
            'DELETE FROM verification_codes WHERE mobile = $1 AND type = $2',
            [user.mobile, 'AADHAAR']
        );

        const verifiedAt = new Date().toISOString();

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'user.kyc_completed',
            data: {
                userId,
                kycType: 'aadhaar',
                verifiedAt,
            },
        });

        return {
            status: 200,
            body: {
                status: 'verified',
                kycStatus: 'completed',
                verifiedAt,
            },
        };
    } catch (error: any) {
        logger.error('Failed to verify Aadhaar', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to complete Aadhaar verification',
            },
        };
    }
};
