import { NextRequest, NextResponse } from 'next/server';
import { loadSuperAdmins } from '@/lib/superAdminData';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const email = req.headers.get('x-super-admin-email');
  if (!email) return false;
  const admins = await loadSuperAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
}

/**
 * Trigger a redeployment via Vercel API.
 * This is needed after creating/updating tenants so the Edge proxy
 * picks up the new PLATFORM_TENANTS_JSON env var.
 */
export async function POST(req: NextRequest) {
  if (!await verifySuperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    return NextResponse.json({ error: 'Missing VERCEL_TOKEN or VERCEL_PROJECT_ID' }, { status: 500 });
  }

  try {
    // Get the latest production deployment to redeploy from
    const listRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to list deployments' }, { status: 500 });
    }
    const { deployments } = await listRes.json();
    if (!deployments || deployments.length === 0) {
      return NextResponse.json({ error: 'No production deployment found' }, { status: 404 });
    }

    // Redeploy using the latest deployment
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: deployments[0].name,
          deploymentId: deployments[0].uid,
          target: 'production',
        }),
      }
    );

    if (!deployRes.ok) {
      const err = await deployRes.text();
      console.error('[redeploy] Vercel API error:', err);
      return NextResponse.json({ error: 'Redeploy failed' }, { status: 500 });
    }

    const result = await deployRes.json();
    return NextResponse.json({ ok: true, url: result.url });
  } catch (err) {
    console.error('[redeploy] Error:', err);
    return NextResponse.json({ error: 'Redeploy failed' }, { status: 500 });
  }
}
