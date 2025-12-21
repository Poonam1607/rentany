import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

const createPaymentIntentBodySchema = z.object({
    bookingId: z.string(),
    amount: z.number().min(0),
    currency: z.string().default('INR'),
});

export const config: ApiRouteConfig = {
    name: 'CreatePaymentIntent',
    type: 'api',
    path: '/payments/intents',
    method: 'POST',
    description: 'Creates a payment intent for booking',
    emits: ['payment.intent_created'],
    flows: ['payment-workflow'],
    bodySchema: createPaymentIntentBodySchema,
    responseSchema: {
        200: z.object({
            paymentId: z.string(),
            clientSecret: z.string(),
            amount: z.number(),
            currency: z.string(),
        }),
        400: z.object({
            error: z.string(),
        }),
        401: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['CreatePaymentIntent'] = async (req, { logger, emit }) => {
    const parsed = createPaymentIntentBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid payment intent payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    const userId = getUserIdFromHeader(req.headers);
    if (!userId) {
        return {
            status: 401,
            body: {
                error: 'Authentication required',
            },
        };
    }

    try {
        const pool = getPool();

        // Simulate PG interaction
        // In real app, call Stripe/Razorpay API here to get client_secret
        const paymentId = generateId('pay');
        const clientSecret = `seti_simulated_${paymentId}_secret`;
        const { bookingId, amount, currency } = parsed.data;

        // Insert payment record
        await pool.query(
            `INSERT INTO payments (id, "bookingId", "userId", amount, currency, status, "providerPaymentId", "clientSecret", "createdAt")
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)`,
            [paymentId, bookingId, userId, amount, currency, `pg_${paymentId}`, clientSecret, new Date().toISOString()]
        );

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'payment.intent_created',
            data: {
                paymentId,
                bookingId,
                amount,
                currency,
                createdAt: new Date().toISOString(),
            },
        });

        return {
            status: 200,
            body: {
                paymentId,
                clientSecret,
                amount,
                currency,
            },
        };
    } catch (error) {
        logger.error('Failed to create payment intent', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to create payment intent',
            },
        };
    }
};
