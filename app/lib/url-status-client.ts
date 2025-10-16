/**
 * URL Status Client
 * Client for checking URL accessibility through BFF API
 */

interface CheckUrlResponse {
  url: string;
  accessible: boolean;
  statusCode?: number;
  statusText?: string;
  contentType?: string;
  contentLength?: number;
  error?: string;
  redirected?: boolean;
  finalUrl?: string;
}

interface BatchCheckResponse {
  results: CheckUrlResponse[];
}

/**
 * Check if a single URL is accessible
 */
export async function checkUrlStatus(url: string, timeout: number = 10000): Promise<CheckUrlResponse> {
  try {
    const response = await fetch('/api/check-url-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, timeout }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking URL status:', error);
    return {
      url,
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check multiple URLs in parallel
 */
export async function checkUrlStatusBatch(urls: string[], timeout: number = 10000): Promise<CheckUrlResponse[]> {
  // Return empty array if no URLs to check
  if (!urls || urls.length === 0) {
    console.log('[checkUrlStatusBatch] No URLs to check');
    return [];
  }

  console.log(`[checkUrlStatusBatch] Checking ${urls.length} URLs...`);

  try {
    const response = await fetch('/api/check-url-status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls, timeout }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[checkUrlStatusBatch] API error ${response.status}:`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data: BatchCheckResponse = await response.json();
    console.log(`[checkUrlStatusBatch] ✓ ${data.results.length} URLs checked`);
    return data.results;
  } catch (error) {
    console.error('Error checking URL status batch:', error);
    // Return all as inaccessible on error
    return urls.map(url => ({
      url,
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * Check URLs with caching to avoid redundant checks
 */
const urlCache = new Map<string, { result: CheckUrlResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function checkUrlStatusCached(url: string, timeout: number = 10000): Promise<CheckUrlResponse> {
  const now = Date.now();
  const cached = urlCache.get(url);

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const result = await checkUrlStatus(url, timeout);
  urlCache.set(url, { result, timestamp: now });

  // Clean old cache entries periodically
  if (urlCache.size > 1000) {
    const cutoff = now - CACHE_TTL;
    for (const [key, value] of urlCache.entries()) {
      if (value.timestamp < cutoff) {
        urlCache.delete(key);
      }
    }
  }

  return result;
}
