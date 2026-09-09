import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

interface SentMail {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

describe('MailService', () => {
  let service: MailService;
  let sendMail: jest.Mock;

  const createTransport = nodemailer.createTransport as unknown as jest.Mock;
  const XSS_NAME = '<script>alert("xss")</script>';

  function lastMail(): SentMail {
    return sendMail.mock.calls[0][0] as SentMail;
  }

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    createTransport.mockReturnValue({ sendMail });

    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'smtp.from') return 'noreply@example.com';
        if (key === 'smtp.host') return 'smtp.example.com';
        if (key === 'smtp.port') return 587;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe('sendActivationCode (S-10)', () => {
    it('should escape the name before it reaches the HTML body', async () => {
      await service.sendActivationCode('user@example.com', '123456', XSS_NAME);

      const mail = lastMail();
      expect(mail.html).toContain('&lt;script&gt;');
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&quot;xss&quot;');
    });

    it('should send a plain text alternative holding the raw name', async () => {
      await service.sendActivationCode('user@example.com', '123456', XSS_NAME);

      const mail = lastMail();
      expect(mail.text).toContain(XSS_NAME);
      expect(mail.text).toContain('123456');
      expect(mail.text).not.toContain('&lt;');
    });

    it('should address the recipient and set the sender from config', async () => {
      await service.sendActivationCode('user@example.com', '123456', 'Jane');

      const mail = lastMail();
      expect(mail.to).toBe('user@example.com');
      expect(mail.from).toBe('noreply@example.com');
      expect(mail.html).toContain('Hi Jane,');
    });
  });

  describe('sendPasswordResetCode (S-10)', () => {
    it('should escape the name before it reaches the HTML body', async () => {
      await service.sendPasswordResetCode(
        'user@example.com',
        '654321',
        XSS_NAME,
      );

      const mail = lastMail();
      expect(mail.html).toContain('&lt;script&gt;');
      expect(mail.html).not.toContain('<script>');
    });

    it('should send a plain text alternative', async () => {
      await service.sendPasswordResetCode('user@example.com', '654321', 'Jane');

      const mail = lastMail();
      expect(mail.text).toContain('654321');
      expect(mail.subject).toBe('Reset Your Password');
    });
  });

  describe('sendRegistrationAttemptNotice (S-13)', () => {
    it('should send text only, with no HTML body and no code', async () => {
      await service.sendRegistrationAttemptNotice('user@example.com', 'Jane');

      const mail = lastMail();
      expect(mail.html).toBeUndefined();
      expect(mail.text).toContain('Hi Jane,');
      expect(mail.text).toContain('nothing has changed');
      expect(mail.subject).toBe(
        'Someone tried to register with your email address',
      );
    });
  });

  describe('sendMail', () => {
    it('should report a delivery failure as an error', async () => {
      sendMail.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.sendActivationCode('user@example.com', '123456', 'Jane'),
      ).rejects.toThrow('Failed to send email: connection refused');
    });
  });
});
