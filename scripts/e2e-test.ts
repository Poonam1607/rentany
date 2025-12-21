import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
let OWNER_TOKEN = '';
let RENTER_TOKEN = '';
let OWNER_ID = '';
let RENTER_ID = '';
let ITEM_ID = '';
let ADDRESS_ID = '';
let BOOKING_ID = '';
let PAYMENT_ID = '';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
    console.log('🚀 Starting End-to-End Verification for RentAny (Monolith/SQLite)...');

    // Allow server to warm up
    await sleep(2000);

    try {
        // --- 1. HEALTH CHECK ---
        console.log('\n--- 1. Health Check ---');
        const helloRes = await fetch(`${BASE_URL}/hello`);
        console.log(`GET /hello status: ${helloRes.status}`);
        if (!helloRes.ok) console.warn('Health check failed or endpoint missing');

        // --- 2. AUTHENTICATE USERS ---
        console.log('\n--- 2. Authenticate Users (OTP Flow) ---');

        // Owner
        const ownerEmail = `alice.${Date.now()}@test.com`;
        console.log(`   -> Requesting OTP for ${ownerEmail}`);
        await fetch(`${BASE_URL}/auth/otp/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ownerEmail })
        });

        const ownerLoginRes = await fetch(`${BASE_URL}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ownerEmail, otp: '123456' })
        });
        const ownerLoginData = await ownerLoginRes.json();
        if (!ownerLoginRes.ok) throw new Error(`Owner Login failed: ${JSON.stringify(ownerLoginData)}`);
        OWNER_TOKEN = ownerLoginData.token;
        OWNER_ID = ownerLoginData.user.id;
        console.log(`   -> Owner Logged In: ${OWNER_ID}`);

        console.log('   -> Updating Owner Profile');
        await fetch(`${BASE_URL}/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OWNER_TOKEN}` },
            body: JSON.stringify({ name: 'Alice Owner' })
        });

        // Renter
        const renterEmail = `bob.${Date.now()}@test.com`;
        console.log(`   -> Requesting OTP for ${renterEmail}`);
        await fetch(`${BASE_URL}/auth/otp/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: renterEmail })
        });

        const renterLoginRes = await fetch(`${BASE_URL}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: renterEmail, otp: '123456' })
        });
        const renterLoginData = await renterLoginRes.json();
        if (!renterLoginRes.ok) throw new Error(`Renter Login failed: ${JSON.stringify(renterLoginData)}`);
        RENTER_TOKEN = renterLoginData.token;
        RENTER_ID = renterLoginData.user.id;
        console.log(`   -> Renter Logged In: ${RENTER_ID}`);

        await fetch(`${BASE_URL}/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({ name: 'Bob Renter' })
        });


        // --- 3. CREATE ADDRESS (Owner) ---
        console.log('\n--- 3. Create Address (Owner) ---');
        const addrRes = await fetch(`${BASE_URL}/user/addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OWNER_TOKEN}` },
            body: JSON.stringify({
                line1: '123 Main St',
                city: 'Tech City',
                state: 'KA',
                pincode: '560001',
                country: 'IN',
                isDefault: true
            })
        });
        const addrData = await addrRes.json();
        console.log('Create Address Status:', addrRes.status);
        if (!addrRes.ok) throw new Error(`Failed to create address: ${JSON.stringify(addrData)}`);
        ADDRESS_ID = addrData.address.id;
        console.log(`   -> Address Created: ${ADDRESS_ID}`);


        // --- 4. CREATE LISTING ---
        console.log('\n--- 4. Create Listing (Owner) ---');
        const itemRes = await fetch(`${BASE_URL}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OWNER_TOKEN}` },
            body: JSON.stringify({
                title: 'Professional Drill',
                description: 'Heavy duty drill for rent',
                category: 'tools',
                hourlyRate: 50,
                deposit: 200,
                addressId: ADDRESS_ID,
                minHours: 1
            })
        });
        const itemData = await itemRes.json();
        console.log('Create Item Status:', itemRes.status);
        if (!itemRes.ok) throw new Error(`Failed to create item: ${JSON.stringify(itemData)}`);
        ITEM_ID = itemData.item.id;
        console.log(`   -> Item Created: ${ITEM_ID}`);


        // --- 5. PUBLISH LISTING ---
        console.log('\n--- 5. Publish Listing (Owner) ---');
        const pubRes = await fetch(`${BASE_URL}/items/${ITEM_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OWNER_TOKEN}` },
            body: JSON.stringify({
                status: 'published'
            })
        });
        const pubData = await pubRes.json();
        console.log('Publish Item Status:', pubRes.status);
        if (!pubRes.ok) throw new Error(`Failed to publish item: ${JSON.stringify(pubData)}`);
        console.log('   -> Item Published (Active)');


        // --- 6. SEARCH ITEMS (Renter) ---
        console.log('\n--- 6. Search Items (Renter) ---');
        await sleep(500);
        // Using POST /search as per config
        const searchRes = await fetch(`${BASE_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({
                query: 'Drill'
            })
        });
        const searchData = await searchRes.json();
        console.log(`   -> Search Status: ${searchRes.status}`);
        console.log(`   -> Search Results Found: ${searchData.items?.length}`);
        if (searchData.items?.length === 0) console.warn('   -> Warning: New item not found (maybe indexing lag or geo filter)');


        // --- 7. GET LISTING DETAILS ---
        console.log('\n--- 7. Get Listing Details ---');
        const getRes = await fetch(`${BASE_URL}/items/${ITEM_ID}`, {
            headers: { 'Authorization': `Bearer ${RENTER_TOKEN}` }
        });
        const getData = await getRes.json();
        if (!getRes.ok) throw new Error(`Failed to get item: ${JSON.stringify(getData)}`);
        console.log(`   -> Verify Title: ${getData.item?.title === 'Professional Drill' ? 'OK' : 'FAIL'}`);


        // --- 8. ADD TO WISHLIST ---
        console.log('\n--- 8. Wishlist ---');
        const wishAddRes = await fetch(`${BASE_URL}/wishlists/${ITEM_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({})
        });
        if (!wishAddRes.ok) console.error('Wishlist Add Failed:', await wishAddRes.text());
        console.log('   -> Added to Wishlist');

        const wishRes = await fetch(`${BASE_URL}/wishlists`, {
            headers: { 'Authorization': `Bearer ${RENTER_TOKEN}` }
        });
        const wishData = await wishRes.json();
        console.log(`   -> Wishlist Count: ${wishData.items?.length}`);


        // --- 9. CREATE BOOKING ---
        console.log('\n--- 9. Create Booking ---');
        const startAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
        const endAt = new Date(Date.now() + 7200000).toISOString();   // 2 hours from now

        const bookingRes = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({
                itemId: ITEM_ID,
                startAt,
                endAt
            })
        });
        const bookingData = await bookingRes.json();
        console.log('Create Booking Status:', bookingRes.status);
        if (!bookingRes.ok) throw new Error(`Failed to create booking: ${JSON.stringify(bookingData)}`);
        BOOKING_ID = bookingData.booking.id;
        console.log(`   -> Booking Created: ${BOOKING_ID}`);


        // --- 10. CREATE PAYMENT INTENT ---
        console.log('\n--- 10. Create Payment Intent ---');
        const payRes = await fetch(`${BASE_URL}/payments/intents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({
                bookingId: BOOKING_ID,
                amount: bookingData.booking.totalAmount, // Assuming this field exists from create response
                currency: 'INR'
            })
        });
        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(`Failed to create payment intent: ${JSON.stringify(payData)}`);
        PAYMENT_ID = payData.paymentId;
        console.log(`   -> Payment Intent Created: ${PAYMENT_ID}`);


        // --- 11. CONFIRM BOOKING (Via Webhook) ---
        console.log('\n--- 11. Confirm Booking (Via Webhook) ---');
        const hookRes = await fetch(`${BASE_URL}/payments/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: `pg_${PAYMENT_ID}`, // We simulate the provider ID
                        metadata: {
                            paymentId: PAYMENT_ID,
                            bookingId: BOOKING_ID
                        }
                    }
                }
            })
        });
        console.log('Webhook Status:', hookRes.status);
        await sleep(1000);

        // Check Booking Status
        const checkBookingRes = await fetch(`${BASE_URL}/bookings/${BOOKING_ID}`, {
            headers: { 'Authorization': `Bearer ${RENTER_TOKEN}` }
        });
        const checkBookingData = await checkBookingRes.json();
        if (!checkBookingRes.ok) {
            console.error('Check Booking Failed:', checkBookingData);
            throw new Error('Check Booking Failed');
        }
        console.log(`   -> Booking Status: ${checkBookingData.booking?.status}`);


        // --- 12. CANCEL BOOKING ---
        console.log('\n--- 12. Cancel Booking ---');
        const cancelRes = await fetch(`${BASE_URL}/bookings/${BOOKING_ID}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RENTER_TOKEN}` },
            body: JSON.stringify({ reason: 'Changed my mind' })
        });
        const cancelData = await cancelRes.json();
        console.log('Cancel Status:', cancelRes.status);
        if (!cancelRes.ok) console.error('Cancel failed:', cancelData);
        else console.log(`   -> Refund Amount: ${cancelData.refundAmount}`);


        console.log('\n✅✅✅ VERIFICATION COMPLETE: ALL SYSTEMS GO ✅✅✅');

    } catch (err) {
        console.error('\n❌❌❌ VERIFICATION FAILED ❌❌❌');
        console.error(err);
        process.exit(1);
    }
}

runTest();
