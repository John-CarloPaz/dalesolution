export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  team_lead: 'Team Lead',
  employee: 'Virtual Assistant',
};

export const ADMIN_ROLES: Role[] = [ROLES.OWNER, ROLES.ADMIN];
export const MANAGEMENT_ROLES: Role[] = [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_LEAD];

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isManagement(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role);
}
