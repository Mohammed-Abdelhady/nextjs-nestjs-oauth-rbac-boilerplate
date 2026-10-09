import { Types } from 'mongoose';

export interface AssignedRoleRef {
  roleId: Types.ObjectId;
  assignedSlug: string;
  previousRoleId?: Types.ObjectId;
  created?: { updatedAt: Date; sessionVersion: number };
}
