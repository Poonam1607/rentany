import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { calculateBookingPrice, validateTimeRange, generateHoldExpiration } from '../shared/pricing-utils';
import { bookingSchema } from '../shared/types';
import { HttpError } from '../shared/http-client';

const createBookingBodySchema = z.object({
    itemId: z.string(),
    startAt: z.string(),
    endAt: z.string(),
});

export const config: ApiRouteConfig = {
    name: 'CreateBooking',
    type: 'api',
    path: '/bookings',
    method: 'POST',
    description: 'Creates a booking with payment intent (orchestrates booking saga)',
    emits: ['booking.created'],
    flows: ['booking-workflow'],
    bodySchema: createBookingBodySchema,
    responseSchema: {
        200: z.object({
            booking: bookingSchema,
            paymentClientSecret: z.string(),
            holdExpiresAt: z.string(),
        }),
        400: z.object({
            error: z.string(),
        }),
        401: z.object({
            error: z.string(),
        }),
        409: z.object({
            error: z.string(),
            message: z.string(),
        }),
        404: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['CreateBooking'] = async (req, { logger, emit }) => {
    const parsed = createBookingBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid booking creation payload', { issues: parsed.error.issues });
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

    const { itemId, startAt, endAt } = parsed.data;

    // Validate time range
    const timeValidation = validateTimeRange(startAt, endAt);
    if (!timeValidation.valid) {
        return {
            status: 400,
            body: {
                error: timeValidation.error || 'Invalid time range',
            },
        };
    }

    try {
        const pool = getPool();

        // Execute orchestration (PostgreSQL doesn't have db.transaction like SQLite)
        // In production, use pool.connect() and client.query() with BEGIN/COMMIT/ROLLBACK
        // For now, we run queries directly

        // Step 1: Get item details
        const itemResult = await pool.query(
            'SELECT * FROM items WHERE id = $1',
            [itemId]
        );
        const item = itemResult.rows[0] as any;
        if (!item) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        // Step 2: Calculate pricing
        const pricing = calculateBookingPrice({
            startAt,
            endAt,
            hourlyRate: item.hourlyRate,
            deposit: item.deposit,
            currency: item.currency,
            taxRate: 0.18,
            serviceFeeRate: 0.05,
        });

        // Step 3: Reserve inventory slot
        // Check conflicts
        const conflictResult = await pool.query(
            `SELECT id FROM inventory_slots 
            WHERE "itemId" = $1 AND status IN ('held', 'booked') 
            AND (("startAt" < $2 AND "endAt" > $3) OR ("startAt" >= $4 AND "startAt" < $5))`,
            [itemId, endAt, startAt, startAt, endAt]
        );
        const conflict = conflictResult.rows[0];

        if (conflict) {
            return {
                status: 409,
                body: {
                    error: 'Slot not available',
                    message: 'The requested time slot is unavailable',
                },
            };
        }

        const slotId = generateId('slot');
        const holdExpiresAt = generateHoldExpiration(15);
        await pool.query(
            `INSERT INTO inventory_slots (id, "itemId", "startAt", "endAt", status, "holdExpiresAt", "createdAt")
            VALUES ($1, $2, $3, $4, 'held', $5, $6)`,
            [slotId, itemId, startAt, endAt, holdExpiresAt, new Date().toISOString()]
        );

        // Step 4: Create booking record
        const bookingId = generateId('bk');
        const booking = {
            id: bookingId,
            renterId: userId,
            ownerId: item.ownerId,
            itemId,
            slotId,
            startAt,
            endAt,
            hours: pricing.hours,
            hourlyRate: item.hourlyRate,
            totalAmount: pricing.total,
            deposit: item.deposit || 0,
            currency: item.currency,
            status: 'pending_payment',
            createdAt: new Date().toISOString()
        };

        await pool.query(
            `INSERT INTO bookings (id, "renterId", "ownerId", "itemId", "slotId", "startAt", "endAt", hours, "hourlyRate", "totalAmount", deposit, currency, status, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                booking.id, booking.renterId, booking.ownerId, booking.itemId, booking.slotId,
                booking.startAt, booking.endAt, booking.hours, booking.hourlyRate,
                booking.totalAmount, booking.deposit, booking.currency, booking.status, booking.createdAt
            ]
        );

        // Link slot to booking
        await pool.query(
            'UPDATE inventory_slots SET "bookingId" = $1 WHERE id = $2',
            [bookingId, slotId]
        );

        // Step 5: Create payment intent
        const paymentId = generateId('pay');
        const clientSecret = `seti_simulated_${paymentId}_secret`;

        await pool.query(
            `INSERT INTO payments (id, "bookingId", "userId", amount, currency, status, "providerPaymentId", "clientSecret", "createdAt")
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)`,
            [paymentId, bookingId, userId, pricing.total, item.currency, `pg_${paymentId}`, clientSecret, new Date().toISOString()]
        );

        // Update booking with paymentId
        await pool.query(
            'UPDATE bookings SET "paymentId" = $1 WHERE id = $2',
            [paymentId, bookingId]
        );

        const result = {
            booking,
            paymentId,
            clientSecret,
            holdExpiresAt
        };

        // Emit event
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'booking.created',
            data: {
                bookingId: result.booking.id,
                renterId: result.booking.renterId,
                ownerId: result.booking.ownerId,
                itemId: result.booking.itemId,
                slotId: result.booking.slotId,
                amount: result.booking.totalAmount,
                currency: result.booking.currency,
                paymentId: result.paymentId,
                createdAt: result.booking.createdAt,
            },
        });

        logger.info('Booking created successfully', {
            bookingId: result.booking.id,
            paymentId: result.paymentId,
        });

        return {
            status: 200,
            body: {
                booking: result.booking as any,
                paymentClientSecret: result.clientSecret,
                holdExpiresAt: result.holdExpiresAt,
            },
        };

    } catch (error: any) {
        if (error.status === 409) {
            return {
                status: 409,
                body: {
                    error: 'Slot not available',
                    message: 'The requested time slot is unavailable',
                },
            };
        }
        if (error.status === 404) {
            return {
                status: 404,
                body: {
                    error: 'Item not found',
                },
            };
        }

        logger.error('Failed to create booking', { error, itemId });
        return {
            status: 500,
            body: {
                error: 'Failed to create booking',
            },
        };
    }
};
