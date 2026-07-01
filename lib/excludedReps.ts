import type { Visit } from './visitData';

/**
 * Reps (Perigee BAs) that should be kept OUT of a tenant entirely — e.g. test
 * accounts. Filtered from every Perigee import (poll + cron) and their existing
 * visits are stripped when added. Matched by rep email and/or rep name (visits
 * carry repEmail + repName; some feeds omit the email, so either works).
 *
 * Storage is tenant-scoped — see loadExcludedReps/saveExcludedReps in
 * lib/perigeeConfig.ts (which reuse the tenant blob helpers).
 */
export interface ExcludedRep {
  email: string;     // lowercased; may be '' if only a name was given
  repName?: string;
  addedAt: string;
  addedBy?: string;
}

export function excludedEmailSet(list: ExcludedRep[]): Set<string> {
  return new Set(list.map(r => (r.email || '').toLowerCase().trim()).filter(Boolean));
}

export function excludedNameSet(list: ExcludedRep[]): Set<string> {
  return new Set(list.map(r => (r.repName || '').toLowerCase().trim()).filter(Boolean));
}

/** Drop visits belonging to an excluded rep (by repEmail or repName). */
export function filterExcludedVisits(visits: Visit[], emails: Set<string>, names: Set<string>): Visit[] {
  if (emails.size === 0 && names.size === 0) return visits;
  return visits.filter(v => {
    const e = (v.repEmail || '').toLowerCase().trim();
    const n = (v.repName || '').toLowerCase().trim();
    return !((e && emails.has(e)) || (n && names.has(n)));
  });
}
