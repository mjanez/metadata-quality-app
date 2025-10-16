import { NextRequest, NextResponse } from 'next/server';

/**
 * Download RDF data from a URL
 * POST /api/download-data
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Try direct fetch first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const CORS_PROXIES = [
      'https://corsproxy.io/?url=',
      'https://api.allorigins.win/raw?url=',
    ];
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/turtle, application/rdf+xml, application/ld+json, application/n-triples, application/xml, text/xml, text/plain',
          'User-Agent': 'Mozilla/5.0 (compatible; MetadataQualityBot/1.0)',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.text();
        const contentType = response.headers.get('content-type') || 'text/turtle';
        
        // Check if response looks like HTML (common issue with GitHub/GitLab URLs)
        const isHTML = data.trim().toLowerCase().startsWith('<!doctype html') || 
                      data.trim().toLowerCase().startsWith('<html') ||
                      contentType.includes('text/html');
        
        if (isHTML) {
          throw new Error('URL returned HTML instead of RDF data. Please use a direct link to the raw RDF file.');
        }
        
        return NextResponse.json({
          data,
          contentType,
          url,
          method: 'direct',
        });
      }
    } catch (directError) {
      clearTimeout(timeoutId);
      
      // If it's our custom HTML error, propagate it
      if (directError instanceof Error && directError.message.includes('HTML instead of RDF')) {
        return NextResponse.json(
          { error: directError.message },
          { status: 400 }
        );
      }
      
      console.warn('Direct fetch failed, trying CORS proxies:', directError);
    }
    
    // Try CORS proxies as fallback
    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
        const proxyController = new AbortController();
        const proxyTimeoutId = setTimeout(() => proxyController.abort(), 30000);
        
        const response = await fetch(proxyUrl, {
          signal: proxyController.signal,
        });
        
        clearTimeout(proxyTimeoutId);
        
        if (response.ok) {
          const data = await response.text();
          const contentType = response.headers.get('content-type') || 'text/turtle';
          
          // Check if response looks like HTML
          const isHTML = data.trim().toLowerCase().startsWith('<!doctype html') || 
                        data.trim().toLowerCase().startsWith('<html') ||
                        contentType.includes('text/html');
          
          if (isHTML) {
            continue; // Try next proxy
          }
          
          return NextResponse.json({
            data,
            contentType,
            url,
            method: 'proxy',
            proxy,
          });
        }
      } catch (proxyError) {
        console.warn(`Proxy ${proxy} failed:`, proxyError);
        continue;
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to download data from URL. All methods failed.' },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
