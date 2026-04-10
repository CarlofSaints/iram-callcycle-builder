import { headers } from 'next/headers';
import { TenantConfig } from './tenantConfig';
import { EmailTenantConfig } from './email';

/**
 * Extract full tenant config from the x-tenant-config header set by middleware.
 * Returns a partial config suitable for email sending.
 */
export async function getTenantEmailConfig(): Promise<EmailTenantConfig> {
  const h = await headers();
  const raw = h.get('x-tenant-config');

  if (raw) {
    try {
      const t: TenantConfig = JSON.parse(raw);
      return {
        name: t.name,
        subtitle: t.subtitle || 'Call Cycle Builder',
        primaryColor: t.primaryColor,
      };
    } catch { /* fallback */ }
  }

  // Fallback for local dev
  return {
    name: process.env.DEV_TENANT_NAME || 'Call Cycle',
    subtitle: 'Builder',
    primaryColor: process.env.DEV_TENANT_COLOR || '#7CC042',
  };
}
