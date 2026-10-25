import type * as TanStackRouter from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>();

  return { ...actual, useNavigate: () => vi.fn() };
});

import { LoginButton } from "@/components/auth/LoginButton";
import { SessionProvider } from "@/lib/auth/client";

describe("LoginButton before Clerk loads", () => {
  it("renders an enabled Sign in button, so an early click can load Clerk", () => {
    const html = renderToStaticMarkup(
      <SessionProvider publishableKey="pk_test_unused">
        <LoginButton />
      </SessionProvider>,
    );

    expect(html).toContain("Sign in");
    expect(html).not.toContain('disabled=""');
  });
});
