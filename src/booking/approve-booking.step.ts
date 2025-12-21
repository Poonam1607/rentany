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
    const { bookingId } = ((req as any).pathParams || (req as any).params || {}) as { bookingId: string };
    const userId = getUserIdFromHeader(req.headers);

    logger.info('ApproveBooking attempt', { userId, bookingId, pathParams: (req as any).pathParams, params: (req as any).params });

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
            logger.warn('Booking not found', { bookingId });
            return {
                status: 404,
                body: { error: 'Booking not found' },
            };
        }

        logger.info('Checking ownership', { bookingOwner: booking.ownerId, userId });

        if (booking.ownerId !== userId) {
            logger.warn('Ownership mismatch', { expected: booking.ownerId, actual: userId });
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
        // Move to 'pending_payment' so Renter can pay.
        await pool.query(
            'UPDATE bookings SET status = $1 WHERE id = $2',
            ['pending_payment', bookingId]
        );

        // 3. Update Slot Status
        // Slot is already 'held' or 'booked'? technically 'held' until paid or 'booked'?. 
        // Let's keep it 'booked' or 'held'. If we say 'booked', nobody else can take it.
        await pool.query(
            "UPDATE inventory_slots SET status = 'booked' WHERE id = $1",
            [booking.slotId]
        );

        /* Events emitted later after payment? Or partially now? 
           For now we just return success.
        */

        return {
            status: 200,
            body: {
                success: true,
                status: 'pending_payment'
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
