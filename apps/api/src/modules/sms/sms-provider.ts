export interface SmsSendResult {
  provider: string;
  providerMessageId: string;
}

export interface SmsProvider {
  readonly name: string;
  send(toPhone: string, body: string): Promise<SmsSendResult>;
}

/** Development provider — logs SMS instead of calling a third party. */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';

  async send(toPhone: string, body: string): Promise<SmsSendResult> {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.info(`[SMS:log] to=${toPhone} id=${id} body=${body.slice(0, 120)}`);
    return { provider: this.name, providerMessageId: id };
  }
}

/**
 * Twilio-shaped provider. Uses env vars only; never hardcode secrets.
 * Activated when SMS_PROVIDER=twilio and TWILIO_* vars are present.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async send(toPhone: string, body: string): Promise<SmsSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: toPhone,
      From: this.fromNumber,
      Body: body,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = (await res.json()) as { sid?: string; message?: string; error_message?: string };
    if (!res.ok || !data.sid) {
      throw new Error(data.error_message ?? data.message ?? `Twilio HTTP ${res.status}`);
    }
    return { provider: this.name, providerMessageId: data.sid };
  }
}

export function createSmsProviderFromEnv(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const provider = (env.SMS_PROVIDER ?? 'log').toLowerCase();
  if (provider === 'twilio') {
    const sid = env.TWILIO_ACCOUNT_SID;
    const token = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_FROM_NUMBER;
    if (sid && token && from) {
      return new TwilioSmsProvider(sid, token, from);
    }
  }
  return new LogSmsProvider();
}
