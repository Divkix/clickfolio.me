import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { classifyCareer } from "@/lib/ai/career";
import type { ResumeContent } from "@/lib/types/database";

const env = {
  CF_AI_GATEWAY_ACCOUNT_ID: "account-id",
  CF_AI_GATEWAY_ID: "gateway-id",
  CF_AIG_AUTH_TOKEN: "secret-token",
};

const content: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Software Engineer",
  summary: "Builds reliable products.",
  contact: { email: "avery@example.com" },
  experience: [
    {
      title: "Software Engineer",
      company: "Acme",
      start_date: "2020-01",
      description: "Built reliable systems.",
    },
  ],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

const fetchMock = vi.fn();

type JevAnswers = {
  is_resume?: { noul: number };
  level?: { choice: string };
  freelance?: { noul: number };
};

function response(answers: JevAnswers, status = 200) {
  return new Response(JSON.stringify({ answers }), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyCareer", () => {
  it("returns the selected role and freelance answer", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        is_resume: { noul: 0.9 },
        level: { choice: "manager" },
        freelance: { noul: 0.8 },
      }),
    );

    await expect(classifyCareer(content, env)).resolves.toEqual({
      role: "manager",
      isFreelance: true,
    });
  });

  it("returns null when the document is not classified as a resume", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        is_resume: { noul: 0.49 },
        level: { choice: "entry_level" },
        freelance: { noul: 0.9 },
      }),
    );

    await expect(classifyCareer(content, env)).resolves.toBeNull();
  });

  it("returns null when the gateway responds with an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));

    await expect(classifyCareer(content, env)).resolves.toBeNull();
  });

  it("returns null when Jev returns an unlisted role", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        is_resume: { noul: 0.9 },
        level: { choice: "unlisted_role" },
        freelance: { noul: 0.1 },
      }),
    );

    await expect(classifyCareer(content, env)).resolves.toBeNull();
  });

  it("does not call the gateway when credentials are missing", async () => {
    await expect(classifyCareer(content, {})).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not classify content without work or education history", async () => {
    await expect(
      classifyCareer({ ...content, experience: [], education: [] }, env),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
