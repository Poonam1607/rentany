import { Pool, PoolClient, QueryResult } from 'pg';
import { Logger } from 'motia';

// Types matching our SQLite schema
export interface User {
  id: string;
  mobile: string | null;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  aadhaarVerified: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Address {
  id: string;
  userId: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}

export interface OTP {
  id: string;
  mobile: string | null;
  email: string | null;
  code: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

export interface Item {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  hourlyRate: number;
  currency: string;
  deposit: number | null;
  minHours: number;
  maxHours: number | null;
  status: string;
  addressId: string;
  rating: number | null;
  totalReviews: number;
  createdAt: string;
  updatedAt: string | null;
}

// Global pool instance
let pool: Pool | null = null;

/**
 * Get PostgreSQL connection pool (singleton)
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DB_CONNECTION_STRING || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DB_CONNECTION_STRING or DATABASE_URL environment variable is not set');
    }

    console.log('[PostgreSQL] Initializing connection pool...');

    pool = new Pool({
      connectionString,
      // Lambda-optimized settings
      max: 10, // Max connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Fail fast if can't connect
      ssl: {
        rejectUnauthorized: false // Neon uses SSL
      }
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client', err);
    });

    // Initialize schema on first connection
    initializeSchema(pool).catch(err => {
      console.error('[PostgreSQL] Failed to initialize schema:', err);
    });

    console.log('[PostgreSQL] ✅ Pool initialized successfully');
  }

  return pool;
}

/**
 * Helper to generate IDs with prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize database schema
 */
async function initializeSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('[PostgreSQL] Creating tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        mobile TEXT UNIQUE,
        email TEXT UNIQUE,
        name TEXT,
        "emailVerified" BOOLEAN DEFAULT FALSE,
        "mobileVerified" BOOLEAN DEFAULT FALSE,
        role TEXT DEFAULT 'USER',
        status TEXT DEFAULT 'ACTIVE',
        "aadhaarVerified" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        line1 TEXT NOT NULL,
        line2 TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT NOT NULL,
        country TEXT DEFAULT 'IN',
        lat NUMERIC NOT NULL,
        lng NUMERIC NOT NULL,
        "isDefault" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL,
        FOREIGN KEY ("userId") REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS otps (
        id TEXT PRIMARY KEY,
        mobile TEXT,
        email TEXT,
        code TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        "ownerId" TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        "hourlyRate" NUMERIC NOT NULL,
        currency TEXT DEFAULT 'INR',
        deposit NUMERIC,
        "minHours" INTEGER DEFAULT 1,
        "maxHours" INTEGER,
        status TEXT DEFAULT 'draft',
        "addressId" TEXT NOT NULL,
        rating NUMERIC,
        "totalReviews" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP,
        FOREIGN KEY ("ownerId") REFERENCES users(id),
        FOREIGN KEY ("addressId") REFERENCES addresses(id)
      );

      CREATE TABLE IF NOT EXISTS item_images (
        id TEXT PRIMARY KEY,
        "itemId" TEXT NOT NULL,
        "imageUrl" TEXT NOT NULL,
        "isPrimary" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL,
        FOREIGN KEY ("itemId") REFERENCES items(id)
      );

      CREATE TABLE IF NOT EXISTS inventory_slots (
        id TEXT PRIMARY KEY,
        "itemId" TEXT NOT NULL,
        "startAt" TIMESTAMP NOT NULL,
        "endAt" TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'free',
        "bookingId" TEXT,
        "holdExpiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP,
        FOREIGN KEY ("itemId") REFERENCES items(id)
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        "renterId" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "slotId" TEXT NOT NULL,
        "startAt" TIMESTAMP NOT NULL,
        "endAt" TIMESTAMP NOT NULL,
        hours INTEGER NOT NULL,
        "hourlyRate" NUMERIC NOT NULL,
        "totalAmount" NUMERIC NOT NULL,
        deposit NUMERIC,
        currency TEXT DEFAULT 'INR',
        status TEXT DEFAULT 'pending_payment',
        "paymentId" TEXT,
        "cancelledAt" TIMESTAMP,
        "cancellationReason" TEXT,
        "refundAmount" NUMERIC,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP,
        FOREIGN KEY ("renterId") REFERENCES users(id),
        FOREIGN KEY ("ownerId") REFERENCES users(id),
        FOREIGN KEY ("itemId") REFERENCES items(id),
        FOREIGN KEY ("slotId") REFERENCES inventory_slots(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        "bookingId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'INR',
        status TEXT DEFAULT 'pending',
        provider TEXT DEFAULT 'stripe',
        "providerPaymentId" TEXT,
        "clientSecret" TEXT,
        "refundAmount" NUMERIC DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP,
        FOREIGN KEY ("bookingId") REFERENCES bookings(id),
        FOREIGN KEY ("userId") REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        "bookingId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "reviewerId" TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        "createdAt" TIMESTAMP NOT NULL,
        FOREIGN KEY ("bookingId") REFERENCES bookings(id),
        FOREIGN KEY ("itemId") REFERENCES items(id),
        FOREIGN KEY ("reviewerId") REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS wishlist_items (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        FOREIGN KEY ("userId") REFERENCES users(id),
        FOREIGN KEY ("itemId") REFERENCES items(id),
        UNIQUE("userId", "itemId")
      );

      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        "userId" TEXT,
        "eventType" TEXT NOT NULL,
        "eventData" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        FOREIGN KEY ("userId") REFERENCES users(id)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_addresses_userId ON addresses("userId");
      CREATE INDEX IF NOT EXISTS idx_otps_mobile ON otps(mobile);
      CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
      CREATE INDEX IF NOT EXISTS idx_items_ownerId ON items("ownerId");
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_inventory_slots_itemId ON inventory_slots("itemId");
      CREATE INDEX IF NOT EXISTS idx_inventory_slots_status ON inventory_slots(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_renterId ON bookings("renterId");
      CREATE INDEX IF NOT EXISTS idx_bookings_ownerId ON bookings("ownerId");
      CREATE INDEX IF NOT EXISTS idx_bookings_itemId ON bookings("itemId");
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_payments_bookingId ON payments("bookingId");
      CREATE INDEX IF NOT EXISTS idx_payments_userId ON payments("userId");
      CREATE INDEX IF NOT EXISTS idx_reviews_itemId ON reviews("itemId");
      CREATE INDEX IF NOT EXISTS idx_wishlist_items_userId ON wishlist_items("userId");
    `);

    console.log('[PostgreSQL] ✅ Schema initialized successfully');
  } catch (error) {
    console.error('[PostgreSQL] ❌ Schema initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Connection pool closed');
  }
}
