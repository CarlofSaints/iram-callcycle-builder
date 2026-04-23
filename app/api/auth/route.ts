import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { loadSuperAdmins } from '@/lib/superAdminData';
import { addActivity } from '@/lib/activityLogData';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const slug = await getTenantSlug();
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  // 1. Check tenant-level users first
  const users = await loadUsers(slug);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (user) {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.firstLoginAt) {
      user.firstLoginAt = new Date().toISOString();
      await saveUsers(slug, users);
    }

    await addActivity(slug, {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'login',
      userName: `${user.name} ${user.surname}`,
      userEmail: user.email,
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role || (user.isAdmin ? 'admin' : 'user'),
      forcePasswordChange: user.forcePasswordChange,
    });
  }

  // 2. Fall through: check platform super-admin credentials
  //    Super-admins are implicit admins on every tenant
  const superAdmins = await loadSuperAdmins();
  const sa = superAdmins.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!sa) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const saValid = await bcrypt.compare(password, sa.passwordHash);
  if (!saValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  await addActivity(slug, {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'login',
    userName: `${sa.name} (Platform Admin)`,
    userEmail: sa.email,
  });

  return NextResponse.json({
    id: sa.id,
    name: sa.name,
    surname: '',
    email: sa.email,
    isAdmin: true,
    role: 'admin' as const,
    isSuperAdmin: true,
    forcePasswordChange: sa.forcePasswordChange === true,
  });
}
