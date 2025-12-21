import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

export const config: ApiRouteConfig = {
    name: 'ApproveBooking',
    type: 'api',
    path: '/bookings/:bookingId/approve',
    method: 'POST',
    description: 'Allows owner to approve a booking request',
    emits: ['booking.confirmed'],
    flows: ['booking-management'],

    responseSchema: {
        200: z.object({
            success: z.boolean(),
            status: z.string(),
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

export const handler: Handlers['ApproveBooking'] = async (req, { logger, emit }) => {
    const { bookingId } = ((req as any).pathParams || {}) as { bookingId: string };
    const userId = getUserIdFromHeader(req.headers);

    if (!userId) {
        return {
            status: 401,
            body: { error: 'Authentication required' },
        };
    }

    try {
        const pool = getPool();

        // 1. Fetch Booking and verify Owner
        const bookingResult = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [bookingId]
        );
        const booking = bookingResult.rows[0];

        if (!booking) {
            return {
                status: 404,
                body: { error: 'Booking not found' },
            };
        }

        if (booking.ownerId !== userId) {
            return {
                status: 403,
                body: { error: 'Only the item owner can approve this booking' },
            };
        }

        if (booking.status === 'confirmed') {
            return {
                status: 400,
                body: { error: 'Booking is already confirmed' },
            };
        }

        // 2. Approve Booking (Update status)
        // In a real flow, this might move to 'pending_payment'. 
        // For simplicity/demo, we confirm it directly or assume payment is handled separately.
        // Let's mark it 'confirmed' effectively bypassing payment for this demo step.
        await pool.query(
            'UPDATE bookings SET status = $1 WHERE id = $2',
            ['confirmed', bookingId]
        );

        // 3. Update Slot Status
        await pool.query(
            "UPDATE inventory_slots SET status = 'booked' WHERE id = $1",
            [booking.slotId]
        );

        // @ts-ignore
        await emit({
            topic: 'booking.confirmed',
            data: {
                bookingId,
                renterId: booking.renterId,
                ownerId: booking.ownerId,
                itemId: booking.itemId,
                slotId: booking.slotId,
                paymentId: booking.paymentId || 'bypass', // Manual approval
                amount: booking.totalAmount,
                confirmedAt: new Date().toISOString()
            }
        });

        return {
            status: 200,
            body: {
                success: true,
                status: 'confirmed'
            },
        };

    } catch (error: any) {
        logger.error('Failed to approve booking', { error, bookingId });
        return {
            status: 500,
            body: { error: 'Failed to approve booking' },
        };
    }
};
