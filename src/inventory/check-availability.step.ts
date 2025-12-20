import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { validateTimeRange } from '../shared/pricing-utils';

const checkAvailabilityBodySchema = z.object({
    itemId: z.string(),
    startAt: z.string(),
    endAt: z.string(),
});

export const config: ApiRouteConfig = {
    name: 'CheckAvailability',
    type: 'api',
    path: '/inventory/check-availability',
    method: 'POST',
    description: 'Checks if an item is available for the requested time range',
    emits: [],
    flows: ['booking-workflow'],
    bodySchema: checkAvailabilityBodySchema,
    responseSchema: {
        200: z.object({
            available: z.boolean(),
            conflictingSlots: z.array(z.object({
                slotId: z.string(),
                startAt: z.string(),
                endAt: z.string(),
                status: z.string(),
            })).optional(),
        }),
        400: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['CheckAvailability'] = async (req, { logger }) => {
    const parsed = checkAvailabilityBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid availability check payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const { itemId, startAt, endAt } = parsed.data;

    // Validate time range
    const timeValidation = validateTimeRange(startAt, endAt);
    if (!timeValidation.valid) {
        return {
            status: 400,
            body: {
                error: timeValidation.error || 'Invalid time range',
            },
        };
    }

    try {
        const pool = getPool();

        // Check for conflicting slots (held or booked)
        // Overlap condition: existing.start < requested.end AND existing.end > requested.start
        const conflictingSlotsResult = await pool.query(
            `SELECT id as "slotId", "startAt", "endAt", status
            FROM inventory_slots
            WHERE "itemId" = $1
              AND status IN ('held', 'booked')
              AND "startAt" < $2
              AND "endAt" > $3`, [itemId, endAt, startAt]
        );
        const conflictingSlots = conflictingSlotsResult.rows as { slotId: string; startAt: string; endAt: string; status: string }[];

        const available = conflictingSlots.length === 0;

        return {
            status: 200,
            body: {
                available,
                conflictingSlots: available ? undefined : conflictingSlots,
            },
        };
    } catch (error) {
        logger.error('Failed to check availability', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to check availability',
            },
        };
    }
};
