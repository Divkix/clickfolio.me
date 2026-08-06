/**
 * HandleStep regression tests.
 *
 * 1. The URL preview must render as `/@{handle}` (with the @ symbol).
 * 2. Availability checks must ignore out-of-order responses: a stale response
 *    from an earlier keystroke must never overwrite a newer result.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HandleStep } from "@/components/wizard/HandleStep";

describe("HandleStep", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("renders the URL preview as /@{handle}", () => {
    render(<HandleStep initialHandle="" onContinue={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Your Handle"), { target: { value: "avery" } });

    expect(screen.getByText("clickfolio.me/@avery")).toBeInTheDocument();
    expect(screen.queryByText("clickfolio.me/avery")).not.toBeInTheDocument();
  });

  it("ignores stale availability responses from earlier keystrokes", async () => {
    // Fetch returns pending promises the test resolves out of order. The mock
    // deliberately does NOT honour the AbortSignal, so the component-level
    // sequence guard (aborted request id) must discard the stale result.
    const pendingResolvers: Array<(value: Response) => void> = [];
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    ) as unknown as typeof fetch;

    render(<HandleStep initialHandle="" onContinue={vi.fn()} />);
    const input = screen.getByLabelText("Your Handle");

    // First keystroke → debounced check #1
    fireEvent.change(input, { target: { value: "abc" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second keystroke → debounced check #2 (aborts #1)
    fireEvent.change(input, { target: { value: "abcd" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    // Newer response resolves first: handle is available
    await act(async () => {
      pendingResolvers[1](Response.json({ available: true }));
    });
    expect(screen.getByText("This handle is available!")).toBeInTheDocument();

    // Stale response for the earlier keystroke arrives late and must be ignored
    await act(async () => {
      pendingResolvers[0](Response.json({ available: false }));
    });
    expect(screen.getByText("This handle is available!")).toBeInTheDocument();
    expect(screen.queryByText("This handle is already taken")).not.toBeInTheDocument();
  });
});
