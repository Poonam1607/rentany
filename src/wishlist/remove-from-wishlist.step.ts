import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractLastPathSegment } from '../shared/route-utils';

export const config: ApiRouteConfig = {
    name: 'RemoveFromWishlist',
    type: 'api',
    path: '/wishlists/:itemId',
    method: 'DELETE',
    description: 'Removes an item from user wishlist',
    emits: ['wishlist.item_removed'],
    flows: ['wishlist-management'],
    bodySchema: z.object({}),
    responseSchema: {
        200: z.object({
            itemId: z.string(),
            removedAt: z.string(),
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

export const handler: Handlers['RemoveFromWishlist'] = async (req, { logger, emit }) => {
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
        const removedAt = new Date().toISOString();

        await pool.query(
            'DELETE FROM wishlist_items WHERE "userId" = $1 AND "itemId" = $2',
            [userId, itemId]
        );

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'wishlist.item_removed',
            data: {
                itemId,
                removedAt,
            },
        });

        logger.info('Item removed from wishlist', { itemId });

        return {
            status: 200,
            body: {
                itemId,
                removedAt,
            },
        };
    } catch (error) {
        logger.error('Failed to remove item from wishlist', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to remove from wishlist',
            },
        };
    }
};
