import type { Logger } from 'motia';

/**
 * HTTP client utility for calling external services with retry logic and error handling
 */

export interface HttpClientOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

export interface HttpResponse<T = unknown> {
    status: number;
    data: T;
    headers: Headers;
}

export class HttpError extends Error {
    constructor(
        message: string,
        public status: number,
        public response?: unknown
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

/**
 * Makes an HTTP request with retry logic
 */
export async function httpRequest<T = unknown>(
    url: string,
    options: HttpClientOptions = {},
    logger?: Logger
): Promise<HttpResponse<T>> {
    const {
        method = 'GET',
        headers = {},
        body,
        timeout = 10000,
        retries = 3,
        retryDelay = 1000,
    } = options;

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            let data: T;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = (await response.text()) as T;
            }

            if (!response.ok) {
                const error = new HttpError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    data
                );

                // Don't retry on 4xx errors (client errors)
                if (response.status >= 400 && response.status < 500) {
                    throw error;
                }

                // Retry on 5xx errors (server errors)
                if (attempt < retries) {
                    logger?.warn(`Request failed, retrying (${attempt + 1}/${retries})`, {
                        url,
                        status: response.status,
                    });
                    await sleep(retryDelay * (attempt + 1));
                    continue;
                }

                throw error;
            }

            return {
                status: response.status,
                data,
                headers: response.headers,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
                // Don't retry client errors
                throw error;
            }

            if (attempt < retries) {
                logger?.warn(`Request failed, retrying (${attempt + 1}/${retries})`, {
                    url,
                    error: lastError.message,
                });
                await sleep(retryDelay * (attempt + 1));
                continue;
            }
        }
    }

    throw lastError || new Error('Request failed after retries');
}

/**
 * Helper for GET requests
 */
export async function httpGet<T = unknown>(
    url: string,
    headers?: Record<string, string>,
    logger?: Logger
): Promise<HttpResponse<T>> {
    return httpRequest<T>(url, { method: 'GET', headers }, logger);
}

/**
 * Helper for POST requests
 */
export async function httpPost<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
    logger?: Logger
): Promise<HttpResponse<T>> {
    return httpRequest<T>(url, { method: 'POST', body, headers }, logger);
}

/**
 * Helper for PATCH requests
 */
export async function httpPatch<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
    logger?: Logger
): Promise<HttpResponse<T>> {
    return httpRequest<T>(url, { method: 'PATCH', body, headers }, logger);
}

/**
 * Helper for DELETE requests
 */
export async function httpDelete<T = unknown>(
    url: string,
    headers?: Record<string, string>,
    logger?: Logger
): Promise<HttpResponse<T>> {
    return httpRequest<T>(url, { method: 'DELETE', headers }, logger);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get service URL from environment with validation
 */
export function getServiceUrl(serviceName: string): string {
    const envKey = `${serviceName.toUpperCase()}_SERVICE_URL`;
    const url = process.env[envKey];

    if (!url) {
        throw new Error(`${envKey} environment variable is not configured`);
    }

    return url;
}

/**
 * Extract auth token from request headers
 */
export function extractAuthToken(headers: Record<string, string | string[] | undefined>): string | null {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader) {
        return null;
    }

    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (headerValue.startsWith('Bearer ')) {
        return headerValue.substring(7);
    }

    return null;
}

/**
 * Create authorization header from token
 */
export function createAuthHeader(token: string): Record<string, string> {
    return {
        'Authorization': `Bearer ${token}`,
    };
}
