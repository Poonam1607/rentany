import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const addressAddedInput = z.object({
    userId: z.string(),
    addressId: z.string(),
    lat: z.number(),
    lng: z.number(),
    createdAt: z.string(),
});

export const config: EventConfig = {
    name: 'AddressAddedHandler',
    type: 'event',
    description: 'Handles post-processing after a new address is added',
    subscribes: ['user.address_added'],
    emits: [],
    flows: ['user-management'],
    input: addressAddedInput,
};

export const handler: Handlers['AddressAddedHandler'] = async (input, { logger }) => {
    const data = addressAddedInput.parse(input);

    logger.info('Processing new address', {
        userId: data.userId,
        addressId: data.addressId,
    });

    // Future: Add any post-processing logic here
    // - Update user's default location
    // - Notify nearby items
    // - Update search preferences
    // etc.
};
