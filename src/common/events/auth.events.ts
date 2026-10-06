import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Service } from '@/common/domain/base.service';
import { EventBusService } from '@/infra/eventbus';
import { MailService } from '@/infra/mail/mail.service';

export const AUTH_OTP_REQUESTED = 'auth:password-reset-otp' as const;

export type PasswordResetOtpRequested = {
  readonly event: typeof AUTH_OTP_REQUESTED;
  readonly email: string;
  readonly otp: string;
  readonly expiresInMinutes: number;
};

export function isPasswordResetOtpRequested(
  value: unknown,
): value is PasswordResetOtpRequested {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.event === AUTH_OTP_REQUESTED &&
    typeof candidate.email === 'string' &&
    typeof candidate.otp === 'string' &&
    typeof candidate.expiresInMinutes === 'number'
  );
}

@Injectable()
export class AuthEventListeners
  extends Service
  implements OnModuleInit, OnModuleDestroy
{
  private readonly handleOtpRequested = async (
    ...args: unknown[]
  ): Promise<void> => {
    const [payload] = args;

    if (!isPasswordResetOtpRequested(payload)) {
      return;
    }

    try {
      await this.mail.sendPasswordResetOtp(
        payload.email,
        payload.otp,
        payload.expiresInMinutes,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Password reset email failed for ${payload.email}: ${error.message}`,
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
    this.events.on(AUTH_OTP_REQUESTED, this.handleOtpRequested);
  }

  onModuleDestroy(): void {
    this.events.off(AUTH_OTP_REQUESTED, this.handleOtpRequested);
  }
}
