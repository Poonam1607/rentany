import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractLastPathSegment } from '../shared/route-utils';
import { itemSchema, itemCategorySchema, itemStatusSchema } from '../shared/types';

const updateListingBodySchema = z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(5000).optional(),
    category: itemCategorySchema.optional(),
    hourlyRate: z.number().min(0).optional(),
    deposit: z.number().min(0).optional(),
    minHours: z.number().min(1).optional(),
    maxHours: z.number().min(1).optional(),
    status: itemStatusSchema.optional(),
});

export const config: ApiRouteConfig = {
    name: 'UpdateListing',
    type: 'api',
    path: '/items/:itemId',
    method: 'PATCH',
    description: 'Updates a rental listing',
    emits: ['item.listing_updated'],
    flows: ['item-management'],
    bodySchema: updateListingBodySchema,
    responseSchema: {
        200: z.object({
            item: itemSchema,
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

export const handler: Handlers['UpdateListing'] = async (req, { logger, emit }) => {
    const parsed = updateListingBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid listing update payload', { issues: parsed.error.issues });
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

        // Verify ownership
        const currentItemResult = await pool.query(
            'SELECT "ownerId", "createdAt" FROM items WHERE id = $1',
            [itemId]
        );
        const currentItem = currentItemResult.rows[0] as { ownerId: string, createdAt: string } | undefined;

        if (!currentItem) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        if (currentItem.ownerId !== userId) {
            return {
                status: 403,
                body: {
                    error: 'Not authorized to update this listing',
                },
            };
        }

        const fields = Object.keys(parsed.data);
        if (fields.length > 0) {
            // Postgres uses $1, $2, etc. NOT ?.
            // Map fields to $1, $2, ... $N
            const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
            const values = fields.map(f => (parsed.data as any)[f]);

            // Add updatedAt. It will be the next parameter index ($N+1)
            const updatedAt = new Date().toISOString();
            const updatedAtPlaceholder = `$${fields.length + 1}`;

            // ItemId will be the parameter after updatedAt ($N+2)
            const itemIdPlaceholder = `$${fields.length + 2}`;

            await pool.query(
                `UPDATE items 
                SET ${setClause}, "updatedAt" = ${updatedAtPlaceholder}
                WHERE id = ${itemIdPlaceholder}`,
                [...values, updatedAt, itemId]
            );
        }

        // Fetch updated item
        const updatedItemRowResult = await pool.query(
            'SELECT * FROM items WHERE id = $1',
            [itemId]
        );
        const updatedItemRow = updatedItemRowResult.rows[0] as any;

        // Hydrate images
        const imagesResult = await pool.query(
            'SELECT "imageUrl" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC',
            [itemId]
        );
        const images = imagesResult.rows;

        const item = {
            ...updatedItemRow,
            images: images.map(i => i.imageUrl),
            hourlyRate: updatedItemRow.hourlyRate,
            totalReviews: updatedItemRow.totalReviews || 0,
            status: updatedItemRow.status as any,
            category: updatedItemRow.category as any,
        };

        // Re-trigger search indexing if content changed
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'item.listing_updated',
            data: {
                itemId: item.id,
                ownerId: item.ownerId,
                updatedFields: fields,
                updatedAt: new Date().toISOString(),
            },
        });

        return {
            status: 200,
            body: {
                item: item as any,
            },
        };
    } catch (error: any) {
        logger.error('Failed to update listing', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to update listing',
            },
        };
    }
};
