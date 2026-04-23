import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { loadSuperAdmins, saveSuperAdmins } from '@/lib/superAdminData';
import { addActivity } from '@/lib/activityLogData';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const slug = await getTenantSlug();
  const { userId, currentPassword, newPassword } = await req.json();
  if (!userId || !currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  // 1. Check tenant-level users first
  const users = await loadUsers(slug);
  const user = users.find(u => u.id === userId);

  if (user) {
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.forcePasswordChange = false;
    await saveUsers(slug, users);

    await addActivity(slug, {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'password_changed',
      userName: `${user.name} ${user.surname}`,
      userEmail: user.email,
    });

    return NextResponse.json({ ok: true });
  }

  // 2. Fall through: check if it's a super-admin
  const superAdmins = await loadSuperAdmins();
  const sa = superAdmins.find(a => a.id === userId);
  if (!sa) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const saValid = await bcrypt.compare(currentPassword, sa.passwordHash);
  if (!saValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  sa.passwordHash = await bcrypt.hash(newPassword, 10);
  sa.forcePasswordChange = false;
  await saveSuperAdmins(superAdmins);

  await addActivity(slug, {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'password_changed',
    userName: `${sa.name} (Platform Admin)`,
    userEmail: sa.email,
  });

  return NextResponse.json({ ok: true });
}
