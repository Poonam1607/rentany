import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const stuckBookingInput = z.object({
    bookingId: z.string(),
    renterId: z.string(),
    itemId: z.string(),
    slotId: z.string(),
    createdAt: z.string(),
    detectedAt: z.string(),
});

export const config: EventConfig = {
    name: 'RecoverStuckBooking',
    type: 'event',
    description: 'Recovers stuck booking by cancelling and releasing resources',
    subscribes: ['booking.stuck'],
    emits: ['booking.auto_cancelled'],
    flows: ['recovery-resilience'],
    input: stuckBookingInput,
};

export const handler: Handlers['RecoverStuckBooking'] = async (input, { logger, emit }) => {
    const data = stuckBookingInput.parse(input);

    logger.warn('Recovering stuck booking', {
        bookingId: data.bookingId,
        createdAt: data.createdAt,
    });

    try {
        const pool = getPool();

        // Step 1: Cancel the booking
        await pool.query(
            `UPDATE bookings 
            SET status = 'cancelled', "cancelledAt" = $1, "cancellationReason" = $2
            WHERE id = $3`,
            [new Date().toISOString(), 'Payment timeout - auto-cancelled by system', data.bookingId]
        );

        // Step 2: Release inventory slot
        await pool.query(
            `UPDATE inventory_slots SET status = 'free', "bookingId" = NULL WHERE id = $1`,
            [data.slotId]
        );

        // Step 4: Notify user (Simulated)
        logger.info(`[SIMULATION] Email to Renter (${data.renterId}): Booking ${data.bookingId} auto-cancelled. Reason: Payment timeout.`);

        // Emit recovery event
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'booking.auto_cancelled',
            data: {
                bookingId: data.bookingId,
                renterId: data.renterId,
                itemId: data.itemId,
                slotId: data.slotId,
                recoveredAt: new Date().toISOString(),
            },
        });

        logger.info('Stuck booking recovered successfully', {
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to recover stuck booking', {
            error,
            bookingId: data.bookingId,
        });

        // TODO: Alert admin for manual intervention
    }
};
