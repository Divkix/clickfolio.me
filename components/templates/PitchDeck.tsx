import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatShortDate } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// A founder's deck, presented one slide at a time: every section is a 16:9 slide frame on a grey
// presenter canvas, with one idea per slide, a big headline and a deck footer carrying the page
// number. The title and closing slides bookend the deck in solid cobalt.

const BLUE = "#2F5CFF";
const INK = "#14161F";
const MUTED = "#555A69";
const RULE = "#D4D6DE";

type SlideTone = "light" | "blue";

interface SlideSpec {
  key: string;
  label: string | null;
  tone: SlideTone;
  body: React.ReactNode;
}

function Slide({
  spec,
  number,
  total,
  deckName,
  footerNote,
}: {
  spec: SlideSpec;
  number: number;
  total: number;
  deckName: string;
  footerNote?: string | null;
}): React.ReactElement {
  const isBlue = spec.tone === "blue";

  return (
    <section
      aria-label={spec.label ?? deckName}
      className={`flex flex-col rounded-[3px] border px-6 pt-7 pb-5 sm:px-12 sm:pt-10 sm:pb-7 lg:px-16 sm:aspect-[16/9] ${
        isBlue ? "min-h-[24rem] text-white" : "bg-white"
      }`}
      style={
        isBlue ? { backgroundColor: BLUE, borderColor: BLUE } : { borderColor: RULE, color: INK }
      }
    >
      {spec.label && (
        <h2
          className="text-[clamp(1rem,1.5vw,1.25rem)] font-semibold"
          style={{ color: isBlue ? "#FFFFFF" : BLUE }}
        >
          {spec.label}
        </h2>
      )}
      <div className="flex flex-1 flex-col justify-center min-w-0 py-6 sm:py-8">{spec.body}</div>
      <footer
        className="flex items-baseline justify-between gap-4 text-[0.875rem] tabular-nums"
        style={{ color: isBlue ? "#FFFFFF" : MUTED }}
      >
        <span className="min-w-0 truncate">{footerNote ?? deckName}</span>
        <span className="shrink-0">
          {number} / {total}
        </span>
      </footer>
    </section>
  );
}

function summarySize(text: string): string {
  if (text.length > 420) return "text-[clamp(1.25rem,2.4vw,1.625rem)] leading-[1.4]";

  if (text.length > 200) return "text-[clamp(1.5rem,3.2vw,2.25rem)] leading-[1.25]";

  return "text-[clamp(1.75rem,4.4vw,3.25rem)] leading-[1.12]";
}

