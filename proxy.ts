import { NextRequest, NextResponse } from 'next/server';

interface TenantConfigEdge {
  slug: string;
  name: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  logoFilename: string;
  logoMaxWidth: number;
  logoMaxHeight: number;
  domains: string[];
  active: boolean;
}

function loadTenantsFromEnv(): TenantConfigEdge[] {
  const raw = process.env.PLATFORM_TENANTS_JSON;
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Super-admin paths bypass tenant resolution entirely
  if (pathname.startsWith('/super-admin') || pathname.startsWith('/api/super-admin')) {
    return NextResponse.next();
  }

  // Logo API is platform-level, no tenant needed
  if (pathname.startsWith('/api/logos/')) {
    return NextResponse.next();
  }

  // Migration endpoint is platform-level
  if (pathname.startsWith('/api/migrate')) {
    return NextResponse.next();
  }

  const hostname = req.headers.get('host') || '';
  const host = hostname.toLowerCase().replace(/:\d+$/, '');

  const tenants = loadTenantsFromEnv();

  // Local dev: check DEV_TENANT_SLUG
  const devSlug = process.env.DEV_TENANT_SLUG;
  if (devSlug && (host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:'))) {
    const tenant = tenants.find(t => t.slug === devSlug && t.active);
    if (tenant) {
      const headers = new Headers(req.headers);
      headers.set('x-tenant-slug', tenant.slug);
      headers.set('x-tenant-config', JSON.stringify(tenant));
      return NextResponse.next({ request: { headers } });
    }
  }

  // Production: resolve tenant from hostname
  const tenant = tenants.find(t => t.active && t.domains.some(d => d.toLowerCase() === host));

  if (!tenant) {
    // Platform/super-admin root domain (no tenant subdomain) — redirect to super-admin
    const platformDomain = process.env.PLATFORM_DOMAIN?.toLowerCase();
    if (platformDomain && host === platformDomain) {
      return NextResponse.redirect(new URL('/super-admin/login', req.url));
    }

    // Legacy single-tenant URL — permanently redirect to the iRam canonical domain
    if (host === 'iram-callcycle-builder.vercel.app') {
      const destPath = req.nextUrl.pathname + req.nextUrl.search;
      return NextResponse.redirect(
        `https://iram.callcycle.fieldgoose.outerjoin.co.za${destPath}`,
        308,
      );
    }

    // Other Vercel preview URLs (per-deployment hashes, etc.) — route to first
    // active tenant so developers can still test previews. End users don't
    // encounter these URLs.
    const isVercelDomain = host.endsWith('.vercel.app') || host.endsWith('.vercel.sh');
    if (isVercelDomain && tenants.length > 0) {
      const fallback = tenants.find(t => t.active);
      if (fallback) {
        const headers = new Headers(req.headers);
        headers.set('x-tenant-slug', fallback.slug);
        headers.set('x-tenant-config', JSON.stringify(fallback));
        return NextResponse.next({ request: { headers } });
      }
    }

    // Unknown tenant — return 404
    return new NextResponse('Tenant not found', { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set('x-tenant-slug', tenant.slug);
  headers.set('x-tenant-config', JSON.stringify(tenant));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$).*)',
  ],
};
