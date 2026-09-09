import type { Response } from 'supertest';
import type { ApiBody, PermissionsResponse } from '../types/e2e-responses';
import type { TestAgent } from './e2e-app';

/** Replaces fixture permissions through the supported individual grant/revoke routes. */
export async function replacePermissions(
  agent: TestAgent,
  userId: string,
  permissions: string[],
): Promise<Response> {
  const path = `/api/admin/users/${userId}/permissions`;
  const response = await agent.get(path).expect(200);
  const current = (response.body as ApiBody<PermissionsResponse>).data
    .permissions;
  const desired = new Set(permissions);
  const existing = new Set(current);
  for (const permission of current) {
    if (!desired.has(permission))
      await agent
        .delete(`${path}/${encodeURIComponent(permission)}`)
        .expect(200);
  }
  for (const permission of permissions) {
    if (!existing.has(permission))
      await agent.post(path).send({ permission }).expect(200);
  }
  return agent.get(path).expect(200);
}
