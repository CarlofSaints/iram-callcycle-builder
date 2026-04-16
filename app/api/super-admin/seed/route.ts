import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { loadSuperAdmins, saveSuperAdmins, SuperAdmin } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

/**
 * Idempotent super-admin seed endpoint.
 * - Creates carl@outerjoin.co.za if missing
 * - Resets password to the one provided in the request (or default) if already present
 * - Secret-protected via SUPER_ADMIN_SEED_SECRET env var
 *
 * Body: { secret: string, email?: string, name?: string, password?: string }
 */
export async function POST(req: NextRequest) {
  const { secret, email, name, password } = await req.json().catch(() => ({}));

  const expected = process.env.SUPER_ADMIN_SEED_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Seed disabled — SUPER_ADMIN_SEED_SECRET not set' }, { status: 503 });
  }
  if (secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetEmail = (email || 'carl@outerjoin.co.za').toLowerCase();
  const targetName = name || 'Carl Dos Santos';
  const targetPassword = password || 'FieldGoose2026!';

  const admins = await loadSuperAdmins();
  const idx = admins.findIndex(a => a.email.toLowerCase() === targetEmail);

  const hash = await bcrypt.hash(targetPassword, 10);

  if (idx === -1) {
    const admin: SuperAdmin = {
      id: randomUUID(),
      email: targetEmail,
      name: targetName,
      passwordHash: hash,
      forcePasswordChange: true,
      createdAt: new Date().toISOString(),
    };
    admins.push(admin);
    await saveSuperAdmins(admins);
    return NextResponse.json({ action: 'created', email: targetEmail, password: targetPassword });
  }

  admins[idx].passwordHash = hash;
  admins[idx].forcePasswordChange = true;
  await saveSuperAdmins(admins);
  return NextResponse.json({ action: 'reset', email: targetEmail, password: targetPassword });
}
