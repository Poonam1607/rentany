import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';

const refundRequestedInput = z.object({
    bookingId: z.string(),
    paymentId: z.string(),
    refundAmount: z.number(),
    reason: z.string(),
    requestedAt: z.string(),
});

export const config: EventConfig = {
    name: 'ProcessRefund',
    type: 'event',
    description: 'Processes refund request with PSP',
    subscribes: ['payment.refund_requested'],
    emits: ['payment.refunded'],
    flows: ['refund-workflow'],
    input: refundRequestedInput,
};

export const handler: Handlers['ProcessRefund'] = async (input, { logger, emit }) => {
    const data = refundRequestedInput.parse(input);

    logger.info('Processing refund request', {
        bookingId: data.bookingId,
        paymentId: data.paymentId,
        refundAmount: data.refundAmount,
    });

    try {
        const pool = getPool();

        // Simulate Refund PG call
        // In real app, call Stripe/Razorpay refund API

        const refundId = generateId('ref');
        const status = 'refunded';

        // Update payment status
        await pool.query(
            'UPDATE payments SET status = $1 WHERE id = $2',
            [status, data.paymentId]
        );
        // Maybe also insert into refunds table if exists (not in basic schema I saw, but good practice). 
        // For now, updating payments status is sufficient for MVP.

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'payment.refunded',
            data: {
                refundId,
                paymentId: data.paymentId,
                bookingId: data.bookingId,
                amount: data.refundAmount,
                status,
                refundedAt: new Date().toISOString(),
            },
        });

        logger.info('Refund processed successfully', {
            refundId,
            bookingId: data.bookingId,
        });
    } catch (error) {
        logger.error('Failed to process refund', {
            error,
            bookingId: data.bookingId,
            paymentId: data.paymentId,
        });

        // TODO: Emit refund_failed event for manual review
    }
};
