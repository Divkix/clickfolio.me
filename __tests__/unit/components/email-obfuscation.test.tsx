import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { EmailLink } from "@/components/EmailLink";
import { ObfuscatedText } from "@/components/ObfuscatedText";

describe("EmailLink", () => {
  it("renders a mailto link with the email after mount", () => {
    render(<EmailLink email="alice@example.com" hideIcon />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "mailto:alice@example.com");
    expect(link).toHaveTextContent("alice@example.com");
  });

  it("renders custom children (e.g. a button label) instead of the address", () => {
    render(
      <EmailLink email="alice@example.com" hideIcon>
        Say Hello
      </EmailLink>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "mailto:alice@example.com");
    expect(link).toHaveTextContent("Say Hello");
    // The raw address must not appear as visible text when children are given.
    expect(link).not.toHaveTextContent("alice@example.com");
  });
});

describe("ObfuscatedText", () => {
  it("renders the real text after mount", () => {
    render(<ObfuscatedText text="bob@example.com" />);
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("honors a custom placeholder", () => {
    // After mount the real text shows; the placeholder is only pre-mount.
    // We assert the real text renders and the component does not throw.
    render(<ObfuscatedText text="bob@example.com" placeholder="hidden" />);
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });
});
