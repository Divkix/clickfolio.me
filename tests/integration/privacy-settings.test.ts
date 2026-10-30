import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { PrivacySettingsForm } from "@/components/forms/PrivacySettings";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";
import { INDEXABLE_CONTENT } from "../helpers/pglite-db";

describe("email privacy controls", () => {
  it.each([true, false])("renders email visibility %s in the wizard and settings", (showEmail) => {
    const settings = { ...DEFAULT_PRIVACY_SETTINGS, show_email: showEmail };

    const content = {
      ...INDEXABLE_CONTENT,
      contact: { ...INDEXABLE_CONTENT.contact, location: "Madrid, España" },
    };

    const wizard = renderToStaticMarkup(
      createElement(PrivacyStep, {
        content,
        initialSettings: showEmail ? undefined : settings,
        onContinue: vi.fn(),
      }),
    );

    const settingsCard = renderToStaticMarkup(
      createElement(PrivacySettingsForm, { initialSettings: settings }),
    );

    expect(wizard.match(/<button[^>]*\bid="show-email"[^>]*>/)?.[0]).toContain(
      `aria-checked="${showEmail}"`,
    );
    expect(settingsCard.match(/<button[^>]*\baria-label="Email"[^>]*>/)?.[0]).toContain(
      `aria-checked="${showEmail}"`,
    );
    expect(wizard).toContain("Madrid, España");
    expect(wizard).not.toContain("City/State");
    expect(wizard.includes("avery@example.com")).toBe(showEmail);
  });
});
