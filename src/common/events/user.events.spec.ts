import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from '@/infra/eventbus';
import { MailService } from '@/infra/mail/mail.service';
import { UserEventListeners, USER_INVITATION_SENT } from './user.events';

const mockInfoLog = jest.fn();
const mockErrorLog = jest.fn();

jest.mock('@/infra/logger/logger.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({ info: mockInfoLog, error: mockErrorLog })),
  },
}));

describe('UserEventListeners', () => {
  let listeners: UserEventListeners;

  const mockEvents = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  };

  const mockMail = {
    sendInvitation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserEventListeners,
        { provide: EventBusService, useValue: mockEvents },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    listeners = module.get<UserEventListeners>(UserEventListeners);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register the invitation handler on init', () => {
    listeners.onModuleInit();

    expect(mockEvents.on).toHaveBeenCalledWith(
      USER_INVITATION_SENT,
      expect.any(Function),
    );
  });

  it('should mail the invitation when the event fires', async () => {
    listeners.onModuleInit();

    const handler = mockEvents.on.mock.calls[0][1] as (
      ...args: unknown[]
    ) => Promise<void>;

    await handler({
      event: USER_INVITATION_SENT,
      email: 'staff@test.com',
      role: 'MANAGER',
      link: 'http://localhost:4200/register?token=abc',
      inviterName: 'Ada Boss',
      expiresInDays: 7,
    });

    expect(mockMail.sendInvitation).toHaveBeenCalledWith('staff@test.com', {
      role: 'MANAGER',
      link: 'http://localhost:4200/register?token=abc',
      inviterName: 'Ada Boss',
      expiresInDays: 7,
    });
  });

  it('should ignore malformed payloads', async () => {
    listeners.onModuleInit();

    const handler = mockEvents.on.mock.calls[0][1] as (
      ...args: unknown[]
    ) => Promise<void>;

    await handler({ event: USER_INVITATION_SENT });

    expect(mockMail.sendInvitation).not.toHaveBeenCalled();
  });

  it('should log when mailing fails', async () => {
    mockMail.sendInvitation.mockRejectedValue(
      new Error('Resend API error 401: unauthorized'),
    );

    listeners.onModuleInit();

    const handler = mockEvents.on.mock.calls[0][1] as (
      ...args: unknown[]
    ) => Promise<void>;

    await handler({
      event: USER_INVITATION_SENT,
      email: 'staff@test.com',
      role: 'MANAGER',
      link: 'http://localhost:4200/register?token=abc',
      inviterName: 'Ada Boss',
      expiresInDays: 7,
    });

    expect(mockErrorLog).toHaveBeenCalledWith(
      expect.stringContaining('Sub-account invitation email failed'),
    );
  });
});
