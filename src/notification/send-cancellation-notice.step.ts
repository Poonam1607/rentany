import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
// Direct notification simulation

const bookingCancelledInput = z.object({
    bookingId: z.string(),
    renterId: z.string(),
    ownerId: z.string(),
    itemId: z.string(),
    slotId: z.string(),
    refundAmount: z.number(),
    reason: z.string().optional(),
    cancelledAt: z.string(),
});

export const config: EventConfig = {
    name: 'SendCancellationNotice',
    type: 'event',
    description: 'Sends cancellation notifications to both parties',
    subscribes: ['booking.cancelled'],
    emits: [],
    flows: ['notification-workflow'],
    input: bookingCancelledInput,
};

export const handler: Handlers['SendCancellationNotice'] = async (input, { logger }) => {
    const data = bookingCancelledInput.parse(input);

    logger.info('Sending cancellation notifications', {
        bookingId: data.bookingId,
    });

    try {
        // Simulate sending notifications

        // Notify renter
        logger.info(`[SIMULATION] Email/SMS to Renter (${data.renterId}): Booking ${data.bookingId} Cancelled. Refund: ${data.refundAmount}. Reason: ${data.reason}`);

        // Notify owner
        logger.info(`[SIMULATION] Email/SMS to Owner (${data.ownerId}): Booking ${data.bookingId} Cancelled.`);

        logger.info('Cancellation notifications sent', {
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to send cancellation notifications', {
            error,
            bookingId: data.bookingId,
        });
    }
};
