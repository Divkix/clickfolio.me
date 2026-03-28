/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { coerceArray, coerceRecord, normalizeAiKeys, pickFirstValue } from "@/lib/ai/ai-normalize";

describe("pickFirstValue", () => {
  it("returns first existing key value", () => {
    const obj = { name: "John", fullName: "John Doe" };
    const result = pickFirstValue(obj, ["fullName", "name", "full_name"]);
    expect(result).toBe("John Doe");
  });

  it("falls back to second key if first not present", () => {
    const obj = { name: "John" };
    const result = pickFirstValue(obj, ["fullName", "name", "full_name"]);
    expect(result).toBe("John");
  });

  it("returns undefined when no keys found", () => {
    const obj = { other: "value" };
    const result = pickFirstValue(obj, ["name", "fullName"]);
    expect(result).toBeUndefined();
  });

  it("handles empty key array", () => {
    const obj = { name: "John" };
    const result = pickFirstValue(obj, []);
    expect(result).toBeUndefined();
  });

  it("handles empty object", () => {
    const obj = {};
    const result = pickFirstValue(obj, ["name"]);
    expect(result).toBeUndefined();
  });

  it("returns falsy values if they exist", () => {
    const obj = { count: 0, name: "" };
    const result = pickFirstValue(obj, ["count", "name"]);
    expect(result).toBe(0);
  });

  it("returns null if present", () => {
    const obj = { value: null, other: "data" };
    const result = pickFirstValue(obj, ["value", "other"]);
    expect(result).toBeNull();
  });

  it("only checks own properties", () => {
    const parent = { inherited: "value" };
    const obj = Object.create(parent);
    obj.own = "own value";

    const result = pickFirstValue(obj, ["inherited", "own"]);
    expect(result).toBe("own value");
  });
});

describe("coerceRecord", () => {
  it("returns object for valid record", () => {
    const obj = { name: "John" };
    const result = coerceRecord(obj);
    expect(result).toEqual({ name: "John" });
  });

  it("returns null for null", () => {
    const result = coerceRecord(null);
    expect(result).toBeNull();
  });

  it("returns null for undefined", () => {
    const result = coerceRecord(undefined);
    expect(result).toBeNull();
  });

  it("returns null for arrays", () => {
    const result = coerceRecord(["item"]);
    expect(result).toBeNull();
  });

  it("returns null for primitives", () => {
    expect(coerceRecord("string")).toBeNull();
    expect(coerceRecord(123)).toBeNull();
    expect(coerceRecord(true)).toBeNull();
  });

  it("returns empty object for empty object", () => {
    const result = coerceRecord({});
    expect(result).toEqual({});
  });

  it("returns nested objects as-is", () => {
    const nested = { inner: { value: 1 } };
    const result = coerceRecord(nested);
    expect(result).toEqual(nested);
  });
});

describe("coerceArray", () => {
  it("returns array for valid array", () => {
    const arr = ["item1", "item2"];
    const result = coerceArray(arr);
    expect(result).toEqual(["item1", "item2"]);
  });

  it("returns null for non-array objects", () => {
    const result = coerceArray({ name: "John" });
    expect(result).toBeNull();
  });

  it("returns null for null", () => {
    const result = coerceArray(null);
    expect(result).toBeNull();
  });

  it("returns null for undefined", () => {
    const result = coerceArray(undefined);
    expect(result).toBeNull();
  });

  it("returns null for primitives", () => {
    expect(coerceArray("string")).toBeNull();
    expect(coerceArray(123)).toBeNull();
  });

  it("returns empty array", () => {
    const result = coerceArray([]);
    expect(result).toEqual([]);
  });

  it("returns array with mixed types", () => {
    const arr = ["string", 123, true, null];
    const result = coerceArray(arr);
    expect(result).toEqual(["string", 123, true, null]);
  });
});

describe("normalizeAiKeys - full name", () => {
  it("normalizes fullName to full_name", () => {
    const data = { fullName: "John Doe" };
    const result = normalizeAiKeys(data);
    expect(result.full_name).toBe("John Doe");
  });

  it("normalizes fullname to full_name", () => {
    const data = { fullname: "John Doe" };
    const result = normalizeAiKeys(data);
    expect(result.full_name).toBe("John Doe");
  });

  it("normalizes name to full_name", () => {
    const data = { name: "John Doe" };
    const result = normalizeAiKeys(data);
    expect(result.full_name).toBe("John Doe");
  });

  it("prefers full_name if already present", () => {
    const data = { full_name: "Jane", name: "John" };
    const result = normalizeAiKeys(data);
    expect(result.full_name).toBe("Jane");
  });
});

