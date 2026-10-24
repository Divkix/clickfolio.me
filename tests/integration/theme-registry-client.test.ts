import type { DynamicOptions } from "next/dynamic";
import { describe, expect, it, vi } from "vite-plus/test";
import { THEME_IDS } from "@/lib/templates/theme-ids";
import { TEMPLATE_LOADERS } from "@/lib/templates/theme-registry";
import type { TemplateProps } from "@/lib/types/template";

type TemplateLoader = (typeof TEMPLATE_LOADERS)[keyof typeof TEMPLATE_LOADERS];

const { dynamicMock } = vi.hoisted(() => ({
  dynamicMock: vi.fn(
    (_loader: TemplateLoader, _options: DynamicOptions<TemplateProps>) => () => null,
  ),
}));

vi.mock("next/dynamic", () => ({ default: dynamicMock }));

describe("client template registry", () => {
  it("lazily wraps every shared loader with next/dynamic and a loading fallback", async () => {
    // Import inside the test: clearMocks resets module-initialization calls before each test.
    const { DYNAMIC_TEMPLATES } = await import("@/lib/templates/theme-registry.client");

    expect(Object.keys(DYNAMIC_TEMPLATES).sort()).toEqual([...THEME_IDS].sort());
    expect(dynamicMock).toHaveBeenCalledTimes(THEME_IDS.length);

    Object.entries(TEMPLATE_LOADERS).forEach(([themeId, loader], index) => {
      expect(dynamicMock).toHaveBeenNthCalledWith(index + 1, loader, {
        loading: expect.any(Function),
      });
      expect(Object.getOwnPropertyDescriptor(DYNAMIC_TEMPLATES, themeId)?.value).toBe(
        dynamicMock.mock.results[index].value,
      );
    });
  });
});
