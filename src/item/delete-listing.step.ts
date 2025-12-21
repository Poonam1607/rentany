import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

export const config: ApiRouteConfig = {
    name: 'DeleteListing',
    type: 'api',
    path: '/items/:itemId',
    method: 'DELETE',
    description: 'Deletes a rental listing',
    emits: ['item.deleted'],
    flows: ['item-management'],

    responseSchema: {
        200: z.object({
            success: z.boolean(),
            message: z.string(),
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

export const handler: Handlers['DeleteListing'] = async (req, { logger, emit }) => {
    const { itemId } = ((req as any).pathParams || {}) as { itemId: string };
    const userId = getUserIdFromHeader(req.headers);

    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

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

        // 1. Check ownership
        const itemResult = await pool.query(
            'SELECT "ownerId" FROM items WHERE id = $1',
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

        if (item.ownerId !== userId) {
            return {
                status: 403,
                body: {
                    error: 'Not authorized to delete this item',
                },
            };
        }

        // 2. Perform Deletions (Manual cascade if FKs don't handle it, safer to be explicit)
        // Delete images
        await pool.query('DELETE FROM item_images WHERE "itemId" = $1', [itemId]);

        // Delete inventory slots
        await pool.query('DELETE FROM inventory_slots WHERE "itemId" = $1', [itemId]);

        // Delete reviews
        await pool.query('DELETE FROM reviews WHERE "itemId" = $1', [itemId]);

        // Delete wishlist items
        await pool.query('DELETE FROM wishlist_items WHERE "itemId" = $1', [itemId]);

        // Delete item
        // Note: usage of bookings might prevent deletion if FK constraint exists. 
        // Ideally we check for active bookings first. For now, we try/catch constraint violations.
        await pool.query('DELETE FROM items WHERE id = $1', [itemId]);

        // @ts-ignore
        await emit({
            topic: 'item.deleted',
            data: { itemId, ownerId: userId }
        });

        return {
            status: 200,
            body: {
                success: true,
                message: 'Item deleted successfully',
            },
        };

    } catch (error: any) {
        // Handle FK violation (e.g. active bookings)
        if (error.code === '23503') {
            return {
                status: 400,
                body: {
                    error: 'Cannot delete item because it has associated bookings.',
                },
            };
        }

        logger.error('Failed to delete item', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to delete item',
            },
        };
    }
};
