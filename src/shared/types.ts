import { z } from 'zod';

/**
 * Shared types and Zod schemas for the rentAny application
 * These are used across multiple Steps for validation and type safety
 */

// ============================================================================
// User Types
// ============================================================================

export const userRoleSchema = z.enum(['USER', 'ADMIN']);
export const userStatusSchema = z.enum(['ACTIVE', 'BLOCKED']);

export const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  mobile: z.string().nullable().optional(),
  emailVerified: z.boolean().optional().default(false),
  mobileVerified: z.boolean().optional().default(false),
  role: userRoleSchema.default('USER'),
  status: userStatusSchema.default('ACTIVE'),
  aadhaarVerified: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type User = z.infer<typeof userSchema>;

export const addressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(4).max(10),
  country: z.string().default('IN'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isDefault: z.boolean().default(false),
  createdAt: z.string(),
});

export type Address = z.infer<typeof addressSchema>;

// ============================================================================
// Item/Listing Types
// ============================================================================

export const itemCategorySchema = z.enum([
  'electronics',
  'vehicles',
  'tools',
  'sports',
  'events',
  'furniture',
  'appliances',
  'clothing',
  'books',
  'other',
]);

export const itemStatusSchema = z.enum([
  'draft',
  'published',
  'unavailable',
  'archived',
]);

export const itemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: itemCategorySchema,
  hourlyRate: z.number().min(0),
  currency: z.string().default('INR'),
  deposit: z.number().min(0).optional(),
  minHours: z.number().min(1).default(1),
  maxHours: z.number().min(1).optional(),
  status: itemStatusSchema.default('draft'),
  images: z.array(z.string()).default([]),
  addressId: z.string(),
  rating: z.number().min(0).max(5).optional(),
  totalReviews: z.number().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type Item = z.infer<typeof itemSchema>;

// ============================================================================
// Inventory Types
// ============================================================================

export const slotStatusSchema = z.enum(['free', 'held', 'booked']);

export const inventorySlotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: slotStatusSchema,
  bookingId: z.string().optional(),
  holdExpiresAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type InventorySlot = z.infer<typeof inventorySlotSchema>;

// ============================================================================
// Booking Types
// ============================================================================

export const bookingStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'payment_failed',
  'cancelled',
  'completed',
  'disputed',
]);

export const bookingSchema = z.object({
  id: z.string(),
  renterId: z.string(),
  ownerId: z.string(),
  itemId: z.string(),
  slotId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  hours: z.number().min(1),
  hourlyRate: z.number().min(0),
  totalAmount: z.number().min(0),
  deposit: z.number().min(0).optional(),
  currency: z.string().default('INR'),
  status: bookingStatusSchema,
  paymentId: z.string().optional(),
  cancelledAt: z.string().optional(),
  cancellationReason: z.string().optional(),
  refundAmount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type Booking = z.infer<typeof bookingSchema>;

// ============================================================================
// Payment Types
// ============================================================================

export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

export const paymentSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  userId: z.string(),
  amount: z.number().min(0),
  currency: z.string().default('INR'),
  status: paymentStatusSchema,
  provider: z.string().default('stripe'),
  providerPaymentId: z.string().optional(),
  clientSecret: z.string().optional(),
  refundAmount: z.number().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type Payment = z.infer<typeof paymentSchema>;

// ============================================================================
// Review Types
// ============================================================================

export const reviewSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  itemId: z.string(),
  reviewerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
  createdAt: z.string(),
});

export type Review = z.infer<typeof reviewSchema>;

// ============================================================================
// Notification Types
// ============================================================================

export const notificationChannelSchema = z.enum(['email', 'sms', 'push', 'in_app']);
export const notificationStatusSchema = z.enum(['pending', 'sent', 'failed']);

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  channel: notificationChannelSchema,
  template: z.string(),
  data: z.record(z.string(), z.unknown()),
  status: notificationStatusSchema,
  sentAt: z.string().optional(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;

// ============================================================================
// Search Types
// ============================================================================

export const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: itemCategorySchema.optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(0).max(500).default(10),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'rating', 'distance']).default('distance'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const searchResultSchema = z.object({
  items: z.array(itemSchema.extend({
    distance: z.number().optional(),
    address: addressSchema.optional(),
  })),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// ============================================================================
// API Response Envelope
// ============================================================================

export const apiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        timestamp: z.string(),
      })
      .optional(),
  });

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  meta: z
    .object({
      requestId: z.string(),
      timestamp: z.string(),
    })
    .optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
