import { describe, expect, it, vi } from "vitest";
import { setupMockCleanup } from "@/__tests__/setup/helpers/test-utils";
import { parseJsonWithRepair, transformToSchema } from "@/lib/ai/ai-fallback";

// Mock ai module for parsePartialJson
vi.mock("ai", () => ({
  parsePartialJson: vi.fn(),
}));

import { parsePartialJson } from "ai";

setupMockCleanup();

describe("parseJsonWithRepair", () => {
  it("parses valid JSON without repair", async () => {
    const validJson = '{"name": "John", "age": 30}';

    const result = await parseJsonWithRepair(validJson);

    expect(result.data).toEqual({ name: "John", age: 30 });
    expect(result.repaired).toBe(false);
  });

  it("repairs malformed JSON using AI SDK", async () => {
    const malformedJson = '{"name": "John", "age": 30'; // Missing closing brace
    const repairedData = { name: "John", age: 30 };

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: repairedData,
      state: "repaired-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(malformedJson);

    expect(result.data).toEqual(repairedData);
    expect(result.repaired).toBe(true);
    expect(parsePartialJson).toHaveBeenCalledWith(malformedJson);
  });

  it("returns null for unreparable JSON", async () => {
    const badJson = "totally not json";

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: null,
      state: "failed-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(badJson);

    expect(result.data).toBeNull();
    expect(result.repaired).toBe(false);
  });

  it("returns null when repaired value is not an object", async () => {
    const json = "123"; // Valid JSON but not an object

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: 123,
      state: "successful-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(json);

    expect(result.data).toBeNull();
    expect(result.repaired).toBe(false);
  });

  it("returns null when repaired value is an array", async () => {
    const json = '["item1", "item2"]';

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: ["item1", "item2"],
      state: "successful-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(json);

    expect(result.data).toBeNull();
    expect(result.repaired).toBe(false);
  });

  it("handles JSON with trailing commas", async () => {
    const jsonWithTrailingComma = '{"name": "John", "items": [1, 2, 3,]}';
    const repairedData = { name: "John", items: [1, 2, 3] };

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: repairedData,
      state: "repaired-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(jsonWithTrailingComma);

    expect(result.data).toEqual(repairedData);
    expect(result.repaired).toBe(true);
  });

  it("handles JSON with single quotes", async () => {
    const jsonWithSingleQuotes = "{'name': 'John', 'age': 30}";
    const repairedData = { name: "John", age: 30 };

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: repairedData,
      state: "repaired-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(jsonWithSingleQuotes);

    expect(result.data).toEqual(repairedData);
    expect(result.repaired).toBe(true);
  });

  it("handles JSON with unquoted keys", async () => {
    const jsonWithUnquotedKeys = "{name: 'John', age: 30}";
    const repairedData = { name: "John", age: 30 };

    vi.mocked(parsePartialJson).mockResolvedValue({
      value: repairedData,
      state: "repaired-parse",
    } as unknown as Awaited<ReturnType<typeof parsePartialJson>>);

    const result = await parseJsonWithRepair(jsonWithUnquotedKeys);

    expect(result.data).toEqual(repairedData);
    expect(result.repaired).toBe(true);
  });

  it("handles empty object", async () => {
    const emptyJson = "{}";

    const result = await parseJsonWithRepair(emptyJson);

    expect(result.data).toEqual({});
    expect(result.repaired).toBe(false);
  });

  it("handles deeply nested JSON", async () => {
    const nestedJson = JSON.stringify({
      level1: {
        level2: {
          level3: {
            value: "deep",
          },
        },
      },
    });

    const result = await parseJsonWithRepair(nestedJson);

    expect(result.data).toEqual({
      level1: {
        level2: {
          level3: {
            value: "deep",
          },
        },
      },
    });
    expect(result.repaired).toBe(false);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("transformToSchema", () => {
  it("transforms skills from object to array format", () => {
    const data = {
      full_name: "Jane",
      skills: {
        Languages: ["TypeScript", "Python"],
        Frameworks: ["React", "Next.js"],
      },
    };

    const result = transformToSchema(data);

    expect(result.skills).toEqual([
      { category: "Languages", items: ["TypeScript", "Python"] },
      { category: "Frameworks", items: ["React", "Next.js"] },
    ]);
  });

  it("handles skills with non-array values", () => {
    const data = {
      skills: {
        Category: "single skill",
      },
    };

    const result = transformToSchema(data);

    expect(result.skills).toEqual([{ category: "Category", items: ["single skill"] }]);
  });

  it("transforms experience description from array to string", () => {
    const data = {
      experience: [
        {
          title: "Engineer",
          company: "Acme",
          description: ["Led team", "Built features"],
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.experience as any[])[0].description).toBe("Led team Built features");
    expect((result.experience as any[])[0].highlights).toEqual(["Led team", "Built features"]);
  });

  it("preserves experience with string description", () => {
    const data = {
      experience: [
        {
          title: "Engineer",
          description: "Already a string",
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.experience as any[])[0].description).toBe("Already a string");
    expect((result.experience as any[])[0].highlights).toBeUndefined();
  });

  it("transforms project description from array to string", () => {
    const data = {
      projects: [
        {
          title: "My Project",
          description: ["Feature 1", "Feature 2"],
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.projects as any[])[0].description).toBe("Feature 1 Feature 2");
  });

  it("renames project date to year", () => {
    const data = {
      projects: [
        {
          title: "Project",
          date: "2023",
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.projects as any[])[0].year).toBe("2023");
    expect((result.projects as any[])[0].date).toBeUndefined();
  });

  it("preserves existing year when date also present", () => {
    const data = {
      projects: [
        {
          title: "Project",
          year: "2024",
          date: "2023",
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.projects as any[])[0].year).toBe("2024");
  });

  it("handles empty data gracefully", () => {
    const data = {};

    const result = transformToSchema(data);

    expect(result).toEqual({});
  });

  it("preserves non-transformed fields", () => {
    const data = {
      full_name: "Jane",
      headline: "Developer",
      custom_field: "value",
    };

    const result = transformToSchema(data);

    expect(result.full_name).toBe("Jane");
    expect(result.headline).toBe("Developer");
    expect(result.custom_field).toBe("value");
  });

  it("handles null skills gracefully", () => {
    const data = {
      skills: null,
    };

    const result = transformToSchema(data);

    expect(result.skills).toBeNull();
  });

  it("handles undefined skills gracefully", () => {
    const data = {
      full_name: "Jane",
    };

    const result = transformToSchema(data);

    expect(result.skills).toBeUndefined();
  });

  it("handles multiple experience entries", () => {
    const data = {
      experience: [
        {
          title: "Job 1",
          description: ["Task 1"],
        },
        {
          title: "Job 2",
          description: "String description",
        },
        {
          title: "Job 3",
          description: ["Task A", "Task B"],
        },
      ],
    };

    const result = transformToSchema(data);

    expect((result.experience as any[])[0].description).toBe("Task 1");
    expect((result.experience as any[])[0].highlights).toEqual(["Task 1"]);
    expect((result.experience as any[])[1].description).toBe("String description");
    expect((result.experience as any[])[1].highlights).toBeUndefined();
    expect((result.experience as any[])[2].description).toBe("Task A Task B");
    expect((result.experience as any[])[2].highlights).toEqual(["Task A", "Task B"]);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
