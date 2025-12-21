import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const releaseSlotBodySchema = z.object({
    slotId: z.string(),
    reason: z.enum(['cancelled', 'payment_failed', 'expired_hold', 'manual']),
});

export const config: ApiRouteConfig = {
    name: 'ReleaseSlot',
    type: 'api',
    path: '/inventory/release',
    method: 'POST',
    description: 'Releases a held or booked slot back to free status',
    emits: ['inventory.slot_released'],
    flows: ['booking-workflow', 'cancellation-workflow'],
    bodySchema: releaseSlotBodySchema,
    responseSchema: {
        200: z.object({
            slotId: z.string(),
            status: z.literal('free'),
            releasedAt: z.string(),
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

export const handler: Handlers['ReleaseSlot'] = async (req, { logger, emit }) => {
    const parsed = releaseSlotBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid slot release payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const { slotId, reason } = parsed.data;

    try {
        const pool = getPool();
        const releasedAt = new Date().toISOString();

        const slotResult = await pool.query(
            'SELECT "itemId" FROM inventory_slots WHERE id = $1',
            [slotId]
        );
        const slot = slotResult.rows[0] as { itemId: string } | undefined;

        if (!slot) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found',
                },
            };
        }

        const result = await pool.query(
            `UPDATE inventory_slots 
            SET status = 'free'
            WHERE id = $1`,
            [slotId]
        );

        if (result.changes === 0) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found',
                },
            };
        }

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'inventory.slot_released',
            data: {
                slotId,
                itemId: slot.itemId,
                reason,
                releasedAt,
            },
        });

        logger.info('Slot released', { slotId, reason });

        return {
            status: 200,
            body: {
                slotId,
                status: 'free',
                releasedAt,
            },
        };
    } catch (error: any) {
        if (error.status === 404) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found',
                },
            };
        }

        logger.error('Failed to release slot', { error, slotId });
        return {
            status: 500,
            body: {
                error: 'Failed to release slot',
            },
        };
    }
};
