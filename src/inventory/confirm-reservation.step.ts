import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const confirmReservationBodySchema = z.object({
    slotId: z.string(),
    bookingId: z.string(),
});

export const config: ApiRouteConfig = {
    name: 'ConfirmReservation',
    type: 'api',
    path: '/inventory/confirm',
    method: 'POST',
    description: 'Transitions slot from held to booked status after payment success',
    emits: ['inventory.slot_booked'],
    flows: ['booking-workflow'],
    bodySchema: confirmReservationBodySchema,
    responseSchema: {
        200: z.object({
            slotId: z.string(),
            status: z.literal('booked'),
            bookingId: z.string(),
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

export const handler: Handlers['ConfirmReservation'] = async (req, { logger, emit }) => {
    const parsed = confirmReservationBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid reservation confirmation payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const { slotId, bookingId } = parsed.data;

    try {
        const pool = getPool();
        const itemIdResult = await pool.query(
            'SELECT "itemId" FROM inventory_slots WHERE id = $1',
            [slotId]
        );
        const itemId = itemIdResult.rows[0] as { itemId: string } | undefined;

        if (!itemId) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found or hold expired',
                },
            };
        }

        const result = await pool.query(
            `UPDATE inventory_slots 
            SET status = 'booked', "bookingId" = $1 
            WHERE id = $2`,
            [bookingId, slotId]
        );

        if (result.changes === 0) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found or hold expired',
                },
            };
        }

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'inventory.slot_booked',
            data: {
                slotId,
                itemId: itemId.itemId,
                bookingId,
                confirmedAt: new Date().toISOString(),
            },
        });

        logger.info('Reservation confirmed', { slotId, bookingId });

        return {
            status: 200,
            body: {
                slotId,
                status: 'booked',
                bookingId,
            },
        };
    } catch (error: any) {
        if (error.status === 404) {
            return {
                status: 404,
                body: {
                    error: 'Slot not found or hold expired',
                },
            };
        }

        logger.error('Failed to confirm reservation', { error, slotId });
        return {
            status: 500,
            body: {
                error: 'Failed to confirm reservation',
            },
        };
    }
};
