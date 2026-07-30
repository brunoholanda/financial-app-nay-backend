import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST')?.trim() &&
        this.config.get<string>('SMTP_USER')?.trim() &&
        this.config.get<string>('SMTP_PASS') &&
        this.config.get<string>('MAIL_FROM')?.trim(),
    );
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'SMTP não configurado. Defina SMTP_HOST, SMTP_USER, SMTP_PASS e MAIL_FROM.',
      );
    }

    const port = Number.parseInt(
      this.config.get<string>('SMTP_PORT') ?? '587',
      10,
    );
    const secureEnv = this.config.get<string>('SMTP_SECURE')?.toLowerCase();
    // Porta 587 usa STARTTLS (secure=false); 465 usa TLS implícito (secure=true).
    const secure =
      secureEnv === 'true'
        ? true
        : secureEnv === 'false'
          ? false
          : port === 465;

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure,
      requireTLS: port === 587 && !secure,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASS'),
      },
    });

    return this.transporter;
  }

  async send(input: SendMailInput): Promise<{ messageId: string }> {
    const from = this.config.getOrThrow<string>('MAIL_FROM');
    const transporter = this.getTransporter();

    try {
      const info = await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(
        `E-mail enviado para ${Array.isArray(input.to) ? input.to.join(', ') : input.to} (${info.messageId})`,
      );
      return { messageId: String(info.messageId ?? '') };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao enviar e-mail: ${message}`);
      throw new ServiceUnavailableException(
        `Falha ao enviar e-mail via SMTP: ${message}`,
      );
    }
  }

  async verifyConnection(): Promise<boolean> {
    const transporter = this.getTransporter();
    await transporter.verify();
    return true;
  }
}
