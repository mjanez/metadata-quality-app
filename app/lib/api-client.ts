import type { APIResponse, DownloadDataResponse, ValidateURLResponse } from '@/app/types';

/**
 * Base API client functions
 */

/**
 * Validate if a URL is accessible
 */
export async function validateURL(url: string): Promise<ValidateURLResponse> {
  try {
    const response = await fetch('/api/validate-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Download RDF data from a URL
 */
export async function downloadData(url: string): Promise<APIResponse<DownloadDataResponse>> {
  try {
    const response = await fetch('/api/download-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = 'Failed to download data';
      try {
        const error = JSON.parse(responseText);
        errorMessage = error.error || errorMessage;
      } catch {
        // Response is not JSON, use status text or first 200 chars of response
        errorMessage = response.statusText || responseText.substring(0, 200);
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    // Parse successful response
    try {
      const data = JSON.parse(responseText);
      return {
        success: true,
        data,
      };
    } catch {
      return {
        success: false,
        error: 'Invalid response format from server',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Generic fetch with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
