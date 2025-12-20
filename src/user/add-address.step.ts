import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
import { getUserIdFromHeader } from '../shared/auth-utils';
import { addressSchema } from '../shared/types';

const addAddressBodySchema = z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    pincode: z.string().min(4).max(10),
    country: z.string().default('IN'),
    isDefault: z.boolean().default(false),
});

export const config: ApiRouteConfig = {
    name: 'AddAddress',
    type: 'api',
    path: '/user/addresses',
    method: 'POST',
    description: 'Adds a new address with geocoding for the authenticated user',
    emits: ['user.address_added'],
    flows: ['user-management'],
    bodySchema: addAddressBodySchema,
    responseSchema: {
        200: z.object({
            address: addressSchema,
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

export const handler: Handlers['AddAddress'] = async (req, { logger, emit }) => {
    const parsed = addAddressBodySchema.safeParse(req.body);

    if (!parsed.success) {
        logger.warn('Invalid address creation payload', { issues: parsed.error.issues });
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

        // Simulate Geocoding (In real app, call Google Maps API here)
        // For now, random coords near Mumbai/Bangalore or 0,0
        const lat = 19.0760 + (Math.random() - 0.5) * 0.1;
        const lng = 72.8777 + (Math.random() - 0.5) * 0.1;

        const addressId = generateId('addr');
        const createdAt = new Date().toISOString();

        if (parsed.data.isDefault) {
            await pool.query(
            'UPDATE addresses SET "isDefault" = 0 WHERE "userId" = $1',
            [userId]
        );
        }

        await pool.query(
            `INSERT INTO addresses (id, "userId", line1, line2, city, state, pincode, country, lat, lng, "isDefault", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
            addressId, userId,
            parsed.data.line1, parsed.data.line2 || null,
            parsed.data.city, parsed.data.state, parsed.data.pincode, parsed.data.country,
            lat, lng,
            parsed.data.isDefault ? 1 : 0,
            createdAt
        ]
        );

        // Fetch created address
        // Construct it to match schema
        const address = {
            id: addressId,
            userId,
            line1: parsed.data.line1,
            line2: parsed.data.line2,
            city: parsed.data.city,
            state: parsed.data.state,
            pincode: parsed.data.pincode,
            country: parsed.data.country,
            lat,
            lng,
            isDefault: parsed.data.isDefault,
            createdAt,
            updatedAt: undefined
        };

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'user.address_added',
            data: {
                userId,
                addressId,
                lat,
                lng,
                createdAt,
            },
        });

        return {
            status: 200,
            body: {
                address: address as any,
            },
        };
    } catch (error) {
        logger.error('Failed to add address', { error });
        return {
            status: 500,
            body: {
                error: 'Failed to add address',
            },
        };
    }
};
