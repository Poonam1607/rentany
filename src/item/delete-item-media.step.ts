import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

export const config: ApiRouteConfig = {
    name: 'DeleteMedia',
    type: 'api',
    path: '/items/:itemId/media/:mediaId', // Specific media ID
    method: 'DELETE',
    description: 'Deletes a media image from a listing',
    emits: ['item.media_deleted'],
    flows: ['item-management'],

    responseSchema: {
        200: z.object({
            success: z.boolean(),
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

export const handler: Handlers['DeleteMedia'] = async (req, { logger, emit }) => {
    const { itemId, mediaId } = ((req as any).pathParams || {}) as { itemId: string; mediaId: string };
    const userId = getUserIdFromHeader(req.headers);

    if (!userId) {
        return {
            status: 401,
            body: { error: 'Authentication required' },
        };
    }

    if (!itemId || !mediaId) {
        return {
            status: 400,
            body: { error: 'Item ID and Media ID are required' },
        };
    }

    try {
        const pool = getPool();

        // 1. Verify Item Ownership
        const itemResult = await pool.query(
            'SELECT "ownerId" FROM items WHERE id = $1',
            [itemId]
        );
        const item = itemResult.rows[0];

        if (!item) {
            return {
                status: 404,
                body: { error: 'Item not found' },
            };
        }

        if (item.ownerId !== userId) {
            return {
                status: 403,
                body: { error: 'Not authorized to modify this item' },
            };
        }

        // 2. Delete the image (ensure it belongs to the item)
        const result = await pool.query(
            'DELETE FROM item_images WHERE id = $1 AND "itemId" = $2',
            [mediaId, itemId]
        );

        if (result.rowCount === 0) {
            return {
                status: 404,
                body: { error: 'Image not found or does not belong to this item' },
            };
        }

        // @ts-ignore
        await emit({
            topic: 'item.media_deleted',
            data: { itemId, mediaId }
        });

        return {
            status: 200,
            body: { success: true },
        };

    } catch (error: any) {
        logger.error('Failed to delete media', { error, itemId, mediaId });
        return {
            status: 500,
            body: { error: 'Failed to delete media' },
        };
    }
};
