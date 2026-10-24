import { MaybeLink, LINK_REL } from "./shared/ExternalLink";
import type React from "react";
import { ShareBar } from "@/components/ShareBar";
import { getContactLinks } from "@/lib/templates/contact-links";
import { formatDateSpan, formatYear } from "@/lib/templates/helpers";
import type { TemplateProps } from "@/lib/types/template";
import { TemplateFontLinks } from "./shared/TemplateFontLinks";

// An athletics meet: the name is painted across the lanes of a red tartan track, real marks from
// the resume light up an LED infield board, and the career reads as a printed results sheet.
//
// The hero never layers text over a shape. Every line of hero text (name, headline, contacts) is
// exactly one lane tall, so lane lines always fall between lines of text and the track ends on a
// lane boundary at any width or wrap count.

const TRACK = "#B0372A";
const INK = "#16171A";
const MUTED = "#55585F";
const LED = "#FFB01F";

interface Mark {
  value: string;
  unit: string;
  text: string;
}

// Figures with a unit or sign, or bare counts. Bare four-digit years are skipped so "since 2019"
// never shows up as a mark.
const FIGURE =
  /([$£€]?\d+(?:[.,]\d+)*)(\s?(?:%|\+|x\b|inches\b|inch\b|in\b|lbs?\b|kg\b|mph\b|seconds\b|sec\b|cm\b|m\b|k\b))?/g;

function findMark(text: string): Mark | null {
  for (const match of text.matchAll(FIGURE)) {
    const value = match[1];
    const unit = (match[2] ?? "").trim();
    const isYear = /^(19|20)\d{2}$/.test(value) && unit === "";

    if (!isYear) return { value, unit, text };
  }

  return null;
}

/** A results-sheet row: label column, middle column, right-aligned figure column. */
function SheetRow({
  primary,
  secondary,
  figure,
  children,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  figure?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <li className="pb-row px-3 sm:px-4 py-3.5 min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 items-baseline">
        <h3 className="pb-name text-[1.0625rem] font-bold leading-snug break-words min-w-0">
          {primary}
        </h3>
        <p
          className="col-start-1 sm:col-start-2 sm:row-start-1 text-[0.9375rem] leading-snug break-words min-w-0"
          style={{ color: MUTED }}
        >
          {secondary}
        </p>
        {figure && (
          <p className="col-start-2 row-start-1 sm:col-start-3 text-[0.9375rem] font-semibold tabular-nums text-right whitespace-nowrap">
            {figure}
          </p>
        )}
      </div>
      {children}
    </li>
  );
}

function SheetHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="pb-display text-white text-[1.75rem] leading-none px-3 sm:px-4 pt-2 pb-1.5"
      style={{ backgroundColor: TRACK }}
    >
      {children}
    </h2>
  );
}

const LANE_NUMBERS = Array.from({ length: 24 }, (_, i) => i + 1);

