import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadSuperAdmins, saveSuperAdmins } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, currentPassword, newPassword } = await req.json();
  if (!email || !currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  const idx = admins.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, admins[idx].passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  admins[idx].passwordHash = await bcrypt.hash(newPassword, 10);
  admins[idx].forcePasswordChange = false;
  await saveSuperAdmins(admins);

  return NextResponse.json({
    id: admins[idx].id,
    email: admins[idx].email,
    name: admins[idx].name,
    forcePasswordChange: false,
  });
}
