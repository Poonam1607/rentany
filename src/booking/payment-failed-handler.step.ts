import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const paymentFailedInput = z.object({
    paymentId: z.string(),
    bookingId: z.string(),
    reason: z.string(),
    providerErrorCode: z.string().optional(),
});

export const config: EventConfig = {
    name: 'PaymentFailedHandler',
    type: 'event',
    description: 'Handles payment failure by cancelling booking and releasing slot',
    subscribes: ['payment.failed'],
    emits: ['booking.payment_failed'],
    flows: ['booking-workflow', 'recovery-resilience'],
    input: paymentFailedInput,
};

export const handler: Handlers['PaymentFailedHandler'] = async (input, { logger, emit }) => {
    const data = paymentFailedInput.parse(input);

    logger.warn('Processing payment failure', {
        bookingId: data.bookingId,
        paymentId: data.paymentId,
        reason: data.reason,
    });

    try {
        const pool = getPool();

        // Step 1: Update booking status to payment_failed
        await pool.query(
            `UPDATE bookings SET status = 'payment_failed' WHERE id = $1`,
            [data.bookingId]
        );

        // Get booking to find slotId
        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [data.bookingId]
        );
        const booking = bookingResult.rows[0] as any;

        if (!booking) {
            logger.warn('Booking not found during payment failure handling', { bookingId: data.bookingId });
            return;
        }

        // Step 2: Release inventory slot
        await pool.query(
            `UPDATE inventory_slots SET status = 'free', "bookingId" = NULL WHERE id = $1`,
            [booking.slotId]
        );

        // Emit payment failure event (triggers notification)
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'booking.payment_failed',
            data: {
                bookingId: data.bookingId,
                renterId: booking.renterId,
                itemId: booking.itemId,
                paymentId: data.paymentId,
                reason: data.reason,
                failedAt: new Date().toISOString(),
            },
        });

        logger.info('Payment failure handled, booking cancelled and slot released', {
            bookingId: data.bookingId,
            slotId: booking.slotId,
        });
    } catch (error) {
        logger.error('Failed to handle payment failure', {
            error,
            bookingId: data.bookingId,
        });
    }
};
