import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

const paymentSucceededInput = z.object({
    paymentId: z.string(),
    bookingId: z.string(),
    amount: z.number(),
    currency: z.string(),
    providerChargeId: z.string(),
});

export const config: EventConfig = {
    name: 'ConfirmBooking',
    type: 'event',
    description: 'Confirms booking after successful payment (saga continuation)',
    subscribes: ['payment.succeeded'],
    emits: ['booking.confirmed'],
    flows: ['booking-workflow'],
    input: paymentSucceededInput,
};

export const handler: Handlers['ConfirmBooking'] = async (input, { logger, emit }) => {
    const data = paymentSucceededInput.parse(input);

    logger.info('Processing payment success for booking confirmation', {
        bookingId: data.bookingId,
        paymentId: data.paymentId,
    });

    try {
        const pool = getPool();

        // Step 1: Update booking status
        await pool.query(
            'UPDATE bookings SET status = $1, "paymentId" = $2 WHERE id = $3',
            ['confirmed', data.paymentId, data.bookingId]
        );

        // Get booking details for slotId extraction
        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [data.bookingId]
        );
        const booking = bookingResult.rows[0] as any;

        if (!booking) {
            logger.error('Booking not found during confirmation', { bookingId: data.bookingId });
            throw new Error('Booking not found');
        }

        // Step 2: Confirm inventory reservation (held → booked)
        await pool.query(
            `UPDATE inventory_slots SET status = 'booked' WHERE id = $1`,
            [booking.slotId]
        );

        // Emit booking confirmed event (triggers notifications)
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'booking.confirmed',
            data: {
                bookingId: data.bookingId,
                renterId: booking.renterId,
                ownerId: booking.ownerId,
                itemId: booking.itemId,
                slotId: booking.slotId,
                paymentId: data.paymentId,
                amount: data.amount,
                confirmedAt: new Date().toISOString(),
            },
        });

        logger.info('Booking confirmed successfully', {
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to confirm booking after payment', {
            error,
            bookingId: data.bookingId,
            paymentId: data.paymentId,
        });

        // TODO: Trigger manual review or retry mechanism
        // This is a critical failure - payment succeeded but booking not confirmed
    }
};
