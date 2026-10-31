import { renderToStaticMarkup } from "react-dom/server";
import { useForm, type FieldErrors } from "react-hook-form";
import { describe, expect, it, vi } from "vite-plus/test";
import { EditResumeForm, focusInvalidFields } from "@/components/forms/EditResumeForm";
import { ContactSection } from "@/components/forms/sections/ContactSection";
import { ExperienceSection } from "@/components/forms/sections/ExperienceSection";
import { SkillsSection } from "@/components/forms/sections/SkillsSection";
import { Form } from "@/components/ui/form";
import type { ResumeContentFormData } from "@/lib/schemas/resume";

const RESUME: ResumeContentFormData = {
  full_name: "Test Person",
  headline: "Engineer",
  summary: "Builds useful things.",
  contact: { email: "test@example.com" },
  experience: [
    {
      title: "Engineer",
      company: "Company",
      start_date: "2020",
      description: "",
      highlights: ["Achievement"],
    },
  ],
  skills: [{ category: "Languages", items: ["TypeScript", "JavaScript"] }],
};

const ERRORS: FieldErrors<ResumeContentFormData> = {
  contact: { email: { type: "invalid_format", message: "Enter a valid email address" } },
  experience: [{ highlights: [{ type: "custom", message: "Use plain text without HTML tags" }] }],
  skills: [
    {
      items: [
        { type: "custom", message: "Use plain text without HTML tags" },
        { type: "custom", message: "Use plain text without HTML tags" },
      ],
    },
  ],
};

function InvalidSections() {
  const form = useForm<ResumeContentFormData>({ defaultValues: RESUME, errors: ERRORS });

  return (
    <Form {...form}>
      <ContactSection form={form} />
      <ExperienceSection form={form} />
      <SkillsSection form={form} />
    </Form>
  );
}

function field(name: string) {
  return { name, scrollIntoView: vi.fn(), focus: vi.fn() };
}

describe("resume editor validation", () => {
  it("renders compact inline errors and accessible named list inputs", () => {
    const html = renderToStaticMarkup(<InvalidSections />);

    expect(html).toContain("Enter a valid email address");
    expect(html.match(/Use plain text without HTML tags/g)).toHaveLength(2);
    expect(html).toContain('name="experience.0.highlights.0"');
    expect(html).toContain('name="skills.0.items"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("wrap-anywhere");
  });

  it("bypasses native email and URL popups so schema errors can render inline", () => {
    const html = renderToStaticMarkup(<EditResumeForm initialData={RESUME} onSave={vi.fn()} />);

    expect(html).toMatch(/novalidate/i);
    expect(html).toContain('type="email"');
  });

  it("counts invalid controls once and scrolls/focuses the first in page order", () => {
    const valid = field("full_name");
    const email = field("contact.email");
    const achievement = field("experience.0.highlights.0");
    const skills = field("skills.0.items");

    expect(focusInvalidFields([valid, email, achievement, skills], ERRORS)).toBe(3);
    expect(email.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(email.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(valid.focus).not.toHaveBeenCalled();
    expect(achievement.focus).not.toHaveBeenCalled();
    expect(skills.focus).not.toHaveBeenCalled();
  });

  it("does not move focus for valid fields", () => {
    const email = field("contact.email");

    expect(focusInvalidFields([email], {})).toBe(0);
    expect(email.focus).not.toHaveBeenCalled();
  });
});