describe("normalizeAiKeys - headline", () => {
  it("normalizes title to headline", () => {
    const data = { title: "Software Engineer" };
    const result = normalizeAiKeys(data);
    expect(result.headline).toBe("Software Engineer");
  });

  it("normalizes role to headline", () => {
    const data = { role: "Developer" };
    const result = normalizeAiKeys(data);
    expect(result.headline).toBe("Developer");
  });

  it("preserves existing headline", () => {
    const data = { headline: "Existing", title: "New" };
    const result = normalizeAiKeys(data);
    expect(result.headline).toBe("Existing");
  });
});

describe("normalizeAiKeys - summary", () => {
  it("normalizes profile to summary", () => {
    const data = { profile: "Experienced developer" };
    const result = normalizeAiKeys(data);
    expect(result.summary).toBe("Experienced developer");
  });

  it("normalizes objective to summary", () => {
    const data = { objective: "Seeking new role" };
    const result = normalizeAiKeys(data);
    expect(result.summary).toBe("Seeking new role");
  });

  it("preserves existing summary", () => {
    const data = { summary: "Existing", profile: "New" };
    const result = normalizeAiKeys(data);
    expect(result.summary).toBe("Existing");
  });
});

describe("normalizeAiKeys - contact", () => {
  it("normalizes contactInfo to contact", () => {
    const data = { contactInfo: { email: "test@example.com" } };
    const result = normalizeAiKeys(data);
    expect(result.contact).toEqual({ email: "test@example.com" });
  });

  it("normalizes contact_information to contact", () => {
    const data = { contact_information: { email: "test@example.com" } };
    const result = normalizeAiKeys(data);
    expect(result.contact).toEqual({ email: "test@example.com" });
  });

  it("normalizes nested email variations", () => {
    const data = {
      contact: {
        "e-mail": "test@example.com",
        mail: "other@example.com",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).email).toBe("test@example.com");
  });

  it("normalizes phone variations", () => {
    const data = {
      contact: {
        phone_number: "+1-555-1234",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).phone).toBe("+1-555-1234");
  });

  it("normalizes mobile variations", () => {
    const data = {
      contact: {
        mobile_phone: "+1-555-5678",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).phone).toBe("+1-555-5678");
  });

  it("normalizes location variations", () => {
    const data = {
      contact: {
        city: "San Francisco",
        city_state: "CA",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).location).toBe("San Francisco");
  });

  it("normalizes linkedin variations", () => {
    const data = {
      contact: {
        linkedIn: "https://linkedin.com/in/test",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).linkedin).toBe("https://linkedin.com/in/test");
  });

  it("normalizes github variations", () => {
    const data = {
      contact: {
        gitHub: "https://github.com/test",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).github).toBe("https://github.com/test");
  });

  it("normalizes website variations", () => {
    const data = {
      contact: {
        portfolio: "https://test.dev",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).website).toBe("https://test.dev");
  });

  it("normalizes dribbble variations", () => {
    const data = {
      contact: {
        dribble: "https://dribbble.com/test",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).dribbble).toBe("https://dribbble.com/test");
  });

  it("keeps existing contact fields", () => {
    const data = {
      contact: {
        email: "existing@example.com",
        phone: "+1-555-0000",
      },
    };
    const result = normalizeAiKeys(data);
    expect((result.contact as any).email).toBe("existing@example.com");
    expect((result.contact as any).phone).toBe("+1-555-0000");
  });
});

