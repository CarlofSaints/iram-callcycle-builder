import { NextRequest, NextResponse } from 'next/server';
import { verifySSOToken } from '@/lib/sso';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { loadUsers, saveUsers, type User } from '@/lib/userData';

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string };
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const secret = process.env.IRAM_SSO_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'SSO not configured' }, { status: 500 });
  }

  const payload = verifySSOToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired SSO token' }, { status: 401 });
  }

  // Check module access
  if (!payload.modules.includes('callcycle')) {
    return NextResponse.json(
      { error: 'You do not have access to Call Cycle Builder' },
      { status: 403 },
    );
  }

  const slug = await getTenantSlug();
  const users = await loadUsers(slug);

  // Find existing user by email (case-insensitive)
  let user = users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());

  if (!user) {
    // Create new user with default role 'rep'
    user = {
      id: crypto.randomUUID(),
      name: payload.name,
      surname: payload.surname,
      email: payload.email,
      password: '', // No password — SSO-only user
      isAdmin: false,
      role: 'rep',
      forcePasswordChange: false,
      firstLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } satisfies User;

    users.push(user);
    await saveUsers(slug, users);
  }

  // Return session matching cc_session format
  return NextResponse.json({
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    isAdmin: user.role === 'super_admin',
    role: user.role,
  });
}
