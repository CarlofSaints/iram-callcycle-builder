import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { loadUsers, saveUsers, User } from '@/lib/userData';
import { addActivity } from '@/lib/activityLogData';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET() {
  const users = loadUsers().map(({ password: _p, ...u }) => u);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { name, surname, email, password, isAdmin, forcePasswordChange } = await req.json();
  if (!name || !surname || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user: User = {
    id: randomUUID(),
    name,
    surname,
    email,
    password: hashed,
    isAdmin: !!isAdmin,
    forcePasswordChange: forcePasswordChange !== false,
    firstLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(users);

  await addActivity({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'user_created',
    userName: `${name} ${surname}`,
    userEmail: email,
    detail: `Admin created user ${name} ${surname}`,
  });

  // Send welcome email with login credentials
  try {
    await sendWelcomeEmail(email, `${name} ${surname}`, password);
  } catch (err) {
    console.error('[users] Welcome email failed:', err);
  }

  const { password: _p, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
