/**
 * Utility functions for extracting route parameters from Motia requests
 */

/**
 * Extract the last path segment from a URL (for :id patterns)
 * Example: /items/123 -> 123
 */
export function extractLastPathSegment(path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
}

/**
 * Extract path parameter by name from URL
 * Example: /items/123/media -> extractPathParam(path, 'items', 1) -> 123
 */
export function extractPathParam(path: string, afterSegment: string, offset: number = 1): string | null {
    const segments = path.split('/').filter(Boolean);
    const index = segments.indexOf(afterSegment);

    if (index === -1 || index + offset >= segments.length) {
        return null;
    }

    return segments[index + offset];
}
