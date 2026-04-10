import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { loadSuperAdmins, saveSuperAdmins, SuperAdmin } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function GET(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admins = await loadSuperAdmins();
  // Strip password hashes from response
  return NextResponse.json(admins.map(({ passwordHash: _p, ...a }) => a), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, name, password } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  if (admins.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const admin: SuperAdmin = {
    id: randomUUID(),
    email,
    name,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };
  admins.push(admin);
  await saveSuperAdmins(admins);

  const { passwordHash: _p, ...safe } = admin;
  return NextResponse.json(safe, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  // Don't allow deleting the last super-admin
  if (admins.length <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last super-admin' }, { status: 400 });
  }

  const filtered = admins.filter(a => a.id !== id);
  if (filtered.length === admins.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await saveSuperAdmins(filtered);
  return NextResponse.json({ ok: true });
}
