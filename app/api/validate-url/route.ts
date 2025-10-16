import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate if a URL is accessible
 * POST /api/validate-url
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { accessible: false, error: 'Invalid URL provided' },
        { status: 400 }
      );
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { accessible: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Check URL accessibility with HEAD request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type') || undefined;
      
      return NextResponse.json({
        accessible: response.ok,
        contentType,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        accessible: false,
        error: error instanceof Error ? error.message : 'Failed to access URL',
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        accessible: false,
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
