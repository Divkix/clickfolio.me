import { describe, expect, it, vi } from "vite-plus/test";
import { render, act } from "@testing-library/react";
import { EditResumeForm } from "@/components/forms/EditResumeForm";
import type { ResumeContent } from "@/lib/types/database";

const initialData: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds resilient products.",
  contact: { email: "avery@example.com", location: "Phoenix, AZ" },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

describe("EditResumeForm autosave debounce", () => {
  it("fires the debounced autosave once after typing, and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async (_data: ResumeContent, _isAutoSave?: boolean) => {});

    const { unmount } = render(<EditResumeForm initialData={initialData} onSave={onSave} />);

    const field = document.querySelector<HTMLInputElement>("input[name='full_name']");
    expect(field, "full_name input rendered").toBeTruthy();

    if (field === null) {
      throw new Error("full_name input rendered");
    }

    await act(async () => {
      field.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, "Avery Q");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onSave, "no save before the 3s debounce elapses").not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(onSave, "autosave fired once after the debounce").toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[1]).toBe(true);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, "Avery Quinn II");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(vi.getTimerCount(), "a pending debounce timer exists before unmount").toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount(), "pending timers cleared on unmount").toBe(0);
    vi.useRealTimers();
  });
});
