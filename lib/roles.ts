// ─── Role type ──────────────────────────────────────────────────────
// This file is client-safe — no fs/path/blob imports.

export type TenantRole = 'super_admin' | 'admin' | 'team_leader' | 'rep';

export const ROLE_HIERARCHY: TenantRole[] = ['rep', 'team_leader', 'admin', 'super_admin'];

export interface RoleDef {
  key: TenantRole;
  label: string;
  color: string;        // Tailwind color class base (e.g. 'purple')
  bgClass: string;      // badge bg
  textClass: string;    // badge text
  isProtected: boolean; // super_admin always has all permissions
}

export const ROLES: RoleDef[] = [
  { key: 'super_admin', label: 'Super Admin', color: 'purple', bgClass: 'bg-purple-100', textClass: 'text-purple-700', isProtected: true },
  { key: 'admin',       label: 'Admin',       color: 'blue',   bgClass: 'bg-blue-100',   textClass: 'text-blue-700',   isProtected: false },
  { key: 'team_leader', label: 'Team Leader', color: 'amber',  bgClass: 'bg-amber-100',  textClass: 'text-amber-700',  isProtected: false },
  { key: 'rep',         label: 'Rep',         color: 'gray',   bgClass: 'bg-gray-100',   textClass: 'text-gray-600',   isProtected: false },
];

export function getRoleDef(role: TenantRole): RoleDef {
  return ROLES.find(r => r.key === role) || ROLES[ROLES.length - 1];
}

// ─── Permissions ────────────────────────────────────────────────────

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  { key: 'manage_users',         label: 'Manage Users',         description: 'Add, edit, and delete users' },
  { key: 'manage_roles',         label: 'Manage Roles',         description: 'Edit role permission assignments' },
  { key: 'upload_data',          label: 'Upload Data',          description: 'Upload call cycle and schedule files' },
  { key: 'view_schedule',        label: 'View Schedule',        description: 'View the call schedule' },
  { key: 'edit_schedule',        label: 'Edit Schedule',        description: 'Edit and delete schedule rows' },
  { key: 'view_dashboard',       label: 'View Dashboard',       description: 'View dashboard and KPIs' },
  { key: 'manage_control_files', label: 'Manage Control Files', description: 'Upload and manage control files' },
  { key: 'manage_perigee',       label: 'Manage Perigee API',   description: 'Configure Perigee API settings' },
  { key: 'view_activity',        label: 'View Activity Log',    description: 'View activity and audit logs' },
  { key: 'export_data',          label: 'Export Data',          description: 'Download schedule as Excel' },
];

export const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map(p => p.key);

// ─── Default permission map ─────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<TenantRole, string[]> = {
  super_admin: [...ALL_PERMISSION_KEYS], // all permissions
  admin: [
    'upload_data',
    'view_schedule',
    'edit_schedule',
    'view_dashboard',
    'manage_control_files',
    'view_activity',
    'export_data',
  ],
  team_leader: [
    'view_schedule',
    'view_dashboard',
    'export_data',
  ],
  rep: [
    'view_schedule',
    'view_dashboard',
  ],
};

// ─── Permission check helpers ───────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * `rolePerms` is the loaded role-permission mapping. If not provided, uses defaults.
 * super_admin always returns true regardless.
 */
export function hasPermission(
  role: TenantRole,
  permissionKey: string,
  rolePerms?: Record<TenantRole, string[]>,
): boolean {
  if (role === 'super_admin') return true;
  const perms = rolePerms || DEFAULT_ROLE_PERMISSIONS;
  return (perms[role] || []).includes(permissionKey);
}

/**
 * Check if roleA >= roleB in hierarchy.
 */
export function roleAtLeast(role: TenantRole, minRole: TenantRole): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minRole);
}

// ─── Role migration ─────────────────────────────────────────────────

/**
 * Migrate old role values to the new 4-tier system.
 * - old 'admin'   → 'super_admin'
 * - old 'manager' → 'admin'
 * - old 'user'    → 'rep'
 */
export function migrateRole(oldRole: string | undefined, isAdmin?: boolean): TenantRole {
  if (!oldRole) return isAdmin ? 'super_admin' : 'rep';
  if (oldRole === 'admin') return 'super_admin';
  if (oldRole === 'manager') return 'admin';
  if (oldRole === 'user') return 'rep';
  // Already new role values
  if (ROLE_HIERARCHY.includes(oldRole as TenantRole)) return oldRole as TenantRole;
  return 'rep';
}
