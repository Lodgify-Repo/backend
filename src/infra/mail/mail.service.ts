import { Injectable } from '@nestjs/common';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
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
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10_000;

function readEnv(name: string): string | undefined {
  const value = process.env[name];

  return value === '' ? undefined : value;
}

function otpTextBody(otp: string, expiresInMinutes: number): string {
  return `Your Lodgify password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`;
}

function otpHtmlBody(otp: string, expiresInMinutes: number): string {
  return `<p>Your Lodgify password reset code is <strong>${otp}</strong>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`;
}

function toRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export type InvitationMail = {
  readonly role: string;
  readonly link: string;
  readonly inviterName: string;
  readonly expiresInDays: number;
};

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  async sendPasswordResetOtp(
    to: string,
    otp: string,
    expiresInMinutes: number,
  ): Promise<void> {
    await this.deliver(
      to,
      'Your password reset code',
      otpTextBody(otp, expiresInMinutes),
      otpHtmlBody(otp, expiresInMinutes),
      `Password reset OTP for ${to}: ${otp}`,
    );
  }

  async sendInvitation(to: string, invitation: InvitationMail): Promise<void> {
    const roleLabel = toRoleLabel(invitation.role);

    await this.deliver(
      to,
      `You've been invited to join Lodgify as a ${roleLabel}`,
      `Hi,\n\n${invitation.inviterName} has invited you to join Lodgify as a ${roleLabel}.\n\nGet started here: ${invitation.link}\n\nThis invitation expires in ${invitation.expiresInDays} days.`,
      `<p>Hi,</p><p>${invitation.inviterName} has invited you to join Lodgify as a ${roleLabel}.</p><p><a href="${invitation.link}">Accept your invitation here</a>.</p><p>This invitation expires in ${invitation.expiresInDays} days.</p>`,
      `Invitation email to ${to}: ${invitation.link}`,
    );
  }

  private async deliver(
    to: string,
    subject: string,
    text: string,
    html: string,
    devFallback: string,
  ): Promise<void> {
    const apiKey = readEnv('RESEND_API_KEY');

    if (apiKey) {
      await this.sendViaResend(apiKey, to, subject, text, html);
      return;
    }

    const smtp = this.resolveSmtpConfig();

    if (!smtp) {
      Logger.getInstance('mail').info(devFallback);
      return;
    }

    const transporter = await this.getTransporter(smtp);

    await transporter.sendMail({ from: smtp.from, to, subject, text, html });
  }
  private async sendViaResend(
    apiKey: string,
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: readEnv('MAIL_FROM') ?? DEFAULT_FROM,
        to: [to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend API error ${response.status}: ${detail}`);
    }
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

  private async getTransporter(smtp: SmtpConfig): Promise<Transporter> {
    if (!this.transporter) {
      const host = await this.resolveIpv4(smtp.host);

      this.transporter = createTransport({
        host,
        port: smtp.port,
        secure: smtp.secure,
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        greetingTimeout: GREETING_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
        tls: host === smtp.host ? undefined : { servername: smtp.host },
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }

    return this.transporter;
  }

  private async resolveIpv4(host: string): Promise<string> {
    if (isIP(host)) {
      return host;
    }

    try {
      const [address] = await resolve4(host);
      return address ?? host;
    } catch {
      return host;
    }
  }
}
