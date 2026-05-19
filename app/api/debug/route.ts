import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

/**
 * TEMPORARY diagnostic endpoint — remove after debugging login issue.
 * Lists all blob keys + shows env var status to diagnose tenant resolution.
 */
export async function GET() {
  try {
    const blobs = await list({ limit: 100 });

    const envStatus = {
      DEV_TENANT_SLUG: process.env.DEV_TENANT_SLUG || '(not set)',
      PLATFORM_TENANTS_JSON: process.env.PLATFORM_TENANTS_JSON ? `set (${process.env.PLATFORM_TENANTS_JSON.length} chars)` : '(not set)',
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'set' : '(not set)',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set' : '(not set)',
      NODE_ENV: process.env.NODE_ENV || '(not set)',
      VERCEL: process.env.VERCEL || '(not set)',
    };

    return NextResponse.json({
      envStatus,
      blobCount: blobs.blobs.length,
      blobKeys: blobs.blobs.map(b => ({
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
