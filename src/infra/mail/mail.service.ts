import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import Logger from '@/infra/logger/logger.service';

type SmtpConfig = {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
};

const DEFAULT_FROM = 'Lodgify <no-reply@lodgify.local>';
const DEFAULT_PORT = 587;
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 30_000;

function readEnv(name: string): string | undefined {
  const value = process.env[name];

  return value === '' ? undefined : value;
}

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  async sendPasswordResetOtp(
    to: string,
    otp: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const smtp = this.resolveSmtpConfig();

    if (!smtp) {
      Logger.getInstance('mail').info(`Password reset OTP for ${to}: ${otp}`);
      return;
    }

    await this.getTransporter(smtp).sendMail({
      from: smtp.from,
      to,
      subject: 'Your password reset code',
      text: `Your Lodgify password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
      html: `<p>Your Lodgify password reset code is <strong>${otp}</strong>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`,
    });
  }

  private resolveSmtpConfig(): SmtpConfig | null {
    const host = readEnv('SMTP_HOST');

    if (!host) {
      return null;
    }

    const port = Number(readEnv('SMTP_PORT'));

    return {
      host,
      port: Number.isInteger(port) ? port : DEFAULT_PORT,
      secure: readEnv('SMTP_SECURE') === 'true',
      user: readEnv('SMTP_USER') ?? '',
      pass: readEnv('SMTP_PASS') ?? '',
      from: readEnv('MAIL_FROM') ?? DEFAULT_FROM,
    };
  }

  private getTransporter(smtp: SmtpConfig): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: GREETING_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }

    return this.transporter;
  }
}
