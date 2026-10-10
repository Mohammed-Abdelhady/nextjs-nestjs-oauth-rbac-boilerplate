import { Types } from 'mongoose';
import { ErrorCode } from '../../../../../common/enums/error-code.enum';
import { UserRole } from '../../../../../user/enums/user-role.enum';
import { REVOKED_REASON } from '../../../../../session/constants/revoked-reason';
import { RaceGate } from '../../../../../../test/utils/race-gate';
import {
  EDITOR_SLUG,
  useAdminRoundFour,
} from '../admin-round-four.harness-spec';

const REPAIR_ORDERS = ['delete first', 'assignment first'] as const;

describe('delete restoration uses the cause and previous role', () => {
  const fixture = useAdminRoundFour('round_seven_delete_order');
  for (const order of REPAIR_ORDERS) {
    it(`restores manager with the deleting actor when ${order} repairs`, async () => {
      const { h } = fixture;
      const target = await fixture.seed(
        'delete-order@example.test',
        UserRole.MANAGER,
      );
      const deleted = await h.roleModel.findOne({ slug: EDITOR_SLUG }).orFail();
      const deletionGate = new RaceGate();
      const reconcileGate = new RaceGate();
      const sweepGate = new RaceGate();
      let deleting = false;
      let reconcileHeld = false;
      const remove = h.roleModel.collection.deleteOne.bind(
        h.roleModel.collection,
      );
      jest
        .spyOn(h.roleModel.collection, 'deleteOne')
        .mockImplementationOnce(async (...args) => {
          deleting = true;
          await deletionGate.hold();
          return remove(...args);
        });
      const find = h.roleModel.collection.findOne.bind(h.roleModel.collection);
      let sweepHeld = false;
      jest
        .spyOn(h.roleModel.collection, 'findOne')
        .mockImplementation(async (...args) => {
          if (!reconcileHeld && args[0]?._id && !args[1]?.session) {
            reconcileHeld = true;
            await reconcileGate.hold();
          } else if (
            order === 'assignment first' &&
            deleting &&
            !sweepHeld &&
            args[1]?.session &&
            args[0]?._id instanceof Types.ObjectId &&
            args[0]._id.equals(deleted._id)
          ) {
            sweepHeld = true;
            await sweepGate.hold();
          }
          return find(...args);
        });
      const deletion = h.roles.delete(EDITOR_SLUG, fixture.roleActorId);
      const deleteSettled = Promise.allSettled([deletion]);
      let assignment: ReturnType<typeof fixture.assign> | undefined;
      try {
        await deletionGate.reached();
        assignment = fixture.assign(target._id.toString());
        const assignedSettled = Promise.allSettled([assignment]);
        await reconcileGate.reached();
        deletionGate.release();
        if (order === 'assignment first') {
          await sweepGate.reached();
          reconcileGate.release();
          await assignedSettled;
          sweepGate.release();
        }
        await deletion;
        reconcileGate.release();
        await assignedSettled;
        await expect(assignment).rejects.toMatchObject({
          code: ErrorCode.ROLE_NOT_FOUND,
          status: 404,
        });
      } finally {
        deletionGate.release();
        reconcileGate.release();
        sweepGate.release();
        await deleteSettled;
        if (assignment) await Promise.allSettled([assignment]);
      }
      const stored = await h.users.findById(target._id);
      expect(stored?.role).toBe(UserRole.MANAGER);
      expect(stored?.sessionVersion).toBe(2);
      expect(await h.users.countDocuments({ role: EDITOR_SLUG })).toBe(0);
      const events = await h.events
        .find({ targetUserId: target._id.toString() })
        .sort({ _id: 1 })
        .lean();
      expect(events).toHaveLength(2);
      expect(
        events.map((event) => ({
          actorId: event.actorId,
          reasonCode: event.reasonCode,
        })),
      ).toEqual([
        { actorId: fixture.actorId, reasonCode: REVOKED_REASON.ADMIN_FORCED },
        {
          actorId: fixture.roleActorId,
          reasonCode: REVOKED_REASON.ADMIN_FORCED,
        },
      ]);
    });
  }
});
