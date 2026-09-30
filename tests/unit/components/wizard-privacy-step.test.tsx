import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import type { ResumeContent } from "@/lib/types/database";

const mockContent: ResumeContent = {
  contact: {
    email: "test@example.com",
    phone: "+1 (555) 123-4567",
    location: "123 Main St, San Francisco, CA 94102",
  },
  full_name: "Test User",
  headline: "Software Engineer",
  summary: "Experienced software engineer with expertise in TypeScript and React.",
  skills: [
    { category: "Languages", items: ["TypeScript", "JavaScript"] },
    { category: "Frontend", items: ["React", "Next.js"] },
  ],
  experience: [
    {
      title: "Developer",
      company: "Tech Corp",
      start_date: "2020-01",
      end_date: "2024-01",
      description: "Developed web applications using React and TypeScript.",
      highlights: ["Improved performance by 50%", "Led team of 5 developers"],
    },
  ],
  education: [
    {
      degree: "BS Computer Science",
      institution: "University",
      graduation_date: "2020",
    },
  ],
};

describe("PrivacyStep Component", () => {
  it("renders with default initial settings", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    expect(screen.getByLabelText(/Show Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show Full Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show in Explore Directory/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hide from Search Engines/i)).toBeInTheDocument();
  });

  it("calls onContinue with all 4 privacy settings including hide_from_search", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    fireEvent.click(screen.getByLabelText(/Show Phone Number/i));
    fireEvent.click(screen.getByLabelText(/Hide from Search Engines/i));

    fireEvent.click(screen.getByText(/Continue/i));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({
      show_phone: true,
      show_address: false,
      show_in_directory: true,
      hide_from_search: true,
    });
  });

  it("passes hide_from_search: false by default when no initialSettings provided", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    fireEvent.click(screen.getByText(/Continue/i));

    expect(onContinue).toHaveBeenCalledWith({
      show_phone: false,
      show_address: false,
      show_in_directory: true,
      hide_from_search: false,
    });
  });
});
