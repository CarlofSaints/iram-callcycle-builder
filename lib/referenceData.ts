import { ReferenceData } from './types';
import { loadStoreControl } from './storeControlData';
import { loadTeamControl } from './teamControlData';

const EMPTY: ReferenceData = { stores: [], users: [], teams: [] };

/**
 * Rebuild reference data from the live control-file stores for a specific tenant.
 * Always async — underlying stores read from Vercel Blob.
 */
export async function loadReferences(tenantSlug: string): Promise<ReferenceData> {
  const storeControl = await loadStoreControl(tenantSlug);
  const teamControl = await loadTeamControl(tenantSlug);

  if (storeControl || teamControl) {
    const ref: ReferenceData = { stores: [], users: [], teams: [] };

    if (storeControl) {
      ref.stores = storeControl.stores.map(s => ({
        storeCode: s.storeCode,
        storeName: s.storeName,
        channel: s.channel,
      }));
    }

    if (teamControl) {
      const seenEmails = new Set<string>();
      for (const t of teamControl.teams) {
        const emailKey = t.memberEmail.toLowerCase();
        if (!seenEmails.has(emailKey)) {
          seenEmails.add(emailKey);
          ref.users.push({
            userId: t.memberId,
            userEmail: t.memberEmail,
            firstName: '',
            surname: '',
            status: 'ACTIVE',
          });
        }
      }

      const seenTeams = new Set<string>();
      for (const t of teamControl.teams) {
        if (t.teamName && !seenTeams.has(t.teamName)) {
          seenTeams.add(t.teamName);
          ref.teams.push({
            teamName: t.teamName,
            leader: t.teamLeader,
          });
        }
      }
    }

    return ref;
  }

  return EMPTY;
}
