import { NextRequest, NextResponse } from 'next/server';
import { loadUsers } from '@/lib/userData';
import { sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/email';
import { getTenantSlug } from '@/lib/getTenantSlug';
import { getTenantEmailConfig } from '@/lib/getTenantConfig';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const slug = await getTenantSlug();
  const tenant = await getTenantEmailConfig();
  const { id } = await params;
  const { plainPassword, type, name: bodyName, email: bodyEmail } = await req.json();

  let name = bodyName as string | undefined;
  let email = bodyEmail as string | undefined;

  if (!name || !email) {
    const user = (await loadUsers(slug)).find(u => u.id === id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    name = `${user.name} ${user.surname}`;
    email = user.email;
  }

  if (!plainPassword) return NextResponse.json({ error: 'Missing password' }, { status: 400 });

  try {
    let result;
    if (type === 'reset') {
      result = await sendPasswordResetEmail(email as string, name as string, plainPassword, tenant);
    } else {
      result = await sendWelcomeEmail(email as string, name as string, plainPassword, tenant);
    }
    if (result && (result as { error?: unknown }).error) {
      const err = (result as { error: unknown }).error;
      console.error('[notify] Resend error:', err);
      return NextResponse.json({ error: 'Email send failed', detail: err }, { status: 500 });
    }
  } catch (err) {
    console.error('[notify] Exception:', err);
    return NextResponse.json({ error: 'Email send exception', detail: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
