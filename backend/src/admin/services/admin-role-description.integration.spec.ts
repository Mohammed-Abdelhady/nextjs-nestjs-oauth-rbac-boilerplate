import { ClientSessionOptions } from 'mongoose';
import { MongoNetworkError } from 'mongodb';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  EDITOR_SLUG,
  useAdminRoundFour,
} from './admin-round-four.harness-spec';

describe('description edits use the role transaction', () => {
  const fixture = useAdminRoundFour('round_five_description');
  it('persists an authorized description edit without revoking holder sessions', async () => {
    const { h } = fixture;
    const holder = await fixture.seed(
      'description-holder@example.test',
      EDITOR_SLUG,
    );
    const answer = await h.roles.update(
      EDITOR_SLUG,
      { description: 'Editorial access' },
      fixture.roleActorId,
    );
    expect(answer.description).toBe('Editorial access');
    expect(
      (await h.roleModel.findOne({ slug: EDITOR_SLUG }))?.description,
    ).toBe('Editorial access');
    expect((await h.users.findById(holder._id))?.sessionVersion).toBe(0);
    expect(await h.events.countDocuments({})).toBe(0);
  });
  it('rolls back a description edit when its commit fails', async () => {
    const { h } = fixture;
    const start = h.connection.startSession.bind(h.connection);
    jest
      .spyOn(h.connection, 'startSession')
      .mockImplementationOnce(async (options?: ClientSessionOptions) => {
        const session = await start(options);
        jest
          .spyOn(session, 'commitTransaction')
          .mockRejectedValueOnce(
            new MongoNetworkError('commit disconnected before send'),
          );
        return session;
      });
    await expect(
      h.roles.update(
        EDITOR_SLUG,
        { description: 'Rejected edit' },
        fixture.roleActorId,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTHORITY_UNAVAILABLE,
      status: 503,
    });
    expect(
      (await h.roleModel.findOne({ slug: EDITOR_SLUG }))?.description,
    ).toBeUndefined();
    expect(await h.events.countDocuments({})).toBe(0);
  });
});
