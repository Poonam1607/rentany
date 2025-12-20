# RentAny API - cURL Commands

Complete collection of cURL commands for all API endpoints in the rentAny platform.

## Prerequisites

```bash
# Set base URL
export BASE_URL="http://localhost:3000"

# After login, set your auth token
export AUTH_TOKEN="your-jwt-token-here"
```

---

## Authentication APIs

### 1. Request OTP
```bash
# Request OTP via mobile
curl -X POST "$BASE_URL/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "+919876543210"
  }'

# Request OTP via email
curl -X POST "$BASE_URL/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response:**
```json
{
  "status": "pending",
  "channel": "mobile",
  "requestedAt": "2025-12-20T01:00:00.000Z"
}
```

### 2. Verify OTP
```bash
curl -X POST "$BASE_URL/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "+919876543210",
    "otp": "123456"
  }'
```

**Response:**
```json
{
  "status": "authenticated",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "mobile": "+919876543210",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2025-12-20T01:00:00.000Z"
  }
}
```

---

## User Management APIs

### 3. Create User Profile
```bash
curl -X POST "$BASE_URL/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210"
  }'
```

### 4. Update User Profile
```bash
curl -X PATCH "$BASE_URL/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "name": "John Updated"
  }'
```

### 5. Get User Profile
```bash
curl -X GET "$BASE_URL/user/profile" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### 6. Add Address
```bash
curl -X POST "$BASE_URL/user/addresses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "line1": "123 Main Street",
    "line2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "IN",
    "isDefault": true
  }'
```

**Response includes geocoded lat/lng:**
```json
{
  "address": {
    "id": "addr_123",
    "userId": "user_123",
    "line1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "lat": 19.0760,
    "lng": 72.8777,
    "isDefault": true,
    "createdAt": "2025-12-20T01:00:00.000Z"
  }
}
```

### 7. Request Aadhaar Verification
```bash
curl -X POST "$BASE_URL/user/aadhaar/verify/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "aadhaarNumber": "123456789012"
  }'
```

### 8. Confirm Aadhaar Verification
```bash
curl -X POST "$BASE_URL/user/aadhaar/verify/confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "requestId": "req_123",
    "otp": "123456"
  }'
```

---

## Item/Content Management APIs

### 9. Create Listing
```bash
curl -X POST "$BASE_URL/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "title": "Canon EOS R5 Camera",
    "description": "Professional mirrorless camera with 45MP sensor. Perfect for photography and videography. Includes 24-70mm lens.",
    "category": "electronics",
    "hourlyRate": 500,
    "currency": "INR",
    "deposit": 5000,
    "minHours": 4,
    "maxHours": 72,
    "addressId": "addr_123"
  }'
```

**Response:**
```json
{
  "item": {
    "id": "item_123",
    "ownerId": "user_123",
    "title": "Canon EOS R5 Camera",
    "description": "Professional mirrorless camera...",
    "category": "electronics",
    "hourlyRate": 500,
    "currency": "INR",
    "deposit": 5000,
    "status": "draft",
    "images": [],
    "addressId": "addr_123",
    "createdAt": "2025-12-20T01:00:00.000Z"
  }
}
```

### 10. Upload Item Media
```bash
curl -X POST "$BASE_URL/items/item_123/media" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "imageUrl": "https://example.com/original-image.jpg",
    "isPrimary": true
  }'
```

### 11. Update Listing
```bash
curl -X PATCH "$BASE_URL/items/item_123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "title": "Canon EOS R5 Camera - Updated",
    "hourlyRate": 450,
    "status": "published"
  }'
```

### 12. Get Single Listing
```bash
curl -X GET "$BASE_URL/items/item_123"
```

**Response:**
```json
{
  "item": {
    "id": "item_123",
    "title": "Canon EOS R5 Camera",
    "hourlyRate": 500,
    "rating": 4.8,
    "totalReviews": 23
  },
  "address": {
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "owner": {
    "id": "user_123",
    "name": "John Doe",
    "rating": 4.9
  }
}
```

### 13. List Items
```bash
# List all items
curl -X GET "$BASE_URL/items"

# With filters
curl -X GET "$BASE_URL/items?category=electronics&page=1&limit=20"

# By owner
curl -X GET "$BASE_URL/items?ownerId=user_123"
```

