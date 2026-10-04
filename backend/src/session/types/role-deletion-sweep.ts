export interface RoleDeletionSweep {
  roleId: string;
  previousSlug: string;
  actorId: string;
  pending: boolean;
  sweepId?: string;
}
