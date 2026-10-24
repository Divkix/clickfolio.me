import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { THEME_CHROME } from "@/lib/templates/theme-chrome";
import { THEME_IDS } from "@/lib/templates/theme-ids";
import {
  DEFAULT_SHARE_VARIANT,
  SHARE_VARIANT_KEYS,
  shareButtonStyles,
  shareContainerStyles,
  shareItemStyles,
  sharePanelStyles,
  shareTriggerStyles,
} from "@/lib/templates/share-variants";
import { getLinkedInIconVariant } from "@/lib/utils/share-actions";

// Digests captured from the original component, share and background maps before migration.
// Each covers every exact literal, without storing hundreds of duplicated style strings.
const BASELINE_DIGESTS = {
  cta: "99ab243a82dc4d69011c20ce674fea41620f9e8ecd4c3a73f803e00668dd18f4",
  attribution: "3b4fee0df40921f7e139fb9f537de15c590cd3d6bd888096bb2267fedad9363a",
  share: "4370f9720e8345913d48aeacb3ebe38cd868c58f48a2017d894d315d910f3c7a",
  background: "0bc2870df406c373edfcf42da95441c646262c989b2fcdbba6e938ed3470880c",
};

const groups = ["cta", "attribution", "share", "background"] as const;

const whiteVariants = new Set([
  "boardroom",
  "glass-morphic",
  "midnight",
  "dev-terminal",
  "media-kit",
  "blueprint",
  "contact-sheet",
  "liner-notes",
  "lesson-plan",
  "manuscript",
  "reel",
  "spotlight",
  "link-stack",
]);

describe("theme chrome", () => {
  it("covers every theme with one unique share alias", () => {
    expect(Object.keys(THEME_CHROME).toSorted()).toEqual(THEME_IDS.toSorted());
    expect(SHARE_VARIANT_KEYS).toHaveLength(THEME_IDS.length);
    expect(new Set(SHARE_VARIANT_KEYS).size).toBe(THEME_IDS.length);
    expect(DEFAULT_SHARE_VARIANT).toBe(THEME_CHROME.minimalist_editorial.share.variant);

    for (const id of THEME_IDS) {
      let expected = id.replaceAll("_", "-");

      if (id === "glass") expected = "glass-morphic";

      if (id === "bento") expected = "bento-grid";

      expect(THEME_CHROME[id].share.variant).toBe(expected);
    }
  });

  it.each(groups)("preserves all original %s literals byte-for-byte", (group) => {
    const baseline = THEME_IDS.toSorted().map((id) => [id, THEME_CHROME[id][group]]);
    const digest = createHash("sha256").update(JSON.stringify(baseline)).digest("hex");
    expect(digest).toBe(BASELINE_DIGESTS[group]);
  });

  it("projects every public share map from the same theme entry", () => {
    for (const styles of [
      shareContainerStyles,
      shareButtonStyles,
      shareTriggerStyles,
      sharePanelStyles,
      shareItemStyles,
    ]) {
      expect(Object.keys(styles).toSorted()).toEqual(SHARE_VARIANT_KEYS.toSorted());
    }

    for (const id of THEME_IDS) {
      const { share } = THEME_CHROME[id];
      expect(shareContainerStyles[share.variant]).toBe("");
      expect(shareButtonStyles[share.variant]).toBe(share.button);
      expect(shareTriggerStyles[share.variant]).toBe(share.trigger);
      expect(sharePanelStyles[share.variant]).toBe(share.panel);
      expect(shareItemStyles[share.variant]).toBe(share.item);
    }
  });

  it("preserves legacy LinkedIn icon colors for aliases and canonical ids", () => {
    for (const id of THEME_IDS) {
      const { share } = THEME_CHROME[id];
      expect(share.linkedInIcon).toBe(whiteVariants.has(share.variant) ? "white" : "black");
      expect(getLinkedInIconVariant(share.variant)).toBe(
        whiteVariants.has(share.variant) ? "white" : "black",
      );
      // Underscored ids were not switch cases, even when their kebab alias used white.
      expect(getLinkedInIconVariant(id)).toBe(whiteVariants.has(id) ? "white" : "black");
    }

    for (const unknown of [
      null,
      undefined,
      "",
      "unknown",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      expect(getLinkedInIconVariant(unknown)).toBe("black");
    }
  });

  it("retains the intentional differences between chrome and page backgrounds", () => {
    expect(THEME_CHROME.media_kit.background).toEqual({ bg: "bg-[#FBEAEE]", isDark: false });
    expect(THEME_CHROME.media_kit.share.linkedInIcon).toBe("white");
    expect(THEME_CHROME.case_file.background).toEqual({ bg: "bg-[#2F2A26]", isDark: true });
    expect(THEME_CHROME.case_file.share.linkedInIcon).toBe("black");
    expect(THEME_CHROME.retro_os.cta.closeButton).toBe("hover:bg-black/10 text-black rounded-none");
  });
});