---

## Search API

### 14. Geo-Radius Search
```bash
curl -X POST "$BASE_URL/search" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 19.0760,
    "lng": 72.8777,
    "radiusKm": 10,
    "category": "electronics",
    "minPrice": 100,
    "maxPrice": 1000,
    "availableFrom": "2025-12-25T10:00:00.000Z",
    "availableTo": "2025-12-25T18:00:00.000Z",
    "sortBy": "distance",
    "page": 1,
    "limit": 20
  }'
```

**Response:**
```json
{
  "items": [
    {
      "id": "item_123",
      "title": "Canon EOS R5 Camera",
      "hourlyRate": 500,
      "category": "electronics",
      "distance": 2.5,
      "rating": 4.8
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

---

## Inventory Management APIs

### 15. Check Availability
```bash
curl -X POST "$BASE_URL/inventory/check-availability" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item_123",
    "startAt": "2025-12-25T10:00:00.000Z",
    "endAt": "2025-12-25T18:00:00.000Z"
  }'
```

**Response:**
```json
{
  "available": true
}
```

### 16. Reserve Slot
```bash
curl -X POST "$BASE_URL/inventory/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item_123",
    "startAt": "2025-12-25T10:00:00.000Z",
    "endAt": "2025-12-25T18:00:00.000Z",
    "holdMinutes": 15
  }'
```

**Response:**
```json
{
  "slot": {
    "id": "slot_123",
    "itemId": "item_123",
    "startAt": "2025-12-25T10:00:00.000Z",
    "endAt": "2025-12-25T18:00:00.000Z",
    "status": "held"
  },
  "holdExpiresAt": "2025-12-20T01:15:00.000Z"
}
```

### 17. Confirm Reservation
```bash
curl -X POST "$BASE_URL/inventory/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "slot_123",
    "bookingId": "booking_123"
  }'
```

### 18. Release Slot
```bash
curl -X POST "$BASE_URL/inventory/release" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "slot_123",
    "reason": "cancelled"
  }'
```

---

## Booking & Order Management APIs

### 19. Create Booking (Core Saga)
```bash
curl -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "itemId": "item_123",
    "startAt": "2025-12-25T10:00:00.000Z",
    "endAt": "2025-12-25T18:00:00.000Z"
  }'
```

**Response:**
```json
{
  "booking": {
    "id": "booking_123",
    "renterId": "user_123",
    "itemId": "item_123",
    "slotId": "slot_123",
    "startAt": "2025-12-25T10:00:00.000Z",
    "endAt": "2025-12-25T18:00:00.000Z",
    "hours": 8,
    "hourlyRate": 500,
    "totalAmount": 4720,
    "status": "pending_payment",
    "createdAt": "2025-12-20T01:00:00.000Z"
  },
  "paymentClientSecret": "pi_123_secret_456",
  "holdExpiresAt": "2025-12-20T01:15:00.000Z"
}
```

### 20. Cancel Booking
```bash
curl -X POST "$BASE_URL/bookings/booking_123/cancel" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "reason": "Change of plans"
  }'
```

**Response:**
```json
{
  "bookingId": "booking_123",
  "status": "cancelled",
  "refundAmount": 4720,
  "refundPercentage": 1.0,
  "cancelledAt": "2025-12-20T01:00:00.000Z"
}
```

### 21. Get Booking
```bash
curl -X GET "$BASE_URL/bookings/booking_123" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### 22. List User Bookings
```bash
# As renter
curl -X GET "$BASE_URL/bookings?role=renter&page=1&limit=20" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# As owner
curl -X GET "$BASE_URL/bookings?role=owner&status=confirmed" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

---

## Payment APIs

### 23. Create Payment Intent
```bash
curl -X POST "$BASE_URL/payments/intents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "bookingId": "booking_123",
    "amount": 4720,
    "currency": "INR"
  }'
```

### 24. Payment Webhook (PSP → Motia)
```bash
# This is called by Stripe/Razorpay, not by clients
curl -X POST "$BASE_URL/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=...,v1=..." \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_123",
        "amount": 4720
      }
    }
  }'
```

---

## Review & Wishlist APIs

### 25. Submit Review
```bash
curl -X POST "$BASE_URL/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "bookingId": "booking_123",
    "itemId": "item_123",
    "rating": 5,
    "comment": "Excellent camera! Owner was very helpful."
  }'
