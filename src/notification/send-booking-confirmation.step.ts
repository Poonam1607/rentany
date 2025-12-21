import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
// Direct notification simulation (no HTTP service)

const bookingConfirmedInput = z.object({
    bookingId: z.string(),
    renterId: z.string(),
    ownerId: z.string(),
    itemId: z.string(),
    slotId: z.string(),
    paymentId: z.string(),
    amount: z.number(),
    confirmedAt: z.string(),
});

export const config: EventConfig = {
    name: 'SendBookingConfirmation',
    type: 'event',
    description: 'Sends booking confirmation emails/SMS to renter and owner',
    subscribes: ['booking.confirmed'],
    emits: [],
    flows: ['notification-workflow'],
    input: bookingConfirmedInput,
};

export const handler: Handlers['SendBookingConfirmation'] = async (input, { logger }) => {
    const data = bookingConfirmedInput.parse(input);

    logger.info('Sending booking confirmation notifications', {
        bookingId: data.bookingId,
    });

    try {
        // Simulate sending notifications (e.g. via SendGrid/Twilio SDKs in future)
        // For now, just log that we would send them.

        // Send to renter
        logger.info(`[SIMULATION] Email/SMS to Renter (${data.renterId}): Booking ${data.bookingId} Confirmed. Item: ${data.itemId}, Amount: ${data.amount}`);

        // Send to owner
        logger.info(`[SIMULATION] Email/SMS to Owner (${data.ownerId}): Booking ${data.bookingId} Confirmed. Item: ${data.itemId}, Amount: ${data.amount}`);

        logger.info('Booking confirmation notifications sent', {
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to send booking confirmation', {
            error,
            bookingId: data.bookingId,
        });
        // Non-critical failure - don't throw
    }
};
