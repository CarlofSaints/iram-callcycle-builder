import { NextRequest, NextResponse } from 'next/server';
import { get, put } from '@vercel/blob';
import { loadSuperAdmins } from '@/lib/superAdminData';

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

/**
 * Upload a tenant logo. Accepts multipart form data with a "file" field.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // Verify super-admin
  const email = req.headers.get('x-super-admin-email');
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admins = await loadSuperAdmins();
  if (!admins.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Determine extension from file type
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
  };
  const ext = mimeToExt[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, or SVG.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const blobKey = `_platform/logos/${slug}.${ext}`;

  await put(blobKey, buffer, {
    access: 'private',
    contentType: file.type,
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true, key: blobKey });
}
