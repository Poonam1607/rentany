import { extractAuthToken } from '../shared/http-client';

export interface AuthUser {
    userId: string;
    iat: number;
}

/**
 * Verifies the simple token format used in this project: "token_<base64_json>"
 * In a real production app, this should verify a signed JWT.
 */
export function verifyToken(token: string): AuthUser | null {
    try {
        if (!token.startsWith('token_')) {
            return null;
        }

        const base64Payload = token.slice(6); // Remove 'token_' prefix
        const jsonPayload = Buffer.from(base64Payload, 'base64').toString('utf-8');
        const payload = JSON.parse(jsonPayload);

        if (!payload.userId || !payload.iat) {
            return null;
        }

        return payload as AuthUser;
    } catch (error) {
        return null;
    }
}

/**
 * Extracts and verifies the user ID from the Authorization header
 */
export function getUserIdFromHeader(headers: Record<string, string | string[] | undefined>): string | null {
    const token = extractAuthToken(headers);
    if (!token) {
        return null;
    }

    const user = verifyToken(token);
    return user ? user.userId : null;
}