export const PersonalBest: React.FC<TemplateProps> = ({ content, profile }) => {
  const { full_name, summary, headline, contact, experience, education, skills, certifications } =
    content;

  const projects = content.projects ?? [];

  const contactLinks = getContactLinks(contact);
  const skillGroups = skills?.filter((group) => group.items.length > 0) ?? [];

  const marks = (experience ?? [])
    .flatMap((job) => job.highlights ?? [])
    .map(findMark)
    .filter((mark): mark is Mark => mark !== null)
    .slice(0, 3);

  return (
    <>
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Saira+Extra+Condensed:wght@600;800&family=Sofia+Sans:wght@400;600;700&family=Doto:wght@800&display=swap" />
      <style>{`
        .pb-root { --lane: clamp(3rem, 9vw, 6.5rem); }
        .pb-root, .pb-root :is(p, li, a, span, h3) { font-family: 'Sofia Sans', ui-sans-serif, system-ui, sans-serif; }
        .pb-root :is(.pb-display, h1, h2) { font-family: 'Saira Extra Condensed', 'Arial Narrow', sans-serif; font-weight: 800; }
        .pb-root .pb-led { font-family: 'Doto', ui-monospace, monospace; font-weight: 800; }
        .pb-track {
          background-color: ${TRACK};
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent calc(var(--lane) - 3px),
            rgba(255, 255, 255, 0.7) calc(var(--lane) - 3px),
            rgba(255, 255, 255, 0.7) var(--lane)
          );
        }
        .pb-lane-no { height: var(--lane); font-size: calc(var(--lane) * 0.46); }
        .pb-root h1 { font-size: calc(var(--lane) * 0.9); line-height: var(--lane); }
        .pb-meta { line-height: var(--lane); }
        .pb-headline { font-size: min(calc(var(--lane) * 0.36), 1.625rem); }
        .pb-hero-in { padding-left: max(4.25rem, calc((100% - 60rem) / 2 + 1rem)); padding-right: 1rem; }
        @media (min-width: 640px) {
          .pb-hero-in { padding-left: max(7rem, calc((100% - 60rem) / 2 + 2rem)); padding-right: 2rem; }
        }
        .pb-sheet .pb-row:nth-child(odd) { background-color: #F0F0EC; }
        .pb-led-glow { text-shadow: 0 0 14px rgba(255, 176, 31, 0.45); }
      `}</style>
      <div className="pb-root min-h-screen bg-white overflow-x-hidden" style={{ color: INK }}>
        <header className="pb-track relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-12 sm:w-20 border-r-[6px] border-white"
          >
            {LANE_NUMBERS.map((n) => (
              <span
                key={n}
                className="pb-lane-no pb-display flex items-center justify-center leading-none"
              >
                {n}
              </span>
            ))}
          </div>
          <div className="pb-hero-in">
            <div className="max-w-[56rem]">
              <h1 className="uppercase tracking-[0.01em] break-words">{full_name}</h1>
              <div className="pb-meta">
                {headline && <p className="pb-headline font-semibold break-words">{headline}</p>}
                {contactLinks.length > 0 && (
                  <ul className="flex flex-wrap gap-x-6 text-[0.9375rem]">
                    {contactLinks.map((link) => (
                      <li key={link.type} className="min-w-0 break-all">
                        {link.href ? (
                          <a
                            href={link.href}
                            target={link.isExternal ? "_blank" : undefined}
                            rel={link.isExternal ? LINK_REL : undefined}
                            className="text-white underline decoration-white/60 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <span className="text-white">{link.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </header>

        {marks.length > 0 && (
          <section aria-labelledby="pb-marks" className="bg-black text-white py-8">
            <div className="mx-auto max-w-[60rem] px-4 sm:px-8">
              <h2
                id="pb-marks"
                className="text-[1.375rem] leading-none mb-5"
                style={{ color: "#A3A3A3" }}
              >
                Best marks
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#2E2E2E] border border-[#2E2E2E]">
                {marks.map((mark) => (
                  <li key={mark.text} className="bg-black px-5 py-5 min-w-0">
                    <p className="pb-led-glow leading-none break-words" style={{ color: LED }}>
                      <span className="pb-led text-[clamp(2.75rem,6vw,4rem)] tabular-nums">
                        {mark.value}
                      </span>
                      {mark.unit && (
                        <span className="pb-led text-[clamp(1.25rem,2.4vw,1.625rem)] ml-1.5">
                          {mark.unit}
                        </span>
                      )}
                    </p>
                    <p className="mt-3 text-[0.875rem] leading-relaxed text-[#CFCFCF] break-words">
                      {mark.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <main className="pb-sheet mx-auto max-w-[60rem] px-4 sm:px-8 pt-10 pb-20">
          {summary && (
            <p className="max-w-[40rem] text-[1.1875rem] leading-[1.6] break-words">{summary}</p>
          )}

          {experience && experience.length > 0 && (
            <section className="mt-12">
              <SheetHeading>Career</SheetHeading>
              <ul>
                {experience.map((job) => (
                  <SheetRow
                    key={`${job.company}-${job.title}-${job.start_date}`}
                    primary={job.title}
                    secondary={[job.company, job.location].filter(Boolean).join(", ")}
                    figure={formatDateSpan(job.start_date, job.end_date)}
                  >
                    {job.description && (
                      <p className="mt-2 max-w-[44rem] text-[0.9375rem] leading-relaxed break-words">
                        {job.description}
                      </p>
                    )}
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="mt-2 max-w-[44rem] space-y-1 list-disc pl-5 marker:text-[#B0372A]">
                        {job.highlights.map((highlight) => (
                          <li
                            key={`${job.title}-${highlight}`}
                            className="text-[0.9375rem] leading-relaxed break-words"
                          >
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </SheetRow>
                ))}
              </ul>
            </section>
          )}

          {projects.length > 0 && (
            <section className="mt-12">
              <SheetHeading>Projects</SheetHeading>
              <ul>
                {projects.map((project) => (
                  <SheetRow
                    key={`${project.title}-${project.year ?? ""}`}
                    primary={
                      <MaybeLink
                        href={project.url}
                        className="underline decoration-[#B0372A] underline-offset-4"
                      >
                        {project.title}
                      </MaybeLink>
                    }
                    secondary={project.technologies?.join(", ")}
                    figure={project.year ? formatYear(project.year) : null}
                  >
                    <p className="mt-2 max-w-[44rem] text-[0.9375rem] leading-relaxed break-words">
                      {project.description}
                    </p>
                  </SheetRow>
                ))}
              </ul>
            </section>
          )}

          {skillGroups.length > 0 && (
            <section className="mt-12">
              <SheetHeading>Disciplines</SheetHeading>
              <ul>
                {skillGroups.map((group) => (
                  <SheetRow
                    key={`${group.category}-${group.items.join(",")}`}
                    primary={group.category || "Skills"}
                    secondary={group.items.join(", ")}
                  />
                ))}
              </ul>
            </section>
          )}

          {education && education.length > 0 && (
            <section className="mt-12">
              <SheetHeading>Education</SheetHeading>
              <ul>
                {education.map((edu) => (
                  <SheetRow
                    key={`${edu.institution}-${edu.degree}`}
                    primary={edu.degree}
                    secondary={[edu.institution, edu.location].filter(Boolean).join(", ")}
                    figure={edu.graduation_date ? formatYear(edu.graduation_date) : null}
                  />
                ))}
              </ul>
            </section>
          )}

          {certifications && certifications.length > 0 && (
            <section className="mt-12">
              <SheetHeading>Certifications</SheetHeading>
              <ul>
                {certifications.map((cert) => (
                  <SheetRow
                    key={`${cert.name}-${cert.issuer ?? ""}`}
                    primary={cert.name}
                    secondary={cert.issuer}
                    figure={cert.date ? formatYear(cert.date) : null}
                  />
                ))}
              </ul>
            </section>
          )}

          <footer
            className="mt-16 pt-5 border-t-[6px] flex flex-wrap items-center justify-between gap-4"
            style={{ borderColor: TRACK }}
          >
            <p className="min-w-0 break-all text-sm" style={{ color: MUTED }}>
              @{profile.handle}
            </p>
            <ShareBar
              handle={profile.handle}
              title={`${full_name}'s Portfolio`}
              name={full_name}
              variant="personal-best"
            />
          </footer>
        </main>
      </div>
    </>
  );
};
