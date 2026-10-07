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
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10_000;

type BrevoSender = {
  readonly name: string;
  readonly email: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];

  return value === '' ? undefined : value;
}

function parseSender(from: string): BrevoSender {
  const match = /^([^<]*)<([^>]+)>$/.exec(from.trim());

  if (!match) {
    return { name: '', email: from.trim() };
  }

  return { name: match[1].trim(), email: match[2].trim() };
}

function otpTextBody(otp: string, expiresInMinutes: number): string {
  return `Your Lodgify password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`;
}

function otpHtmlBody(otp: string, expiresInMinutes: number): string {
  return `<p>Your Lodgify password reset code is <strong>${otp}</strong>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`;
}

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  async sendPasswordResetOtp(
    to: string,
    otp: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const apiKey = readEnv('BREVO_API_KEY');

    if (apiKey) {
      await this.sendViaBrevo(apiKey, to, otp, expiresInMinutes);
      return;
    }

    const smtp = this.resolveSmtpConfig();

    if (!smtp) {
      Logger.getInstance('mail').info(`Password reset OTP for ${to}: ${otp}`);
      return;
    }

    const transporter = await this.getTransporter(smtp);

    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: 'Your password reset code',
      text: otpTextBody(otp, expiresInMinutes),
      html: otpHtmlBody(otp, expiresInMinutes),
    });
  }

  private async sendViaBrevo(
    apiKey: string,
    to: string,
    otp: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const sender = parseSender(readEnv('MAIL_FROM') ?? DEFAULT_FROM);

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject: 'Your password reset code',
        textContent: otpTextBody(otp, expiresInMinutes),
        htmlContent: otpHtmlBody(otp, expiresInMinutes),
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${detail}`);
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
