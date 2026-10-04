export interface RoleAssignmentEvent {
  assignedRoleId: string;
  sessionVersion: number;
  previousRoleId?: string;
}
