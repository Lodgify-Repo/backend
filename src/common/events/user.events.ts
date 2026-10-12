import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Service } from '@/common/domain/base.service';
import { EventBusService } from '@/infra/eventbus';
import { MailService } from '@/infra/mail/mail.service';
import { hasErrorCode } from './auth.events';

export const USER_INVITATION_SENT = 'user:sub-account-invited' as const;

export type SubAccountInvited = {
  readonly event: typeof USER_INVITATION_SENT;
  readonly email: string;
  readonly role: string;
  readonly link: string;
  readonly inviterName: string;
  readonly expiresInDays: number;
};

export function isSubAccountInvited(
  value: unknown,
): value is SubAccountInvited {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.event === USER_INVITATION_SENT &&
    typeof candidate.email === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.link === 'string' &&
    typeof candidate.inviterName === 'string' &&
    typeof candidate.expiresInDays === 'number'
  );
}

@Injectable()
export class UserEventListeners
  extends Service
  implements OnModuleInit, OnModuleDestroy
{
  private readonly handleInvitationSent = async (
    ...args: unknown[]
  ): Promise<void> => {
    const [payload] = args;

    if (!isSubAccountInvited(payload)) {
      return;
    }

    const { email, role, link, inviterName, expiresInDays } = payload;

    try {
      await this.mail.sendInvitation(email, {
        role,
        link,
        inviterName,
        expiresInDays,
      });
      this.logger.info(`Sub-account invitation sent to ${email}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        const code =
          hasErrorCode(error) && typeof error.code === 'string'
            ? ` [${error.code}]`
            : '';
        this.logger.error(
          `Sub-account invitation email failed${code}: ${error.message}`,
        );
        return;
      }

      throw error;
    }
  };

  constructor(
    private readonly events: EventBusService,
    private readonly mail: MailService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.events.on(USER_INVITATION_SENT, this.handleInvitationSent);
  }

  onModuleDestroy(): void {
    this.events.off(USER_INVITATION_SENT, this.handleInvitationSent);
  }
}
