import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';

const trackEventBodySchema = z.object({
    eventType: z.string().min(1),
    eventData: z.record(z.string(), z.unknown()),
});

export const config: ApiRouteConfig = {
    name: 'TrackEvent',
    type: 'api',
    path: '/analytics/track',
    method: 'POST',
    description: 'Tracks custom analytics events',
    emits: [],
    flows: ['analytics'],
    bodySchema: trackEventBodySchema,
    responseSchema: {
        200: z.object({
            tracked: z.boolean(),
            eventId: z.string(),
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

export const handler: Handlers['TrackEvent'] = async (req, { logger }) => {
    const parsed = trackEventBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid event tracking payload', { issues: parsed.error.issues });
        return {
            status: 400,
            body: {
                error: 'Invalid request payload',
            },
        };
    }

    // Auth token is optional for tracking
    // const token = extractAuthToken(req.headers);

    // Analytics can be tracked without auth for anonymous events

    try {
        const pool = getPool();
        // Service URL logic removed
        // const analyticsServiceUrl = getServiceUrl('ANALYTICS');
        const eventId = generateId('evt');
        const createdAt = new Date().toISOString();

        // If auth token is present, try to link to user
        let userId: string | null = null;
        if (req.headers) {
            const authUser = getUserIdFromHeader(req.headers);
            if (authUser) {
                userId = authUser;
            }
        }

        await pool.query(
            `INSERT INTO analytics_events (id, "userId", "eventType", "eventData", "createdAt")
            VALUES ($1, $2, $3, $4, $5)`,
            [
                eventId,
                userId,
                parsed.data.eventType,
                JSON.stringify(parsed.data.eventData),
                createdAt
            ]
        );

        logger.info('Event tracked', { eventId, eventType: parsed.data.eventType });

        return {
            status: 200,
            body: {
                tracked: true,
                eventId,
            },
        };
    } catch (error) {
        logger.error('Failed to track event', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to track event',
            },
        };
    }
};
