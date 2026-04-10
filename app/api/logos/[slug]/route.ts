import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export const dynamic = 'force-dynamic';

/**
 * Proxy tenant logos from Blob storage.
 * Serves _platform/logos/{slug}.png (or whatever extension).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try common image extensions
  const extensions = ['png', 'jpg', 'jpeg', 'svg'];

  for (const ext of extensions) {
    const blobKey = `_platform/logos/${slug}.${ext}`;
    try {
      const result = await get(blobKey, { access: 'private', useCache: false });
      if (result && result.statusCode === 200) {
        const data = await new Response(result.stream).arrayBuffer();
        const contentType = ext === 'svg' ? 'image/svg+xml'
          : ext === 'png' ? 'image/png'
          : 'image/jpeg';

        return new NextResponse(data, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        });
      }
    } catch { /* try next extension */ }
  }

  // No logo found — return transparent 1x1 PNG
  const EMPTY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  return new NextResponse(EMPTY_PNG, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
