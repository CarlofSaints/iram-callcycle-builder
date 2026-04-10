import type { Metadata } from "next";
import { headers } from "next/headers";
import { TenantProvider, TenantInfo } from "@/contexts/TenantContext";
import { darkenColor, lightenColor } from "@/lib/tenantConfig";
import "./globals.css";

// Default metadata — overridden per-tenant in generateMetadata
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const raw = h.get("x-tenant-config");
  if (raw) {
    try {
      const t = JSON.parse(raw);
      return {
        title: `${t.name} Call Cycle Builder`,
        description: `${t.name} Call Cycle Builder — Convert raw call cycle files to Perigee format`,
      };
    } catch { /* fallback */ }
  }
  return {
    title: "Call Cycle Builder",
    description: "Call Cycle Builder — Convert raw call cycle files to Perigee format",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const raw = h.get("x-tenant-config");

  // Default tenant info for when middleware hasn't run (build time, etc.)
  let tenant: TenantInfo = {
    slug: "default",
    name: "Call Cycle",
    subtitle: "Builder",
    primaryColor: "#7CC042",
    logoFilename: "",
    logoMaxWidth: 200,
    logoMaxHeight: 60,
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      tenant = {
        slug: parsed.slug,
        name: parsed.name,
        subtitle: parsed.subtitle || "Call Cycle Builder",
        primaryColor: parsed.primaryColor,
        secondaryColor: parsed.secondaryColor,
        accentColor: parsed.accentColor,
        logoFilename: parsed.logoFilename,
        logoMaxWidth: parsed.logoMaxWidth || 200,
        logoMaxHeight: parsed.logoMaxHeight || 60,
      };
    } catch { /* use defaults */ }
  }

  const primary = tenant.primaryColor;
  const primaryDark = darkenColor(primary, 25);
  const primaryLight = lightenColor(primary, 90);
  const primaryLighter = lightenColor(primary, 95);

  const cssVars = `
    :root {
      --color-primary: ${primary};
      --color-primary-dark: ${primaryDark};
      --color-primary-light: ${primaryLight};
      --color-primary-lighter: ${primaryLighter};
      ${tenant.secondaryColor ? `--color-secondary: ${tenant.secondaryColor};` : ''}
      ${tenant.accentColor ? `--color-accent: ${tenant.accentColor};` : ''}
    }
  `;

  return (
    <html lang="en" className="h-full">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <TenantProvider tenant={tenant}>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
