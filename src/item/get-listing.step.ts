import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { itemSchema, addressSchema } from '../shared/types';

export const config: ApiRouteConfig = {
    name: 'GetListing',
    type: 'api',
    path: '/items/:itemId',
    method: 'GET',
    description: 'Retrieves a single rental listing with details',
    emits: [],
    flows: ['item-viewing'],

    responseSchema: {
        200: z.object({
            item: itemSchema,
            address: addressSchema.optional(),
            owner: z.object({
                id: z.string(),
                name: z.string().nullable(),
                rating: z.number().optional(),
            }).optional(),
        }),

        400: z.object({
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

export const handler: Handlers['GetListing'] = async (req, { logger }) => {
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

        const itemResult = await pool.query(
            'SELECT * FROM items WHERE id = $1',
            [itemId]
        );
        const item = itemResult.rows[0] as any;

        if (!item) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        // Hydrate details
        const addressResult = await pool.query(
            'SELECT * FROM addresses WHERE id = $1',
            [item.addressId]
        );
        const address = addressResult.rows[0];
        const ownerResult = await pool.query(
            'SELECT id, name, NULL as rating FROM users WHERE id = $1',
            [item.ownerId]
        );
        const owner = ownerResult.rows[0];

        const imagesResult = await pool.query(
            'SELECT id, "imageUrl", "isPrimary" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC',
            [itemId]
        );
        const images = imagesResult.rows;

        const fullItem = {
            ...item,
            images: images, // Return full objects { imageUrl, ... } from SQL result
            hourlyRate: item.hourlyRate,
            totalReviews: item.totalReviews || 0,
            status: item.status as any,
            category: item.category as any,
        };

        return {
            status: 200,
            body: {
                item: fullItem,
                address: address as any,
                owner: owner as any,
            },
        };
    } catch (error: any) {
        logger.error('Failed to get listing', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve listing',
            },
        };
    }
};
