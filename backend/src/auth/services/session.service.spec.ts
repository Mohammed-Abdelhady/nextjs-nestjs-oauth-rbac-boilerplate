import { Test, TestingModule } from '@nestjs/testing';
import { SessionAuthorityService } from '../../session/services/session-authority.service';
import { SessionIssuanceService } from '../../session/services/session-issuance.service';
import { SessionRevocationService } from '../../session/services/session-revocation.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  it('validates a browser session without extending its idle deadline', async () => {
    const authority = { validate: jest.fn().mockResolvedValue(null) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SessionIssuanceService, useValue: {} },
        { provide: SessionAuthorityService, useValue: authority },
        { provide: SessionRevocationService, useValue: {} },
      ],
    }).compile();
    const sessions = module.get(SessionService);

    await sessions.validateSessionWithoutExtendingIdle('session-cookie');

    expect(authority.validate).toHaveBeenCalledWith('session-cookie', {
      extendIdle: false,
    });
    await module.close();
  });
});
