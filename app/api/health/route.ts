import { NextResponse } from 'next/server';

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'Metadata Quality Assessment API',
    version: '1.0.0',
  });
}
