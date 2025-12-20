import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { validateTimeRange, generateHoldExpiration } from '../shared/pricing-utils';
import { inventorySlotSchema } from '../shared/types';

const reserveSlotBodySchema = z.object({
    itemId: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    holdMinutes: z.number().min(5).max(30).default(15),
});

export const config: ApiRouteConfig = {
    name: 'ReserveSlot',
    type: 'api',
    path: '/inventory/reserve',
    method: 'POST',
    description: 'Creates a temporary hold on an inventory slot for booking',
    emits: ['inventory.slot_reserved'],
    flows: ['booking-workflow'],
    bodySchema: reserveSlotBodySchema,
    responseSchema: {
        200: z.object({
            slot: inventorySlotSchema,
            holdExpiresAt: z.string(),
        }),
        400: z.object({
            error: z.string(),
        }),
        409: z.object({
            error: z.string(),
            message: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['ReserveSlot'] = async (req, { logger, emit }) => {
    const parsed = reserveSlotBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid slot reservation payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const { itemId, startAt, endAt, holdMinutes } = parsed.data;

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
        const holdExpiresAt = generateHoldExpiration(holdMinutes);
        const slotId = generateId('slot');
        const createdAt = new Date().toISOString();

        // Check for conflicting slots (held or booked)
        const conflictResult = await pool.query(
            `SELECT id 
            FROM inventory_slots
            WHERE "itemId" = $1
              AND status IN ('held', 'booked')
              AND "startAt" < $2
              AND "endAt" > $3`,
            [itemId, endAt, startAt]
        );
        const conflict = conflictResult.rows[0];

        if (conflict) {
            return {
                status: 409,
                body: {
                    error: 'Slot not available',
                    message: 'The requested time slot is already reserved or booked',
                },
            };
        }

        // Create slot
        await pool.query(
            `INSERT INTO inventory_slots (id, "itemId", "startAt", "endAt", status, "holdExpiresAt", "createdAt")
            VALUES ($1, $2, $3, $4, 'held', $5, $6)`,
            [slotId, itemId, startAt, endAt, holdExpiresAt, createdAt]
        );

        // Fetch created slot to return
        const slotResult = await pool.query(
            'SELECT * FROM inventory_slots WHERE id = $1',
            [slotId]
        );
        const slot = slotResult.rows[0];

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'inventory.slot_reserved',
            data: {
                slotId: slot.id,
                itemId,
                startAt,
                endAt,
                holdExpiresAt,
                reservedAt: new Date().toISOString(),
            },
        });

        logger.info('Slot reserved successfully', {
            slotId: slot.id,
            itemId,
            holdExpiresAt,
        });

        return {
            status: 200,
            body: {
                slot,
                holdExpiresAt,
            },
        };
    } catch (error: any) {
        if (error.status === 409) {
            logger.warn('Slot conflict during reservation', { error, itemId });
            return {
                status: 409,
                body: {
                    error: 'Slot not available',
                    message: 'The requested time slot is already reserved or booked',
                },
            };
        }

        logger.error('Failed to reserve slot', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to reserve slot',
            },
        };
    }
};
