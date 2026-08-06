/**
 * ThemeStep regression tests — double-submit guard.
 *
 * The "Complete Setup" button must be disabled while the completion request is
 * in flight so a double click cannot enqueue the wizard-complete write twice.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ThemeStep } from "@/components/wizard/ThemeStep";

describe("ThemeStep", () => {
  it("prevents re-entrancy while the completion request is in flight", async () => {
    let resolveContinue: (() => void) | undefined;
    const onContinue = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveContinue = resolve;
        }),
    );

    render(<ThemeStep onContinue={onContinue} />);

    const button = screen.getByRole("button", { name: /complete setup/i });
    fireEvent.click(button);
    fireEvent.click(button);

    // Only one submission despite the double click
    expect(onContinue).toHaveBeenCalledTimes(1);

    // Button shows in-flight state and is disabled
    const inFlightButton = screen.getByRole("button", { name: /completing/i });
    expect(inFlightButton).toBeDisabled();

    // Once the request settles, the button re-enables for another attempt
    resolveContinue?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /complete setup/i })).toBeEnabled(),
    );
  });
});
