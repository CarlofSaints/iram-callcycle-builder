import { headers } from 'next/headers';

/**
 * Extract tenant slug from the x-tenant-slug header set by middleware.
 * Must be called in API routes / server components — throws if missing.
 *
 * For local dev without middleware, falls back to DEV_TENANT_SLUG env var.
 */
export async function getTenantSlug(): Promise<string> {
  const h = await headers();
  const slug = h.get('x-tenant-slug');

  if (slug) return slug;

  // Local dev fallback
  const devSlug = process.env.DEV_TENANT_SLUG;
  if (devSlug) return devSlug;

  throw new Error(
    'Missing x-tenant-slug header. Ensure middleware is running or set DEV_TENANT_SLUG env var for local development.'
  );
}
