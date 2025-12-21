import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { itemSchema, itemCategorySchema } from '../shared/types';

const listItemsQuerySchema = z.object({
    category: itemCategorySchema.optional(),
    ownerId: z.string().optional(),
    status: z.string().optional(),
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
});

export const config: ApiRouteConfig = {
    name: 'ListItems',
    type: 'api',
    path: '/items',
    method: 'GET',
    description: 'Lists rental items with pagination and basic filters',
    emits: [],
    flows: ['item-browsing'],

    responseSchema: {
        200: z.object({
            items: z.array(itemSchema),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
            hasMore: z.boolean(),
        }),
        400: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['ListItems'] = async (req, { logger }) => {
    const queryObject = (req as any).queryParams || {};

    const parsed = listItemsQuerySchema.safeParse(queryObject);

    if (!parsed.success) {
        logger.warn('Invalid list items query', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid query parameters',
            },
        };
    }

    try {
        const pool = getPool();

        const conditions: string[] = [];
        const params: any[] = [];

        if (parsed.data.category) {
            conditions.push(`category = $${params.length + 1}`);
            params.push(parsed.data.category);
        }
        if (parsed.data.ownerId) {
            conditions.push(`"ownerId" = $${params.length + 1}`);
            params.push(parsed.data.ownerId);
        }
        if (parsed.data.status) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(parsed.data.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total
        const totalResult = await pool.query(
            `SELECT count(*) as count FROM items ${whereClause}`,
            params
        );
        const total = Number(totalResult.rows[0].count);

        // Fetch items
        const { page, limit } = parsed.data;
        const offset = (page - 1) * limit;

        params.push(limit, offset);
        const rowsResult = await pool.query(
            `SELECT * FROM items 
            ${whereClause} 
            ORDER BY "createdAt" DESC 
            LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const rows = rowsResult.rows as any[];

        const items = await Promise.all(rows.map(async (row) => {
            const imagesResult = await pool.query(
                'SELECT id, "imageUrl", "isPrimary" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC',
                [row.id]
            );
            const images = imagesResult.rows;

            return {
                ...row,
                images: images,
                hourlyRate: row.hourlyRate,
                totalReviews: row.totalReviews || 0,
                status: row.status as any,
                category: row.category as any,
            };
        }));

        return {
            status: 200,
            body: {
                items,
                total,
                page,
                limit,
                hasMore: page * limit < total,
            },
        };
    } catch (error) {
        logger.error('Failed to list items', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to retrieve items',
            },
        };
    }
};
