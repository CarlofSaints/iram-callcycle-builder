# iRAM Call Cycle Builder — Current State

## Project Location
`C:\Users\CarlDosSantos-(OUTER\Projects\iram-callcycle-builder`

## Tech Stack
- Next.js 16.2.2, React 19, TypeScript, Tailwind CSS
- Vercel Blob storage (JSON files), bcryptjs for password hashing
- Resend for email, Vercel Pro deployment
- Multi-tenant architecture via `proxy.ts` (edge proxy sets `x-tenant-slug` header)

## CRITICAL: Deployment Setup

**Live Site:** `https://iram.callcycle.fieldgoose.outerjoin.co.za/`

**Vercel Project:** `perigee-callcycle-builder` (NOT `iram-callcycle-builder`)
- The `iram-callcycle-builder` Vercel project should be DELETED (shows "Tenant not found" error, serves nothing)
- The LIVE deployment is `perigee-callcycle-builder` on Vercel

**Git Remotes:**
| Remote | GitHub Repo | Purpose |
|--------|------------|---------|
| `origin` | `CarlofSaints/iram-callcycle-builder` | Code mirror/backup |
| `platform` | `CarlofSaints/perigee-callcycle-builder` | **DEPLOYS TO VERCEL** |

**Production branch on `platform` remote:** `feature/multi-tenant`

**To deploy:** Push to BOTH remotes:
```bash
git push origin master
git push platform master:feature/multi-tenant
```

## Call Cycle Adherence Metrics (Deployed May 31, 2026)

4 new adherence metrics added to the dashboard:

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Accurate Hit Rate %** | visits on exact assigned date / total expected visits | OPS: staff discipline |
| **Stores Visited %** | stores visited at least once / stores in schedule | Client-facing: coverage |
| **Unscheduled %** | visits to non-schedule stores / total visits | OPS: planning issues |
| **Missed %** | stores with 0 visits / stores in schedule | OPS: gap identification |

### Files Created
- **`lib/adherenceCalc.ts`** — Pure computation: `computeAdherence()`, `parseCycleWeeks()`, `generateExpectedDates()`, `nthWeekdayOfMonth()`. Types: `AdherenceMetrics`, `UserAdherence`, `AdherenceData`
- **`app/api/visits/adherence/route.ts`** — GET `/api/visits/adherence?from=&to=` returns pre-aggregated metrics by user, team leader, channel, and totals

### Files Modified
- **`app/dashboard/page.tsx`** — 4 new KPI cards (color-coded badges), 4 new sortable columns in all 3 summary tables (Team Leader, Channel, User), `AdherenceBadge` component

### Key Algorithm
Expected dates generated from schedule: `"Week 1&3" + ["Monday", "Wednesday"]` → finds 1st & 3rd Monday/Wednesday of each month in date range. `nthWeekdayOfMonth()` computes specific dates. `dateTo` capped at today to avoid penalizing for future visits.

## Key Files
- `proxy.ts` — Edge proxy, tenant resolution
- `lib/userData.ts` — User CRUD via Vercel Blob (`{tenantSlug}/users.json`)
- `lib/getTenantSlug.ts` — Reads `x-tenant-slug` header, falls back to `DEV_TENANT_SLUG`
- `lib/adherenceCalc.ts` — Adherence computation (pure logic, no I/O)
- `lib/visitData.ts` — Visit type + `loadVisits()`
- `lib/scheduleData.ts` — `loadSchedule()`
- `lib/teamControlData.ts` — `loadTeamControl()`, team leader lookup
- `app/api/auth/route.ts` — Login endpoint
- `app/api/visits/adherence/route.ts` — Adherence API
- `app/dashboard/page.tsx` — Main dashboard with KPIs + 3 summary tables
- `lib/roles.ts` — 4-tier role system: rep, team_leader, admin, super_admin

## Cleanup Still Needed
- Delete `app/api/debug/route.ts` (temporary diagnostic endpoint)
- Remove diagnostic `console.log` lines from `app/api/auth/route.ts` and `lib/userData.ts`
- Delete `COMMIT_MSG.txt` from repo root

---

