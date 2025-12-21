import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { userSchema } from '../shared/types';

const updateProfileBodySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    profileImage: z.string().url().optional(),
});

export const config: ApiRouteConfig = {
    name: 'UpdateUserProfile',
    type: 'api',
    path: '/user/profile',
    method: 'PATCH',
    description: 'Updates user profile information',
    emits: ['user.profile_updated'],
    flows: ['user-management'],
    bodySchema: updateProfileBodySchema,
    responseSchema: {
        200: z.object({
            user: userSchema,
        }),
        400: z.object({
            error: z.string(),
        }),
        401: z.object({
            error: z.string(),
        }),
        404: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['UpdateUserProfile'] = async (req, { logger, emit }) => {
    const parsed = updateProfileBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid profile update payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
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

        // Update user profile
        const { name } = parsed.data;
        const updatedAt = new Date().toISOString();

        if (name) {
            await pool.query(
            `UPDATE users 
                SET name = $1, "updatedAt" = $2
                WHERE id = $3`,
            [name, updatedAt, userId]
        );
        }

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

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'user.profile_updated',
            data: {
                userId: (user as any).id,
                updatedAt,
            },
        });

        return {
            status: 200,
            body: {
                user: user as any,
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
