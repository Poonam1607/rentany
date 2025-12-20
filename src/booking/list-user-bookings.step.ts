import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { bookingSchema } from '../shared/types';

const listBookingsQuerySchema = z.object({
    role: z.enum(['renter', 'owner']).optional(),
    status: z.string().optional(),
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
});

export const config: ApiRouteConfig = {
    name: 'ListUserBookings',
    type: 'api',
    path: '/bookings',
    method: 'GET',
    description: 'Lists authenticated user bookings (as renter or owner)',
    emits: [],
    flows: ['booking-management'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            bookings: z.array(bookingSchema),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
            hasMore: z.boolean(),
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

export const handler: Handlers['ListUserBookings'] = async (req, { logger }) => {
    const userId = getUserIdFromHeader(req.headers);
    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

    const reqAny = req as any;
    const queryParams = reqAny.query || {};
    const queryObject = queryParams;

    const parsed = listBookingsQuerySchema.safeParse(queryObject);

    if (!parsed.success) {
        logger.warn('Invalid list bookings query', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid query parameters',
            },
        };
    }

    try {
        const pool = getPool();
        const { role, status, page, limit } = parsed.data;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM bookings WHERE ';
        const params: any[] = [];
        let paramIndex = 1;

        // Role filter
        if (role === 'renter') {
            query += `"renterId" = $${paramIndex++}`;
            params.push(userId);
        } else if (role === 'owner') {
            query += `"ownerId" = $${paramIndex++}`;
            params.push(userId);
        } else {
            query += `("renterId" = $${paramIndex++} OR "ownerId" = $${paramIndex++})`;
            params.push(userId, userId);
        }

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows[0].total;

        query += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const bookingsResult = await pool.query(query, params);
        const bookings = bookingsResult.rows;

        return {
            status: 200,
            body: {
                bookings: bookings as any,
                total,
                page,
                limit,
                hasMore: page * limit < total,
            },
        };
    } catch (error) {
        logger.error('Failed to list bookings', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve bookings',
            },
        };
    }
};
