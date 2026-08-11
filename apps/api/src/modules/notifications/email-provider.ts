export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  provider: string;
  messageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Development provider — logs email instead of calling SMTP. */
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attachmentSummary =
      message.attachments
        ?.map((a) => `${a.filename}(${a.content.length}b)`)
        .join(', ') ?? 'none';
    // eslint-disable-next-line no-console
    console.info(
      `[EMAIL:log] id=${id} to=${message.to} subject=${message.subject.slice(0, 120)} attachments=${attachmentSummary}`,
    );
    return { provider: this.name, messageId: id };
  }
}

/**
 * SMTP provider via nodemailer. Activated when EMAIL_PROVIDER=smtp
 * (or when EMAIL_SMTP_HOST is set and provider is not forced to log).
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';

  constructor(
    private readonly transporter: {
      sendMail: (opts: Record<string, unknown>) => Promise<{ messageId?: string }>;
    },
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/pdf',
      })),
    });
    return {
      provider: this.name,
      messageId: info.messageId ?? `smtp_${Date.now()}`,
    };
  }
}

export async function createEmailProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<EmailProvider> {
  const provider = (env.EMAIL_PROVIDER ?? '').toLowerCase();
  const host = env.EMAIL_SMTP_HOST?.trim();
  const from = env.EMAIL_FROM?.trim() || 'noreply@example.com';
  const useSmtp = provider === 'smtp' || (provider !== 'log' && Boolean(host));

  if (!useSmtp) {
    return new LogEmailProvider();
  }

  if (!host) {
    throw new Error('EMAIL_PROVIDER=smtp requires EMAIL_SMTP_HOST.');
  }

  const nodemailer = await import('nodemailer');
  const port = Number(env.EMAIL_SMTP_PORT || 587);
  const secure =
    env.EMAIL_SMTP_SECURE === '1' ||
    env.EMAIL_SMTP_SECURE === 'true' ||
    port === 465;
  const user = env.EMAIL_SMTP_USER?.trim();
  const pass = env.EMAIL_SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass ?? '' } : undefined,
  });

  return new SmtpEmailProvider(transporter, from);
}
