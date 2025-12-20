import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractLastPathSegment } from '../shared/route-utils';

const addToWishlistParamsSchema = z.object({
    itemId: z.string(),
});

export const config: ApiRouteConfig = {
    name: 'AddToWishlist',
    type: 'api',
    path: '/wishlists/:itemId',
    method: 'POST',
    description: 'Adds an item to user wishlist',
    emits: ['wishlist.item_added'],
    flows: ['wishlist-management'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            itemId: z.string(),
            addedAt: z.string(),
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
        404: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['AddToWishlist'] = async (req, { logger, emit }) => {
    const userId = getUserIdFromHeader(req.headers);
    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

    const { itemId } = ((req as any).pathParams || {}) as { itemId: string };
    if (!itemId) {
        return {
            status: 400,
            body: {
                error: 'Item ID is required',
            },
        };
    }

    try {
        const pool = getPool();
        const addedAt = new Date().toISOString();
        const wishlistId = generateId('wl');

        // Check if item exists (optional but good practice)
        const itemResult = await pool.query(
            'SELECT id FROM items WHERE id = $1',
            [itemId]
        );
        const item = itemResult.rows[0];
        if (!item) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        // Insert into wishlist, ignore if already exists (UNIQUE constraint on userId, itemId)
        try {
            await pool.query(
            `INSERT INTO wishlist_items (id, "userId", "itemId", "createdAt")
                VALUES ($1, $2, $3, $4)`,
            [wishlistId, userId, itemId, addedAt]
        );
        } catch (e: any) {
            if (e.code !== 'SQLITE_CONSTRAINT_UNIQUE' && !e.message.includes('UNIQUE')) {
                throw e;
            }
            // If unique constraint failed, it's already in wishlist, just success
        }

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'wishlist.item_added',
            data: {
                itemId,
                addedAt,
            },
        });

        logger.info('Item added to wishlist', { itemId });

        return {
            status: 200,
            body: {
                itemId,
                addedAt,
            },
        };
    } catch (error) {
        logger.error('Failed to add item to wishlist', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to add to wishlist',
            },
        };
    }
};