```

### 26. Add to Wishlist
```bash
curl -X POST "$BASE_URL/wishlists/item_123" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### 27. Remove from Wishlist
```bash
curl -X DELETE "$BASE_URL/wishlists/item_123" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### 28. Get Wishlist
```bash
curl -X GET "$BASE_URL/wishlists" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Response:**
```json
{
  "items": [
    {
      "id": "item_123",
      "title": "Canon EOS R5 Camera",
      "hourlyRate": 500,
      "rating": 4.8
    }
  ],
  "total": 1
}
```

---

## Analytics API

### 29. Track Event
```bash
curl -X POST "$BASE_URL/analytics/track" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "eventType": "item_view",
    "eventData": {
      "itemId": "item_123",
      "source": "search",
      "timestamp": "2025-12-20T01:00:00.000Z"
    }
  }'
```

---

## Complete Workflow Examples

### End-to-End Booking Flow

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

# 1. Request OTP
curl -X POST "$BASE_URL/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+919876543210"}'

# 2. Verify OTP (save the token)
AUTH_TOKEN=$(curl -X POST "$BASE_URL/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+919876543210", "otp": "123456"}' \
  | jq -r '.token')

# 3. Create profile
curl -X POST "$BASE_URL/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"name": "John Doe", "mobile": "+919876543210"}'

# 4. Add address
ADDR_ID=$(curl -X POST "$BASE_URL/user/addresses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "line1": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }' | jq -r '.address.id')

# 5. Create listing
ITEM_ID=$(curl -X POST "$BASE_URL/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"title\": \"Camera\",
    \"description\": \"Professional camera\",
    \"category\": \"electronics\",
    \"hourlyRate\": 500,
    \"deposit\": 5000,
    \"addressId\": \"$ADDR_ID\"
  }" | jq -r '.item.id')

# 6. Search for items
curl -X POST "$BASE_URL/search" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 19.0760,
    "lng": 72.8777,
    "radiusKm": 10,
    "category": "electronics"
  }'

# 7. Check availability
curl -X POST "$BASE_URL/inventory/check-availability" \
  -H "Content-Type: application/json" \
  -d "{
    \"itemId\": \"$ITEM_ID\",
    \"startAt\": \"2025-12-25T10:00:00.000Z\",
    \"endAt\": \"2025-12-25T18:00:00.000Z\"
  }"

# 8. Create booking
BOOKING_RESPONSE=$(curl -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"itemId\": \"$ITEM_ID\",
    \"startAt\": \"2025-12-25T10:00:00.000Z\",
    \"endAt\": \"2025-12-25T18:00:00.000Z\"
  }")

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.booking.id')
CLIENT_SECRET=$(echo $BOOKING_RESPONSE | jq -r '.paymentClientSecret')

echo "Booking created: $BOOKING_ID"
echo "Complete payment with client secret: $CLIENT_SECRET"

# 9. (After payment succeeds via Stripe, booking auto-confirms)

# 10. View booking
curl -X GET "$BASE_URL/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# 11. Submit review (after booking completes)
curl -X POST "$BASE_URL/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"bookingId\": \"$BOOKING_ID\",
    \"itemId\": \"$ITEM_ID\",
    \"rating\": 5,
    \"comment\": \"Great experience!\"
  }"
```

---

## Notes

1. **Authentication**: Most endpoints require the `Authorization: Bearer <token>` header obtained from OTP verification
2. **Content-Type**: Always use `application/json` for request bodies
3. **Timestamps**: Use ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
4. **IDs**: Replace placeholder IDs (like `item_123`) with actual IDs from responses
5. **Error Handling**: All endpoints return appropriate HTTP status codes (400, 401, 403, 404, 500)

## Testing with jq

For prettier JSON output, pipe responses through `jq`:

```bash
curl -X GET "$BASE_URL/items" | jq '.'
```

## Environment Setup

```bash
# .env file should contain service URLs
AUTH_SERVICE_URL=http://localhost:4001
USER_SERVICE_URL=http://localhost:4002
ITEM_SERVICE_URL=http://localhost:4003
NOTIFICATION_SERVICE_URL=http://localhost:4004
# ... etc
```
