import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { upstreamLogFields } from "@/lib/effect/failure-fields";
import { EmailFailed } from "@/lib/effect/failures";
import { Mailer, type OutgoingEmail } from "@/lib/effect/services/mailer";

const MESSAGE: OutgoingEmail = {
  to: "account@example.com",
  from: "notifications@clickfolio.me",
  subject: "Subject",
  text: "Body",
};

function send(layer: ReturnType<typeof Mailer.layerFrom>) {
  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        Mailer.use((m) => m.send(MESSAGE)),
        layer,
      ),
    ),
  );
}

describe("Mailer", () => {
  it("passes the message to the binding and returns the receipt", async () => {
    const binding = { send: vi.fn(async () => ({ messageId: "message-1" })) };

    const receipt = await Effect.runPromise(
      Effect.provide(
        Mailer.use((m) => m.send(MESSAGE)),
        Mailer.layerFrom(binding),
      ),
    );

    expect(receipt).toEqual({ messageId: "message-1" });
    expect(binding.send).toHaveBeenCalledExactlyOnceWith(MESSAGE);
  });

  it("fails with a typed EmailFailed and a scrubbed message when the binding rejects", async () => {
    const failure = await send(
      Mailer.layerFrom({
        send: async () => {
          throw new Error("rejected account@example.com");
        },
      }),
    );

    expect(failure).toBeInstanceOf(EmailFailed);
    expect(failure).toMatchObject({ operation: "email.send", kind: "unavailable" });
    expect(failure.message).toBe("rejected [email]");
  });

  it("times out without retrying the send", async () => {
    const binding = { send: vi.fn(() => new Promise<EmailSendResult>(() => {})) };

    const failure = await send(Mailer.layerFrom(binding, 20));

    expect(failure).toMatchObject({ kind: "timeout", operation: "email.send" });
    expect(binding.send).toHaveBeenCalledTimes(1);
  });

  it("fails as unavailable when the binding is not configured", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Mailer.use((m) => m.send(MESSAGE)),
          Mailer.layer({}),
        ),
      ),
    );

    expect(failure).toMatchObject({ kind: "unavailable" });
  });
});

describe("upstreamLogFields", () => {
  it("names the dependency, operation and kind, and flags a timeout as unknown", () => {
    const fields = upstreamLogFields(
      new EmailFailed({ operation: "email.send", kind: "timeout", message: "timed out" }),
    );

    expect(fields).toMatchObject({
      failure: "EmailFailed",
      operation: "email.send",
      kind: "timeout",
      outcome_unknown: true,
      "error.message": "timed out",
    });
  });

  it("scrubs the cause", () => {
    const fields = upstreamLogFields(
      new EmailFailed({
        operation: "email.send",
        kind: "unavailable",
        message: "x",
        cause: new Error("bad person@example.com"),
      }),
    );

    expect(fields["error.message"]).toBe("bad [email]");
    expect(fields.outcome_unknown).toBeUndefined();
  });
});
