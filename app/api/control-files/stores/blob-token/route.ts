import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

/**
 * Token issuer for direct browser → Vercel Blob uploads of raw store control
 * Excel files. Used by /admin/control-files to bypass the Vercel serverless
 * 4.5 MB request body limit — the browser uploads the .xlsx directly to the
 * blob store and then calls /api/control-files/stores/process with the blob
 * URL for server-side parsing.
 *
 * Matches the existing project pattern of trusting the client for identity
 * (same as the legacy JSON upload route) — there is no cookie-based session,
 * so we do not enforce auth on the token request itself.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PATHNAME_PREFIX = 'temp-uploads/store-raw-';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB — plenty of headroom for large store files

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Pathname is chosen by the client — restrict to our temp-uploads prefix
        // so a malicious client cannot overwrite the canonical store-control.json
        // or any other key in the store.
        if (!pathname.startsWith(ALLOWED_PATHNAME_PREFIX) || !pathname.endsWith('.xlsx')) {
          throw new Error(`Invalid upload pathname: ${pathname}`);
        }

        return {
          allowedContentTypes: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream',
          ],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // No work needed here — processing is triggered by the client calling
        // /api/control-files/stores/process after upload completes. This
        // callback just exists because @vercel/blob requires it to exist as
        // part of the client-upload flow.
        console.log('[stores/blob-token] upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stores/blob-token] handleUpload error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
