import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import Logger from '@/infra/logger/logger.service';

jest.mock('@/infra/logger/logger.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({ info: jest.fn() })),
  },
}));

describe('MailService', () => {
  let service: MailService;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  const previousEnv = { ...process.env };
  const realFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);

    fetchMock = jest.fn(
      async (..._callArgs: Parameters<typeof fetch>): Promise<Response> => {
        return new Response('{"id":"resend-id-1"}', { status: 200 });
      },
    );
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...previousEnv };
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  describe('resend', () => {
    it('should send the OTP through the Resend API when a key is configured', async () => {
      process.env.RESEND_API_KEY = 'resend-test-key';
      process.env.MAIL_FROM = 'Lodgify <sender@lodgify.local>';
      delete process.env.SMTP_HOST;

      await service.sendPasswordResetOtp('user@test.com', '482913', 10);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init?.method).toBe('POST');

      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer resend-test-key');

      const rawBody = init?.body;
      expect(typeof rawBody).toBe('string');

      if (typeof rawBody === 'string') {
        expect(rawBody).toContain('482913');
        expect(rawBody).toContain('sender@lodgify.local');
        expect(rawBody).toContain('user@test.com');
      }
    });

    it('should throw when the Resend API rejects the request', async () => {
      process.env.RESEND_API_KEY = 'resend-test-key';
      delete process.env.SMTP_HOST;

      fetchMock = jest.fn(
        async (..._callArgs: Parameters<typeof fetch>): Promise<Response> => {
          return new Response('unauthorized', { status: 401 });
        },
      );
      global.fetch = fetchMock;

      await expect(
        service.sendPasswordResetOtp('user@test.com', '482913', 10),
      ).rejects.toThrow('Resend API error 401: unauthorized');
    });
  });

  describe('fallback', () => {
    it('should log the OTP when neither Resend nor SMTP is configured', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SMTP_HOST;

      await service.sendPasswordResetOtp('user@test.com', '482913', 10);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(Logger.getInstance).toHaveBeenCalledWith('mail');
    });
  });
});
