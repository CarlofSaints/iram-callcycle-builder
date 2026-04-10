import fs from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';
import { TeamControlData } from './types';

/**
 * Load team control data for a specific tenant.
 * Now async — reads from Vercel Blob with tenant prefix.
 * NO module-level cache (multi-container serverless safety).
 */
export async function loadTeamControl(tenantSlug: string): Promise<TeamControlData | null> {
  const blobKey = `${tenantSlug}/team-control.json`;

  // Local dev: read from local file
  if (!process.env.VERCEL) {
    const localFile = path.join(process.cwd(), 'data', `${tenantSlug}-teamControl.json`);
    const legacyFile = path.join(process.cwd(), 'data', 'teamControl.json');
    for (const f of [localFile, legacyFile]) {
      try {
        if (fs.existsSync(f)) {
          return JSON.parse(fs.readFileSync(f, 'utf-8')) as TeamControlData;
        }
      } catch { /* continue */ }
    }
    return null;
  }

  // Production: read from Blob
  try {
    const result = await get(blobKey, { access: 'private', useCache: false });
    if (result && result.statusCode === 200) {
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as TeamControlData;
    }
  } catch (err) {
    console.error(`[teamControlData] Blob read failed for ${blobKey}:`, err instanceof Error ? err.message : err);
  }

  return null;
}

/**
 * Save team control data for a specific tenant to Vercel Blob.
 */
export async function saveTeamControl(tenantSlug: string, data: TeamControlData): Promise<void> {
  const blobKey = `${tenantSlug}/team-control.json`;
  const json = JSON.stringify(data);

  try {
    await put(blobKey, json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to persist team control to Vercel Blob: ${msg}`);
  }

  // Local dev: also write to local file
  try {
    const localFile = path.join(process.cwd(), 'data', `${tenantSlug}-teamControl.json`);
    const dir = path.dirname(localFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFile, json);
  } catch {
    // Vercel read-only FS — expected
  }
}
