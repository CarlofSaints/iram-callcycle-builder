'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface TenantInfo {
  slug: string;
  name: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  logoFilename: string;
  logoMaxWidth: number;
  logoMaxHeight: number;
}

const TenantContext = createContext<TenantInfo | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantInfo;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantInfo {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant() must be used within a TenantProvider');
  }
  return ctx;
}
