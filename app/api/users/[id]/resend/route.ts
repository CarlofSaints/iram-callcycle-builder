import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { sendWelcomeEmail } from '@/lib/email';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { getTenantEmailConfig } from '@/lib/getTenantConfig';
import { randomBytes } from 'crypto';

/** POST — Generate a new temp password, update user, send welcome email. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = await getTenantSlug();
    const tenant = await getTenantEmailConfig();
    const { id } = await params;

    const users = await loadUsers(slug);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const user = users[idx];
    const tempPassword = randomBytes(4).toString('hex'); // 8-char random

    // Update password hash and force change on next login
    user.password = await bcrypt.hash(tempPassword, 10);
    user.forcePasswordChange = true;
    await saveUsers(slug, users);

    // Send welcome email with new temp password
    const result = await sendWelcomeEmail(
      user.email,
      `${user.name} ${user.surname}`,
      tempPassword,
      tenant,
    );

    if (result && (result as { error?: unknown }).error) {
      console.error('[resend] Resend email error:', (result as { error: unknown }).error);
      return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend] Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
