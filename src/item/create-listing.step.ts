import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { itemSchema, itemCategorySchema } from '../shared/types';

const createListingBodySchema = z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    category: itemCategorySchema,
    hourlyRate: z.number().min(0),
    currency: z.string().default('INR'),
    deposit: z.number().min(0).optional(),
    minHours: z.number().min(1).default(1),
    maxHours: z.number().min(1).optional(),
    addressId: z.string(),
});

export const config: ApiRouteConfig = {
    name: 'CreateListing',
    type: 'api',
    path: '/items',
    method: 'POST',
    description: 'Creates a new rental listing',
    emits: ['item.listing_created'],
    flows: ['item-management', 'search-indexing'],
    bodySchema: createListingBodySchema,
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
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['CreateListing'] = async (req, { logger, emit }) => {
    const parsed = createListingBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid listing creation payload', { issues: parsed.error.issues });
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

    // Validate minHours <= maxHours if maxHours is provided
    if (parsed.data.maxHours && parsed.data.minHours > parsed.data.maxHours) {
        return {
            status: 400,
            body: {
                error: 'minHours must be less than or equal to maxHours',
            },
        };
    }

    try {
        const pool = getPool();

        // Verify address belongs to user
        const addressResult = await pool.query(
            'SELECT "userId" FROM addresses WHERE id = $1',
            [parsed.data.addressId]
        );
        const address = addressResult.rows[0] as { userId: string } | undefined;
        if (!address) {
            return {
                status: 400,
                body: {
                    error: 'Address not found',
                },
            };
        }
        if (address.userId !== userId) {
            return {
                status: 403,
                body: {
                    error: 'Not authorized to use this address',
                },
            };
        }

        const itemId = generateId('itm');
        const createdAt = new Date().toISOString();

        await pool.query(
            `INSERT INTO items (
                id, "ownerId", title, description, category, "hourlyRate", currency, 
                deposit, "minHours", "maxHours", "addressId", status, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)`,
            [
            itemId,
            userId,
            parsed.data.title,
            parsed.data.description,
            parsed.data.category,
            parsed.data.hourlyRate,
            parsed.data.currency,
            parsed.data.deposit || null,
            parsed.data.minHours,
            parsed.data.maxHours || null,
            parsed.data.addressId,
            createdAt
        ]
        );

        // Fetch created item (DB row might not have all fields if they are defaulted in code but not DB, 
        // but here we manually handle response)
        // Actually, let's construct response object to match schema, assuming defaults
        // Need to match itemSchema
        const item = {
            id: itemId,
            ownerId: userId,
            title: parsed.data.title,
            description: parsed.data.description,
            category: parsed.data.category,
            hourlyRate: parsed.data.hourlyRate,
            currency: parsed.data.currency,
            deposit: parsed.data.deposit,
            minHours: parsed.data.minHours,
            maxHours: parsed.data.maxHours,
            status: 'draft',
            images: [], // No images in create payload
            addressId: parsed.data.addressId,
            rating: undefined,
            totalReviews: 0,
            createdAt,
            updatedAt: undefined
        };

        // Emit event to trigger search indexing and inventory setup
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'item.listing_created',
            data: {
                itemId: item.id,
                ownerId: item.ownerId,
                title: item.title,
                category: item.category,
                addressId: item.addressId,
                hourlyRate: item.hourlyRate,
                createdAt: item.createdAt,
            },
        });

        return {
            status: 200,
            body: {
                item: item as any,
            },
        };
    } catch (error) {
        logger.error('Failed to create listing', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to create listing',
            },
        };
    }
};
