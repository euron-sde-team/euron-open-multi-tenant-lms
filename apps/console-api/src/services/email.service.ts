import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { retryAsync } from "../utils/retry";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  senderName?: string | null;
  /** Reply-To address so replies route back to a real mailbox. */
  replyTo?: string | null;
}

/**
 * AWS SDK v3 errors carry `.name` and `.$metadata.httpStatusCode`. Treat
 * provider throttling, transient 5xx, and network errors as retriable; let
 * everything else (validation, bounced address, config error) fail fast.
 */
function isRetriableSesError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const name = e.name ?? e.code ?? "";
  if (
    [
      "Throttling",
      "ThrottlingException",
      "TooManyRequestsException",
      "ServiceUnavailable",
      "InternalFailure",
      "RequestTimeout",
      "RequestTimeoutException",
      "NetworkingError",
      "ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
    ].includes(name)
  ) {
    return true;
  }
  const status = e.$metadata?.httpStatusCode;
  return Boolean(status && (status === 429 || (status >= 500 && status < 600)));
}

/** SES v2 sender for operator-to-tenant emails. */
class EmailService {
  private ses: SESv2Client;

  constructor() {
    this.ses = new SESv2Client({
      region: config.AWS_SES_REGION,
      credentials: {
        accessKeyId: config.AWS_SES_ACCESS_KEY,
        secretAccessKey: config.AWS_SES_SECRET_KEY,
      },
    });
  }

  private buildFromAddress(senderName?: string | null): string {
    const raw = (senderName && senderName.trim()) || config.SES_FROM_NAME;
    // Display names cannot contain quotes or line breaks.
    const safeName = raw.replace(/["\r\n]/g, "").trim() || config.SES_FROM_NAME;
    return `"${safeName}" <${config.SES_FROM_EMAIL}>`;
  }

  /**
   * Send a single email. Returns the SES message id. Retries on Throttling /
   * 5xx / network errors with exponential backoff; permanent errors bubble up.
   */
  async sendEmail(params: SendEmailParams): Promise<{ providerMessageId?: string }> {
    if (!config.AWS_SES_ACCESS_KEY || !config.AWS_SES_SECRET_KEY) {
      throw new BadRequestError(
        "Email is not configured: set AWS_SES_ACCESS_KEY and AWS_SES_SECRET_KEY"
      );
    }

    const command = new SendEmailCommand({
      FromEmailAddress: this.buildFromAddress(params.senderName),
      Destination: { ToAddresses: [params.to] },
      ...(params.replyTo ? { ReplyToAddresses: [params.replyTo] } : {}),
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: { Html: { Data: params.html, Charset: "UTF-8" } },
        },
      },
    });

    return retryAsync(
      async () => {
        const result = await this.ses.send(command);
        return { providerMessageId: result.MessageId };
      },
      {
        maxAttempts: 4,
        baseDelayMs: 500,
        maxDelayMs: 30_000,
        isRetriable: isRetriableSesError,
        onRetriableError: (err, attempt) => {
          logger.warn(
            `[email] Retriable SES error to=${params.to} attempt=${attempt}: ${
              (err as Error).message ?? err
            }`
          );
        },
      }
    );
  }
}

export default new EmailService();
