import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { userSchema } from '../shared/types';

export const config: ApiRouteConfig = {
    name: 'GetUserProfile',
    type: 'api',
    path: '/user/profile',
    method: 'GET',
    description: 'Retrieves authenticated user profile',
    emits: [],
    flows: ['user-management'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            user: userSchema,
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

export const handler: Handlers['GetUserProfile'] = async (req, { logger }) => {
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
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        const user = userResult.rows[0];

        if (!user) {
            return {
                status: 404,
                body: {
                    error: 'User profile not found',
                },
            };
        }

        return {
            status: 200,
            body: {
                user: user as any,
            },
        };
    } catch (error: any) {
        logger.error('Failed to get user profile', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve profile',
            },
        };
    }
};
