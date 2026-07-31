import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  clearWizardProgress,
  loadWizardProgress,
  saveWizardProgress,
} from "@/lib/utils/wizard-progress";

const DEFAULT_THEME = "minimalist_editorial" as const;

const sampleProgress = {
  currentStepId: "theme" as const,
  handle: "alice",
  privacySettings: {
    show_phone: false,
    show_address: true,
    show_in_directory: true,
    hide_from_search: false,
  },
  themeId: DEFAULT_THEME,
};

describe("wizard-progress persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips progress through localStorage", () => {
    saveWizardProgress(sampleProgress);
    const loaded = loadWizardProgress();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentStepId).toBe("theme");
    expect(loaded?.handle).toBe("alice");
    expect(loaded?.privacySettings.show_address).toBe(true);
    expect(loaded?.themeId).toBe(DEFAULT_THEME);
  });

  it("returns null when nothing is saved", () => {
    expect(loadWizardProgress()).toBeNull();
  });

  it("clears saved progress", () => {
    saveWizardProgress(sampleProgress);
    expect(loadWizardProgress()).not.toBeNull();
    clearWizardProgress();
    expect(loadWizardProgress()).toBeNull();
  });

  it("treats progress older than 24h as expired (and cleans it up)", () => {
    saveWizardProgress(sampleProgress);
    // Backdate the savedAt timestamp to 25h ago.
    const raw = JSON.parse(localStorage.getItem("clickfolio:wizard-progress") as string);
    raw.savedAt = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem("clickfolio:wizard-progress", JSON.stringify(raw));

    expect(loadWizardProgress()).toBeNull();
    // Expired entry should have been removed.
    expect(localStorage.getItem("clickfolio:wizard-progress")).toBeNull();
  });

  it("survives a corrupted entry without throwing", () => {
    localStorage.setItem("clickfolio:wizard-progress", "{not valid json");
    expect(loadWizardProgress()).toBeNull();
  });
});
