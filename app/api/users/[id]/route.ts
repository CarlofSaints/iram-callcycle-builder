import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { addActivity } from '@/lib/activityLogData';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { randomUUID } from 'crypto';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = await getTenantSlug();
    const { id } = await params;
    const body = await req.json();
    const users = await loadUsers(slug);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.name !== undefined) users[idx].name = body.name;
    if (body.surname !== undefined) users[idx].surname = body.surname;
    if (body.email !== undefined) users[idx].email = body.email;
    if (body.isAdmin !== undefined) {
      users[idx].isAdmin = body.isAdmin;
      users[idx].role = body.isAdmin ? 'admin' : (users[idx].role === 'admin' ? 'user' : users[idx].role);
    }
    if (body.role !== undefined) {
      users[idx].role = body.role;
      users[idx].isAdmin = body.role === 'admin';
    }
    if (body.password) {
      users[idx].password = await bcrypt.hash(body.password, 10);
      users[idx].forcePasswordChange = body.forcePasswordChange !== false;
    }
    await saveUsers(slug, users);

    await addActivity(slug, {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'user_updated',
      userName: `${users[idx].name} ${users[idx].surname}`,
      userEmail: users[idx].email,
    });

    const { password: _p, ...safe } = users[idx];
    return NextResponse.json(safe);
  } catch (err) {
    console.error('[PATCH /api/users/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const slug = await getTenantSlug();
  const { id } = await params;
  const users = await loadUsers(slug);
  const user = users.find(u => u.id === id);
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await saveUsers(slug, filtered);

  if (user) {
    await addActivity(slug, {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'user_deleted',
      userName: `${user.name} ${user.surname}`,
      userEmail: user.email,
    });
  }

  return NextResponse.json({ ok: true });
}
