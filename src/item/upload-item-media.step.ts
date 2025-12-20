import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractLastPathSegment } from '../shared/route-utils';

const uploadMediaBodySchema = z.object({
    imageUrl: z.string().url(),
    isPrimary: z.boolean().default(false),
});

export const config: ApiRouteConfig = {
    name: 'UploadItemMedia',
    type: 'api',
    path: '/items/:itemId/media',
    method: 'POST',
    description: 'Uploads and processes media for a rental listing',
    emits: ['item.media_uploaded'],
    flows: ['item-management'],
    bodySchema: uploadMediaBodySchema,
    responseSchema: {
        200: z.object({
            imageUrl: z.string(),
            thumbnailUrl: z.string().optional(),
            mediaId: z.string(),
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

export const handler: Handlers['UploadItemMedia'] = async (req, { logger, emit }) => {
    const parsed = uploadMediaBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid media upload payload', { issues: parsed.error.issues });
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

    const itemId = extractLastPathSegment((req as any).path || '');
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
        const itemResult = await pool.query(
            'SELECT "ownerId" FROM items WHERE id = $1',
            [itemId]
        );
        const item = itemResult.rows[0] as { ownerId: string } | undefined;

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
                    error: 'Not authorized to upload media for this item',
                },
            };
        }

        // If isPrimary is true, unset other primary images for this item?
        // Simpler for now: just insert. 
        if (parsed.data.isPrimary) {
            await pool.query(
            'UPDATE item_images SET "isPrimary" = 0 WHERE "itemId" = $1',
            [itemId]
        );
        }

        const mediaId = generateId('img');
        const uploadedAt = new Date().toISOString();

        await pool.query(
            `INSERT INTO item_images (id, "itemId", "imageUrl", "isPrimary", "createdAt")
            VALUES ($1, $2, $3, $4, $5)`,
            [mediaId, itemId, parsed.data.imageUrl, parsed.data.isPrimary ? 1 : 0, uploadedAt]
        );

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'item.media_uploaded',
            data: {
                itemId,
                mediaId,
                imageUrl: parsed.data.imageUrl,
                isPrimary: parsed.data.isPrimary,
                uploadedAt,
            },
        });

        return {
            status: 200,
            body: {
                imageUrl: parsed.data.imageUrl,
                thumbnailUrl: undefined, // Simulating no thumbnail generation for now
                mediaId,
            },
        };
    } catch (error: any) {
        if (error.status === 404) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        logger.error('Failed to upload media', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to upload media',
            },
        };
    }
};
