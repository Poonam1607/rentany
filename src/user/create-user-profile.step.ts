import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const createUserProfileBodySchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    mobile: z.string().optional(),
});

export const config: ApiRouteConfig = {
    name: 'CreateUserProfile',
    type: 'api',
    path: '/user/profile',
    method: 'POST',
    description: 'Creates or updates a user profile',
    emits: ['user.profile_updated'],
    flows: ['user-onboarding', 'user-management'],
    bodySchema: createUserProfileBodySchema,
    responseSchema: {
        200: z.object({
            user: z.object({
                id: z.string(),
                name: z.string().nullable(),
                email: z.string().nullable(),
                mobile: z.string().nullable(),
                role: z.string(),
                status: z.string(),
                createdAt: z.string(),
            }),
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

export const handler: Handlers['CreateUserProfile'] = async (req, { logger, emit }) => {
    const parsed = createUserProfileBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid create/update user profile payload', { issues: parsed.error.issues });

        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const userId = req.headers['user-id'] || req.headers['x-user-id'];

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

        // Update user profile
        const { name, email, mobile } = parsed.data;
        const updatedAt = new Date().toISOString();

        await pool.query(
            `UPDATE users 
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 mobile = COALESCE($3, mobile),
                 "updatedAt" = $4
             WHERE id = $5`,
            [name, email, mobile, updatedAt, userId]
        );

        const userResult = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user) {
            return {
                status: 404,
                body: {
                    error: 'User not found',
                },
            };
        }

        logger.info('User profile updated', { userId });

        await (emit as any)({
            topic: 'user.profile_updated',
            data: {
                userId: user.id,
                updatedAt,
            },
        });

        return {
            status: 200,
            body: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    status: user.status,
                    createdAt: user.createdAt,
                },
            },
        };
    } catch (error) {
        logger.error('Failed to update user profile', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to update profile',
            },
        };
    }
};