describe("normalizeAiKeys - experience", () => {
  it("normalizes work_experience to experience", () => {
    const data = {
      work_experience: [{ title: "Engineer" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.experience).toEqual([{ title: "Engineer" }]);
  });

  it("normalizes workExperience to experience", () => {
    const data = {
      workExperience: [{ title: "Engineer" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.experience).toEqual([{ title: "Engineer" }]);
  });

  it("normalizes role to title in experience items", () => {
    const data = {
      experience: [{ role: "Senior Engineer" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].title).toBe("Senior Engineer");
  });

  it("normalizes position to title", () => {
    const data = {
      experience: [{ position: "Developer" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].title).toBe("Developer");
  });

  it("normalizes employer to company", () => {
    const data = {
      experience: [{ employer: "Acme Corp" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].company).toBe("Acme Corp");
  });

  it("normalizes organization to company", () => {
    const data = {
      experience: [{ organization: "Tech Inc" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].company).toBe("Tech Inc");
  });

  it("normalizes startDate to start_date", () => {
    const data = {
      experience: [{ startDate: "2020-01" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].start_date).toBe("2020-01");
  });

  it("normalizes from to start_date", () => {
    const data = {
      experience: [{ from: "2020-01" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].start_date).toBe("2020-01");
  });

  it("normalizes endDate to end_date", () => {
    const data = {
      experience: [{ endDate: "2022-12" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].end_date).toBe("2022-12");
  });

  it("normalizes to to end_date", () => {
    const data = {
      experience: [{ to: "2022-12" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].end_date).toBe("2022-12");
  });

  it("normalizes bullets to highlights", () => {
    const data = {
      experience: [{ bullets: ["Task 1", "Task 2"] }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].highlights).toEqual(["Task 1", "Task 2"]);
  });

  it("normalizes achievements to highlights", () => {
    const data = {
      experience: [{ achievements: ["Award 1"] }],
    };
    const result = normalizeAiKeys(data);
    expect((result.experience as any[])[0].highlights).toEqual(["Award 1"]);
  });
});

describe("normalizeAiKeys - education", () => {
  it("normalizes education_history to education", () => {
    const data = {
      education_history: [{ degree: "BS" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.education).toEqual([{ degree: "BS" }]);
  });

  it("normalizes studies to education", () => {
    const data = {
      studies: [{ degree: "MS" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.education).toEqual([{ degree: "MS" }]);
  });

  it("normalizes program to degree", () => {
    const data = {
      education: [{ program: "Computer Science" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].degree).toBe("Computer Science");
  });

  it("normalizes school to institution", () => {
    const data = {
      education: [{ school: "MIT" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].institution).toBe("MIT");
  });

  it("normalizes university to institution", () => {
    const data = {
      education: [{ university: "Stanford" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].institution).toBe("Stanford");
  });

  it("normalizes year to graduation_date", () => {
    const data = {
      education: [{ year: "2019" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].graduation_date).toBe("2019");
  });

  it("normalizes grad_date to graduation_date", () => {
    const data = {
      education: [{ grad_date: "2020-05" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].graduation_date).toBe("2020-05");
  });

  it("normalizes grade to gpa", () => {
    const data = {
      education: [{ grade: "3.8" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.education as any[])[0].gpa).toBe("3.8");
  });
});

describe("normalizeAiKeys - skills", () => {
  it("normalizes skillset to skills", () => {
    const data = {
      skillset: [{ category: "Languages", items: ["JS"] }],
    };
    const result = normalizeAiKeys(data);
    expect(result.skills).toEqual([{ category: "Languages", items: ["JS"] }]);
  });

  it("normalizes technical_skills to skills", () => {
    const data = {
      technical_skills: [{ category: "Tech", items: ["React"] }],
    };
    const result = normalizeAiKeys(data);
    expect(result.skills).toEqual([{ category: "Tech", items: ["React"] }]);
  });

  it("converts string array skills to category format", () => {
    const data = {
      skills: ["JavaScript", "Python", "Go"],
    };
    const result = normalizeAiKeys(data);
    expect(result.skills).toEqual([{ category: "Skills", items: ["JavaScript", "Python", "Go"] }]);
  });

  it("preserves object format skills", () => {
    const data = {
      skills: [{ category: "Languages", items: ["TS", "JS"] }],
    };
    const result = normalizeAiKeys(data);
    expect(result.skills).toEqual([{ category: "Languages", items: ["TS", "JS"] }]);
  });
});

describe("normalizeAiKeys - certifications", () => {
  it("normalizes certificates to certifications", () => {
    const data = {
      certificates: [{ name: "AWS Cert" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.certifications).toEqual([{ name: "AWS Cert" }]);
  });

  it("normalizes licenses to certifications", () => {
    const data = {
      licenses: [{ name: "PMP" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.certifications).toEqual([{ name: "PMP" }]);
  });

  it("normalizes title to name in certification items", () => {
    const data = {
      certifications: [{ title: "AWS Solutions Architect" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.certifications as any[])[0].name).toBe("AWS Solutions Architect");
  });

  it("normalizes organization to issuer", () => {
    const data = {
      certifications: [{ organization: "AWS" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.certifications as any[])[0].issuer).toBe("AWS");
  });

  it("normalizes issued to date", () => {
    const data = {
      certifications: [{ issued: "2023-06" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.certifications as any[])[0].date).toBe("2023-06");
  });

  it("normalizes link to url", () => {
    const data = {
      certifications: [{ link: "https://cert.example.com" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.certifications as any[])[0].url).toBe("https://cert.example.com");
  });

  it("handles string certification as name", () => {
    const data = {
      certifications: ["AWS Certified"],
    };
    const result = normalizeAiKeys(data);
    expect(result.certifications).toEqual([{ name: "AWS Certified", issuer: "" }]);
  });
});

describe("normalizeAiKeys - projects", () => {
  it("normalizes project_experience to projects", () => {
    const data = {
      project_experience: [{ title: "My Project" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.projects).toEqual([{ title: "My Project" }]);
  });

  it("normalizes personal_projects to projects", () => {
    const data = {
      personal_projects: [{ title: "Side Project" }],
    };
    const result = normalizeAiKeys(data);
    expect(result.projects).toEqual([{ title: "Side Project" }]);
  });

  it("normalizes name to title in project items", () => {
    const data = {
      projects: [{ name: "Cool App" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.projects as any[])[0].title).toBe("Cool App");
  });

  it("normalizes date_range to year", () => {
    const data = {
      projects: [{ date_range: "2023-2024" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.projects as any[])[0].year).toBe("2023-2024");
  });

  it("normalizes tech_stack to technologies", () => {
    const data = {
      projects: [{ tech_stack: ["React", "Node"] }],
    };
    const result = normalizeAiKeys(data);
    expect((result.projects as any[])[0].technologies).toEqual(["React", "Node"]);
  });

  it("normalizes demo to url", () => {
    const data = {
      projects: [{ demo: "https://demo.example.com" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.projects as any[])[0].url).toBe("https://demo.example.com");
  });

  it("normalizes image to image_url", () => {
    const data = {
      projects: [{ image: "https://img.example.com" }],
    };
    const result = normalizeAiKeys(data);
    expect((result.projects as any[])[0].image_url).toBe("https://img.example.com");
  });

  it("handles string project as title", () => {
    const data = {
      projects: ["Cool Project"],
    };
    const result = normalizeAiKeys(data);
    expect(result.projects).toEqual([{ title: "Cool Project", description: "" }]);
  });
});

describe("normalizeAiKeys - professional level", () => {
  it("normalizes professionalLevel to professional_level", () => {
    const data = { professionalLevel: "senior" };
    const result = normalizeAiKeys(data);
    expect(result.professional_level).toBe("senior");
  });

  it("normalizes seniority to professional_level", () => {
    const data = { seniority: "mid_level" };
    const result = normalizeAiKeys(data);
    expect(result.professional_level).toBe("mid_level");
  });

  it("normalizes seniority_level to professional_level", () => {
    const data = { seniority_level: "entry_level" };
    const result = normalizeAiKeys(data);
    expect(result.professional_level).toBe("entry_level");
  });

  it("normalizes career_level to professional_level", () => {
    const data = { career_level: "executive" };
    const result = normalizeAiKeys(data);
    expect(result.professional_level).toBe("executive");
  });
});

describe("normalizeAiKeys - complete integration", () => {
  it("handles complex nested data structure", () => {
    const data = {
      fullName: "Jane Doe",
      title: "Senior Engineer",
      profile: "Experienced developer",
      contactInfo: {
        "e-mail": "jane@example.com",
        phone_number: "+1-555-1234",
        linkedin_url: "https://linkedin.com/in/jane",
      },
      workExperience: [
        {
          role: "Engineer",
          employer: "Acme Corp",
          startDate: "2020-01",
          endDate: "2022-12",
          bullets: ["Led team", "Built features"],
        },
      ],
      education_history: [
        {
          program: "CS",
          school: "MIT",
          year: "2019",
        },
      ],
      technical_skills: ["JavaScript", "Python"],
      certificates: ["AWS Cert"],
      projects: [
        {
          name: "Cool App",
          summary: "A cool app",
          tech_stack: ["React"],
        },
      ],
      seniority: "senior",
    };

    const result = normalizeAiKeys(data);

    expect(result.full_name).toBe("Jane Doe");
    expect(result.headline).toBe("Senior Engineer");
    expect(result.summary).toBe("Experienced developer");
    expect((result.contact as any).email).toBe("jane@example.com");
    expect((result.contact as any).phone).toBe("+1-555-1234");
    expect((result.contact as any).linkedin).toBe("https://linkedin.com/in/jane");
    expect((result.experience as any[])[0].title).toBe("Engineer");
    expect((result.experience as any[])[0].company).toBe("Acme Corp");
    expect((result.education as any[])[0].degree).toBe("CS");
    expect((result.education as any[])[0].institution).toBe("MIT");
    expect(result.skills).toEqual([{ category: "Skills", items: ["JavaScript", "Python"] }]);
    expect(result.certifications).toEqual([{ name: "AWS Cert", issuer: "" }]);
    expect((result.projects as any[])[0].title).toBe("Cool App");
    expect((result.projects as any[])[0].technologies).toEqual(["React"]);
    expect(result.professional_level).toBe("senior");
  });

  it("preserves fields that don't need normalization", () => {
    const data = {
      full_name: "Jane",
      headline: "Developer",
      custom_field: "value",
      another_custom: 123,
    };

    const result = normalizeAiKeys(data);

    expect(result.full_name).toBe("Jane");
    expect(result.headline).toBe("Developer");
    expect(result.custom_field).toBe("value");
    expect(result.another_custom).toBe(123);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
