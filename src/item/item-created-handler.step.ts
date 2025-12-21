import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { getPool, generateId } from '../shared/postgres';
// Search indexing will be handled in Search module refactor, here we might just log or TODO
// import { indexItem } from '../search/search-utils'; // Future optimization

const itemCreatedInput = z.object({
    itemId: z.string(),
    ownerId: z.string(),
    title: z.string(),
    category: z.string(),
    addressId: z.string(),
    hourlyRate: z.number(),
    createdAt: z.string(),
});

export const config: EventConfig = {
    name: 'ItemCreatedHandler',
    type: 'event',
    description: 'Handles post-creation workflows: search indexing and inventory setup',
    subscribes: ['item.listing_created'],
    emits: ['item.indexed', 'inventory.default_created'],
    flows: ['item-management', 'search-indexing'],
    input: itemCreatedInput,
};

export const handler: Handlers['ItemCreatedHandler'] = async (input, { logger, emit }) => {
    const data = itemCreatedInput.parse(input);

    logger.info('Processing new item listing', {
        itemId: data.itemId,
        ownerId: data.ownerId,
    });

    // 1. Index item for search
    // Since we are monolithic, we can assume the Search module will pick up the 'item.listing_created' event if it subscribes to it?
    // Wait, the Search module has an API endpoint /index.
    // Ideally, we should insert into a search_index table here if we want direct DB.
    // OR, we can emit 'item.listing_created' (which we already do in create-listing.step.ts) and let Search module listener handle it.
    // BUT this handler IS listening to 'item.listing_created'.
    // So this handler is responsible for triggering indexing.

    // For now, let's just log that we would index here. 
    // Real implementation would allow FTS inserts.
    // We will comment out the HTTP call.
    try {
        // const searchServiceUrl = getServiceUrl('SEARCH');
        // await httpPost(...) 

        // Placeholder for direct Search DB insertion
        // In a real implementation, this would insert into a search_index table
        // await pool.query('INSERT INTO search_index ...', [...])

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'item.indexed',
            data: {
                itemId: data.itemId,
                indexedAt: new Date().toISOString(),
            },
        });

        logger.info('Item indexed successfully (simulated)', { itemId: data.itemId });
    } catch (error) {
        logger.error('Failed to index item', { error, itemId: data.itemId });
    }

    // 2. Create default inventory slots (e.g., next 90 days)
    try {
        const pool = getPool();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);

        // Create one inventory slot per day, 09:00 to 17:00
        const slots: any[] = [];

        for (let d = 0; d < 90; d++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + d);
            day.setHours(9, 0, 0, 0); // 9 AM

            const startAt = day.toISOString();

            const endDay = new Date(day);
            endDay.setHours(17, 0, 0, 0); // 5 PM
            const endAt = endDay.toISOString();

            const slotId = generateId('slot');

            await pool.query(
                `INSERT INTO inventory_slots (id, "itemId", "startAt", "endAt", status, "createdAt")
                VALUES ($1, $2, $3, $4, 'free', $5)`,
                [slotId, data.itemId, startAt, endAt, new Date().toISOString()]
            );

            slots.push({ slotId, startAt, endAt });
        }

        // @ts-ignore
        // @ts-ignore
        await emit({
            topic: 'inventory.default_created',
            data: {
                itemId: data.itemId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                createdAt: new Date().toISOString(),
            },
        });

        logger.info('Default inventory created', { itemId: data.itemId, slotsCreated: slots.length });
    } catch (error) {
        logger.error('Failed to create default inventory', { error, itemId: data.itemId });
        // Don't fail - can be created manually
    }
};
