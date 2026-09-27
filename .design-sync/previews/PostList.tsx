import { PostList } from "@clickfolio/ui";
import type { ReactNode } from "react";

// Same wrapper classes as components/blog/BlogPostLayout.tsx, where these lists live.
const Prose = ({ children }: { children: ReactNode }) => (
  <div className="max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm">
    <div className="prose max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:text-muted-foreground prose-p:leading-[1.8] prose-ul:space-y-3 prose-ol:space-y-3 prose-li:text-muted-foreground prose-strong:text-foreground prose-strong:font-semibold prose-a:text-brand prose-a:no-underline hover:prose-a:underline">{children}</div>
  </div>
);

export const Unordered = () => (
  <Prose>
    <PostList
      items={[
        {
          lead: "Custom domains.",
          body: " The Basic plan (€4.99/month) lets you connect your own domain.",
        },
        {
          lead: "PDF export and a contact QR code.",
          body: " Export a PDF resume from your portfolio and share a QR code that saves you as a contact.",
        },
        {
          lead: "Several ways to start.",
          body: " Build your portfolio by uploading a resume, chatting, or talking to the AI.",
        },
      ]}
    />
  </Prose>
);

export const Ordered = () => (
  <Prose>
    <PostList
      ordered
      items={[
        { lead: "Export your resume as a PDF.", body: " From Google Docs, Word, or LinkedIn's Save to PDF." },
        { lead: "Upload it to clickfolio.me.", body: " No account needed until you publish." },
        { lead: "Pick your handle.", body: " Your site goes live at clickfolio.me/@janedoe." },
        { lead: "Choose a template.", body: " 12 free themes, switchable any time." },
      ]}
    />
  </Prose>
);
