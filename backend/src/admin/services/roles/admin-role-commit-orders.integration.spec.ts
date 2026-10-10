import { UserRole } from '../../../user/enums/user-role.enum';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { REVOKED_REASON } from '../../../session/constants/revoked-reason';
import { RaceGate } from '../../../../test/utils/race-gate';
import {
  EDITOR_SLUG,
  LEAD_SLUG,
  useAdminRoundFour,
} from '../../persistence/mongo/services/admin-round-four.harness-spec';

const HOLDER_COUNT = 300;
const OPERATIONS = ['rename', 'delete'] as const;
const CALLERS = ['assignment', 'creation'] as const;

describe('role edits and assignments cover both commit orders', () => {
  const fixture = useAdminRoundFour('round_four_orders');

  for (const operation of OPERATIONS) {
    for (const caller of CALLERS) {
      it(`${caller} finishes before an open ${operation} commits`, async () => {
        const { h } = fixture;
        const target = await fixture.seed('target@example.test');
        if (operation === 'rename') {
          await h.users.collection.insertMany(
            Array.from({ length: HOLDER_COUNT }, (_, index) => ({
              email: `holder-${index}@example.test`,
              name: 'Holder',
              role: EDITOR_SLUG,
              isVerified: true,
              isDeleted: false,
              sessionVersion: 0,
            })),
          );
        }
        const gate = new RaceGate();
        if (operation === 'rename') {
          const original = h.users.collection.updateMany.bind(
            h.users.collection,
          );
          jest
            .spyOn(h.users.collection, 'updateMany')
            .mockImplementationOnce(async (...args) => {
              await gate.hold();
              return original(...args);
            });
        } else {
          const original = h.roleModel.collection.deleteOne.bind(
            h.roleModel.collection,
          );
          jest
            .spyOn(h.roleModel.collection, 'deleteOne')
            .mockImplementationOnce(async (...args) => {
              await gate.hold();
              return original(...args);
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
        try {
          await gate.reached();
          if (caller === 'assignment') {
            await fixture.assign(target._id.toString());
          } else {
            await fixture.create('created@example.test');
          }
        } finally {
          gate.release();
          await edit;
        }
        const stored = await h.users.findOne({
          email:
            caller === 'assignment'
              ? 'target@example.test'
              : 'created@example.test',
        });
        expect(stored?.role).toBe(
          operation === 'rename' ? LEAD_SLUG : UserRole.USER,
        );
        expect(
          await h.roleModel.findOne({ slug: stored?.role }),
        ).not.toBeNull();
        expect(stored?.sessionVersion).toBe(caller === 'assignment' ? 2 : 1);
        const events = await h.events
          .find({ targetUserId: stored?._id.toString() })
          .lean();
        expect(events).toHaveLength(caller === 'assignment' ? 2 : 1);
        expect(
          events.map((event) => ({
            actorId: event.actorId,
            reasonCode: event.reasonCode,
          })),
        ).toEqual(
          caller === 'assignment'
            ? [
                {
                  actorId: fixture.actorId,
                  reasonCode: REVOKED_REASON.ADMIN_FORCED,
                },
                {
                  actorId: fixture.roleActorId,
                  reasonCode: REVOKED_REASON.ADMIN_FORCED,
                },
              ]
            : [
                {
                  actorId: fixture.roleActorId,
                  reasonCode: REVOKED_REASON.ADMIN_FORCED,
                },
              ],
        );
      });

      it(`${operation} commits before the open ${caller} writes`, async () => {
        const { h } = fixture;
        const target = await fixture.seed('target@example.test');
        const gate = new RaceGate();
        if (caller === 'assignment') {
          const original = h.users.collection.updateOne.bind(
            h.users.collection,
          );
          jest
            .spyOn(h.users.collection, 'updateOne')
            .mockImplementationOnce(async (...args) => {
              await gate.hold();
              return original(...args);
            });
        } else {
          const original = h.users.collection.insertOne.bind(
            h.users.collection,
          );
          jest
            .spyOn(h.users.collection, 'insertOne')
            .mockImplementationOnce(async (...args) => {
              await gate.hold();
              return original(...args);
            });
        }
        const request =
          caller === 'assignment'
            ? fixture.assign(target._id.toString())
            : fixture.create('created@example.test');
        const settled = Promise.allSettled([request]);
        try {
          await gate.reached();
          if (operation === 'rename') {
            await h.roles.update(
              EDITOR_SLUG,
              { name: 'Content Lead' },
              fixture.roleActorId,
            );
          } else {
            await h.roles.delete(EDITOR_SLUG, fixture.roleActorId);
          }
        } finally {
          gate.release();
          await settled;
        }
        if (operation === 'rename') {
          const answer = await request;
          expect(answer.data?.role).toBe(LEAD_SLUG);
        } else {
          await expect(request).rejects.toMatchObject({
            code: ErrorCode.ROLE_NOT_FOUND,
            status: 404,
          });
        }
        const stored = await h.users.findOne({
          email:
            caller === 'assignment'
              ? 'target@example.test'
              : 'created@example.test',
        });
        if (operation === 'delete' && caller === 'creation') {
          expect(stored).toBeNull();
          await fixture.create('created@example.test', UserRole.USER);
          expect(
            (await h.users.findOne({ email: 'created@example.test' }))?.role,
          ).toBe(UserRole.USER);
        } else {
          expect(stored?.role).toBe(
            operation === 'rename' ? LEAD_SLUG : UserRole.USER,
          );
          expect(
            await h.roleModel.findOne({ slug: stored?.role }),
          ).not.toBeNull();
        }
      });
    }
  }
});
