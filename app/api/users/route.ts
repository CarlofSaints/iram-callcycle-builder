import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { loadUsers, saveUsers, User } from '@/lib/userData';
import { addActivity } from '@/lib/activityLogData';
import { sendWelcomeEmail } from '@/lib/email';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { getTenantEmailConfig } from '@/lib/getTenantConfig';

export async function GET() {
  const slug = await getTenantSlug();
  const users = (await loadUsers(slug)).map(({ password: _p, ...u }) => u);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const slug = await getTenantSlug();
  const tenant = await getTenantEmailConfig();

  const { name, surname, email, password, isAdmin, forcePasswordChange } = await req.json();
  if (!name || !surname || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const users = await loadUsers(slug);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const role = isAdmin ? 'admin' : 'user';
  const user: User = {
    id: randomUUID(),
    name,
    surname,
    email,
    password: hashed,
    isAdmin: !!isAdmin,
    role,
    forcePasswordChange: forcePasswordChange !== false,
    firstLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(slug, users);

  await addActivity(slug, {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'user_created',
    userName: `${name} ${surname}`,
    userEmail: email,
    detail: `Admin created user ${name} ${surname}`,
  });

  // Send welcome email with login credentials
  try {
    await sendWelcomeEmail(email, `${name} ${surname}`, password, tenant);
  } catch (err) {
    console.error('[users] Welcome email failed:', err);
  }

  const { password: _p, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
