import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { reviewSchema } from '../shared/types';

const submitReviewBodySchema = z.object({
    bookingId: z.string(),
    itemId: z.string(),
    rating: z.number().min(1).max(5),
    comment: z.string().max(1000).optional(),
});

export const config: ApiRouteConfig = {
    name: 'SubmitReview',
    type: 'api',
    path: '/reviews',
    method: 'POST',
    description: 'Submits a review for a completed booking',
    emits: ['review.created'],
    flows: ['review-workflow'],
    bodySchema: submitReviewBodySchema,
    responseSchema: {
        200: z.object({
            review: reviewSchema,
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
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['SubmitReview'] = async (req, { logger, emit }) => {
    const parsed = submitReviewBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid review submission', { issues: parsed.error.issues });
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

        // Verify booking belongs to user
        const bookingResult = await pool.query(
            'SELECT "renterId" FROM bookings WHERE id = $1',
            [parsed.data.bookingId]
        );
        const booking = bookingResult.rows[0] as { renterId: string } | undefined;

        if (!booking) {
            return {
                status: 400,
                body: {
                    error: 'Invalid booking ID',
                },
            };
        }

        if (booking.renterId !== userId) {
            return {
                status: 403,
                body: {
                    error: 'Not authorized to review this booking',
                },
            };
        }

        const reviewId = generateId('rev');
        const createdAt = new Date().toISOString();

        await pool.query(
            `INSERT INTO reviews (id, "bookingId", "itemId", "reviewerId", rating, comment, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
            reviewId,
            parsed.data.bookingId,
            parsed.data.itemId,
            userId,
            parsed.data.rating,
            parsed.data.comment || null,
            createdAt
        ]
        );

        // Fetch created review
        const reviewResult = await pool.query(
            'SELECT * FROM reviews WHERE id = $1',
            [reviewId]
        );
        const review = reviewResult.rows[0];

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'review.created',
            data: {
                reviewId,
                bookingId: parsed.data.bookingId,
                itemId: parsed.data.itemId,
                reviewerId: userId,
                rating: parsed.data.rating,
                createdAt,
            },
        });

        logger.info('Review submitted', {
            reviewId,
            itemId: parsed.data.itemId,
        });

        return {
            status: 200,
            body: {
                review: review as any,
            },
        };
    } catch (error: any) {
        logger.error('Failed to submit review', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to submit review',
            },
        };
    }
};
