import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';

export const config: ApiRouteConfig = {
    name: 'HandlePaymentWebhook',
    type: 'api',
    path: '/payments/webhook',
    method: 'POST',
    description: 'Receives PSP (Stripe/etc.) webhooks and delegates to Payment service',
    emits: [],
    flows: ['payment-workflow'],
    bodySchema: z.object({}), // Webhook payloads vary by provider
    responseSchema: {
        200: z.object({
            received: z.boolean(),
        }),
        400: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['HandlePaymentWebhook'] = async (req, { logger }) => {
    try {
        const pool = getPool();

        // This handler mimics a webhook receiver (e.g. Stripe)
        const event = req.body as any;
        const type = event.type;

        // Simplified webhook processing
        // Real implementation would verify signature: req.headers['stripe-signature']

        if (type === 'payment_intent.succeeded') {
            const paymentId = event.data.object.id; // Provider ID
            // Find our payment ID by provider ID
            const paymentResult = await pool.query(
                'SELECT id FROM payments WHERE "providerPaymentId" = $1',
                [paymentId]
            );
            const payment = paymentResult.rows[0] as { id: string };

            if (payment) {
                await pool.query(
                    `UPDATE payments SET status = 'paid', "updatedAt" = $1 WHERE id = $2`,
                    [new Date().toISOString(), payment.id]
                );
                // We might also emit 'payment.succeeded' here? 
                // Currently 'payment.intent_created' is emitted earlier.
                // The logical flow usually converts intent -> success.
            }
        } else if (type === 'payment_intent.payment_failed') {
            const paymentId = event.data.object.id;
            const paymentResult = await pool.query(
                'SELECT id FROM payments WHERE "providerPaymentId" = $1',
                [paymentId]
            );
            const payment = paymentResult.rows[0] as { id: string };

            if (payment) {
                await pool.query(
                    `UPDATE payments SET status = 'failed', "updatedAt" = $1 WHERE id = $2`,
                    [new Date().toISOString(), payment.id]
                );
            }
        }

        logger.info('Payment webhook processed', { type });

        return {
            status: 200,
            body: {
                received: true,
            },
        };
    } catch (error) {
        logger.error('Failed to process payment webhook', { error });
        return {
            status: 500,
            body: {
                error: 'Webhook processing failed',
            },
        };
    }
};
