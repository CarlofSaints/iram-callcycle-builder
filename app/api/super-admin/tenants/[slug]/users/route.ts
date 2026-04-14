import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { loadSuperAdmins } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const users = await loadUsers(slug);

  return NextResponse.json(
    users.map(({ password: _p, ...u }) => u),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const { userId, password, forcePasswordChange } = await req.json();

  if (!userId || !password) {
    return NextResponse.json({ error: 'Missing userId or password' }, { status: 400 });
  }

  const users = await loadUsers(slug);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  users[idx].password = await bcrypt.hash(password, 10);
  users[idx].forcePasswordChange = forcePasswordChange !== false;
  await saveUsers(slug, users);

  const { password: _p, ...safe } = users[idx];
  return NextResponse.json(safe);
}
