import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const reviewCreatedInput = z.object({
    reviewId: z.string(),
    bookingId: z.string(),
    itemId: z.string(),
    reviewerId: z.string(),
    rating: z.number(),
    createdAt: z.string(),
});

export const config: EventConfig = {
    name: 'AggregateRatings',
    type: 'event',
    description: 'Triggers rating recalculation for item after new review',
    subscribes: ['review.created'],
    emits: [],
    flows: ['review-workflow'],
    input: reviewCreatedInput,
};

export const handler: Handlers['AggregateRatings'] = async (input, { logger }) => {
    const data = reviewCreatedInput.parse(input);

    logger.info('Aggregating ratings for item', {
        itemId: data.itemId,
        newRating: data.rating,
    });

    try {
        const pool = getPool();

        // Calculate new stats
        const statsResult = await pool.query(
            `SELECT avg(rating) as avgRating, count(*) as count 
            FROM reviews 
            WHERE "itemId" = $1`, [data.itemId]
        );
        const stats = statsResult.rows[0] as { avgRating: number; count: number };

        const newRating = stats.avgRating || 0;
        const totalReviews = stats.count || 0;

        // Update item
        await pool.query(
            `UPDATE items 
            SET rating = $1, "totalReviews" = $2
            WHERE id = $3`,
            [newRating, totalReviews, data.itemId]
        );

        logger.info('Ratings aggregated successfully', {
            itemId: data.itemId,
            rating: newRating,
            totalReviews
        });
    } catch (error) {
        logger.error('Failed to aggregate ratings', {
            error,
            itemId: data.itemId,
        });
    }
};
