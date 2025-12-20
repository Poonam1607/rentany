/**
 * Pricing and duration calculation utilities
 */

/**
 * Calculate duration in hours between two timestamps
 * Rounds up partial hours to ensure full hour billing
 */
export function calculateHours(startAt: string, endAt: string): number {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Round up to nearest hour
    return Math.ceil(diffHours);
}

/**
 * Calculate total booking price
 */
export interface PriceCalculation {
    hours: number;
    hourlyRate: number;
    subtotal: number;
    tax: number;
    serviceFee: number;
    deposit: number;
    total: number;
    currency: string;
}

export interface PriceCalculationOptions {
    startAt: string;
    endAt: string;
    hourlyRate: number;
    deposit?: number;
    currency?: string;
    taxRate?: number; // e.g., 0.18 for 18% GST
    serviceFeeRate?: number; // e.g., 0.05 for 5% platform fee
}

export function calculateBookingPrice(options: PriceCalculationOptions): PriceCalculation {
    const {
        startAt,
        endAt,
        hourlyRate,
        deposit = 0,
        currency = 'INR',
        taxRate = 0,
        serviceFeeRate = 0,
    } = options;

    const hours = calculateHours(startAt, endAt);
    const subtotal = hours * hourlyRate;
    const serviceFee = subtotal * serviceFeeRate;
    const tax = (subtotal + serviceFee) * taxRate;
    const total = subtotal + serviceFee + tax + deposit;

    return {
        hours,
        hourlyRate,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100,
        deposit,
        total: Math.round(total * 100) / 100,
        currency,
    };
}

/**
 * Calculate refund amount based on cancellation policy
 */
export interface RefundCalculation {
    hoursBeforeBooking: number;
    refundPercentage: number;
    refundAmount: number;
    penalty: number;
}

export interface RefundCalculationOptions {
    bookingStartAt: string;
    cancelledAt: string;
    totalAmount: number;
    deposit: number;
}

export function calculateRefund(options: RefundCalculationOptions): RefundCalculation {
    const { bookingStartAt, cancelledAt, totalAmount, deposit } = options;

    const bookingStart = new Date(bookingStartAt);
    const cancelled = new Date(cancelledAt);

    const diffMs = bookingStart.getTime() - cancelled.getTime();
    const hoursBeforeBooking = diffMs / (1000 * 60 * 60);

    let refundPercentage = 0;

    // Cancellation policy:
    // - More than 24 hours before: 100% refund
    // - 12-24 hours before: 50% refund
    // - Less than 12 hours: No refund

    if (hoursBeforeBooking >= 24) {
        refundPercentage = 1.0;
    } else if (hoursBeforeBooking >= 12) {
        refundPercentage = 0.5;
    } else {
        refundPercentage = 0;
    }

    const refundableAmount = totalAmount - deposit; // Deposit is always returned
    const refundAmount = refundableAmount * refundPercentage + deposit;
    const penalty = totalAmount - refundAmount;

    return {
        hoursBeforeBooking,
        refundPercentage,
        refundAmount: Math.round(refundAmount * 100) / 100,
        penalty: Math.round(penalty * 100) / 100,
    };
}

/**
 * Validate that start time is before end time and not in the past
 */
export function validateTimeRange(startAt: string, endAt: string): { valid: boolean; error?: string } {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const now = new Date();

    if (isNaN(start.getTime())) {
        return { valid: false, error: 'Invalid start time' };
    }

    if (isNaN(end.getTime())) {
        return { valid: false, error: 'Invalid end time' };
    }

    if (start >= end) {
        return { valid: false, error: 'Start time must be before end time' };
    }

    if (start < now) {
        return { valid: false, error: 'Start time cannot be in the past' };
    }

    return { valid: true };
}

/**
 * Generate hold expiration time (e.g., 15 minutes from now)
 */
export function generateHoldExpiration(minutes: number = 15): string {
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + minutes);
    return expiration.toISOString();
}

/**
 * Check if a hold has expired
 */
export function isHoldExpired(holdExpiresAt: string): boolean {
    const expiration = new Date(holdExpiresAt);
    const now = new Date();
    return now > expiration;
}
