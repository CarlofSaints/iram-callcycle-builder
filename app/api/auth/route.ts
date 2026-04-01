import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { addActivity } from '@/lib/activityLogData';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (!user.firstLoginAt) {
    user.firstLoginAt = new Date().toISOString();
    await saveUsers(users);
  }

  await addActivity({
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
    forcePasswordChange: user.forcePasswordChange,
  });
}