export const PitchDeck: React.FC<TemplateProps> = ({ content, profile }) => {
  const {
    full_name,
    summary,
    headline,
    contact,
    experience,
    education,
    skills,
    projects,
    certifications,
  } = content;

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];
  const jobs = experience ?? [];
  const [currentJob, ...earlierJobs] = jobs;
  const schools = education ?? [];
  const certs = certifications ?? [];
  const builtThings = projects ?? [];
  const deckName = full_name || `@${profile.handle}`;
  const emailLink = contactLinks.find((link) => link.type === "email");
  const otherLinks = contactLinks.filter((link) => link.type !== "email");

  const slides: SlideSpec[] = [];

  slides.push({
    key: "title",
    label: null,
    tone: "blue",
    body: (
      <div className="min-w-0">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt=""
            width={72}
            height={72}
            className="mb-8 h-[4.5rem] w-[4.5rem] rounded-full object-cover"
          />
        )}
        <h1 className="pd-display text-[clamp(2.75rem,9vw,6.75rem)] font-extrabold leading-[0.92] tracking-[-0.035em] [overflow-wrap:anywhere]">
          {full_name}
        </h1>
        {headline && (
          <p className="mt-6 max-w-[36ch] text-[clamp(1.125rem,2.2vw,1.5rem)] leading-[1.35] [overflow-wrap:anywhere]">
            {headline}
          </p>
        )}
      </div>
    ),
  });

  if (summary) {
    slides.push({
      key: "summary",
      label: "The one-liner",
      tone: "light",
      body: (
        <p
          className={`pd-display max-w-[34ch] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] ${summarySize(summary)}`}
        >
          {summary}
        </p>
      ),
    });
  }

  if (currentJob) {
    const span = formatDateSpan(currentJob.start_date, currentJob.end_date);
    const highlights = currentJob.highlights?.filter((item) => item.trim()) ?? [];

    slides.push({
      key: "traction",
      label: "Traction",
      tone: "light",
      body: (
        <div className="min-w-0">
          <h3 className="pd-display text-[clamp(1.875rem,4.6vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em] [overflow-wrap:anywhere]">
            {currentJob.title}
            {currentJob.company && (
              <span style={{ color: BLUE }}>
                {currentJob.title ? " at " : ""}
                {currentJob.company}
              </span>
            )}
          </h3>
          {(span || currentJob.location) && (
            <p className="mt-3 text-[1.0625rem]" style={{ color: MUTED }}>
              {[span, currentJob.location].filter(Boolean).join(", ")}
            </p>
          )}
          {currentJob.description && (
            <p className="mt-4 max-w-[60ch] text-[clamp(1.125rem,1.7vw,1.3125rem)] leading-[1.5] [overflow-wrap:anywhere]">
              {currentJob.description}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="border-t-2 pt-3 text-[clamp(1.0625rem,1.6vw,1.3125rem)] font-medium leading-[1.4] [overflow-wrap:anywhere]"
                  style={{ borderColor: INK }}
                >
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }

  if (earlierJobs.length > 0) {
    const roomy = earlierJobs.length <= 2;

    slides.push({
      key: "track-record",
      label: "Track record",
      tone: "light",
      body: (
        <ol className="min-w-0">
          {earlierJobs.map((job) => {
            const span = formatDateSpan(job.start_date, job.end_date);
            const lead = job.highlights?.find((item) => item.trim()) ?? job.description;

            return (
              <li
                key={`${job.company}-${job.title}-${job.start_date}`}
                className="grid gap-x-8 gap-y-1 border-t py-5 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr]"
                style={{ borderColor: RULE }}
              >
                <p className="text-[0.9375rem] tabular-nums sm:pt-[0.6em]" style={{ color: MUTED }}>
                  {span}
                </p>
                <div className="min-w-0">
                  <h3
                    className={`pd-display ${roomy ? "text-[clamp(1.75rem,3.8vw,3rem)]" : "text-[clamp(1.375rem,2.6vw,1.875rem)]"} font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere]`}
                  >
                    {job.title}
                    {job.company && (
                      <span style={{ color: BLUE }}>
                        {job.title ? ", " : ""}
                        {job.company}
                      </span>
                    )}
                  </h3>
                  {lead && (
                    <p
                      className={`mt-2 max-w-[62ch] ${roomy ? "text-[clamp(1.125rem,1.7vw,1.3125rem)]" : "text-[1.0625rem]"} leading-[1.5] [overflow-wrap:anywhere]`}
                    >
                      {lead}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ),
    });
  }

  if (builtThings.length > 0) {
    const roomy = builtThings.length <= 2;

    slides.push({
      key: "projects",
      label: "What I've built",
      tone: "light",
      body: (
        <div
          className={`grid min-w-0 gap-x-12 gap-y-8 ${builtThings.length > 1 ? "sm:grid-cols-2" : ""}`}
        >
          {builtThings.map((project) => (
            <div key={`${project.title}-${project.year ?? ""}`} className="min-w-0">
              <h3
                className={`pd-display ${roomy ? "text-[clamp(2rem,5vw,4rem)]" : "text-[clamp(1.625rem,3.4vw,2.5rem)]"} font-bold leading-[1.02] tracking-[-0.03em] [overflow-wrap:anywhere]`}
              >
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className="underline decoration-2 underline-offset-[0.15em] hover:decoration-[3px]"
                    style={{ textDecorationColor: BLUE }}
                  >
                    {project.title}
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              {project.year && (
                <p className="mt-1 text-[0.9375rem] tabular-nums" style={{ color: MUTED }}>
                  {project.year}
                </p>
              )}
              {project.description && (
                <p
                  className={`mt-3 max-w-[48ch] ${roomy ? "text-[clamp(1.125rem,1.7vw,1.3125rem)]" : "text-[1.0625rem]"} leading-[1.5] [overflow-wrap:anywhere]`}
                >
                  {project.description}
                </p>
              )}
              {project.technologies && project.technologies.length > 0 && (
                <p className="mt-2 text-[0.9375rem]" style={{ color: MUTED }}>
                  {project.technologies.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (skillGroups.length > 0) {
    slides.push({
      key: "skills",
      label: "What I bring",
      tone: "light",
      body: (
        <div className="grid min-w-0 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {skillGroups.map((group) => (
            <div key={group.category} className="min-w-0">
              <h3 className="border-b-2 pb-2 text-[1rem] font-bold" style={{ borderColor: INK }}>
                {group.category}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="pd-display text-[clamp(1.375rem,2.6vw,2rem)] font-semibold leading-[1.2] tracking-[-0.015em] [overflow-wrap:anywhere]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (schools.length > 0 || certs.length > 0) {
    const roomy = schools.length <= 2 && certs.length === 0;

    slides.push({
      key: "background",
      label: "Background",
      tone: "light",
      body: (
        <div
          className={`grid min-w-0 gap-x-12 gap-y-10 ${schools.length > 0 && certs.length > 0 ? "lg:grid-cols-[3fr_2fr]" : ""}`}
        >
          {schools.length > 0 && (
            <ul className="min-w-0 space-y-6">
              {schools.map((edu) => (
                <li key={`${edu.institution}-${edu.degree}`} className="min-w-0">
                  <h3
                    className={`pd-display ${roomy ? "text-[clamp(2rem,5vw,4rem)]" : "text-[clamp(1.5rem,3vw,2.25rem)]"} font-bold leading-[1.02] tracking-[-0.03em] [overflow-wrap:anywhere]`}
                  >
                    {edu.degree}
                  </h3>
                  <p
                    className={`mt-2 ${roomy ? "text-[clamp(1.125rem,1.7vw,1.3125rem)]" : "text-[1.0625rem]"}`}
                    style={{ color: MUTED }}
                  >
                    {[
                      edu.institution,
                      edu.graduation_date ? formatShortDate(edu.graduation_date) : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {certs.length > 0 && (
            <div className="min-w-0">
              <h3 className="border-b-2 pb-2 text-[1rem] font-bold" style={{ borderColor: INK }}>
                Credentials
              </h3>
              <ul className="mt-3 space-y-2.5">
                {certs.map((cert) => (
                  <li
                    key={`${cert.name}-${cert.issuer ?? ""}`}
                    className="text-[1.0625rem] leading-[1.4] [overflow-wrap:anywhere]"
                  >
                    <span className="font-semibold">{cert.name}</span>
                    {cert.issuer && <span style={{ color: MUTED }}>, {cert.issuer}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    });
  }

  slides.push({
    key: "ask",
    label: "The ask",
    tone: "blue",
    body: (
      <div className="min-w-0">
        <p className="pd-display text-[clamp(2.75rem,8vw,6rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
          {contactLinks.length > 0 ? "Let’s talk." : "Thank you."}
        </p>
        {emailLink && (
          <a
            href={emailLink.href}
            className="mt-6 inline-block text-[clamp(1.25rem,3vw,2rem)] font-semibold underline decoration-2 underline-offset-[0.2em] [overflow-wrap:anywhere] hover:decoration-[3px]"
          >
            {emailLink.label}
          </a>
        )}
        {otherLinks.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[1.0625rem]">
            {otherLinks.map((link) => (
              <li key={link.type} className="min-w-0 [overflow-wrap:anywhere]">
                {link.href ? (
                  <a
                    href={link.href}
                    target={link.isExternal ? "_blank" : undefined}
                    rel={link.isExternal ? "ugc nofollow noopener noreferrer" : undefined}
                    className="font-medium underline underline-offset-4 hover:decoration-2"
                  >
                    {link.label}
                  </a>
                ) : (
                  <span>{link.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  });

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@87.5..100,400..800&display=swap" />
      <style>{`
        .pd-deck, .pd-deck :is(h1, h2, h3, p, li, a, span) { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; }
        .pd-deck .pd-display { font-stretch: 87.5%; }
        .pd-deck a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      `}</style>
      <div className="pd-deck min-h-screen overflow-x-hidden bg-[#E3E4E8]" style={{ color: INK }}>
        <main className="mx-auto max-w-[66rem] px-4 pt-8 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
          <div className="space-y-6 sm:space-y-10">
            {slides.map((spec, index) => (
              <Slide
                key={spec.key}
                spec={spec}
                number={index + 1}
                total={slides.length}
                deckName={deckName}
                footerNote={spec.key === "title" ? contact.location || null : null}
              />
            ))}
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#454956]">@{profile.handle}</p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="pitch-deck"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
