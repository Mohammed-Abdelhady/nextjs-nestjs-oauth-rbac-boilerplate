# Role changes and session revocation

Users store their role as a slug string. An admin assignment, creation, rename or deletion reads and writes inside a majority transaction. Changes to existing holders and their session revocation events commit together.

## Scale limit

A role edit moves and revokes every holder in one transaction. A role with a very large number of holders can exceed the transaction limits. This is a known limit.

Deleting a custom role requires the default role in the transaction's snapshot. The API cannot delete protected system roles. Direct database removal of the default after that snapshot is outside this guarantee. Unrelated deletes only read the default role.

After commit, assignments resolve the assigned role by id. Renames and deletes also sweep holders left on an old slug. These two repairs cover both commit orders. If deletion restores the user before reconciliation's final user read, the assignment answers 404 in either commit order. Reconciliation re-checks the assigned role by id after that changed user read. A process crash after an assignment commits but before reconciliation can still leave a stale slug. Recorded sweeps retry on a later edit and once at application startup. Startup repair runs in the background, with bounded discovery and transaction passes. It logs failures and does not stop startup.

Admin role changes write previous-role ids and the assignment session version on security events. Creation and automatic holder moves do not write assignment history. History expires with the events after 90 days. A deleted role's holders return to their recorded previous role's live slug. Missing history or a missing previous role falls back to the default role. A delete records its pending reference and actor in a security event in the delete transaction, so restore events identify the deleting admin even when an assignment performs the repair first.

A role retains at most 16 pending sweep references. A rename that would exceed that bound answers 503 before commit. Finish earlier repairs before retrying it. Startup examines at most 16 role owners and 16 pending delete events per instance. It orders role owners by oldest update and rotates owners with failed work to the back, so a later owner can be reached at the next start. Each sweep has at most three passes. Startup stops before starting another repair entry after 30 seconds or when shutdown begins. An already running entry finishes before shutdown returns. Several instances can start together; repaired holders do not receive duplicate revocations. Delete references in events expire after 90 days too, so operators should address repeated failures promptly.

`role_holder_sweep_pending` means the role operation committed but its repair is still pending. Check the role id, previous slug, actor id and error. Restore database availability, then edit the owner role to retry. A delete's transferred references belong to the default role. Restarting an instance also starts one background repair attempt. An empty sweep clears its pending reference. The API answers success for the committed role operation even if that sweep fails.

`role_holder_sweep_slug_reused` means another role now owns the old slug. The sweep stops. Remaining holders of that slug keep the new role of that name. Check whether that membership is intended and reassign users explicitly if needed.

`admin_role_reconcile_failed` means an assignment committed but its post-commit reconciliation failed. The API answers 503 for database unavailability, 404 for a missing default role, or 500 for a non-database error. Check the user id, role id and database state before retrying the request. Check pending sweeps and the user's current live role.

`role_holder_sweep_bootstrap_failed` means startup could not discover pending repair work or the default role was missing. Startup continues. Check the sanitized error facts and the default role, then retry through a role edit or a later application start.

`role_holder_sweep_bootstrap_budget_exhausted` means the background attempt reached its overall budget. Remaining references stay pending. Check the pending owners and retry through a role edit or a later start. `role_holder_sweep_bootstrap_finished` is a debug line marking the end of that background attempt, including a failed or interrupted attempt.

Run this query to find users stranded by the crash window or a pending delete older than the 90-day event retention. Review the result and reassign each user to an intended live role.

```javascript
db.users.aggregate([
  {
    $lookup: {
      from: 'roles',
      localField: 'role',
      foreignField: 'slug',
      as: 'liveRole',
    },
  },
  { $match: { 'liveRole.0': { $exists: false } } },
  { $project: { _id: 1, role: 1 } },
]);
```
