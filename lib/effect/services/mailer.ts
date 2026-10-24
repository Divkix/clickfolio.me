import { Context, Effect, Layer } from "effect";
import { externalCall } from "../external";
import { EmailFailed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

export type OutgoingEmail = {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
};

export type EmailReceipt = { readonly messageId: string };

/** The part of the Cloudflare `send_email` binding this service uses. */
export type EmailBinding = {
  send(message: EmailMessageBuilder): Promise<EmailSendResult>;
};

type MailerService = {
  /**
   * One send, never retried: the binding has no idempotency key, so a retry after a timeout
   * or an ambiguous failure could deliver the same mail twice.
   */
  readonly send: (message: OutgoingEmail) => Effect.Effect<EmailReceipt, EmailFailed>;
};

function unconfigured(): MailerService {
  return {
    send: () =>
      Effect.fail(
        new EmailFailed({
          operation: "email.send",
          kind: "unavailable",
          message: "EMAIL binding is not configured",
        }),
      ),
  };
}

function service(binding: EmailBinding, timeoutMs: number): MailerService {
  return {
    send: (message) =>
      externalCall({
        operation: "email.send",
        timeoutMs,
        run: async () => {
          const result = await binding.send(message);

          return { messageId: result.messageId };
        },
        fail: (details) => new EmailFailed(details),
      }),
  };
}

/** Cloudflare Email Service. Failures are typed; recipients never appear in them. */
export class Mailer extends Context.Service<Mailer, MailerService>()("clickfolio/Mailer") {
  static layer(env: { readonly EMAIL?: EmailBinding }): Layer.Layer<Mailer> {
    const binding = env.EMAIL;

    return Layer.succeed(Mailer, binding ? service(binding, TIMEOUT_MS.email) : unconfigured());
  }

  /** For tests: a fake binding and, optionally, a shorter time limit. */
  static layerFrom(
    binding: EmailBinding,
    timeoutMs: number = TIMEOUT_MS.email,
  ): Layer.Layer<Mailer> {
    return Layer.succeed(Mailer, service(binding, timeoutMs));
  }
}
