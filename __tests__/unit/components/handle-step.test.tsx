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
    const pendingResolvers: Array<(value: Response) => void> = [];
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    ) as unknown as typeof fetch;

    render(<HandleStep initialHandle="" onContinue={vi.fn()} />);
    const input = screen.getByLabelText("Your Handle");

    fireEvent.change(input, { target: { value: "abc" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "abcd" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendingResolvers[1](Response.json({ available: true }));
    });
    expect(screen.getByText("This handle is available!")).toBeInTheDocument();

    await act(async () => {
      pendingResolvers[0](Response.json({ available: false }));
    });
    expect(screen.getByText("This handle is available!")).toBeInTheDocument();
    expect(screen.queryByText("This handle is already taken")).not.toBeInTheDocument();
  });
});
