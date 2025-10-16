/**
 * API Route: Check URL Status
 * Validates if a URL is accessible via HTTP HEAD request
 * Used for accessibility metrics in MQA evaluation
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable SSL verification globally for this route
// This is necessary because many government catalogs have SSL issues
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

interface CheckUrlRequest {
  url: string;
  timeout?: number;
}

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

/**
 * POST /api/check-url-status
 * Check if a single URL is accessible
 */
export async function POST(request: NextRequest) {
  try {
    const body: CheckUrlRequest = await request.json();
    const { url, timeout = 3000 } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { 
          url,
          accessible: false,
          error: 'Invalid URL format'
        } as CheckUrlResponse,
        { status: 200 }
      );
    }

    const result = await checkUrlStatus(url, timeout);
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error in check-url-status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/check-url-status/batch
 * Check multiple URLs in parallel
 */
export async function PUT(request: NextRequest) {
  try {
    const body: { urls: string[]; timeout?: number } = await request.json();
    const { urls, timeout = 3000 } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { results: [] },
        { status: 200 }
      );
    }

    // Limit batch size to prevent abuse
    const maxBatchSize = 50;
    if (urls.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Maximum batch size is ${maxBatchSize} URLs` },
        { status: 400 }
      );
    }

    // Check all URLs in parallel
    const results = await Promise.all(
      urls.map(url => checkUrlStatus(url, timeout))
    );

    // // Debug logging
    // console.log(`[check-url-status] Checked ${results.length} URLs:`, 
    //   results.map(r => ({ url: r.url.substring(0, 80), accessible: r.accessible, status: r.statusCode, error: r.error }))
    // );

    return NextResponse.json({ results }, { status: 200 });

  } catch (error) {
    console.error('[check-url-status] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check URL accessibility using HTTP HEAD request with fast fallback to GET
 */
async function checkUrlStatus(url: string, timeout: number): Promise<CheckUrlResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // console.log(`[checkUrlStatus] Checking: ${url.substring(0, 100)}...`);

  try {
    // Try HEAD first with a short timeout
    const headController = new AbortController();
    const headTimeoutId = setTimeout(() => headController.abort(), Math.min(timeout, 2000));
    
    let response: Response;
    
    try {
      response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: headController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MQA-Validator/1.0; +https://github.com/metadata-quality-app)',
          'Accept': '*/*',
        },
      });
      clearTimeout(headTimeoutId);
      
      // If HEAD is not supported, try GET
      if (response.status === 405 || response.status === 501) {
        throw new Error('HEAD not supported');
      }
    } catch (headError) {
      clearTimeout(headTimeoutId);
      
      // Fallback to GET with Range header (minimal transfer)
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MQA-Validator/1.0; +https://github.com/metadata-quality-app)',
          'Accept': '*/*',
          'Range': 'bytes=0-0', // Only get first byte
        },
      });
    }

    clearTimeout(timeoutId);

    const accessible = response.ok; // 200-299 status codes
    const contentType = response.headers.get('content-type') || undefined;
    const contentLength = response.headers.get('content-length');

    // console.log(`[checkUrlStatus] Result: ${url.substring(0, 80)} → ${response.status} ${response.statusText} (accessible: ${accessible})`);

    return {
      url,
      accessible,
      statusCode: response.status,
      statusText: response.statusText,
      contentType,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      redirected: response.redirected,
      finalUrl: response.redirected ? response.url : undefined,
    };

  } catch (error: any) {
    clearTimeout(timeoutId);

    // console.log(`[checkUrlStatus] Error for ${url.substring(0, 80)}:`, error.message, error.cause?.code);

    let errorMessage = 'Unknown error';
    let isSslError = false;
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
    } else if (error.cause?.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed';
    } else if (error.cause?.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    } else if (error.cause?.code === 'ECONNRESET') {
      errorMessage = 'Connection reset';
    } else if (error.cause?.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout';
    } else if (error.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
               error.cause?.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
               error.cause?.code === 'CERT_HAS_EXPIRED' ||
               error.message?.includes('certificate') ||
               error.message?.includes('SSL')) {
      errorMessage = 'SSL certificate error (but server may be accessible)';
      isSslError = true;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      url,
      accessible: false,
      error: errorMessage,
    };
  }
}
