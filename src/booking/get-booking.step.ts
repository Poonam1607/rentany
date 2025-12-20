import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractLastPathSegment } from '../shared/route-utils';
import { bookingSchema } from '../shared/types';

export const config: ApiRouteConfig = {
    name: 'GetBooking',
    type: 'api',
    path: '/bookings/:bookingId',
    method: 'GET',
    description: 'Retrieves booking details',
    emits: [],
    flows: ['booking-viewing'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            booking: bookingSchema,
            item: z.object({
                id: z.string(),
                title: z.string(),
                images: z.array(z.string()),
            }).optional(),
        }),
        400: z.object({
            error: z.string(),
        }),
        401: z.object({
            error: z.string(),
        }),
        403: z.object({
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

export const handler: Handlers['GetBooking'] = async (req, { logger }) => {
    const userId = getUserIdFromHeader(req.headers);
    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

    const { bookingId } = ((req as any).pathParams || {}) as { bookingId: string };
    if (!bookingId) {
        return {
            status: 400,
            body: {
                error: 'Booking ID is required',
            },
        };
    }

    try {
        const pool = getPool();

        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [bookingId]
        );
        const booking = bookingResult.rows[0] as any;

        if (!booking) {
            return {
                status: 404,
                body: {
                    error: 'Booking not found',
                },
            };
        }

        // Authorization check
        if (booking.renterId !== userId && booking.ownerId !== userId) {
            // Need to check if user is ADMIN too if we have role info, but for now stick to owner/renter
            return {
                status: 403,
                body: {
                    error: 'Not authorized to view this booking',
                },
            };
        }

        // Fetch Item (Partial)
        const itemResult = await pool.query(
            'SELECT id, title FROM items WHERE id = $1',
            [booking.itemId]
        );
        const item = itemResult.rows[0] as any;
        if (item) {
            // Fetch images
            const imagesResult = await pool.query(
                'SELECT "imageUrl" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC LIMIT 1',
                [item.id]
            );
            item.images = imagesResult.rows.map((row: any) => row.imageUrl);
        }

        return {
            status: 200,
            body: {
                booking,
                item,
            },
        };
    } catch (error: any) {
        logger.error('Failed to get booking', { error, bookingId });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve booking',
            },
        };
    }
};
