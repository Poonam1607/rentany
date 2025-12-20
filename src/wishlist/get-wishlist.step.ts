import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { itemSchema } from '../shared/types';

export const config: ApiRouteConfig = {
    name: 'GetWishlist',
    type: 'api',
    path: '/wishlists',
    method: 'GET',
    description: 'Retrieves user wishlist items',
    emits: [],
    flows: ['wishlist-viewing'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            items: z.array(itemSchema),
            total: z.number(),
        }),
        401: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['GetWishlist'] = async (req, { logger }) => {
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

        // Get items in wishlist
        const rowsResult = await pool.query(
            `SELECT i.* 
            FROM items i
            JOIN wishlist_items w ON i.id = w."itemId"
            WHERE w."userId" = $1
            ORDER BY w."createdAt" DESC`, [userId]
        );
        const rows = rowsResult.rows as any[];

        // Hydrate images for each item using PostgreSQL
        const itemsWithImages = await Promise.all(rows.map(async (row) => {
            const imagesResult = await pool.query(
                'SELECT "imageUrl" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC',
                [row.id]
            );
            const images = imagesResult.rows.map((img: any) => img.imageUrl);

            return {
                ...row,
                images,
                hourlyRate: row.hourlyRate,
                totalReviews: row.totalReviews || 0,
                status: row.status as any,
                category: row.category as any,
            };
        }));

        return {
            status: 200,
            body: {
                items: itemsWithImages,
                total: itemsWithImages.length,
            },
        };
    } catch (error) {
        logger.error('Failed to get wishlist', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve wishlist',
            },
        };
    }
};
