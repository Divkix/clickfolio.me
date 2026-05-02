import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacyStep } from "@/components/wizard/PrivacyStep";
import type { ResumeContent } from "@/lib/types/database";

// ============================================================================
// Mock resume content with contact info
// ============================================================================

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

// ============================================================================
// PrivacyStep Component Tests
// ============================================================================

describe("PrivacyStep Component", () => {
  it("renders with default initial settings", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    // Check that all toggles are present
    expect(screen.getByLabelText(/Show Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show Full Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show in Explore Directory/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hide from Search Engines/i)).toBeInTheDocument();
  });

  it("renders with custom initial settings including hide_from_search", () => {
    const onContinue = vi.fn();
    const initialSettings = {
      show_phone: true,
      show_address: true,
      show_in_directory: false,
      hide_from_search: true,
    };

    render(
      <PrivacyStep
        content={mockContent}
        initialSettings={initialSettings}
        onContinue={onContinue}
      />,
    );

    // Check toggles reflect initial settings
    expect(screen.getByLabelText(/Show Phone Number/i)).toBeChecked();
    expect(screen.getByLabelText(/Show Full Address/i)).toBeChecked();
    expect(screen.getByLabelText(/Show in Explore Directory/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Hide from Search Engines/i)).toBeChecked();
  });

  it("calls onContinue with all 4 privacy settings including hide_from_search", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    // Toggle some settings
    fireEvent.click(screen.getByLabelText(/Show Phone Number/i));
    fireEvent.click(screen.getByLabelText(/Hide from Search Engines/i));

    // Click continue
    fireEvent.click(screen.getByText(/Continue/i));

    // Verify onContinue was called with all 4 settings
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({
      show_phone: true, // toggled from default false
      show_address: false, // default
      show_in_directory: true, // default
      hide_from_search: true, // toggled from default false
    });
  });

  it("passes hide_from_search: false by default when no initialSettings provided", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    // Click continue without changing anything
    fireEvent.click(screen.getByText(/Continue/i));

    // Verify default includes hide_from_search: false
    expect(onContinue).toHaveBeenCalledWith({
      show_phone: false,
      show_address: false,
      show_in_directory: true,
      hide_from_search: false,
    });
  });

  it("displays correct preview text for hide_from_search toggle when enabled", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    // Enable hide from search
    fireEvent.click(screen.getByLabelText(/Hide from Search Engines/i));

    // Check preview text
    expect(screen.getByText(/Not indexed by search engines/i)).toBeInTheDocument();
    expect(screen.getByText(/\(noindex\)/i)).toBeInTheDocument();
  });

  it("displays correct preview text for hide_from_search toggle when disabled", () => {
    const onContinue = vi.fn();

    render(<PrivacyStep content={mockContent} onContinue={onContinue} />);

    // Default is disabled, check preview
    expect(screen.getByText(/Visible in search results/i)).toBeInTheDocument();
  });
});
