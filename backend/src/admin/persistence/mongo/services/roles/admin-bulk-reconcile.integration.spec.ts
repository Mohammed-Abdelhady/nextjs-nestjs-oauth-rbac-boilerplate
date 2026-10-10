import { Types } from 'mongoose';
import { AppException } from '../../../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../../../common/enums/error-code.enum';
import { REVOKED_REASON } from '../../../../../session/constants/revoked-reason';
import { RaceGate } from '../../../../../../test/utils/race-gate';
import {
  EDITOR_SLUG,
  LEAD_SLUG,
  OLD_SLUG,
  useAdminRoundFour,
} from '../admin-round-four.harness-spec';

const ASSIGNMENTS = 20;
const OPERATIONS = ['rename', 'delete'] as const;
const ORDERS = ['assignments first', 'edit first'] as const;

describe('bulk reconciliation of concurrent assignments', () => {
  const fixture = useAdminRoundFour('round_five_bulk');
  for (const operation of OPERATIONS)
    for (const order of ORDERS) {
      it(`repairs 20 assignments when ${operation} is open and ${order}`, async () => {
        const { h } = fixture;
        const role = await h.roleModel.findOne({ slug: EDITOR_SLUG }).orFail();
        const users = await Promise.all(
          Array.from({ length: ASSIGNMENTS }, (_, index) =>
            fixture.seed(`concurrent-${index}@example.test`, OLD_SLUG),
          ),
        );
        const editGate = new RaceGate();
        const writes = new RaceGate();
        const reads = new RaceGate();
        let bulkReads = false;
        if (operation === 'rename') {
          const update = h.roleModel.collection.updateOne.bind(
            h.roleModel.collection,
          );
          jest
            .spyOn(h.roleModel.collection, 'updateOne')
            .mockImplementationOnce(async (...args) => {
              await editGate.hold();
              return update(...args);
            });
        } else {
          const remove = h.roleModel.collection.deleteOne.bind(
            h.roleModel.collection,
          );
          jest
            .spyOn(h.roleModel.collection, 'deleteOne')
            .mockImplementationOnce(async (...args) => {
              await editGate.hold();
              return remove(...args);
            });
        }
        const find = h.roleModel.collection.findOne.bind(
          h.roleModel.collection,
        );
        jest
          .spyOn(h.roleModel.collection, 'findOne')
          .mockImplementation(async (...args) => {
            const result = await find(...args);
            const targetsRole =
              args[0]?._id instanceof Types.ObjectId &&
              args[0]._id.equals(role._id);
            const session = args[1]?.session;
            if (
              targetsRole &&
              ((!session && order === 'assignments first') ||
                (session && bulkReads))
            ) {
              await reads.hold();
            }
            return result;
          });
        if (order === 'edit first') {
          const update = h.users.collection.updateOne.bind(h.users.collection);
          jest
            .spyOn(h.users.collection, 'updateOne')
            .mockImplementation(async (...args) => {
              if (
                !Array.isArray(args[1]) &&
                args[1]?.$set?.role === EDITOR_SLUG
              )
                await writes.hold();
              return update(...args);
            });
        }
        const edit =
          operation === 'rename'
            ? h.roles.update(
                EDITOR_SLUG,
                { name: 'Content Lead' },
                fixture.roleActorId,
              )
            : h.roles.delete(EDITOR_SLUG, fixture.roleActorId);
        const editSettled = Promise.allSettled([edit]);
        let settled: ReturnType<typeof Promise.allSettled> | undefined;
        let requests: ReturnType<typeof fixture.assign>[] = [];
        async function reachOrDiagnose(gate: RaceGate, phase: string) {
          const reached = await Promise.race([
            gate.reached(ASSIGNMENTS).then(() => true),
            ...requests.map((request) =>
              request.then(
                () => false,
                () => false,
              ),
            ),
          ]);
          if (!reached) {
            editGate.release();
            writes.release();
            reads.release();
            throw new Error(
              JSON.stringify({
                phase,
                outcomes: await settled,
                users: await h.users
                  .find({ _id: { $in: users.map((user) => user._id) } })
                  .select('role sessionVersion')
                  .lean(),
              }),
            );
          }
        }
        try {
          const editReached = await Promise.race([
            editGate.reached().then(() => true),
            editSettled.then(() => false),
          ]);
          if (!editReached)
            throw new Error(
              JSON.stringify({
                phase: 'role edit write',
                outcomes: await editSettled,
              }),
            );
          requests = users.map((user) => fixture.assign(user._id.toString()));
          settled = Promise.allSettled(requests);
          if (order === 'assignments first') {
            await reachOrDiagnose(reads, 'assignment reconciliation reads');
            editGate.release();
            await edit;
          } else {
            await reachOrDiagnose(writes, 'assignment writes');
            editGate.release();
            await edit;
            bulkReads = true;
            writes.release();
            await reachOrDiagnose(reads, 'bulk repair snapshots');
          }
        } finally {
          editGate.release();
          writes.release();
          reads.release();
          await editSettled;
          await settled;
        }
        await edit;
        const answers = await settled;
        expect(
          answers?.filter(
            (answer) =>
              answer.status === 'rejected' &&
              answer.reason instanceof AppException &&
              answer.reason.getStatus() === 503,
          ),
        ).toHaveLength(0);
        expect(await h.users.countDocuments({ role: EDITOR_SLUG })).toBe(0);
        for (const user of users) {
          const stored = await h.users.findById(user._id);
          expect(stored?.role).toBe(
            operation === 'rename' ? LEAD_SLUG : OLD_SLUG,
          );
          expect(stored?.sessionVersion).toBe(2);
          const events = await h.events
            .find({ targetUserId: user._id.toString() })
            .sort({ _id: 1 })
            .lean();
          expect(events).toHaveLength(2);
          expect(
            events.map((event) => ({
              actorId: event.actorId,
              reasonCode: event.reasonCode,
            })),
          ).toEqual([
            {
              actorId: fixture.actorId,
              reasonCode: REVOKED_REASON.ADMIN_FORCED,
            },
            {
              actorId:
                operation === 'delete' || order === 'assignments first'
                  ? fixture.roleActorId
                  : fixture.actorId,
              reasonCode: REVOKED_REASON.ADMIN_FORCED,
            },
          ]);
        }
        for (const answer of answers ?? []) {
          if (operation === 'delete') {
            expect(answer).toMatchObject({
              status: 'rejected',
              reason: { code: ErrorCode.ROLE_NOT_FOUND, status: 404 },
            });
          } else {
            expect(answer).toMatchObject({
              status: 'fulfilled',
              value: {
                data: {
                  role: operation === 'rename' ? LEAD_SLUG : OLD_SLUG,
                },
              },
            });
          }
        }
      });
    }
});
