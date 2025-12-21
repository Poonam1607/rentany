import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
// Direct notification simulation

const paymentFailedInput = z.object({
    bookingId: z.string(),
    renterId: z.string(),
    itemId: z.string(),
    paymentId: z.string(),
    reason: z.string(),
    failedAt: z.string(),
});

export const config: EventConfig = {
    name: 'SendPaymentFailedAlert',
    type: 'event',
    description: 'Sends payment failure notification to user',
    subscribes: ['booking.payment_failed'],
    emits: [],
    flows: ['notification-workflow'],
    input: paymentFailedInput,
};

export const handler: Handlers['SendPaymentFailedAlert'] = async (input, { logger }) => {
    const data = paymentFailedInput.parse(input);

    logger.info('Sending payment failed notification', {
        bookingId: data.bookingId,
        renterId: data.renterId,
    });

    try {
        // Simulate sending notification
        logger.info(`[SIMULATION] Email/SMS to Renter (${data.renterId}): Payment Failed for Booking ${data.bookingId}. Reason: ${data.reason}`);

        logger.info('Payment failed notification sent', {
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to send payment failed notification', {
            error,
            bookingId: data.bookingId,
        });
    }
};
