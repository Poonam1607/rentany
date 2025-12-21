import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { extractLastPathSegment } from '../shared/route-utils';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { extractAuthToken } from '../shared/http-client';
import { calculateRefund } from '../shared/pricing-utils';

const cancelBookingBodySchema = z.object({
    reason: z.string().max(500).optional(),
});

export const config: ApiRouteConfig = {
    name: 'CancelBooking',
    type: 'api',
    path: '/bookings/:bookingId/cancel',
    method: 'POST',
    description: 'Cancels a booking with refund calculation based on policy',
    emits: ['booking.cancelled', 'payment.refund_requested'],
    flows: ['cancellation-workflow'],
    bodySchema: cancelBookingBodySchema,
    responseSchema: {
        200: z.object({
            bookingId: z.string(),
            status: z.literal('cancelled'),
            refundAmount: z.number(),
            refundPercentage: z.number(),
            cancelledAt: z.string(),
        }),
        400: z.object({
            error: z.string(),
        }),
        401: z.object({
            error: z.string(),
        }),
        403: z.object({
            error: z.string(),
        }),
        404: z.object({
            error: z.string(),
        }),
        500: z.object({
            error: z.string(),
        }),
    },
};

export const handler: Handlers['CancelBooking'] = async (req, { logger, emit }) => {
    const parsed = cancelBookingBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid cancellation payload', { issues: parsed.error.issues });
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

    const bookingId = extractLastPathSegment((req as any).path || '');
    if (!bookingId) {
        return {
            status: 400,
            body: {
                error: 'Booking ID is required',
            },
        };
    }

    try {
        const pool = getPool();
        let refundCalc: any;
        let booking: any;
        let cancelledAt: string;

        // Step 1: Get booking details
        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [bookingId]
        );
        booking = bookingResult.rows[0] as any;

        if (!booking) {
            const err = new Error('Booking not found');
            (err as any).status = 404;
            throw err;
        }

        // Authorization check (Owner or Renter)
        // Ideally ADMIN too
        if (booking.renterId !== userId && booking.ownerId !== userId) {
            const err = new Error('Not authorized');
            (err as any).status = 403;
            throw err;
        }

        // Validate cancellation is allowed
        if (booking.status === 'cancelled' || booking.status === 'completed') {
            const err = new Error(`Cannot cancel booking with status: ${booking.status}`);
            (err as any).status = 400;
            throw err;
        }

        // Step 2: Calculate refund
        cancelledAt = new Date().toISOString();
        refundCalc = calculateRefund({
            bookingStartAt: booking.startAt,
            cancelledAt,
            totalAmount: booking.totalAmount,
            deposit: booking.deposit,
        });

        // Step 3: Update booking status
        await pool.query(
            `UPDATE bookings 
                SET status = 'cancelled', "cancelledAt" = $1, "cancellationReason" = $2, "refundAmount" = $3
                WHERE id = $4`,
            [cancelledAt, parsed.data.reason, refundCalc.refundAmount, bookingId]
        );

        // Step 4: Release inventory slot
        // Actually we should set it to 'free' or delete if it's cleaner? 
        // The logic says "release". `release` usually sets status = 'free' or deletes if using "time-slot" model.
        // Our schema has status 'free' | 'held' | 'booked'.
        await pool.query(
            `UPDATE inventory_slots SET status = 'free', "bookingId" = NULL WHERE id = $1`,
            [booking.slotId]
        );

        // Step 5: Request refund if payment was made
        if (booking.paymentId && refundCalc.refundAmount > 0) {
            // @ts-ignore
            // @ts-ignore
            await emit({
                topic: 'payment.refund_requested',
                data: {
                    bookingId,
                    paymentId: booking.paymentId,
                    refundAmount: refundCalc.refundAmount,
                    reason: 'booking_cancelled',
                    requestedAt: cancelledAt,
                },
            });
        }

        // Emit cancellation event
        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'booking.cancelled',
            data: {
                bookingId,
                renterId: booking.renterId,
                ownerId: booking.ownerId,
                itemId: booking.itemId,
                slotId: booking.slotId,
                refundAmount: refundCalc.refundAmount,
                reason: parsed.data.reason || '',
                cancelledAt,
            },
        });

        logger.info('Booking cancelled successfully', {
            bookingId,
            refundAmount: refundCalc.refundAmount,
        });

        return {
            status: 200,
            body: {
                bookingId,
                status: 'cancelled',
                refundAmount: refundCalc.refundAmount,
                refundPercentage: refundCalc.refundPercentage,
                cancelledAt,
            },
        };
    } catch (error: any) {
        if (error.status === 403) {
            return {
                status: 403,
                body: {
                    error: 'Not authorized to cancel this booking',
                },
            };
        }

        if (error.status === 404) {
            return {
                status: 404,
                body: {
                    error: 'Booking not found',
                },
            };
        }

        logger.error('Failed to cancel booking', { error, bookingId });
        return {
            status: 500,
            body: {
                error: 'Failed to cancel booking',
            },
        };
    }
};
