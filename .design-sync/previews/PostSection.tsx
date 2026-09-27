import { PostList, PostSection } from "@clickfolio/ui";
import type { ReactNode } from "react";

// Same wrapper classes as components/blog/BlogPostLayout.tsx, where these sections live.
const Prose = ({ children }: { children: ReactNode }) => (
  <div className="max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm">
    <div className="prose max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:text-muted-foreground prose-p:leading-[1.8] prose-ul:space-y-3 prose-ol:space-y-3 prose-li:text-muted-foreground prose-strong:text-foreground prose-strong:font-semibold prose-a:text-brand prose-a:no-underline hover:prose-a:underline">{children}</div>
  </div>
);

export const WithIntro = () => (
  <Prose>
    <PostSection
      heading="What Linkfolio does well"
      intro="Before switching, it's worth knowing what you'd give up. linkfolio.net has a few features we don't offer:"
    >
      <PostList
        items={[
          {
            lead: "Custom domains.",
            body: " The Basic plan (€4.99/month) lets you connect your own domain. clickfolio.me can't do this yet; it's on our roadmap.",
          },
          {
            lead: "AI translation.",
            body: " Basic includes one translation language and Pro (€9.99/month) includes ten.",
          },
          {
            lead: "Several ways to start.",
            body: " Besides uploading a resume, you can build your portfolio by chatting or talking to the AI.",
          },
        ]}
      />
    </PostSection>
  </Prose>
);

export const ParagraphsOnly = () => (
  <Prose>
    <PostSection heading="Why people look for a Linkfolio alternative">
      <p>
        The common reasons are cost, branding, and fit. linkfolio.net's free plan puts your site on
        a subdomain with a "Made with Linkfolio" watermark; removing it means paying monthly.
      </p>
      <p>
        clickfolio.me is free: upload a PDF resume and get a hosted site at clickfolio.me/@janedoe
        in about 30 seconds.
      </p>
    </PostSection>
  </Prose>
);
