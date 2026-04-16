import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { loadSuperAdmins, saveSuperAdmins, SuperAdmin } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

export async function GET(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admins = await loadSuperAdmins();
  // Strip password hashes from response
  return NextResponse.json(admins.map(({ passwordHash: _p, ...a }) => a), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, name, password, forcePasswordChange, notifyUser } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  if (admins.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const admin: SuperAdmin = {
    id: randomUUID(),
    email,
    name,
    passwordHash: await bcrypt.hash(password, 10),
    forcePasswordChange: forcePasswordChange !== false,
    createdAt: new Date().toISOString(),
  };
  admins.push(admin);
  await saveSuperAdmins(admins);

  // Send welcome email if requested
  if (notifyUser !== false && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = 'https://callcycle.fieldgoose.outerjoin.co.za';
      await resend.emails.send({
        from: 'Field Goose Control Centre <report_sender@outerjoin.co.za>',
        to: email,
        subject: 'Welcome to Field Goose Control Centre',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e5e5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1562A;">
              <tr><td style="padding:20px 28px;">
                <div style="color:#fff;font-size:20px;font-weight:bold;">FIELD GOOSE</div>
                <div style="color:#fff;margin:3px 0 0;opacity:0.85;font-size:12px;">Call Cycle Control Centre</div>
              </td></tr>
            </table>
            <div style="padding:32px 28px;background:#fff;">
              <p style="margin:0 0 14px;">Hi <strong>${name}</strong>,</p>
              <p style="margin:0 0 20px;">You've been added as a Super Admin on the Field Goose Call Cycle Control Centre.</p>
              <table style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 16px;width:100%;margin-bottom:20px;">
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Login URL</td><td style="font-size:13px;"><a href="${appUrl}/super-admin/login" style="color:#F1562A;">${appUrl}/super-admin/login</a></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Email</td><td style="font-size:13px;">${email}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Password</td><td style="font-size:13px;font-family:monospace;">${password}</td></tr>
              </table>
              ${forcePasswordChange !== false ? '<p style="margin:0 0 20px;color:#666;font-size:13px;">You will be asked to change your password on first login.</p>' : ''}
              <a href="${appUrl}/super-admin/login" style="background:#F1562A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:bold;font-size:14px;display:inline-block;">Login Now</a>
            </div>
            <div style="padding:14px 28px;text-align:center;font-size:11px;color:#999;background:#f9f9f9;border-top:1px solid #eee;">
              Field Goose Call Cycle Control Centre &bull; Powered by OuterJoin
            </div>
          </div>
        `,
      });
    } catch (err) {
      console.error('[super-admin] Welcome email failed:', err);
    }
  }

  const { passwordHash: _p, ...safe } = admin;
  return NextResponse.json(safe, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, password, forcePasswordChange, notifyUser } = await req.json();
  if (!id || !password) {
    return NextResponse.json({ error: 'Missing id or password' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  const idx = admins.findIndex(a => a.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  admins[idx].passwordHash = await bcrypt.hash(password, 10);
  admins[idx].forcePasswordChange = forcePasswordChange !== false;
  await saveSuperAdmins(admins);

  const target = admins[idx];

  // Optional notification email
  if (notifyUser && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const appUrl = 'https://callcycle.fieldgoose.outerjoin.co.za';
      await resend.emails.send({
        from: 'Field Goose Control Centre <report_sender@outerjoin.co.za>',
        to: target.email,
        subject: 'Your Field Goose password has been reset',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e5e5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1562A;">
              <tr><td style="padding:20px 28px;">
                <div style="color:#fff;font-size:20px;font-weight:bold;">FIELD GOOSE</div>
                <div style="color:#fff;margin:3px 0 0;opacity:0.85;font-size:12px;">Call Cycle Control Centre</div>
              </td></tr>
            </table>
            <div style="padding:32px 28px;background:#fff;">
              <p style="margin:0 0 14px;">Hi <strong>${target.name}</strong>,</p>
              <p style="margin:0 0 20px;">Your Super Admin password has been reset by another administrator.</p>
              <table style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 16px;width:100%;margin-bottom:20px;">
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Login URL</td><td style="font-size:13px;"><a href="${appUrl}/super-admin/login" style="color:#F1562A;">${appUrl}/super-admin/login</a></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">Email</td><td style="font-size:13px;">${target.email}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">New Password</td><td style="font-size:13px;font-family:monospace;">${password}</td></tr>
              </table>
              ${forcePasswordChange !== false ? '<p style="margin:0 0 20px;color:#666;font-size:13px;">You will be asked to change your password on next login.</p>' : ''}
              <a href="${appUrl}/super-admin/login" style="background:#F1562A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:bold;font-size:14px;display:inline-block;">Login Now</a>
              <p style="margin:20px 0 0;color:#888;font-size:11px;">If you didn't request this change, contact your administrator immediately.</p>
            </div>
            <div style="padding:14px 28px;text-align:center;font-size:11px;color:#999;background:#f9f9f9;border-top:1px solid #eee;">
              Field Goose Call Cycle Control Centre &bull; Powered by OuterJoin
            </div>
          </div>
        `,
      });
    } catch (err) {
      console.error('[super-admin] Reset email failed:', err);
    }
  }

  return NextResponse.json({ ok: true, emailSent: !!notifyUser });
}

export async function DELETE(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const admins = await loadSuperAdmins();
  // Don't allow deleting the last super-admin
  if (admins.length <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last super-admin' }, { status: 400 });
  }

  const filtered = admins.filter(a => a.id !== id);
  if (filtered.length === admins.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await saveSuperAdmins(filtered);
  return NextResponse.json({ ok: true });
}
