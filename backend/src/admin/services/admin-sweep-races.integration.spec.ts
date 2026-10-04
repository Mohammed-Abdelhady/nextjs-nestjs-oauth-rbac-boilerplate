import { UserRole } from '../../user/enums/user-role.enum';
import { RaceGate } from '../../../test/utils/race-gate';
import {
  EDITOR_SLUG,
  LEAD_SLUG,
  FRESH_SLUG,
  useAdminRoundFour,
} from './admin-round-four.harness-spec';

const DESTINATION_CHANGES = ['rename', 'delete', 'rename back'] as const;

describe('role sweep destinations remain live', () => {
  const fixture = useAdminRoundFour('round_four_sweep');
  for (const change of DESTINATION_CHANGES) {
    it(`re-reads a destination changed by ${change} after its snapshot`, async () => {
      const { h } = fixture;
      const holder = await fixture.seed('holder@example.test', EDITOR_SLUG);
      const target = await fixture.seed('straggler@example.test');
      const mainGate = new RaceGate();
      const repairGate = new RaceGate();
      const originalMove = h.users.collection.updateMany.bind(
        h.users.collection,
      );
      jest
        .spyOn(h.users.collection, 'updateMany')
        .mockImplementationOnce(async (...args) => {
          await mainGate.hold();
          return originalMove(...args);
        });
      const originalRoleWrite = h.roleModel.collection.updateOne.bind(
        h.roleModel.collection,
      );
      let held = false;
      jest
        .spyOn(h.roleModel.collection, 'updateOne')
        .mockImplementation(async (...args) => {
          const update = args[1];
          if (
            !held &&
            !Array.isArray(update) &&
            update?.$inc?.__v === 1 &&
            !update.$set
          ) {
            held = true;
            await repairGate.hold();
          }
          return originalRoleWrite(...args);
        });
      const firstRename = h.roles.update(
        EDITOR_SLUG,
        { name: 'Content Lead' },
        fixture.roleActorId,
      );
      const firstSettled = Promise.allSettled([firstRename]);
      async function reachOrDiagnose(gate: RaceGate, phase: string) {
        const reached = await Promise.race([
          gate.reached().then(() => true),
          firstSettled.then(() => false),
        ]);
        if (!reached) {
          throw new Error(
            JSON.stringify({
              phase,
              outcomes: await firstSettled,
              holder: await h.users.findById(holder._id).lean(),
              straggler: await h.users.findById(target._id).lean(),
              roles: await h.roleModel
                .find()
                .select('slug pendingHolderSweeps')
                .lean(),
            }),
          );
        }
      }
      try {
        await reachOrDiagnose(mainGate, 'primary holder move');
        await fixture.assign(target._id.toString());
        mainGate.release();
        await reachOrDiagnose(repairGate, 'destination fence');
        if (change === 'delete') {
          await fixture.assign(holder._id.toString(), UserRole.USER);
          await h.roles.delete(LEAD_SLUG, fixture.roleActorId);
        } else {
          await h.roles.update(
            LEAD_SLUG,
            {
              name: change === 'rename back' ? 'Content Editor' : 'Fresh Role',
            },
            fixture.roleActorId,
          );
        }
      } finally {
        mainGate.release();
        repairGate.release();
        await firstSettled;
      }
      await firstRename;
      const stored = await h.users.findById(target._id);
      expect(stored?.role).toBe(
        change === 'delete'
          ? UserRole.USER
          : change === 'rename back'
            ? EDITOR_SLUG
            : FRESH_SLUG,
      );
      expect(await h.roleModel.findOne({ slug: stored?.role })).not.toBeNull();
      expect(stored?.sessionVersion).toBe(change === 'rename back' ? 1 : 2);
      const events = await h.events
        .find({ targetUserId: target._id.toString() })
        .sort({ _id: 1 })
        .lean();
      expect(events.map((event) => event.actorId)).toEqual(
        change === 'rename back'
          ? [fixture.actorId]
          : [fixture.actorId, fixture.roleActorId],
      );
      expect(
        await h.events.countDocuments({ targetUserId: target._id.toString() }),
      ).toBe(change === 'rename back' ? 1 : 2);
    });
  }
});
