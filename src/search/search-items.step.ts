import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { searchFiltersSchema, searchResultSchema } from '../shared/types';

export const config: ApiRouteConfig = {
    name: 'SearchItems',
    type: 'api',
    path: '/search',
    method: 'POST',
    description: 'Geo-radius search for rental items with filters and ranking',
    emits: ['search.performed'],
    flows: ['item-discovery'],
    bodySchema: searchFiltersSchema,
    responseSchema: {
        200: searchResultSchema,
        400: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['SearchItems'] = async (req, { logger, emit }) => {
    const parsed = searchFiltersSchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid search filters', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid search filters',
            },
        };
    }

    try {
        const pool = getPool();
        const { query, category, lat, lng, radiusKm, page = 1, limit = 20 } = parsed.data; // Defaults handled in schema transform? Schema says Optional, let's assume valid

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        // 1. Text Search (Basic LIKE)
        if (query) {
            conditions.push(`(items.title LIKE $${paramIndex} OR items.description LIKE $${paramIndex + 1})`);
            params.push(`%${query}%`, `%${query}%`);
            paramIndex += 2;
        }

        // 2. Category
        if (category) {
            conditions.push(`items.category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
        }

        // 3. Geo Search (Bounding Box Approximation)
        if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
            const latDelta = radiusKm / 111;
            const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));

            conditions.push(`addresses.lat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
            params.push(lat - latDelta, lat + latDelta);
            paramIndex += 2;

            conditions.push(`addresses.lng BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
            params.push(lng - lngDelta, lng + lngDelta);
            paramIndex += 2;
        }

        // Only active items
        conditions.push("items.status = 'published'");

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const baseQuery = `
            FROM items 
            JOIN addresses ON items."addressId" = addresses.id
            ${whereClause}
        `;

        // Count
        const countQuery = `SELECT count(*) as count ${baseQuery}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Fetch
        const offset = (page - 1) * limit;
        const fetchQuery = `
            SELECT items.*, addresses.lat, addresses.lng, addresses.city, addresses.state 
            ${baseQuery}
            ORDER BY items."createdAt" DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const fetchResult = await pool.query(fetchQuery, [...params, limit, offset]);
        const rows = fetchResult.rows;

        // Hydrate images
        const items = await Promise.all(rows.map(async (row) => {
            const imagesResult = await pool.query(
                'SELECT "imageUrl" FROM item_images WHERE "itemId" = $1 ORDER BY "isPrimary" DESC, "createdAt" DESC LIMIT 1',
                [row.id]
            );
            const images = imagesResult.rows;

            // Calculate distance if needed for result payload (optional)
            // ...

            return {
                ...row,
                images: images.map(i => i.imageUrl),
                // cleanup address fields from item object if strict schema, but row has them merged
                // reconstruct item according to schema
                id: row.id,
                ownerId: row.ownerId,
                title: row.title,
                description: row.description,
                category: row.category,
                hourlyRate: row.hourlyRate,
                currency: row.currency,
                addressId: row.addressId,
                status: row.status,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                rating: row.rating,
                totalReviews: row.totalReviews,
                // Add distance?
            };
        }));

        // Track search for analytics
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'search.performed',
            data: {
                query: parsed.data.query,
                category: parsed.data.category,
                lat: parsed.data.lat,
                lng: parsed.data.lng,
                radiusKm: parsed.data.radiusKm,
                resultsCount: total,
                searchedAt: new Date().toISOString(),
            },
        });

        return {
            status: 200,
            body: {
                items: items as any, // Schema match
                total,
                page,
                limit,
                hasMore: page * limit < total,
            },
        };
    } catch (error) {
        logger.error('Failed to search items', { error });
        return {
            status: 500,
            body: {
                error: 'Search failed',
            },
        };
    }
};
