import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadSuperAdmins } from '@/lib/superAdminData';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  const admin = admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!admin) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  return NextResponse.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
  });
}
